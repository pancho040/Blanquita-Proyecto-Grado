from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db
from app.Config.supabase import get_db
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Models.Rodela.TipoRodela import (
    CrearTipoRodelaRequest,
    EditarTipoRodelaRequest,
    TipoRodelaAdminItem,
)
from app.Services.Rodela.TipoRodelaService import TipoRodelaService


def tipo_rodela_service(db: Session = Depends(get_db)) -> TipoRodelaService:
    return TipoRodelaService(db)


TipoRodelaRouter = APIRouter(prefix="/rodela/tipo", tags=["Rodela - Tipos (Admin)"])


@TipoRodelaRouter.get(
    "/listar",
    response_model=list[TipoRodelaAdminItem],
    status_code=200,
)
def ListarTiposRodela(
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoRodelaService = Depends(tipo_rodela_service),
):
    return service.ListarTipos()


@TipoRodelaRouter.post(
    "/crear",
    response_model=TipoRodelaAdminItem,
    status_code=201,
)
def CrearTipoRodela(
    data: CrearTipoRodelaRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoRodelaService = Depends(tipo_rodela_service),
):
    return service.CrearTipo(data, usuario_actual["IdUsuario"])


@TipoRodelaRouter.patch(
    "/editar",
    response_model=TipoRodelaAdminItem,
    status_code=200,
)
def EditarTipoRodela(
    data: EditarTipoRodelaRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoRodelaService = Depends(tipo_rodela_service),
):
    return service.EditarTipo(data, usuario_actual["IdUsuario"])


@TipoRodelaRouter.patch(
    "/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoTipoRodela(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoRodelaService = Depends(tipo_rodela_service),
):
    return service.CambiarEstado(data, usuario_actual["IdUsuario"])
