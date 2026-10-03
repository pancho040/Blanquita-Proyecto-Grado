from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR
from app.Services.Logistica.RutaService import RutaService
from app.Models.Logistica.RutaModel import (
    ZonaCrear, ZonaResponse, RutaCrear, RutaActualizar, RutaResponse,
    GuardarPuntosVentaRuta, AsignacionRutaCrear, AsignacionRutaResponse
)

RutaRouter = APIRouter(prefix="/logistica", tags=["Logística - Rutas y Asignaciones"])

PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]

# -------------------------------------------------------------
# ZONAS
# -------------------------------------------------------------
@RutaRouter.get("/zonas", response_model=list[ZonaResponse])
def listar_zonas(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).ListarZonas()

@RutaRouter.post("/zonas", response_model=dict)
def crear_zona(
    dto: ZonaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).CrearZona(dto)

# -------------------------------------------------------------
# RUTAS
# -------------------------------------------------------------
@RutaRouter.get("/rutas", response_model=list[RutaResponse])
def listar_rutas(
    id_zona: Optional[int] = Query(None, description="Filtrar por zona"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).ListarRutas(id_zona)

@RutaRouter.get("/rutas/{id_ruta}", response_model=RutaResponse)
def obtener_ruta(
    id_ruta: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).ObtenerRutaDetalle(id_ruta)

@RutaRouter.post("/rutas", response_model=RutaResponse)
def crear_ruta(
    dto: RutaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).CrearRuta(dto)

@RutaRouter.put("/rutas/{id_ruta}", response_model=RutaResponse)
def actualizar_ruta(
    id_ruta: int,
    dto: RutaActualizar,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).ActualizarRuta(id_ruta, dto)

@RutaRouter.put("/rutas/{id_ruta}/puntos-venta", response_model=RutaResponse)
def guardar_puntos_venta_ruta(
    id_ruta: int,
    dto: GuardarPuntosVentaRuta,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).GuardarPuntosVentaRuta(id_ruta, dto)

# -------------------------------------------------------------
# ASIGNACIONES DIARIAS A REPARTIDORES
# -------------------------------------------------------------
@RutaRouter.get("/asignaciones", response_model=list[AsignacionRutaResponse])
def listar_asignaciones(
    fecha: Optional[date] = Query(None, description="Filtrar por fecha de asignación"),
    id_repartidor: Optional[int] = Query(None, description="Filtrar por repartidor"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).ListarAsignaciones(fecha, id_repartidor)

@RutaRouter.post("/asignaciones", response_model=dict)
def crear_asignacion(
    dto: AsignacionRutaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).CrearAsignacion(dto, usuario["IdUsuario"])

@RutaRouter.get("/repartidores", response_model=list[dict])
def listar_repartidores(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return RutaService(db).ListarRepartidores()
