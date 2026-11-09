from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_CHOFER
from app.Services.Logistica.InventarioComercialService import InventarioComercialService
from app.Models.Logistica.InventarioComercialModel import (
    InventarioSucursalResponse,
    InventarioChoferResponse,
    CargaChoferDTO,
    ReporteInventarioValorizadoResponse,
)

InventarioComercialRouter = APIRouter(prefix="/logistica/inventario", tags=["Logística - Inventario Comercial y Choferes"])

PERMISOS_OPERATIVOS = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_CHOFER]
PERMISOS_GERENCIA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]


@InventarioComercialRouter.get("/sucursal/{sucursal_id}", response_model=List[InventarioSucursalResponse])
def listar_inventario_sucursal(
    sucursal_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_OPERATIVOS))
):
    """Consulta el stock comercial físico disponible y reservado en el galpón de la sucursal."""
    return InventarioComercialService(db).listar_inventario_sucursal(sucursal_id)


@InventarioComercialRouter.get("/chofer/{chofer_id}", response_model=List[InventarioChoferResponse])
def listar_inventario_chofer(
    chofer_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_OPERATIVOS))
):
    """Consulta el inventario móvil cargado en el camión del chofer con sus precios vigentes."""
    return InventarioComercialService(db).listar_inventario_chofer(chofer_id)


@InventarioComercialRouter.post("/cargar-chofer", response_model=List[dict])
def cargar_stock_chofer(
    dto: CargaChoferDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_GERENCIA))
):
    """Descuenta de la sucursal y carga mercadería al camión del chofer."""
    return InventarioComercialService(db).cargar_stock_chofer(dto)


@InventarioComercialRouter.get("/reportes/valorizado", response_model=ReporteInventarioValorizadoResponse)
def reporte_inventario_valorizado(
    sucursal_id: int = Query(1, description="ID de la sucursal a consultar"),
    fecha_corte: Optional[datetime] = Query(None, description="Fecha de corte histórica (ISO 8601)"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_GERENCIA))
):
    """
    Genera el reporte oficial de inventario valorizado (actual o a fecha arbitraria, ej. 31 de octubre).
    Multiplica el saldo físico disponible por el precio unitario vigente.
    """
    return InventarioComercialService(db).generar_reporte_inventario_valorizado(sucursal_id, fecha_corte)
