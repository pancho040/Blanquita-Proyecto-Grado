"""
Pruebas de Integración - Fase 1.3:
1. Punto 1 (b): JWT válido de Supabase Auth sin fila en tabla 'Usuario' recibe HTTP 403 Forbidden
   tanto en endpoint web (/usuario/yo) como en endpoint móvil (/api/movil/v1/notificaciones).
2. Punto 3: Demuestra que rotar cabecera X-Forwarded-For falsificada desde el cliente
   NO evita el rate limit cuando se evalúa la IP real del proxy de borde de confianza.
3. Punto 9: Verificación de que marcar notificación leída responde a PATCH y PUT de manera idéntica.
"""

import os
import secrets
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Config.supabase import SessionLocal
from app.Services.Usuario.Auth import AuthService
from app.Auth.Limiter import obtener_ip_real

client = TestClient(app)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _set_test_password(auth_user_id: str, pwd: str):
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    resp = httpx.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{auth_user_id}",
        headers=headers,
        json={"password": pwd},
        timeout=15.0
    )
    assert resp.status_code == 200


def test_jwt_valido_auth_sin_fila_en_usuario_recibe_403_en_web_y_movil():
    """
    Punto 1 (b): Un JWT auténtico y firmado por GoTrue, si pertenece a un usuario
    que NO tiene fila en la tabla public."Usuario", es rechazado de inmediato
    con HTTP 403 Forbidden ("Usuario no registrado en el sistema") tanto en la API web
    como en la API móvil.
    Se ejecuta con cambio temporal de AuthUserId y restauración garantizada en bloque finally.
    """
    db = SessionLocal()
    token_real = None
    auth_id_real = None
    id_usuario_real = None

    try:
        # Obtener un usuario de prueba existente
        user_row = db.execute(
            text('SELECT "IdUsuario", "AuthUserId", "Ci" FROM public."Usuario" WHERE "Ci" = :ci'),
            {"ci": "9000004"}
        ).fetchone()
        assert user_row is not None
        id_usuario_real, auth_id_real, ci = user_row

        pwd = "P@ss_" + secrets.token_hex(8) + "Aa1!"
        _set_test_password(str(auth_id_real), pwd)

        auth_service = AuthService(db)
        login_data = auth_service.Login(ci=ci, clave=pwd, ip="127.0.0.1", user_agent="Pytest-Fase1.3")
        token_real = login_data["AccessToken"]
        assert token_real is not None

        # Desvincular temporalmente el AuthUserId en la BD para simular un usuario de Auth
        # que no existe en el catálogo interno del ERP.
        auth_id_falso = "ffffffff-ffff-ffff-ffff-ffffffffffff"
        db.execute(
            text('UPDATE public."Usuario" SET "AuthUserId" = :falso WHERE "IdUsuario" = :uid'),
            {"falso": auth_id_falso, "uid": id_usuario_real}
        )
        db.commit()

        # 1. Petición a endpoint web protegido (/usuario/yo o /distribuidor/empresas)
        resp_web = client.get(
            "/distribuidor/empresas",
            headers={"Authorization": f"Bearer {token_real}"}
        )
        assert resp_web.status_code == 403
        assert "no registrado en el sistema" in resp_web.json().get("detail", "")

        # 2. Petición a endpoint móvil protegido (/api/movil/v1/notificaciones)
        resp_movil = client.get(
            "/api/movil/v1/notificaciones",
            headers={"Authorization": f"Bearer {token_real}"}
        )
        assert resp_movil.status_code == 403
        assert "no registrado en el sistema" in resp_movil.json().get("detail", "")

    finally:
        # Restaurar inmediatamente el AuthUserId original
        if id_usuario_real and auth_id_real:
            db.execute(
                text('UPDATE public."Usuario" SET "AuthUserId" = :real WHERE "IdUsuario" = :uid'),
                {"real": str(auth_id_real), "uid": id_usuario_real}
            )
            db.commit()
        db.close()


