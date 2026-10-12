from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.Config.supabase import get_db

from app.Services.InventarioFinal.ProductoFinal import ProductoFinalService
from app.Models.InventarioFinal.ProductoFinal import(
      IngresoProductoTerminadoRequest,
      IngresoProductoTerminadoResponse,
      SalidaProductoTerminadoRequest,
      SalidaProductoTerminadoResponse,
      CorreccionProductoTerminadoRequest,
      CorreccionProductoTerminadoResponse,
      VerInventarioProductoTerminadoResponse,
      VerInventarioProductoTerminadoRequest,
      ProductoResponse
)

from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR


def producto_terminado_service(db: Session = Depends(get_db)) -> ProductoFinalService:
    return ProductoFinalService(db)


ProductoFinalRouter = APIRouter(
    prefix="/productofinal", tags=["Inventario - Producto Terminado"]
)


@ProductoFinalRouter.post(
    "/insertar",
    response_model=list[IngresoProductoTerminadoResponse],
    status_code=201
)
def InsertarIngresoProductoTerminado(
    data: IngresoProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.InsertarIngresoProductoTerminado(data, usuario_actual["IdUsuario"])

@ProductoFinalRouter.post(
    "/salida",
    response_model=SalidaProductoTerminadoResponse,
    status_code=201
)
def InsertarSalidaInventario(
    data: SalidaProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.InsertarSalidaProductoTerminado(data, usuario_actual["IdUsuario"])

@ProductoFinalRouter.post(
    "/ajuste/positivo",
    response_model=CorreccionProductoTerminadoResponse,
    status_code=201
)
def AjustePositivoInventarioProductoTerminado(
    data: CorreccionProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.AjustePositivoInventarioProductoTerminado(data, usuario_actual["IdUsuario"])


@ProductoFinalRouter.post(
    "/ajuste/negativo",
    response_model=CorreccionProductoTerminadoResponse,
    status_code=201
)
def AjusteNegativoInventarioProductoTerminado(
    data: CorreccionProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.AjusteNegativoInventarioProductoTerminado(data, usuario_actual["IdUsuario"])

@ProductoFinalRouter.post(
    "/correccion",
    response_model=CorreccionProductoTerminadoResponse,
    status_code=201
)
def CorregirInventarioProductoTerminado(
    data: CorreccionProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.CorregirInventarioProductoTerminado(data, usuario_actual["IdUsuario"])

@ProductoFinalRouter.post(
    "/aumento",
    response_model=CorreccionProductoTerminadoResponse,
    status_code=201
)
def AumentarInventarioProductoTerminado(
    data: CorreccionProductoTerminadoRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.AumentarInventarioProductoTerminado(data, usuario_actual["IdUsuario"])

@ProductoFinalRouter.get(
    "/inventario/ver",
    response_model=list[VerInventarioProductoTerminadoResponse],
    status_code=200
)
def VerInventarioProductoTerminado(
    IdProducto: int | None = None,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.VerInventarioProductoTerminado(IdProducto)

@ProductoFinalRouter.get(
    "/obtenerproductos",
    response_model=list[ProductoResponse],
    status_code=200
)
def ObtenerProductos(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: ProductoFinalService = Depends(producto_terminado_service)
):
    return service.ObtenerProductos()