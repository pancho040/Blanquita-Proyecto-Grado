from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Constants.Roles import ROL_CONTADOR, ROL_GERENTE_GENERAL, ROL_SUPERVISOR, ROL_DISTRIBUIDOR
from app.Services.Distribuidor.DistribuidorService import DistribuidorService
from app.Models.Distribuidor.DistribuidorModel import (
    DistribuidorResponse, PedidoDistribuidorCrear, PedidoDistribuidorResponse,
    AjustePedidoKevinRequest, SubirBoletaPagoRequest
)

DistribuidorRouter = APIRouter(prefix="/distribuidores", tags=["Distribuidores Mayoristas"])

PERMISOS_INTERNOS = [ROL_CONTADOR, ROL_GERENTE_GENERAL, ROL_SUPERVISOR]
PERMISOS_PORTAL = [ROL_CONTADOR, ROL_GERENTE_GENERAL, ROL_SUPERVISOR, ROL_DISTRIBUIDOR]

@DistribuidorRouter.get("/catalogo-stock")
def consultar_catalogo_stock_disponible(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_PORTAL))
):
    """Consulta de solo lectura sobre el stock real de producto terminado disponible en planta."""
    return DistribuidorService(db).ConsultarStockDisponibleMayorista()

@DistribuidorRouter.get("", response_model=List[DistribuidorResponse])
def listar_distribuidores(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_INTERNOS))
):
    return DistribuidorService(db).ListarDistribuidores(activo)

@DistribuidorRouter.get("/pedidos")
def listar_pedidos_distribuidores(
    distribuidor_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_PORTAL))
):
    # Si el usuario es un distribuidor externo, solo ve sus propios pedidos
    if usuario.get("IdRol") == ROL_DISTRIBUIDOR:
        dist = DistribuidorService(db).repo.ObtenerDistribuidorPorUsuarioId(usuario["IdUsuario"])
        if dist:
            distribuidor_id = dist["id"]

    return DistribuidorService(db).ListarPedidos(distribuidor_id, estado)

@DistribuidorRouter.get("/pedidos/{pedido_id}")
def obtener_pedido_detalle(
    pedido_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_PORTAL))
):
    return DistribuidorService(db).ObtenerPedidoDetalle(pedido_id)

@DistribuidorRouter.post("/pedidos")
def crear_pedido_distribuidor(
    dto: PedidoDistribuidorCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_PORTAL))
):
    """Crea un pedido mayorista con validación obligatoria contra existencias reales en planta."""
    return DistribuidorService(db).CrearPedidoDistribuidor(dto, usuario["IdUsuario"])

@DistribuidorRouter.put("/pedidos/{pedido_id}/ajuste-kevin")
def ajustar_pedido_kevin(
    pedido_id: int,
    dto: AjustePedidoKevinRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_INTERNOS))
):
    """Kevin revisa y ajusta cantidades pactadas en la proforma."""
    return DistribuidorService(db).AjustarPedidoKevin(pedido_id, dto, usuario["IdUsuario"])

@DistribuidorRouter.post("/pedidos/{pedido_id}/comprobante")
def subir_boleta_deposito(
    pedido_id: int,
    dto: SubirBoletaPagoRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_PORTAL))
):
    """El distribuidor adjunta la boleta de pago o transferencia bancaria."""
    return DistribuidorService(db).AdjuntarBoletaPagoDistribuidor(pedido_id, dto, usuario["IdUsuario"])

@DistribuidorRouter.put("/pedidos/{pedido_id}/aprobar-despacho")
def aprobar_despacho_kevin(
    pedido_id: int,
    dto: dict = {},
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_INTERNOS))
):
    """Kevin confirma el depósito bancario y autoriza el despacho mayorista."""
    obs = dto.get("observacion")
    return DistribuidorService(db).AprobarDespachoKevin(pedido_id, usuario["IdUsuario"], obs)
