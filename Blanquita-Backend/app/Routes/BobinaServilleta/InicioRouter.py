from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION
from app.Models.BobinaServilleta.Inicio import InicioBobinaServilletaResponse
from app.Services.BobinaServilleta.Inicio import InicioBobinaServilletaService


def inicio_bobina_servilleta_service(db: Session = Depends(get_db)) -> InicioBobinaServilletaService:
    return InicioBobinaServilletaService(db)


InicioBobinaServilletaRouter = APIRouter(
    prefix="/bobinaservilleta/inicio", tags=["Bobina Servilleta - Inicio"]
)


@InicioBobinaServilletaRouter.get(
    "/resumen",
    response_model=InicioBobinaServilletaResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def VerInicioBobinaServilleta(
    service: InicioBobinaServilletaService = Depends(inicio_bobina_servilleta_service),
):
    return service.VerInicio()
