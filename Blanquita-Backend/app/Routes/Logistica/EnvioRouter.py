from typing import List, Optional, Any
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR
from app.Services.Logistica.EnviosService import EnviosService
from app.Models.Logistica.EnvioInventarioModel import (
    EnvioCrearDTO,
    EnvioRecepcionarDTO,
    EnvioResponse,
)

EnvioRouter = APIRouter(prefix="/logistica/envios", tags=["Logística - Envíos y Traslados"])

PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]


def _es_envio_visible_para_sucursal(e: Any, id_sucursal: int) -> bool:
    orig_tipo = e.get("origen_tipo") if isinstance(e, dict) else getattr(e, "origen_tipo", None)
    orig_id = e.get("origen_id") if isinstance(e, dict) else getattr(e, "origen_id", None)
    dest_tipo = e.get("destino_tipo") if isinstance(e, dict) else getattr(e, "destino_tipo", None)
    dest_id = e.get("destino_id") if isinstance(e, dict) else getattr(e, "destino_id", None)

    if orig_tipo == "SUCURSAL" and orig_id == id_sucursal:
        return True
    if dest_tipo == "SUCURSAL" and dest_id == id_sucursal:
        return True
    return False


def _verificar_acceso_envio(e: Any, alcance: AlcanceUsuario) -> bool:
    if alcance.puede_ver_todas:
        return True
    return any(_es_envio_visible_para_sucursal(e, s_id) for s_id in alcance.sucursales_permitidas)


@EnvioRouter.get("", response_model=List[EnvioResponse])
def listar_envios(
    estado: Optional[str] = Query(None, description="Filtrar por estado: PENDIENTE, EN_TRANSITO, RECEPCIONADO, ANULADO"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Consulta la lista de traslados/envíos de inventario entre plantas y sucursales."""
    envios = EnviosService(db).listar_envios(estado)
    if alcance.sucursal_efectiva is not None:
        envios = [e for e in envios if _es_envio_visible_para_sucursal(e, alcance.sucursal_efectiva)]
    elif not alcance.puede_ver_todas:
        envios = [e for e in envios if _verificar_acceso_envio(e, alcance)]
    return envios


@EnvioRouter.get("/{envio_id}", response_model=EnvioResponse)
def obtener_envio(
    envio_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Obtiene los detalles y mermas de un envío específico con validación IDOR 404."""
    e = EnviosService(db).obtener_envio(envio_id)
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")
    if not _verificar_acceso_envio(e, alcance):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")
    return e


@EnvioRouter.post("", response_model=EnvioResponse, status_code=status.HTTP_201_CREATED)
def crear_envio(
    dto: EnvioCrearDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Registra una nueva remisión/guía de traslado en estado PENDIENTE validando sede origen."""
    if dto.origen_tipo == "SUCURSAL":
        dto.origen_id = alcance.validar_escritura(dto.origen_id)
    elif not alcance.puede_ver_todas:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo usuarios corporativos o administradores pueden iniciar envíos desde Planta."
        )
    return EnviosService(db).crear_envio(dto, usuario["IdUsuario"])


@EnvioRouter.post("/{envio_id}/despachar", response_model=EnvioResponse)
def despachar_envio(
    envio_id: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Despacha el camión (pasa a EN_TRANSITO). Descuenta atómicamente de inventario de planta
    o sucursal origen mediante transacción atómica indivisible.
    """
    e = EnviosService(db).obtener_envio(envio_id)
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")
    
    orig_tipo = e.get("origen_tipo") if isinstance(e, dict) else getattr(e, "origen_tipo", None)
    orig_id = e.get("origen_id") if isinstance(e, dict) else getattr(e, "origen_id", None)
    
    if not alcance.puede_ver_todas:
        if orig_tipo == "SUCURSAL" and orig_id not in alcance.sucursales_permitidas:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")
        elif orig_tipo == "PLANTA":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para despachar envíos de Planta.")

    return EnviosService(db).despachar_envio(envio_id, usuario["IdUsuario"])


@EnvioRouter.post("/{envio_id}/recepcionar", response_model=EnvioResponse)
def recepcionar_envio(
    envio_id: int,
    dto: EnvioRecepcionarDTO,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Recepciona el camión en destino (pasa a RECEPCIONADO). Incrementa stock en sucursal
    y registra mermas si la cantidad recibida es inferior a la enviada.
    """
    e = EnviosService(db).obtener_envio(envio_id)
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")
    
    dest_tipo = e.get("destino_tipo") if isinstance(e, dict) else getattr(e, "destino_tipo", None)
    dest_id = e.get("destino_id") if isinstance(e, dict) else getattr(e, "destino_id", None)

    if not alcance.puede_ver_todas:
        if dest_tipo == "SUCURSAL" and dest_id not in alcance.sucursales_permitidas:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")

    return EnviosService(db).recepcionar_envio(envio_id, dto, usuario["IdUsuario"])


@EnvioRouter.post("/{envio_id}/anular", response_model=EnvioResponse)
def anular_envio(
    envio_id: int,
    motivo: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Anula un envío. Si estaba en tránsito, reintegra automáticamente el stock físico
    a la planta Sucre o sucursal correspondiente.
    """
    e = EnviosService(db).obtener_envio(envio_id)
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")
    if not _verificar_acceso_envio(e, alcance):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Envío no encontrado")
    return EnviosService(db).anular_envio(envio_id, usuario["IdUsuario"], motivo)
