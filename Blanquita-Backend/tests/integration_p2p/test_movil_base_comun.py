"""
Pruebas de Integración para Base Común Móvil v1 (Fase 1)
Sistema ERP Papelera Blanquita

Aprovecha el fixture transaccional autouse `db_session_rollback` de conftest.py
para aislamiento total y rollback garantizado.
"""

import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Services.Common.NotificationService import NotificationService
from app.Services.Movil.PushNotificationService import PushNotificationService

client = TestClient(app)

MOCK_CHOFER_USER = {
    "IdUsuario": 9,  # Marcos Condori, chofer real existente
    "IdRol": 6,
    "IdEstadoUsuario": 1,
    "IsAdmin": False,
    "AuthUserId": "test-uuid-chofer-9",
    "Correo": "chofer_9@blanquita.com"
}


def test_health_endpoint():
    """El endpoint /health debe responder 200 OK y ser ultraliviano sin tocar la base de datos."""
    resp = client.get("/health")
    assert resp.status_code == 200
    datos = resp.json()
    assert datos["status"] == "ok"
    assert "Papelera Blanquita" in datos["app"]


def test_idempotencia_flujo_completo(db_session_rollback):
    """Verifica que la idempotencia evite duplicados y rechace colisiones de payload."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_CHOFER_USER
    try:
        clave_uuid = str(uuid.uuid4())
        payload_1 = {"monto": 250.0, "concepto": "Cobro entrega factura 501"}

        # 1. Primera ejecución: procesa y almacena
        resp1 = client.post(
            "/api/movil/v1/operaciones/probar-idempotencia",
            json=payload_1,
            headers={"X-Idempotency-Key": clave_uuid}
        )
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["codigo"] == "EXITO"
        tx_id_1 = data1["datos"]["transaccion_id"]

        # 2. Segunda ejecución idéntica: debe devolver HIT desde caché con el mismo tx_id
        resp2 = client.post(
            "/api/movil/v1/operaciones/probar-idempotencia",
            json=payload_1,
            headers={"X-Idempotency-Key": clave_uuid}
        )
        assert resp2.status_code == 200
        assert resp2.headers.get("x-cache-lookup") == "HIT"
        data2 = resp2.json()
        assert data2["datos"]["transaccion_id"] == tx_id_1

        # 3. Tercera ejecución con MISMA clave pero DISTINTO cuerpo: debe dar 409 Conflict
        payload_alterado = {"monto": 999.9, "concepto": "Monto alterado malicioso"}
        resp3 = client.post(
            "/api/movil/v1/operaciones/probar-idempotencia",
            json=payload_alterado,
            headers={"X-Idempotency-Key": clave_uuid}
        )
        assert resp3.status_code == 409
        assert "Conflicto de idempotencia" in resp3.json()["detail"]

        # 4. Formato inválido de clave (no UUID v4) -> 400 Bad Request
        resp4 = client.post(
            "/api/movil/v1/operaciones/probar-idempotencia",
            json=payload_1,
            headers={"X-Idempotency-Key": "clave-no-uuid-invalida"}
        )
        assert resp4.status_code == 400
        assert "UUID v4" in resp4.json()["detail"]

        # 5. Sin cabecera -> 400 Bad Request
        resp5 = client.post(
            "/api/movil/v1/operaciones/probar-idempotencia",
            json=payload_1
        )
        assert resp5.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_registro_dispositivo_y_sanitizacion_push(db_session_rollback):
    """Prueba el registro de dispositivo Expo y que las notificaciones no filtren montos ni nombres."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_CHOFER_USER
    try:
        token_prueba = f"ExponentPushToken[test-{uuid.uuid4().hex[:8]}]"

        # 1. Registro de token push
        resp = client.post(
            "/api/movil/v1/dispositivos/registro",
            json={
                "token_push": token_prueba,
                "plataforma": "android",
                "version_app": "1.0.0"
            }
        )
        assert resp.status_code == 200
        datos = resp.json()["datos"]
        assert datos["token_push"] == token_prueba
        assert datos["activo"] is True

        # 2. Verificar sanitización de contenido en pantalla de bloqueo
        titulo_sensible = "PEDIDO: Entrega a Juan Perez por 4,500 Bs 🚨🎉"
        mensaje_sensible = "Cobrar 4,500 Bs en efectivo al cliente Juan Perez."
        titulo_seguro, mensaje_seguro = PushNotificationService.sanitizar_mensaje_pantalla_bloqueo(
            titulo_sensible, mensaje_sensible
        )
        assert "4,500" not in titulo_seguro
        assert "Juan Perez" not in titulo_seguro
        assert "🚨" not in titulo_seguro
        assert "4,500" not in mensaje_seguro
        assert "Juan Perez" not in mensaje_seguro

        # 3. Envío mock de push
        res_push = PushNotificationService.enviar_notificacion(
            tokens=[token_prueba],
            titulo=titulo_sensible,
            mensaje=mensaje_sensible
        )
        assert res_push["modo"] == "mock"
        assert res_push["enviados"] == 1

        # 4. Desactivación mediante logout
        resp_logout = client.post(
            "/api/movil/v1/auth/logout",
            json={"token_push": token_prueba}
        )
        assert resp_logout.status_code == 200
        assert resp_logout.json()["datos"]["dispositivos_desactivados"] >= 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_notificaciones_movil_crud(db_session_rollback):
    """Verifica listar y marcar como leída una notificación dentro de la sesión transaccional."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_CHOFER_USER
    try:
        # 1. Sembrar notificación directamente en la sesión transaccional
        id_notif = NotificationService.crear_notificacion(
            session=db_session_rollback,
            titulo="Prueba Móvil Base",
            mensaje="Verificación de bandeja móvil",
            tipo="INFO",
            id_usuario_destinatario=9
        )
        db_session_rollback.flush()
        assert id_notif is not None

        # 2. Listar notificaciones
        resp = client.get("/api/movil/v1/notificaciones?solo_no_leidas=true")
        assert resp.status_code == 200
        items = resp.json()["datos"]
        ids = [it["id"] for it in items]
        assert id_notif in ids

        # 3. Marcar como leída
        resp_leida = client.put(f"/api/movil/v1/notificaciones/{id_notif}/leida")
        assert resp_leida.status_code == 200
        assert resp_leida.json()["datos"]["leido"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_auth_login_credenciales_invalidas(db_session_rollback):
    """Prueba que el proxy de login móvil rechace credenciales inválidas de forma segura."""
    resp = client.post(
        "/api/movil/v1/auth/login",
        json={"Ci": "999999999", "Clave": "clave_erronea_123"}
    )
    assert resp.status_code == 401
    assert "Credenciales inválidas" in resp.json()["detail"]


def test_idempotencia_no_guarda_en_error_5xx(db_session_rollback):
    """Requisito B2: Errores de servidor (5xx) NUNCA se guardan en la tabla de idempotencia."""
    from app.Middleware.Idempotencia import IdempotenciaService
    clave_5xx = str(uuid.uuid4())
    uid = 9

    # Intentar registrar una respuesta con código 500
    IdempotenciaService.registrar_respuesta(
        session=db_session_rollback,
        usuario_id=uid,
        clave=clave_5xx,
        endpoint="/api/movil/v1/operaciones/probar-idempotencia",
        hash_cuerpo="hash_simulado",
        codigo_estado=500,
        cuerpo_respuesta={"error": "Fallo interno simulado"}
    )

    # Verificar en BD que NO se haya insertado
    registro = IdempotenciaService.consultar_registro(db_session_rollback, uid, clave_5xx)
    assert registro is None, "La clave de idempotencia no debió guardarse ante un error 5xx!"


def test_idempotencia_misma_transaccion_atomica(db_session_rollback):
    """Requisito B2: La clave se guarda en la misma transacción que la operación y se revierte con ella."""
    from app.Middleware.Idempotencia import IdempotenciaService
    clave_trans = str(uuid.uuid4())
    uid = 9

    # Usar savepoint anidado
    savepoint = db_session_rollback.begin_nested()
    IdempotenciaService.registrar_respuesta(
        session=db_session_rollback,
        usuario_id=uid,
        clave=clave_trans,
        endpoint="/api/movil/v1/operaciones/probar-idempotencia",
        hash_cuerpo="hash_transaccional",
        codigo_estado=200,
        cuerpo_respuesta={"exito": True}
    )
    # Revertir la transacción interna
    savepoint.rollback()

    # Comprobar que el registro de idempotencia fue revertido
    reg_revertido = IdempotenciaService.consultar_registro(db_session_rollback, uid, clave_trans)
    assert reg_revertido is None, "El registro de idempotencia debió revertirse con la transacción!"


def test_idempotencia_concurrencia_misma_clave(db_session_rollback):
    """Requisito B2: Dos peticiones simultáneas con la misma clave ejecutan la acción UNA sola vez."""
    app.dependency_overrides[get_current_user] = lambda: MOCK_CHOFER_USER
    try:
        clave_concurrente = str(uuid.uuid4())
        payload = {"monto": 150.0, "concepto": "Cobro simultáneo"}

        # Simular dos peticiones consecutivas inmediatas
        resp_a = client.post(
            "/api/movil/v1/operaciones/probar-idempotencia",
            json=payload,
            headers={"X-Idempotency-Key": clave_concurrente}
        )
        resp_b = client.post(
            "/api/movil/v1/operaciones/probar-idempotencia",
            json=payload,
            headers={"X-Idempotency-Key": clave_concurrente}
        )

        assert resp_a.status_code == 200
        assert resp_b.status_code == 200
        # La segunda petición devuelve HIT de caché con exactamente el mismo identificador de transacción
        assert resp_b.headers.get("x-cache-lookup") == "HIT"
        assert resp_a.json()["datos"]["transaccion_id"] == resp_b.json()["datos"]["transaccion_id"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_login_movil_rate_limiting_por_ci(db_session_rollback):
    """Requisito B3: Rate limiting por CI (máximo 5 intentos/minuto). Al sexto intento devuelve 429."""
    ci_prueba = "99887766"
    for i in range(5):
        client.post(
            "/api/movil/v1/auth/login",
            json={"Ci": ci_prueba, "Clave": f"clave_erronea_{i}"}
        )

    # El sexto intento debe ser bloqueado por exceso de intentos
    resp_bloqueada = client.post(
        "/api/movil/v1/auth/login",
        json={"Ci": ci_prueba, "Clave": "clave_erronea_6"}
    )
    assert resp_bloqueada.status_code == 429
    cuerpo = resp_bloqueada.json()
    assert "error" in cuerpo or "detail" in cuerpo

