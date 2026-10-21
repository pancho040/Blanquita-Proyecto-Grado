from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR
from app.Models.Empaque.BolsaJava import (
    IngresoBolsaJavaRequest,
    IngresoBolsaJavaResponse,
    InventarioBolsaJavaResponse,
    ReingresoBolsaJavaRequest,
    ReingresoBolsaJavaResponse,
    SalidaBolsaJavaRequest,
    SalidaBolsaJavaResponse,
)
from app.Services.Empaque.BolsaJavaService import BolsaJavaService


BolsaJavaRouter = APIRouter(
    prefix="/bolsajava", tags=["Bolsa Jaba - Ingreso - Salida - Inventario"]
)


def bolsa_java_service(db: Session = Depends(get_db)) -> BolsaJavaService:
    return BolsaJavaService(db)


@BolsaJavaRouter.get(
    "/inventario",
    response_model=list[InventarioBolsaJavaResponse],
    status_code=200,
)
def VerInventarioBolsaJava(
    IncluirInactivos: bool = False,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: BolsaJavaService = Depends(bolsa_java_service),
):
    return service.VerInventario(IncluirInactivos)


@BolsaJavaRouter.post(
    "/cargarlote",
    response_model=IngresoBolsaJavaResponse,
    status_code=201,
)
def CargarLoteBolsaJava(
    data: IngresoBolsaJavaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION])),
    service: BolsaJavaService = Depends(bolsa_java_service),
):
    return service.InsertarBolsaJava(data, usuario_actual["IdUsuario"])


@BolsaJavaRouter.post(
    "/salida",
    response_model=SalidaBolsaJavaResponse,
    status_code=201,
)
def SacarBolsaJava(
    data: SalidaBolsaJavaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: BolsaJavaService = Depends(bolsa_java_service),
):
    return service.SacarBolsaJava(data, usuario_actual["IdUsuario"])


@BolsaJavaRouter.post(
    "/reingreso",
    response_model=ReingresoBolsaJavaResponse,
    status_code=201,
)
def ReingresarBolsaJava(
    data: ReingresoBolsaJavaRequest,
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR])),
    service: BolsaJavaService = Depends(bolsa_java_service),
):
    return service.ReingresarBolsaJava(data, usuario_actual["IdUsuario"])
