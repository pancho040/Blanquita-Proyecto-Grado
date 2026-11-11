from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO
from app.Services.Logistica.ClienteService import ClienteService
from app.Models.Logistica.ClienteModel import (
    ClienteCrear, ClienteActualizar, PuntoVentaCrear,
    ClienteResponse, ClienteDetalleResponse
)

ClienteRouter = APIRouter(prefix="/logistica/clientes", tags=["Logística - Clientes"])

# Roles permitidos para gestionar clientes: Supervisor, Gerente, Contador y Chofer en Campo
PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO]

@ClienteRouter.get("", response_model=list[ClienteResponse])
def listar_clientes(
    busqueda: str = Query("", description="Búsqueda por razón social, nombre comercial o NIT/CI"),
    id_estado: Optional[int] = Query(None, description="Filtrar por estado del cliente"),
    limit: Optional[int] = Query(None, description="Límite de registros para paginación"),
    offset: Optional[int] = Query(None, description="Desplazamiento para paginación"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return ClienteService(db).ListarClientes(busqueda, id_estado, limit, offset, alcance.sucursal_efectiva)

@ClienteRouter.get("/simple", response_model=list[dict])
def listar_clientes_simple(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Devuelve listado ligero de clientes para selectores rápidos sin sobrecarga."""
    clientes = ClienteService(db).ListarClientes(busqueda="", limit=200, offset=0, id_sucursal=alcance.sucursal_efectiva)
    return [{"IdCliente": c["IdCliente"], "RazonSocial": c["RazonSocial"], "NIT": c.get("NIT", "")} for c in clientes]

@ClienteRouter.get("/puntos-venta/todos", response_model=list[dict])
def listar_todos_puntos_venta(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """Devuelve todos los puntos de venta con coordenadas para pintar el mapa general filtrado por sucursal."""
    return ClienteService(db).ListarTodosPuntosVentaActivos(id_sucursal=alcance.sucursal_efectiva)

@ClienteRouter.get("/{id_cliente}", response_model=ClienteDetalleResponse)
def obtener_cliente(
    id_cliente: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    c = ClienteService(db).ObtenerClienteDetalle(id_cliente)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    alcance.validar_recurso(c.get("IdSucursal"), nombre_recurso="cliente", responder_404=True)
    return c

@ClienteRouter.post("", response_model=ClienteDetalleResponse)
def crear_cliente(
    dto: ClienteCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    # Regla de Oro / Decisión: Una sola sucursal por cliente con fallo cerrado
    sid = alcance.validar_escritura(dto.IdSucursal)
    dto.IdSucursal = sid
    return ClienteService(db).CrearCliente(dto, usuario["IdUsuario"])

@ClienteRouter.put("/{id_cliente}", response_model=ClienteDetalleResponse)
def actualizar_cliente(
    id_cliente: int,
    dto: ClienteActualizar,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    c = ClienteService(db).ObtenerClienteDetalle(id_cliente)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    alcance.validar_recurso(c.get("IdSucursal"), nombre_recurso="cliente", responder_404=True)
    if dto.IdSucursal is not None:
        dto.IdSucursal = alcance.validar_escritura(dto.IdSucursal)
    return ClienteService(db).ActualizarCliente(id_cliente, dto)

@ClienteRouter.post("/{id_cliente}/puntos-venta")
def agregar_punto_venta(
    id_cliente: int,
    dto: PuntoVentaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    c = ClienteService(db).ObtenerClienteDetalle(id_cliente)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    alcance.validar_recurso(c.get("IdSucursal"), nombre_recurso="cliente", responder_404=True)
    return ClienteService(db).AgregarPuntoVenta(id_cliente, dto)