def test_ip_spoofing_x_forwarded_for_no_evade_rate_limit():
    """
    Punto 3: Demuestra que rotar cabeceras X-Forwarded-For falsificadas por el cliente
    NO evade el rate limiting de login, ya que la IP evaluada por el limiter
    proviene de la IP agregada por el proxy de borde de confianza (la última de la cadena).
    """
    from starlette.requests import Request

    # Simular una cadena generada por un atacante que falsifica su IP en cada salto,
    # pero que llega a través del mismo proxy de Render cuya IP de cliente real es 190.129.50.10
    ip_real_proxy = "190.129.50.10"

    # Caso 1: Petición con IP inyectada '1.1.1.1'
    scope_1 = {
        "type": "http",
        "headers": [(b"x-forwarded-for", f"1.1.1.1, {ip_real_proxy}".encode("latin1"))],
        "client": ("127.0.0.1", 12345),
    }
    req_1 = Request(scope_1)
    assert obtener_ip_real(req_1) == ip_real_proxy

    # Caso 2: Petición con IP inyectada '2.2.2.2'
    scope_2 = {
        "type": "http",
        "headers": [(b"x-forwarded-for", f"2.2.2.2, {ip_real_proxy}".encode("latin1"))],
        "client": ("127.0.0.1", 12345),
    }
    req_2 = Request(scope_2)
    assert obtener_ip_real(req_2) == ip_real_proxy

    # Caso 3: Petición con cabecera de borde cf-connecting-ip
    scope_3 = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"attacker.spoofed.ip"),
            (b"cf-connecting-ip", b"181.188.10.5"),
        ],
        "client": ("127.0.0.1", 12345),
    }
    req_3 = Request(scope_3)
    assert obtener_ip_real(req_3) == "181.188.10.5"


def test_notificacion_marcar_leida_soporta_put_y_patch():
    """
    Punto 9: Demuestra que el endpoint para marcar una notificación interna como leída
    soporta tanto PATCH como PUT con comportamiento y respuesta equivalentes.
    """
    db = SessionLocal()
    id_notif = None
    token = None
    try:
        user_row = db.execute(
            text('SELECT "IdUsuario", "AuthUserId", "Ci" FROM public."Usuario" WHERE "Ci" = :ci'),
            {"ci": "9000004"}
        ).fetchone()
        assert user_row is not None
        id_usuario, auth_id, ci = user_row

        pwd = "P@ss_" + secrets.token_hex(8) + "Aa1!"
        _set_test_password(str(auth_id), pwd)

        auth_service = AuthService(db)
        login_data = auth_service.Login(ci=ci, clave=pwd, ip="127.0.0.1", user_agent="Pytest-Notif")
        token = login_data["AccessToken"]

        # Insertar notificación de prueba
        ins = text("""
            INSERT INTO public."NotificacionInterna" (
                "IdUsuarioDestinatario", "Titulo", "Mensaje", "Tipo", "Leido", "FechaCreacion"
            ) VALUES (
                :uid, 'Aviso Test', 'Mensaje de prueba', 'AVISO_ADMIN', false, NOW()
            ) RETURNING "IdNotificacion";
        """)
        id_notif = db.execute(ins, {"uid": id_usuario}).scalar()
        db.commit()

        # Probar con PATCH
        resp_patch = client.patch(
            f"/api/movil/v1/notificaciones/{id_notif}/leida",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp_patch.status_code == 200
        assert resp_patch.json()["codigo"] == "EXITO"

        # Verificar en BD que está leída
        leido = db.execute(
            text('SELECT "Leido" FROM public."NotificacionInterna" WHERE "IdNotificacion" = :id'),
            {"id": id_notif}
        ).scalar()
        assert leido is True

        # Restablecer a false y probar con PUT
        db.execute(
            text('UPDATE public."NotificacionInterna" SET "Leido" = false WHERE "IdNotificacion" = :id'),
            {"id": id_notif}
        )
        db.commit()

        resp_put = client.put(
            f"/api/movil/v1/notificaciones/{id_notif}/leida",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp_put.status_code == 200
        assert resp_put.json()["codigo"] == "EXITO"

    finally:
        if id_notif:
            db.execute(
                text('DELETE FROM public."NotificacionInterna" WHERE "IdNotificacion" = :id'),
                {"id": id_notif}
            )
            db.commit()
        db.close()
