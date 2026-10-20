from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db
from app.Config.supabase import get_db
from app.Models.BobinaServilleta.BobinaServilleta import FormatoSubBobinaResponse
from app.Models.BobinaServilleta.TipoBobinaServilleta import (
    CrearTipoBobinaServilletaRequest,
    EditarTipoBobinaServilletaRequest,
    TipoBobinaServilletaAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
    ProductoDisponible,
)
from app.Services.BobinaServilleta.TipoBobinaServilletaService import TipoBobinaServilletaService


def tipo_bobina_servilleta_service(db: Session = Depends(get_db)) -> TipoBobinaServilletaService:
    return TipoBobinaServilletaService(db)


TipoBobinaServilletaRouter = APIRouter(
    prefix="/bobinaservilleta/tipo", tags=["Bobina Servilleta - Tipos (Admin)"]
)


@TipoBobinaServilletaRouter.get(
    "/listar",
    response_model=list[TipoBobinaServilletaAdminItem],
    status_code=200,
)
def ListarTiposBobinaServilleta(
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaServilletaService = Depends(tipo_bobina_servilleta_service),
):
    return service.ListarTipos()


@TipoBobinaServilletaRouter.get(
    "/formatos",
    response_model=list[FormatoSubBobinaResponse],
    status_code=200,
)
def ListarFormatosBobinaServilleta(
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaServilletaService = Depends(tipo_bobina_servilleta_service),
):
    return service.ListarFormatos()


@TipoBobinaServilletaRouter.get(
    "/productos",
    response_model=list[ProductoDisponible],
    status_code=200,
)
def ProductosDisponiblesBobinaServilleta(
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaServilletaService = Depends(tipo_bobina_servilleta_service),
):
    return service.ProductosDisponibles()


@TipoBobinaServilletaRouter.post(
    "/crear",
    response_model=TipoBobinaServilletaAdminItem,
    status_code=201,
)
def CrearTipoBobinaServilleta(
    data: CrearTipoBobinaServilletaRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaServilletaService = Depends(tipo_bobina_servilleta_service),
):
    return service.CrearTipo(data, usuario_actual["IdUsuario"])


@TipoBobinaServilletaRouter.patch(
    "/editar",
    response_model=TipoBobinaServilletaAdminItem,
    status_code=200,
)
def EditarTipoBobinaServilleta(
    data: EditarTipoBobinaServilletaRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaServilletaService = Depends(tipo_bobina_servilleta_service),
):
    return service.EditarTipo(data, usuario_actual["IdUsuario"])


@TipoBobinaServilletaRouter.patch(
    "/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoTipoBobinaServilleta(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaServilletaService = Depends(tipo_bobina_servilleta_service),
):
    return service.CambiarEstado(data, usuario_actual["IdUsuario"])
