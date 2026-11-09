from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR
from app.Services.Logistica.PrecioService import PrecioService
from app.Models.Logistica.PrecioModel import PrecioProductoCrear, PrecioProductoResponse

PrecioRouter = APIRouter(prefix="/logistica/precios", tags=["Logística - Precios de Venta"])

PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]


@PrecioRouter.get("", response_model=list[PrecioProductoResponse])
def listar_precios(
    id_sucursal: int = Query(1, description="ID de la sucursal a consultar"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """Lista precios vigentes filtrados por sucursal."""
    return PrecioService(db).ListarPreciosVigentes(id_sucursal)


@PrecioRouter.post("", response_model=dict)
def guardar_precio(
    dto: PrecioProductoCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """Modificar precio unitario por sucursal con trigger de revalorización y auditoría."""
    return PrecioService(db).GuardarPrecio(dto, usuario["IdUsuario"])


@PrecioRouter.get("/{id_presentacion}/historial")
def listar_historial_precios(
    id_presentacion: int,
    id_sucursal: int = Query(1, description="ID de la sucursal"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """Consulta el historial de precios anteriores y fechas de vigencia por sucursal."""
    return PrecioService(db).ListarHistorialPrecios(id_presentacion, id_sucursal)
