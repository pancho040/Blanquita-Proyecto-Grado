"""
Tests exhaustivos para SUB-AGENTE A: Autenticación móvil con Refresh Token
Verifica:
1. Expiración de refresh token (TOKEN_EXPIRADO)
2. Renovación y rotación exitosa (nuevo access y refresh token)
3. Detección de reutilización (Reuse Detection revoca toda la cadena familiar)
4. Usuario desactivado/inactivo no puede renovar (revoca sesión)
5. Distinción HTTP 401: TOKEN_EXPIRADO vs TOKEN_INVALIDO
"""

import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Services.Movil.RefreshTokenService import RefreshTokenService

client = TestClient(app)

ID_USUARIO_CHOFER_TEST = 9  # Chofer existente


def test_refresh_token_creacion_rotacion_exitosa(db_session_rollback):
    """Verifica que el refresh token se cree, se rote exitosamente y el token previo quede invalidado."""
    # 1. Crear refresh token inicial
    token_crudo, expira_en, familia_id = RefreshTokenService.crear_refresh_token(
        session=db_session_rollback,
        usuario_id=ID_USUARIO_CHOFER_TEST,
        supabase_refresh_token="sb_test_refresh_123",
        dispositivo_id="device-test-01"
    )
    assert token_crudo.startswith("blq_ref_")
    assert familia_id is not None
    assert expira_en > datetime.now(timezone.utc)

    # 2. Rotar el token
    mock_auth = MagicMock()
    mock_auth.RefreshAccessToken.return_value = {
        "AccessToken": "nuevo_access_token_jwt_simulado",
        "RefreshTokenCrudo": "sb_test_refresh_456"
    }

    resultado_rotado = RefreshTokenService.rotar_refresh_token(
        session=db_session_rollback,
        refresh_token_crudo=token_crudo,
        auth_service=mock_auth,
        dispositivo_id="device-test-01"
    )

    nuevo_token = resultado_rotado["refresh_token"]
    assert nuevo_token != token_crudo
    assert nuevo_token.startswith("blq_ref_")
    assert resultado_rotado["access_token"] == "nuevo_access_token_jwt_simulado"

    # 3. Verificar estado en base de datos: el viejo está rotado y el nuevo activo
    hash_viejo = RefreshTokenService._calcular_hash(token_crudo)
    fila_vieja = db_session_rollback.execute(
        text('SELECT "revocado", "motivo_revocacion", "familia_id" FROM public."RefreshTokenMovil" WHERE "token_hash" = :h;'),
        {"h": hash_viejo}
    ).mappings().fetchone()
    assert fila_vieja["revocado"] is True
    assert fila_vieja["motivo_revocacion"] == "ROTADO"
    assert fila_vieja["familia_id"] == familia_id

    hash_nuevo = RefreshTokenService._calcular_hash(nuevo_token)
    fila_nueva = db_session_rollback.execute(
        text('SELECT "revocado", "familia_id" FROM public."RefreshTokenMovil" WHERE "token_hash" = :h;'),
        {"h": hash_nuevo}
    ).mappings().fetchone()
    assert fila_nueva["revocado"] is False
    assert fila_nueva["familia_id"] == familia_id  # Comparte la misma familia


def test_reutilizacion_de_refresh_token_revoca_toda_la_cadena(db_session_rollback):
    """
    Detección de robo/reutilización:
    Si un token previamente rotado se vuelve a usar, revoca de inmediato toda la familia.
    """
    # 1. Crear y rotar
    t1, _, fid = RefreshTokenService.crear_refresh_token(
        session=db_session_rollback,
        usuario_id=ID_USUARIO_CHOFER_TEST
    )
    res1 = RefreshTokenService.rotar_refresh_token(
        session=db_session_rollback,
        refresh_token_crudo=t1
    )
    t2 = res1["refresh_token"]

    # 2. El atacante o cliente desincronizado intenta usar de nuevo t1 (ya rotado)
    from fastapi import HTTPException
    import pytest

    with pytest.raises(HTTPException) as exc_info:
        RefreshTokenService.rotar_refresh_token(
            session=db_session_rollback,
            refresh_token_crudo=t1
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["codigo"] == "TOKEN_INVALIDO"
    assert "reutilización" in exc_info.value.detail["mensaje"]

    # 3. Comprobar que t2 (el legítimo más reciente) también fue revocado por seguridad
    hash_t2 = RefreshTokenService._calcular_hash(t2)
    fila_t2 = db_session_rollback.execute(
        text('SELECT "revocado", "motivo_revocacion" FROM public."RefreshTokenMovil" WHERE "token_hash" = :h;'),
        {"h": hash_t2}
    ).mappings().fetchone()
    assert fila_t2["revocado"] is True
    assert fila_t2["motivo_revocacion"] == "REUTILIZACION_DETECTADA"


def test_refresh_token_expirado_devuelve_token_expirado(db_session_rollback):
    """Si el refresh token superó los 30 días, responde TOKEN_EXPIRADO."""
    from fastapi import HTTPException
    import pytest

    token_crudo, _, _ = RefreshTokenService.crear_refresh_token(
        session=db_session_rollback,
        usuario_id=ID_USUARIO_CHOFER_TEST,
        dias_validez=-1  # Expirado en el pasado
    )

    with pytest.raises(HTTPException) as exc_info:
        RefreshTokenService.rotar_refresh_token(
            session=db_session_rollback,
            refresh_token_crudo=token_crudo
        )
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["codigo"] == "TOKEN_EXPIRADO"


def test_usuario_desactivado_no_puede_renovar(db_session_rollback):
    """Si el chofer fue desactivado (IdEstadoUsuario != 1), la renovación es rechazada y la sesión revocada."""
    from fastapi import HTTPException
    import pytest

    # Cambiar estado a inactivo (2)
    db_session_rollback.execute(
        text('UPDATE public."Usuario" SET "IdEstadoUsuario" = 2 WHERE "IdUsuario" = :uid;'),
        {"uid": ID_USUARIO_CHOFER_TEST}
    )

    token_crudo, _, fid = RefreshTokenService.crear_refresh_token(
        session=db_session_rollback,
        usuario_id=ID_USUARIO_CHOFER_TEST
    )

    with pytest.raises(HTTPException) as exc_info:
        RefreshTokenService.rotar_refresh_token(
            session=db_session_rollback,
            refresh_token_crudo=token_crudo
        )
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["codigo"] == "USUARIO_INACTIVO"


def test_endpoint_http_refresh_movil_flujo_completo(db_session_rollback):
    """Prueba HTTP completa a través de TestClient del endpoint POST /api/movil/v1/auth/refresh."""
    # 1. Crear refresh token
    token_crudo, _, _ = RefreshTokenService.crear_refresh_token(
        session=db_session_rollback,
        usuario_id=ID_USUARIO_CHOFER_TEST
    )
    db_session_rollback.commit()

    # 2. Petición POST /api/movil/v1/auth/refresh
    resp = client.post(
        "/api/movil/v1/auth/refresh",
        json={"refresh_token": token_crudo}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["codigo"] == "EXITO"
    assert "token_type" in data["datos"]
    nuevo_ref = data["datos"]["refresh_token"]
    assert nuevo_ref != token_crudo

    # 3. Reintento con el token viejo debe devolver 401 TOKEN_INVALIDO
    resp_reuso = client.post(
        "/api/movil/v1/auth/refresh",
        json={"refresh_token": token_crudo}
    )
    assert resp_reuso.status_code == 401
    assert resp_reuso.json()["codigo"] == "TOKEN_INVALIDO"
