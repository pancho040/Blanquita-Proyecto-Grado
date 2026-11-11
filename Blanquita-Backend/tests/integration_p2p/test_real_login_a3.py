"""
Prueba de Autenticación Real de Usuarios TEST_ (Fase 1.1 - Punto A3 y B3)
Sistema ERP Papelera Blanquita

Verifica que el flujo de autenticación real funciona de extremo a extremo
a través de /auth/login y /api/movil/v1/auth/login con el SQL de seguridad aplicado.
Garantiza:
1. Sin imprimir credenciales ni tokens en terminal o logs.
2. Respuesta uniforme 'Credenciales inválidas' ante CI inexistente o clave errónea.
"""

import os
import secrets
import jwt
import pytest
import httpx
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Config.supabase import SessionLocal
from app.Auth.Limiter import limiter

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _actualizar_clave_auth_test(auth_user_id: str, nueva_clave: str):
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    resp = httpx.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}",
        headers=headers,
        json={"password": nueva_clave},
        timeout=15.0
    )
    assert resp.status_code == 200, f"Error actualizando clave en Supabase Auth: {resp.status_code}"


def test_login_real_usuario_test_endpoints():
    db = SessionLocal()
    try:
        user_row = db.execute(
            text('SELECT "IdUsuario", "AuthUserId", "Ci" FROM public."Usuario" WHERE "Ci" = :ci'),
            {"ci": "9000004"}
        ).fetchone()
        assert user_row is not None, "El usuario TEST_Potosi_Chofer (CI 9000004) no fue encontrado"

        auth_id = str(user_row[1])
        ci = str(user_row[2])

        # Generar clave efímera para el test
        test_pwd = "P@ss_" + secrets.token_hex(8) + "Aa1!"
        _actualizar_clave_auth_test(auth_id, test_pwd)

        client = TestClient(app)

        # 1. Login vía /auth/login (Web)
        resp_web = client.post("/auth/login", json={"Ci": ci, "Clave": test_pwd})
        assert resp_web.status_code == 200, f"Fallo login /auth/login: {resp_web.status_code} - {resp_web.text}"
        data_web = resp_web.json()
        assert "AccessToken" in data_web and len(data_web["AccessToken"]) > 20
        assert "RefreshToken" in data_web and len(data_web["RefreshToken"]) > 10

        payload_web = jwt.decode(data_web["AccessToken"], options={"verify_signature": False})
        meta_web = payload_web.get("app_metadata", {})
        for req_claim in ("IdUsuario", "IdRol", "IdEstadoUsuario", "IsAdmin"):
            assert req_claim in meta_web, f"Claim requerido {req_claim} no encontrado en app_metadata del JWT Web"

        # 2. Login vía /api/movil/v1/auth/login (Móvil)
        limiter.reset()
        resp_movil = client.post("/api/movil/v1/auth/login", json={"ci": ci, "clave": test_pwd})
        assert resp_movil.status_code == 200, f"Fallo login /api/movil/v1/auth/login: {resp_movil.status_code} - {resp_movil.text}"
        data_movil = resp_movil.json()
        assert data_movil["codigo"] == "EXITO"
        assert "access_token" in data_movil["datos"] and len(data_movil["datos"]["access_token"]) > 20
        assert "refresh_token" in data_movil["datos"] and len(data_movil["datos"]["refresh_token"]) > 10
        assert data_movil["datos"]["usuario"]["ci"] == ci
        assert data_movil["datos"]["usuario"]["sucursal_defecto"] == 2

        payload_movil = jwt.decode(data_movil["datos"]["access_token"], options={"verify_signature": False})
        meta_movil = payload_movil.get("app_metadata", {})
        for req_claim in ("IdUsuario", "IdRol", "IdEstadoUsuario", "IsAdmin"):
            assert req_claim in meta_movil, f"Claim requerido {req_claim} no encontrado en app_metadata del JWT Móvil"
        print(f"VERIFICACION_CLAIMS_JWT_HOOK_EXITOSA: claims presentes en app_metadata: {list(meta_movil.keys())}")

        # 3. Verificación de seguridad: Contraseña errónea -> 401 Credenciales inválidas
        resp_bad_pwd = client.post("/api/movil/v1/auth/login", json={"ci": ci, "clave": "ClaveIncorrecta999!"})
        assert resp_bad_pwd.status_code == 401
        assert "Credenciales inválidas" in resp_bad_pwd.json().get("detail", "")

        # 4. Verificación de seguridad: CI inexistente -> 401 Credenciales inválidas
        resp_bad_ci = client.post("/api/movil/v1/auth/login", json={"ci": "00000000", "clave": test_pwd})
        assert resp_bad_ci.status_code == 401
        assert "Credenciales inválidas" in resp_bad_ci.json().get("detail", "")

    finally:
        db.close()
