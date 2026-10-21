from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db, require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Models.Insumo.Insumo import (
    CatalogoInsumoResponse,
    CrearInsumoRequest,
    EditarInsumoRequest,
    InsumoResponse,
    ListarInsumosRequest,
    ListarInsumosResponse,
    MovimientoInsumoRequest,
    MovimientoInsumoResponse,
)
from app.Services.Insumo.Insumo import InsumoService


def insumo_service(db: Session = Depends(get_db)) -> InsumoService:
    return InsumoService(db)


InsumoRouter = APIRouter(prefix="/insumo", tags=["Insumo - Ingreso - Salida - Inventario"])


@InsumoRouter.get(
    "/inventario",
    response_model=list[CatalogoInsumoResponse],
    status_code=200,
)
def VerCatalogoInsumo(
    IncluirInactivos: bool = False,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: InsumoService = Depends(insumo_service),
):
    return service.VerCatalogoInsumo(IncluirInactivos)


@InsumoRouter.post(
    "/ingreso",
    response_model=MovimientoInsumoResponse,
    status_code=201,
)
def IngresarInsumo(
    data: MovimientoInsumoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: InsumoService = Depends(insumo_service),
):
    return service.IngresarInsumo(data, usuario_actual["IdUsuario"])


@InsumoRouter.post(
    "/salida",
    response_model=MovimientoInsumoResponse,
    status_code=201,
)
def SacarInsumo(
    data: MovimientoInsumoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: InsumoService = Depends(insumo_service),
):
    return service.SacarInsumo(data, usuario_actual["IdUsuario"])


@InsumoRouter.get(
    "/listar",
    response_model=ListarInsumosResponse,
    status_code=200,
)
def ListarInsumos(
    Activo: bool | None = None,
    Busqueda: str | None = Query(default=None, max_length=50),
    Pagina: int = Query(default=1, ge=1),
    TamanoPagina: int = Query(default=20, ge=1, le=100),
    usuario_actual: dict = Depends(require_admin_db),
    service: InsumoService = Depends(insumo_service),
):
    return service.ListarInsumos(
        ListarInsumosRequest(
            Activo=Activo,
            Busqueda=Busqueda,
            Pagina=Pagina,
            TamanoPagina=TamanoPagina,
        )
    )


@InsumoRouter.get(
    "/detalle/{IdTipoInsumo}",
    response_model=InsumoResponse,
    status_code=200,
)
def ObtenerInsumo(
    IdTipoInsumo: int = Path(..., gt=0),
    usuario_actual: dict = Depends(require_admin_db),
    service: InsumoService = Depends(insumo_service),
):
    return service.ObtenerInsumo(IdTipoInsumo)


@InsumoRouter.post(
    "/crear",
    response_model=InsumoResponse,
    status_code=201,
)
def CrearInsumo(
    data: CrearInsumoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: InsumoService = Depends(insumo_service),
):
    return service.CrearInsumo(data, usuario_actual["IdUsuario"])


@InsumoRouter.patch(
    "/editar",
    response_model=InsumoResponse,
    status_code=200,
)
def EditarInsumo(
    data: EditarInsumoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: InsumoService = Depends(insumo_service),
):
    return service.EditarInsumo(data, usuario_actual["IdUsuario"])


@InsumoRouter.patch(
    "/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoInsumo(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: InsumoService = Depends(insumo_service),
):
    return service.CambiarEstado(data, usuario_actual["IdUsuario"])
