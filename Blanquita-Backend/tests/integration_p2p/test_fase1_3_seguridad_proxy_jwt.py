"""
Pruebas de Integración - Fase 1.3:
1. Punto 1 (b): JWT válido de Supabase Auth sin fila en tabla 'Usuario' recibe HTTP 403 Forbidden
   tanto en endpoint web (/Usuario/mi-alcance) como en endpoint móvil (/api/movil/v1/notificaciones).
2. Punto 3: Demuestra que rotar cabecera X-Forwarded-For falsificada desde el cliente
   NO evita el rate limit cuando se evalúa la IP real del proxy de borde de confianza.
3. Punto 9: Verificación de que marcar notificación leída responde a PATCH y PUT de manera idéntica.
"""

import uuid
import secrets
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Auth.Limiter import obtener_ip_real

client = TestClient(app)


def test_jwt_valido_auth_sin_fila_en_usuario_recibe_403_en_web_y_movil():
    """
    Punto 1 (b): Un JWT auténtico y validado por Auth cuyo AuthUserId (sub)
    NO tiene fila en la tabla public."Usuario" es rechazado de inmediato
    con HTTP 403 Forbidden ("Usuario no registrado en el sistema") tanto en la API web
    como en la API móvil, consultando la base de datos real.
    """
    auth_id_huerfano = str(uuid.uuid4())
    payload_huerfano = {
        "sub": auth_id_huerfano,
        "email": f"huerfano_{secrets.token_hex(4)}@test.com",
        "aud": "authenticated",
        "role": "authenticated",
        "app_metadata": {}
    }

    with patch("app.Auth.Dependencies.verificar_token", return_value=payload_huerfano):
        # 1. Petición a endpoint web protegido (/Usuario/mi-alcance)
        resp_web = client.get(
            "/Usuario/mi-alcance",
            headers={"Authorization": "Bearer token.simulado.huerfano"}
        )
        assert resp_web.status_code == 403
        assert "no registrado en el sistema" in resp_web.json().get("detail", "")

        # 2. Petición a endpoint móvil protegido (/api/movil/v1/notificaciones)
        resp_movil = client.get(
            "/api/movil/v1/notificaciones",
            headers={"Authorization": "Bearer token.simulado.huerfano"}
        )
        assert resp_movil.status_code == 403
        assert "no registrado en el sistema" in resp_movil.json().get("detail", "")


def test_ip_spoofing_x_forwarded_for_no_evade_rate_limit():
    """
    Punto 3: Demuestra que rotar cabeceras inyectadas por el cliente
    (como el primer valor de X-Forwarded-For o un cf-connecting-ip falsificado)
    NO evade el rate limiting, ya que la IP evaluada por el limiter
    proviene de la IP final agregada por el reverse proxy de Render.
    """
    from starlette.requests import Request

    ip_real_proxy = "190.129.50.10"

    # Caso 1: Petición con IP inyectada '1.1.1.1' en X-Forwarded-For
    scope_1 = {
        "type": "http",
        "headers": [(b"x-forwarded-for", f"1.1.1.1, {ip_real_proxy}".encode("latin1"))],
        "client": ("127.0.0.1", 12345),
    }
    req_1 = Request(scope_1)
    assert obtener_ip_real(req_1) == ip_real_proxy

    # Caso 2: Petición rotando IP inyectada a '2.2.2.2' en X-Forwarded-For
    scope_2 = {
        "type": "http",
        "headers": [(b"x-forwarded-for", f"2.2.2.2, {ip_real_proxy}".encode("latin1"))],
        "client": ("127.0.0.1", 12345),
    }
    req_2 = Request(scope_2)
    assert obtener_ip_real(req_2) == ip_real_proxy

    # Caso 3: Petición inyectando cf-connecting-ip falsificado sin proxy Cloudflare
    scope_3 = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", f"attacker.spoofed.ip, {ip_real_proxy}".encode("latin1")),
            (b"cf-connecting-ip", b"1.2.3.4"),
        ],
        "client": ("127.0.0.1", 12345),
    }
    req_3 = Request(scope_3)
    # No confía en cf-connecting-ip inyectado; toma la IP real provista por el proxy de Render
    assert obtener_ip_real(req_3) == ip_real_proxy


def test_notificacion_marcar_leida_soporta_put_y_patch(db_session_rollback):
    """
    Punto 9: Demuestra que el endpoint para marcar una notificación interna como leída
    soporta tanto PATCH como PUT con comportamiento y respuesta equivalentes.
    Usa la fixture de rollback automático para no dejar datos en la base.
    """
    session = db_session_rollback

    user_row = session.execute(
        text('SELECT "IdUsuario", "AuthUserId", "Ci" FROM public."Usuario" WHERE "Ci" = :ci'),
        {"ci": "9000004"}
    ).fetchone()
    assert user_row is not None
    id_usuario, auth_id, ci = user_row

    ins = text("""
        INSERT INTO public."NotificacionInterna" (
            "IdUsuarioDestinatario", "Titulo", "Mensaje", "Tipo", "Leido", "FechaCreacion"
        ) VALUES (
            :uid, 'Aviso Test', 'Mensaje de prueba', 'AVISO_ADMIN', false, NOW()
        ) RETURNING "IdNotificacion";
    """)
    id_notif = session.execute(ins, {"uid": id_usuario}).scalar()
    session.flush()

    from app.Auth.Dependencies import get_current_user

    def mock_user():
        return {
            "IdUsuario": id_usuario,
            "IdRol": 6,
            "IdEstadoUsuario": 1,
            "IsAdmin": False,
            "AuthUserId": str(auth_id),
            "Correo": f"{ci}@test.com"
        }

    app.dependency_overrides[get_current_user] = mock_user

    try:
        # Probar con PATCH
        resp_patch = client.patch(
            f"/api/movil/v1/notificaciones/{id_notif}/leida",
            headers={"Authorization": "Bearer test.token"}
        )
        assert resp_patch.status_code == 200
        assert resp_patch.json()["codigo"] == "EXITO"
        assert resp_patch.json()["datos"]["leido"] is True

        # Restablecer a false en el savepoint y probar con PUT
        session.execute(
            text('UPDATE public."NotificacionInterna" SET "Leido" = false WHERE "IdNotificacion" = :id'),
            {"id": id_notif}
        )
        session.flush()

        resp_put = client.put(
            f"/api/movil/v1/notificaciones/{id_notif}/leida",
            headers={"Authorization": "Bearer test.token"}
        )
        assert resp_put.status_code == 200
        assert resp_put.json()["codigo"] == "EXITO"
        assert resp_put.json()["datos"]["leido"] is True

    finally:
        app.dependency_overrides.pop(get_current_user, None)
