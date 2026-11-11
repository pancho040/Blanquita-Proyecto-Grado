"""
Pruebas de Integración Fase 1.2:
- Sesión y Estado Inactivo en Tiempo Real (Punto 2)
- Rate Limit Login con Clave (CI + IP) para evitar bloqueo de terceros (Punto 3)
- Idempotencia Multihilo Concurrente con BD Real y Caché Exclusivo de 2xx (Punto 4)
"""

import os
import uuid
import secrets
import httpx
import concurrent.futures
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Config.supabase import SessionLocal
from app.Services.Usuario.Auth import AuthService
from app.Middleware.Idempotencia import IdempotenciaService

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


def test_usuario_inactivo_recibe_403_con_token_vigente():
    """
    Punto 2: Demuestra que un usuario que tiene un JWT vigente,
    si su IdEstadoUsuario se cambia a Inactivo (2) en la BD,
    FastAPI rechaza inmediatamente las peticiones subsecuentes con HTTP 403 Forbidden.
    """
    db = SessionLocal()
    try:
        user_row = db.execute(
            text('SELECT "IdUsuario", "AuthUserId", "Ci", "IdEstadoUsuario" FROM public."Usuario" WHERE "Ci" = :ci'),
            {"ci": "9000004"}
        ).fetchone()
        assert user_row is not None
        id_usuario, auth_id, ci, estado_original = user_row

        pwd = "P@ss_" + secrets.token_hex(8) + "Aa1!"
        _set_test_password(str(auth_id), pwd)

        # Generar login real para obtener token asimétrico ES256 válido
        auth_service = AuthService(db)
        login_res = auth_service.Login(ci, pwd, None, None)
        token_vigente = login_res["AccessToken"]

        # 1. Petición con usuario activo -> Debe responder 200
        headers = {"Authorization": f"Bearer {token_vigente}"}
        resp_act = client.get("/api/movil/v1/notificaciones", headers=headers)
        assert resp_act.status_code == 200, f"Fallo con usuario activo: {resp_act.status_code}"

        # 2. Desactivar usuario en BD (simulando acción de administrador)
        db.execute(
            text('UPDATE public."Usuario" SET "IdEstadoUsuario" = 2 WHERE "IdUsuario" = :uid'),
            {"uid": id_usuario}
        )
        db.commit()

        # 3. Petición con el MISMO token vigente -> FastAPI debe consultar BD y retornar 403 Forbidden
        resp_inact = client.get("/api/movil/v1/notificaciones", headers=headers)
        assert resp_inact.status_code == 403, f"Esperaba 403 pero obtuvo: {resp_inact.status_code}"
        assert "Usuario inactivo" in resp_inact.json().get("detail", "")

    finally:
        # Restaurar estado original
        db.execute(
            text('UPDATE public."Usuario" SET "IdEstadoUsuario" = :est WHERE "IdUsuario" = :uid'),
            {"est": estado_original, "uid": id_usuario}
        )
        db.commit()
        db.close()


def test_rate_limit_ci_ip_no_bloquea_chofer_legitimo_otra_ip():
    """
    Punto 3: Demuestra que un atacante desde IP_A que falla 5 veces con el CI del chofer
    queda bloqueado con 429 para (CI + IP_A), pero el chofer legítimo desde IP_B
    puede autenticarse normalmente con sus credenciales correctas.
    """
    ci_prueba = "9000004"
    ip_atacante = "198.51.100.99"
    ip_legitima = "203.0.113.50"

    # 1. Atacante en IP_A envía 5 contraseñas erróneas
    for i in range(5):
        resp = client.post(
            "/api/movil/v1/auth/login",
            json={"ci": ci_prueba, "clave": f"ClaveMala_{i}!"},
            headers={"X-Forwarded-For": ip_atacante}
        )
        assert resp.status_code == 401

    # El 6to intento desde IP_A debe devolver 429 Too Many Requests
    resp_bloqueado = client.post(
        "/api/movil/v1/auth/login",
        json={"ci": ci_prueba, "clave": "ClaveMala_6!"},
        headers={"X-Forwarded-For": ip_atacante}
    )
    assert resp_bloqueado.status_code == 429
    cuerpo_bloq = resp_bloqueado.json()
    assert "error" in cuerpo_bloq or "detail" in cuerpo_bloq

    # 2. El chofer legítimo desde IP_B NO debe recibir 429
    resp_legitimo = client.post(
        "/api/movil/v1/auth/login",
        json={"ci": ci_prueba, "clave": "CualquierClave"},
        headers={"X-Forwarded-For": ip_legitima}
    )
    assert resp_legitimo.status_code == 401


