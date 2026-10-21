from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_GERENTE_GENERAL
from app.Models.Inicio.Gerente import InicioGerenteResponse, PeriodoInicio
from app.Services.Inicio.Gerente import InicioGerenteService


def inicio_gerente_service(db: Session = Depends(get_db)) -> InicioGerenteService:
    return InicioGerenteService(db)


InicioGerenteRouter = APIRouter(prefix="/gerente/inicio", tags=["Gerente - Inicio"])


@InicioGerenteRouter.get(
    "/{periodo}/resumen",
    response_model=InicioGerenteResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_GERENTE_GENERAL]))],
)
def VerInicioGerente(
    periodo: PeriodoInicio,
    service: InicioGerenteService = Depends(inicio_gerente_service),
):
    return service.VerInicio(periodo)
