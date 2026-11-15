import pytest
from datetime import timedelta
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR
from app.utils.fechas import fecha_actual_bolivia

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
def client_supervisor():
    app.dependency_overrides[get_current_user] = override_supervisor_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_alcance_potosi
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_telemetria_en_vivo_hoy_200(client_supervisor):
    hoy_str = fecha_actual_bolivia().isoformat()
    resp = client_supervisor.get(f"/logistica/telemetria/en-vivo?id_sucursal=2&fecha={hoy_str}")
    assert resp.status_code == status.HTTP_200_OK, f"Error {resp.status_code}: {resp.text}"
    assert isinstance(resp.json(), list)

def test_telemetria_en_vivo_ayer_200(client_supervisor):
    ayer_str = (fecha_actual_bolivia() - timedelta(days=1)).isoformat()
    resp = client_supervisor.get(f"/logistica/telemetria/en-vivo?id_sucursal=2&fecha={ayer_str}")
    assert resp.status_code == status.HTTP_200_OK, f"Error {resp.status_code}: {resp.text}"
    assert isinstance(resp.json(), list)

def test_telemetria_en_vivo_fecha_invalida_no_500(client_supervisor):
    # Con fecha inválida debe responder 200 (degradando a hoy) o 422, NUNCA 500
    resp = client_supervisor.get("/logistica/telemetria/en-vivo?id_sucursal=2&fecha=fecha_invalida_xyz")
    assert resp.status_code in [status.HTTP_200_OK, status.HTTP_422_UNPROCESSABLE_ENTITY]
    assert resp.status_code != status.HTTP_500_INTERNAL_SERVER_ERROR
