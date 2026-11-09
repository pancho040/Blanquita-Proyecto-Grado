import json
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class AuditService:
    """
    Servicio transversal para auditoría forense de operaciones sensibles
    (cambios de precios vigentes, revalorización de choferes, ediciones de notas y caja).
    """

    def __init__(self, session: Optional[Session] = None):
        self.session = session

    def RegistrarAccion(
        self,
        id_usuario: int,
        accion: str,
        tabla: str,
        id_registro: Any,
        detalles: Optional[Dict[str, Any]] = None,
        detalle: Optional[Any] = None,
        **kwargs
    ) -> int:
        datos_detalle = detalles if detalles is not None else detalle
        if isinstance(datos_detalle, dict):
            detalle_json = json.dumps(datos_detalle, default=str)
            datos_dict = datos_detalle
        elif isinstance(datos_detalle, str):
            detalle_json = datos_detalle
            datos_dict = {"detalle": datos_detalle}
        else:
            detalle_json = json.dumps(datos_detalle or {}, default=str)
            datos_dict = datos_detalle if isinstance(datos_detalle, dict) else None

        if self.session:
            return self.registrar_evento(
                session=self.session,
                id_usuario=id_usuario,
                usuario_nombre="Usuario Sistema",
                rol="Operador",
                modulo_tabla=tabla,
                accion=accion,
                id_registro=str(id_registro),
                detalle=detalle_json,
                datos_nuevos=datos_dict
            )
        else:
            from app.Config.supabase import SessionLocal
            with SessionLocal() as s:
                res = self.registrar_evento(
                    session=s,
                    id_usuario=id_usuario,
                    usuario_nombre="Usuario Sistema",
                    rol="Operador",
                    modulo_tabla=tabla,
                    accion=accion,
                    id_registro=str(id_registro),
                    detalle=detalle_json,
                    datos_nuevos=datos_dict
                )
                s.commit()
                return res

    RegistrarAuditoria = RegistrarAccion

    @staticmethod
    def registrar_evento(
        session: Session,
        id_usuario: int,
        usuario_nombre: str,
        rol: str,
        modulo_tabla: str,
        accion: str,
        id_registro: str,
        detalle: str,
        datos_anteriores: Optional[Dict[str, Any]] = None,
        datos_nuevos: Optional[Dict[str, Any]] = None
    ) -> int:
        stmt = text("""
            INSERT INTO public."AuditLog" (
                "FechaHora",
                "IdUsuario",
                "Accion",
                "TablaAfectada",
                "IdRegistroAfectado",
                "Detalle"
            ) VALUES (
                NOW(),
                :uid,
                :accion,
                :tabla,
                :id_reg,
                :detalle
            ) RETURNING "IdAuditLog";
        """)

        row = session.execute(stmt, {
            "uid": id_usuario,
            "accion": accion,
            "tabla": modulo_tabla,
            "id_reg": str(id_registro),
            "detalle": detalle
        }).fetchone()

        return row[0] if row else 0
