from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION
from app.Models.Insumo.Inicio import InicioInsumoResponse
from app.Services.Insumo.Inicio import InicioInsumoService


def inicio_insumo_service(db: Session = Depends(get_db)) -> InicioInsumoService:
    return InicioInsumoService(db)


InicioInsumoRouter = APIRouter(prefix="/insumo/inicio", tags=["Insumo - Inicio"])


@InicioInsumoRouter.get(
    "/resumen",
    response_model=InicioInsumoResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def VerInicioInsumo(
    service: InicioInsumoService = Depends(inicio_insumo_service),
):
    return service.VerInicio()
