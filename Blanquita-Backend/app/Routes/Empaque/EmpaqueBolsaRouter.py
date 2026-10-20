from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR
from app.Models.Empaque.EmpaqueBolsa import (
    IngresoEmpaqueBolsaRequest,
    IngresoEmpaqueBolsaResponse,
    InventarioEmpaqueBolsaResponse,
    ReingresoEmpaqueBolsaRequest,
    ReingresoEmpaqueBolsaResponse,
    SalidaEmpaqueBolsaRequest,
    SalidaEmpaqueBolsaResponse,
)
from app.Services.Empaque.EmpaqueBolsaService import EmpaqueBolsaService


EmpaqueBolsaRouter = APIRouter(
    prefix="/empaquebolsa", tags=["Empaque Bolsa - Ingreso - Salida - Inventario"]
)


def empaque_bolsa_service(db: Session = Depends(get_db)) -> EmpaqueBolsaService:
    return EmpaqueBolsaService(db)


@EmpaqueBolsaRouter.get(
    "/inventario",
    response_model=list[InventarioEmpaqueBolsaResponse],
    status_code=200,
)
def VerInventarioEmpaqueBolsa(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: EmpaqueBolsaService = Depends(empaque_bolsa_service),
):
    return service.VerInventario()


@EmpaqueBolsaRouter.post(
    "/cargarlote",
    response_model=IngresoEmpaqueBolsaResponse,
    status_code=201,
)
def CargarLoteEmpaque(
    data: IngresoEmpaqueBolsaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: EmpaqueBolsaService = Depends(empaque_bolsa_service),
):
    return service.InsertarEmpaqueBolsa(data, usuario_actual["IdUsuario"])


@EmpaqueBolsaRouter.post(
    "/salida",
    response_model=SalidaEmpaqueBolsaResponse,
    status_code=201,
)
def SacarEmpaqueBolsa(
    data: SalidaEmpaqueBolsaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: EmpaqueBolsaService = Depends(empaque_bolsa_service),
):
    return service.SacarEmpaqueBolsa(data, usuario_actual["IdUsuario"])


@EmpaqueBolsaRouter.post(
    "/reingreso",
    response_model=ReingresoEmpaqueBolsaResponse,
    status_code=201,
)
def ReingresarEmpaqueBolsa(
    data: ReingresoEmpaqueBolsaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: EmpaqueBolsaService = Depends(empaque_bolsa_service),
):
    return service.ReingresarEmpaqueBolsa(data, usuario_actual["IdUsuario"])
