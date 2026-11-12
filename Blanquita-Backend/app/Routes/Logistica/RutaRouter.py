from datetime import date, datetime, timezone
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

from app.Config.supabase import get_db, SessionLocal
from app.Auth.Dependencies import require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO
from app.Services.Logistica.RutaService import RutaService
from app.Services.Logistica.FlotaWebSocketManager import flota_ws_manager
from app.Models.Logistica.RutaModel import (
    ZonaCrear, ZonaResponse, RutaCrear, RutaActualizar, RutaResponse,
    GuardarPuntosVentaRuta, AsignacionRutaCrear, AsignacionRutaActualizar, AsignacionRutaResponse,
    RepartidorCrear, TelemetriaPing
)

RutaRouter = APIRouter(prefix="/logistica", tags=["Logística - Rutas y Asignaciones"])

PERMISOS_LOGISTICA = [ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]

# -------------------------------------------------------------
# ZONAS
# -------------------------------------------------------------
@RutaRouter.get("/zonas", response_model=list[ZonaResponse])
def listar_zonas(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarZonas(alcance.sucursal_efectiva)

@RutaRouter.post("/zonas", response_model=dict)
def crear_zona(
    dto: ZonaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    # Si la sede es fija, validar que la ciudad corresponda
    if alcance.sucursal_efectiva == 1 and "potos" in dto.Ciudad.lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para crear zonas en Potosí")
    if alcance.sucursal_efectiva == 2 and "sucre" in dto.Ciudad.lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para crear zonas en Sucre")
    return RutaService(db).CrearZona(dto)

# -------------------------------------------------------------
# RUTAS
# -------------------------------------------------------------
@RutaRouter.get("/rutas", response_model=list[RutaResponse])
def listar_rutas(
    id_zona: Optional[int] = Query(None, description="Filtrar por zona"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarRutas(id_zona, alcance.sucursal_efectiva)

@RutaRouter.get("/rutas/{id_ruta}", response_model=RutaResponse)
def obtener_ruta(
    id_ruta: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    r = RutaService(db).ObtenerRutaDetalle(id_ruta)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    sid = r.get("IdSucursal") if isinstance(r, dict) else getattr(r, "IdSucursal", None)
    alcance.validar_recurso(sid, nombre_recurso="ruta", responder_404=True)
    return r

@RutaRouter.post("/rutas", response_model=RutaResponse)
def crear_ruta(
    dto: RutaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sid = alcance.validar_escritura(dto.IdSucursal)
    dto.IdSucursal = sid
    return RutaService(db).CrearRuta(dto)

@RutaRouter.put("/rutas/{id_ruta}", response_model=RutaResponse)
def actualizar_ruta(
    id_ruta: int,
    dto: RutaActualizar,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    r = RutaService(db).ObtenerRutaDetalle(id_ruta)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    sid = r.get("IdSucursal") if isinstance(r, dict) else getattr(r, "IdSucursal", None)
    alcance.validar_recurso(sid, nombre_recurso="ruta", responder_404=True)
    if dto.IdSucursal is not None:
        dto.IdSucursal = alcance.validar_escritura(dto.IdSucursal)
    return RutaService(db).ActualizarRuta(id_ruta, dto)

@RutaRouter.put("/rutas/{id_ruta}/puntos-venta", response_model=RutaResponse)
def guardar_puntos_venta_ruta(
    id_ruta: int,
    dto: GuardarPuntosVentaRuta,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    r = RutaService(db).ObtenerRutaDetalle(id_ruta)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    sid = r.get("IdSucursal") if isinstance(r, dict) else getattr(r, "IdSucursal", None)
    alcance.validar_recurso(sid, nombre_recurso="ruta", responder_404=True)
    return RutaService(db).GuardarPuntosVentaRuta(id_ruta, dto)

# -------------------------------------------------------------
# ASIGNACIONES DIARIAS A REPARTIDORES
# -------------------------------------------------------------
@RutaRouter.get("/asignaciones", response_model=list[AsignacionRutaResponse])
def listar_asignaciones(
    fecha: Optional[date] = Query(None, description="Filtrar por fecha de asignación"),
    id_repartidor: Optional[int] = Query(None, description="Filtrar por repartidor"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarAsignaciones(fecha, id_repartidor, alcance.sucursal_efectiva)

@RutaRouter.post("/asignaciones", response_model=dict)
def crear_asignacion(
    dto: AsignacionRutaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql_r = text('SELECT "IdSucursal" FROM "RutaDistribucion" WHERE "IdRutaDistribucion" = :id')
    row = db.execute(sql_r, {"id": dto.IdRutaDistribucion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta de distribución no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="ruta", responder_404=True)
    return RutaService(db).CrearAsignacion(dto, usuario["IdUsuario"])

@RutaRouter.put("/asignaciones/{id_asignacion}", response_model=dict)
def actualizar_asignacion(
    id_asignacion: int,
    dto: AsignacionRutaActualizar,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql_ar = text('SELECT r."IdSucursal" FROM "AsignacionRuta" ar JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion" WHERE ar."IdAsignacionRuta" = :id')
    row = db.execute(sql_ar, {"id": id_asignacion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="asignación de ruta", responder_404=True)
    return RutaService(db).ActualizarAsignacion(id_asignacion, dto)

@RutaRouter.get("/repartidores", response_model=list[dict])
def listar_repartidores(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    return RutaService(db).ListarRepartidores(alcance.sucursal_efectiva)

@RutaRouter.post("/repartidores", response_model=dict)
def crear_repartidor(
    dto: RepartidorCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    dto.IdSucursal = alcance.validar_escritura(dto.IdSucursal, nombre_recurso="sucursal_repartidor")
    return RutaService(db).CrearRepartidor(dto)

@RutaRouter.put("/repartidores/{id_usuario}/estado", response_model=dict)
def cambiar_estado_repartidor(
    id_usuario: int,
    id_estado: int = Query(..., description="1 = Activo, 2 = Inactivo"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sql_u = 'SELECT "IdSucursal" FROM "Usuario" WHERE "IdUsuario" = :uid;'
    u_row = db.execute(text(sql_u), {"uid": id_usuario}).fetchone()
    if not u_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repartidor no encontrado")
    alcance.validar_recurso(u_row[0], nombre_recurso="repartidor", responder_404=True)
    return RutaService(db).CambiarEstadoRepartidor(id_usuario, id_estado)

# -------------------------------------------------------------
# Telemetría y rastreo en vivo
# -------------------------------------------------------------
@RutaRouter.post("/flota/ws-ticket")
def generar_ticket_websocket_flota(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
):
    """
    Emite un ticket efímero de un solo uso y corta duración (60s) para autenticar
    la conexión WebSocket del mapa satelital sin exponer el JWT en URLs o logs del proxy.
    """
    sucursales_permitidas = [alcance.sucursal_efectiva] if alcance.sucursal_efectiva else None
    ticket = flota_ws_manager.crear_ticket(
        usuario_id=usuario["IdUsuario"],
        sucursales_permitidas=sucursales_permitidas,
        duracion_segundos=60
    )
    return {"ticket": ticket, "expira_en_segundos": 60}


async def websocket_flota_endpoint(websocket: WebSocket, ticket: Optional[str] = None):
    """Lógica central de conexión WebSocket para telemetría de flota."""
    ticket_data = flota_ws_manager.validar_y_consumir_ticket(ticket)
    if not ticket_data:
        # Código 4401: Ticket inválido o expirado
        await websocket.close(code=4401, reason="Ticket invalido o expirado")
        return

    # Cargar snapshot inicial de choferes en vivo
    snapshot = []
    try:
        with SessionLocal() as db_session:
            suc_filtro = ticket_data["sucursales_permitidas"][0] if ticket_data["sucursales_permitidas"] else None
            snapshot = RutaService(db_session).ObtenerChoferesEnVivo(suc_filtro)
    except Exception as e:
        logger.warning(f"[WS-Flota] Error al cargar snapshot inicial: {e}")

    await flota_ws_manager.conectar(websocket, ticket_data, snapshot)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping" or '"ping"' in data.lower():
                await flota_ws_manager.responder_pong(websocket)
    except WebSocketDisconnect:
        flota_ws_manager.desconectar(websocket)
    except Exception as ex:
        logger.debug(f"[WS-Flota] Cierre de socket: {ex}")
        flota_ws_manager.desconectar(websocket)


@RutaRouter.websocket("/flota/ws")
async def websocket_flota(websocket: WebSocket, ticket: Optional[str] = None):
    await websocket_flota_endpoint(websocket, ticket)


@RutaRouter.post("/telemetria/ping", response_model=dict)
def registrar_telemetria(
    dto: TelemetriaPing,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]))
):
    """
    Recibe las coordenadas GPS en tiempo real enviadas por la app móvil del chofer o simulador web.
    Difunde la nueva ubicación inmediatamente a los operadores web conectados por WebSocket.
    """
    # Si el usuario es repartidor, asegurar que no envíe ping de otro repartidor
    if usuario.get("IdRol") == ROL_AGENTE_REPARTO:
        dto.IdUsuarioRepartidor = usuario["IdUsuario"]
    resultado = RutaService(db).RegistrarTelemetriaPing(dto)

    # Difundir en tiempo real al WebSocket Hub (Render Web Service)
    try:
        import asyncio
        datos_ping = {
            "id_chofer": dto.IdUsuarioRepartidor,
            "sucursal_id": dto.IdSucursal or usuario.get("IdSucursal", 1),
            "lat": dto.Latitud,
            "lng": dto.Longitud,
            "velocidad": dto.VelocidadKmH or 0.0,
            "bateria": dto.NivelBateria or 100,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(flota_ws_manager.broadcast_ubicacion(datos_ping))
        except RuntimeError:
            asyncio.run(flota_ws_manager.broadcast_ubicacion(datos_ping))
    except Exception as ws_err:
        logger.debug(f"Aviso: Broadcast WebSocket omitido: {ws_err}")

    return resultado

@RutaRouter.get("/telemetria/en-vivo", response_model=list[dict])
def obtener_choferes_en_vivo(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
):
    """
    Devuelve la última posición y telemetría de todos los choferes para el mapa central de rastreo web.
    """
    return RutaService(db).ObtenerChoferesEnVivo(alcance.sucursal_efectiva)

@RutaRouter.get("/telemetria/asignacion/{id_asignacion}", response_model=dict)
def obtener_tracking_asignacion(
    id_asignacion: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR]))
):
    """
    Devuelve la posición en vivo del camión, ruta completa y estado de cada parada/pedido asignado.
    """
    return RutaService(db).ObtenerTrackingAsignacion(id_asignacion)

@RutaRouter.post("/telemetria/entrega", response_model=dict)
def registrar_entrega_parada(
    datos: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL]))
):
    """
    Registra la entrega de un pedido con georreferenciación GPS obligatoria .
    """
    return RutaService(db).RegistrarEntregaParada(datos)

@RutaRouter.post("/telemetria/cobro", response_model=dict)
def registrar_cobro_parada(
    datos: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL]))
):
    """
    Registra cobro en efectivo o digital con captura obligatoria de GPS .
    """
    return RutaService(db).RegistrarCobroParada(datos)

# -------------------------------------------------------------
# Liquidación y cierre de ruta
# -------------------------------------------------------------
@RutaRouter.get("/asignaciones/{id_asignacion}/liquidacion", response_model=dict)
def obtener_liquidacion_ruta(
    id_asignacion: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Genera el resumen de liquidación consolidada para caja: efectivo a entregar, transferencias/QR, pedidos entregados y saldo.
    """
    sql_ar = text('SELECT r."IdSucursal" FROM "AsignacionRuta" ar JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion" WHERE ar."IdAsignacionRuta" = :id')
    row = db.execute(sql_ar, {"id": id_asignacion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="asignación de ruta", responder_404=True)
    return RutaService(db).ObtenerLiquidacionRuta(id_asignacion)

@RutaRouter.post("/asignaciones/{id_asignacion}/liquidar", response_model=dict)
def cerrar_y_liquidar_ruta(
    id_asignacion: int,
    datos: dict,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Cierra la ruta diaria del chofer y registra la rendición de cuentas oficial para Tesorería/Caja.
    """
    sql_ar = text('SELECT r."IdSucursal" FROM "AsignacionRuta" ar JOIN "RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion" WHERE ar."IdAsignacionRuta" = :id')
    row = db.execute(sql_ar, {"id": id_asignacion}).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")
    alcance.validar_recurso(row[0], nombre_recurso="asignación de ruta", responder_404=True)
    return RutaService(db).CerrarYLiquidarRuta(id_asignacion, datos, usuario["IdUsuario"])
