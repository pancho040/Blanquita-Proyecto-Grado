from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.Contabilidad.TesoreriaRepository import TesoreriaRepository
from app.Models.Contabilidad.TesoreriaModel import (
    CuentaBancariaCrear, CuentaBancariaActualizar, AperturaCajaCrear,
    CierreCajaCrear, MovimientoCajaCrear, SolicitudCajaChicaCrear,
    SolicitudCajaChicaActualizarEstado
)

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
        return cierre


    # --- Categorías y Movimientos de Caja ---
    def ListarCategoriasMovimiento(self, tipo: str | None = None) -> list[dict]:
        return self.repo.ListarCategoriasMovimiento(tipo)

    def ListarMovimientosCaja(self, id_apertura: int | None = None, fecha_inicio = None, fecha_fin = None, tipo: str | None = None) -> list[dict]:
        return self.repo.ListarMovimientosCaja(id_apertura, fecha_inicio, fecha_fin, tipo)

    def RegistrarMovimientoCaja(self, dto: MovimientoCajaCrear, id_usuario: int | None = None) -> dict:
        # Si no se pasó id_apertura, buscar la caja abierta actual
        id_apertura = dto.IdAperturaCierreCaja
        if not id_apertura:
            caja_abierta = self.repo.ObtenerCajaAbierta(1)
            if caja_abierta:
                id_apertura = caja_abierta["IdAperturaCierreCaja"]

        payload = dto.model_dump()
        payload["IdAperturaCierreCaja"] = id_apertura
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


    # --- Solicitudes de Caja Chica ---
    def ListarSolicitudesCajaChica(self, estado: str | None = None, fecha_inicio = None, fecha_fin = None) -> list[dict]:
        return self.repo.ListarSolicitudesCajaChica(estado, fecha_inicio, fecha_fin)

    def ObtenerSolicitudCajaChica(self, id_solicitud: int) -> dict:
        sol = self.repo.ObtenerSolicitudCajaChicaPorId(id_solicitud)
        if not sol:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada")
        return sol

    def CrearSolicitudCajaChica(self, dto: SolicitudCajaChicaCrear) -> dict:
        codigo = dto.CodigoSolicitud or self.repo.GenerarCodigoSolicitud(dto.FechaSolicitud)
        payload = dto.model_dump()
        payload["CodigoSolicitud"] = codigo
        return self.repo.CrearSolicitudCajaChica(payload)

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
                "Monto": float(sol["MontoSolicitado"]),
                "MetodoPago": "Efectivo",
                "NotaCodigo": sol["CodigoSolicitud"],
                "Solicitante": sol["NombreSolicitante"],
                "Respaldo": dto.RespaldoDoc or sol.get("RespaldoDoc"),
                "Descripcion": sol["DestinoJustificacion"]
            }
            mov = self.RegistrarMovimientoCaja(MovimientoCajaCrear(**mov_datos), id_usuario)
            datos_actualizar["IdMovimientoCaja"] = mov["IdMovimientoCaja"]

        return self.repo.ActualizarSolicitudCajaChica(id_solicitud, datos_actualizar)
