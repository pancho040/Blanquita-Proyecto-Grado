from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION
from app.Models.InventarioFinal.Inicio import (
    InicioInventarioProductoTerminadoResponse,
    InicioProduccionProductoTerminadoResponse,
    InicioSalidasProductoTerminadoResponse,
)
from app.Services.InventarioFinal.Inicio import InicioProductoTerminadoService


def inicio_producto_terminado_service(db: Session = Depends(get_db)) -> InicioProductoTerminadoService:
    return InicioProductoTerminadoService(db)


InicioProductoTerminadoRouter = APIRouter(
    prefix="/productofinal/inicio",
    tags=["Producto Terminado - Inicio"],
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION]))],
)


@InicioProductoTerminadoRouter.get(
    "/inventario/resumen",
    response_model=InicioInventarioProductoTerminadoResponse,
    status_code=200,
)
def VerInicioInventarioProductoTerminado(
    service: InicioProductoTerminadoService = Depends(inicio_producto_terminado_service),
):
    return service.VerInventario()


@InicioProductoTerminadoRouter.get(
    "/produccion/resumen",
    response_model=InicioProduccionProductoTerminadoResponse,
    status_code=200,
)
def VerInicioProduccionProductoTerminado(
    service: InicioProductoTerminadoService = Depends(inicio_producto_terminado_service),
):
    return service.VerProduccion()


@InicioProductoTerminadoRouter.get(
    "/salidas/resumen",
    response_model=InicioSalidasProductoTerminadoResponse,
    status_code=200,
)
def VerInicioSalidasProductoTerminado(
    service: InicioProductoTerminadoService = Depends(inicio_producto_terminado_service),
):
    return service.VerSalidas()
