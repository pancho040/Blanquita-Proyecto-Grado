"""
Suite End-to-End y Pruebas de Integración:
Desbloqueo WebSocket Chofer (Rol 6), Autenticación sin Origin y Flujo de Solicitud de Carga.

Sistema ERP Papelera Blanquita

Verifica:
1. Conexión WebSocket a /ws/logistica?token=<jwt_chofer_rol_6> (IdRol = 6, sin header Origin).
   Conexión exitosa (HTTP 101 Switching Protocols y NUNCA 403 Forbidden).
2. Conexión WebSocket con parámetro ?ticket=...
3. Cierre con código 4401 ante credenciales inexistentes o inválidas.
4. Flujo de solicitud de carga (POST /api/movil/v1/chofer/solicitar-carga):
   - Asignación pasa a CARGA_SOLICITADA.
   - Emisión de notificación WebSocket (solicitud_carga_recibida).
5. GET /api/movil/v1/chofer/resumen-sincronizacion:
   - Devuelve estado_operativo == 'CARGA_SOLICITADA' y solicitud_carga_pendiente == True.
   - habilitada_para_reparto == False.
6. Idempotencia en solicitud de carga si ya está en CARGA_SOLICITADA o existe solicitud pendiente.
"""

import pytest
from datetime import date
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.Services.Logistica.FlotaWebSocketManager import flota_ws_manager
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal, AlcanceUsuario


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def usuario_chofer_fixture():
    return {
        "IdUsuario": 60,
        "IdRol": 6,
        "IdEstadoUsuario": 1,
        "IsAdmin": False,
        "IdSucursal": 1,
        "Correo": "chofer60@blanquita.com",
        "PrimerNombre": "Juan",
        "ApellidoPaterno": "Perez"
    }


def test_ws_chofer_conexion_con_jwt_rol_6_sin_origin(client):
    """
    Verifica que un chofer móvil (IdRol = 6) pueda conectarse a /ws/logistica?token=<jwt>
    sin enviar cabecera Origin (emulando React Native en Android),
    completando el handshake 101 Switching Protocols sin recibir 403 Forbidden.
    """
    payload_jwt_chofer = {
        "id_usuario": 60,
        "id_rol": 6,
        "id_sucursal": 1,
        "sub": "auth-uuid-chofer-60"
    }

    with patch("app.Auth.Jwt.verificar_token", return_value=payload_jwt_chofer):
        with patch("app.Services.Logistica.RutaService.RutaService.ObtenerChoferesEnVivo", return_value=[]):
            # Headers explícitamente vacíos para garantizar ausencia de cabecera Origin
            with client.websocket_connect("/ws/logistica?token=jwt_chofer_rol_6_valido", headers={}) as ws:
                msg_inicial = ws.receive_json()
                assert msg_inicial is not None
                assert msg_inicial["tipo"] == "SNAPSHOT_INICIAL"

                # Prueba de latido ping-pong bidireccional
                ws.send_text("ping")
                respuesta_ping = ws.receive_json()
                assert respuesta_ping["tipo"] == "pong"


def test_ws_chofer_conexion_con_ticket(client):
    """
    Verifica que la conexión a /ws/logistica?ticket=<ticket> funcione exitosamente
    para el chofer sin cabecera Origin.
    """
    ticket_chofer = flota_ws_manager.crear_ticket(
        usuario_id=60,
        sucursales_permitidas=[1],
        duracion_segundos=60,
        rol=6
    )

    with patch("app.Services.Logistica.RutaService.RutaService.ObtenerChoferesEnVivo", return_value=[]):
        with client.websocket_connect(f"/ws/logistica?ticket={ticket_chofer}", headers={}) as ws:
            msg_inicial = ws.receive_json()
            assert msg_inicial["tipo"] == "SNAPSHOT_INICIAL"


def test_ws_chofer_rechazo_token_invalido(client):
    """
    Verifica que si no se proporciona un ticket ni token válido,
    la conexión WebSocket sea rechazada limpiamente (código de cierre 4401).
    """
    with patch("app.Auth.Jwt.verificar_token", return_value=None):
        with pytest.raises(Exception):
            with client.websocket_connect("/ws/logistica?token=token_invalido", headers={}):
                pass


