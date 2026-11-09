from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException, status

from app.Repository.Contabilidad.CuentasCobrarRepository import CuentasCobrarRepository
from app.Repository.Contabilidad.TesoreriaRepository import TesoreriaRepository
from app.Repository.Logistica.ClienteRepository import ClienteRepository
from app.Repository.Logistica.InventarioComercialRepository import InventarioComercialRepository
from app.Services.Common.NotificationService import NotificationService
from app.Services.Usuario.AuditService import AuditService
from app.Models.Contabilidad.CuentasCobrarModel import (
    NotaVentaCrear, NotaVentaAjustarKevin, AbonoCuentaCobrarCrear,
    CierreTurnoChoferRequest, CierreTurnoResponse, CierreTurnoItemComparativa,
    PlanillaAbonosMasivosRequest
)

class CuentasCobrarService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CuentasCobrarRepository(db)
        self.tesoreria_repo = TesoreriaRepository(db)
        self.cliente_repo = ClienteRepository(db)
        self.inventario_repo = InventarioComercialRepository(db)
        self.notif_service = NotificationService(db)
        self.audit_service = AuditService(db)

    # =========================================================================
    # NOTAS DE VENTA Y DESPACHO (Subagente A - Módulo 7)
    # =========================================================================
    def ListarNotasVenta(self, id_cliente: int | None = None, destino: str | None = None,
                         fecha_inicio = None, fecha_fin = None, busqueda: str = "") -> list[dict]:
        return self.repo.ListarNotasVenta(id_cliente, destino, fecha_inicio, fecha_fin, busqueda)

    def ObtenerNotaVentaDetalle(self, id_nota: int) -> dict:
        nota = self.repo.ObtenerNotaVentaPorId(id_nota)
        if not nota:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nota de venta no encontrada")
        nota["Detalles"] = self.repo.ListarDetallesNotaVenta(id_nota)
        return nota

    def CrearNotaVenta(self, dto: NotaVentaCrear, id_usuario: int | None = None) -> dict:
        existente = self.repo.ObtenerNotaVentaPorNumero(dto.NumeroNotaVenta)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una nota de venta con el número {dto.NumeroNotaVenta}"
            )

        # 1. Motor de Promociones de Bandeo (Subagente A):
        # Si un producto vendido tiene bandeo activo (ej. Megarrollo), se bonifica servilleta a precio 0.0
        detalles_finales = []
        bonificaciones_a_descontar = []

        for d in dto.Detalles:
            d_dict = d.model_dump()
            detalles_finales.append(d_dict)

            if d.IdPresentacion and not d.EsBonificacionBandeo:
                config_bandeo = self.repo.ObtenerConfigBandeoProducto(d.IdPresentacion)
                if config_bandeo and config_bandeo.get("EsBandeo"):
                    # Regla de bandeo: 1 unidad megarrollo = 1 servilleta bonificada
                    cant_regalo = float(d.Cantidad)
                    id_pres_regalo = config_bandeo.get("IdPresentacionBandeo") or d.IdPresentacion
                    nombre_regalo = f"PROMO BANDEO - Servilleta Obsequio (x{int(cant_regalo)})"
                    
                    detalles_finales.append({
                        "IdPresentacion": id_pres_regalo,
                        "NombreProducto": nombre_regalo,
                        "Cantidad": cant_regalo,
                        "PrecioUnitario": 0.0,
                        "Subtotal": 0.0,
                        "EsBonificacionBandeo": True
                    })
                    bonificaciones_a_descontar.append((id_pres_regalo, cant_regalo))

        # 2. Descuento de stock en camión (inventario_chofer) si la nota la emite un chofer
        if dto.IdChofer:
            for d in dto.Detalles:
                if d.IdPresentacion and d.Cantidad > 0:
                    self.inventario_repo.DescontarStockChofer(
                        sucursal_id=dto.IdSucursal,
                        chofer_id=dto.IdChofer,
                        presentacion_id=d.IdPresentacion,
                        cantidad=d.Cantidad
                    )
            for pres_id, cant in bonificaciones_a_descontar:
                self.inventario_repo.DescontarStockChofer(
                    sucursal_id=dto.IdSucursal,
                    chofer_id=dto.IdChofer,
                    presentacion_id=pres_id,
                    cantidad=cant
                )

        # 3. Cálculo de importes y pagos mixtos (Efectivo, QR, Crédito)
        importe_neto = dto.ImporteNeto if dto.ImporteNeto is not None else (
            dto.TotalVentaBruto - dto.DescuentoBonificacion - dto.Promocion
        )
        importe_neto = max(importe_neto, 0.0)

        total_pagado = dto.MontoEfectivo + dto.MontoQR
        saldo_pendiente = max(importe_neto - total_pagado, 0.0)
        es_credito = dto.EsCredito or (saldo_pendiente > 0) or (dto.MontoCredito > 0)

        datos_nota = dto.model_dump(exclude={"Detalles", "EsCredito"})
        datos_nota["ImporteNeto"] = importe_neto
        datos_nota["TotalCancelado"] = total_pagado
        datos_nota["SaldoPendiente"] = saldo_pendiente
        datos_nota["EstadoCobranza"] = "Liquidado" if saldo_pendiente <= 0 else "Crédito Pendiente"

        # Validación de mora/crédito si queda saldo a crédito
        if es_credito and dto.IdCliente:
            cred_check = self.repo.VerificarEstadoCreditoCliente(dto.IdCliente, saldo_pendiente)
            if cred_check.get("Bloqueado"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=cred_check.get("Motivo")
                )

        nota = self.repo.CrearNotaVenta(datos_nota, id_usuario)
        id_nota = nota["IdNotaVenta"]

        # Insertar todos los detalles (incluidas bonificaciones de bandeo)
        if detalles_finales:
            self.repo.CrearDetalleNotaVenta(id_nota, detalles_finales)

        # 4. Si queda saldo a crédito, crear automáticamente la Cuenta por Cobrar
        if es_credito and dto.IdCliente:
            dias_plazo = 15
            if 'cred_check' in locals() and cred_check.get("DiasCredito"):
                dias_plazo = cred_check.get("DiasCredito")
            f_venc = dto.FechaVenta + timedelta(days=dias_plazo)

            self.repo.CrearCuentaCobrar({
                "IdCliente": dto.IdCliente,
                "IdPedido": None,
                "IdNotaVenta": id_nota,
                "NumeroNotaVenta": dto.NumeroNotaVenta,
                "NumeroNotaEntrega": dto.NumeroNotaEntrega,
                "FechaDespacho": dto.FechaVenta,
                "DiasMora": 0,
                "IdEstadoCuentaCobrar": 1, # Vigente
                "MontoTotal": importe_neto,
                "SaldoPendiente": saldo_pendiente,
                "FechaEmision": dto.FechaVenta,
                "FechaVencimiento": f_venc,
                "IdUsuarioRegistro": id_usuario,
                "Observacion": dto.Observacion
            })

        self.db.commit()
        return self.ObtenerNotaVentaDetalle(id_nota)

    def AjustarNotaVentaKevin(self, id_nota: int, dto: NotaVentaAjustarKevin, id_kevin: int) -> dict:
        nota = self.repo.ObtenerNotaVentaPorId(id_nota)
        if not nota:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nota de venta no encontrada")

        nota_ajustada = self.repo.AjustarNotaVentaKevin(
            id_nota=id_nota,
            observacion=dto.ObservacionAjuste,
            nuevo_neto=dto.NuevoImporteNeto,
            nuevo_cancelado=dto.NuevoTotalCancelado,
            nuevo_saldo=dto.NuevoSaldoPendiente
        )

        # Notificar al chofer sobre el ajuste realizado por Kevin
        if nota.get("IdChofer"):
            mensaje = f"Tu Nota de Venta {nota.get('NumeroNotaVenta')} fue ajustada por Kevin: {dto.ObservacionAjuste}"
            self.notif_service.CrearNotificacion(
                id_usuario_destino=nota["IdChofer"],
                titulo="Ajuste en Nota de Venta",
                mensaje=mensaje,
                tipo="ADVERTENCIA"
            )

        # Auditoría transaccional
        self.audit_service.RegistrarAccion(
            id_usuario=id_kevin,
            accion="AJUSTE_NOTA_VENTA",
            tabla="NotaVenta",
            id_registro=str(id_nota),
            detalles={"observacion": dto.ObservacionAjuste, "anterior_saldo": str(nota.get("SaldoPendiente"))}
        )

        self.db.commit()
        return self.ObtenerNotaVentaDetalle(id_nota)

    # =========================================================================
    # CIERRE DE TURNO Y RENDICIÓN DE CHOFERES (Subagente A - Módulo 3)
    # =========================================================================
    def ProcesarCierreTurnoChofer(self, dto: CierreTurnoChoferRequest, id_usuario: int) -> CierreTurnoResponse:
        hoy = date.today()
        # 1. Obtener notas de venta emitidas por el chofer en el día
        sql_ventas = """
            SELECT 
                dnv."IdPresentacion",
                COALESCE(dnv."NombreProducto", 'Producto') as "NombreProducto",
                SUM(dnv."Cantidad") as "TotalVendido"
            FROM "NotaVenta" nv
            JOIN "DetalleNotaVenta" dnv ON nv."IdNotaVenta" = dnv."IdNotaVenta"
            WHERE nv."IdChofer" = :id_chofer AND nv."FechaVenta" = :fecha
            GROUP BY dnv."IdPresentacion", dnv."NombreProducto";
        """
        ventas_filas = self.db.execute(text(sql_ventas), {"id_chofer": dto.IdUsuarioRepartidor, "fecha": hoy}).mappings().fetchall()
        ventas_dict = {f["IdPresentacion"]: float(f["TotalVendido"]) for f in ventas_filas if f["IdPresentacion"]}

        # 2. Obtener stock cargado actual en camión
        sql_stock_chofer = """
            SELECT "presentacion_id", "cantidad_remanente"
            FROM "inventario_chofer"
            WHERE "chofer_id" = :id_chofer AND "sucursal_id" = :id_sucursal;
        """
        stock_filas = self.db.execute(text(sql_stock_chofer), {
            "id_chofer": dto.IdUsuarioRepartidor,
            "id_sucursal": dto.IdSucursal
        }).mappings().fetchall()
        stock_cargado_dict = {f["presentacion_id"]: float(f["cantidad_remanente"]) for f in stock_filas}

        # 3. Comparativa y cálculo de mermas/faltantes
        todas_presentaciones = set(stock_cargado_dict.keys()).union(dto.StockDevueltoFisico.keys())
        comparativas = []
        total_faltante_bs = 0.0
        total_merma_cant = 0.0

        for pres_id in todas_presentaciones:
            cargado = stock_cargado_dict.get(pres_id, 0.0)
            vendido = ventas_dict.get(pres_id, 0.0)
            devuelto_esperado = cargado # lo que aún tiene el chofer en camión
            devuelto_fisico = float(dto.StockDevueltoFisico.get(pres_id, 0.0))
            
            diferencia = devuelto_fisico - devuelto_esperado
            es_faltante = diferencia < 0

            # Obtener precio para valorizar faltante
            sql_precio = 'SELECT "PrecioUnitario" FROM "PrecioProducto" WHERE "IdPresentacion" = :p AND "IdSucursal" = :s ORDER BY "FechaVigenciaDesde" DESC LIMIT 1;'
            p_res = self.db.execute(text(sql_precio), {"p": pres_id, "s": dto.IdSucursal}).scalar()
            precio_u = float(p_res or 20.0)

            if es_faltante:
                total_faltante_bs += abs(diferencia) * precio_u
            elif diferencia > 0:
                total_merma_cant += diferencia

            comparativas.append(CierreTurnoItemComparativa(
                presentacion_id=pres_id,
                producto_nombre=f"Presentación #{pres_id}",
                cargado=cargado,
                vendido=vendido,
                devuelto_esperado=devuelto_esperado,
                devuelto_fisico=devuelto_fisico,
                diferencia=diferencia,
                es_faltante=es_faltante
            ))

            # Descargar camión y retornar stock físico al inventario de sucursal
            if devuelto_fisico > 0:
                self.inventario_repo.IncrementarStockSucursal(dto.IdSucursal, pres_id, devuelto_fisico)
                self.inventario_repo.DescontarStockChofer(dto.IdSucursal, dto.IdUsuarioRepartidor, pres_id, devuelto_fisico)

        # 4. Total de ventas en Bs del chofer en la jornada
        sql_total_ventas = """
            SELECT COALESCE(SUM("TotalCancelado"), 0) as "Cobrado"
            FROM "NotaVenta"
            WHERE "IdChofer" = :id_chofer AND "FechaVenta" = :fecha;
        """
        cobrado_total = float(self.db.execute(text(sql_total_ventas), {"id_chofer": dto.IdUsuarioRepartidor, "fecha": hoy}).scalar() or 0.0)
        diferencia_efectivo = dto.MontoEfectivoEntregado - cobrado_total

        estado_conciliacion = "CONCILIADO" if (total_faltante_bs == 0.0 and abs(diferencia_efectivo) < 0.01) else "CON_DIFERENCIA"

        rendicion = self.repo.RegistrarRendicionRuta({
            "IdUsuarioRepartidor": dto.IdUsuarioRepartidor,
            "IdSucursal": dto.IdSucursal,
            "IdAsignacionRuta": dto.IdAsignacionRuta,
            "MontoTotalCobradoRuta": cobrado_total,
            "MontoEfectivoEntregado": dto.MontoEfectivoEntregado,
            "MontoTransferenciaReportada": dto.MontoTransferenciaReportada,
            "MontoQrReportado": dto.MontoQrReportado,
            "MontoFaltante": total_faltante_bs,
            "CantidadMerma": total_merma_cant,
            "ObservacionesCierre": dto.Observaciones,
            "EstadoConciliacion": estado_conciliacion
        })

        self.db.commit()

        return CierreTurnoResponse(
            IdRendicionRuta=rendicion["IdRendicionRuta"],
            IdUsuarioRepartidor=dto.IdUsuarioRepartidor,
            FechaRendicion=datetime.now(),
            TotalVentasBs=cobrado_total,
            MontoEfectivoEntregado=dto.MontoEfectivoEntregado,
            DiferenciaEfectivo=diferencia_efectivo,
            CantidadTotalMerma=total_merma_cant,
            MontoTotalFaltante=total_faltante_bs,
            EstadoConciliacion=estado_conciliacion,
            ComparativaStock=comparativas,
            ObservacionesCierre=dto.Observaciones
        )

    # =========================================================================
    # CUENTAS POR COBRAR Y COBRANZAS QR (Subagente B - Módulo 4)
    # =========================================================================
    def ListarCuentasCobrar(self, id_cliente: int | None = None, id_estado: int | None = None, solo_con_saldo: bool = True) -> list[dict]:
        return self.repo.ListarCuentasCobrar(id_cliente, id_estado, solo_con_saldo)

    def ObtenerCuentaCobrarDetalle(self, id_cxc: int) -> dict:
        cxc = self.repo.ObtenerCuentaCobrarPorId(id_cxc)
        if not cxc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta por cobrar no encontrada")
        cxc["Abonos"] = self.repo.ListarAbonosPorCuenta(id_cxc)
        return cxc

    def RegistrarAbonoChofer(self, dto: AbonoCuentaCobrarCrear, id_usuario: int | None = None) -> dict:
        cxc = self.repo.ObtenerCuentaCobrarPorId(dto.IdCuentaCobrar)
        if not cxc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta por cobrar no encontrada")

        if float(cxc["SaldoPendiente"]) <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Esta cuenta ya se encuentra totalmente liquidada.")

        # Validación estricta de comprobante para pagos QR / transferencia
        if dto.MetodoPago == "QR" and not dto.IdComprobanteArchivo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Fotografía de comprobante QR requerida obligatoriamente para pagos por transferencia/QR."
            )

        # Todo abono registrado por chofer nace en PENDIENTE_APROBACION y NO descuenta el saldo aún
        abono = self.repo.RegistrarAbonoChofer(dto.model_dump(), id_usuario)

        # Notificar a Kevin en Contabilidad
        self.notif_service.CrearNotificacion(
            id_usuario_destino=1, # Admin / Kevin
            titulo="Nuevo Cobro QR Pendiente",
            mensaje=f"Se registró un abono de Bs. {dto.MontoAbonado:.2f} ({dto.MetodoPago}) para {cxc.get('RazonSocialCliente')} pendiente de validación.",
            tipo="ALERTA"
        )

        self.db.commit()
        return abono

    def ListarAbonosPendientes(self, id_sucursal: int | None = None) -> list[dict]:
        return self.repo.ListarAbonosPendientes(id_sucursal)

    def ResolverAbonoKevin(self, id_abono: int, aprobado: bool, id_kevin: int, observacion: str = "") -> dict:
        sql = 'SELECT * FROM "AbonoCuentaCobrar" WHERE "IdAbonoCuentaCobrar" = :id;'
        abono = self.db.execute(text(sql), {"id": id_abono}).mappings().fetchone()
        if not abono:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Abono no encontrado")

        if abono["EstadoAprobacion"] != "PENDIENTE_APROBACION":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"El abono ya fue procesado: {abono['EstadoAprobacion']}")

        res = self.repo.ResolverAbono(id_abono, aprobado, id_kevin, observacion)

        # Si Kevin aprueba el abono, ENTONCES se descuenta formalmente el saldo deudor
        if aprobado:
            monto = float(abono["MontoAbonado"])
            self.repo.ActualizarSaldoCuentaCobrar(abono["IdCuentaCobrar"], monto)
            if abono.get("IdNotaVenta"):
                self.repo.ActualizarSaldoNotaVenta(abono["IdNotaVenta"], monto)

        # Notificar al chofer que subió el cobro
        if abono.get("IdUsuario"):
            estado_txt = "Aprobado" if aprobado else "Rechazado"
            self.notif_service.CrearNotificacion(
                id_usuario_destino=abono["IdUsuario"],
                titulo=f"Cobro {estado_txt}",
                mensaje=f"Tu registro de cobro por Bs. {float(abono['MontoAbonado']):.2f} fue {estado_txt.lower()} por Kevin.",
                tipo="INFO" if aprobado else "ERROR"
            )

        self.db.commit()
        return res

    def ProcesarAbonosMasivos(self, dto: PlanillaAbonosMasivosRequest, id_kevin: int) -> dict:
        procesados = 0
        total_monto = 0.0
        errores = []

        for f in dto.Abonos:
            try:
                id_cxc = f.IdCuentaCobrar
                if not id_cxc and f.NumeroNotaVenta:
                    cxc = self.db.execute(
                        text('SELECT "IdCuentaCobrar" FROM "CuentaCobrar" WHERE "NumeroNotaVenta" = :n LIMIT 1;'),
                        {"n": f.NumeroNotaVenta}
                    ).scalar()
                    id_cxc = cxc

                if not id_cxc:
                    errores.append(f"Nota/Cuenta no identificada: {f.NumeroNotaVenta}")
                    continue

                # Registrar y aprobar directamente por ser carga masiva de Kevin
                abono_dict = {
                    "IdCuentaCobrar": id_cxc,
                    "MontoAbonado": f.MontoAbonado,
                    "MetodoPago": "Transferencia",
                    "BancoSigla": f.BancoSigla,
                    "NumeroReferencia": f.NumeroReferencia,
                    "Depositante": f.Depositante
                }
                ab = self.repo.RegistrarAbonoChofer(abono_dict, id_kevin)
                self.repo.ResolverAbono(ab["IdAbonoCuentaCobrar"], True, id_kevin, "Aprobación masiva por planilla")
                self.repo.ActualizarSaldoCuentaCobrar(id_cxc, f.MontoAbonado)
                procesados += 1
                total_monto += f.MontoAbonado
            except Exception as e:
                errores.append(f"Error procesando abono {f.NumeroNotaVenta}: {str(e)}")

        self.db.commit()
        return {
            "procesados": procesados,
            "total_monto_bs": total_monto,
            "errores": errores
        }

    def ObtenerResumenCartera(self) -> list[dict]:
        return self.repo.ObtenerResumenCartera()

    def VerificarEstadoCredito(self, id_cliente: int, nuevo_monto: float = 0.0) -> dict:
        return self.repo.VerificarEstadoCreditoCliente(id_cliente, nuevo_monto)
