from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_CHOFER, ROL_AGENTE_REPARTO
from app.Services.Logistica.InventarioComercialService import InventarioComercialService
from app.Models.Logistica.InventarioComercialModel import (
    InventarioSucursalResponse,
    InventarioChoferResponse,
    CargaChoferDTO,
    ReporteInventarioValorizadoResponse,
)

InventarioComercialRouter = APIRouter(prefix="/logistica/inventario", tags=["Logística - Inventario Comercial y Choferes"])

PERMISOS_OPERATIVOS = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_CHOFER, ROL_AGENTE_REPARTO]
PERMISOS_GERENCIA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]


@InventarioComercialRouter.get("/sucursal/{sucursal_id}", response_model=List[InventarioSucursalResponse])
def listar_inventario_sucursal(
    sucursal_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_OPERATIVOS)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Consulta el stock comercial físico disponible y reservado en el galpón de la sucursal."""
    alcance.validar_recurso(sucursal_id, nombre_recurso="sucursal")
    return InventarioComercialService(db).listar_inventario_sucursal(sucursal_id)


@InventarioComercialRouter.get("/chofer/{chofer_id}", response_model=List[InventarioChoferResponse])
def listar_inventario_chofer(
    chofer_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_OPERATIVOS)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Consulta el inventario móvil cargado en el camión del chofer con sus precios vigentes."""
    # Regla de aislamiento: un chofer solo puede consultar su propio inventario
    if usuario.get("IdRol") in [ROL_CHOFER, ROL_AGENTE_REPARTO] and usuario.get("IdUsuario") != chofer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chofer no encontrado")

    sql_chof = 'SELECT "IdSucursal" FROM "Usuario" WHERE "IdUsuario" = :uid;'
    chof_row = db.execute(text(sql_chof), {"uid": chofer_id}).fetchone()
    if not chof_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chofer no encontrado")
    alcance.validar_recurso(chof_row[0], nombre_recurso="chofer", responder_404=True)
    return InventarioComercialService(db).listar_inventario_chofer(chofer_id)


@InventarioComercialRouter.post("/cargar-chofer", response_model=List[dict])
def cargar_stock_chofer(
    dto: CargaChoferDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_GERENCIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Descuenta de la sucursal y carga mercadería al camión del chofer."""
    dto.sucursal_id = alcance.validar_escritura(dto.sucursal_id, nombre_recurso="sucursal_origen")
    return InventarioComercialService(db).cargar_stock_chofer(dto)


@InventarioComercialRouter.get("/reportes/valorizado", response_model=ReporteInventarioValorizadoResponse)
def reporte_inventario_valorizado(
    sucursal_id: Optional[str] = Query(None, description="ID de la sucursal a consultar ('1', '2')"),
    fecha_corte: Optional[datetime] = Query(None, description="Fecha de corte histórica (ISO 8601)"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_GERENCIA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Genera el reporte oficial de inventario valorizado (actual o a fecha arbitraria, ej. 31 de octubre).
    Multiplica el saldo físico disponible por el precio unitario vigente.
    Rechaza consultas con 'todas' o sin sede con 400 Bad Request.
    """
    if sucursal_id is not None:
        val_str = str(sucursal_id).strip().lower()
        if val_str in ("todas", "all", "null", ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe seleccionar una sucursal específica para generar el reporte de inventario valorizado."
            )
        try:
            sid = int(val_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe seleccionar una sucursal específica para generar el reporte de inventario valorizado."
            )
    else:
        sid = alcance.sucursal_efectiva

    if sid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe seleccionar una sucursal específica para generar el reporte de inventario valorizado."
        )

    alcance.validar_recurso(sid, nombre_recurso="sucursal")
    return InventarioComercialService(db).generar_reporte_inventario_valorizado(sid, fecha_corte)
