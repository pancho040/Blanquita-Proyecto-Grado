from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user, require_role
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO
from app.Services.Logistica.ClienteService import ClienteService
from app.Models.Logistica.ClienteModel import (
    ClienteCrear, ClienteActualizar, PuntoVentaCrear,
    ClienteResponse, ClienteDetalleResponse
)

ClienteRouter = APIRouter(prefix="/logistica/clientes", tags=["Logística - Clientes"])

# Roles permitidos para gestionar clientes: Supervisor, Gerente, Contador y Chofer en Campo (HU-29)
PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO]

@ClienteRouter.get("", response_model=list[ClienteResponse])
def listar_clientes(
    busqueda: str = Query("", description="Búsqueda por razón social, nombre comercial o NIT/CI"),
    id_estado: Optional[int] = Query(None, description="Filtrar por estado del cliente"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return ClienteService(db).ListarClientes(busqueda, id_estado)

@ClienteRouter.get("/puntos-venta/todos", response_model=list[dict])
def listar_todos_puntos_venta(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    """Devuelve todos los puntos de venta con coordenadas para pintar el mapa general de Sucre."""
    return ClienteService(db).ListarTodosPuntosVentaActivos()

@ClienteRouter.get("/{id_cliente}", response_model=ClienteDetalleResponse)
def obtener_cliente(
    id_cliente: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return ClienteService(db).ObtenerClienteDetalle(id_cliente)

@ClienteRouter.post("", response_model=ClienteDetalleResponse)
def crear_cliente(
    dto: ClienteCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return ClienteService(db).CrearCliente(dto, usuario["IdUsuario"])

@ClienteRouter.put("/{id_cliente}", response_model=ClienteDetalleResponse)
def actualizar_cliente(
    id_cliente: int,
    dto: ClienteActualizar,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return ClienteService(db).ActualizarCliente(id_cliente, dto)

@ClienteRouter.post("/{id_cliente}/puntos-venta")
def agregar_punto_venta(
    id_cliente: int,
    dto: PuntoVentaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA))
):
    return ClienteService(db).AgregarPuntoVenta(id_cliente, dto)
