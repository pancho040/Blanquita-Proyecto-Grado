from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION
from app.Models.Rodela.Inicio import InicioRodelaResponse
from app.Services.Rodela.Inicio import InicioRodelaService


def inicio_rodela_service(db: Session = Depends(get_db)) -> InicioRodelaService:
    return InicioRodelaService(db)


InicioRodelaRouter = APIRouter(prefix="/rodela/inicio", tags=["Rodela - Inicio"])


@InicioRodelaRouter.get(
    "/resumen",
    response_model=InicioRodelaResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def VerInicioRodela(
    service: InicioRodelaService = Depends(inicio_rodela_service),
):
    return service.VerInicio()
