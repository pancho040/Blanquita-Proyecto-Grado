from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR
from app.Services.Logistica.EnviosService import EnviosService
from app.Models.Logistica.EnvioInventarioModel import (
    EnvioCrearDTO,
    EnvioRecepcionarDTO,
    EnvioResponse,
)

EnvioRouter = APIRouter(prefix="/logistica/envios", tags=["Logística - Envíos y Traslados"])

PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]


@EnvioRouter.get("", response_model=List[EnvioResponse])
def listar_envios(
    estado: Optional[str] = Query(None, description="Filtrar por estado: PENDIENTE, EN_TRANSITO, RECEPCIONADO, ANULADO"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """Consulta la lista de traslados/envíos de inventario entre plantas y sucursales."""
    return EnviosService(db).listar_envios(estado)


@EnvioRouter.get("/{envio_id}", response_model=EnvioResponse)
def obtener_envio(
    envio_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """Obtiene los detalles y mermas de un envío específico."""
    return EnviosService(db).obtener_envio(envio_id)


@EnvioRouter.post("", response_model=EnvioResponse, status_code=status.HTTP_201_CREATED)
def crear_envio(
    dto: EnvioCrearDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """Registra una nueva remisión/guía de traslado en estado PENDIENTE."""
    return EnviosService(db).crear_envio(dto, usuario["IdUsuario"])


@EnvioRouter.post("/{envio_id}/despachar", response_model=EnvioResponse)
def despachar_envio(
    envio_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """
    Despacha el camión (pasa a EN_TRANSITO). Descuenta atómicamente de planta de Fabricio
    o sucursal origen mediante transacción atómica indivisible.
    """
    return EnviosService(db).despachar_envio(envio_id, usuario["IdUsuario"])


@EnvioRouter.post("/{envio_id}/recepcionar", response_model=EnvioResponse)
def recepcionar_envio(
    envio_id: int,
    dto: EnvioRecepcionarDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """
    Recepciona el camión en destino (pasa a RECEPCIONADO). Incrementa stock en sucursal
    y registra mermas si la cantidad recibida es inferior a la enviada.
    """
    return EnviosService(db).recepcionar_envio(envio_id, dto, usuario["IdUsuario"])


@EnvioRouter.post("/{envio_id}/anular", response_model=EnvioResponse)
def anular_envio(
    envio_id: int,
    motivo: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """
    Anula un envío. Si estaba en tránsito, reintegra automáticamente el stock físico
    a la planta Sucre o sucursal correspondiente.
    """
    return EnviosService(db).anular_envio(envio_id, usuario["IdUsuario"], motivo)
