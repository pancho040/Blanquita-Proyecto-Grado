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
                fecha_hora,
                id_usuario,
                usuario_nombre,
                rol,
                modulo_tabla,
                accion,
                id_registro,
                detalle,
                datos_anteriores,
                datos_nuevos
            ) VALUES (
                NOW(),
                :uid,
                :unombre,
                :rol,
                :tabla,
                :accion,
                :id_reg,
                :detalle,
                :ant::jsonb,
                :nuev::jsonb
            ) RETURNING id;
        """)

        row = session.execute(stmt, {
            "uid": id_usuario,
            "unombre": usuario_nombre,
            "rol": rol,
            "tabla": modulo_tabla,
            "accion": accion,
            "id_reg": str(id_registro),
            "detalle": detalle,
            "ant": json.dumps(datos_anteriores) if datos_anteriores else None,
            "nuev": json.dumps(datos_nuevos) if datos_nuevos else None
        }).fetchone()

        return row[0]
