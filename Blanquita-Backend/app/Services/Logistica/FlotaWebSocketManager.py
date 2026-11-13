import time
import secrets
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class FlotaWebSocketManager:
    """
    Hub de WebSockets en memoria para telemetría y mapa de flota en tiempo real.
    
    Arquitectura de Despliegue en Render:
    - Diseñado para ejecución en una sola instancia de Render Web Service.
    - Autenticación segura mediante tickets de un solo uso y corta vida (30-60s),
      evitando exponer tokens JWT en logs de proxy o URLs del navegador.
    - Soporta filtrado multi-sucursal según el alcance del usuario (Sucre / Potosí / Nacional).
    - Incluye soporte de heartbeat (ping/pong) cada 25s para mantener vivas las conexiones
      ante el timeout de 30-55s de los proxies perimetrales de Render (Cloudflare/Envoy).
    
    NOTA MULTI-INSTANCIA: Si el servicio se escala a 2 o más réplicas en Render, las conexiones
    en memoria no se comparten. Para multi-instancia se requerirá integrar Redis Pub/Sub o Dragonfly.
    """

    def __init__(self):
        # Conexiones activas: websocket -> metadata { "sucursales_permitidas": Optional[List[int]], "usuario_id": int }
        self.active_connections: Dict[WebSocket, Dict[str, Any]] = {}
        # Tickets efímeros: ticket_str -> { "expira_en": float, "usuario_id": int, "sucursales_permitidas": Optional[List[int]] }
        self.tickets_efimeros: Dict[str, Dict[str, Any]] = {}

    def limpiar_tickets_expirados(self):
        """Elimina de memoria los tickets cuyo tiempo de validez ha expirado."""
        ahora = time.time()
        expirados = [t for t, v in self.tickets_efimeros.items() if ahora > v["expira_en"]]
        for t in expirados:
            self.tickets_efimeros.pop(t, None)

    def crear_ticket(
        self,
        usuario_id: int,
        sucursales_permitidas: Optional[List[int]] = None,
        duracion_segundos: int = 60,
        rol: Optional[int] = None
    ) -> str:
        """
        Emite un ticket efímero de un solo uso y corta vida para establecer la conexión WebSocket.
        """
        self.limpiar_tickets_expirados()
        ticket = f"ws_flota_{secrets.token_urlsafe(24)}"
        self.tickets_efimeros[ticket] = {
            "expira_en": time.time() + duracion_segundos,
            "usuario_id": usuario_id,
            "id_chofer": usuario_id,
            "rol": rol,
            "sucursales_permitidas": sucursales_permitidas
        }
        return ticket

    def validar_y_consumir_ticket(self, ticket: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Valida que el ticket exista, no esté expirado y sea consumido inmediatamente (un solo uso).
        Retorna los metadatos de usuario y alcance, o None si no es válido.
        """
        if not ticket:
            return None
        self.limpiar_tickets_expirados()
        ticket_data = self.tickets_efimeros.pop(ticket, None)
        if not ticket_data:
            return None
        if time.time() > ticket_data["expira_en"]:
            return None
        return ticket_data

    async def conectar(
        self,
        websocket: WebSocket,
        ticket_data: Dict[str, Any],
        snapshot_inicial: Optional[List[dict]] = None
    ):
        """
        Acepta la conexión WebSocket, la registra en el hub y emite el snapshot inicial de choferes.
        """
        try:
            from starlette.websockets import WebSocketState
            if getattr(websocket, "client_state", None) == WebSocketState.CONNECTING:
                await websocket.accept()
        except Exception:
            try:
                await websocket.accept()
            except Exception:
                pass

        self.active_connections[websocket] = {
            "usuario_id": ticket_data.get("usuario_id"),
            "id_chofer": ticket_data.get("id_chofer") or ticket_data.get("usuario_id"),
            "rol": ticket_data.get("rol"),
            "tipo_cliente": ticket_data.get("tipo_cliente", "web"),
            "sucursales_permitidas": ticket_data.get("sucursales_permitidas")
        }
        logger.info(
            f"[WS-Flota] Cliente conectado (Usuario #{ticket_data.get('usuario_id')}, "
            f"Tipo: {ticket_data.get('tipo_cliente', 'web')}, "
            f"Sucursales: {ticket_data.get('sucursales_permitidas') or 'Todas'}). "
            f"Conexiones activas: {len(self.active_connections)}"
        )

        if snapshot_inicial is not None:
            try:
                # Filtrar snapshot inicial según las sucursales permitidas
                suc_permitidas = ticket_data.get("sucursales_permitidas")
                if suc_permitidas is not None:
                    snapshot_filtrado = [
                        c for c in snapshot_inicial
                        if c.get("IdSucursal") in suc_permitidas or c.get("id_sucursal") in suc_permitidas
                    ]
                else:
                    snapshot_filtrado = snapshot_inicial

                await websocket.send_json({
                    "tipo": "SNAPSHOT_INICIAL",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "choferes": snapshot_filtrado
                })
            except Exception as e:
                logger.warning(f"[WS-Flota] Error al enviar snapshot inicial: {e}")

    def desconectar(self, websocket: WebSocket):
        """Remueve la conexión WebSocket del conjunto de observadores activos."""
        if websocket in self.active_connections:
            meta = self.active_connections.pop(websocket)
            logger.info(
                f"[WS-Flota] Cliente desconectado (Usuario #{meta.get('usuario_id')}). "
                f"Conexiones restantes: {len(self.active_connections)}"
            )

    async def responder_pong(self, websocket: WebSocket):
        """Responde a un mensaje de heartbeat ping."""
        try:
            await websocket.send_json({
                "tipo": "pong",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception:
            self.desconectar(websocket)

    def obtener_choferes_conectados(self) -> set:
        """Retorna el conjunto de IDs de choferes con conexión WebSocket activa."""
        conectados = set()
        for meta in self.active_connections.values():
            uid = meta.get("id_chofer") or meta.get("usuario_id")
            if uid:
                conectados.add(int(uid))
        return conectados

    async def emitir_a_chofer(self, id_chofer: int, evento: Dict[str, Any]):
        """Envía un evento WebSocket directamente al chofer especificado."""
        conexiones_cerradas = []
        destinatario_encontrado = False
        for ws, meta in list(self.active_connections.items()):
            uid = meta.get("id_chofer") or meta.get("usuario_id")
            if uid and int(uid) == int(id_chofer):
                destinatario_encontrado = True
                try:
                    await ws.send_json(evento)
                except Exception as e:
                    logger.debug(f"[WS-Flota] Error al emitir a chofer #{id_chofer}: {e}")
                    conexiones_cerradas.append(ws)

        for ws in conexiones_cerradas:
            self.desconectar(ws)

        # También notificar a observadores web sobre este cambio operativo
        await self.emitir_a_web(evento)
        return destinatario_encontrado

    async def emitir_a_todos_los_choferes(self, evento: Dict[str, Any]):
        """Emite un evento a todos los choferes conectados."""
        conexiones_cerradas = []
        for ws, meta in list(self.active_connections.items()):
            try:
                await ws.send_json(evento)
            except Exception as e:
                logger.debug(f"[WS-Flota] Error en broadcast a chofer: {e}")
                conexiones_cerradas.append(ws)

        for ws in conexiones_cerradas:
            self.desconectar(ws)

    async def emitir_a_web(self, evento: Dict[str, Any], sucursal_id: Optional[int] = None):
        """Envía un evento a los observadores web activos."""
        conexiones_cerradas = []
        for ws, meta in list(self.active_connections.items()):
            if meta.get("tipo_cliente") == "movil":
                continue
            suc_permitidas = meta.get("sucursales_permitidas")
            if suc_permitidas is not None and sucursal_id is not None:
                if sucursal_id not in suc_permitidas:
                    continue
            try:
                await ws.send_json(evento)
            except Exception as e:
                logger.debug(f"[WS-Flota] Error en emitir_a_web: {e}")
                conexiones_cerradas.append(ws)

        for ws in conexiones_cerradas:
            self.desconectar(ws)

    async def broadcast_general(self, evento: Dict[str, Any]):
        """Envía un evento a todas las conexiones WebSocket activas."""
        conexiones_cerradas = []
        for ws in list(self.active_connections.keys()):
            try:
                await ws.send_json(evento)
            except Exception as e:
                logger.debug(f"[WS-Flota] Error en broadcast_general: {e}")
                conexiones_cerradas.append(ws)

        for ws in conexiones_cerradas:
            self.desconectar(ws)

    async def broadcast_ubicacion(self, datos: Dict[str, Any]):
        """
        Difunde la ubicación satelital de un chofer a todos los clientes web conectados
        cuyo alcance de sucursal coincida con la sucursal del chofer.
        """
        if not self.active_connections:
            return

        sucursal_chofer = datos.get("sucursal_id") or datos.get("IdSucursal")
        
        # Mensaje estandarizado mínimo requerido por el protocolo
        mensaje = {
            "tipo": "POSICION_CHOFER",
            "id_chofer": datos.get("id_chofer") or datos.get("IdUsuarioRepartidor"),
            "sucursal_id": sucursal_chofer,
            "lat": datos.get("lat") or datos.get("Latitud"),
            "lng": datos.get("lng") or datos.get("Longitud"),
            "velocidad": datos.get("velocidad") or datos.get("VelocidadKmH") or 0.0,
            "bateria": datos.get("bateria") or datos.get("NivelBateria") or 100,
            "timestamp": datos.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "conectado": True
        }

        conexiones_cerradas = []
        for ws, meta in list(self.active_connections.items()):
            # Filtrado estricto por sucursal
            suc_permitidas = meta.get("sucursales_permitidas")
            if suc_permitidas is not None and sucursal_chofer is not None:
                if sucursal_chofer not in suc_permitidas:
                    continue

            try:
                await ws.send_json(mensaje)
            except Exception as e:
                logger.debug(f"[WS-Flota] Error al enviar a cliente; marcando desconexión: {e}")
                conexiones_cerradas.append(ws)

        for ws in conexiones_cerradas:
            self.desconectar(ws)


# Singleton en memoria para el proceso FastAPI en Render
flota_ws_manager = FlotaWebSocketManager()
