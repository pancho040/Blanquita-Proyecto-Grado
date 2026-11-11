from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi import HTTPException, status
from app.Repository.Contabilidad.TesoreriaRepository import TesoreriaRepository
from app.Models.Contabilidad.TesoreriaModel import (
    CuentaBancariaCrear, CuentaBancariaActualizar, AperturaCajaCrear,
    CierreCajaCrear, MovimientoCajaCrear, SolicitudCajaChicaCrear,
    SolicitudCajaChicaActualizarEstado, EntregaFondosCajaChicaRequest,
    RendicionGastoCajaChicaRequest, ResolverAprobacionGerenciaRequest
)
from app.Services.Common.NotificationService import NotificationService
from app.Services.Usuario.AuditService import AuditService

class TesoreriaService:
    def __init__(self, db: Session):
        self.repo = TesoreriaRepository(db)

    # --- Cuentas Bancarias ---
    def ListarCuentasBancarias(self) -> list[dict]:
        return self.repo.ListarCuentasBancarias()

    def CrearCuentaBancaria(self, dto: CuentaBancariaCrear) -> dict:
        existente = self.repo.ObtenerCuentaBancariaPorSigla(dto.Sigla)
        if existente:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una cuenta con la sigla {dto.Sigla}"
            )
        return self.repo.CrearCuentaBancaria(dto.model_dump())


    # --- Apertura y Cierre de Caja ---
    def ObtenerEstadoCajaActual(self, id_caja: int = 1) -> dict:
        caja_abierta = self.repo.ObtenerCajaAbierta(id_caja)
        if not caja_abierta:
            return {"CajaAbierta": False, "Detalle": None}

        id_apertura = caja_abierta["IdAperturaCierreCaja"]
        totales = self.repo.ObtenerTotalesCaja(id_apertura)
        saldo_inicial = float(caja_abierta["SaldoInicial"])
        total_ingresos = float(totales["TotalIngresos"])
        total_egresos = float(totales["TotalEgresos"])
        saldo_teorico = saldo_inicial + total_ingresos - total_egresos

        caja_abierta["TotalIngresos"] = total_ingresos
        caja_abierta["TotalEgresos"] = total_egresos
        caja_abierta["SaldoTeorico"] = saldo_teorico

        return {"CajaAbierta": True, "Detalle": caja_abierta}

    def AbrirCaja(self, dto: AperturaCajaCrear, id_usuario: int) -> dict:
        caja_abierta = self.repo.ObtenerCajaAbierta(dto.IdCaja)
        if caja_abierta:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una sesión de caja abierta para esta caja. Debe cerrarla antes de abrir una nueva."
            )
        return self.repo.AbrirCaja(dto.IdCaja, id_usuario, dto.SaldoInicial, dto.Observacion)

    def CerrarCaja(self, dto: CierreCajaCrear, id_usuario: int, id_caja: int = 1) -> dict:
        caja_abierta = self.repo.ObtenerCajaAbierta(id_caja)
        if not caja_abierta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No existe ninguna sesión de caja abierta para realizar el arqueo y cierre."
            )

        id_apertura = caja_abierta["IdAperturaCierreCaja"]
        totales = self.repo.ObtenerTotalesCaja(id_apertura)
        saldo_inicial = float(caja_abierta["SaldoInicial"])
        total_ingresos = float(totales["TotalIngresos"])
        total_egresos = float(totales["TotalEgresos"])
        saldo_teorico = saldo_inicial + total_ingresos - total_egresos

        diferencia = round(dto.SaldoReal - saldo_teorico, 2)

        # Conciliación de cierre de caja
        # Si existe descuadre entre saldo teórico y físico, requerir autorización expresa o justificación del Contador
        if abs(diferencia) > 0.05 and not getattr(dto, "AutorizadoPorContador", False):
            justificacion = getattr(dto, "JustificativoDiferencia", None) or dto.Observacion
            if not justificacion or len(justificacion.strip()) < 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Descuadre detectado de Bs. {diferencia:.2f} (Teórico: Bs. {saldo_teorico:.2f} vs Real: Bs. {dto.SaldoReal:.2f}). Se requiere autorización expresa o justificación formal del Contador para cerrar la caja."
                )

        cierre = self.repo.CerrarCaja(
            id_apertura=id_apertura,
            id_usuario_cierre=id_usuario,
            saldo_real=dto.SaldoReal,
            saldo_teorico=saldo_teorico,
            diferencia=diferencia,
            numero_arqueo=dto.NumeroArqueo,
            hora_inicio=dto.HoraInicio,
            hora_termino=dto.HoraTermino,
            observacion=dto.Observacion
        )

        if dto.DesgloseCortes:
            self.repo.RegistrarDesgloseCortes(id_apertura, [c.model_dump() for c in dto.DesgloseCortes])

        cierre["DesgloseCortes"] = self.repo.ObtenerDesgloseCortes(id_apertura)

        # Registrar en auditoría el cierre de caja formal
        try:
            from sqlalchemy import text
            sql_audit = '''
                INSERT INTO "AuditLog" ("IdUsuario", "Accion", "TablaAfectada", "IdRegistroAfectado", "Detalle", "FechaHora")
                VALUES (:id_u, 'CIERRE_CAJA', 'AperturaCierreCaja', :id_reg, :det, NOW());
            '''
            self.repo.caller.db.execute(text(sql_audit), {
                "id_u": id_usuario,
                "id_reg": str(id_apertura),
                "det": f"Cierre de caja #{id_apertura}. Saldo Teórico: Bs. {saldo_teorico:.2f}, Arqueo Real: Bs. {dto.SaldoReal:.2f}, Diferencia: Bs. {diferencia:.2f}."
            })
            self.repo.caller.db.commit()
        except Exception:
            pass

        return cierre

    def ObtenerResumenGerencial(self, id_apertura: int) -> dict:
        """Genera resumen ejecutivo de liquidez diaria para Gerencia General."""
        totales = self.repo.ObtenerTotalesCaja(id_apertura)
        movimientos = self.repo.ListarMovimientosCaja(id_apertura=id_apertura)
        
        # Desglosar ingresos por categorías
        ingresos_reparto = sum(float(m.get("Monto", 0)) for m in movimientos if m.get("TipoMovimiento") == "Ingreso" and ("repart" in (m.get("NombreCategoria") or "").lower() or "cobran" in (m.get("NombreCategoria") or "").lower()))
        ingresos_extra = sum(float(m.get("Monto", 0)) for m in movimientos if m.get("TipoMovimiento") == "Ingreso" and ("extra" in (m.get("NombreCategoria") or "").lower() or "recicla" in (m.get("NombreCategoria") or "").lower()))
        egresos_operativos = sum(float(m.get("Monto", 0)) for m in movimientos if m.get("TipoMovimiento") == "Egreso")

        tot_ing = float(totales.get("TotalIngresos", 0.0))
        tot_egr = float(totales.get("TotalEgresos", 0.0))

        return {
            "IdAperturaCierreCaja": id_apertura,
            "TotalIngresos": tot_ing,
            "TotalEgresos": tot_egr,
            "SaldoNetoJornada": round(tot_ing - tot_egr, 2),
            "IngresosPorRepartidores": ingresos_reparto,
            "IngresosExtraordinarios": ingresos_extra,
            "EgresosOperativos": egresos_operativos,
            "CantidadTransacciones": len(movimientos),
            "FechaGeneracion": datetime.now().isoformat()
        }


    # --- Categorías y Movimientos de Caja ---
    def ListarCategoriasMovimiento(self, tipo: str | None = None) -> list[dict]:
        return self.repo.ListarCategoriasMovimiento(tipo)

    def ListarMovimientosCaja(self, id_apertura: int | None = None, fecha_inicio = None,
                              fecha_fin = None, tipo: str | None = None,
                              id_cuenta_bancaria: int | None = None, busqueda: str | None = None,
                              limit: int | None = None, offset: int | None = None,
                              id_sucursal: int | None = None,
                              es_corporativo: bool | None = None) -> list[dict]:
        return self.repo.ListarMovimientosCaja(id_apertura, fecha_inicio, fecha_fin, tipo, id_cuenta_bancaria, busqueda, limit, offset, id_sucursal=id_sucursal, es_corporativo=es_corporativo)

    def RegistrarMovimientoCaja(self, dto: MovimientoCajaCrear, id_usuario: int | None = None) -> dict:
        id_apertura = dto.IdAperturaCierreCaja
        id_sucursal = dto.IdSucursal
        es_corp = bool(dto.EsCorporativo)

        # Si viene apertura de caja, derivar sucursal desde la caja
        if id_apertura:
            sql_caja = text('SELECT c."IdSucursal" FROM "AperturaCierreCaja" acc JOIN "Caja" c ON acc."IdCaja" = c."IdCaja" WHERE acc."IdAperturaCierreCaja" = :id_ap')
            row = self.repo.caller.db.execute(sql_caja, {"id_ap": id_apertura}).fetchone()
            if row and row[0]:
                id_sucursal = row[0]
                es_corp = False

        # Validación estricta: debe tener sede u origen, o ser corporativo explícito
        if not id_sucursal and not es_corp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe especificar la caja (apertura), la sucursal de destino o marcar el movimiento explícitamente como corporativo."
            )

        payload = dto.model_dump()
        payload["IdAperturaCierreCaja"] = id_apertura
        payload["IdSucursal"] = id_sucursal
        payload["es_corporativo"] = es_corp
        mov = self.repo.CrearMovimientoCaja(payload, id_usuario)

        # Si involucra una cuenta bancaria, actualizar saldo bancario
        if dto.IdCuentaBancaria:
            # Buscar categoría para saber si suma o resta
            cats = self.repo.ListarCategoriasMovimiento()
            cat_obj = next((c for c in cats if c["IdCategoriaMovimientoCaja"] == dto.IdCategoriaMovimientoCaja), None)
            if cat_obj:
                delta = dto.Monto if cat_obj["TipoMovimiento"] == "Egreso" else -dto.Monto # depósito a banco suma al banco
                self.repo.ActualizarSaldoCuentaBancaria(dto.IdCuentaBancaria, delta)

        return mov

    def AnularMovimientoCaja(self, id_movimiento: int, id_usuario: int | None, motivo: str = "") -> dict:
        # Anulación lógica sin borrado físico
        mov = self.repo.ObtenerMovimientoCajaPorId(id_movimiento)
        if not mov:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimiento de caja no encontrado")
        if mov.get("Anulado"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El movimiento ya se encuentra anulado")

        anulado = self.repo.AnularMovimientoCaja(id_movimiento, id_usuario, motivo)

        # Revertir saldo bancario si involucró banco
        if mov.get("IdCuentaBancaria"):
            tipo = mov.get("TipoMovimiento")
            monto = float(mov.get("Monto") or 0.0)
            delta = -monto if tipo == "Egreso" else monto
            self.repo.ActualizarSaldoCuentaBancaria(mov["IdCuentaBancaria"], delta)

        # Registrar en historial de auditoría
        self.repo.RegistrarAuditLog(
            id_usuario=id_usuario,
            accion="ANULACION",
            tabla="MovimientoCaja",
            id_registro=str(id_movimiento),
            detalle=f"Anulación de movimiento contable ID {id_movimiento} ({mov.get('TipoMovimiento')}, Bs. {mov.get('Monto')}). Motivo: {motivo or 'Ajuste contable'}"
        )

        return anulado


    # --- Solicitudes de Caja Chica ---
    def ListarSolicitudesCajaChica(self, estado: str | None = None, fecha_inicio = None,
                                   fecha_fin = None, id_sucursal: int | None = None,
                                   busqueda: str | None = None, limit: int | None = None,
                                   offset: int | None = None) -> list[dict]:
        return self.repo.ListarSolicitudesCajaChica(estado, fecha_inicio, fecha_fin, id_sucursal, busqueda, limit, offset)

    def ObtenerSolicitudCajaChica(self, id_solicitud: int) -> dict:
        sol = self.repo.ObtenerSolicitudCajaChicaPorId(id_solicitud)
        if not sol:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
        return sol

    def CrearSolicitudCajaChica(self, dto: SolicitudCajaChicaCrear) -> dict:
        codigo = dto.CodigoSolicitud or self.repo.GenerarCodigoSolicitud(dto.FechaSolicitud)
        payload = dto.model_dump()
        payload["CodigoSolicitud"] = codigo
        payload["Estado"] = "PENDIENTE"
        payload["AprobacionGerencia"] = "PENDIENTE"
        return self.repo.CrearSolicitudCajaChica(payload)

    def EntregarFondosCajaChica(self, id_solicitud: int, dto: EntregaFondosCajaChicaRequest) -> dict:
        sol = self.ObtenerSolicitudCajaChica(id_solicitud)
        if sol["Estado"] not in ["PENDIENTE", "Pendiente"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La solicitud ya se encuentra en estado '{sol['Estado']}' y no puede recibir entrega de fondos inicial"
            )

        updates = {
            "Estado": "ENTREGADO",
            "MontoEntregado": float(dto.MontoEntregado),
            "NombreEntregadoPor": dto.NombreEntregadoPor or "Caja Central"
        }
        return self.repo.ActualizarSolicitudCajaChica(id_solicitud, updates)

    def RendirGastoCajaChica(self, id_solicitud: int, dto: RendicionGastoCajaChicaRequest) -> dict:
        sol = self.ObtenerSolicitudCajaChica(id_solicitud)
        if sol["Estado"] not in ["ENTREGADO", "Entregado"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo se pueden rendir cuentas de solicitudes que hayan recibido entrega de fondos ('ENTREGADO')"
            )

        if not dto.IdComprobanteArchivo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La fotografía o archivo del comprobante/factura de respaldo es obligatoria para rendir caja chica"
            )

        # 1. Registrar cada ítem en DetalleGastoCajaChica y sumar monto real
        monto_gasto_real = 0.0
        for item in dto.Items:
            monto_gasto_real += float(item.Monto)
            self.repo.InsertarDetalleGastoCajaChica(
                solicitud_id=id_solicitud,
                concepto=item.Concepto,
                nro_factura=item.NroFactura,
                proveedor=item.Proveedor,
                monto=float(item.Monto)
            )

        monto_entregado = float(sol.get("MontoEntregado") or sol.get("MontoSolicitado"))
        # Cálculo automático de reintegro/cambio devuelto a caja
        monto_reintegro = round(monto_entregado - monto_gasto_real, 2)

        updates = {
            "Estado": "RENDIDO",
            "MontoGastoReal": round(monto_gasto_real, 2),
            "MontoReintegro": monto_reintegro,
            "IdComprobanteArchivo": dto.IdComprobanteArchivo,
            "RespaldoDoc": dto.RespaldoDoc or f"Comprobante digital #{dto.IdComprobanteArchivo}"
        }
        sol_actualizada = self.repo.ActualizarSolicitudCajaChica(id_solicitud, updates)

        # 2. Notificar a Don Osvaldo (Gerencia) que el vale está rendido y listo para revisión
        NotificationService().CrearNotificacion(
            id_usuario_destinatario=None,
            tipo_alerta="CAJA_CHICA_RENDIDA",
            titulo=f"Vale Rendido: {sol['CodigoSolicitud']}",
            mensaje=f"Kevin rindió el vale {sol['CodigoSolicitud']} por Bs. {monto_gasto_real:.2f} (Reintegro: Bs. {monto_reintegro:.2f}). Pendiente de firma gerencial.",
            codigo_referencia=id_solicitud
        )

        return self.ObtenerSolicitudCajaChica(id_solicitud)

    def ResolverAprobacionGerencia(self, id_solicitud: int, dto: ResolverAprobacionGerenciaRequest, id_gerente: int) -> dict:
        sol = self.ObtenerSolicitudCajaChica(id_solicitud)
        if sol["Estado"] not in ["RENDIDO", "Rendido", "Rendida"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gerencia solo puede autorizar o rechazar solicitudes que hayan sido completamente rendidas con sus respaldos"
            )

        nuevo_estado_gerencia = "APROBADO" if dto.Aprobado else "RECHAZADO"
        datos_actualizar = {
            "AprobacionGerencia": nuevo_estado_gerencia,
            "NombreAprobadoPor": f"GERENCIA (Usuario #{id_gerente})"
        }

        # Si se aprueba, generar el egreso real en caja por el MontoGastoReal
        if dto.Aprobado and not sol.get("IdMovimientoCaja"):
            gasto_neto = float(sol.get("MontoGastoReal") or sol.get("MontoSolicitado"))
            mov_datos = {
                "IdCategoriaMovimientoCaja": sol.get("IdCategoriaMovimientoCaja") or 6, # 6 = Egreso Operativo
                "Monto": gasto_neto,
                "MetodoPago": "Efectivo",
                "NotaCodigo": sol["CodigoSolicitud"],
                "Solicitante": sol["NombreSolicitante"],
                "Respaldo": sol.get("RespaldoDoc"),
                "Descripcion": f"Descargo Vale Caja Chica {sol['CodigoSolicitud']} - {sol['DestinoJustificacion']}",
                "IdSucursal": sol.get("IdSucursal") or 1
            }
            mov = self.RegistrarMovimientoCaja(MovimientoCajaCrear(**mov_datos), id_gerente)
            datos_actualizar["IdMovimientoCaja"] = mov["IdMovimientoCaja"]

        res = self.repo.ActualizarSolicitudCajaChica(id_solicitud, datos_actualizar)

        AuditService().RegistrarAuditoria(
            id_usuario=id_gerente,
            accion="RESOLUCION_GERENCIA_CAJA_CHICA",
            tabla="SolicitudCajaChica",
            id_registro=id_solicitud,
            detalle={
                "codigo": sol["CodigoSolicitud"],
                "resolucion": nuevo_estado_gerencia,
                "monto_gasto_real": sol.get("MontoGastoReal"),
                "observaciones": dto.Observaciones
            }
        )
        return self.ObtenerSolicitudCajaChica(id_solicitud)

    def ValidarImpresionVale(self, id_solicitud: int) -> dict:
        sol = self.ObtenerSolicitudCajaChica(id_solicitud)
        aprobacion = str(sol.get("AprobacionGerencia") or "PENDIENTE").upper()
        if aprobacion != "APROBADO":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El vale no puede ser impreso ni descargado mientras la aprobación de Gerencia esté pendiente o haya sido rechazada"
            )
        return {
            "PuedeImprimir": True,
            "Vale": sol,
            "Detalles": self.repo.ListarDetallesGastoCajaChica(id_solicitud)
        }

    def ListarPendientesAprobacionGerencia(self, id_sucursal: int | None = None) -> list[dict]:
        return self.repo.ListarPendientesAprobacionGerencia(id_sucursal)

    def ActualizarEstadoSolicitud(self, id_solicitud: int, dto: SolicitudCajaChicaActualizarEstado, id_usuario: int) -> dict:
        sol = self.ObtenerSolicitudCajaChica(id_solicitud)
        datos_actualizar = {
            "Estado": dto.Estado,
            "RespaldoDoc": dto.RespaldoDoc or sol.get("RespaldoDoc")
        }

        # Si se aprueba y se solicita generar egreso de caja chica
        if dto.GenerarMovimientoCaja and dto.Estado in ["Aprobada", "Rendida"] and not sol.get("IdMovimientoCaja"):
            mov_datos = {
                "IdCategoriaMovimientoCaja": sol.get("IdCategoriaMovimientoCaja") or 6, # 6 = Egreso Operativo
                "Monto": float(sol.get("MontoGastoReal") or sol["MontoSolicitado"]),
                "MetodoPago": "Efectivo",
                "NotaCodigo": sol["CodigoSolicitud"],
                "Solicitante": sol["NombreSolicitante"],
                "Respaldo": dto.RespaldoDoc or sol.get("RespaldoDoc"),
                "Descripcion": sol["DestinoJustificacion"]
            }
            mov = self.RegistrarMovimientoCaja(MovimientoCajaCrear(**mov_datos), id_usuario)
            datos_actualizar["IdMovimientoCaja"] = mov["IdMovimientoCaja"]

        return self.repo.ActualizarSolicitudCajaChica(id_solicitud, datos_actualizar)
