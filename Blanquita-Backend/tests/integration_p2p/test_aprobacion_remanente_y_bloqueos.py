import pytest
from unittest.mock import MagicMock, patch
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR

def override_supervisor_potosi():
    return {
        "IdUsuario": 20,
        "Username": "supervisor_potosi",
        "IdRol": ROL_SUPERVISOR,
        "IdSucursal": 2,
    }

def override_alcance_potosi():
    return AlcanceUsuario(
        id_usuario=20,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2,
    )

@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = override_supervisor_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_alcance_potosi
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_aprobacion_solo_con_remanente_200(client):
    """
    Si el chofer no solicita carga adicional (0 u) pero tiene stock remanente en su camión (> 0 u),
    el supervisor puede resolver y aprobar la ruta exitosamente (200 OK).
    """
    asig_mock = MagicMock()
    asig_mock.IdAsignacionRuta = 254
    asig_mock.IdUsuarioRepartidor = 24
    asig_mock.IdSucursal = 2
    asig_mock.IdRutaDistribucion = 10
    asig_mock.estado_operativo = "CARGA_SOLICITADA"

    sol_mock = MagicMock()
    sol_mock.id_solicitud = 88
    sol_mock.estado = "PENDIENTE"

    def mock_db_execute(stmt, params=None):
        sql = str(stmt).lower()
        res = MagicMock()
        if "from public.\"asignacionruta\"" in sql:
            res.fetchone.return_value = asig_mock
        elif "from public.\"sucursal\"" in sql:
            res.scalar.return_value = "Potosí"
        elif "from public.solicitud_carga_camion" in sql:
            res.fetchone.return_value = sol_mock
        elif "from public.inventario_chofer" in sql and "coalesce(sum" in sql:
            res.scalar.return_value = 42.0 # stock remanente total en camión
        elif "from public.\"rutapuntoventa\"" in sql:
            res.scalar.return_value = 5 # paradas existentes
        else:
            res.fetchone.return_value = None
            res.fetchall.return_value = []
            res.scalar.return_value = 0
        return res

    with patch("sqlalchemy.orm.Session.execute", side_effect=mock_db_execute), \
         patch("sqlalchemy.orm.Session.commit"):

        resp = client.post(
            "/logistica/asignaciones/254/resolver-carga",
            json={
                "decision": "APROBADA",
                "items_aprobados": [],
                "observacion": "Aprobado con stock remanente a bordo"
            }
        )

        assert resp.status_code == status.HTTP_200_OK, f"Error {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["codigo"] == "EXITO"
        assert data["datos"]["habilitada_para_reparto"] is True
        assert data["datos"]["estado_operativo"] == "APROBADA_EN_RUTA"

def test_aprobacion_sin_carga_ni_remanente_400(client):
    """
    Si no hay stock remanente en el camión (0 u) ni tampoco se aprueba carga adicional (0 u),
    el endpoint debe responder 400 Bad Request.
    """
    asig_mock = MagicMock()
    asig_mock.IdAsignacionRuta = 255
    asig_mock.IdUsuarioRepartidor = 24
    asig_mock.IdSucursal = 2
    asig_mock.IdRutaDistribucion = 10
    asig_mock.estado_operativo = "PENDIENTE"

    def mock_db_execute(stmt, params=None):
        sql = str(stmt).lower()
        res = MagicMock()
        if "from public.\"asignacionruta\"" in sql:
            res.fetchone.return_value = asig_mock
        elif "from public.\"sucursal\"" in sql:
            res.scalar.return_value = "Potosí"
        elif "from public.solicitud_carga_camion" in sql:
            res.fetchone.return_value = None
        elif "from public.inventario_chofer" in sql and "coalesce(sum" in sql:
            res.scalar.return_value = 0.0 # sin stock remanente
        else:
            res.fetchone.return_value = None
            res.fetchall.return_value = []
            res.scalar.return_value = 0
        return res

    with patch("sqlalchemy.orm.Session.execute", side_effect=mock_db_execute):
        resp = client.post(
            "/logistica/asignaciones/255/resolver-carga",
            json={
                "decision": "APROBADA",
                "items_aprobados": []
            }
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "No hay stock en el camión ni carga solicitada" in resp.json()["detail"]

def test_aprobacion_ruta_ya_activa_409(client):
    """
    Si la asignación ya tiene su carga aprobada (APROBADA_EN_RUTA o En Ruta),
    un intento subsiguiente de aprobación debe responder 409 Conflict.
    """
    asig_mock = MagicMock()
    asig_mock.IdAsignacionRuta = 254
    asig_mock.IdUsuarioRepartidor = 24
    asig_mock.IdSucursal = 2
    asig_mock.IdRutaDistribucion = 10
    asig_mock.estado_operativo = "APROBADA_EN_RUTA"

    sol_mock = MagicMock()
    sol_mock.id_solicitud = 88
    sol_mock.estado = "APROBADA"

    def mock_db_execute(stmt, params=None):
        sql = str(stmt).lower()
        res = MagicMock()
        if "from public.\"asignacionruta\"" in sql:
            res.fetchone.return_value = asig_mock
        elif "from public.\"sucursal\"" in sql:
            res.scalar.return_value = "Potosí"
        elif "from public.solicitud_carga_camion" in sql:
            res.fetchone.return_value = sol_mock
        else:
            res.fetchone.return_value = None
            res.fetchall.return_value = []
            res.scalar.return_value = 0
        return res

    with patch("sqlalchemy.orm.Session.execute", side_effect=mock_db_execute):
        resp = client.post(
            "/logistica/asignaciones/254/resolver-carga",
            json={
                "decision": "APROBADA",
                "items_aprobados": [{"presentacion_id": 1, "cantidad_aprobada": 10}]
            }
        )

        assert resp.status_code == status.HTTP_409_CONFLICT
        assert "Esta ruta ya tiene su carga aprobada" in resp.json()["detail"]
