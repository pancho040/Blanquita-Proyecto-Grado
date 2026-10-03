from datetime import date
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.Repository.Logistica.RutaRepository import RutaRepository
from app.Models.Logistica.RutaModel import (
    ZonaCrear, RutaCrear, RutaActualizar, GuardarPuntosVentaRuta,
    AsignacionRutaCrear, AsignacionRutaActualizar
)

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
        rutas = self.repo.ListarRutas(id_zona)
        for r in rutas:
            r["PuntosVenta"] = self.repo.ListarPuntosVentaRuta(r["IdRutaDistribucion"])
        return rutas

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

    def ListarRepartidores(self) -> list[dict]:
        return self.repo.ListarRepartidoresActivos()
