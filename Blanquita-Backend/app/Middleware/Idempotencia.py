"""
Módulo de Gestión de Idempotencia Transaccional (Fase 1 - Móvil)
Sistema ERP Papelera Blanquita

Garantiza que peticiones repetidas (por reintentos offline, pérdida de conexión o timeout)
no dupliquen cobros, entregas ni transacciones financieras.
"""

import re
import json
import hashlib
from typing import Optional, Dict, Any, Tuple
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

UUID_V4_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE
)


class IdempotenciaService:
    @staticmethod
    def validar_formato_clave(clave: str) -> None:
        if not clave or not UUID_V4_REGEX.match(clave):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de X-Idempotency-Key inválido. Debe ser un UUID v4 válido."
            )

    @staticmethod
    def calcular_hash_cuerpo(cuerpo_bytes: bytes) -> str:
        return hashlib.sha256(cuerpo_bytes).hexdigest()

    @staticmethod
    def consultar_registro(
        session: Session,
        usuario_id: int,
        clave: str
    ) -> Optional[Dict[str, Any]]:
        stmt = text("""
            SELECT 
                "id",
                "usuario_id",
                "clave_idempotencia",
                "endpoint",
                "hash_cuerpo",
                "codigo_estado",
                "cuerpo_respuesta"
            FROM public."ClaveIdempotenciaProcesada"
            WHERE "usuario_id" = :uid AND "clave_idempotencia" = :clave
            LIMIT 1;
        """)
        row = session.execute(stmt, {"uid": usuario_id, "clave": clave}).fetchone()
        if row:
            return {
                "id": row[0],
                "usuario_id": row[1],
                "clave_idempotencia": row[2],
                "endpoint": row[3],
                "hash_cuerpo": row[4],
                "codigo_estado": row[5],
                "cuerpo_respuesta": row[6],
            }
        return None

    @staticmethod
    def registrar_respuesta(
        session: Session,
        usuario_id: int,
        clave: str,
        endpoint: str,
        hash_cuerpo: str,
        codigo_estado: int,
        cuerpo_respuesta: Any
    ) -> None:
        # Solo respuestas exitosas (2xx) se cachean en idempotencia.
        # Errores de cliente (4xx) y servidor (5xx) NUNCA se cachean para permitir
        # correcciones de payload y reintentos legítimos sin bloquear al usuario.
        if codigo_estado < 200 or codigo_estado >= 300:
            return

        stmt = text("""
            INSERT INTO public."ClaveIdempotenciaProcesada" (
                "usuario_id",
                "clave_idempotencia",
                "endpoint",
                "hash_cuerpo",
                "codigo_estado",
                "cuerpo_respuesta",
                "fecha_creacion"
            ) VALUES (
                :uid,
                :clave,
                :endpoint,
                :hash,
                :codigo,
                CAST(:cuerpo AS jsonb),
                NOW()
            )
            ON CONFLICT ("usuario_id", "clave_idempotencia") DO NOTHING;
        """)
        payload_json = json.dumps(cuerpo_respuesta) if not isinstance(cuerpo_respuesta, str) else cuerpo_respuesta
        session.execute(stmt, {
            "uid": usuario_id,
            "clave": clave,
            "endpoint": endpoint,
            "hash": hash_cuerpo,
            "codigo": codigo_estado,
            "cuerpo": payload_json,
        })
        session.flush()

    @classmethod
    def verificar_y_recuperar(
        cls,
        session: Session,
        usuario_id: int,
        clave: Optional[str],
        cuerpo_bytes: bytes,
        endpoint: str
    ) -> Tuple[Optional[str], Optional[JSONResponse]]:
        """
        Retorna (hash_cuerpo, respuesta_cacheada).
        Si la respuesta está en caché con el mismo hash, retorna JSONResponse con cabecera X-Cache-Lookup: HIT.
        Si la clave existe pero el hash no coincide, lanza HTTP 409 Conflict.
        Si no hay clave o no existe en BD, retorna (hash_cuerpo, None).
        """
        if not clave:
            return None, None

        cls.validar_formato_clave(clave)
        hash_actual = cls.calcular_hash_cuerpo(cuerpo_bytes)

        registro = cls.consultar_registro(session, usuario_id, clave)
        if registro:
            if registro["hash_cuerpo"] == hash_actual:
                # HIT de idempotencia
                return hash_actual, JSONResponse(
                    status_code=registro["codigo_estado"],
                    content=registro["cuerpo_respuesta"],
                    headers={"X-Cache-Lookup": "HIT"}
                )
            else:
                # Mismo ID de idempotencia con payload distinto -> 409 Conflict
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Conflicto de idempotencia: La clave ya fue utilizada con una carga útil diferente."
                )

        return hash_actual, None
