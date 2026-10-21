from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db
from app.Config.supabase import get_db
from app.Models.Empaque.Reporte import ClaseEmpaque
from app.Models.Empaque.TipoEmpaque import (
    CrearTipoEmpaqueRequest,
    EditarTipoEmpaqueRequest,
    TipoEmpaqueAdminItem,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Services.Empaque.TipoEmpaqueService import TipoEmpaqueService


def tipo_empaque_service(clase: ClaseEmpaque, db: Session = Depends(get_db)) -> TipoEmpaqueService:
    return TipoEmpaqueService(db, clase)


TipoEmpaqueRouter = APIRouter(prefix="/empaque/tipo", tags=["Empaque - Tipos (Admin)"])


@TipoEmpaqueRouter.get(
    "/{clase}/listar",
    response_model=list[TipoEmpaqueAdminItem],
    status_code=200,
)
def ListarTiposEmpaque(
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoEmpaqueService = Depends(tipo_empaque_service),
):
    return service.ListarTipos()


@TipoEmpaqueRouter.get(
    "/{clase}/detalle/{Id}",
    response_model=TipoEmpaqueAdminItem,
    status_code=200,
)
def ObtenerTipoEmpaque(
    Id: int = Path(..., gt=0),
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoEmpaqueService = Depends(tipo_empaque_service),
):
    return service.ObtenerTipo(Id)


@TipoEmpaqueRouter.post(
    "/{clase}/crear",
    response_model=TipoEmpaqueAdminItem,
    status_code=201,
)
def CrearTipoEmpaque(
    data: CrearTipoEmpaqueRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoEmpaqueService = Depends(tipo_empaque_service),
):
    return service.CrearTipo(data, usuario_actual["IdUsuario"])


@TipoEmpaqueRouter.patch(
    "/{clase}/editar",
    response_model=TipoEmpaqueAdminItem,
    status_code=200,
)
def EditarTipoEmpaque(
    data: EditarTipoEmpaqueRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoEmpaqueService = Depends(tipo_empaque_service),
):
    return service.EditarTipo(data, usuario_actual["IdUsuario"])


@TipoEmpaqueRouter.patch(
    "/{clase}/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoTipoEmpaque(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: TipoEmpaqueService = Depends(tipo_empaque_service),
):
    return service.CambiarEstado(data, usuario_actual["IdUsuario"])
