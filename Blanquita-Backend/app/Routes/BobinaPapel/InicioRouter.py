from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION
from app.Models.BobinaPapel.Inicio import InicioBobinaPapelResponse
from app.Services.BobinaPapel.Inicio import InicioBobinaPapelService


def inicio_bobina_papel_service(db: Session = Depends(get_db)) -> InicioBobinaPapelService:
    return InicioBobinaPapelService(db)


InicioBobinaPapelRouter = APIRouter(prefix="/papelbobina/inicio", tags=["Papel Bobina - Inicio"])


@InicioBobinaPapelRouter.get(
    "/resumen",
    response_model=InicioBobinaPapelResponse,
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)
def VerInicioBobinaPapel(
    service: InicioBobinaPapelService = Depends(inicio_bobina_papel_service),
):
    return service.VerInicio()
