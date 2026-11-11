import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Servicio transversal para emisión de alertas internas (cambios de precio, notas editadas, vales de caja)
    y soporte del buscador numérico gerencial de Don Osvaldo.
    """

    def __init__(self, session: Optional[Session] = None):
        self.session = session

    def CrearNotificacion(
        self,
        id_usuario_destino: Optional[int] = None,
        titulo: str = "",
        mensaje: str = "",
        tipo: str = "INFO",
        codigo_referencia: Optional[int] = None,
        id_usuario_destinatario: Optional[int] = None,
        tipo_alerta: Optional[str] = None
    ) -> int:
        dest = id_usuario_destinatario if id_usuario_destinatario is not None else id_usuario_destino
        t = tipo_alerta or tipo
        if self.session:
            return self.crear_notificacion(self.session, titulo, mensaje, t, dest, codigo_referencia)
        else:
            from app.Config.supabase import SessionLocal
            with SessionLocal() as s:
                res = self.crear_notificacion(s, titulo, mensaje, t, dest, codigo_referencia)
                s.commit()
                return res

    @staticmethod
    def crear_notificacion(
        session: Session,
        titulo: str,
        mensaje: str,
        tipo: str,
        id_usuario_destinatario: Optional[int] = None,
        codigo_referencia: Optional[int] = None
    ) -> int:
        stmt = text("""
            INSERT INTO public."NotificacionInterna" (
                "IdUsuarioDestinatario",
                "Titulo",
                "Mensaje",
                "Tipo",
                "CodigoReferencia",
                "Leido",
                "FechaCreacion"
            ) VALUES (
                :uid,
                :titulo,
                :mensaje,
                :tipo,
                :codigo_ref,
                false,
                NOW()
            ) RETURNING "IdNotificacion";
        """)
        row = session.execute(stmt, {
            "uid": id_usuario_destinatario,
            "titulo": titulo,
            "mensaje": mensaje,
            "tipo": tipo,
            "codigo_ref": codigo_referencia
        }).fetchone()
        
        id_notif = row[0]

        # Invocar PushNotificationService si hay destinatario específico
        if id_usuario_destinatario:
            try:
                from app.Services.Movil.PushNotificationService import PushNotificationService
                tit_seg, msj_seg = PushNotificationService.sanitizar_mensaje_pantalla_bloqueo(titulo, mensaje)
                PushNotificationService.notificar_usuario(
                    session=session,
                    usuario_id=id_usuario_destinatario,
                    titulo=tit_seg,
                    mensaje=msj_seg,
                    datos_extra={"tipo": tipo, "codigo_referencia": codigo_referencia}
                )
            except Exception as e:
                logger.warning(f"[PushNotification] No se pudo enviar push a usuario {id_usuario_destinatario}: {e}")

        return id_notif

    @staticmethod
    def listar_notificaciones(
        session: Session,
        id_usuario: int,
        solo_no_leidas: bool = True
    ) -> List[Dict[str, Any]]:
        condicion = 'WHERE ("IdUsuarioDestinatario" = :uid OR "IdUsuarioDestinatario" IS NULL)'
        if solo_no_leidas:
            condicion += ' AND "Leido" = false'

        stmt = text(f"""
            SELECT 
                "IdNotificacion",
                "Titulo",
                "Mensaje",
                "Tipo",
                "CodigoReferencia",
                "Leido",
                "FechaCreacion"
            FROM public."NotificacionInterna"
            {condicion}
            ORDER BY "FechaCreacion" DESC
            LIMIT 50;
        """)
        rows = session.execute(stmt, {"uid": id_usuario}).fetchall()
        
        return [
            {
                "id": r.IdNotificacion,
                "titulo": r.Titulo,
                "mensaje": r.Mensaje,
                "tipo": r.Tipo,
                "codigo_referencia": r.CodigoReferencia,
                "leido": r.Leido,
                "fecha_creacion": r.FechaCreacion.isoformat() if r.FechaCreacion else None
            }
            for r in rows
        ]

    @staticmethod
    def marcar_como_leida(session: Session, id_notificacion: int) -> bool:
        stmt = text('UPDATE public."NotificacionInterna" SET "Leido" = true WHERE "IdNotificacion" = :id')
        res = session.execute(stmt, {"id": id_notificacion})
        return res.rowcount > 0
