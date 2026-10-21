from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db
from app.Config.supabase import get_db
from app.Models.BobinaPapel.TipoBobina import (
    CrearTipoBobinaRequest,
    EditarTipoBobinaRequest,
    TipoBobinaAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
    ProductoDisponible,
)
from app.Services.BobinaPapel.TipoBobinaService import TipoBobinaService


def tipo_bobina_service(db: Session = Depends(get_db)) -> TipoBobinaService:
    return TipoBobinaService(db)


TipoBobinaRouter = APIRouter(prefix="/bobinapapel/tipo", tags=["Bobina Papel - Tipos (Admin)"])


@TipoBobinaRouter.get(
    "/listar",
    response_model=list[TipoBobinaAdminItem],
    status_code=200,
)
def ListarTiposBobina(
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaService = Depends(tipo_bobina_service),
):
    return service.ListarTipos()


@TipoBobinaRouter.get(
    "/productos",
    response_model=list[ProductoDisponible],
    status_code=200,
)
def ProductosDisponiblesBobina(
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaService = Depends(tipo_bobina_service),
):
    return service.ProductosDisponibles()


@TipoBobinaRouter.post(
    "/crear",
    response_model=TipoBobinaAdminItem,
    status_code=201,
)
def CrearTipoBobina(
    data: CrearTipoBobinaRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaService = Depends(tipo_bobina_service),
):
    return service.CrearTipo(data, usuario_actual["IdUsuario"])


@TipoBobinaRouter.patch(
    "/editar",
    response_model=TipoBobinaAdminItem,
    status_code=200,
)
def EditarTipoBobina(
    data: EditarTipoBobinaRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaService = Depends(tipo_bobina_service),
):
    return service.EditarTipo(data, usuario_actual["IdUsuario"])


@TipoBobinaRouter.patch(
    "/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoTipoBobina(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoBobinaService = Depends(tipo_bobina_service),
):
    return service.CambiarEstado(data, usuario_actual["IdUsuario"])
