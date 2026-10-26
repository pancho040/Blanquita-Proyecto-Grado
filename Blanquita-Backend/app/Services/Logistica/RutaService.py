from datetime import date
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.Logistica.RutaRepository import RutaRepository
from app.Models.Logistica.RutaModel import (
    ZonaCrear, RutaCrear, RutaActualizar, GuardarPuntosVentaRuta,
    AsignacionRutaCrear, AsignacionRutaActualizar, RepartidorCrear,
    TelemetriaPing
)
from app.Auth.Security import HashPassword

class RutaService:
    def __init__(self, db: Session):
        self.repo = RutaRepository(db)

    # ZONAS
    def ListarZonas(self) -> list[dict]:
        return self.repo.ListarZonas()

    def CrearZona(self, dto: ZonaCrear) -> dict:
        return self.repo.CrearZona(dto.model_dump())

    # RUTAS
    def ListarRutas(self, id_zona: int | None = None) -> list[dict]:
        return self.repo.ListarRutas(id_zona)

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
    def ListarAsignaciones(self, fecha: date | None = None, id_repartidor: int | None = None) -> list[dict]:
        return self.repo.ListarAsignaciones(fecha, id_repartidor)

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

    def ListarRepartidores(self) -> list[dict]:
        return self.repo.ListarRepartidoresActivos()

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

    # TELEMETRÍA Y RASTREO GPS EN VIVO
    def RegistrarTelemetriaPing(self, dto: TelemetriaPing) -> dict:
        return self.repo.RegistrarTelemetriaPing(dto.model_dump())

    def ObtenerChoferesEnVivo(self) -> list[dict]:
        return self.repo.ObtenerChoferesEnVivo()

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
