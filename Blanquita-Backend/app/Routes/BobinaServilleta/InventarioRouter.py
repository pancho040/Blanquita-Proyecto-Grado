from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.Config.supabase import get_db

from app.Services.BobinaServilleta.InventarioBobinaServilletaService import InventarioBobinaServilletaService

from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL

from app.Models.BobinaServilleta.InventarioBobinaServilleta import(
    ReingresarSubBobinaInventarioRequest,
    ReingresarSubBobinaInventarioResponse,
    ResumenInventarioBobinaServilletaResponse,
    DetalleInventarioBobinaServilletaRequest,
    DetalleInventarioBobinaServilletaResponse,
    ResumenInventarioSubBobinaServilletaResponse,
    DetalleInventarioSubBobinaServilletaRequest,
    DetalleInventarioSubBobinaServilletaResponse,
    SubBobinaServilletaFueraInventarioResponse,
    EditarBobinaServilletaRequest,
    EditarBobinaServilletaResponse
)


InventarioBobinaServilletaRouter = APIRouter(
    prefix="/bobinaservilleta/inventario", tags=["Bobina Servilleta - Inventario"]
)


def inventario_bobina_servilleta_service(db: Session = Depends(get_db)) -> InventarioBobinaServilletaService:
    return InventarioBobinaServilletaService(db)


@InventarioBobinaServilletaRouter.post(
    "/reingresar",
    response_model=ReingresarSubBobinaInventarioResponse,
    status_code=200
)
def ReingresarSubBobina(
    data: ReingresarSubBobinaInventarioRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: InventarioBobinaServilletaService = Depends(inventario_bobina_servilleta_service)
):
    return service.ReingresarSubBobinaAInventario(data, usuario_actual["IdUsuario"])

@InventarioBobinaServilletaRouter.get(
    "/resumen",
    response_model=list[ResumenInventarioBobinaServilletaResponse],
    status_code=200
)
def VerResumenInventario(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioBobinaServilletaService = Depends(inventario_bobina_servilleta_service)
):
    return service.VerResumenInventarioBobinaServilleta()

@InventarioBobinaServilletaRouter.get(
    "/detalle",
    response_model=list[DetalleInventarioBobinaServilletaResponse],
    status_code=200
)
def VerDetalleBobinaServilleta(
    IdTipoBobinaServilleta: int,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioBobinaServilletaService = Depends(inventario_bobina_servilleta_service)
):
    data = DetalleInventarioBobinaServilletaRequest(IdTipoBobinaServilleta=IdTipoBobinaServilleta)
    return service.VerDetalleInventarioBobinaServilleta(data)

@InventarioBobinaServilletaRouter.get(
    "/sub/resumen",
    response_model=list[ResumenInventarioSubBobinaServilletaResponse],
    status_code=200
)
def VerResumenInventarioSubBobina(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioBobinaServilletaService = Depends(inventario_bobina_servilleta_service)
):
    return service.VerResumenInventarioSubBobinaServilleta()

@InventarioBobinaServilletaRouter.get(
    "/sub/detalle",
    response_model=list[DetalleInventarioSubBobinaServilletaResponse],
    status_code=200
)
def VerDetalleSubBobina(
    IdTipoMedidaSubBobina: int,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioBobinaServilletaService = Depends(inventario_bobina_servilleta_service)
):
    data = DetalleInventarioSubBobinaServilletaRequest(IdTipoMedidaSubBobina=IdTipoMedidaSubBobina)
    return service.VerDetalleInventarioSubBobinaServilleta(data)

@InventarioBobinaServilletaRouter.get(
    "/sub/fuera",
    response_model=list[SubBobinaServilletaFueraInventarioResponse],
    status_code=200
)
def VerSubBobinaFueraInventario(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_GERENTE_GENERAL])),
    service: InventarioBobinaServilletaService = Depends(inventario_bobina_servilleta_service)
):
    return service.VerSubBobinasServilletaFueraInventario()

@InventarioBobinaServilletaRouter.post(
    "/editar",
    response_model=list[EditarBobinaServilletaResponse],
    status_code=200
)
def EditarBobinaServilleta(
    data: EditarBobinaServilletaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: InventarioBobinaServilletaService = Depends(inventario_bobina_servilleta_service)
):
    return service.EditarBobinaServilleta(data, usuario_actual["IdUsuario"])
