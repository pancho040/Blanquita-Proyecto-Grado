import pytest
from datetime import date, timedelta, datetime
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Config.supabase import get_db
from app.Constants.Roles import ROL_SUPERVISOR, ROL_AGENTE_REPARTO
from app.Services.Common.NotificationService import NotificationService

client = TestClient(app)


# ==============================================================================
# a) AISLAMIENTO DE NOTIFICACIONES CHOFER MÓVIL (POTOSÍ: IdUsuario 24 y 25)
# ==============================================================================

def test_notificaciones_chofer_movil_potosi_usuario_24():
    """
    Valida que un chofer de Potosí (IdUsuario = 24) en GET /api/movil/v1/notificaciones:
    1. SOLO reciba notificaciones dirigidas estrictamente a su IdUsuario (24).
    2. SOLO reciba tipos logísticos (RUTA_ASIGNADA, CARGA_APROBADA, etc.).
    3. Haya 0 vales de caja chica / Kevin y 0 notificaciones de Sucre o de otros choferes.
    """
    chofer_potosi_24 = {
        "IdUsuario": 24,
        "IdRol": ROL_AGENTE_REPARTO,
        "PrimerNombre": "Juan",
        "ApellidoPaterno": "ChoferPotosi",
        "IdSucursal": 2,
        "IsAdmin": False
    }
    alcance_potosi_24 = AlcanceUsuario(
        id_usuario=24,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

    mock_db = MagicMock()

    # Simulamos lo que NotificationService.listar_notificaciones retorna tras ejecutar el SQL aislado
    mock_notificaciones_bd = [
        {
            "id": 101,
            "titulo": "Ruta Asignada Potosí",
            "mensaje": "Tienes la ruta Centro Potosí asignada",
            "tipo": "RUTA_ASIGNADA",
            "codigo_referencia": 501,
            "leido": False,
            "fecha_creacion": datetime.now().isoformat()
        },
        {
            "id": 102,
            "titulo": "Carga Aprobada",
            "mensaje": "Tu solicitud de carga 88 fue aprobada por supervisor de Potosí",
            "tipo": "CARGA_APROBADA",
            "codigo_referencia": 88,
            "leido": False,
            "fecha_creacion": datetime.now().isoformat()
        }
    ]

    with patch.object(NotificationService, "listar_notificaciones", return_value=mock_notificaciones_bd) as mock_listar:
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: chofer_potosi_24
        app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_potosi_24

        resp = client.get("/api/movil/v1/notificaciones")
        assert resp.status_code == 200
        body = resp.json()
        assert body["codigo"] == "EXITO"
        items = body["datos"]

        # 1. Validar que se llamó al servicio con id_usuario=24, id_rol=ROL_AGENTE_REPARTO y sucursal 2
        mock_listar.assert_called_once_with(
            session=mock_db,
            id_usuario=24,
            solo_no_leidas=False,
            id_rol=ROL_AGENTE_REPARTO,
            sucursal_id=2,
            puede_ver_todas=False
        )

        # 2. Validar que SOLO recibió notificaciones logísticas
        assert len(items) == 2
        for item in items:
            assert item["tipo"] in NotificationService.TIPOS_LOGISTICA_CHOFER
            # 3. Validar que no hay vales de caja chica, ni mención a Kevin ni a Sucre
            titulo_mensaje = f"{item['titulo']} {item['mensaje']}".lower()
            assert "caja chica" not in titulo_mensaje
            assert "vale" not in titulo_mensaje
            assert "kevin" not in titulo_mensaje
            assert "sucre" not in titulo_mensaje

        app.dependency_overrides.clear()


def test_notificaciones_chofer_movil_potosi_usuario_25():
    """
    Valida el aislamiento para el segundo chofer de Potosí (IdUsuario = 25):
    Recibe exclusivamente sus notificaciones logísticas y 0 notificaciones de otros choferes o de Sucre.
    """
    chofer_potosi_25 = {
        "IdUsuario": 25,
        "IdRol": ROL_AGENTE_REPARTO,
        "PrimerNombre": "Carlos",
        "ApellidoPaterno": "RepartidorPotosi",
        "IdSucursal": 2,
        "IsAdmin": False
    }
    alcance_potosi_25 = AlcanceUsuario(
        id_usuario=25,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

    mock_db = MagicMock()
    mock_notificaciones_bd_25 = [
        {
            "id": 201,
            "titulo": "Carga Observada",
            "mensaje": "Tu carga para la zona alta de Potosí requiere ajuste",
            "tipo": "CARGA_OBSERVADA",
            "codigo_referencia": 92,
            "leido": False,
            "fecha_creacion": datetime.now().isoformat()
        }
    ]

    with patch.object(NotificationService, "listar_notificaciones", return_value=mock_notificaciones_bd_25) as mock_listar:
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: chofer_potosi_25
        app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_potosi_25

        resp = client.get("/api/movil/v1/notificaciones")
        assert resp.status_code == 200
        body = resp.json()
        assert body["codigo"] == "EXITO"
        items = body["datos"]

        mock_listar.assert_called_once_with(
            session=mock_db,
            id_usuario=25,
            solo_no_leidas=False,
            id_rol=ROL_AGENTE_REPARTO,
            sucursal_id=2,
            puede_ver_todas=False
        )

        assert len(items) == 1
        assert items[0]["tipo"] == "CARGA_OBSERVADA"
        assert items[0]["codigo_referencia"] == 92

        # 0 vales de caja chica / Kevin / Sucre
        txt = f"{items[0]['titulo']} {items[0]['mensaje']}".lower()
        assert "caja chica" not in txt
        assert "vale" not in txt
        assert "kevin" not in txt
        assert "sucre" not in txt

        app.dependency_overrides.clear()


def test_aislamiento_notificaciones_chofer_sql_filtros_estrictos():
    """
    Verifica a nivel SQL que NotificationService.listar_notificaciones para Chofer:
    - Filtre estrictamente por n."IdUsuarioDestinatario" = :uid (sin permitir NULL ni difusión global).
    - Filtre estrictamente por tipos logísticos (TIPOS_LOGISTICA_CHOFER).
    - No admita tipos ajenos como VALE_CAJA_CHICA ni RENDICION_CUENTAS.
    """
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchall.return_value = []

    # Chofer 24
    NotificationService.listar_notificaciones(
        session=mock_session,
        id_usuario=24,
        solo_no_leidas=True,
        id_rol=ROL_AGENTE_REPARTO,
        sucursal_id=2,
        puede_ver_todas=False
    )

    call_args_24 = mock_session.execute.call_args
    sql_text = str(call_args_24[0][0])
    params = call_args_24[0][1]

    assert params["uid"] == 24
    assert 'n."IdUsuarioDestinatario" = :uid' in sql_text
    assert 'n."IdUsuarioDestinatario" IS NULL' not in sql_text
    assert 'VALE' not in sql_text
    assert 'CAJA_CHICA' not in sql_text
    assert 'CARGA_APROBADA' in sql_text
    assert 'CARGA_OBSERVADA' in sql_text
    assert 'RUTA_ASIGNADA' in sql_text


# ==============================================================================
# b) AISLAMIENTO DE NOTIFICACIONES Y SOLICITUDES SUPERVISOR WEB (POTOSÍ: IdUsuario 22)
# ==============================================================================

def test_supervisor_potosi_solicitudes_carga_aislamiento_sede():
    """
    Valida que un supervisor de Potosí (IdUsuario = 22, IdSucursal = 2) en GET /logistica/solicitudes-carga:
    1. Filtre estrictamente por sucursal_efectiva = 2 (Potosí).
    2. Aunque intente solicitar sucursal_id=1 (Sucre), la sucursal efectiva (2) anula la petición y solo consulta Potosí.
    3. Nunca recibe solicitudes de Sucre.
    """
    supervisor_potosi = {
        "IdUsuario": 22,
        "IdRol": ROL_SUPERVISOR,
        "PrimerNombre": "Supervisor",
        "ApellidoPaterno": "Potosi",
        "IdSucursal": 2,
        "IsAdmin": False
    }
    alcance_potosi = AlcanceUsuario(
        id_usuario=22,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

    mock_db = MagicMock()
    # Simulamos retorno de solicitudes de Potosí únicamente con fecha_solicitud datetime
    mock_db.execute.return_value.mappings.return_value.fetchall.side_effect = [
        [
            {
                "id_solicitud": 10,
                "id_asignacion_ruta": 501,
                "id_chofer": 24,
                "nombre_chofer": "Carlos Repartidor",
                "nombre_ruta": "Ruta Potosí Sur",
                "id_sucursal": 2,
                "estado": "PENDIENTE",
                "observacion_chofer": None,
                "observacion_admin": None,
                "id_admin_revision": None,
                "fecha_solicitud": datetime(2026, 11, 13, 8, 0, 0),
                "fecha_revision": None,
                "created_at": datetime(2026, 11, 13, 8, 0, 0)
            }
        ],
        [],  # stock remanente
        [],  # detalle productos
        [],
        []
    ]

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: supervisor_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_potosi

    # Intentamos inyectar sucursal_id=1 (Sucre)
    resp = client.get("/logistica/solicitudes-carga?sucursal_id=1&id_sucursal=1")
    assert resp.status_code == 200
    datos = resp.json()

    # Comprobar la llamada SQL realizada
    first_call_args = mock_db.execute.call_args_list[0]
    sql_text = str(first_call_args[0][0])
    params = first_call_args[0][1]

    assert params["suc_id"] == 2  # Blindado a Potosí
    assert 'r."IdSucursal" = :suc_id' in sql_text
    assert len(datos) == 1
    assert datos[0]["id_sucursal"] == 2  # Solo Potosí, nunca Sucre

    app.dependency_overrides.clear()


def test_supervisor_potosi_notificaciones_web_aislamiento_sucursal():
    """
    Valida que las notificaciones para Supervisor Web de Potosí (IdUsuario = 22, IdSucursal = 2):
    - Filtre con :suc_id = 2.
    - Utilice la condición de sucursal en AsignacionRuta y Usuario para evitar filtraciones de Sucre (IdSucursal = 1).
    """
    mock_session = MagicMock()
    mock_session.execute.return_value.fetchall.return_value = []

    NotificationService.listar_notificaciones(
        session=mock_session,
        id_usuario=22,
        solo_no_leidas=False,
        id_rol=ROL_SUPERVISOR,
        sucursal_id=2,
        puede_ver_todas=False
    )

    call_args = mock_session.execute.call_args
    sql_text = str(call_args[0][0])
    params = call_args[0][1]

    assert params["uid"] == 22
    assert params["suc_id"] == 2
    assert ':suc_id' in sql_text
    assert 'rd_sub."IdSucursal" = :suc_id' in sql_text


def test_supervisor_potosi_accede_cxc_notas_venta_y_clientes_sin_403():
    """
    Valida que el Supervisor de Potosí (IdUsuario = 22, Rol 5, IdSucursal = 2) pueda consultar:
    1. GET /cxc/notas-venta
    2. GET /cxc/clientes
    dentro de su sede sin recibir HTTP 403 Forbidden.
    """
    supervisor_potosi = {
        "IdUsuario": 22,
        "IdRol": ROL_SUPERVISOR,
        "PrimerNombre": "Supervisor",
        "ApellidoPaterno": "Potosi",
        "IdSucursal": 2,
        "IsAdmin": False
    }
    alcance_potosi = AlcanceUsuario(
        id_usuario=22,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: supervisor_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_potosi

    mock_repo = MagicMock(caller=MagicMock(LlamarFuncion=lambda sql, params: [
        {"IdCliente": 501, "RazonSocial": "Distribuidora Potosina SRL", "IdSucursal": 2}
    ]))

    def fake_cxc_init(self, db):
        self.db = db
        self.repo = mock_repo

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.Services.Contabilidad.CuentasCobrarService.CuentasCobrarService.__init__",
            fake_cxc_init
        )
        mp.setattr(
            "app.Services.Contabilidad.CuentasCobrarService.CuentasCobrarService.ListarNotasVenta",
            lambda self, **kwargs: [
                {
                    "IdNotaVenta": 301,
                    "NumeroNotaVenta": "NV-PTS-301",
                    "SaldoPendiente": 120.0,
                    "ImporteNeto": 600.0,
                    "IdSucursal": 2,
                    "total_count": 1
                }
            ]
        )

        # 1. GET /cxc/notas-venta
        resp_notas = client.get("/cxc/notas-venta")
        assert resp_notas.status_code == 200, f"Error inesperado: {resp_notas.status_code} {resp_notas.text}"
        body_notas = resp_notas.json()
        assert body_notas["total"] == 1
        assert body_notas["items"][0]["NumeroNota"] == "NV-PTS-301"

        # 2. GET /cxc/clientes
        resp_clientes = client.get("/cxc/clientes")
        assert resp_clientes.status_code == 200, f"Error inesperado: {resp_clientes.status_code} {resp_clientes.text}"
        body_clientes = resp_clientes.json()
        assert len(body_clientes) == 1
        assert body_clientes[0]["RazonSocial"] == "Distribuidora Potosina SRL"

    app.dependency_overrides.clear()


# ==============================================================================
# c) PROGRAMACIÓN DE CLIENTE CON FRECUENCIA Y PEDIDO FUTURO
# ==============================================================================

def test_programacion_cliente_con_frecuencia_y_pedido_futuro():
    """
    Valida que al registrar o programar un cliente con frecuencia y pedido para una fecha futura:
    1. Se calcule al instante la ruta para esa fecha (invocación del generador y reordenamiento).
    2. Se asienten los pedidos programados de la parada en public."Pedido" y "DetallePedido".
    3. Se actualice la parada en public."RutaPuntoVenta" con frecuencia y días de visita.
    """
    chofer_potosi = {
        "IdUsuario": 24,
        "IdRol": ROL_AGENTE_REPARTO,
        "IdSucursal": 2,
    }
    alcance_potosi = AlcanceUsuario(
        id_usuario=24,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: chofer_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_potosi

    asig_activa_mock = MagicMock()
    asig_activa_mock.IdAsignacionRuta = 60
    asig_activa_mock.IdRutaDistribucion = 15
    asig_activa_mock.estado_operativo = "APROBADA_EN_RUTA"

    asig_futura_mock = MagicMock()
    asig_futura_mock.IdAsignacionRuta = 75
    asig_futura_mock.IdUsuarioRepartidor = 24

    # Simular retornos secuenciales de db.execute().fetchone():
    # 1. Asignación activa del chofer -> asig_activa_mock
    # 2. INSERT Cliente RETURNING IdCliente -> (801,)
    # 3. INSERT PuntoVenta RETURNING IdPuntoVenta -> (901,)
    # 4. SELECT AsignacionRuta futura para fecha_prog -> asig_futura_mock
    # 5. INSERT Pedido RETURNING IdPedido -> (1001,)
    mock_db.execute.return_value.fetchone.side_effect = [
        asig_activa_mock,
        (801,),
        (901,),
        asig_futura_mock,
        (1001,)
    ]

    # Simular scalar:
    # 1. max OrdenVisita actual -> 3
    # 2. SELECT PrecioUnitario subtotal -> 25.50
    # 3. SELECT PrecioUnitario detalle -> 25.50
    mock_db.execute.return_value.scalar.side_effect = [3, 25.50, 25.50, 25.50, 25.50]
    mock_db.execute.return_value.mappings.return_value.fetchall.return_value = [
        {
            "OrdenVisita": 1,
            "IdPuntoVenta": 901,
            "NombrePuntoVenta": "Comercial Potosí",
            "IdCliente": 801,
            "RazonSocial": "Comercial Potosí Central SRL",
            "Direccion": "Av. Universitaria #100",
            "Latitud": -19.578,
            "Longitud": -65.755
        }
    ]

    fecha_futura = str(date.today() + timedelta(days=3))
    payload = {
        "datos_cliente": {
            "razon_social": "Comercial Potosí Central SRL",
            "nombre_comercial": "Comercial Potosí",
            "nit": "1020304050",
            "telefono": "72456789",
            "direccion": "Av. Universitaria #100",
            "latitud": -19.578,
            "longitud": -65.755,
            "observacion": "Entregar temprano en la mañana",
            "frecuencia_visita": "SEMANAL",
            "dias_visita": "VIERNES",
            "fecha_entrega_programada": fecha_futura
        },
        "modalidad": "PROGRAMAR_ENTREGA",
        "dia_semana_programado": 5,
        "frecuencia_visita": "SEMANAL",
        "dias_visita": "VIERNES",
        "fecha_entrega_programada": fecha_futura,
        "items_programados": [
            {"presentacion_id": 7, "cantidad": 40.0}
        ]
    }

    mock_cron = MagicMock()
    mock_recalcular = MagicMock()

    with patch("app.Services.Logistica.RutaService.RutaRepository.EjecutarGeneradorRutasDiarias", mock_cron), \
         patch("app.Services.Logistica.RutaService.RutaService.recalcular_orden_paradas_ruta", mock_recalcular):

        resp = client.post("/api/movil/v1/chofer/cliente-en-ruta", json=payload)
        assert resp.status_code == 200
        res_json = resp.json()

        assert res_json["codigo"] == "EXITO"
        assert res_json["datos"]["id_cliente"] == 801
        assert res_json["datos"]["id_punto_venta"] == 901
        assert res_json["datos"]["modalidad"] == "PROGRAMAR_ENTREGA"

        # 1. Se calcula al instante la ruta para la fecha futura
        mock_cron.assert_called_once()
        args_cron = mock_cron.call_args[0]
        # El generador debe haber sido invocado para la fecha futura solicitada
        assert str(args_cron[0]) == fecha_futura
        mock_recalcular.assert_called_once_with(15)

        # 2. Se asientan los pedidos programados de la parada
        # Verificamos que se hayan ejecutado los INSERT de Pedido y DetallePedido
        llamadas_sql = [str(call[0][0]) for call in mock_db.execute.call_args_list]
        llamadas_params = [call[0][1] for call in mock_db.execute.call_args_list if len(call[0]) > 1 and isinstance(call[0][1], dict)]

        insert_pedido_encontrado = False
        insert_detalle_encontrado = False
        insert_rpv_encontrado = False

        for sql, params in zip(llamadas_sql, llamadas_params):
            if 'INSERT INTO public."Pedido"' in sql:
                insert_pedido_encontrado = True
                assert params["cid"] == 801
                assert params["pvid"] == 901
                assert str(params["fec"]) == fecha_futura
                assert params["asig"] == 75  # Asignación futura vinculada
                assert params["sub"] == 40.0 * 25.50

            if 'INSERT INTO public."DetallePedido"' in sql:
                insert_detalle_encontrado = True
                assert params["ped"] == 1001
                assert params["pid"] == 7
                assert params["cant"] == 40.0
                assert params["pu"] == 25.50

            if 'INSERT INTO public."RutaPuntoVenta"' in sql:
                insert_rpv_encontrado = True
                assert params["rid"] == 15
                assert params["pvid"] == 901
                assert params["frec"] == "SEMANAL"
                assert "VIERNES" in params["dias"]

        assert insert_pedido_encontrado, "No se encontró el INSERT en public.Pedido para la parada programada"
        assert insert_detalle_encontrado, "No se encontró el INSERT en public.DetallePedido para los ítems programados"
        assert insert_rpv_encontrado, "No se encontró el INSERT/UPDATE en public.RutaPuntoVenta"

    app.dependency_overrides.clear()
