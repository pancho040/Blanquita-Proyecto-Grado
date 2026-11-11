from sqlalchemy.orm import Session
from app.Repository.DbCaller import DbCaller

class CuentasCobrarRepository:
    def __init__(self, db: Session):
        self.caller = DbCaller(db)

    # --- Notas de Venta ---
    def ListarNotasVenta(self, id_cliente: int | None = None, destino: str | None = None,
                         fecha_inicio = None, fecha_fin = None, busqueda: str = "",
                         estado_pago: str | None = None, limit: int | None = None, offset: int | None = None,
                         id_sucursal: int | None = None) -> list[dict]:
        where_clauses = []
        params = {}

        if id_sucursal is not None:
            where_clauses.append('nv."IdSucursal" = :id_sucursal')
            params["id_sucursal"] = id_sucursal
        if id_cliente is not None:
            where_clauses.append('nv."IdCliente" = :id_cliente')
            params["id_cliente"] = id_cliente
        if destino:
            where_clauses.append('nv."DestinoDepartamento" ILIKE :destino')
            params["destino"] = f"%{destino}%"
        if fecha_inicio:
            where_clauses.append('nv."FechaVenta" >= :fecha_inicio')
            params["fecha_inicio"] = fecha_inicio
        if fecha_fin:
            where_clauses.append('nv."FechaVenta" <= :fecha_fin')
            params["fecha_fin"] = fecha_fin
        if busqueda:
            where_clauses.append('(nv."NumeroNotaVenta" ILIKE :busqueda OR nv."NumeroNotaEntrega" ILIKE :busqueda OR nv."ClienteNombreLibre" ILIKE :busqueda OR c."RazonSocial" ILIKE :busqueda)')
            params["busqueda"] = f"%{busqueda}%"
        if estado_pago and estado_pago.upper() != "TODOS":
            if estado_pago.lower() == "pagado":
                where_clauses.append('nv."SaldoPendiente" <= 0')
            elif estado_pago.lower() == "pendiente":
                where_clauses.append('nv."SaldoPendiente" > 0')

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        limit_sql = ""
        if limit is not None:
            limit_sql = "LIMIT :limit OFFSET :offset"
            params["limit"] = limit
            params["offset"] = offset or 0

        sql = f"""
            SELECT 
                nv."IdNotaVenta",
                nv."NumeroNotaVenta",
                nv."NumeroNotaEntrega",
                nv."FechaVenta",
                nv."IdCliente",
                nv."ClienteNombreLibre",
                nv."DestinoDepartamento",
                nv."IdChofer",
                nv."Chofer",
                nv."PlacaCamion",
                nv."CantidadCamiones",
                nv."TotalVentaBruto",
                nv."DescuentoBonificacion",
                nv."Promocion",
                nv."ImporteNeto",
                nv."SaldoAnterior",
                nv."TotalCancelado",
                nv."SaldoPendiente",
                nv."EstadoCobranza",
                nv."MetodoPago",
                nv."MontoEfectivo",
                nv."MontoQR",
                nv."MontoCredito",
                nv."FirmaDigitalUrl",
                COALESCE(c."RazonSocial", nv."ClienteNombreLibre") as "ClienteNombre",
                COUNT(*) OVER() as total_count
            FROM "NotaVenta" nv
            LEFT JOIN "Cliente" c ON nv."IdCliente" = c."IdCliente"
            {where_sql}
            ORDER BY nv."FechaVenta" DESC, nv."NumeroNotaVenta" DESC
            {limit_sql};
        """
        return self.caller.LlamarFuncion(sql, params, commit=False)

    def ObtenerNotaVentaPorId(self, id_nota: int) -> dict | None:
        sql = """
            SELECT 
                nv.*,
                COALESCE(c."RazonSocial", nv."ClienteNombreLibre") as "ClienteNombre"
            FROM "NotaVenta" nv
            LEFT JOIN "Cliente" c ON nv."IdCliente" = c."IdCliente"
            WHERE nv."IdNotaVenta" = :id_nota;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_nota": id_nota})

    def ObtenerNotaVentaPorNumero(self, numero_nota: str) -> dict | None:
        sql = """
            SELECT * FROM "NotaVenta" WHERE "NumeroNotaVenta" = :numero_nota;
        """
        return self.caller.LlamarUnRegistro(sql, {"numero_nota": numero_nota})

    def CrearNotaVenta(self, datos: dict, id_usuario: int | None = None) -> dict:
        sql = """
            INSERT INTO "NotaVenta" (
                "NumeroNotaVenta", "NumeroNotaEntrega", "FechaVenta", "IdCliente",
                "ClienteNombreLibre", "DestinoDepartamento", "IdChofer", "Chofer", "PlacaCamion",
                "CantidadCamiones", "TotalVentaBruto", "DescuentoBonificacion",
                "Promocion", "ImporteNeto", "SaldoAnterior", "TotalCancelado",
                "SaldoPendiente", "EstadoCobranza", "Observacion", "IdUsuarioRegistro",
                "IdSucursal", "MetodoPago", "MontoEfectivo", "MontoQR", "MontoCredito",
                "FirmaDigitalUrl", "FirmaNombre", "FirmaCi", "FirmaFecha", "ComprobanteQRArchivoId"
            ) VALUES (
                :NumeroNotaVenta, :NumeroNotaEntrega, :FechaVenta, :IdCliente,
                :ClienteNombreLibre, :DestinoDepartamento, :IdChofer, :Chofer, :PlacaCamion,
                :CantidadCamiones, :TotalVentaBruto, :DescuentoBonificacion,
                :Promocion, :ImporteNeto, :SaldoAnterior, :TotalCancelado,
                :SaldoPendiente, :EstadoCobranza, :Observacion, :IdUsuarioRegistro,
                :IdSucursal, :MetodoPago, :MontoEfectivo, :MontoQR, :MontoCredito,
                :FirmaDigitalUrl, :FirmaNombre, :FirmaCi, :FirmaFecha, :ComprobanteQRArchivoId
            )
            RETURNING *;
        """
        payload = dict(datos)
        payload["IdUsuarioRegistro"] = id_usuario
        payload.setdefault("IdChofer", None)
        payload.setdefault("IdSucursal", 1)
        payload.setdefault("MetodoPago", "Efectivo")
        payload.setdefault("MontoEfectivo", 0.0)
        payload.setdefault("MontoQR", 0.0)
        payload.setdefault("MontoCredito", 0.0)
        payload.setdefault("FirmaDigitalUrl", None)
        payload.setdefault("FirmaNombre", None)
        payload.setdefault("FirmaCi", None)
        payload.setdefault("FirmaFecha", None)
        payload.setdefault("ComprobanteQRArchivoId", None)
        return self.caller.LlamarUnRegistro(sql, payload)

    def CrearDetalleNotaVenta(self, id_nota: int, items: list[dict]):
        for item in items:
            sql = """
                INSERT INTO "DetalleNotaVenta" (
                    "IdNotaVenta", "IdPresentacion", "NombreProducto", "Cantidad",
                    "PrecioUnitario", "Subtotal", "EsBonificacionBandeo"
                ) VALUES (
                    :id_nota, :IdPresentacion, :NombreProducto, :Cantidad,
                    :PrecioUnitario, :Subtotal, :EsBonificacionBandeo
                );
            """
            self.caller.LlamarFuncion(sql, {
                "id_nota": id_nota,
                "IdPresentacion": item.get("IdPresentacion"),
                "NombreProducto": item["NombreProducto"],
                "Cantidad": item["Cantidad"],
                "PrecioUnitario": item.get("PrecioUnitario", 0),
                "Subtotal": item.get("Subtotal", 0),
                "EsBonificacionBandeo": bool(item.get("EsBonificacionBandeo", False))
            })

    def AjustarNotaVentaKevin(self, id_nota: int, observacion: str, nuevo_neto: float | None = None,
                              nuevo_cancelado: float | None = None, nuevo_saldo: float | None = None) -> dict | None:
        set_clauses = ['"EditadoPorKevin" = TRUE', '"ObservacionAjuste" = :observacion']
        params = {"id_nota": id_nota, "observacion": observacion}

        if nuevo_neto is not None:
            set_clauses.append('"ImporteNeto" = :nuevo_neto')
            params["nuevo_neto"] = nuevo_neto
        if nuevo_cancelado is not None:
            set_clauses.append('"TotalCancelado" = :nuevo_cancelado')
            params["nuevo_cancelado"] = nuevo_cancelado
        if nuevo_saldo is not None:
            set_clauses.append('"SaldoPendiente" = :nuevo_saldo')
            params["nuevo_saldo"] = nuevo_saldo
            set_clauses.append("""
                "EstadoCobranza" = CASE 
                    WHEN :nuevo_saldo <= 0 THEN 'Liquidado'
                    ELSE 'Crédito Pendiente'
                END
            """)

        sql = f"""
            UPDATE "NotaVenta"
            SET {", ".join(set_clauses)}
            WHERE "IdNotaVenta" = :id_nota
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, params)

    def ListarDetallesNotaVenta(self, id_nota: int) -> list[dict]:
        sql = """
            SELECT * FROM "DetalleNotaVenta" WHERE "IdNotaVenta" = :id_nota;
        """
        return self.caller.LlamarFuncion(sql, {"id_nota": id_nota})

    def ActualizarSaldoNotaVenta(self, id_nota: int, monto_pagado: float):
        sql = """
            UPDATE "NotaVenta"
            SET "TotalCancelado" = "TotalCancelado" + :monto,
                "SaldoPendiente" = GREATEST("ImporteNeto" - ("TotalCancelado" + :monto), 0),
                "EstadoCobranza" = CASE 
                    WHEN GREATEST("ImporteNeto" - ("TotalCancelado" + :monto), 0) = 0 THEN 'Liquidado'
                    ELSE 'Crédito Parcial'
                END
            WHERE "IdNotaVenta" = :id_nota
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_nota": id_nota, "monto": monto_pagado})


    # --- Cuentas por Cobrar (Ledger de Crédito) ---
    def ListarCuentasCobrar(self, id_cliente: int | None = None, id_estado: int | None = None,
                            solo_con_saldo: bool = True, solo_vencidas: bool = False,
                            busqueda: str | None = None, limit: int | None = None,
                            offset: int | None = None, id_sucursal: int | None = None) -> list[dict]:
        where_clauses = []
        params = {}

        if id_sucursal is not None:
            where_clauses.append('cxc."IdSucursal" = :id_sucursal')
            params["id_sucursal"] = id_sucursal
        if id_cliente is not None:
            where_clauses.append('cxc."IdCliente" = :id_cliente')
            params["id_cliente"] = id_cliente
        if id_estado is not None:
            where_clauses.append('cxc."IdEstadoCuentaCobrar" = :id_estado')
            params["id_estado"] = id_estado
        if solo_con_saldo:
            where_clauses.append('cxc."SaldoPendiente" > 0')
        if solo_vencidas:
            where_clauses.append('(cxc."SaldoPendiente" > 0 AND cxc."FechaVencimiento" IS NOT NULL AND (CURRENT_DATE - cxc."FechaVencimiento") > 15)')
        if busqueda and busqueda.strip():
            where_clauses.append("""
                (cli."RazonSocial" ILIKE :busqueda OR 
                 cli."CiudadDestino" ILIKE :busqueda OR 
                 cxc."NumeroNotaVenta" ILIKE :busqueda OR 
                 CAST(cxc."IdNotaVenta" AS TEXT) ILIKE :busqueda OR
                 ('NV-' || CAST(cxc."IdNotaVenta" AS TEXT)) ILIKE :busqueda)
            """)
            params["busqueda"] = f"%{busqueda.strip()}%"

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        limit_sql = ""
        if limit is not None:
            limit_sql = "LIMIT :limit OFFSET :offset"
            params["limit"] = limit
            params["offset"] = offset or 0

        sql = f"""
            SELECT 
                cxc.*,
                CASE 
                    WHEN cxc."SaldoPendiente" > 0 AND cxc."FechaVencimiento" IS NOT NULL AND CURRENT_DATE > cxc."FechaVencimiento" 
                    THEN (CURRENT_DATE - cxc."FechaVencimiento")
                    ELSE COALESCE(cxc."DiasMora", 0)
                END as "DiasMora",
                cli."RazonSocial" as "RazonSocialCliente",
                cli."CiudadDestino",
                cli."LimiteCreditoBs",
                ec."NombreEstado",
                COUNT(*) OVER() as total_count
            FROM "CuentaCobrar" cxc
            JOIN "Cliente" cli ON cxc."IdCliente" = cli."IdCliente"
            JOIN "EstadoCuentaCobrar" ec ON cxc."IdEstadoCuentaCobrar" = ec."IdEstadoCuentaCobrar"
            {where_sql}
            ORDER BY cxc."FechaDespacho" DESC, cxc."IdCuentaCobrar" DESC
            {limit_sql};
        """
        return self.caller.LlamarFuncion(sql, params, commit=False)

    def ObtenerCuentaCobrarPorId(self, id_cxc: int) -> dict | None:
        sql = """
            SELECT 
                cxc.*,
                cli."RazonSocial" as "RazonSocialCliente",
                cli."CiudadDestino",
                ec."NombreEstado"
            FROM "CuentaCobrar" cxc
            JOIN "Cliente" cli ON cxc."IdCliente" = cli."IdCliente"
            JOIN "EstadoCuentaCobrar" ec ON cxc."IdEstadoCuentaCobrar" = ec."IdEstadoCuentaCobrar"
            WHERE cxc."IdCuentaCobrar" = :id_cxc;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_cxc": id_cxc})

    def CrearCuentaCobrar(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "CuentaCobrar" (
                "IdCliente", "IdPedido", "IdNotaVenta", "NumeroNotaVenta",
                "NumeroNotaEntrega", "FechaDespacho", "DiasMora", "IdEstadoCuentaCobrar",
                "MontoTotal", "SaldoPendiente", "FechaEmision", "FechaVencimiento",
                "IdUsuarioRegistro", "Observacion"
            ) VALUES (
                :IdCliente, :IdPedido, :IdNotaVenta, :NumeroNotaVenta,
                :NumeroNotaEntrega, :FechaDespacho, :DiasMora, :IdEstadoCuentaCobrar,
                :MontoTotal, :SaldoPendiente, :FechaEmision, :FechaVencimiento,
                :IdUsuarioRegistro, :Observacion
            )
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, datos)

    def ActualizarSaldoCuentaCobrar(self, id_cxc: int, monto_abono: float) -> dict | None:
        sql = """
            UPDATE "CuentaCobrar"
            SET "SaldoPendiente" = GREATEST("SaldoPendiente" - :monto, 0),
                "IdEstadoCuentaCobrar" = CASE 
                    WHEN GREATEST("SaldoPendiente" - :monto, 0) = 0 THEN 3 -- 3 = Pagada
                    ELSE "IdEstadoCuentaCobrar"
                END
            WHERE "IdCuentaCobrar" = :id_cxc
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_cxc": id_cxc, "monto": monto_abono})


    # --- Abonos a Cuenta por Cobrar ---
    def RegistrarAbono(self, datos: dict, id_usuario: int | None = None) -> dict:
        sql = """
            INSERT INTO "AbonoCuentaCobrar" (
                "IdCuentaCobrar", "IdNotaVenta", "IdCuentaBancaria", "IdMovimientoCaja",
                "IdMetodoPago", "MontoAbonado", "FechaAbono", "BancoSigla",
                "Depositante", "Moneda", "MontoDolares", "TipoCambio",
                "NumeroReferencia", "Observacion", "IdUsuario"
            ) VALUES (
                :IdCuentaCobrar, :IdNotaVenta, :IdCuentaBancaria, :IdMovimientoCaja,
                :IdMetodoPago, :MontoAbonado, :FechaAbono, :BancoSigla,
                :Depositante, :Moneda, :MontoDolares, :TipoCambio,
                :NumeroReferencia, :Observacion, :IdUsuario
            )
            RETURNING *;
        """
        payload = dict(datos)
        payload["IdUsuario"] = id_usuario
        return self.caller.LlamarUnRegistro(sql, payload)

    def ListarAbonosPorCuenta(self, id_cxc: int) -> list[dict]:
        sql = """
            SELECT a.*, b."NombreBanco", mp."NombreMetodoPago", nv."NumeroNotaVenta"
            FROM "AbonoCuentaCobrar" a
            LEFT JOIN "CuentaBancariaEmpresa" b ON a."IdCuentaBancaria" = b."IdCuentaBancaria"
            LEFT JOIN "MetodoPago" mp ON a."IdMetodoPago" = mp."IdMetodoPago"
            LEFT JOIN "NotaVenta" nv ON a."IdNotaVenta" = nv."IdNotaVenta"
            WHERE a."IdCuentaCobrar" = :id_cxc
            ORDER BY a."FechaAbono" ASC;
        """
        return self.caller.LlamarFuncion(sql, {"id_cxc": id_cxc})


    # --- Resumen de Cartera General (Hoja CXC) ---
    def ObtenerResumenCartera(self, id_sucursal: int | None = None) -> list[dict]:
        where = ""
        params = {}
        if id_sucursal is not None:
            where = 'WHERE c."IdSucursal" = :id_s'
            params["id_s"] = id_sucursal

        sql = f"""
            SELECT 
                c."IdCliente",
                c."RazonSocial" as "Distribuidor",
                COALESCE(c."CiudadDestino", 'Sucre') as "Departamento",
                COALESCE(SUM(cxc."MontoTotal"), 0) as "MontoDespachoTotal",
                COALESCE(SUM(cxc."MontoTotal" - cxc."SaldoPendiente"), 0) as "TotalDepositos",
                COALESCE(SUM(cxc."SaldoPendiente"), 0) as "SaldoPorCobrar",
                COALESCE(MAX(CASE 
                    WHEN cxc."SaldoPendiente" > 0 AND cxc."FechaVencimiento" IS NOT NULL AND CURRENT_DATE > cxc."FechaVencimiento" 
                    THEN (CURRENT_DATE - cxc."FechaVencimiento")
                    ELSE COALESCE(cxc."DiasMora", 0)
                END), 0) as "DiasMoraPromedio",
                c."Observacion"
            FROM "Cliente" c
            LEFT JOIN "CuentaCobrar" cxc ON c."IdCliente" = cxc."IdCliente"
            {where}
            GROUP BY c."IdCliente", c."RazonSocial", c."CiudadDestino", c."Observacion"
            HAVING COALESCE(SUM(cxc."MontoTotal"), 0) > 0 OR c."LimiteCreditoBs" > 0
            ORDER BY "SaldoPorCobrar" DESC, "MontoDespachoTotal" DESC;
        """
        return self.caller.LlamarFuncion(sql, params)

    # Verificación de mora y límite de crédito
    def VerificarEstadoCreditoCliente(self, id_cliente: int, nuevo_monto: float = 0.0) -> dict:
        sql_cli = '''
            SELECT "IdCliente", "RazonSocial", "NombreComercial", "LimiteCreditoBs", "DiasCredito"
            FROM "Cliente"
            WHERE "IdCliente" = :id_cliente;
        '''
        cli = self.caller.LlamarUnRegistro(sql_cli, {"id_cliente": id_cliente})
        if not cli:
            return {"Bloqueado": False, "Motivo": None, "MaxDiasMora": 0, "SaldoDeuda": 0.0, "LimiteCredito": 0.0}

        limite = float(cli.get("LimiteCreditoBs") or 0.0)
        dias_credito = int(cli.get("DiasCredito") or 15)

        sql_mora = '''
            SELECT 
                COALESCE(SUM("SaldoPendiente"), 0) as "SaldoTotalDeuda",
                COALESCE(MAX(CASE 
                    WHEN "SaldoPendiente" > 0 AND "FechaVencimiento" IS NOT NULL AND CURRENT_DATE > "FechaVencimiento"
                    THEN (CURRENT_DATE - "FechaVencimiento")
                    ELSE COALESCE("DiasMora", 0)
                END), 0) as "MaxDiasMora"
            FROM "CuentaCobrar"
            WHERE "IdCliente" = :id_cliente AND "SaldoPendiente" > 0;
        '''
        res_mora = self.caller.LlamarUnRegistro(sql_mora, {"id_cliente": id_cliente})
        saldo_deuda = float(res_mora.get("SaldoTotalDeuda", 0.0)) if res_mora else 0.0
        max_mora = int(res_mora.get("MaxDiasMora", 0)) if res_mora else 0

        # Bloqueo automático si cliente registra facturas vencidas con más de 15 días
        if max_mora > 15:
            return {
                "Bloqueado": True,
                "Motivo": f"Cliente bloqueado por mora: registra cuentas pendientes con {max_mora} días de vencimiento (> 15 días).",
                "MaxDiasMora": max_mora,
                "SaldoDeuda": saldo_deuda,
                "LimiteCredito": limite,
                "DiasCredito": dias_credito
            }

        # Bloqueo si supera límite de crédito configurado
        if limite > 0 and (saldo_deuda + nuevo_monto) > limite:
            return {
                "Bloqueado": True,
                "Motivo": f"Cliente bloqueado por límite de crédito: saldo deudor (Bs. {saldo_deuda:.2f}) + nuevo monto (Bs. {nuevo_monto:.2f}) supera el límite autorizado de Bs. {limite:.2f}.",
                "MaxDiasMora": max_mora,
                "SaldoDeuda": saldo_deuda,
                "LimiteCredito": limite,
                "DiasCredito": dias_credito
            }

        return {
            "Bloqueado": False,
            "Motivo": None,
            "MaxDiasMora": max_mora,
            "SaldoDeuda": saldo_deuda,
            "LimiteCredito": limite,
            "DiasCredito": dias_credito
        }

    # =========================================================================
    # CIERRE DE TURNO Y RENDICIÓN DE CHOFERES (Subagente A - Módulo 3)
    # =========================================================================
    def RegistrarRendicionRuta(self, datos: dict) -> dict:
        sql = """
            INSERT INTO "RendicionRuta" (
                "IdUsuarioRepartidor", "IdAperturaCierreCaja", "IdAsignacionRuta",
                "MontoTotalCobradoRuta", "MontoEfectivoEntregado",
                "MontoTransferenciaReportada", "MontoQrReportado",
                "MontoFaltante", "CantidadMerma", "ObservacionesCierre",
                "EstadoConciliacion", "IdSucursal", "FechaRendicion"
            ) VALUES (
                :IdUsuarioRepartidor, :IdAperturaCierreCaja, :IdAsignacionRuta,
                :MontoTotalCobradoRuta, :MontoEfectivoEntregado,
                :MontoTransferenciaReportada, :MontoQrReportado,
                :MontoFaltante, :CantidadMerma, :ObservacionesCierre,
                :EstadoConciliacion, :IdSucursal, now()
            )
            RETURNING *;
        """
        payload = dict(datos)
        payload.setdefault("IdAperturaCierreCaja", 1)
        payload.setdefault("MontoTotalCobradoRuta", 0.0)
        payload.setdefault("MontoEfectivoEntregado", 0.0)
        payload.setdefault("MontoTransferenciaReportada", 0.0)
        payload.setdefault("MontoQrReportado", 0.0)
        payload.setdefault("MontoFaltante", 0.0)
        payload.setdefault("CantidadMerma", 0.0)
        payload.setdefault("ObservacionesCierre", None)
        payload.setdefault("EstadoConciliacion", "PENDIENTE")
        payload.setdefault("IdSucursal", 1)
        return self.caller.LlamarUnRegistro(sql, payload)

    def ObtenerConfigBandeoProducto(self, id_presentacion: int) -> dict | None:
        sql = """
            SELECT pc.* 
            FROM "ProductoConfigComercial" pc
            JOIN "PresentacionProducto" pp ON pc."IdProducto" = pp."IdProducto"
            WHERE pp."IdPresentacion" = :id_presentacion AND pc."EsBandeo" = TRUE;
        """
        return self.caller.LlamarUnRegistro(sql, {"id_presentacion": id_presentacion})

    # =========================================================================
    # GESTIÓN Y APROBACIÓN DE ABONOS QR Y MORA (Subagente B - Módulo 4)
    # =========================================================================
    def RegistrarAbonoChofer(self, datos: dict, id_usuario: int | None = None) -> dict:
        sql = """
            INSERT INTO "AbonoCuentaCobrar" (
                "IdCuentaCobrar", "IdNotaVenta", "IdMetodoPago", "MetodoPago",
                "MontoAbonado", "FechaAbono", "BancoSigla", "Depositante",
                "NumeroReferencia", "IdComprobanteArchivo", "Observacion",
                "IdUsuario", "EstadoAprobacion"
            ) VALUES (
                :IdCuentaCobrar, :IdNotaVenta, :IdMetodoPago, :MetodoPago,
                :MontoAbonado, :FechaAbono, :BancoSigla, :Depositante,
                :NumeroReferencia, :IdComprobanteArchivo, :Observacion,
                :IdUsuario, 'PENDIENTE_APROBACION'
            )
            RETURNING *;
        """
        payload = dict(datos)
        payload["IdUsuario"] = id_usuario
        payload.setdefault("IdNotaVenta", None)
        payload.setdefault("IdMetodoPago", 2 if payload.get("MetodoPago") == "QR" else 1)
        payload.setdefault("MetodoPago", "Efectivo")
        payload.setdefault("BancoSigla", None)
        payload.setdefault("Depositante", None)
        payload.setdefault("NumeroReferencia", None)
        payload.setdefault("IdComprobanteArchivo", None)
        payload.setdefault("Observacion", None)
        payload.setdefault("FechaAbono", "now()")
        return self.caller.LlamarUnRegistro(sql, payload)

    def ListarAbonosPendientes(self, id_sucursal: int | None = None) -> list[dict]:
        where_clauses = ['a."EstadoAprobacion" = \'PENDIENTE_APROBACION\'']
        params = {}
        if id_sucursal:
            where_clauses.append('cxc."IdSucursal" = :id_sucursal')
            params["id_sucursal"] = id_sucursal

        where_sql = "WHERE " + " AND ".join(where_clauses)
        sql = f"""
            SELECT 
                a.*,
                cxc."NumeroNotaVenta",
                cxc."SaldoPendiente",
                c."RazonSocial" as "ClienteNombre",
                ca."UrlArchivo" as "UrlComprobante",
                TRIM(CONCAT(COALESCE(u."PrimerNombre", ''), ' ', COALESCE(u."ApellidoPaterno", ''))) as "ChoferNombre"
            FROM "AbonoCuentaCobrar" a
            JOIN "CuentaCobrar" cxc ON a."IdCuentaCobrar" = cxc."IdCuentaCobrar"
            JOIN "Cliente" c ON cxc."IdCliente" = c."IdCliente"
            LEFT JOIN "ComprobanteArchivo" ca ON a."IdComprobanteArchivo" = ca."IdComprobante"
            LEFT JOIN "Usuario" u ON a."IdUsuario" = u."IdUsuario"
            {where_sql}
            ORDER BY a."FechaAbono" ASC;
        """
        return self.caller.LlamarFuncion(sql, params)

    def ResolverAbono(self, id_abono: int, aprobado: bool, id_usuario_kevin: int, observacion: str = "") -> dict | None:
        estado_nuevo = "APROBADO" if aprobado else "RECHAZADO"
        sql = """
            UPDATE "AbonoCuentaCobrar"
            SET "EstadoAprobacion" = :estado,
                "AprobadoPor" = :id_kevin,
                "FechaAprobacion" = now(),
                "Observacion" = CASE 
                    WHEN :obs != '' THEN COALESCE("Observacion", '') || ' | ' || :obs
                    ELSE "Observacion"
                END
            WHERE "IdAbonoCuentaCobrar" = :id_abono
            RETURNING *;
        """
        return self.caller.LlamarUnRegistro(sql, {
            "id_abono": id_abono,
            "estado": estado_nuevo,
            "id_kevin": id_usuario_kevin,
            "obs": observacion
        })
