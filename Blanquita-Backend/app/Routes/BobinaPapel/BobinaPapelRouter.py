from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.Config.supabase import get_db

from app.Services.BobinaPapel.BobinaPapelService import BobinaPapelService

from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR

from typing import List
from app.Models.BobinaPapel.BobinaPapel import (
    IngresoModelo,
    IngresoLoteBobinaPapelResponse,
    TipoBobinaPapelIngreso,
    EditarBobinaPapelRequest,
    EditarBobinaPapelResponse,
)


def bobina_papel_service(db: Session = Depends(get_db)) -> BobinaPapelService:
    return BobinaPapelService(db)


BobinaPapelRouter = APIRouter(
    prefix="/bobinapapel", tags=["Bobina Papel - CRUD e Ingreso"]
)


@BobinaPapelRouter.post(
    "/cargarlote",
    response_model=IngresoLoteBobinaPapelResponse,
    status_code=201,
)
def CargarLoteBobinaPapel(
    data: IngresoModelo,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: BobinaPapelService = Depends(bobina_papel_service),
):
    return service.InsertarBobinasPapel(data, usuario_actual["IdUsuario"])

@BobinaPapelRouter.get(
    "/obtenertipos",
    response_model=List[TipoBobinaPapelIngreso],
    status_code=200,
)
def ObtenerTiposBobina(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: BobinaPapelService = Depends(bobina_papel_service),
):
    return service.ObtenerTiposBobinaPapel()

@BobinaPapelRouter.patch(
    "/editar",
    response_model=EditarBobinaPapelResponse,
    status_code=200,
)
def EditarBobinaPapel(
    data: EditarBobinaPapelRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: BobinaPapelService = Depends(bobina_papel_service),
):
    return service.EditarBobinaPapel(data, usuario_actual["IdUsuario"])