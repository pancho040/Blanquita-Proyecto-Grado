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

    TIPOS_LOGISTICA_CHOFER = (
        'RUTA_ASIGNADA',
        'CARGA_APROBADA',
        'CARGA_OBSERVADA',
        'CARGA_RECHAZADA',
        'RUTA_REORDENADA',
        'OPERACION_REVISADA',
        'RUTA_FINALIZADA'
    )

    @staticmethod
    def limpiar_notificaciones_basura(session: Session) -> int:
        """
        Limpia y corrige notificaciones basura en BD que asignaron incorrectamente
        IdUsuarioDestinatario = NULL a alertas del ámbito logístico de choferes.
        Asocia el chofer correspondiente si existe en AsignacionRuta por CodigoReferencia.
        """
        stmt = text("""
            UPDATE public."NotificacionInterna" n
            SET "IdUsuarioDestinatario" = ar."IdUsuarioRepartidor"
            FROM public."AsignacionRuta" ar
            WHERE n."IdUsuarioDestinatario" IS NULL
              AND n."Tipo" IN ('RUTA_ASIGNADA', 'CARGA_APROBADA', 'CARGA_OBSERVADA', 'CARGA_RECHAZADA', 'RUTA_REORDENADA', 'OPERACION_REVISADA', 'RUTA_FINALIZADA')
              AND n."CodigoReferencia" = ar."IdAsignacionRuta";
        """)
        res = session.execute(stmt)
        return res.rowcount

    @staticmethod
    def listar_notificaciones(
        session: Session,
        id_usuario: int,
        solo_no_leidas: bool = True,
        id_rol: Optional[int] = None,
        sucursal_id: Optional[int] = None,
        puede_ver_todas: bool = False
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"uid": id_usuario}
        es_chofer = id_rol in (6, 7)

        join_clause = ""
        if es_chofer:
            # Aislamiento Estricto para Choferes (Rol 6 o 7):
            # Solo notificaciones dirigidas explícitamente a él y de ámbito logístico.
            # Excluye totalmente vales de caja chica, rendición de cuentas, cambios de precio o de otros choferes.
            condicion = """
                WHERE n."IdUsuarioDestinatario" = :uid
                  AND n."Tipo" IN ('RUTA_ASIGNADA', 'CARGA_APROBADA', 'CARGA_OBSERVADA', 'CARGA_RECHAZADA', 'RUTA_REORDENADA', 'OPERACION_REVISADA', 'RUTA_FINALIZADA')
            """
        else:
            # Ámbito Web / Supervisores / Administradores:
            if not puede_ver_todas and sucursal_id:
                params["suc_id"] = int(sucursal_id)
                join_clause = 'LEFT JOIN public."Usuario" u ON n."IdUsuarioDestinatario" = u."IdUsuario"'
                condicion = """
                    WHERE (
                        n."IdUsuarioDestinatario" = :uid
                        OR (
                            n."IdUsuarioDestinatario" IS NULL
                            AND (
                                u."IdSucursal" = :suc_id
                                OR u."IdSucursal" IS NULL
                                OR EXISTS (
                                    SELECT 1 FROM public."AsignacionRuta" ar_sub
                                    JOIN public."RutaDistribucion" rd_sub ON ar_sub."IdRutaDistribucion" = rd_sub."IdRutaDistribucion"
                                    WHERE ar_sub."IdAsignacionRuta" = n."CodigoReferencia" AND rd_sub."IdSucursal" = :suc_id
                                )
                            )
                        )
                    )
                """
            else:
                condicion = 'WHERE (n."IdUsuarioDestinatario" = :uid OR n."IdUsuarioDestinatario" IS NULL)'

        if solo_no_leidas:
            condicion += ' AND n."Leido" = false'

        stmt = text(f"""
            SELECT 
                n."IdNotificacion",
                n."Titulo",
                n."Mensaje",
                n."Tipo",
                n."CodigoReferencia",
                n."Leido",
                n."FechaCreacion"
            FROM public."NotificacionInterna" n
            {join_clause}
            {condicion}
            ORDER BY n."FechaCreacion" DESC
            LIMIT 50;
        """)
        rows = session.execute(stmt, params).fetchall()
        
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
