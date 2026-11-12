"""
Servicio de Gestión de Refresh Tokens Móviles con Rotación y Detección de Reutilización
Sistema ERP Papelera Blanquita - Fase Repartidores

Políticas:
- Access token: Corto (<= 2 horas, típicamente 3600 s)
- Refresh token: Largo (30 días), guardado únicamente como SHA-256 en BD
- Rotación en cada refresh: Emisión de nuevo access + nuevo refresh, marcando el anterior como ROTADO
- Detección de reutilización (Reuse Detection): Si se presenta un token ya rotado, se revoca de inmediato
  toda la familia de tokens asociada (posible robo de sesión)
- Códigos de error específicos: TOKEN_EXPIRADO y TOKEN_INVALIDO
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.Auth.Jwt import crear_access_token_movil


class RefreshTokenService:
    PREFIJO_TOKEN = "blq_ref_"
    DIAS_EXPIRACION = 30

    @classmethod
    def _calcular_hash(cls, token_crudo: str) -> str:
        return hashlib.sha256(token_crudo.encode("utf-8")).hexdigest()

    @classmethod
    def crear_refresh_token(
        cls,
        session: Session,
        usuario_id: int,
        supabase_refresh_token: Optional[str] = None,
        dispositivo_id: Optional[str] = None,
        familia_id: Optional[str] = None,
        dias_validez: int = DIAS_EXPIRACION
    ) -> Tuple[str, datetime, str]:
        """
        Crea y persiste un nuevo refresh token de larga vida en la BD.
        Retorna (token_crudo, fecha_expiracion, familia_id).
        """
        token_crudo = f"{cls.PREFIJO_TOKEN}{secrets.token_hex(32)}"
        token_hash = cls._calcular_hash(token_crudo)
        familia = familia_id or str(uuid.uuid4())
        expira_en = datetime.now(timezone.utc) + timedelta(days=dias_validez)

        sql_insert = text("""
            INSERT INTO public."RefreshTokenMovil" (
                "usuario_id", "token_hash", "familia_id", "dispositivo_id",
                "supabase_refresh_token", "expira_en", "revocado",
                "creado_en", "actualizado_en"
            ) VALUES (
                :uid, :thash, :fid, :did,
                :sref, :exp, false,
                NOW(), NOW()
            );
        """)
        session.execute(sql_insert, {
            "uid": usuario_id,
            "thash": token_hash,
            "fid": familia,
            "did": dispositivo_id,
            "sref": supabase_refresh_token,
            "exp": expira_en
        })
        session.flush()

        return token_crudo, expira_en, familia

    @classmethod
    def _generar_access_token_para_usuario(cls, session: Session, usuario_id: int) -> str:
        """Genera un Access Token JWT con todos los claims de Supabase y RBAC para el usuario."""
        sql_u = text("""
            SELECT "IdUsuario", "IdRol", "AuthUserId", "Ci", "IsAdmin"
            FROM public."Usuario"
            WHERE "IdUsuario" = :uid
            LIMIT 1;
        """)
        u = session.execute(sql_u, {"uid": usuario_id}).mappings().fetchone()
        if not u:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"codigo": "USUARIO_NO_ENCONTRADO", "mensaje": "Usuario no encontrado", "detail": "Usuario no encontrado"}
            )
        ci_str = str(u.get("Ci") or usuario_id)
        return crear_access_token_movil(
            usuario_id=u["IdUsuario"],
            rol_id=u["IdRol"],
            auth_user_id=str(u["AuthUserId"]) if u["AuthUserId"] else None,
            correo=f"{ci_str}@papelerablanquita.com",
            is_admin=bool(u.get("IsAdmin", False)),
            expira_segundos=3600
        )

    @classmethod
    def rotar_refresh_token(
        cls,
        session: Session,
        refresh_token_crudo: str,
        auth_service: Optional[Any] = None,
        dispositivo_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Valida el refresh token, detecta posible reutilización maliciosa,
        verifica el estado del usuario, y rota generando un nuevo par de tokens.
        """
        if not refresh_token_crudo or not refresh_token_crudo.startswith(cls.PREFIJO_TOKEN):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"codigo": "TOKEN_INVALIDO", "mensaje": "Token no válido o malformado", "detail": "Token no válido o malformado"}
            )

        token_hash = cls._calcular_hash(refresh_token_crudo)

        sql_buscar = text("""
            SELECT "id", "usuario_id", "token_hash", "familia_id", "dispositivo_id",
                   "supabase_refresh_token", "expira_en", "revocado", "motivo_revocacion", "fecha_revocacion"
            FROM public."RefreshTokenMovil"
            WHERE "token_hash" = :thash
            LIMIT 1;
        """)
        fila = session.execute(sql_buscar, {"thash": token_hash}).mappings().fetchone()

        if not fila:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"codigo": "TOKEN_INVALIDO", "mensaje": "Refresh token inexistente o revocado", "detail": "Refresh token inexistente o revocado"}
            )

        familia_id = fila["familia_id"]
        usuario_id = fila["usuario_id"]
        id_registro = fila["id"]

        # 1. Detección de Reutilización (Token Reuse Detection)
        if fila["revocado"]:
            # Si alguien intenta reusar un token revocado/rotado, revocamos toda la familia
            session.execute(text("""
                UPDATE public."RefreshTokenMovil"
                SET "revocado" = true,
                    "motivo_revocacion" = 'REUTILIZACION_DETECTADA',
                    "fecha_revocacion" = NOW()
                WHERE "familia_id" = :fid;
            """), {"fid": familia_id})
            session.commit()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "codigo": "TOKEN_INVALIDO",
                    "mensaje": "Sesión revocada por detección de reutilización de token. Inicie sesión nuevamente.",
                    "detail": "Sesión revocada por detección de reutilización de token. Inicie sesión nuevamente."
                }
            )

        # 2. Expiración de 30 días
        ahora_utc = datetime.now(timezone.utc)
        expira_en = fila["expira_en"]
        if expira_en.tzinfo is None:
            expira_en = expira_en.replace(tzinfo=timezone.utc)

        if ahora_utc > expira_en:
            session.execute(text("""
                UPDATE public."RefreshTokenMovil"
                SET "revocado" = true,
                    "motivo_revocacion" = 'EXPIRADO',
                    "fecha_revocacion" = NOW()
                WHERE "id" = :rid;
            """), {"rid": id_registro})
            session.commit()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"codigo": "TOKEN_EXPIRADO", "mensaje": "Refresh token expirado. Inicie sesión nuevamente.", "detail": "Refresh token expirado. Inicie sesión nuevamente."}
            )

        # 3. Validar estado del usuario en tiempo real
        estado_usuario = session.execute(text("""
            SELECT "IdEstadoUsuario" FROM public."Usuario" WHERE "IdUsuario" = :uid LIMIT 1;
        """), {"uid": usuario_id}).scalar()

        if estado_usuario != 1:  # 1 = ACTIVO
            session.execute(text("""
                UPDATE public."RefreshTokenMovil"
                SET "revocado" = true,
                    "motivo_revocacion" = 'USUARIO_INACTIVO',
                    "fecha_revocacion" = NOW()
                WHERE "familia_id" = :fid;
            """), {"fid": familia_id})
            session.commit()

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"codigo": "USUARIO_INACTIVO", "mensaje": "Usuario inactivo, no puede operar el sistema", "detail": "Usuario inactivo, no puede operar el sistema"}
            )

        # 4. Rotar en Supabase Auth si hay token asociado y servicio activo
        nuevo_access_token = None
        nuevo_supabase_refresh = fila["supabase_refresh_token"]

        if auth_service and fila["supabase_refresh_token"]:
            try:
                res_sb = auth_service.RefreshAccessToken(fila["supabase_refresh_token"])
                nuevo_access_token = res_sb.get("AccessToken")
                if res_sb.get("RefreshTokenCrudo"):
                    nuevo_supabase_refresh = res_sb["RefreshTokenCrudo"]
            except Exception:
                # Si Supabase no responde o rechaza el token de proveedor, no bloqueamos al chofer
                nuevo_access_token = None

        # Si Supabase no emitió nuevo token o no está configurado, generar token directo de alta compatibilidad
        if not nuevo_access_token:
            nuevo_access_token = cls._generar_access_token_para_usuario(session, usuario_id)

        # 5. Marcar token actual como ROTADO
        session.execute(text("""
            UPDATE public."RefreshTokenMovil"
            SET "revocado" = true,
                "motivo_revocacion" = 'ROTADO',
                "fecha_revocacion" = NOW()
            WHERE "id" = :rid;
        """), {"rid": id_registro})

        # 6. Generar nuevo refresh token vinculado a la misma familia
        nuevo_token_crudo, nueva_expiracion, _ = cls.crear_refresh_token(
            session=session,
            usuario_id=usuario_id,
            supabase_refresh_token=nuevo_supabase_refresh,
            dispositivo_id=dispositivo_id or fila["dispositivo_id"],
            familia_id=familia_id,
            dias_validez=cls.DIAS_EXPIRACION
        )

        session.commit()

        return {
            "access_token": nuevo_access_token,
            "refresh_token": nuevo_token_crudo,
            "token_type": "bearer",
            "expires_in": 3600
        }

    @classmethod
    def revocar_sesiones_usuario(cls, session: Session, usuario_id: int, motivo: str = "LOGOUT") -> int:
        """Revoca todas las sesiones activas de un usuario."""
        res = session.execute(text("""
            UPDATE public."RefreshTokenMovil"
            SET "revocado" = true,
                "motivo_revocacion" = :motivo,
                "fecha_revocacion" = NOW()
            WHERE "usuario_id" = :uid AND "revocado" = false;
        """), {"uid": usuario_id, "motivo": motivo})
        session.commit()
        return res.rowcount

    @classmethod
    def revocar_token(cls, session: Session, refresh_token_crudo: str, motivo: str = "LOGOUT") -> bool:
        """Revoca un refresh token específico."""
        if not refresh_token_crudo or not refresh_token_crudo.startswith(cls.PREFIJO_TOKEN):
            return False
        token_hash = cls._calcular_hash(refresh_token_crudo)
        res = session.execute(text("""
            UPDATE public."RefreshTokenMovil"
            SET "revocado" = true,
                "motivo_revocacion" = :motivo,
                "fecha_revocacion" = NOW()
            WHERE "token_hash" = :thash AND "revocado" = false;
        """), {"thash": token_hash, "motivo": motivo})
        session.commit()
        return res.rowcount > 0
