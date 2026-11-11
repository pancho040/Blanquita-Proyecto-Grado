"""
Servicio de Notificaciones Push Expo (Fase 1 - Móvil)
Sistema ERP Papelera Blanquita

Cumple con:
1. Bandera de activación PUSH_NOTIFICACIONES_ACTIVO (default: False).
2. Contenido en pantalla de bloqueo estrictamente genérico: sin nombres de clientes,
   sin montos de dinero y sin emojis.
3. Envío en lote vía Expo Push Service (FCM V1).
"""

import os
import logging
from typing import List, Optional, Dict, Any
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)

PUSH_NOTIFICACIONES_ACTIVO = os.getenv("PUSH_NOTIFICACIONES_ACTIVO", "false").lower() == "true"
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Catálogo institucional de eventos de notificación push (Requisito B5)
# Pantalla de bloqueo estrictamente genérica: sin nombres de clientes, sin montos en Bs y sin emojis.
CATALOGO_NOTIFICACIONES = {
    "EVT_RUTA_ASIGNADA": {
        "codigo": "EVT_RUTA_ASIGNADA",
        "titulo_bloqueo": "Actualización de Hoja de Ruta",
        "mensaje_bloqueo": "Se ha asignado o modificado una hoja de ruta para su jornada de despacho.",
    },
    "EVT_PEDIDO_MODIFICADO": {
        "codigo": "EVT_PEDIDO_MODIFICADO",
        "titulo_bloqueo": "Nuevo Pedido Asignado",
        "mensaje_bloqueo": "Se han actualizado las paradas o pedidos en su itinerario operativo.",
    },
    "EVT_STOCK_ACTUALIZADO": {
        "codigo": "EVT_STOCK_ACTUALIZADO",
        "titulo_bloqueo": "Actualización de Carga",
        "mensaje_bloqueo": "El inventario de su camión ha sido modificado por supervisión.",
    },
    "EVT_AVISO_ADMIN": {
        "codigo": "EVT_AVISO_ADMIN",
        "titulo_bloqueo": "Aviso Administrativo",
        "mensaje_bloqueo": "Tiene un comunicado importante del área administrativa de la empresa.",
    },
}