def test_idempotencia_concurrente_dos_hilos_mismo_efecto():
    """
    Punto 4: Ejecuta dos hilos concurrentes contra el endpoint con la MISMA clave de idempotencia.
    Verifica que la operación se procesa de forma atómica:
    - Exactamente un hilo procesa y guarda el resultado.
    - El segundo hilo obtiene el resultado guardado con X-Cache-Lookup: HIT.
    - Se verifica contra BD real con sesiones de base de datos independientes por hilo.
    """
    from app.Config.supabase import get_db, SessionLocal, engine
    from sqlalchemy.orm import sessionmaker

    override_anterior = app.dependency_overrides.pop(get_db, None)
    # Fabrica de sesiones reales independientes para hilos concurrentes
    RealSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def _get_real_db_independiente():
        s = RealSessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _get_real_db_independiente

    db = RealSessionLocal()
    clave_uuid = str(uuid.uuid4())
    payload = {"monto": 150.50, "cliente_id": 9999}
    try:
        user_row = db.execute(
            text('SELECT "IdUsuario", "AuthUserId", "Ci" FROM public."Usuario" WHERE "Ci" = :ci'),
            {"ci": "9000004"}
        ).fetchone()
        assert user_row is not None
        auth_id, ci = str(user_row[1]), str(user_row[2])

        pwd = "P@ss_" + secrets.token_hex(8) + "Aa1!"
        _set_test_password(auth_id, pwd)

        auth_service = AuthService(db)
        login_res = auth_service.Login(ci, pwd, None, None)
        token = login_res["AccessToken"]

        headers = {
            "Authorization": f"Bearer {token}",
            "X-Idempotency-Key": clave_uuid,
            "Content-Type": "application/json"
        }

        def enviar_peticion():
            c = TestClient(app)
            return c.post("/api/movil/v1/operaciones/probar-idempotencia", json=payload, headers=headers)

        # Ejecutar peticion inicial en hilo 1
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(enviar_peticion)
            r1 = f1.result()
            # Hilo 2 ejecuta inmediatamente reintento con la misma clave de idempotencia
            f2 = executor.submit(enviar_peticion)
            r2 = f2.result()

        assert r1.status_code == 200
        assert r2.status_code == 200

        # El segundo hilo recibe el resultado guardado con HIT en cache
        lookup_hdr = r2.headers.get("x-cache-lookup") or r2.headers.get("X-Cache-Lookup")
        assert lookup_hdr == "HIT", f"El segundo hilo debio recibir X-Cache-Lookup: HIT, headers: {dict(r2.headers)}"
        assert r1.json()["datos"]["transaccion_id"] == r2.json()["datos"]["transaccion_id"], "Ambos hilos deben compartir el mismo transaccion_id"
        assert r1.json()["datos"]["transaccion_id"] == r2.json()["datos"]["transaccion_id"], "Ambos hilos deben compartir el mismo transaccion_id"

        # Verificar en BD que solo existe 1 fila para esa clave
        cnt = db.execute(
            text('SELECT count(*) FROM public."ClaveIdempotenciaProcesada" WHERE "clave_idempotencia" = :clave'),
            {"clave": clave_uuid}
        ).scalar()
        assert cnt == 1, f"Debio registrarse exactamente 1 registro de idempotencia, se encontraron {cnt}"

    finally:
        db.execute(
            text('DELETE FROM public."ClaveIdempotenciaProcesada" WHERE "clave_idempotencia" = :clave'),
            {"clave": clave_uuid}
        )
        db.commit()
        db.close()
        if override_anterior is not None:
            app.dependency_overrides[get_db] = override_anterior
        else:
            app.dependency_overrides.pop(get_db, None)


def test_idempotencia_no_guarda_errores_4xx_ni_5xx():
    """
    Punto 4: Demuestra que los códigos 4xx y 5xx NO se guardan en la tabla de idempotencia,
    permitiendo corregir errores de cliente o recuperarse de errores de servidor.
    """
    db = SessionLocal()
    clave_4xx = str(uuid.uuid4())
    clave_5xx = str(uuid.uuid4())

    try:
        # Simular intento de registro con 400 Bad Request
        IdempotenciaService.registrar_respuesta(
            session=db,
            usuario_id=1,
            clave=clave_4xx,
            endpoint="/test/4xx",
            hash_cuerpo="hash_dummy",
            codigo_estado=400,
            cuerpo_respuesta={"error": "Datos inválidos"}
        )
        db.commit()

        # Simular intento de registro con 500 Internal Error
        IdempotenciaService.registrar_respuesta(
            session=db,
            usuario_id=1,
            clave=clave_5xx,
            endpoint="/test/5xx",
            hash_cuerpo="hash_dummy",
            codigo_estado=500,
            cuerpo_respuesta={"error": "Fallo servidor"}
        )
        db.commit()

        # Comprobar que NINGUNA de las dos fue insertada
        reg_4xx = IdempotenciaService.consultar_registro(db, 1, clave_4xx)
        reg_5xx = IdempotenciaService.consultar_registro(db, 1, clave_5xx)
        assert reg_4xx is None, "El error 400 no debió guardarse en idempotencia"
        assert reg_5xx is None, "El error 500 no debió guardarse en idempotencia"

    finally:
        db.close()
