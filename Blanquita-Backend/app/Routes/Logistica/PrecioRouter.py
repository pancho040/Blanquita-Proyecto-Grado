from fastapi import APIRouter, Depends
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
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return PrecioService(db).ListarPreciosVigentes()

@PrecioRouter.post("", response_model=dict)
def guardar_precio(
    dto: PrecioProductoCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return PrecioService(db).GuardarPrecio(dto)
