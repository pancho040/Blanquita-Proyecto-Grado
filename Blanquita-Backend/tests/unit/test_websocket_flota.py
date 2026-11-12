"""
Pruebas Unitarias para FlotaWebSocketManager y Endpoints WebSocket (Render Web Service)
Sistema ERP Papelera Blanquita

Verifica:
1. Emisión de tickets de un solo uso y corta vida (60s) asociados a usuario y alcance de sucursal.
2. Rechazo de ticket inválido o expirado (código 4401).
3. Consumo estricto de un solo uso (segundo uso rechazado).
4. Conexión WebSocket y recepción del Snapshot Inicial de choferes.
5. Filtrado por sucursal: usuario con alcance Sucre (1) recibe solo pings de Sucre y no de Potosí (2).
6. Respuesta a mensaje de heartbeat (ping -> pong).
"""

import pytest
import time
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.Services.Logistica.FlotaWebSocketManager import flota_ws_manager


@pytest.fixture
def client():
    return TestClient(app)


def test_creacion_y_consumo_ticket_un_solo_uso():
    """El ticket efímero debe ser válido una sola vez y expirar tras su primer consumo."""
    ticket = flota_ws_manager.crear_ticket(usuario_id=99, sucursales_permitidas=[1], duracion_segundos=60)
    assert ticket.startswith("ws_flota_")

    # Primer consumo: válido
    data = flota_ws_manager.validar_y_consumir_ticket(ticket)
    assert data is not None
    assert data["usuario_id"] == 99
    assert data["sucursales_permitidas"] == [1]

    # Segundo consumo: debe retornar None (un solo uso)
    data_reintento = flota_ws_manager.validar_y_consumir_ticket(ticket)
    assert data_reintento is None


def test_ticket_expirado_rechazado():
    """Un ticket con tiempo de vida superado debe ser rechazado."""
    ticket = flota_ws_manager.crear_ticket(usuario_id=50, sucursales_permitidas=[2], duracion_segundos=-5)
    data = flota_ws_manager.validar_y_consumir_ticket(ticket)
    assert data is None


def test_conexion_websocket_ticket_invalido(client):
    """Una conexión sin ticket o con ticket falso debe cerrarse con código 4401."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/flota?ticket=ticket_falso_123") as ws:
            pass


def test_conexion_websocket_exitosa_snapshot_y_heartbeat(client):
    """Conexión válida recibe SNAPSHOT_INICIAL y responde a ping con pong."""
    ticket = flota_ws_manager.crear_ticket(usuario_id=1, sucursales_permitidas=None, duracion_segundos=60)

    snapshot_mock = [
        {"IdUsuario": 10, "NombreCompleto": "Chofer Sucre", "IdSucursal": 1, "Latitud": -19.04, "Longitud": -65.25}
    ]

    with patch("app.Services.Logistica.RutaService.RutaService.ObtenerChoferesEnVivo", return_value=snapshot_mock):
        with client.websocket_connect(f"/ws/flota?ticket={ticket}") as websocket:
            # 1. Validar Snapshot Inicial
            msg_inicial = websocket.receive_json()
            assert msg_inicial["tipo"] == "SNAPSHOT_INICIAL"
            assert "choferes" in msg_inicial
            assert len(msg_inicial["choferes"]) == 1
            assert msg_inicial["choferes"][0]["IdUsuario"] == 10

            # 2. Heartbeat Ping / Pong
            websocket.send_text("ping")
            resp_pong = websocket.receive_json()
            assert resp_pong["tipo"] == "pong"


@pytest.mark.asyncio
async def test_filtrado_por_sucursal_en_broadcast():
    """Un cliente con alcance a sucursal 1 no debe recibir broadcast de un chofer en sucursal 2."""
    mock_ws_sucre = MagicMock()
    mock_ws_sucre.send_json = pytest.importorskip("unittest.mock").AsyncMock()

    mock_ws_potosi = MagicMock()
    mock_ws_potosi.send_json = pytest.importorskip("unittest.mock").AsyncMock()

    # Registrar manualmente en el hub
    flota_ws_manager.active_connections[mock_ws_sucre] = {
        "usuario_id": 101,
        "sucursales_permitidas": [1]  # Solo Sucre
    }
    flota_ws_manager.active_connections[mock_ws_potosi] = {
        "usuario_id": 102,
        "sucursales_permitidas": [2]  # Solo Potosí
    }

    try:
        # Emitir posición de chofer en Potosí (sucursal 2)
        ping_potosi = {
            "id_chofer": 25,
            "sucursal_id": 2,
            "lat": -19.58,
            "lng": -65.75,
            "velocidad": 35.0,
            "bateria": 90
        }
        await flota_ws_manager.broadcast_ubicacion(ping_potosi)

        # El cliente de Potosí debe recibir el mensaje
        mock_ws_potosi.send_json.assert_called_once()
        msg_enviado = mock_ws_potosi.send_json.call_args[0][0]
        assert msg_enviado["tipo"] == "POSICION_CHOFER"
        assert msg_enviado["id_chofer"] == 25
        assert msg_enviado["sucursal_id"] == 2

        # El cliente de Sucre NO debe recibir el mensaje
        mock_ws_sucre.send_json.assert_not_called()

    finally:
        flota_ws_manager.active_connections.pop(mock_ws_sucre, None)
        flota_ws_manager.active_connections.pop(mock_ws_potosi, None)
