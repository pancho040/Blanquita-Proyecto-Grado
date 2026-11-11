from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO
from app.Services.Logistica.PrecioService import PrecioService
from app.Models.Logistica.PrecioModel import PrecioProductoCrear, PrecioProductoResponse

PrecioRouter = APIRouter(prefix="/logistica/precios", tags=["Logística - Precios de Venta"])

PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]
PERMISOS_LECTURA_PRECIOS = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO]


@PrecioRouter.get("", response_model=list[PrecioProductoResponse])
def listar_precios(
    id_sucursal: Optional[str] = Query(None, description="ID de la sucursal a consultar ('1', '2')"),
    sucursal: Optional[str] = Query(None, description="Alias para id_sucursal"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LECTURA_PRECIOS)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Lista precios vigentes filtrados por sucursal. Rechaza consultas con 'todas' o sin sede con 400."""
    param_sede = id_sucursal if id_sucursal is not None else sucursal

    if param_sede is not None:
        val_str = str(param_sede).strip().lower()
        if val_str in ("todas", "all", "null", ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe seleccionar una sucursal específica para consultar la lista de precios."
            )
        try:
            sid = int(val_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe seleccionar una sucursal específica para consultar la lista de precios."
            )
    else:
        sid = alcance.sucursal_efectiva

    if sid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe seleccionar una sucursal específica para consultar la lista de precios."
        )

    alcance.validar_recurso(sid, nombre_recurso="sucursal")
    return PrecioService(db).ListarPreciosVigentes(sid)


@PrecioRouter.post("", response_model=dict)
def guardar_precio(
    dto: PrecioProductoCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Modificar precio unitario por sucursal con trigger de revalorización y auditoría."""
    sid_valido = alcance.validar_escritura(dto.IdSucursal)
    dto.IdSucursal = sid_valido
    return PrecioService(db).GuardarPrecio(dto, usuario["IdUsuario"])


@PrecioRouter.get("/{id_presentacion}/historial")
def listar_historial_precios(
    id_presentacion: int,
    id_sucursal: Optional[str] = Query(None, description="ID de la sucursal"),
    sucursal: Optional[str] = Query(None, description="Alias para id_sucursal"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LECTURA_PRECIOS)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Consulta el historial de precios anteriores y fechas de vigencia por sucursal."""
    param_sede = id_sucursal if id_sucursal is not None else sucursal

    if param_sede is not None:
        val_str = str(param_sede).strip().lower()
        if val_str in ("todas", "all", "null", ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe seleccionar una sucursal específica para consultar el historial de precios."
            )
        try:
            sid = int(val_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe seleccionar una sucursal específica para consultar el historial de precios."
            )
    else:
        sid = alcance.sucursal_efectiva

    if sid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe seleccionar una sucursal específica para consultar el historial de precios."
        )

    alcance.validar_recurso(sid, nombre_recurso="sucursal")
    return PrecioService(db).ListarHistorialPrecios(id_presentacion, sid)
