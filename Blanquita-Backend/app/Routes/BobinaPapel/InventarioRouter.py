from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.Config.supabase import get_db

from app.Services.BobinaPapel.InventarioBobinaPapelService import (
    InventarioBobinaPapelService,
)

from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL

from app.Models.BobinaPapel.InventarioBobinaPapel import (
    VerResumenInventarioBobinaPapelResponse,
    VerDetalleInventarioBobinaPapelRequest,
    VerDetalleInventarioBobinaPapelResponse,
    ReingresarBobinaAInventarioRequest,
    ReingresarBobinaAInventarioResponse,
    VerBobinasPapelFueraInventarioResponse,
)


def inventario_bobina_papel_service(
    db: Session = Depends(get_db),
) -> InventarioBobinaPapelService:
    return InventarioBobinaPapelService(db)


InventarioBobinaPapelRouter = APIRouter(
    prefix="/papelbobina/inventario", tags=["Papel Bobina - Inventario"]
)


@InventarioBobinaPapelRouter.get(
    "/resumen",
    response_model=list[VerResumenInventarioBobinaPapelResponse],
    status_code=200,
    dependencies=[
        Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL]))
    ],
)
def VerInventarioBobinaPapel(
    service: InventarioBobinaPapelService = Depends(inventario_bobina_papel_service),
):
    return service.VerResumen()


@InventarioBobinaPapelRouter.get(
    "/detalle/{IdTipoBobina}",
    response_model=list[VerDetalleInventarioBobinaPapelResponse],
    status_code=200,
    dependencies=[
        Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL]))
    ],
)
def VerDetalleInventarioBobinaPapel(
    IdTipoBobina: int,
    service: InventarioBobinaPapelService = Depends(inventario_bobina_papel_service),
):
    return service.VerDetalle(
        VerDetalleInventarioBobinaPapelRequest(IdTipoBobina=IdTipoBobina)
    )


@InventarioBobinaPapelRouter.post(
    "/reingresar",
    response_model=ReingresarBobinaAInventarioResponse,
    status_code=200,
)
def ReingresarInventarioBobinaPapel(
    data: ReingresarBobinaAInventarioRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: InventarioBobinaPapelService = Depends(inventario_bobina_papel_service),
):
    return service.ReingresarBobinaInventario(data, usuario_actual["IdUsuario"])


@InventarioBobinaPapelRouter.get(
    "/fuera",
    response_model=list[VerBobinasPapelFueraInventarioResponse],
    status_code=200,
    dependencies=[Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL]))],
)
def VerBobinasPapelFueraInventario(
    service: InventarioBobinaPapelService = Depends(inventario_bobina_papel_service),
):
    return service.VerBobinasFueraInventario()