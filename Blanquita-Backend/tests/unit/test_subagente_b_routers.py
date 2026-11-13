import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal, AlcanceUsuario
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL

client = TestClient(app)

def mock_chofer_user():
    return {
        "IdUsuario": 99,
        "IdRol": ROL_AGENTE_REPARTO,
        "id_rol": ROL_AGENTE_REPARTO,
        "IdSucursal": 1,
        "id_sucursal": 1,
        "Correo": "chofer99@blanquita.com"
    }

def mock_admin_user():
    return {
        "IdUsuario": 1,
        "IdRol": ROL_SUPERVISOR,
        "id_rol": ROL_SUPERVISOR,
        "IdSucursal": 1,
        "id_sucursal": 1,
        "Correo": "admin@blanquita.com"
    }

def mock_alcance():
    alc = MagicMock()
    alc.id_usuario = 1
    alc.puede_ver_todas = True
    alc.sucursales_permitidas = [1, 2]
    alc.sucursal_efectiva = 1
    alc.sucursal_asignada_defecto = 1
    alc.validar_recurso = MagicMock(return_value=True)
    return alc

def test_gatekeeper_carga_camion_bloquea_entrega():
    """Valida que un chofer con asignación en CARGA_SOLICITADA o PENDIENTE_CARGA reciba HTTP 403."""
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # Mocking gatekeeper query to return PENDIENTE_CARGA
    mock_row = MagicMock()
    mock_row.estado_operativo = "PENDIENTE_CARGA"
    mock_row.IdUsuarioRepartidor = 99
    mock_row.IdSucursal = 1
    mock_row.IdPedido = 123
    mock_db.execute.return_value.fetchone.return_value = mock_row

    with patch("app.Routes.Logistica.ChoferRouter._validar_pertenencia_pedido_chofer", return_value={"IdSucursal": 1}):
        response = client.post(
            "/api/movil/v1/chofer/entregar",
            headers={"X-Idempotency-Key": "a1b2c3d4-e5f6-4a5b-8c9d-0123456789ab"},
            json={
                "id_pedido": 123,
                "latitud": -19.04,
                "longitud": -65.26,
                "firma_chofer": "data:image/svg+xml;base64,dGVzdA=="
            }
        )
    assert response.status_code == 403
    assert "La carga de tu camión aún no fue aprobada en Web" in response.text
    app.dependency_overrides.clear()


def test_finalizar_admin_bloquea_chofer():
    """Valida que un chofer reciba HTTP 403 al intentar finalizar ruta."""
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.post(
        "/logistica/asignaciones/10/finalizar-admin",
        json={"observacion_cierre_admin": "Intento no autorizado"}
    )
    assert response.status_code == 403
    assert "exclusivo del administrador" in response.text
    app.dependency_overrides.clear()


def test_finalizar_admin_valida_cero_operaciones_pendientes():
    """Valida que si quedan operaciones en PENDIENTE de revisión, devuelva HTTP 400 con el conteo."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    asig_row = MagicMock()
    asig_row.IdAsignacionRuta = 10
    asig_row.IdUsuarioRepartidor = 99
    asig_row.IdSucursal = 1
    asig_row.estado_operativo = "APROBADA_EN_RUTA"
    mock_db.execute.return_value.fetchone.return_value = asig_row
    mock_db.execute.return_value.scalar.side_effect = [2, 1]

    response = client.post(
        "/logistica/asignaciones/10/finalizar-admin",
        json={"observacion_cierre_admin": "Cierre con pendientes"}
    )
    assert response.status_code == 400
    assert "quedan 3 operaciones pendientes de revisión (2 entregas, 1 cobros)" in response.text
    app.dependency_overrides.clear()


def test_aprobar_carga_camion_web():
    """Valida que la aprobación de carga web sume a inventario_chofer y pase a APROBADA_EN_RUTA."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    asig_row = MagicMock()
    asig_row.IdAsignacionRuta = 10
    asig_row.IdUsuarioRepartidor = 99
    asig_row.IdSucursal = 1
    asig_row.estado_operativo = "CARGA_SOLICITADA"
    mock_db.execute.return_value.fetchone.side_effect = [asig_row, None, None]

    response = client.post(
        "/logistica/asignaciones/10/aprobar-carga",
        json={
            "items": [{"presentacion_id": 1, "cantidad_aprobada": 50}],
            "observacion": "Carga conforme"
        }
    )
    assert response.status_code == 200
    datos = response.json()
    assert datos["codigo"] == "EXITO"
    assert datos["datos"]["estado_operativo"] == "APROBADA_EN_RUTA"
    assert datos["datos"]["habilitada_para_reparto"] is True
    app.dependency_overrides.clear()


