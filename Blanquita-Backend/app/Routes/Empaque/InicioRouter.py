from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION
from app.Models.Empaque.Inicio import InicioEmpaqueResponse
from app.Models.Empaque.Reporte import ClaseEmpaque
from app.Services.Empaque.Inicio import InicioEmpaqueService


def inicio_empaque_service(db: Session = Depends(get_db)) -> InicioEmpaqueService:
    return InicioEmpaqueService(db)


InicioEmpaqueRouter = APIRouter(prefix="/empaque/inicio", tags=["Empaque - Inicio"])


@InicioEmpaqueRouter.get(
    "/{clase}/resumen",
    response_model=InicioEmpaqueResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def VerInicioEmpaque(
    clase: ClaseEmpaque,
    service: InicioEmpaqueService = Depends(inicio_empaque_service),
):
    return service.VerInicio(clase)
