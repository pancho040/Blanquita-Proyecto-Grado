from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR
from app.Services.Logistica.SucursalService import SucursalService
from app.Models.Logistica.SucursalModel import (
    SucursalCrear,
    SucursalUpdate,
    SucursalResponse,
    PlantaResponse,
)

SucursalRouter = APIRouter(prefix="/sucursales", tags=["Logística - Sucursales y Plantas"])
PlantaRouter = APIRouter(prefix="/plantas", tags=["Logística - Sucursales y Plantas"])

PERMISOS_GERENCIALES = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]


@SucursalRouter.get("", response_model=List[SucursalResponse])
def listar_sucursales(
    solo_activas: bool = False,
    db: Session = Depends(get_db)
):
    """Consulta la lista de sedes/sucursales comerciales registradas."""
    return SucursalService(db).listar_sucursales(solo_activas)


@SucursalRouter.get("/{id_sucursal}", response_model=SucursalResponse)
def obtener_sucursal(
    id_sucursal: int,
    db: Session = Depends(get_db)
):
    sucursal = SucursalService(db).obtener_sucursal(id_sucursal)
    if not sucursal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada.")
    return sucursal


@SucursalRouter.post("", response_model=SucursalResponse, status_code=status.HTTP_201_CREATED)
def crear_sucursal(
    dto: SucursalCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_GERENCIALES))
):
    """Registra una nueva sucursal comercial (soporte escalable multi-sucursal)."""
    return SucursalService(db).crear_sucursal(dto)


@SucursalRouter.put("/{id_sucursal}", response_model=SucursalResponse)
def actualizar_sucursal(
    id_sucursal: int,
    dto: SucursalUpdate,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_GERENCIALES))
):
    res = SucursalService(db).actualizar_sucursal(id_sucursal, dto)
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada.")
    return res


@PlantaRouter.get("", response_model=List[PlantaResponse])
def listar_plantas(
    db: Session = Depends(get_db)
):
    """Consulta el catálogo de plantas de producción y su proveedor de inventario."""
    return SucursalService(db).listar_plantas()
