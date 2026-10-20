from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db
from app.Config.supabase import get_db
from app.Models.BobinaServilleta.FormatoSubBobina import (
    CrearFormatoSubBobinaRequest,
    FormatoSubBobinaAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Services.BobinaServilleta.FormatoSubBobinaService import FormatoSubBobinaService


def formato_sub_bobina_service(db: Session = Depends(get_db)) -> FormatoSubBobinaService:
    return FormatoSubBobinaService(db)


FormatoSubBobinaRouter = APIRouter(
    prefix="/bobinaservilleta/formato", tags=["Bobina Servilleta - Formatos (Admin)"]
)


@FormatoSubBobinaRouter.get(
    "/listar",
    response_model=list[FormatoSubBobinaAdminItem],
    status_code=200,
)
def ListarFormatosSubBobina(
    usuario_actual: dict = Depends(require_admin_db),
    service: FormatoSubBobinaService = Depends(formato_sub_bobina_service),
):
    return service.ListarFormatos()


@FormatoSubBobinaRouter.post(
    "/crear",
    response_model=FormatoSubBobinaAdminItem,
    status_code=201,
)
def CrearFormatoSubBobina(
    data: CrearFormatoSubBobinaRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: FormatoSubBobinaService = Depends(formato_sub_bobina_service),
):
    return service.CrearFormato(data, usuario_actual["IdUsuario"])


@FormatoSubBobinaRouter.patch(
    "/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoFormatoSubBobina(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: FormatoSubBobinaService = Depends(formato_sub_bobina_service),
):
    return service.CambiarEstado(data, usuario_actual["IdUsuario"])