class PushNotificationService:
    @staticmethod
    def sanitizar_mensaje_pantalla_bloqueo(titulo: str, mensaje: str) -> tuple[str, str]:
        """
        Garantiza que la notificación en pantalla bloqueada sea neutra y genérica:
        - Remueve emojis y caracteres especiales llamativos.
        - Evita nombres de clientes o montos en Bs.
        """
        # Títulos genéricos permitidos
        titulos_permitidos = {
            "RUTA": "Actualización de Hoja de Ruta",
            "PEDIDO": "Nuevo Pedido Asignado",
            "INVENTARIO": "Actualización de Carga",
            "SISTEMA": "Aviso Administrativo"
        }
        
        titulo_generico = "Aviso del Sistema ERP"
        for clave, val in titulos_permitidos.items():
            if clave in titulo.upper():
                titulo_generico = val
                break

        # Mensaje seguro y genérico
        mensaje_generico = "Tiene una nueva actualización pendiente en su aplicación móvil."
        return titulo_generico, mensaje_generico

    @classmethod
    def registrar_dispositivo(
        cls,
        session: Session,
        usuario_id: int,
        token_push: str,
        plataforma: str,
        version_app: Optional[str] = "1.0.0"
    ) -> Dict[str, Any]:
        stmt = text("""
            INSERT INTO public."DispositivoUsuario" (
                "usuario_id",
                "token_push",
                "plataforma",
                "version_app",
                "ultimo_uso",
                "activo",
                "created_at",
                "updated_at"
            ) VALUES (
                :uid,
                :token,
                :plat,
                :ver,
                NOW(),
                true,
                NOW(),
                NOW()
            )
            ON CONFLICT ("usuario_id", "token_push") DO UPDATE
            SET 
                "plataforma" = EXCLUDED."plataforma",
                "version_app" = EXCLUDED."version_app",
                "ultimo_uso" = NOW(),
                "activo" = true,
                "updated_at" = NOW()
            RETURNING "id", "usuario_id", "token_push", "plataforma", "version_app", "activo", "ultimo_uso";
        """)
        row = session.execute(stmt, {
            "uid": usuario_id,
            "token": token_push,
            "plat": plataforma,
            "ver": version_app
        }).fetchone()
        session.commit()

        return {
            "id": row[0],
            "usuario_id": row[1],
            "token_push": row[2],
            "plataforma": row[3],
            "version_app": row[4],
            "activo": row[5],
            "ultimo_uso": row[6],
        }

    @classmethod
    def desactivar_dispositivo(
        cls,
        session: Session,
        usuario_id: int,
        token_push: Optional[str] = None
    ) -> int:
        if token_push:
            stmt = text("""
                UPDATE public."DispositivoUsuario"
                SET "activo" = false, "updated_at" = NOW()
                WHERE "usuario_id" = :uid AND "token_push" = :token;
            """)
            res = session.execute(stmt, {"uid": usuario_id, "token": token_push})
        else:
            stmt = text("""
                UPDATE public."DispositivoUsuario"
                SET "activo" = false, "updated_at" = NOW()
                WHERE "usuario_id" = :uid;
            """)
            res = session.execute(stmt, {"uid": usuario_id})
        session.commit()
        return res.rowcount

    @classmethod
    def obtener_tokens_activos_usuario(cls, session: Session, usuario_id: int) -> List[str]:
        stmt = text("""
            SELECT "token_push"
            FROM public."DispositivoUsuario"
            WHERE "usuario_id" = :uid AND "activo" = true;
        """)
        rows = session.execute(stmt, {"uid": usuario_id}).fetchall()
        return [r[0] for r in rows if r[0]]

    @classmethod
    def notificar_usuario(
        cls,
        session: Session,
        usuario_id: int,
        titulo: str,
        mensaje: str,
        datos_extra: Optional[Dict[str, Any]] = None,
        background_tasks=None
    ) -> Dict[str, Any]:
        """
        Obtiene los tokens activos del usuario y envía la notificación push sanitizada
        (cero montos en Bs. y cero nombres de clientes en pantalla de bloqueo).
        """
        titulo_seguro, mensaje_seguro = cls.sanitizar_mensaje_pantalla_bloqueo(titulo, mensaje)
        tokens = cls.obtener_tokens_activos_usuario(session, usuario_id)
        if not tokens:
            return {"enviados": 0, "modo": "sin_dispositivos"}
        if background_tasks:
            cls.enviar_asincrono_background(background_tasks, tokens, titulo_seguro, mensaje_seguro, datos_extra)
            return {"enviados": len(tokens), "modo": "background"}
        else:
            return cls.enviar_notificacion(tokens, titulo_seguro, mensaje_seguro, datos_extra)

    @classmethod
    def enviar_notificacion(
        cls,
        tokens: List[str],
        titulo: str,
        mensaje: str,
        datos_extra: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Envía notificaciones push a una lista de tokens de Expo.
        Si la bandera PUSH_NOTIFICACIONES_ACTIVO está apagada, ejecuta un mock logueado.
        """
        if not tokens:
            return {"enviados": 0, "modo": "ninguno"}

        titulo_seguro, mensaje_seguro = cls.sanitizar_mensaje_pantalla_bloqueo(titulo, mensaje)

        if not PUSH_NOTIFICACIONES_ACTIVO:
            logger.info(
                f"[MOCK PUSH] PUSH_NOTIFICACIONES_ACTIVO=False. "
                f"Simulando envío a {len(tokens)} dispositivo(s). "
                f"Título: '{titulo_seguro}', Mensaje: '{mensaje_seguro}', Extra: {datos_extra}"
            )
            return {
                "enviados": len(tokens),
                "modo": "mock",
                "detalle": "Notificación simulada con éxito (bandera apagada)"
            }

        # Envío real a Expo Push Service
        mensajes = [
            {
                "to": token,
                "sound": "default",
                "title": titulo_seguro,
                "body": mensaje_seguro,
                "data": datos_extra or {},
                "priority": "high",
                "channelId": "default"
            }
            for token in tokens if token.startswith("ExponentPushToken") or token.startswith("ExpoPushToken")
        ]

        if not mensajes:
            return {"enviados": 0, "modo": "real", "error": "Ningún token válido de Expo"}

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    EXPO_PUSH_URL,
                    json=mensajes,
                    headers={
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip, deflate",
                        "Content-Type": "application/json"
                    }
                )
                return {
                    "enviados": len(mensajes),
                    "modo": "real",
                    "status_code": resp.status_code,
                    "resultado": resp.json() if resp.status_code == 200 else resp.text
                }
        except Exception as e:
            logger.error(f"[PUSH ERROR] Fallo al conectar con Expo Push Service: {e}")
            return {"enviados": 0, "modo": "real", "error": str(e)}

    @classmethod
    def _ejecutar_envio_con_reintentos(
        cls,
        tokens: List[str],
        titulo: str,
        mensaje: str,
        datos_extra: Optional[Dict[str, Any]] = None,
        max_reintentos: int = 3
    ) -> None:
        """Envía notificaciones con reintentos acotados en background."""
        import time
        intento = 0
        while intento < max_reintentos:
            intento += 1
            res = cls.enviar_notificacion(tokens, titulo, mensaje, datos_extra)
            if res.get("modo") == "mock" or (res.get("modo") == "real" and res.get("status_code") == 200):
                logger.info(f"[PUSH BG] Envío completado con éxito en intento {intento}.")
                return
            logger.warning(f"[PUSH BG] Intento {intento}/{max_reintentos} fallido. Reintentando...")
            time.sleep(1.0 * intento)

    @classmethod
    def enviar_asincrono_background(
        cls,
        background_tasks,
        tokens: List[str],
        titulo: str,
        mensaje: str,
        datos_extra: Optional[Dict[str, Any]] = None,
        max_reintentos: int = 3
    ) -> None:
        """
        Encola el envío de push en las BackgroundTasks de FastAPI sin bloquear el ciclo de respuesta HTTP.
        """
        if background_tasks:
            background_tasks.add_task(
                cls._ejecutar_envio_con_reintentos,
                tokens=tokens,
                titulo=titulo,
                mensaje=mensaje,
                datos_extra=datos_extra,
                max_reintentos=max_reintentos
            )
        else:
            cls._ejecutar_envio_con_reintentos(tokens, titulo, mensaje, datos_extra, max_reintentos)
