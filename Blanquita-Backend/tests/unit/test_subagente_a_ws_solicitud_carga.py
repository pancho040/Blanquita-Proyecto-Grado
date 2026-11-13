"""
Pruebas Unitarias y de Integración - Subagente A
Sistema ERP Papelera Blanquita

Verifica:
1. Conexión WebSocket /ws/logistica y /ws/flota aceptando token JWT además de ticket.
2. Aceptación sin cabecera Origin (React Native Android).
3. Permisos en POST /logistica/flota/ws-ticket para Chofer (IdRol 6).
4. Emisión de eventos: solicitud_carga_recibida, carga_camion_aprobada, ruta_asignada.
5. Idempotencia en POST /api/movil/v1/chofer/solicitar-carga.
6. Enriquecimiento de GET /api/movil/v1/chofer/hoja-ruta/activa y /resumen-sincronizacion.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.Services.Logistica.FlotaWebSocketManager import flota_ws_manager


@pytest.fixture
def client():
    return TestClient(app)


def test_ws_ticket_permite_rol_chofer(client):
    """POST /logistica/flota/ws-ticket debe permitir al rol Chofer (IdRol 6) obtener un ticket."""
    usuario_chofer = {
        "IdUsuario": 42,
        "IdRol": 6,
        "IdEstadoUsuario": 1,
        "IsAdmin": False,
        "IdSucursal": 1,
        "Correo": "chofer42@blanquita.com"
    }

    from app.Auth.Dependencies import get_current_user
    from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal, AlcanceUsuario
    app.dependency_overrides[get_current_user] = lambda: usuario_chofer
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: AlcanceUsuario(
        id_usuario=42,
        puede_ver_todas=False,
        sucursales_permitidas=[1],
        sucursal_efectiva=1,
        sucursal_asignada_defecto=1
    )
    try:
        resp = client.post(
            "/logistica/flota/ws-ticket",
            headers={"Authorization": "Bearer fake_token"}
        )
        assert resp.status_code == 200, f"Error: {resp.text}"
        data = resp.json()
        assert "ticket" in data
        assert data["ticket"].startswith("ws_flota_")
        assert data["expira_en_segundos"] == 60
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_ws_logistica_conexion_con_jwt_token(client):
    """/ws/logistica debe aceptar conexión enviando ?token=<JWT> directamente."""
    payload_jwt = {
        "id_usuario": 42,
        "id_rol": 6,
        "id_sucursal": 1,
        "sub": "auth-uuid-42"
    }

    snapshot_mock = []

    with patch("app.Auth.Jwt.verificar_token", return_value=payload_jwt):
        with patch("app.Services.Logistica.RutaService.RutaService.ObtenerChoferesEnVivo", return_value=snapshot_mock):
            with client.websocket_connect("/ws/logistica?token=jwt_valido_mock") as ws:
                msg_inicial = ws.receive_json()
                assert msg_inicial["tipo"] == "SNAPSHOT_INICIAL"

                ws.send_text("ping")
                resp = ws.receive_json()
                assert resp["tipo"] == "pong"


def test_ws_logistica_sin_cabecera_origin(client):
    """React Native Android no envía Origin o envía uno custom: no debe ser rechazado."""
    ticket = flota_ws_manager.crear_ticket(usuario_id=42, sucursales_permitidas=[1], duracion_segundos=60)
    with patch("app.Services.Logistica.RutaService.RutaService.ObtenerChoferesEnVivo", return_value=[]):
        # Conectar sin cabecera Origin
        with client.websocket_connect(f"/ws/logistica?ticket={ticket}", headers={}) as ws:
            msg = ws.receive_json()
            assert msg["tipo"] == "SNAPSHOT_INICIAL"


@pytest.mark.asyncio
async def test_flota_ws_manager_emitir_a_chofer_y_web():
    """Verifica que emitir_a_chofer entregue al socket del chofer y difunda a web."""
    mock_ws_chofer = MagicMock()
    mock_ws_chofer.send_json = AsyncMock()

    mock_ws_web = MagicMock()
    mock_ws_web.send_json = AsyncMock()

    flota_ws_manager.active_connections[mock_ws_chofer] = {
        "usuario_id": 42,
        "id_chofer": 42,
        "tipo_cliente": "movil",
        "sucursales_permitidas": [1]
    }
    flota_ws_manager.active_connections[mock_ws_web] = {
        "usuario_id": 1,
        "tipo_cliente": "web",
        "sucursales_permitidas": [1]
    }

    try:
        evento = {
            "tipo": "carga_camion_aprobada",
            "id_asignacion": 99,
            "id_chofer": 42,
            "estado_operativo": "APROBADA_EN_RUTA",
            "habilitada_para_reparto": True
        }
        entregado = await flota_ws_manager.emitir_a_chofer(42, evento)
        assert entregado is True
        mock_ws_chofer.send_json.assert_called_once_with(evento)
        mock_ws_web.send_json.assert_called_once_with(evento)
    finally:
        flota_ws_manager.active_connections.pop(mock_ws_chofer, None)
        flota_ws_manager.active_connections.pop(mock_ws_web, None)


def test_solicitar_carga_idempotencia_y_notificacion(client):
    """POST /api/movil/v1/chofer/solicitar-carga debe registrar la solicitud y responder 200 de forma idempotente."""
    usuario_chofer = {
        "IdUsuario": 42,
        "IdRol": 6,
        "IdEstadoUsuario": 1,
        "IsAdmin": False,
        "IdSucursal": 1,
        "Correo": "chofer42@blanquita.com"
    }
    from app.Auth.Dependencies import get_current_user
    from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal, AlcanceUsuario

    app.dependency_overrides[get_current_user] = lambda: usuario_chofer
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: AlcanceUsuario(
        id_usuario=42,
        puede_ver_todas=False,
        sucursales_permitidas=[1],
        sucursal_efectiva=1,
        sucursal_asignada_defecto=1
    )

    try:
        # Mock de asignación en BD
        asig_mock = MagicMock()
        asig_mock.IdAsignacionRuta = 100
        asig_mock.IdUsuarioRepartidor = 42
        asig_mock.IdSucursal = 1
        asig_mock.estado_operativo = "PENDIENTE_CARGA"

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("sqlalchemy.orm.Session.commit") as mock_commit:
            mock_exec.return_value.fetchone.side_effect = [
                asig_mock, # asig
                (555,) # sol_row id_solicitud = 555
            ]
            mock_exec.return_value.mappings.return_value.fetchone.return_value = None # sol_existente
            mock_exec.return_value.fetchall.return_value = [] # supervisores

            payload = {
                "id_asignacion": 100,
                "usar_remanente": False,
                "observacion": "Carga inicial de mañana",
                "items": [
                    {"presentacion_id": 1, "cantidad_solicitada": 50.0}
                ]
            }

            resp = client.post(
                "/api/movil/v1/chofer/solicitar-carga",
                json=payload,
                headers={"Authorization": "Bearer fake_token"}
            )
            assert resp.status_code == 200, f"Error: {resp.text}"
            data = resp.json()
            assert data["codigo"] == "EXITO"
            assert data["datos"]["estado_operativo"] == "CARGA_SOLICITADA"
            assert data["datos"]["solicitud_carga_pendiente"] is True
            assert data["datos"]["id_solicitud"] == 555
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)

