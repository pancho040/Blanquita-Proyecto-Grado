"""
Test de seguridad de serialización JSON y protección contra TypeError de Decimal en WebSockets/SSE.
Verifica:
1. No existencia de llamadas directas a .send_json( en app/Routes/Logistica/ y app/Services/Logistica/.
2. Que json_dumps_safe serializa correctamente Decimals, datetimes, dates, UUIDs, sets y diccionarios anidados.
3. Que flota_ws_manager.conectar y enviar_json_seguro envían el snapshot con Decimals sin lanzar TypeError.
"""
import ast
import json
import os
import pytest
from decimal import Decimal
from datetime import datetime, date, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

from app.core.serializers import json_dumps_safe
from app.Services.Logistica.FlotaWebSocketManager import FlotaWebSocketManager


def test_no_send_json_directo_en_logistica():
    """Verifica que ningún archivo de Logística llame directamente a .send_json( fuera de mocks."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
    directorios = [
        os.path.join(base_dir, "Routes", "Logistica"),
        os.path.join(base_dir, "Services", "Logistica"),
    ]

    archivos_con_send_json = []

    for directorio in directorios:
        for root, _, files in os.walk(directorio):
            for file in files:
                if file.endswith(".py"):
                    filepath = os.path.join(root, file)
                    with open(filepath, "r", encoding="utf-8") as f:
                        tree = ast.parse(f.read(), filename=filepath)
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Call):
                            if isinstance(node.func, ast.Attribute) and node.func.attr == "send_json":
                                # Solo permitimos en FlotaWebSocketManager dentro del fallback seguro
                                if not filepath.endswith("FlotaWebSocketManager.py"):
                                    archivos_con_send_json.append((filepath, node.lineno))

    assert not archivos_con_send_json, f"Se encontraron llamadas directas a .send_json() prohibidas: {archivos_con_send_json}"


def test_json_dumps_safe_con_decimales_y_fechas():
    """Valida que json_dumps_safe convierte Decimals, fechas y UUIDs sin lanzar TypeError."""
    datos = {
        "MontoCobradoTotal": Decimal("348.30"),
        "Latitud": Decimal("-19.583344"),
        "Longitud": Decimal("-65.753512"),
        "FechaHora": datetime(2026, 11, 15, 14, 30, 0, tzinfo=timezone.utc),
        "Fecha": date(2026, 11, 15),
        "IdOperacion": uuid4(),
        "Tags": {"urgente", "potosi"},
        "Lista": [Decimal("10.50"), Decimal("0.00")]
    }

    resultado_str = json_dumps_safe(datos)
    assert isinstance(resultado_str, str)
    
    parsed = json.loads(resultado_str)
    assert parsed["MontoCobradoTotal"] == 348.30
    assert parsed["Latitud"] == -19.583344
    assert parsed["Longitud"] == -65.753512
    assert parsed["Fecha"] == "2026-11-15"
    assert "2026-11-15T14:30:00" in parsed["FechaHora"]
    assert sorted(parsed["Tags"]) == ["potosi", "urgente"]
    assert parsed["Lista"] == [10.50, 0.0]


@pytest.mark.asyncio
async def test_flota_ws_manager_conectar_con_decimals_no_lanza_typeerror():
    """Simula la conexión de un WebSocket y el envío de un snapshot con Decimals."""
    manager = FlotaWebSocketManager()
    
    # Mock de WebSocket real (tiene send_text)
    mock_ws = MagicMock()
    mock_ws.send_text = AsyncMock()
    mock_ws.accept = AsyncMock()

    snapshot_con_decimals = [
        {
            "IdAsignacionRuta": 254,
            "IdUsuarioRepartidor": 24,
            "NombreRepartidor": "Jaime Villegas",
            "MontoCobradoTotal": Decimal("348.30"),
            "Latitud": Decimal("-19.583344"),
            "Longitud": Decimal("-65.753512"),
            "SegundosDesdeUltimoPing": 45,
            "IdSucursal": 1
        }
    ]

    ticket_data = {
        "usuario_id": 1,
        "tipo_cliente": "web",
        "sucursales_permitidas": [1]
    }

    # No debe lanzar TypeError: Object of type Decimal is not JSON serializable
    await manager.conectar(mock_ws, ticket_data, snapshot_inicial=snapshot_con_decimals)

    # Debe haber llamado a send_text con el JSON serializado
    assert mock_ws.send_text.called
    llamada_texto = mock_ws.send_text.call_args[0][0]
    payload_enviado = json.loads(llamada_texto)
    assert payload_enviado["tipo"] == "SNAPSHOT_INICIAL"
    assert payload_enviado["choferes"][0]["MontoCobradoTotal"] == 348.30
