import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.Auth.Dependencies import get_current_user, require_role
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_SUPERVISOR, ROL_AGENTE_REPARTO, ROL_GERENTE_GENERAL
from app.Services.Common.NotificationService import NotificationService

client = TestClient(app)


def test_supervisor_accede_cxc_notas_venta_y_clientes_sin_403():
    """Valida que un Supervisor (Rol 5) pueda consultar notas-venta y clientes en CXC sin recibir 403."""
    supervisor_user = {
        "IdUsuario": 55,
        "IdRol": ROL_SUPERVISOR,
        "PrimerNombre": "Supervisor",
        "ApellidoPaterno": "Potosi",
        "IdSucursal": 2,
        "IsAdmin": False
    }
    alcance_supervisor = AlcanceUsuario(
        id_usuario=55,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: supervisor_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_supervisor

    # Mocking Service return values
    mock_repo = MagicMock(caller=MagicMock(LlamarFuncion=lambda sql, params: [
        {"IdCliente": 201, "RazonSocial": "Cliente Potosi", "IdSucursal": 2}
    ]))

    def fake_init(self, db):
        self.db = db
        self.repo = mock_repo

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.Services.Contabilidad.CuentasCobrarService.CuentasCobrarService.__init__",
            fake_init
        )
        mp.setattr(
            "app.Services.Contabilidad.CuentasCobrarService.CuentasCobrarService.ListarNotasVenta",
            lambda self, **kwargs: [
                {"IdNotaVenta": 101, "NumeroNotaVenta": "NV-101", "SaldoPendiente": 0.0, "ImporteNeto": 500.0, "IdSucursal": 2, "total_count": 1}
            ]
        )

        resp_notas = client.get("/cxc/notas-venta")
        assert resp_notas.status_code == 200
        datos_notas = resp_notas.json()
        assert datos_notas["total"] == 1
        assert datos_notas["items"][0]["NumeroNota"] == "NV-101"

        resp_cli = client.get("/cxc/clientes")
        assert resp_cli.status_code == 200
        datos_cli = resp_cli.json()
        assert len(datos_cli) == 1
        assert datos_cli[0]["RazonSocial"] == "Cliente Potosi"

    app.dependency_overrides.clear()


def test_aislamiento_notificaciones_chofer_sql():
    """Valida que para Chofer (Rol 6 o 7), listar_notificaciones filtre estrictamente por su IdUsuario y tipos logísticos."""
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchall.return_value = []

    NotificationService.listar_notificaciones(
        session=mock_session,
        id_usuario=99,
        solo_no_leidas=True,
        id_rol=ROL_AGENTE_REPARTO,
        sucursal_id=1,
        puede_ver_todas=False
    )

    call_args = mock_session.execute.call_args
    sql_text = str(call_args[0][0])
    params = call_args[0][1]

    assert params["uid"] == 99
    # Debe filtrar estrictamente por IdUsuarioDestinatario = :uid (sin OR IS NULL para chofer)
    assert 'n."IdUsuarioDestinatario" = :uid' in sql_text
    assert 'n."IdUsuarioDestinatario" IS NULL' not in sql_text
    assert 'CARGA_APROBADA' in sql_text
    assert 'RUTA_ASIGNADA' in sql_text


def test_aislamiento_notificaciones_web_supervisor_por_sucursal():
    """Valida que para un Supervisor Web (no multisede), se filtre por sucursal efectiva."""
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchall.return_value = []

    NotificationService.listar_notificaciones(
        session=mock_session,
        id_usuario=55,
        solo_no_leidas=False,
        id_rol=ROL_SUPERVISOR,
        sucursal_id=2,
        puede_ver_todas=False
    )

    call_args = mock_session.execute.call_args
    sql_text = str(call_args[0][0])
    params = call_args[0][1]

    assert params["uid"] == 55
    assert params["suc_id"] == 2
    assert ':suc_id' in sql_text


def test_solicitudes_carga_filtro_sucursal_supervisor_estricto():
    """Valida que en GET /logistica/solicitudes-carga un supervisor sin multisede filtre por sucursal_efectiva."""
    supervisor_potosi = {
        "IdUsuario": 55,
        "IdRol": ROL_SUPERVISOR,
        "IdSucursal": 2,
    }
    alcance_potosi = AlcanceUsuario(
        id_usuario=55,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

    mock_db = MagicMock()
    mock_db.execute.return_value.mappings.return_value.fetchall.return_value = []
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: supervisor_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_potosi

    # Intentar pasar sucursal_id=1 como query param no debe sobreescribir la sede efectiva
    resp = client.get("/logistica/solicitudes-carga?sucursal_id=1")
    assert resp.status_code == 200

    call_args = mock_db.execute.call_args
    params = call_args[0][1]
    assert params["suc_id"] == 2  # Estrictamente forzado a sucursal_efectiva

    app.dependency_overrides.clear()


def test_programar_entrega_fecha_futura_y_frecuencia_ejecuta_cron():
    """Valida registro de cliente en ruta con PROGRAMAR_ENTREGA, frecuencia y fecha futura."""
    chofer_user = {
        "IdUsuario": 9,
        "IdRol": ROL_AGENTE_REPARTO,
        "IdSucursal": 1,
    }
    alcance_chofer = AlcanceUsuario(
        id_usuario=9,
        puede_ver_todas=False,
        sucursales_permitidas=[1],
        sucursal_efectiva=1,
        sucursal_asignada_defecto=1
    )

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_chofer

    asig_mock = MagicMock()
    asig_mock.IdAsignacionRuta = 50
    asig_mock.IdRutaDistribucion = 12
    asig_mock.estado_operativo = "APROBADA_EN_RUTA"

    # db.execute retornos:
    # 1. asig activa -> asig_mock
    # 2. insert cliente -> [301]
    # 3. insert pv -> [401]
    # 4. max orden -> scalar 2
    # 5. insert rpv
    # 6. recalcular / consultar asig_futura -> None
    # 7. filas_reord -> []
    mock_db.execute.return_value.fetchone.side_effect = [
        asig_mock,
        (301,),
        (401,),
        None,
        (501,),
    ]
    mock_db.execute.return_value.scalar.return_value = 2
    mock_db.execute.return_value.mappings.return_value.fetchall.return_value = [
        {"OrdenVisita": 1, "IdPuntoVenta": 401, "NombrePuntoVenta": "Tienda Futura", "IdCliente": 301, "RazonSocial": "Cliente Futuro", "frecuencia_visita": "DIARIO", "dias_visita": "TODOS"}
    ]

    fecha_manana = str(date.today() + timedelta(days=1))
    payload = {
        "datos_cliente": {
            "razon_social": "Cliente Futuro SRL",
            "direccion": "Av. Las Américas 123",
            "latitud": -19.04,
            "longitud": -65.26,
            "frecuencia_visita": "DIARIO",
            "dias_visita": "TODOS",
            "fecha_entrega_programada": fecha_manana
        },
        "modalidad": "PROGRAMAR_ENTREGA",
        "dia_semana_programado": 3,
        "frecuencia_visita": "DIARIO",
        "dias_visita": "TODOS",
        "fecha_entrega_programada": fecha_manana,
        "items_programados": [
            {"presentacion_id": 1, "cantidad": 10.0}
        ]
    }

    resp = client.post("/api/movil/v1/chofer/cliente-en-ruta", json=payload)
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["codigo"] == "EXITO"
    assert res_json["datos"]["id_cliente"] == 301
    assert res_json["datos"]["modalidad"] == "PROGRAMAR_ENTREGA"

    app.dependency_overrides.clear()
