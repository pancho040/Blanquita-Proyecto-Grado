from datetime import date
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.Logistica.RutaRepository import RutaRepository
from app.Models.Logistica.RutaModel import (
    ZonaCrear, RutaCrear, RutaActualizar, GuardarPuntosVentaRuta,
    AsignacionRutaCrear, AsignacionRutaActualizar, RepartidorCrear,
    TelemetriaPing, InsertarParadaOrdenRequest, QuitarParadaRequest,
    MoverParadaRutaRequest, SolicitudCargaCrear, SolicitudCargaRevision,
    RevisionWebOperacionRequest
)
from app.Auth.Security import HashPassword

class RutaService:
    def __init__(self, db: Session):
        self.repo = RutaRepository(db)

    # ZONAS
    def ListarZonas(self, id_sucursal: int | None = None) -> list[dict]:
        return self.repo.ListarZonas(id_sucursal)

    def CrearZona(self, dto: ZonaCrear) -> dict:
        return self.repo.CrearZona(dto.model_dump())

    # RUTAS
    def ListarRutas(self, id_zona: int | None = None, id_sucursal: int | None = None) -> list[dict]:
        return self.repo.ListarRutas(id_zona, id_sucursal)

    def ObtenerRutaDetalle(self, id_ruta: int) -> dict:
        ruta = self.repo.ObtenerRutaPorId(id_ruta)
        if not ruta:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta no encontrada")
        ruta["PuntosVenta"] = self.repo.ListarPuntosVentaRuta(id_ruta)
        return ruta

    def CrearRuta(self, dto: RutaCrear) -> dict:
        res = self.repo.CrearRuta(dto.model_dump())
        return self.ObtenerRutaDetalle(res["IdRutaDistribucion"])

    def ActualizarRuta(self, id_ruta: int, dto: RutaActualizar) -> dict:
        self.ObtenerRutaDetalle(id_ruta)
        self.repo.ActualizarRuta(id_ruta, dto.model_dump(exclude_unset=True))
        return self.ObtenerRutaDetalle(id_ruta)

    def GuardarPuntosVentaRuta(self, id_ruta: int, dto: GuardarPuntosVentaRuta) -> dict:
        self.ObtenerRutaDetalle(id_ruta)
        self.repo.GuardarPuntosVentaRuta(id_ruta, dto.PuntosVenta)
        return self.ObtenerRutaDetalle(id_ruta)

    # ASIGNACIONES
    def ListarAsignaciones(self, fecha: date | None = None, id_repartidor: int | None = None, id_sucursal: int | None = None) -> list[dict]:
        # Invocación automática e idempotente del generador de rutas diarias
        fecha_evaluar = fecha or date.today()
        try:
            self.repo.EjecutarGeneradorRutasDiarias(fecha_evaluar)
        except Exception:
            # Si la función falla por conectividad o permisos, continuar con el listado
            pass
        return self.repo.ListarAsignaciones(fecha, id_repartidor, id_sucursal)

    def GenerarRutasDiarias(self, fecha: date | None = None) -> dict:
        """Invocación explícita del generador diario de rutas."""
        return self.repo.EjecutarGeneradorRutasDiarias(fecha or date.today())

    def CrearAsignacion(self, dto: AsignacionRutaCrear, id_usuario_asigna: int) -> dict:
        # Verificar duplicidad (uq_asignacion_ruta_fecha)
        existentes = self.repo.ListarAsignaciones(fecha=dto.FechaAsignacion, id_repartidor=dto.IdUsuarioRepartidor)
        for e in existentes:
            if e["IdRutaDistribucion"] == dto.IdRutaDistribucion:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El repartidor ya está asignado a esta ruta para la fecha {dto.FechaAsignacion}"
                )
        res = self.repo.CrearAsignacion(dto.model_dump(), id_usuario_asigna)
        return res

    def ActualizarAsignacion(self, id_asignacion: int, dto: AsignacionRutaActualizar) -> dict:
        return self.repo.ActualizarAsignacion(id_asignacion, dto.model_dump(exclude_unset=True))

    def ListarRepartidores(self, id_sucursal: int | None = None) -> list[dict]:
        return self.repo.ListarRepartidoresActivos(id_sucursal)

    def CrearRepartidor(self, dto: RepartidorCrear) -> dict:
        existe = self.repo.caller.LlamarUnRegistro(
            'SELECT "IdUsuario" FROM "Usuario" WHERE "Ci" = :ci;',
            {"ci": dto.Ci}
        )
        if existe:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un usuario o chofer registrado con el CI {dto.Ci}"
            )
        clave_a_hashear = dto.Clave or "Blanquita123!"
        clave_hash = HashPassword(clave_a_hashear)
        return self.repo.CrearRepartidor(dto.model_dump(), clave_hash)

    def CambiarEstadoRepartidor(self, id_usuario: int, id_estado: int) -> dict:
        return self.repo.CambiarEstadoRepartidor(id_usuario, id_estado)

    # -------------------------------------------------------------
    # REORDENAMIENTO COMPACTO 1..N
    # -------------------------------------------------------------
    def recalcular_orden_paradas_ruta(self, id_ruta: int) -> list[dict]:
        """Recalcula el orden secuencial compacto 1..N sin huecos para la ruta."""
        return self.repo.RecalcularOrdenParadasRuta(id_ruta)

    def insertar_parada_en_orden(self, dto: InsertarParadaOrdenRequest) -> list[dict]:
        """Inserta parada desplazando en +1 las paradas >= posición y compacta 1..N."""
        return self.repo.InsertarParadaEnOrden(dto.IdRuta, dto.IdPuntoVenta, dto.Posicion)

    def quitar_parada_ruta(self, dto: QuitarParadaRequest, fecha: date | None = None) -> list[dict]:
        """
        Quita una parada PENDIENTE y compacta 1..N (ej. se quita la #4, #5 y #6 pasan a ser #4 y #5).
        Lanza HTTP 400 si la parada ya tiene entrega o cobro hoy.
        """
        try:
            return self.repo.QuitarParadaRuta(dto.IdRuta, dto.IdPuntoVenta, fecha)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    def mover_cliente_de_ruta(self, dto: MoverParadaRutaRequest, fecha: date | None = None) -> dict:
        """
        Mueve un cliente PENDIENTE a otra ruta del mismo día o de otro día de la semana.
        Lanza HTTP 400 si la parada ya tiene entrega o cobro hoy en origen.
        Recalcula el orden 1..N tanto en origen como en destino.
        """
        try:
            return self.repo.MoverClienteDeRuta(
                dto.IdPuntoVenta, dto.IdRutaOrigen, dto.IdRutaDestino, dto.PosicionDestino, fecha
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # -------------------------------------------------------------
    # SOLICITUDES DE CARGA DE CAMIÓN
    # -------------------------------------------------------------
    def CrearSolicitudCarga(self, dto: SolicitudCargaCrear) -> dict:
        return self.repo.CrearSolicitudCarga(dto.model_dump(exclude_unset=True))

    def ListarSolicitudesCarga(self, id_asignacion: int | None = None, estado: str | None = None) -> list[dict]:
        return self.repo.ListarSolicitudesCarga(id_asignacion, estado)

    def ObtenerSolicitudCargaPorId(self, id_solicitud: int) -> dict:
        res = self.repo.ObtenerSolicitudCargaPorId(id_solicitud)
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de carga no encontrada")
        return res

    def RevisarSolicitudCarga(self, id_solicitud: int, dto: SolicitudCargaRevision, id_admin: int) -> dict:
        try:
            res = self.repo.RevisarSolicitudCarga(
                id_solicitud=id_solicitud,
                estado=dto.Estado or dto.estado,
                id_admin=id_admin,
                obs_admin=dto.ObservacionAdmin or dto.observacion,
                items_aprobados=dto.ItemsAprobados or dto.items_aprobados
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de carga no encontrada")
        return res

    # -------------------------------------------------------------
    # AUDITORÍA / REVISIÓN WEB
    # -------------------------------------------------------------
    def RevisarEntregaWeb(self, id_pedido: int, dto: RevisionWebOperacionRequest, id_admin: int) -> dict:
        try:
            res = self.repo.RevisarEntregaWeb(
                id_pedido=id_pedido,
                estado_revision=dto.EstadoRevisionWeb,
                revisado_por_id=id_admin,
                observacion=dto.ObservacionRevision
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
        return res

    def RevisarPagoWeb(self, id_pago_pedido: int, dto: RevisionWebOperacionRequest, id_admin: int) -> dict:
        try:
            res = self.repo.RevisarPagoWeb(
                id_pago_pedido=id_pago_pedido,
                estado_revision=dto.EstadoRevisionWeb,
                revisado_por_id=id_admin,
                observacion=dto.ObservacionRevision
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
        return res

    # TELEMETRÍA Y RASTREO GPS EN VIVO
    def RegistrarTelemetriaPing(self, dto: TelemetriaPing) -> dict:
        return self.repo.RegistrarTelemetriaPing(dto.model_dump())

    def ObtenerChoferesEnVivo(self, sucursal_id: int | None = None) -> list[dict]:
        return self.repo.ObtenerChoferesEnVivo(sucursal_id)

    def ObtenerTrackingAsignacion(self, id_asignacion: int) -> dict:
        res = self.repo.ObtenerTrackingPorAsignacion(id_asignacion)
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")
        return res

    def RegistrarEntregaParada(self, datos: dict) -> dict:
        if not datos.get("IdPedido"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IdPedido es obligatorio")
        res = self.repo.RegistrarEntregaParada(datos)
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
        return res

    def RegistrarCobroParada(self, datos: dict) -> dict:
        if not datos.get("IdPedido") or not datos.get("Monto"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="IdPedido y Monto son obligatorios")
        return self.repo.RegistrarCobroParada(datos)

    def ObtenerLiquidacionRuta(self, id_asignacion: int) -> dict:
        res = self.repo.ObtenerLiquidacionRuta(id_asignacion)
        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")
        return res

    def CerrarYLiquidarRuta(self, id_asignacion: int, datos: dict, id_usuario_aprueba: int) -> dict:
        self.ObtenerLiquidacionRuta(id_asignacion)
        return self.repo.CerrarYLiquidarRuta(id_asignacion, datos, id_usuario_aprueba)
