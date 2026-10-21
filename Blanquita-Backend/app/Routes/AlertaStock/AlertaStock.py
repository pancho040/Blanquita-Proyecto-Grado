from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.Auth.Dependencies import require_admin_db, require_role
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL
from app.Models.AlertaStock.AlertaStock import (
    EditarUmbralStockRequest,
    ResumenAlertaStockResponse,
    UmbralStockItem,
)
from app.Services.AlertaStock.AlertaStock import AlertaStockService


def alerta_stock_service(db: Session = Depends(get_db)) -> AlertaStockService:
    return AlertaStockService(db)


AlertaStockRouter = APIRouter(prefix="/alertastock", tags=["Alertas de stock"])


@AlertaStockRouter.get(
    "/resumen",
    response_model=ResumenAlertaStockResponse,
    status_code=200,
)
def VerAlertasStock(
    usuario_actual: dict = Depends(require_role([ROL_LIDER_INVENTARIO_PRODUCCION, ROL_OPERADOR, ROL_GERENTE_GENERAL])),
    service: AlertaStockService = Depends(alerta_stock_service),
):
    return service.VerAlertas()


@AlertaStockRouter.get(
    "/umbrales",
    response_model=list[UmbralStockItem],
    status_code=200,
)
def ListarUmbralesStock(
    Dominio: str | None = Query(default=None, max_length=30),
    usuario_actual: dict = Depends(require_admin_db),
    service: AlertaStockService = Depends(alerta_stock_service),
):
    return service.ListarUmbrales(Dominio)


@AlertaStockRouter.patch(
    "/umbral",
    response_model=UmbralStockItem,
    status_code=200,
)
def EditarUmbralStock(
    data: EditarUmbralStockRequest,
    usuario_actual: dict = Depends(require_admin_db),
    service: AlertaStockService = Depends(alerta_stock_service),
):
    return service.EditarUmbral(data, usuario_actual["IdUsuario"])
