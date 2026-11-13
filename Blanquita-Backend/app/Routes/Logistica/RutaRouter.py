from datetime import date, datetime, timezone
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

from app.Config.supabase import get_db, SessionLocal
from app.Auth.Dependencies import require_role, get_current_user
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_CONTADOR, ROL_AGENTE_REPARTO, ROL_DISTRIBUIDOR
from app.Services.Logistica.RutaService import RutaService
from app.Services.Logistica.FlotaWebSocketManager import flota_ws_manager
from app.Models.Logistica.RutaModel import (
    ZonaCrear, ZonaResponse, RutaCrear, RutaActualizar, RutaResponse,
    GuardarPuntosVentaRuta, AsignacionRutaCrear, AsignacionRutaActualizar, AsignacionRutaResponse,
    RepartidorCrear, TelemetriaPing, InsertarParadaOrdenRequest, QuitarParadaRequest,
    MoverParadaRutaRequest, SolicitudCargaCrear, SolicitudCargaRevision,
    RevisionWebOperacionRequest, ItemAprobarCargaDTO, AprobarCargaRequest, ResolverCargaRequest,
    RevisionOperacionRequest, FinalizarAdminRequest, ReasignarPendientesRequest
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
    usuario: dict = Depends(get_current_user),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    rol_actual = usuario.get("IdRol")
    uid_actual = usuario.get("IdUsuario")

    # Si es personal de reparto (chofer, agente de reparto, distribuidor), permitir ver sus propias asignaciones
    if rol_actual in (ROL_AGENTE_REPARTO, ROL_DISTRIBUIDOR, 6, 7):
        if id_repartidor is not None and int(id_repartidor) != int(uid_actual):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para ver asignaciones de otros repartidores"
            )
        id_repartidor = int(uid_actual)
    elif rol_actual not in PERMISOS_LOGISTICA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para realizar esta acción"
        )

    return RutaService(db).ListarAsignaciones(fecha, id_repartidor, alcance.sucursal_efectiva)

