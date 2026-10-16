import os
import openpyxl
from datetime import datetime, date
from sqlalchemy.orm import Session
from app.Repository.Contabilidad.TesoreriaRepository import TesoreriaRepository
from app.Repository.Contabilidad.CuentasCobrarRepository import CuentasCobrarRepository
from app.Repository.Contabilidad.CuentasPagarRepository import CuentasPagarRepository
from app.Repository.Logistica.ClienteRepository import ClienteRepository

class ExcelImportService:
    def __init__(self, db: Session):
        self.db = db
        self.tesoreria_repo = TesoreriaRepository(db)
        self.cxc_repo = CuentasCobrarRepository(db)
        self.cxp_repo = CuentasPagarRepository(db)
        self.cliente_repo = ClienteRepository(db)

    def _parse_date(self, val) -> date | None:
        if not val:
            return None
        if isinstance(val, datetime):
            return val.date()
        if isinstance(val, date):
            return val
        if isinstance(val, str):
            val = val.strip()
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%Y/%m/%d"):
                try:
                    return datetime.strptime(val, fmt).date()
                except ValueError:
                    pass
        return None

    def _parse_float(self, val) -> float:
        if val is None or val == "" or str(val).strip() == "-" or str(val).strip() == "#REF!":
            return 0.0
        try:
            return float(str(val).replace(",", "").strip())
        except ValueError:
            return 0.0

    # =========================================================================
    # 1. IMPORTAR FLUJO DE CAJA Y SOLICITUDES DE CAJA CHICA
    # =========================================================================
    def ImportarFlujoDeCaja(self, file_path: str) -> dict:
        wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        movimientos_creados = 0
        solicitudes_creadas = 0

        categorias = {c["NombreCategoria"].lower(): c["IdCategoriaMovimientoCaja"] 
                      for c in self.tesoreria_repo.ListarCategoriasMovimiento()}
        id_cat_egreso_def = categorias.get("otros gastos", 6)
        id_cat_ingreso_def = categorias.get("ingreso por venta directa", 1)

        bancos = {b["Sigla"]: b["IdCuentaBancaria"] for b in self.tesoreria_repo.ListarCuentasBancarias()}

        for sname in wb.sheetnames:
            # Procesar hojas de meses de caja (ej: 'Diciembre 25', 'AGOSTO 26 ')
            if "25" in sname or "26" in sname or "flujo" in sname.lower():
                ws = wb[sname]
                for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
                    if r_idx <= 6:
                        continue # encabezados
                    if not row or len(row) < 9:
                        continue
                    
                    fecha_raw = row[2]
                    fecha = self._parse_date(fecha_raw)
                    if not fecha:
                        continue
                    
                    nota_codigo = str(row[3]).strip() if row[3] and str(row[3]).strip() != "-" else None
                    solicitante = str(row[4]).strip() if row[4] else None
                    descripcion = str(row[5]).strip() if row[5] else "Movimiento de caja"
                    respaldo = str(row[6]).strip() if row[6] else None
                    ingreso = self._parse_float(row[7])
                    gasto = self._parse_float(row[8])

                    if ingreso <= 0 and gasto <= 0:
                        continue

                    es_ingreso = ingreso > 0
                    monto = ingreso if es_ingreso else gasto

                    # Identificar categoría por columnas clasificadoras
                    id_cat = id_cat_ingreso_def if es_ingreso else id_cat_egreso_def
                    id_banco = None

                    if len(row) > 10 and self._parse_float(row[10]) > 0:
                        id_banco = bancos.get("BU")
                        id_cat = categorias.get("depósito a banco unión", id_cat)
                    elif len(row) > 11 and self._parse_float(row[11]) > 0:
                        id_banco = bancos.get("BNB")
                        id_cat = categorias.get("depósito a banco nacional", id_cat)
                    elif len(row) > 12 and self._parse_float(row[12]) > 0:
                        id_cat = categorias.get("compra de dólar", id_cat)
                    elif len(row) > 13 and self._parse_float(row[13]) > 0:
                        id_cat = categorias.get("combustible y lubricantes", id_cat)
                    elif len(row) > 14 and self._parse_float(row[14]) > 0:
                        id_cat = categorias.get("compra de materiales", id_cat)
                    elif len(row) > 15 and self._parse_float(row[15]) > 0:
                        id_cat = categorias.get("flete y transporte", id_cat)

                    # Registrar movimiento de caja
                    self.tesoreria_repo.CrearMovimientoCaja({
                        "IdAperturaCierreCaja": None,
                        "IdCategoriaMovimientoCaja": id_cat,
                        "Monto": monto,
                        "MetodoPago": "Efectivo",
                        "NumeroReferencia": respaldo,
                        "NotaCodigo": nota_codigo,
                        "Solicitante": solicitante,
                        "Respaldo": respaldo,
                        "IdCuentaBancaria": id_banco,
                        "Descripcion": descripcion
                    })
                    movimientos_creados += 1

                    # Si tiene código de solicitud SC, registrar también en SolicitudCajaChica
                    if nota_codigo and nota_codigo.startswith("SC") and gasto > 0:
                        try:
                            self.tesoreria_repo.CrearSolicitudCajaChica({
                                "CodigoSolicitud": nota_codigo,
                                "IdCaja": 1,
                                "FechaSolicitud": fecha,
                                "NombreSolicitante": solicitante or "Personal Solicitante",
                                "CargoSolicitante": "Operativo",
                                "MontoSolicitado": gasto,
                                "DestinoJustificacion": descripcion,
                                "NombreEntregadoPor": "Contabilidad",
                                "NombreAprobadoPor": "GERENCIA GENERAL",
                                "Estado": "Rendida",
                                "IdCategoriaMovimientoCaja": id_cat,
                                "RespaldoDoc": respaldo
                            })
                            solicitudes_creadas += 1
                        except Exception:
                            pass # Código SC duplicado ignorado

        wb.close()
        return {
            "Archivo": os.path.basename(file_path),
            "MovimientosCajaImportados": movimientos_creados,
            "SolicitudesCajaChicaImportadas": solicitudes_creadas
        }

    # =========================================================================
    # 2. IMPORTAR CUENTAS POR COBRAR (CLIENTES Y LEDGER)
    # =========================================================================
    def ImportarCuentasPorCobrar(self, file_path: str) -> dict:
        wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        clientes_creados = 0
        cuentas_creadas = 0
        abonos_creados = 0

        bancos = {b["Sigla"]: b["IdCuentaBancaria"] for b in self.tesoreria_repo.ListarCuentasBancarias()}

        for sname in wb.sheetnames:
            # Omitir hojas de recaudación mensual o resumen general
            if sname.startswith("RECAU.") or sname in ["CXC", "1", "2", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]:
                continue

            ws = wb[sname]
            cliente_nombre = None
            celular = None
            destino = "Sucre"
            linea_credito = "Al contado"

            filas_datos = []
            for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
                if r_idx in [5, 6, 7, 8]:
                    txt = " ".join([str(c) for c in row if c])
                    if "CLIENTE:" in txt:
                        partes = txt.split("CLIENTE:")
                        if len(partes) > 1:
                            cliente_nombre = partes[1].strip()
                    if "CELULAR:" in txt:
                        partes = txt.split("CELULAR:")
                        if len(partes) > 1 and partes[1].strip():
                            celular = partes[1].strip()
                    if "DESTINO:" in txt:
                        partes = txt.split("DESTINO:")
                        if len(partes) > 1 and partes[1].strip():
                            destino = partes[1].strip()
                    if "LINEA DE CREDITO:" in txt:
                        partes = txt.split("LINEA DE CREDITO:")
                        if len(partes) > 1 and partes[1].strip():
                            linea_credito = partes[1].strip()

                if r_idx >= 11:
                    if row and any(row):
                        filas_datos.append(row)

            if not cliente_nombre:
                cliente_nombre = sname.strip()

            # Asegurar cliente en tabla Cliente
            cli = self.cliente_repo.caller.LlamarUnRegistro(
                'SELECT "IdCliente" FROM "Cliente" WHERE "RazonSocial" ILIKE :nom LIMIT 1;',
                {"nom": cliente_nombre}
            )
            if cli:
                id_cliente = cli["IdCliente"]
            else:
                cli_creado = self.cliente_repo.caller.LlamarUnRegistro(
                    """
                    INSERT INTO "Cliente" ("RazonSocial", "Telefono", "CiudadDestino", "LineaCredito", "IdEstadoCliente")
                    VALUES (:nom, :tel, :dest, :lc, 1)
                    RETURNING "IdCliente";
                    """,
                    {"nom": cliente_nombre, "tel": celular, "dest": destino, "lc": linea_credito}
                )
                id_cliente = cli_creado["IdCliente"]
                clientes_creados += 1

            # Procesar transacciones de notas de venta y pagos
            cxc_actual = None
            for row in filas_datos:
                if len(row) < 8:
                    continue

                nota_venta = str(row[1]).strip() if row[1] else None
                nota_entrega = str(row[2]).strip() if row[2] else None
                fecha_despacho = self._parse_date(row[3])
                monto_cobrar = self._parse_float(row[4])
                deposito = self._parse_float(row[5])
                fecha_deposito = self._parse_date(row[6]) or (fecha_despacho or date.today())
                saldo = self._parse_float(row[7])
                observacion = str(row[9]).strip() if len(row) > 9 and row[9] else None
                banco_sigla = str(row[10]).strip() if len(row) > 10 and row[10] else "BU"

                # Si es una nueva nota de despacho/venta
                if monto_cobrar > 0:
                    cxc = self.cxc_repo.CrearCuentaCobrar({
                        "IdCliente": id_cliente,
                        "IdPedido": None,
                        "IdNotaVenta": None,
                        "NumeroNotaVenta": nota_venta,
                        "NumeroNotaEntrega": nota_entrega,
                        "FechaDespacho": fecha_despacho or date.today(),
                        "DiasMora": 0,
                        "IdEstadoCuentaCobrar": 3 if saldo == 0 else 1,
                        "MontoTotal": monto_cobrar,
                        "SaldoPendiente": saldo if saldo > 0 else 0,
                        "FechaEmision": fecha_despacho or date.today(),
                        "FechaVencimiento": None,
                        "IdUsuarioRegistro": None,
                        "Observacion": observacion
                    })
                    cxc_actual = cxc
                    cuentas_creadas += 1

                # Si hay abono/depósito en esta fila
                if deposito > 0 and cxc_actual:
                    id_banco = bancos.get(banco_sigla, bancos.get("BU"))
                    self.cxc_repo.RegistrarAbono({
                        "IdCuentaCobrar": cxc_actual["IdCuentaCobrar"],
                        "IdNotaVenta": None,
                        "IdCuentaBancaria": id_banco,
                        "IdMovimientoCaja": None,
                        "IdMetodoPago": 2, # Transferencia
                        "MontoAbonado": deposito,
                        "FechaAbono": datetime.combine(fecha_deposito, datetime.min.time()),
                        "BancoSigla": banco_sigla,
                        "Depositante": observacion,
                        "Moneda": "BOB",
                        "MontoDolares": 0.0,
                        "TipoCambio": 1.0,
                        "NumeroReferencia": None,
                        "Observacion": observacion
                    })
                    abonos_creados += 1

        wb.close()
        return {
            "Archivo": os.path.basename(file_path),
            "ClientesCreados": clientes_creados,
            "CuentasCobrarImportadas": cuentas_creadas,
            "AbonosImportados": abonos_creados
        }

    # =========================================================================
    # 3. IMPORTAR NOTAS DE VENTA POR CAMIÓN
    # =========================================================================
    def ImportarNotasVentaCamion(self, file_path: str) -> dict:
        wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        ws = wb['VENTAS Y PAGOS X CAMION'] if 'VENTAS Y PAGOS X CAMION' in wb.sheetnames else wb.active

        notas_creadas = 0
        detalles_creados = 0

        # Lista de columnas de productos según encabezado
        productos_cols = [
            (9, 'MEGA 12R'), (10, 'Economico'), (11, 'MEGA 12R 30mtrs'),
            (12, 'LUX 6R'), (13, 'LUX 12R'), (14, 'LUX 24R'),
            (15, 'SERV 500X6 .'), (16, 'SERV 200X12 .'), (17, 'TOALLA COCINA .'),
            (18, 'ECOPACK 4R Jaba'), (19, 'ECOPACK 4R unidades'),
            (20, 'ECOPACK 6R'), (21, 'ECOPACK 12R'),
            (29, 'MEGA 2ª'), (30, 'MEGA 3ª'), (31, 'SERV 2ª')
        ]

        for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
            if r_idx < 8:
                continue
            if not row or len(row) < 8:
                continue

            num_nota_venta = str(row[2]).strip() if row[2] else None
            if not num_nota_venta:
                continue

            num_nota_entrega = str(row[3]).strip() if row[3] else None
            fecha = self._parse_date(row[4]) or date.today()
            cliente_nombre = str(row[5]).strip() if row[5] else "Cliente General"
            destino = str(row[6]).strip() if row[6] else "Sucre"
            chofer = str(row[7]).strip() if len(row) > 7 and row[7] else None
            placa = str(row[8]).strip() if len(row) > 8 and row[8] else None

            total_venta = self._parse_float(row[34]) if len(row) > 34 else 0.0
            descuento = self._parse_float(row[35]) if len(row) > 35 else 0.0
            promocion = self._parse_float(row[36]) if len(row) > 36 else 0.0
            importe_neto = self._parse_float(row[38]) if len(row) > 38 else (total_venta - descuento - promocion)
            camiones = self._parse_float(row[39]) if len(row) > 39 else 1.0

            # Buscar o crear cliente
            cli = self.cliente_repo.caller.LlamarUnRegistro(
                'SELECT "IdCliente" FROM "Cliente" WHERE "RazonSocial" ILIKE :nom LIMIT 1;',
                {"nom": cliente_nombre}
            )
            id_cliente = cli["IdCliente"] if cli else None

            try:
                nota = self.cxc_repo.CrearNotaVenta({
                    "NumeroNotaVenta": num_nota_venta,
                    "NumeroNotaEntrega": num_nota_entrega,
                    "FechaVenta": fecha,
                    "IdCliente": id_cliente,
                    "ClienteNombreLibre": cliente_nombre,
                    "DestinoDepartamento": destino,
                    "Chofer": chofer,
                    "PlacaCamion": placa,
                    "CantidadCamiones": camiones,
                    "TotalVentaBruto": total_venta,
                    "DescuentoBonificacion": descuento,
                    "Promocion": promocion,
                    "ImporteNeto": importe_neto,
                    "SaldoAnterior": 0.0,
                    "TotalCancelado": importe_neto,
                    "SaldoPendiente": 0.0,
                    "EstadoCobranza": "Pagado al Contado",
                    "Observacion": f"Despacho camión {placa or ''} - Chofer {chofer or ''}"
                })
                id_nota = nota["IdNotaVenta"]
                notas_creadas += 1

                # Desglose de productos
                detalles = []
                for col_idx, prod_name in productos_cols:
                    if len(row) > col_idx:
                        cant = self._parse_float(row[col_idx])
                        if cant > 0:
                            detalles.append({
                                "NombreProducto": prod_name,
                                "Cantidad": cant,
                                "PrecioUnitario": 0.0,
                                "Subtotal": 0.0
                            })
                if detalles:
                    self.cxc_repo.CrearDetalleNotaVenta(id_nota, detalles)
                    detalles_creados += len(detalles)

            except Exception:
                pass # Nota duplicada ignorada

        wb.close()
        return {
            "Archivo": os.path.basename(file_path),
            "NotasVentaImportadas": notas_creadas,
            "DetallesProductosImportados": detalles_creados
        }

    # =========================================================================
    # 4. IMPORTAR CUENTAS POR PAGAR A PROVEEDORES
    # =========================================================================
    def ImportarCuentasProveedor(self, file_path: str) -> dict:
        wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        proveedores_procesados = 0
        cuentas_creadas = 0
        pagos_creados = 0

        for sname in wb.sheetnames:
            if sname in ["Hoja1"]:
                continue # Hoja1 es de devoluciones

            ws = wb[sname]
            id_prov = self.cxp_repo.AsegurarProveedor(sname)
            proveedores_procesados += 1

            for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
                if r_idx < 8:
                    continue
                if not row or len(row) < 5:
                    continue

                fecha_recep = self._parse_date(row[2])
                if not fecha_recep:
                    continue

                nota_entrega = str(row[3]).strip() if len(row) > 3 and row[3] else None
                
                # Extraer peso total, precio unitario y total
                peso_total = 0.0
                precio_unitario = 0.0
                total_pagar = 0.0
                factura = None
                banco = "BU"

                # Detectar según estructura de proveedor
                for idx in range(4, min(len(row), 17)):
                    val = row[idx]
                    if isinstance(val, str) and ("BU" in val or "BNB" in val):
                        banco = val.strip()

                if "MULTIFLEX" in sname:
                    peso_total = self._parse_float(row[12]) if len(row) > 12 else 0.0
                    precio_unitario = self._parse_float(row[13]) if len(row) > 13 else 0.0
                    total_pagar = self._parse_float(row[14]) if len(row) > 14 else 0.0
                    factura = str(row[15]).strip() if len(row) > 15 and row[15] else None
                elif "COLMAFLEX" in sname or "D ARTEPLAST" in sname:
                    peso_total = self._parse_float(row[12]) if len(row) > 12 else 0.0
                    precio_unitario = self._parse_float(row[13]) if len(row) > 13 else 0.0
                    total_pagar = self._parse_float(row[14]) if len(row) > 14 else 0.0
                elif "DISPROQUIMICOS" in sname:
                    peso_total = self._parse_float(row[6]) if len(row) > 6 else 0.0
                    precio_unitario = self._parse_float(row[7]) if len(row) > 7 else 0.0
                    total_pagar = self._parse_float(row[8]) if len(row) > 8 else 0.0
                    factura = str(row[9]).strip() if len(row) > 9 and row[9] else None
                elif "MONOPOL" in sname:
                    peso_total = self._parse_float(row[7]) if len(row) > 7 else 0.0
                    precio_unitario = self._parse_float(row[8]) if len(row) > 8 else 0.0
                    total_pagar = self._parse_float(row[10]) if len(row) > 10 else 0.0
                    factura = str(row[11]).strip() if len(row) > 11 and row[11] else None
                else:
                    total_pagar = self._parse_float(row[len(row)-2])

                if total_pagar <= 0:
                    continue

                cxp = self.cxp_repo.CrearCuentaPagar({
                    "IdProveedor": id_prov,
                    "FechaRecepcion": fecha_recep,
                    "FechaEnvio": None,
                    "NumeroNota": nota_entrega,
                    "NumeroFactura": factura,
                    "ConceptoMaterial": f"Material e Insumos ({sname})",
                    "PesoTotalKgr": peso_total,
                    "CantidadUnidades": 0.0,
                    "PrecioUnitario": precio_unitario,
                    "Descuento": 0.0,
                    "PrecioFacturado": total_pagar,
                    "TotalPagado": total_pagar,
                    "BancoPago": banco,
                    "Observacion": f"Importado de hoja {sname}"
                })
                cuentas_creadas += 1

                # Registrar pago
                self.cxp_repo.RegistrarPagoProveedor({
                    "IdCuentaPagar": cxp["IdCuentaPagar"],
                    "IdCuentaBancaria": None,
                    "IdMovimientoCaja": None,
                    "MontoPagado": total_pagar,
                    "FechaPago": fecha_recep,
                    "BancoSigla": banco,
                    "NumeroTransaccion": factura,
                    "EsCompensacion": False,
                    "DetalleCompensacion": None,
                    "Observacion": "Pago registrado según histórico"
                })
                pagos_creados += 1

        wb.close()
        return {
            "Archivo": os.path.basename(file_path),
            "ProveedoresProcesados": proveedores_procesados,
            "CuentasPagarImportadas": cuentas_creadas,
            "PagosProveedoresImportados": pagos_creados
        }

    # =========================================================================
    # 5. IMPORTAR TODA LA CARPETA archivos_contabilidad
    # =========================================================================
    def ImportarTodosArchivos(self, folder_path: str) -> dict:
        resultados = {}
        for fname in os.listdir(folder_path):
            fpath = os.path.join(folder_path, fname)
            if not fname.endswith(('.xlsx', '.XLSX')):
                continue

            if "Flujo de Caja" in fname:
                resultados["FlujoDeCaja"] = self.ImportarFlujoDeCaja(fpath)
            elif "CUENTAS POR COBRAR" in fname:
                resultados["CuentasPorCobrar"] = self.ImportarCuentasPorCobrar(fpath)
            elif "CONTROL NOTAS DE VENTA" in fname:
                resultados["NotasDeVenta"] = self.ImportarNotasVentaCamion(fpath)
            elif "CUENTAS PROVEEDOR" in fname:
                resultados["CuentasProveedor"] = self.ImportarCuentasProveedor(fpath)

        return resultados