def test_revisar_operacion_ruta_1a1():
    """Valida que la revisión 1 a 1 actualice el estado y emita evento."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    ped_row = MagicMock()
    ped_row.IdPedido = 55
    ped_row.IdUsuarioRepartidor = 99
    ped_row.IdSucursal = 1
    mock_db.execute.return_value.fetchone.return_value = ped_row

    response = client.patch(
        "/logistica/operaciones-ruta/entrega/55/revisar",
        json={"estado": "APROBADO", "observacion": "Entrega verificada"}
    )
    assert response.status_code == 200
    res = response.json()
    assert res["codigo"] == "EXITO"
    assert res["datos"]["estado_revision_web"] == "APROBADO"
    app.dependency_overrides.clear()


def test_solicitar_carga_movil():
    """Valida el contrato de solicitar carga: id_solicitud, CARGA_SOLICITADA, habilitada_para_reparto: false."""
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    asig_row = MagicMock()
    asig_row.IdAsignacionRuta = 10
    asig_row.IdUsuarioRepartidor = 99
    asig_row.IdSucursal = 1
    asig_row.estado_operativo = "PENDIENTE_CARGA"
    mock_db.execute.return_value.fetchone.side_effect = [asig_row, (501,)]

    response = client.post(
        "/api/movil/v1/chofer/solicitar-carga",
        json={
            "id_asignacion": 10,
            "usar_remanente": False,
            "observacion": "Carga de mañana",
            "items": [{"presentacion_id": 1, "cantidad_solicitada": 30.0}]
        }
    )
    assert response.status_code == 200
    res = response.json()
    assert res["codigo"] == "EXITO"
    assert res["datos"]["id_solicitud"] == 501
    assert res["datos"]["estado_operativo"] == "CARGA_SOLICITADA"
    assert res["datos"]["habilitada_para_reparto"] is False
    app.dependency_overrides.clear()


def test_resumen_sincronizacion_movil():
    """Valida que devuelva asignacion_activa, inventario_camion e historial_operaciones_hoy."""
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    # Simular asignación activa
    asig_dict = {
        "IdAsignacionRuta": 10,
        "IdRutaDistribucion": 2,
        "NombreRuta": "Ruta Centro",
        "FechaAsignacion": "2026-11-13",
        "Estado": "En Ruta",
        "estado_operativo": "APROBADA_EN_RUTA",
        "KilometrajeInicial": 100.0,
        "KilometrajeFinal": None,
        "Observacion": None
    }
    mock_db.execute.return_value.mappings.return_value.fetchone.return_value = asig_dict
    mock_db.execute.return_value.mappings.return_value.fetchall.return_value = []

    with patch("app.Services.Logistica.RutaService.RutaService.ObtenerTrackingAsignacion", return_value={"Paradas": []}):
        response = client.get("/api/movil/v1/chofer/resumen-sincronizacion")
    assert response.status_code == 200
    res = response.json()
    assert res["codigo"] == "EXITO"
    assert "asignacion_activa" in res["datos"]
    assert res["datos"]["asignacion_activa"]["estado_operativo"] == "APROBADA_EN_RUTA"
    assert res["datos"]["asignacion_activa"]["habilitada_para_reparto"] is True
    assert "inventario_camion" in res["datos"]
    assert "historial_operaciones_hoy" in res["datos"]
    app.dependency_overrides.clear()


def test_telemetria_solicitar_ubicacion_actual():
    """Valida la emisión de solicitud de ubicación bajo demanda y listado de choferes."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    mock_db.execute.return_value.mappings.return_value.fetchall.return_value = [
        {
            "IdUsuario": 99,
            "NombreCompleto": "Juan Perez",
            "Celular": "70012345",
            "IdSucursal": 1,
            "IdAsignacionRuta": 10,
            "NombreRuta": "Ruta Centro",
            "Latitud": -19.04,
            "Longitud": -65.26,
            "Velocidad": 15.0,
            "Bateria": 85,
            "EstadoMovimiento": "En Ruta",
            "UltimaActualizacion": None
        }
    ]

    response = client.post("/logistica/telemetria/solicitar-ubicacion-actual")
    assert response.status_code == 200
    res = response.json()
    assert res["codigo"] == "EXITO"
    assert res["total_choferes"] == 1
    assert res["choferes"][0]["nombre_chofer"] == "Juan Perez"
    assert res["choferes"][0]["origen_dato"] in ("EN_VIVO", "Última ubicación conocida")
    app.dependency_overrides.clear()

