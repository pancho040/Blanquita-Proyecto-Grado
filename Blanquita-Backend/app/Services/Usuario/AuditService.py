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
        id_registro: str,
        detalles: Optional[Dict[str, Any]] = None
    ) -> int:
        if self.session:
            return self.registrar_evento(
                session=self.session,
                id_usuario=id_usuario,
                usuario_nombre="Usuario Sistema",
                rol="Operador",
                modulo_tabla=tabla,
                accion=accion,
                id_registro=id_registro,
                detalle=json.dumps(detalles or {}),
                datos_nuevos=detalles
            )
        return 0

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