def test_flujo_solicitud_carga_pasa_a_carga_solicitada_y_emite_ws(client, usuario_chofer_fixture):
    """
    Flujo de Solicitud de Carga:
    Al invocar POST /api/movil/v1/chofer/solicitar-carga:
    1. La asignación pasa a estado_operativo == 'CARGA_SOLICITADA'.
    2. solicitud_carga_pendiente == True.
    3. Se emite evento WebSocket 'solicitud_carga_recibida'.
    """
    app.dependency_overrides[get_current_user] = lambda: usuario_chofer_fixture
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: AlcanceUsuario(
        id_usuario=60,
        puede_ver_todas=False,
        sucursales_permitidas=[1],
        sucursal_efectiva=1,
        sucursal_asignada_defecto=1
    )

    try:
        asig_mock = MagicMock()
        asig_mock.IdAsignacionRuta = 101
        asig_mock.IdUsuarioRepartidor = 60
        asig_mock.IdSucursal = 1
        asig_mock.estado_operativo = "PENDIENTE_CARGA"

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("sqlalchemy.orm.Session.commit") as mock_commit, \
             patch("app.Services.Logistica.FlotaWebSocketManager.flota_ws_manager.emitir_a_web", new_callable=AsyncMock) as mock_emitir_ws:

            # Mock retorno de queries en solicitar-carga
            mock_exec.return_value.fetchone.side_effect = [
                asig_mock,       # sql_asig
                (999,)           # RETURNING id_solicitud
            ]
            # No hay solicitud existente previa
            mock_exec.return_value.mappings.return_value.fetchone.return_value = None
            mock_exec.return_value.scalar.return_value = "Juan Perez"
            mock_exec.return_value.fetchall.return_value = []

            payload = {
                "id_asignacion": 101,
                "usar_remanente": False,
                "observacion": "Solicitud de carga matutina",
                "items": [
                    {"presentacion_id": 5, "cantidad_solicitada": 40.0}
                ]
            }

            resp = client.post(
                "/api/movil/v1/chofer/solicitar-carga",
                json=payload,
                headers={"Authorization": "Bearer fake_token"}
            )

            assert resp.status_code == 200, f"Error devuelto: {resp.text}"
            data = resp.json()
            assert data["codigo"] == "EXITO"
            assert data["datos"]["id_solicitud"] == 999
            assert data["datos"]["id_asignacion"] == 101
            assert data["datos"]["estado_operativo"] == "CARGA_SOLICITADA"
            assert data["datos"]["solicitud_carga_pendiente"] is True
            assert data["datos"]["habilitada_para_reparto"] is False

            # Verificar emisión de WebSocket a la sucursal
            mock_emitir_ws.assert_called_once()
            args_ws, _ = mock_emitir_ws.call_args
            evento_ws = args_ws[0]
            assert evento_ws["tipo"] == "solicitud_carga_recibida"
            assert evento_ws["id_solicitud"] == 999
            assert evento_ws["id_asignacion"] == 101
            assert evento_ws["id_chofer"] == 60

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_resumen_sincronizacion_devuelve_carga_solicitada(client, usuario_chofer_fixture):
    """
    GET /api/movil/v1/chofer/resumen-sincronizacion
    Debe retornar:
    - estado_operativo == 'CARGA_SOLICITADA'
    - solicitud_carga_pendiente == True
    - habilitada_para_reparto == False
    """
    app.dependency_overrides[get_current_user] = lambda: usuario_chofer_fixture
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: AlcanceUsuario(
        id_usuario=60,
        puede_ver_todas=False,
        sucursales_permitidas=[1],
        sucursal_efectiva=1,
        sucursal_asignada_defecto=1
    )

    try:
        asig_row = {
            "IdAsignacionRuta": 101,
            "IdRutaDistribucion": 3,
            "NombreRuta": "Ruta Centro Potosi",
            "FechaAsignacion": date.today(),
            "Estado": "En Proceso",
            "estado_operativo": "CARGA_SOLICITADA",
            "KilometrajeInicial": 12000.0,
            "KilometrajeFinal": None,
            "Observacion": "Turno Mañana"
        }

        sol_pend = {
            "id_solicitud": 999,
            "estado": "PENDIENTE",
            "fecha_solicitud": "2026-11-13T08:00:00",
            "observacion_chofer": "Solicitud de carga matutina"
        }

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("app.Services.Logistica.RutaService.RutaService.ObtenerTrackingAsignacion", return_value={"Paradas": []}):

            # Configurar mappings().fetchone() y fetchall() para las distintas consultas:
            # 1. Asignacion activa
            # 2. Solicitud pendiente
            # 3. Items solicitados
            # 4. Inventario camion
            # 5. Historial entregas
            # 6. Historial cobros
            mock_mappings = MagicMock()
            mock_exec.return_value.mappings.return_value = mock_mappings

            mock_mappings.fetchone.side_effect = [
                asig_row,    # sql_asig
                sol_pend     # sql_sol_pend
            ]
            mock_mappings.fetchall.side_effect = [
                [            # items_solicitados
                    {
                        "id_detalle": 1,
                        "id_presentacion": 5,
                        "CodigoPresentacion": "PAP-HIG-01",
                        "NombreProducto": "Papel Higiénico 4 rollos",
                        "TipoContenedor": "Paquete",
                        "stock_remanente": 0,
                        "stock_adicional_solicitado": 40.0,
                        "stock_adicional_aprobado": 0.0
                    }
                ],
                [],          # inventario_camion
                [],          # entregas
                []           # cobros
            ]

            resp = client.get(
                "/api/movil/v1/chofer/resumen-sincronizacion",
                headers={"Authorization": "Bearer fake_token"}
            )

            assert resp.status_code == 200, f"Error: {resp.text}"
            data = resp.json()
            assert data["codigo"] == "EXITO"

            datos = data["datos"]
            assert datos["estado_operativo"] == "CARGA_SOLICITADA"
            assert datos["solicitud_carga_pendiente"] is True

            asig_activa = datos["asignacion_activa"]
            assert asig_activa is not None
            assert asig_activa["id_asignacion"] == 101
            assert asig_activa["estado_operativo"] == "CARGA_SOLICITADA"
            assert asig_activa["solicitud_carga_pendiente"] is True
            assert asig_activa["habilitada_para_reparto"] is False
            assert asig_activa["id_solicitud_carga"] == 999
            assert len(asig_activa["items_solicitados"]) == 1

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_solicitar_carga_idempotencia_si_ya_esta_en_carga_solicitada(client, usuario_chofer_fixture):
    """
    Idempotencia de Solicitud de Carga:
    Si la asignación ya se encuentra en CARGA_SOLICITADA o existe una solicitud previa PENDIENTE,
    la API debe responder HTTP 200 con 'codigo': 'EXITO', sin duplicar registros ni fallar.
    """
    app.dependency_overrides[get_current_user] = lambda: usuario_chofer_fixture
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: AlcanceUsuario(
        id_usuario=60,
        puede_ver_todas=False,
        sucursales_permitidas=[1],
        sucursal_efectiva=1,
        sucursal_asignada_defecto=1
    )

    try:
        asig_mock = MagicMock()
        asig_mock.IdAsignacionRuta = 101
        asig_mock.IdUsuarioRepartidor = 60
        asig_mock.IdSucursal = 1
        asig_mock.estado_operativo = "CARGA_SOLICITADA"

        sol_existente_dict = {
            "id_solicitud": 999,
            "estado": "PENDIENTE",
            "fecha_solicitud": "2026-11-13T08:00:00",
            "observacion_chofer": "Solicitud previa"
        }

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("sqlalchemy.orm.Session.commit") as mock_commit:

            # 1. Busca asignacion -> asig_mock
            mock_exec.return_value.fetchone.side_effect = [
                asig_mock
            ]

            mock_mappings = MagicMock()
            mock_exec.return_value.mappings.return_value = mock_mappings

            # 2. Busca solicitud existente -> sol_existente_dict
            mock_mappings.fetchone.return_value = sol_existente_dict

            # 3. Busca items existentes -> lista
            mock_mappings.fetchall.return_value = [
                {
                    "id_detalle": 1,
                    "id_presentacion": 5,
                    "CodigoPresentacion": "PAP-HIG-01",
                    "NombreProducto": "Papel Higiénico 4 rollos",
                    "TipoContenedor": "Paquete",
                    "stock_remanente": 0.0,
                    "stock_adicional_solicitado": 40.0,
                    "stock_adicional_aprobado": 0.0
                }
            ]

            payload = {
                "id_asignacion": 101,
                "usar_remanente": False,
                "observacion": "Reintento de solicitud de carga",
                "items": [
                    {"presentacion_id": 5, "cantidad_solicitada": 40.0}
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
            assert "Solicitud de carga ya registrada previamente" in data["mensaje"]
            assert data["datos"]["id_solicitud"] == 999
            assert data["datos"]["id_asignacion"] == 101
            assert data["datos"]["estado_operativo"] == "CARGA_SOLICITADA"
            assert data["datos"]["solicitud_carga_pendiente"] is True
            assert data["datos"]["habilitada_para_reparto"] is False

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)