@RutaRouter.post("/asignaciones", response_model=dict)
async def crear_asignacion(
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
    res = RutaService(db).CrearAsignacion(dto, usuario["IdUsuario"])

    asig_id = None
    if isinstance(res, dict):
        asig_id = res.get("IdAsignacionRuta") or (res.get("datos", {}).get("IdAsignacionRuta") if isinstance(res.get("datos"), dict) else None)
        if not asig_id and "id" in res:
            asig_id = res["id"]

    # Asignación nace en estado_operativo = 'PENDIENTE_CARGA'
    if asig_id:
        db.execute(text("""
            UPDATE public."AsignacionRuta"
            SET "estado_operativo" = 'PENDIENTE_CARGA'
            WHERE "IdAsignacionRuta" = :asig_id;
        """), {"asig_id": asig_id})

        # Notificación interna para el chofer
        db.execute(text("""
            INSERT INTO public."NotificacionInterna" (
                "IdUsuarioDestinatario", "Titulo", "Mensaje", "Tipo", "CodigoReferencia", "Leido", "FechaCreacion"
            ) VALUES (
                :uid, 'Ruta Asignada', 'Se le ha asignado una nueva ruta de distribución para el día de hoy.', 'RUTA_ASIGNADA', :ref, false, NOW()
            );
        """), {
            "uid": dto.IdUsuarioRepartidor,
            "ref": asig_id
        })
        db.commit()

        # Emitir WebSocket ruta_asignada al chofer
        evento_ws = {
            "tipo": "ruta_asignada",
            "id_asignacion": asig_id,
            "id_ruta": dto.IdRutaDistribucion,
            "id_chofer": dto.IdUsuarioRepartidor,
            "fecha": str(dto.FechaAsignacion),
            "estado_operativo": "PENDIENTE_CARGA",
            "habilitada_para_reparto": False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        try:
            await flota_ws_manager.emitir_a_chofer(dto.IdUsuarioRepartidor, evento_ws)
        except Exception as e_ws:
            logger.debug(f"[WS ruta_asignada] Error emitiendo ws: {e_ws}")

    return res

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
ROLES_TICKET_FLOTA = [1, 2, 3, 4, 5, 6, 7]

@RutaRouter.post("/flota/ws-ticket")
def generar_ticket_websocket_flota(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(ROLES_TICKET_FLOTA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal),
):
    """
    Emite un ticket efímero de un solo uso y corta duración (60s) para autenticar
    la conexión WebSocket del mapa satelital sin exponer el JWT en URLs o logs del proxy.
    Permite roles administrativos y choferes operativos.
    """
    suc_efectiva = alcance.sucursal_efectiva or usuario.get("IdSucursal")
    sucursales_permitidas = [int(suc_efectiva)] if suc_efectiva else None
    ticket = flota_ws_manager.crear_ticket(
        usuario_id=usuario["IdUsuario"],
        sucursales_permitidas=sucursales_permitidas,
        duracion_segundos=60,
        rol=usuario.get("IdRol")
    )
    return {"ticket": ticket, "expira_en_segundos": 60}


async def websocket_flota_endpoint(
    websocket: WebSocket,
    ticket: Optional[str] = None,
    token: Optional[str] = None
):
    """Lógica central de conexión WebSocket para telemetría de flota y eventos operativos de logística."""
    auth_val = ticket or token
    if not auth_val:
        auth_val = websocket.query_params.get("ticket") or websocket.query_params.get("token")
    if not auth_val:
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            auth_val = auth_header[7:].strip()
    if not auth_val:
        ws_proto = websocket.headers.get("sec-websocket-protocol")
        if ws_proto:
            partes = [p.strip() for p in ws_proto.split(",")]
            for p in partes:
                if p.startswith("ws_flota_") or len(p) > 20:
                    auth_val = p
                    break

    if auth_val and auth_val.lower().startswith("bearer "):
        auth_val = auth_val[7:].strip()

    ticket_data = None
    if auth_val:
        ticket_data = flota_ws_manager.validar_y_consumir_ticket(auth_val)
        if not ticket_data:
            try:
                from app.Auth.Jwt import verificar_token
                payload = verificar_token(auth_val)
                if payload:
                    meta = payload.get("app_metadata", {})
                    uid = meta.get("IdUsuario") or payload.get("id_usuario") or payload.get("IdUsuario")
                    rol = meta.get("IdRol") or payload.get("id_rol") or payload.get("IdRol")
                    auth_sub = payload.get("sub")
                    estado_usr = meta.get("IdEstadoUsuario")
                    suc_id = meta.get("IdSucursal") or payload.get("id_sucursal") or payload.get("IdSucursal")

                    with SessionLocal() as db_session:
                        usr = None
                        if not uid and auth_sub:
                            usr = db_session.execute(
                                text('SELECT "IdUsuario", "IdRol", "IdEstadoUsuario", "IdSucursal" FROM public."Usuario" WHERE "AuthUserId" = :sub LIMIT 1;'),
                                {"sub": str(auth_sub)}
                            ).fetchone()
                        elif uid:
                            usr = db_session.execute(
                                text('SELECT "IdUsuario", "IdRol", "IdEstadoUsuario", "IdSucursal" FROM public."Usuario" WHERE "IdUsuario" = :uid LIMIT 1;'),
                                {"uid": int(uid)}
                            ).fetchone()

                        if usr:
                            uid = usr[0]
                            rol = usr[1]
                            estado_usr = usr[2]
                            if usr[3] is not None:
                                suc_id = usr[3]

                    if estado_usr == 1 or estado_usr is None:
                        rol_int = int(rol) if rol is not None else 6
                        es_chofer = rol_int in (5, 6, 7)
                        ticket_data = {
                            "usuario_id": int(uid) if uid else None,
                            "id_chofer": int(uid) if uid else None,
                            "rol": rol_int,
                            "tipo_cliente": "movil" if es_chofer else "web",
                            "sucursales_permitidas": [int(suc_id)] if (suc_id and es_chofer) else None
                        }
            except Exception as e_tok:
                logger.debug(f"[WS-Flota] Error al validar JWT en handshake: {e_tok}")

    if not ticket_data or not ticket_data.get("usuario_id"):
        # Código 4401: Ticket o token inválido o expirado
        await websocket.close(code=4401, reason="Ticket o token invalido o expirado")
        return

    # Cargar snapshot inicial de choferes en vivo
    snapshot = []
    try:
        with SessionLocal() as db_session:
            suc_filtro = ticket_data.get("sucursales_permitidas")[0] if ticket_data.get("sucursales_permitidas") else None
            snapshot = RutaService(db_session).ObtenerChoferesEnVivo(suc_filtro)
    except Exception as e:
        logger.warning(f"[WS-Flota] Error al cargar snapshot inicial: {e}")

    await flota_ws_manager.conectar(websocket, ticket_data, snapshot)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping" or '"ping"' in data.lower():
                await flota_ws_manager.responder_pong(websocket)
            else:
                try:
                    import json
                    msg_json = json.loads(data)
                    tipo_msg = msg_json.get("tipo")
                    if tipo_msg in ("reporte_ubicacion_actual", "POSICION_CHOFER"):
                        uid_reporte = msg_json.get("id_chofer") or ticket_data.get("usuario_id")
                        if uid_reporte and msg_json.get("lat") and msg_json.get("lng"):
                            with SessionLocal() as db_session:
                                dto_ping = TelemetriaPing(
                                    IdUsuarioRepartidor=int(uid_reporte),
                                    IdAsignacionRuta=msg_json.get("id_asignacion"),
                                    Latitud=float(msg_json["lat"]),
                                    Longitud=float(msg_json["lng"]),
                                    Velocidad=float(msg_json.get("velocidad", 0.0)),
                                    Bateria=int(msg_json.get("bateria", 100)),
                                    EstadoMovimiento=msg_json.get("estado_movimiento", "En Ruta")
                                )
                                RutaService(db_session).RegistrarTelemetriaPing(dto_ping)
                            await flota_ws_manager.broadcast_ubicacion(msg_json)
                except Exception as parse_err:
                    logger.debug(f"[WS receive] No JSON o formato desconocido: {parse_err}")
    except WebSocketDisconnect:
        flota_ws_manager.desconectar(websocket)
    except Exception as ex:
        logger.debug(f"[WS-Flota] Cierre de socket: {ex}")
        flota_ws_manager.desconectar(websocket)


@RutaRouter.websocket("/flota/ws")
@RutaRouter.websocket("/ws")
@RutaRouter.websocket("/ws/logistica")
async def websocket_flota(
    websocket: WebSocket,
    ticket: Optional[str] = None,
    token: Optional[str] = None
):
    await websocket_flota_endpoint(websocket, ticket=ticket, token=token)


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

# -------------------------------------------------------------
# MOTOR DE REORDENAMIENTO 1..N Y GENERADOR DIARIO (SUB-AGENTE A)
# -------------------------------------------------------------
@RutaRouter.post("/rutas/{id_ruta}/paradas/reordenar", response_model=list[dict])
def recalcular_orden_paradas(
    id_ruta: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Recalcula el orden secuencial compacto 1..N sin huecos de las paradas de la ruta.
    """
    r = RutaService(db).ObtenerRutaDetalle(id_ruta)
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta no encontrada")
    alcance.validar_recurso(r.get("IdSucursal"), nombre_recurso="ruta", responder_404=True)
    return RutaService(db).recalcular_orden_paradas_ruta(id_ruta)

@RutaRouter.post("/rutas/paradas/insertar", response_model=list[dict])
def insertar_parada_orden(
    dto: InsertarParadaOrdenRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role([ROL_SUPERVISOR, ROL_GERENTE_GENERAL, ROL_AGENTE_REPARTO, ROL_DISTRIBUIDOR, 6, 7])),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Inserta una nueva parada manual o por ENTREGA_INMEDIATA.
    Desplaza las paradas siguientes en +1 y compacta en orden 1..N.
    """
    return RutaService(db).insertar_parada_en_orden(dto)

@RutaRouter.post("/rutas/paradas/quitar", response_model=list[dict])
def quitar_parada_ruta(
    dto: QuitarParadaRequest,
    fecha: Optional[date] = Query(None, description="Fecha de operación (default hoy)"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Quita una parada PENDIENTE y compacta 1..N.
    Regla inquebrantable: Lanza HTTP 400 si ya tiene entrega o cobro hoy.
    """
    return RutaService(db).quitar_parada_ruta(dto, fecha)

@RutaRouter.post("/rutas/paradas/mover", response_model=dict)
def mover_parada_ruta(
    dto: MoverParadaRutaRequest,
    fecha: Optional[date] = Query(None, description="Fecha de operación (default hoy)"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Mueve un cliente PENDIENTE a otra ruta del mismo día o de otro día de la semana.
    Lanza HTTP 400 si ya fue operada hoy en origen. Recalcula 1..N en origen y destino.
    """
    return RutaService(db).mover_cliente_de_ruta(dto, fecha)

@RutaRouter.post("/rutas/generar-diarias", response_model=dict)
def generar_rutas_diarias(
    fecha: Optional[date] = Query(None, description="Fecha a generar (default hoy)"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Invoca la función fn_generar_rutas_diarias para calcular las rutas y asignaciones automáticas del día.
    """
    return RutaService(db).GenerarRutasDiarias(fecha)

# -------------------------------------------------------------
# HELPER FUNCTIONS - LOGÍSTICA, SUCURSALES Y STOCK
# -------------------------------------------------------------
def _obtener_nombre_sucursal(db: Session, id_sucursal: Optional[int]) -> str:
    if not id_sucursal:
        return "Sucursal Central Sucre"
    nombre = db.execute(
        text('SELECT nombre FROM public.sucursales WHERE id = :id LIMIT 1;'),
        {"id": id_sucursal}
    ).scalar()
    return nombre or f"Sucursal {id_sucursal}"


def _obtener_stock_remanente_real_chofer(db: Session, id_chofer: int) -> list[dict]:
    """
    Realiza la consulta real a inventario_chofer (JOIN PresentacionProducto / Producto) para el chofer.
    Devuelve todos los productos con cantidad > 0 actualmente en el camión.
    """
    sql_rem = text("""
        SELECT 
            ic.presentacion_id as id_presentacion,
            ic.presentacion_id as "IdPresentacion",
            pp."CodigoPresentacion" as codigo_presentacion,
            pp."CodigoPresentacion" as "CodigoPresentacion",
            prod."NombreProducto" as nombre_producto,
            prod."NombreProducto" as "NombreProducto",
            COALESCE(pp."TipoContenedor", 'Paquete') as tipo_contenedor,
            COALESCE(pp."TipoContenedor", 'Paquete') as "TipoContenedor",
            COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) as cantidad,
            COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) as stock_remanente,
            COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) as cantidad_remanente,
            ic.cantidad_cargada,
            ic.cantidad_vendida,
            ic.precio_vigente_carga
        FROM public.inventario_chofer ic
        JOIN public."PresentacionProducto" pp ON ic.presentacion_id = pp."IdPresentacion"
        JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
        WHERE ic.chofer_id = :id_chofer
          AND COALESCE(ic.cantidad_remanente, GREATEST(ic.cantidad_cargada - ic.cantidad_vendida, 0)) > 0
        ORDER BY prod."NombreProducto" ASC, pp."CodigoPresentacion" ASC;
    """)
    return [dict(r) for r in db.execute(sql_rem, {"id_chofer": id_chofer}).mappings().fetchall()]


def _obtener_presentaciones_sugeridas_ruta(db: Session, id_sucursal: Optional[int] = None) -> list[dict]:
    """
    Precarga presentaciones sugeridas del catálogo para que el supervisor
    pueda visualizarlas y ajustarlas si la solicitud no contiene filas de detalle.
    """
    sql_sug = text("""
        SELECT 
            NULL::integer as id_detalle,
            pp."IdPresentacion" as id_presentacion,
            pp."IdPresentacion" as "IdPresentacion",
            pp."CodigoPresentacion" as "CodigoPresentacion",
            pp."CodigoPresentacion" as codigo_presentacion,
            prod."NombreProducto" as "NombreProducto",
            prod."NombreProducto" as nombre_producto,
            COALESCE(pp."TipoContenedor", 'Paquete') as "TipoContenedor",
            COALESCE(pp."TipoContenedor", 'Paquete') as tipo_contenedor,
            0.0 as stock_remanente,
            0.0 as stock_adicional_solicitado,
            0.0 as stock_adicional_aprobado,
            'Sugerido para ruta' as observacion
        FROM public."PresentacionProducto" pp
        JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
        WHERE pp."Activo" = true
        ORDER BY prod."NombreProducto" ASC, pp."CodigoPresentacion" ASC
        LIMIT 15;
    """)
    return [dict(r) for r in db.execute(sql_sug).mappings().fetchall()]


def _asegurar_paradas_reales_asignacion(db: Session, id_asignacion: int, id_ruta: int, id_sucursal: int, id_chofer: int):
    """
    Garantiza que la asignación tenga paradas reales de RutaPuntoVenta o Pedido
    para que la hoja de ruta nunca retorne paradas vacías ([]).
    """
    cant_pv = db.execute(text("""
        SELECT COUNT(*) FROM public."RutaPuntoVenta" WHERE "IdRutaDistribucion" = :rid;
    """), {"rid": id_ruta}).scalar() or 0

    if cant_pv == 0:
        pedidos = db.execute(text("""
            SELECT "IdPedido", "IdPuntoVenta"
            FROM public."Pedido"
            WHERE ("IdAsignacionRuta" = :asig_id OR ("IdUsuarioRepartidor" = :cid AND "FechaPedido" = CURRENT_DATE))
              AND "IdPuntoVenta" IS NOT NULL;
        """), {"asig_id": id_asignacion, "cid": id_chofer}).fetchall()

        orden = 1
        for ped in pedidos:
            db.execute(text("""
                UPDATE public."Pedido"
                SET "IdAsignacionRuta" = :asig_id
                WHERE "IdPedido" = :pid AND ("IdAsignacionRuta" IS NULL OR "IdAsignacionRuta" != :asig_id);
            """), {"asig_id": id_asignacion, "pid": ped.IdPedido})

            db.execute(text("""
                INSERT INTO public."RutaPuntoVenta" ("IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
                VALUES (:rid, :pvid, :orden)
                ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta") DO NOTHING;
            """), {"rid": id_ruta, "pvid": ped.IdPuntoVenta, "orden": orden})
            orden += 1

        cant_pv_recheck = db.execute(text("""
            SELECT COUNT(*) FROM public."RutaPuntoVenta" WHERE "IdRutaDistribucion" = :rid;
        """), {"rid": id_ruta}).scalar() or 0

        if cant_pv_recheck == 0:
            puntos_suc = db.execute(text("""
                SELECT pv."IdPuntoVenta"
                FROM public."PuntoVenta" pv
                JOIN public."Cliente" c ON pv."IdCliente" = c."IdCliente"
                WHERE (c."IdSucursal" = :sid OR pv."IdZona" IN (SELECT "IdZonaDistribucion" FROM public."RutaDistribucion" WHERE "IdRutaDistribucion" = :rid))
                  AND pv."Activo" = true
                ORDER BY pv."IdPuntoVenta" ASC
                LIMIT 5;
            """), {"sid": id_sucursal, "rid": id_ruta}).fetchall()

            for idx, pv_item in enumerate(puntos_suc, 1):
                db.execute(text("""
                    INSERT INTO public."RutaPuntoVenta" ("IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
                    VALUES (:rid, :pvid, :orden)
                    ON CONFLICT ("IdRutaDistribucion", "IdPuntoVenta") DO NOTHING;
                """), {"rid": id_ruta, "pvid": pv_item.IdPuntoVenta, "orden": idx})


# -------------------------------------------------------------
# SOLICITUDES DE CARGA DE CAMIÓN
# -------------------------------------------------------------
@RutaRouter.post("/solicitudes-carga", response_model=dict)
def crear_solicitud_carga(
    dto: SolicitudCargaCrear,
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    El chofer solicita carga de camión registrando stock remanente + stock adicional solicitado.
    """
    if not dto.IdChofer and not dto.id_chofer:
        dto.IdChofer = usuario.get("IdUsuario")
        dto.id_chofer = usuario.get("IdUsuario")
    return RutaService(db).CrearSolicitudCarga(dto)

@RutaRouter.get("/solicitudes-carga", response_model=list[dict])
def listar_solicitudes_carga(
    sucursal_id: Optional[int] = Query(None, description="Filtrar por ID de sucursal"),
    id_sucursal: Optional[int] = Query(None, description="Alias sucursal"),
    id_asignacion: Optional[int] = Query(None, description="Filtrar por asignación"),
    estado: Optional[str] = Query(None, description="Filtrar por estado (PENDIENTE, APROBADO, RECHAZADO)"),
    fecha: Optional[date] = Query(None, description="Filtrar por fecha"),
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Lista las solicitudes de carga de camión con desglose de stock remanente en camión
    (consulta real a inventario_chofer con cantidad > 0) + stock adicional pedido.
    """
    suc_efectiva = sucursal_id or id_sucursal or alcance.sucursal_efectiva

    conds = []
    params = {}

    if suc_efectiva:
        conds.append('r."IdSucursal" = :suc_id')
        params["suc_id"] = int(suc_efectiva)

    if id_asignacion is not None:
        conds.append('s."id_asignacion_ruta" = :id_asig')
        params["id_asig"] = int(id_asignacion)

    if estado:
        conds.append('s."estado" = :estado')
        params["estado"] = estado

    if fecha:
        conds.append('DATE(s."fecha_solicitud") = :fecha')
        params["fecha"] = fecha

    where_sql = f"WHERE {' AND '.join(conds)}" if conds else ""

    sql = f"""
        SELECT 
            s."id_solicitud",
            s."id_asignacion_ruta",
            s."id_chofer",
            CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno") as "nombre_chofer",
            r."IdSucursal" as "id_sucursal",
            r."NombreRuta" as "nombre_ruta",
            s."estado",
            s."observacion_chofer",
            s."observacion_admin",
            s."id_admin_revision",
            s."fecha_solicitud",
            s."fecha_revision",
            s."created_at"
        FROM public."solicitud_carga_camion" s
        JOIN public."Usuario" u ON s."id_chofer" = u."IdUsuario"
        JOIN public."AsignacionRuta" ar ON s."id_asignacion_ruta" = ar."IdAsignacionRuta"
        JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        {where_sql}
        ORDER BY s."fecha_solicitud" DESC, s."id_solicitud" DESC;
    """

    filas = db.execute(text(sql), params).mappings().fetchall()
    resultado = []
    for f in filas:
        sol_dict = dict(f)
        if sol_dict.get("fecha_solicitud"):
            sol_dict["fecha_solicitud"] = sol_dict["fecha_solicitud"].isoformat()
        if sol_dict.get("fecha_revision"):
            sol_dict["fecha_revision"] = sol_dict["fecha_revision"].isoformat()
        if sol_dict.get("created_at"):
            sol_dict["created_at"] = sol_dict["created_at"].isoformat()

        # Stock remanente real del chofer desde inventario_chofer
        stock_rem = _obtener_stock_remanente_real_chofer(db, f["id_chofer"])
        sol_dict["stock_remanente"] = stock_rem

        # Desglose de productos de la solicitud
        sql_det = text("""
            SELECT 
                d."id_detalle",
                d."id_solicitud",
                d."id_presentacion",
                pp."CodigoPresentacion",
                prod."NombreProducto",
                pp."TipoContenedor",
                COALESCE(d."stock_remanente", 0) as "stock_remanente",
                COALESCE(d."stock_adicional_solicitado", 0) as "stock_adicional_solicitado",
                COALESCE(d."stock_adicional_aprobado", 0) as "stock_adicional_aprobado",
                d."observacion"
            FROM public."detalle_solicitud_carga_camion" d
            JOIN public."PresentacionProducto" pp ON d."id_presentacion" = pp."IdPresentacion"
            JOIN public."Producto" prod ON pp."IdProducto" = prod."IdProducto"
            WHERE d."id_solicitud" = :sid
            ORDER BY prod."NombreProducto" ASC;
        """)
        detalles = [dict(d) for d in db.execute(sql_det, {"sid": f["id_solicitud"]}).mappings().fetchall()]
        if not detalles:
            detalles = _obtener_presentaciones_sugeridas_ruta(db, f.get("id_sucursal"))

        sol_dict["detalles"] = detalles
        sol_dict["items"] = detalles
        sol_dict["items_solicitados"] = detalles
        sol_dict["nombre_sucursal"] = _obtener_nombre_sucursal(db, f.get("id_sucursal"))
        resultado.append(sol_dict)

    return resultado

@RutaRouter.get("/solicitudes-carga/{id_solicitud}", response_model=dict)
def obtener_solicitud_carga(
    id_solicitud: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    sol = RutaService(db).ObtenerSolicitudCargaPorId(id_solicitud)
    if not sol:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de carga no encontrada")

    id_chofer = sol.get("id_chofer")
    if id_chofer:
        sol["stock_remanente"] = _obtener_stock_remanente_real_chofer(db, id_chofer)

    detalles = sol.get("detalles") or sol.get("items_solicitados") or []
    if not detalles:
        id_suc = sol.get("id_sucursal")
        detalles = _obtener_presentaciones_sugeridas_ruta(db, id_suc)
        sol["detalles"] = detalles

    sol["items"] = detalles
    sol["items_solicitados"] = detalles
    sol["nombre_sucursal"] = _obtener_nombre_sucursal(db, sol.get("id_sucursal"))
    return sol

@RutaRouter.put("/solicitudes-carga/{id_solicitud}/revisar", response_model=dict)
def revisar_solicitud_carga(
    id_solicitud: int,
    dto: SolicitudCargaRevision,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Supervisor o Administrador aprueba o rechaza la carga del camión.
    """
    return RutaService(db).RevisarSolicitudCarga(id_solicitud, dto, usuario["IdUsuario"])

# -------------------------------------------------------------
# AUDITORÍA / REVISIÓN WEB
# -------------------------------------------------------------
@RutaRouter.put("/entregas/{id_pedido}/revisar-web", response_model=dict)
def revisar_entrega_web(
    id_pedido: int,
    dto: RevisionWebOperacionRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Auditoría Web para aprobar, observar o rechazar una entrega física.
    """
    return RutaService(db).RevisarEntregaWeb(id_pedido, dto, usuario["IdUsuario"])

@RutaRouter.put("/pagos/{id_pago_pedido}/revisar-web", response_model=dict)
def revisar_pago_web(
    id_pago_pedido: int,
    dto: RevisionWebOperacionRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Auditoría Web para aprobar, observar o rechazar un pago o cobro de ruta.
    """
    return RutaService(db).RevisarPagoWeb(id_pago_pedido, dto, usuario["IdUsuario"])


# -------------------------------------------------------------
# APROBACIÓN DE CARGA EN WEB
# -------------------------------------------------------------
@RutaRouter.post("/asignaciones/{id}/aprobar-carga", response_model=dict)
@RutaRouter.post("/asignaciones/{id_asignacion}/aprobar-carga", response_model=dict)
async def aprobar_carga_camion_web(
    id: Optional[int] = None,
    id_asignacion: Optional[int] = None,
    dto: Optional[AprobarCargaRequest] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Aprobación de Carga en Web:
    Suma el stock adicional a inventario_chofer, cambia AsignacionRuta.estado_operativo = 'APROBADA_EN_RUTA',
    guarda NotificacionInterna para el chofer y emite WebSocket carga_camion_aprobada al chofer.
    """
    asig_id = id if id is not None else id_asignacion
    if not asig_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID de asignación requerido")

    sql_asig = text("""
        SELECT ar."IdAsignacionRuta", ar."IdUsuarioRepartidor", r."IdSucursal", ar."estado_operativo"
        FROM public."AsignacionRuta" ar
        JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE ar."IdAsignacionRuta" = :asig_id;
    """)
    asig = db.execute(sql_asig, {"asig_id": asig_id}).fetchone()
    if not asig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")

    alcance.validar_recurso(asig.IdSucursal, nombre_recurso="asignación de ruta", responder_404=True)
    chofer_id = asig.IdUsuarioRepartidor
    sucursal_id = asig.IdSucursal

    # Buscar solicitud_carga_camion pendiente si existe
    sql_sol = text("""
        SELECT id_solicitud, estado
        FROM public.solicitud_carga_camion
        WHERE id_asignacion_ruta = :asig_id AND estado = 'PENDIENTE'
        ORDER BY id_solicitud DESC LIMIT 1;
    """)
    sol = db.execute(sql_sol, {"asig_id": asig_id}).fetchone()

    items_a_aprobar = []
    lista_items = (dto.items or dto.items_aprobados or dto.ItemsAprobados) if dto else None
    if lista_items:
        for it in lista_items:
            if isinstance(it, dict):
                pid = it.get("presentacion_id") or it.get("IdPresentacion") or it.get("id_presentacion")
                cant = it.get("cantidad_aprobada") or it.get("stock_adicional_aprobado") or it.get("cantidad") or 0.0
                if pid:
                    items_a_aprobar.append(ItemAprobarCargaDTO(presentacion_id=int(pid), cantidad_aprobada=float(cant)))
            elif hasattr(it, "presentacion_id"):
                items_a_aprobar.append(it)
    elif sol:
        sql_det = text("""
            SELECT id_presentacion, stock_adicional_solicitado
            FROM public.detalle_solicitud_carga_camion
            WHERE id_solicitud = :sid;
        """)
        rows_det = db.execute(sql_det, {"sid": sol.id_solicitud}).fetchall()
        for r in rows_det:
            items_a_aprobar.append(ItemAprobarCargaDTO(
                presentacion_id=r.id_presentacion,
                cantidad_aprobada=float(r.stock_adicional_solicitado)
            ))

    # Sumar stock adicional a inventario_chofer
    for item in items_a_aprobar:
        cant = float(item.cantidad_aprobada or 0.0)
        pid = item.presentacion_id

        existe = db.execute(text("""
            SELECT id, cantidad_cargada
            FROM public.inventario_chofer
            WHERE chofer_id = :uid AND presentacion_id = :pid
            ORDER BY id DESC LIMIT 1;
        """), {"uid": chofer_id, "pid": pid}).fetchone()

        if existe:
            db.execute(text("""
                UPDATE public.inventario_chofer
                SET cantidad_cargada = cantidad_cargada + :cant,
                    fecha_carga = NOW()
                WHERE id = :id_inv;
            """), {"cant": cant, "id_inv": existe.id})
        else:
            db.execute(text("""
                INSERT INTO public.inventario_chofer (
                    chofer_id, sucursal_id, presentacion_id, cantidad_cargada,
                    cantidad_vendida, cantidad_remanente, precio_vigente_carga, fecha_carga
                ) VALUES (
                    :uid, :sid, :pid, :cant,
                    0, 0, (SELECT COALESCE("PrecioUnitario", 0) FROM public."PrecioProducto" WHERE "IdProducto" = (SELECT "IdProducto" FROM public."PresentacionProducto" WHERE "IdPresentacion" = :pid) LIMIT 1), NOW()
                );
            """), {"uid": chofer_id, "sid": sucursal_id, "pid": pid, "cant": cant})

        if sol:
            db.execute(text("""
                UPDATE public.detalle_solicitud_carga_camion
                SET stock_adicional_aprobado = :cant
                WHERE id_solicitud = :sid AND id_presentacion = :pid;
            """), {"cant": cant, "sid": sol.id_solicitud, "pid": pid})

    if sol:
        db.execute(text("""
            UPDATE public.solicitud_carga_camion
            SET estado = 'APROBADO',
                observacion_admin = :obs,
                id_admin_revision = :admin_id,
                fecha_revision = NOW()
            WHERE id_solicitud = :sid;
        """), {
            "obs": dto.observacion if dto else "Carga aprobada en Web",
            "admin_id": usuario["IdUsuario"],
            "sid": sol.id_solicitud
        })

    # Cambiar AsignacionRuta.estado_operativo = 'APROBADA_EN_RUTA' y Estado = 'En Ruta'
    db.execute(text("""
        UPDATE public."AsignacionRuta"
        SET "estado_operativo" = 'APROBADA_EN_RUTA',
            "Estado" = 'En Ruta'
        WHERE "IdAsignacionRuta" = :asig_id;
    """), {"asig_id": asig_id})

    # Guardar NotificacionInterna para el chofer
    db.execute(text("""
        INSERT INTO public."NotificacionInterna" (
            "IdUsuarioDestinatario", "Titulo", "Mensaje", "Tipo", "CodigoReferencia", "Leido", "FechaCreacion"
        ) VALUES (
            :uid, 'Carga de Camión Aprobada', 'Su solicitud de carga ha sido aprobada. Puede iniciar el reparto.', 'CARGA_APROBADA', :asig_id, false, NOW()
        );
    """), {
        "uid": chofer_id,
        "asig_id": asig_id
    })

    db.commit()

    # Emitir WebSocket carga_camion_aprobada al chofer
    evento_ws = {
        "tipo": "carga_camion_aprobada",
        "id_asignacion": asig_id,
        "id_chofer": chofer_id,
        "estado_operativo": "APROBADA_EN_RUTA",
        "habilitada_para_reparto": True,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    try:
        await flota_ws_manager.emitir_a_chofer(chofer_id, evento_ws)
    except Exception as e_ws:
        logger.debug(f"[WS carga_camion_aprobada] Error emitiendo ws: {e_ws}")

    return {
        "codigo": "EXITO",
        "mensaje": "Carga de camión aprobada exitosamente",
        "datos": {
            "id_asignacion": asig_id,
            "estado_operativo": "APROBADA_EN_RUTA",
            "habilitada_para_reparto": True
        }
    }


# -------------------------------------------------------------
# RESOLUCIÓN DE CARGA EN WEB (APROBAR / OBSERVAR / RECHAZAR)
# -------------------------------------------------------------
@RutaRouter.post("/asignaciones/{id_asignacion}/resolver-carga", response_model=dict)
async def resolver_carga_camion_web(
    id_asignacion: int,
    dto: ResolverCargaRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Resolución de Solicitud de Carga por Supervisor:
    Soporta 3 acciones:
    - 'APROBADA': Suma stock, estado_operativo = 'APROBADA_EN_RUTA', emite carga_camion_aprobada.
    - 'OBSERVADA': Registra observación, notifica al chofer, emite carga_camion_observada.
    - 'RECHAZADA': Rechaza solicitud, cancela habilitación, emite carga_camion_rechazada.
    """
    decision = (dto.decision or "APROBADA").upper().strip()
    obs = dto.observacion or dto.Observacion or dto.motivo or ""

    if decision in ["APROBADA", "APROBADO"]:
        aprobar_dto = AprobarCargaRequest(
            items=dto.items or dto.items_aprobados,
            items_aprobados=dto.items_aprobados or dto.items,
            observacion=obs or "Carga física y stock aprobados por supervisor",
            Estado="APROBADO"
        )
        return await aprobar_carga_camion_web(
            id=id_asignacion,
            id_asignacion=id_asignacion,
            dto=aprobar_dto,
            db=db,
            usuario=usuario,
            alcance=alcance
        )

    # Validar existencia de asignación y alcance
    sql_asig = text("""
        SELECT ar."IdAsignacionRuta", ar."IdUsuarioRepartidor", r."IdSucursal", ar."estado_operativo"
        FROM public."AsignacionRuta" ar
        JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE ar."IdAsignacionRuta" = :asig_id;
    """)
    asig = db.execute(sql_asig, {"asig_id": id_asignacion}).fetchone()
    if not asig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación no encontrada")

    alcance.validar_recurso(asig.IdSucursal, nombre_recurso="asignación de ruta", responder_404=True)
    chofer_id = asig.IdUsuarioRepartidor

    # Buscar solicitud_carga_camion pendiente
    sql_sol = text("""
        SELECT id_solicitud, estado
        FROM public.solicitud_carga_camion
        WHERE id_asignacion_ruta = :asig_id AND estado = 'PENDIENTE'
        ORDER BY id_solicitud DESC LIMIT 1;
    """)
    sol = db.execute(sql_sol, {"asig_id": id_asignacion}).fetchone()

    nuevo_estado_sol = "OBSERVADA" if decision in ["OBSERVADA", "OBSERVADO"] else "RECHAZADA"
    nuevo_estado_asig = "OBSERVADA" if decision in ["OBSERVADA", "OBSERVADO"] else "CANCELADA"
    titulo_notif = "Solicitud de Carga Observada" if nuevo_estado_sol == "OBSERVADA" else "Solicitud de Carga Rechazada"
    tipo_notif = "CARGA_OBSERVADA" if nuevo_estado_sol == "OBSERVADA" else "CARGA_RECHAZADA"

    if sol:
        db.execute(text("""
            UPDATE public.solicitud_carga_camion
            SET estado = :estado,
                observacion_admin = :obs,
                id_admin_revision = :admin_id,
                fecha_revision = NOW()
            WHERE id_solicitud = :sid;
        """), {
            "estado": nuevo_estado_sol,
            "obs": obs or f"Solicitud {nuevo_estado_sol.lower()} por supervisión",
            "admin_id": usuario["IdUsuario"],
            "sid": sol.id_solicitud
        })

    db.execute(text("""
        UPDATE public."AsignacionRuta"
        SET "estado_operativo" = :estado_op
        WHERE "IdAsignacionRuta" = :asig_id;
    """), {"estado_op": nuevo_estado_asig, "asig_id": id_asignacion})

    db.execute(text("""
        INSERT INTO public."NotificacionInterna" (
            "IdUsuarioDestinatario", "Titulo", "Mensaje", "Tipo", "CodigoReferencia", "Leido", "FechaCreacion"
        ) VALUES (
            :uid, :titulo, :msg, :tipo, :asig_id, false, NOW()
        );
    """), {
        "uid": chofer_id,
        "titulo": titulo_notif,
        "msg": obs or f"Su solicitud de carga ha sido {nuevo_estado_sol.lower()}.",
        "tipo": tipo_notif,
        "asig_id": id_asignacion
    })

    db.commit()

    # Emitir WebSocket
    evento_ws = {
        "tipo": "carga_camion_observada" if nuevo_estado_sol == "OBSERVADA" else "carga_camion_rechazada",
        "id_asignacion": id_asignacion,
        "id_chofer": chofer_id,
        "decision": nuevo_estado_sol,
        "observacion": obs,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    try:
        await flota_ws_manager.emitir_a_chofer(chofer_id, evento_ws)
    except Exception as e_ws:
        logger.debug(f"[WS resolver_carga] Error emitiendo ws: {e_ws}")

    return {
        "codigo": "EXITO",
        "mensaje": f"Solicitud de carga {nuevo_estado_sol.lower()} exitosamente",
        "datos": {
            "id_asignacion": id_asignacion,
            "decision": nuevo_estado_sol,
            "observacion": obs
        }
    }


# -------------------------------------------------------------
# APROBACIÓN 1 A 1 DE HISTORIAL (ENTREGA O COBRO)
# -------------------------------------------------------------
@RutaRouter.patch("/operaciones-ruta/{tipo}/{id}/revisar", response_model=dict)
async def revisar_operacion_ruta_1a1(
    tipo: str,
    id: int,
    dto: RevisionOperacionRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Aprobación 1 a 1 de Historial:
    Permite al encargado Web marcar cada entrega o cobro como APROBADO, OBSERVADO o RECHAZADO
    con comentario/observación, y emite WebSocket operacion_revisada al chofer.
    """
    op_id = id

    tipo_norm = str(tipo or "").strip().lower()
    if tipo_norm not in ("entrega", "cobro"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de operación inválido: '{tipo}'. Debe ser 'entrega' o 'cobro'."
        )

    estado_norm = str(dto.estado or dto.EstadoRevisionWeb or "").strip().upper()
    if estado_norm not in ("APROBADO", "OBSERVADO", "RECHAZADO"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estado de revisión inválido: '{dto.estado or dto.EstadoRevisionWeb}'. Debe ser 'APROBADO', 'OBSERVADO' o 'RECHAZADO'."
        )

    obs_norm = dto.observacion or dto.ObservacionRevision or ""
    chofer_id = None
    admin_id = usuario["IdUsuario"]

    if tipo_norm == "entrega":
        sql_ped = text("""
            SELECT p."IdPedido", p."IdUsuarioRepartidor", r."IdSucursal"
            FROM public."Pedido" p
            LEFT JOIN public."AsignacionRuta" ar ON p."IdAsignacionRuta" = ar."IdAsignacionRuta"
            LEFT JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            WHERE p."IdPedido" = :op_id;
        """)
        ped = db.execute(sql_ped, {"op_id": op_id}).fetchone()
        if not ped:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido / entrega no encontrada")
        chofer_id = ped.IdUsuarioRepartidor

        db.execute(text("""
            UPDATE public."Pedido"
            SET "estado_revision_web" = :est,
                "observacion_revision" = :obs,
                "revisado_por_id" = :adm,
                "fecha_revision" = NOW()
            WHERE "IdPedido" = :op_id;
        """), {"est": estado_norm, "obs": obs_norm, "adm": admin_id, "op_id": op_id})

    elif tipo_norm == "cobro":
        sql_pago = text("""
            SELECT pp."IdPagoPedido", p."IdUsuarioRepartidor", r."IdSucursal"
            FROM public."PagoPedido" pp
            JOIN public."Pedido" p ON pp."IdPedido" = p."IdPedido"
            LEFT JOIN public."AsignacionRuta" ar ON p."IdAsignacionRuta" = ar."IdAsignacionRuta"
            LEFT JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
            WHERE pp."IdPagoPedido" = :op_id;
        """)
        pago = db.execute(sql_pago, {"op_id": op_id}).fetchone()
        if pago:
            chofer_id = pago.IdUsuarioRepartidor
            db.execute(text("""
                UPDATE public."PagoPedido"
                SET "estado_revision_web" = :est,
                    "observacion_revision" = :obs,
                    "revisado_por_id" = :adm,
                    "fecha_revision" = NOW()
                WHERE "IdPagoPedido" = :op_id;
            """), {"est": estado_norm, "obs": obs_norm, "adm": admin_id, "op_id": op_id})
        else:
            sql_ab = text("""
                SELECT a."IdAbonoCuentaCobrar", a."IdUsuario"
                FROM public."AbonoCuentaCobrar" a
                WHERE a."IdAbonoCuentaCobrar" = :op_id;
            """)
            ab = db.execute(sql_ab, {"op_id": op_id}).fetchone()
            if not ab:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cobro / pago no encontrado")
            chofer_id = ab.IdUsuario
            db.execute(text("""
                UPDATE public."AbonoCuentaCobrar"
                SET "EstadoAprobacion" = :est,
                    "Observacion" = COALESCE("Observacion", '') || ' [' || :obs || ']',
                    "AprobadoPor" = :adm,
                    "FechaAprobacion" = NOW()
                WHERE "IdAbonoCuentaCobrar" = :op_id;
            """), {"est": estado_norm, "obs": obs_norm, "adm": admin_id, "op_id": op_id})

    db.commit()

    # Emitir WebSocket operacion_revisada al chofer
    if chofer_id:
        evento_ws = {
            "tipo": "operacion_revisada",
            "tipo_operacion": tipo_norm,
            "id_operacion": op_id,
            "estado_revision_web": estado_norm,
            "observacion_revision": obs_norm,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        try:
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(flota_ws_manager.emitir_a_chofer(chofer_id, evento_ws))
            except RuntimeError:
                asyncio.run(flota_ws_manager.emitir_a_chofer(chofer_id, evento_ws))
        except Exception as e:
            logger.debug(f"[WS operacion_revisada] Error: {e}")

    return {
        "codigo": "EXITO",
        "mensaje": f"Operación {tipo_norm} marcada como {estado_norm}",
        "datos": {
            "tipo": tipo_norm,
            "id": op_id,
            "estado_revision_web": estado_norm,
            "observacion": obs_norm
        }
    }


# -------------------------------------------------------------
# CIERRE Y LIQUIDACIÓN EXCLUSIVO DE ADMIN
# -------------------------------------------------------------
@RutaRouter.post("/asignaciones/{id}/finalizar-admin", response_model=dict)
def finalizar_ruta_admin(
    id: int,
    dto: Optional[FinalizarAdminRequest] = None,
    db: Session = Depends(get_db),
    usuario: dict = Depends(get_current_user),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Cierre y Liquidación Exclusivo de Admin:
    - Bloquea con 403 a usuarios con rol Chofer.
    - Valida que 0 operaciones de la ruta estén en PENDIENTE de revisión.
    - Al finalizar, pasa estado_operativo a FINALIZADA y libera al chofer.
    """
    # 1. Bloqueo 403 a usuarios con rol Chofer
    if usuario.get("IdRol") == ROL_AGENTE_REPARTO:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: El cierre y finalización de ruta es exclusivo del administrador."
        )

    if usuario.get("IdRol") not in PERMISOS_LOGISTICA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes para finalizar ruta"
        )

    asig_id = id

    sql_asig = text("""
        SELECT ar."IdAsignacionRuta", ar."IdUsuarioRepartidor", r."IdSucursal", ar."estado_operativo"
        FROM public."AsignacionRuta" ar
        JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE ar."IdAsignacionRuta" = :asig_id;
    """)
    asig = db.execute(sql_asig, {"asig_id": asig_id}).fetchone()
    if not asig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asignación de ruta no encontrada")

    alcance.validar_recurso(asig.IdSucursal, nombre_recurso="asignación de ruta", responder_404=True)

    # 2. Validar que 0 operaciones de la ruta estén en PENDIENTE de revisión
    sql_pend_entregas = text("""
        SELECT COUNT(*)
        FROM public."Pedido"
        WHERE "IdAsignacionRuta" = :asig_id
          AND COALESCE("estado_revision_web", 'PENDIENTE') = 'PENDIENTE';
    """)
    pend_entregas = db.execute(sql_pend_entregas, {"asig_id": asig_id}).scalar() or 0

    sql_pend_cobros = text("""
        SELECT COUNT(*)
        FROM public."PagoPedido" pp
        JOIN public."Pedido" p ON pp."IdPedido" = p."IdPedido"
        WHERE p."IdAsignacionRuta" = :asig_id
          AND COALESCE(pp."estado_revision_web", 'PENDIENTE') = 'PENDIENTE';
    """)
    pend_cobros = db.execute(sql_pend_cobros, {"asig_id": asig_id}).scalar() or 0

    total_pendientes = pend_entregas + pend_cobros
    if total_pendientes > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede finalizar la ruta: quedan {total_pendientes} operaciones pendientes de revisión ({pend_entregas} entregas, {pend_cobros} cobros)."
        )

    # 3. Guardar observacion_cierre_admin y pasar a FINALIZADA
    obs = dto.observacion_cierre_admin if dto else None
    km_final = dto.kilometraje_final if dto else None

    db.execute(text("""
        UPDATE public."AsignacionRuta"
        SET "estado_operativo" = 'FINALIZADA',
            "Estado" = 'Finalizada',
            "observacion_cierre_admin" = :obs,
            "cerrado_por_id" = :adm,
            "KilometrajeFinal" = COALESCE(:km, "KilometrajeFinal")
        WHERE "IdAsignacionRuta" = :asig_id;
    """), {
        "obs": obs,
        "adm": usuario["IdUsuario"],
        "km": km_final,
        "asig_id": asig_id
    })

    db.commit()

    return {
        "codigo": "EXITO",
        "mensaje": "Ruta finalizada exitosamente por administración. Chofer liberado para nueva asignación.",
        "datos": {
            "id_asignacion": asig_id,
            "estado_operativo": "FINALIZADA",
            "observacion_cierre_admin": obs
        }
    }


@RutaRouter.post("/asignaciones/{id}/reasignar-pendientes", response_model=dict)
def reasignar_paradas_pendientes(
    id: int,
    dto: ReasignarPendientesRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Reasigna las paradas/pedidos pendientes de una asignación que fue finalizada o abandonada
    hacia otro chofer o nueva asignación.
    """
    asig_id = id

    sql_ped_pend = text("""
        SELECT "IdPedido"
        FROM public."Pedido"
        WHERE "IdAsignacionRuta" = :asig_id
          AND "IdEstadoPedido" != 4;
    """)
    pedidos_pend = [r[0] for r in db.execute(sql_ped_pend, {"asig_id": asig_id}).fetchall()]

    if not pedidos_pend:
        return {
            "codigo": "EXITO",
            "mensaje": "No hay pedidos pendientes para reasignar en esta asignación",
            "paradas_reasignadas": 0
        }

    for pid in pedidos_pend:
        db.execute(text("""
            UPDATE public."Pedido"
            SET "IdUsuarioRepartidor" = :nuevo_chofer,
                "IdAsignacionRuta" = COALESCE(:nueva_asig, "IdAsignacionRuta"),
                "Observacion" = COALESCE("Observacion", '') || ' [Reasignado desde asig #' || :asig_id || ']'
            WHERE "IdPedido" = :pid;
        """), {
            "nuevo_chofer": dto.nuevo_id_chofer,
            "nueva_asig": dto.nueva_id_asignacion,
            "asig_id": asig_id,
            "pid": pid
        })

    db.commit()

    return {
        "codigo": "EXITO",
        "mensaje": f"Se reasignaron exitosamente {len(pedidos_pend)} pedidos pendientes al chofer #{dto.nuevo_id_chofer}",
        "datos": {
            "id_asignacion_origen": asig_id,
            "nuevo_id_chofer": dto.nuevo_id_chofer,
            "nueva_id_asignacion": dto.nueva_id_asignacion,
            "pedidos_reasignados": len(pedidos_pend)
        }
    }


# -------------------------------------------------------------
# UBICACIÓN BAJO DEMANDA (TELEMETRÍA)
# -------------------------------------------------------------
@RutaRouter.post("/telemetria/solicitar-ubicacion-actual", response_model=dict)
async def solicitar_ubicacion_actual_flota(
    db: Session = Depends(get_db),
    usuario: dict = Depends(require_role(PERMISOS_LOGISTICA)),
    alcance: AlcanceUsuario = Depends(DependenciaAlcanceSucursal)
):
    """
    Emite WebSocket solicitar_ubicacion_actual a todos los choferes conectados
    para que reporten su GPS en ese instante y retorna la lista de choferes
    indicando cuáles tienen ubicación en vivo y cuáles muestran su 'Última ubicación conocida' desde BD.
    """
    evento_solicitud = {
        "tipo": "solicitar_ubicacion_actual",
        "solicitado_por": usuario["IdUsuario"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await flota_ws_manager.emitir_a_todos_los_choferes(evento_solicitud)

    choferes_ws_activos = flota_ws_manager.obtener_choferes_conectados()

    filtro_suc = alcance.sucursal_efectiva
    sql_choferes = text("""
        SELECT 
            u."IdUsuario",
            u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "NombreCompleto",
            u."Celular",
            u."IdSucursal",
            t."IdAsignacionRuta",
            r."NombreRuta",
            t."Latitud",
            t."Longitud",
            t."Velocidad",
            t."Bateria",
            t."EstadoMovimiento",
            t."UltimaActualizacion"
        FROM public."Usuario" u
        LEFT JOIN public."TrackingChofer" t ON u."IdUsuario" = t."IdUsuarioRepartidor"
        LEFT JOIN public."AsignacionRuta" ar ON t."IdAsignacionRuta" = ar."IdAsignacionRuta"
        LEFT JOIN public."RutaDistribucion" r ON ar."IdRutaDistribucion" = r."IdRutaDistribucion"
        WHERE u."IdRol" = :rol_chofer
          AND u."IdEstadoUsuario" = 1
          AND (:suc_filtro IS NULL OR u."IdSucursal" = :suc_filtro)
        ORDER BY u."ApellidoPaterno" ASC;
    """)
    filas = db.execute(sql_choferes, {
        "rol_chofer": ROL_AGENTE_REPARTO,
        "suc_filtro": filtro_suc
    }).mappings().fetchall()

    lista_resultado = []
    for f in filas:
        uid = f["IdUsuario"]
        en_vivo = uid in choferes_ws_activos
        lista_resultado.append({
            "id_chofer": uid,
            "nombre_chofer": f["NombreCompleto"],
            "celular": f["Celular"],
            "id_asignacion_ruta": f["IdAsignacionRuta"],
            "nombre_ruta": f["NombreRuta"],
            "ubicacion_en_vivo": en_vivo,
            "origen_dato": "EN_VIVO" if en_vivo else "Última ubicación conocida",
            "latitud": float(f["Latitud"]) if f["Latitud"] is not None else None,
            "longitud": float(f["Longitud"]) if f["Longitud"] is not None else None,
            "velocidad": float(f["Velocidad"] or 0.0),
            "bateria": f["Bateria"],
            "estado_movimiento": "En Vivo" if en_vivo else (f["EstadoMovimiento"] or "Sin Señal"),
            "ultima_actualizacion": f["UltimaActualizacion"].isoformat() if f["UltimaActualizacion"] else None
        })

    return {
        "codigo": "EXITO",
        "mensaje": "Solicitud de ubicación actual emitida a la flota",
        "total_choferes": len(lista_resultado),
        "choferes_en_vivo_count": sum(1 for c in lista_resultado if c["ubicacion_en_vivo"]),
        "choferes": lista_resultado
    }


