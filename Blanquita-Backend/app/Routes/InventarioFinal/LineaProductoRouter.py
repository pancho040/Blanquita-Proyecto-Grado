from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db
from app.Config.supabase import get_db
from app.Models.InventarioFinal.LineaProducto import (
    CrearLineaProductoRequest,
    CrearPresentacionRequest,
    EditarLineaProductoRequest,
    LineaProductoAdminItem,
    TiposOrigenResponse,
)
from app.Models.MateriaPrima.TipoMateriaPrima import (
    CambiarEstadoTipoRequest,
    CambiarEstadoTipoResponse,
)
from app.Services.InventarioFinal.LineaProductoService import LineaProductoService


def linea_producto_service(db: Session = Depends(get_db)) -> LineaProductoService:
    return LineaProductoService(db)


LineaProductoRouter = APIRouter(prefix="/producto", tags=["Producto - Líneas y presentaciones (Admin)"])


@LineaProductoRouter.get(
    "/linea/listar",
    response_model=list[LineaProductoAdminItem],
    status_code=200,
)
def ListarLineasProducto(
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.ListarLineas()


@LineaProductoRouter.get(
    "/linea/detalle/{IdProducto}",
    response_model=LineaProductoAdminItem,
    status_code=200,
)
def DetalleLineaProducto(
    IdProducto: int = Path(..., gt=0),
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.ObtenerLinea(IdProducto)


@LineaProductoRouter.get(
    "/linea/tipos",
    response_model=TiposOrigenResponse,
    status_code=200,
)
def TiposOrigenLineaProducto(
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.TiposOrigen()


@LineaProductoRouter.post(
    "/linea/crear",
    response_model=LineaProductoAdminItem,
    status_code=201,
)
def CrearLineaProducto(
    data: CrearLineaProductoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.CrearLinea(data, usuario_actual["IdUsuario"])


@LineaProductoRouter.patch(
    "/linea/editar",
    response_model=LineaProductoAdminItem,
    status_code=200,
)
def EditarLineaProducto(
    data: EditarLineaProductoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.EditarLinea(data, usuario_actual["IdUsuario"])


@LineaProductoRouter.patch(
    "/linea/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoLineaProducto(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.CambiarEstadoLinea(data, usuario_actual["IdUsuario"])


@LineaProductoRouter.post(
    "/presentacion/crear",
    response_model=LineaProductoAdminItem,
    status_code=201,
)
def CrearPresentacionProducto(
    data: CrearPresentacionRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.CrearPresentacion(data, usuario_actual["IdUsuario"])


@LineaProductoRouter.patch(
    "/presentacion/estado",
    response_model=CambiarEstadoTipoResponse,
    status_code=200,
)
def CambiarEstadoPresentacionProducto(
    data: CambiarEstadoTipoRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: LineaProductoService = Depends(linea_producto_service),
):
    return service.CambiarEstadoPresentacion(data, usuario_actual["IdUsuario"])
