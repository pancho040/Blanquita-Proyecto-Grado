from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.Config.supabase import get_db


from app.Services.Rodela.InventarioRodelaService import InventarioRodelaService


from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL


from app.Models.Rodela.InventarioRodela import (
    ResumenInventarioRodelaResponse,
    DetalleInventarioRodelaRequest,
    DetalleInventarioRodelaResponse,
    RodelaEnAlmacenResponse,
    TrasladarRodelaRequest,
    TrasladarRodelaResponse,
    CorregirTrasladoRodelaRequest,
    CorregirTrasladoRodelaResponse,
    DeshacerTrasladoRodelaRequest,
    DeshacerTrasladoRodelaResponse,
    EditarRodelaRequest,
    EditarRodelaResponse,
    RodelaReingresableResponse,
)


def inventario_rodela_service(db: Session = Depends(get_db)) -> InventarioRodelaService:
    return InventarioRodelaService(db)

InventarioRodelaRouter = APIRouter(
    prefix="/rodela/inventario", tags=["Rodela - Inventario"]
)


@InventarioRodelaRouter.get(
    "/resumen",
    response_model=list[ResumenInventarioRodelaResponse],
    status_code=200
)
def VerResumenInventarioRodela(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    return service.VerResumenInventarioRodela()


@InventarioRodelaRouter.get(
    "/detalle",
    response_model=list[DetalleInventarioRodelaResponse],
    status_code=200
)
def VerDetalleInventarioRodela(
    IdTipoRodela: int,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    data = DetalleInventarioRodelaRequest(IdTipoRodela=IdTipoRodela)
    return service.VerDetalleInventarioRodela(data)


@InventarioRodelaRouter.get(
    "/enalmacen",
    response_model=list[RodelaEnAlmacenResponse],
    status_code=200
)
def ListarRodelasEnAlmacen(
    IdTipoRodela: int,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    return service.ListarRodelasEnAlmacen(IdTipoRodela)


@InventarioRodelaRouter.post(
    "/trasladar",
    response_model=TrasladarRodelaResponse,
    status_code=200
)
def TrasladarRodelaAProduccion(
    data: TrasladarRodelaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    return service.TrasladarRodelaAProduccion(data, usuario_actual["IdUsuario"])


@InventarioRodelaRouter.post(
    "/corregir",
    response_model=CorregirTrasladoRodelaResponse,
    status_code=200
)
def CorregirTrasladoRodela(
    data: CorregirTrasladoRodelaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    return service.CorregirTrasladoRodela(data, usuario_actual["IdUsuario"])


@InventarioRodelaRouter.get(
    "/reingresables",
    response_model=list[RodelaReingresableResponse],
    status_code=200
)
def ListarRodelasReingresables(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    return service.ListarRodelasReingresables()


@InventarioRodelaRouter.post(
    "/deshacer",
    response_model=DeshacerTrasladoRodelaResponse,
    status_code=200
)
def DeshacerTrasladoRodela(
    data: DeshacerTrasladoRodelaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    return service.DeshacerTrasladoRodela(data, usuario_actual["IdUsuario"])


@InventarioRodelaRouter.post(
    "/editar",
    response_model=EditarRodelaResponse,
    status_code=200
)
def EditarRodela(
    data: EditarRodelaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: InventarioRodelaService = Depends(inventario_rodela_service)
):
    return service.EditarRodela(data, usuario_actual["IdUsuario"])
