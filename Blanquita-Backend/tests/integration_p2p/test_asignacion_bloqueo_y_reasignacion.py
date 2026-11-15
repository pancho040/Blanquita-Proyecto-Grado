import pytest
from unittest.mock import MagicMock, patch
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR
from app.Services.Logistica.RutaService import RutaService
from app.Models.Logistica.RutaModel import AsignacionRutaCrear
from datetime import date

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

def test_bloqueo_doble_asignacion_misma_ruta_409():
    """
    RutaService.CrearAsignacion debe lanzar 409 Conflict si la ruta
    ya se encuentra asignada a otro chofer para esa misma fecha.
    """
    db_mock = MagicMock()
    service = RutaService(db_mock)

    # Simular que la ruta 10 ya está asignada a Jaime Villegas
    service.repo.ListarAsignaciones = MagicMock(side_effect=lambda **kwargs: [
        {
            "IdAsignacionRuta": 250,
            "IdRutaDistribucion": 10,
            "IdUsuarioRepartidor": 24,
            "NombreRepartidor": "Jaime Villegas",
            "FechaAsignacion": date(2026, 11, 15),
            "Estado": "Pendiente"
        }
    ] if kwargs.get("id_ruta") == 10 else [])

    dto = AsignacionRutaCrear(
        IdRutaDistribucion=10,
        IdUsuarioRepartidor=25, # Otro chofer intentando tomar la misma ruta
        FechaAsignacion=date(2026, 11, 15)
    )

    with pytest.raises(Exception) as exc_info:
        service.CrearAsignacion(dto, id_usuario_asigna=20)

    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert "ya se encuentra asignada" in exc_info.value.detail

def test_reasignar_ruta_exitoso_200(client):
    """
    POST /logistica/asignaciones/{id}/reasignar reasigna la ruta a un nuevo chofer,
    con motivo válido (>= 5 chars) y actualiza el repartidor correctamente.
    """
    asig_mock = MagicMock()
    asig_mock.IdAsignacionRuta = 254
    asig_mock.IdUsuarioRepartidor = 24
    asig_mock.IdRutaDistribucion = 10
    asig_mock.FechaAsignacion = date(2026, 11, 15)
    asig_mock.Estado = "Pendiente"
    asig_mock.estado_operativo = "PENDIENTE_CARGA"
    asig_mock.Observacion = "Asignación inicial"
    asig_mock.IdSucursal = 2
    asig_mock.NombreRuta = "Ruta Centro Potosí"
    asig_mock.NombreChoferActual = "Jaime Villegas"

    chofer_nuevo_mock = MagicMock()
    chofer_nuevo_mock.IdUsuario = 25
    chofer_nuevo_mock.nombre_completo = "Carlos Chofer"
    chofer_nuevo_mock.IdSucursal = 2
    chofer_nuevo_mock.Activo = True

    def mock_db_execute(stmt, params=None):
        sql = str(stmt).lower()
        res = MagicMock()
        if "from public.\"asignacionruta\" ar" in sql and "where ar.\"idasignacionruta\"" in sql:
            res.fetchone.return_value = asig_mock
        elif "from public.\"sucursal\"" in sql:
            res.scalar.return_value = "Potosí"
        elif "from public.\"usuario\"" in sql and "where \"idusuario\" = :uid" in sql:
            res.fetchone.return_value = chofer_nuevo_mock
        elif "from public.\"asignacionruta\" ar" in sql and "ar.\"idusuariorepartidor\" = :cid" in sql:
            res.fetchone.return_value = None # No ocupado
        else:
            res.fetchone.return_value = None
            res.fetchall.return_value = []
            res.scalar.return_value = 0
        return res

    with patch("sqlalchemy.orm.Session.execute", side_effect=mock_db_execute), \
         patch("sqlalchemy.orm.Session.commit"):

        resp = client.post(
            "/logistica/asignaciones/254/reasignar",
            json={
                "nuevo_id_chofer": 25,
                "motivo": "Chofer inicial con baja médica",
                "transferir_stock": True
            }
        )

        assert resp.status_code == status.HTTP_200_OK, f"Error {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["codigo"] == "EXITO"
        assert data["datos"]["id_chofer_nuevo"] == 25
        assert "Carlos Chofer" in data["datos"]["nombre_chofer_nuevo"]

def test_reasignar_ruta_mismo_chofer_400(client):
    """
    No se puede reasignar una ruta al mismo chofer que ya la tiene asignada.
    """
    asig_mock = MagicMock()
    asig_mock.IdAsignacionRuta = 254
    asig_mock.IdUsuarioRepartidor = 24
    asig_mock.IdRutaDistribucion = 10
    asig_mock.FechaAsignacion = date(2026, 11, 15)
    asig_mock.Estado = "Pendiente"
    asig_mock.IdSucursal = 2

    def mock_db_execute(stmt, params=None):
        sql = str(stmt).lower()
        res = MagicMock()
        if "from public.\"asignacionruta\"" in sql:
            res.fetchone.return_value = asig_mock
        elif "from public.\"sucursal\"" in sql:
            res.scalar.return_value = "Potosí"
        return res

    with patch("sqlalchemy.orm.Session.execute", side_effect=mock_db_execute):
        resp = client.post(
            "/logistica/asignaciones/254/reasignar",
            json={
                "nuevo_id_chofer": 24, # Mismo chofer
                "motivo": "Reasignación errónea"
            }
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST
        assert "debe ser diferente" in resp.json()["detail"]

def test_reasignar_ruta_motivo_corto_422(client):
    """
    El motivo de la reasignación es obligatorio con mínimo 5 caracteres.
    """
    resp = client.post(
        "/logistica/asignaciones/254/reasignar",
        json={
            "nuevo_id_chofer": 25,
            "motivo": "abc" # Menos de 5 caracteres
        }
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
