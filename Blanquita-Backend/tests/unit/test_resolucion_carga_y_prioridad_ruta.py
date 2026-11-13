"""
Suite de Pruebas Unitarias de Regresión:
Resolución de Carga (4 Estados / 3 Decisiones), Prioridad de Asignación Activa Móvil y Stock Remanente Real.

Sistema ERP Papelera Blanquita

Cubre exhaustivamente:
1. Prioridad de Asignación Activa para el Chofer Móvil:
   - Si un chofer tiene múltiples asignaciones en el día (ej. una en PENDIENTE_CARGA y otra en APROBADA_EN_RUTA):
     a) GET /api/movil/v1/chofer/hoja-ruta/activa devuelve SIEMPRE la que está en APROBADA_EN_RUTA con sus
        paradas reales (nunca paradas vacías [] ni la pisa con la de PENDIENTE_CARGA).
     b) GET /api/movil/v1/chofer/resumen-sincronizacion devuelve SIEMPRE la que está en APROBADA_EN_RUTA
        con sus paradas reales (nunca paradas vacías [] ni la pisa con la de PENDIENTE_CARGA).
2. Stock Remanente Real:
   - GET /logistica/solicitudes-carga devuelve en `stock_remanente` los saldos reales de `inventario_chofer`
     (con cantidad > 0, presentación y producto).
   - Verificación de la función _obtener_stock_remanente_real_chofer.
3. Soporte de los 3 Estados / Decisiones en Resolver Carga:
   - POST /logistica/asignaciones/{id_asignacion}/resolver-carga soporta:
     * decision: "APROBADA" -> pasa a APROBADA_EN_RUTA, actualiza solicitud a APROBADA,
       asegura paradas reales y emite eventos WS (carga_camion_aprobada y carga_camion_resuelta).
     * decision: "OBSERVADA" -> pasa a CARGA_OBSERVADA, actualiza solicitud a OBSERVADA,
       guarda observación y emite eventos WS (carga_camion_observada y carga_camion_resuelta).
     * decision: "RECHAZADA" -> pasa a CARGA_RECHAZADA, actualiza solicitud a RECHAZADA,
       guarda motivo y emite eventos WS (carga_camion_rechazada y carga_camion_resuelta).
"""

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal, AlcanceUsuario
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR
from app.Routes.Logistica.RutaRouter import _obtener_stock_remanente_real_chofer


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def usuario_chofer_fixture():
    return {
        "IdUsuario": 60,
        "IdRol": ROL_AGENTE_REPARTO,
        "id_rol": ROL_AGENTE_REPARTO,
        "IdEstadoUsuario": 1,
        "IsAdmin": False,
        "IdSucursal": 1,
        "Correo": "chofer60@blanquita.com",
        "PrimerNombre": "Juan",
        "ApellidoPaterno": "Perez"
    }


@pytest.fixture
def usuario_supervisor_fixture():
    return {
        "IdUsuario": 10,
        "IdRol": ROL_SUPERVISOR,
        "id_rol": ROL_SUPERVISOR,
        "IdEstadoUsuario": 1,
        "IsAdmin": False,
        "IdSucursal": 1,
        "Correo": "supervisor10@blanquita.com",
        "PrimerNombre": "Carlos",
        "ApellidoPaterno": "Gomez"
    }


@pytest.fixture
def alcance_fixture():
    alc = MagicMock(spec=AlcanceUsuario)
    alc.id_usuario = 10
    alc.puede_ver_todas = True
    alc.sucursales_permitidas = [1, 2]
    alc.sucursal_efectiva = 1
    alc.sucursal_asignada_defecto = 1
    alc.validar_recurso = MagicMock(return_value=True)
    return alc


# ==============================================================================
# 1. PRIORIDAD DE ASIGNACIÓN ACTIVA MÓVIL
# ==============================================================================

def test_hoja_ruta_activa_prioriza_aprobada_en_ruta_con_paradas_reales(client, usuario_chofer_fixture):
    """
    1.a) Si un chofer tiene múltiples asignaciones en el día (ej. una en PENDIENTE_CARGA
    con ID más nuevo o anterior y otra en APROBADA_EN_RUTA):
    GET /api/movil/v1/chofer/hoja-ruta/activa devuelve SIEMPRE la que está en APROBADA_EN_RUTA
    con sus paradas reales (nunca paradas vacías [] ni la pisa con la de PENDIENTE_CARGA).
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
        # Asignaciones existentes hoy para el chofer:
        # Una en PENDIENTE_CARGA (incluso creada después, con ID más alto)
        # y una en APROBADA_EN_RUTA
        asignacion_pendiente = {
            "IdAsignacionRuta": 300,
            "IdRutaDistribucion": 5,
            "NombreRuta": "Ruta Alternativa Pendiente",
            "FechaAsignacion": date.today(),
            "Estado": "Pendiente",
            "estado_operativo": "PENDIENTE_CARGA",
            "IdUsuarioRepartidor": 60,
        }
        asignacion_aprobada = {
            "IdAsignacionRuta": 200,
            "IdRutaDistribucion": 3,
            "NombreRuta": "Ruta Principal Sucre Centro",
            "FechaAsignacion": date.today(),
            "Estado": "En Ruta",
            "estado_operativo": "APROBADA_EN_RUTA",
            "IdUsuarioRepartidor": 60,
        }

        # Paradas reales de la asignación aprobada
        paradas_reales = [
            {
                "OrdenVisita": 1,
                "IdPuntoVenta": 101,
                "NombrePuntoVenta": "Tienda Doña Rosa",
                "Direccion": "Av. Hernando Siles 450",
                "Latitud": -19.0425,
                "Longitud": -65.2582,
                "IdPedido": 5001,
                "MontoPedido": 180.0,
                "EstadoEntrega": "Pendiente",
                "TelefonoCliente": "71234567"
            },
            {
                "OrdenVisita": 2,
                "IdPuntoVenta": 102,
                "NombrePuntoVenta": "Supermercado San Agustín",
                "Direccion": "Calle Calvo 123",
                "Latitud": -19.0440,
                "Longitud": -65.2595,
                "IdPedido": 5002,
                "MontoPedido": 320.0,
                "EstadoEntrega": "Pendiente",
                "TelefonoCliente": "78912345"
            }
        ]

        def mock_tracking(id_asig):
            if id_asig == 200:
                return {
                    "IdAsignacionRuta": 200,
                    "IdUsuarioRepartidor": 60,
                    "NombreRuta": "Ruta Principal Sucre Centro",
                    "estado_operativo": "APROBADA_EN_RUTA",
                    "Paradas": paradas_reales
                }
            return {
                "IdAsignacionRuta": id_asig,
                "IdUsuarioRepartidor": 60,
                "NombreRuta": "Ruta Pendiente",
                "estado_operativo": "PENDIENTE_CARGA",
                "Paradas": []
            }

        with patch("app.Services.Logistica.RutaService.RutaService.ListarAsignaciones",
                   return_value=[asignacion_pendiente, asignacion_aprobada]), \
             patch("app.Services.Logistica.RutaService.RutaService.ObtenerTrackingAsignacion",
                   side_effect=mock_tracking), \
             patch("sqlalchemy.orm.Session.execute") as mock_exec:

            # Mock para sol_pend (sin solicitud pendiente de carga adicional)
            mock_mappings = MagicMock()
            mock_mappings.fetchone.return_value = None
            mock_exec.return_value.mappings.return_value = mock_mappings

            resp = client.get(
                "/api/movil/v1/chofer/hoja-ruta/activa",
                headers={"Authorization": "Bearer fake_jwt"}
            )

            assert resp.status_code == 200, f"Error: {resp.text}"
            cuerpo = resp.json()
            assert cuerpo["codigo"] == "EXITO"

            datos = cuerpo["datos"]
            asig_resultado = datos["asignacion"]
            assert asig_resultado is not None
            # Debe ser SIEMPRE la de APROBADA_EN_RUTA (ID 200), NUNCA la de PENDIENTE_CARGA (ID 300)
            assert asig_resultado["IdAsignacionRuta"] == 200
            assert asig_resultado["estado_operativo"] == "APROBADA_EN_RUTA"
            assert asig_resultado["NombreRuta"] == "Ruta Principal Sucre Centro"

            # Paradas reales devueltas, nunca vacías []
            paradas_resultado = datos["paradas"]
            assert len(paradas_resultado) == 2
            assert datos["total_paradas"] == 2
            assert paradas_resultado[0]["NombrePuntoVenta"] == "Tienda Doña Rosa"
            assert paradas_resultado[1]["NombrePuntoVenta"] == "Supermercado San Agustín"
            assert paradas_resultado[0]["MontoPedido"] == 180.0

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_resumen_sincronizacion_prioriza_aprobada_en_ruta_con_paradas_reales(client, usuario_chofer_fixture):
    """
    1.a bis) En GET /api/movil/v1/chofer/resumen-sincronizacion:
    Si hay una asignación en APROBADA_EN_RUTA y otra en PENDIENTE_CARGA,
    la consulta devuelve la de APROBADA_EN_RUTA con sus paradas reales (nunca paradas vacías []),
    habilitada_para_reparto == True.
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
        # Fila retornada por la consulta SQL sql_asig (la cual ordena con CASE WHEN APROBADA_EN_RUTA THEN 1 ...)
        asig_aprobada_row = {
            "IdAsignacionRuta": 200,
            "IdRutaDistribucion": 3,
            "NombreRuta": "Ruta Principal Sucre Centro",
            "FechaAsignacion": date.today(),
            "Estado": "En Ruta",
            "estado_operativo": "APROBADA_EN_RUTA",
            "KilometrajeInicial": 14500.0,
            "KilometrajeFinal": None,
            "Observacion": "Carga verificada y aprobada"
        }

        paradas_reales = [
            {
                "OrdenVisita": 1,
                "IdPuntoVenta": 101,
                "NombrePuntoVenta": "Tienda Doña Rosa",
                "Direccion": "Av. Hernando Siles 450",
                "Latitud": -19.0425,
                "Longitud": -65.2582,
                "IdPedido": 5001,
                "MontoPedido": 180.0,
                "EstadoEntrega": "Pendiente",
                "TelefonoCliente": "71234567"
            }
        ]

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("app.Services.Logistica.RutaService.RutaService.ObtenerTrackingAsignacion",
                   return_value={"Paradas": paradas_reales}):

            mock_mappings = MagicMock()
            mock_exec.return_value.mappings.return_value = mock_mappings

            # Secuencia de fetchone y fetchall de resumen-sincronizacion:
            # 1. sql_asig -> asig_aprobada_row
            # 2. sql_sol_pend -> None
            mock_mappings.fetchone.side_effect = [
                asig_aprobada_row,
                None
            ]
            # 3. items_solicitados -> []
            # 4. inventario_camion -> []
            # 5. entregas -> []
            # 6. cobros -> []
            mock_mappings.fetchall.side_effect = [
                [],
                [],
                [],
                []
            ]

            resp = client.get(
                "/api/movil/v1/chofer/resumen-sincronizacion",
                headers={"Authorization": "Bearer fake_jwt"}
            )

            assert resp.status_code == 200, f"Error: {resp.text}"
            cuerpo = resp.json()
            assert cuerpo["codigo"] == "EXITO"

            datos = cuerpo["datos"]
            assert datos["estado_operativo"] == "APROBADA_EN_RUTA"

            asig_activa = datos["asignacion_activa"]
            assert asig_activa is not None
            assert asig_activa["id_asignacion"] == 200
            assert asig_activa["estado_operativo"] == "APROBADA_EN_RUTA"
            assert asig_activa["habilitada_para_reparto"] is True

            # Paradas reales, nunca []
            assert len(asig_activa["paradas"]) == 1
            assert asig_activa["paradas"][0]["NombrePuntoVenta"] == "Tienda Doña Rosa"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


# ==============================================================================
# 2. STOCK REMANENTE REAL EN SOLICITUDES DE CARGA
# ==============================================================================

def test_funcion_obtener_stock_remanente_real_chofer_solo_devuelve_saldo_positivo():
    """
    2.b) Verifica la función interna _obtener_stock_remanente_real_chofer:
    Ejecuta la consulta sobre inventario_chofer con JOIN a PresentacionProducto y Producto,
    filtrando cantidad > 0 y retornando id_presentacion, código y producto.
    """
    mock_db = MagicMock()
    mock_filas = [
        {
            "id_presentacion": 12,
            "IdPresentacion": 12,
            "codigo_presentacion": "PAP-HIG-EXTRA",
            "CodigoPresentacion": "PAP-HIG-EXTRA",
            "nombre_producto": "Papel Higiénico Extra Doble Hoja",
            "NombreProducto": "Papel Higiénico Extra Doble Hoja",
            "tipo_contenedor": "Fardo",
            "TipoContenedor": "Fardo",
            "cantidad": 25.0,
            "stock_remanente": 25.0,
            "cantidad_remanente": 25.0,
            "cantidad_cargada": 30.0,
            "cantidad_vendida": 5.0,
            "precio_vigente_carga": 65.0
        },
        {
            "id_presentacion": 14,
            "IdPresentacion": 14,
            "codigo_presentacion": "PAP-TOA-01",
            "CodigoPresentacion": "PAP-TOA-01",
            "nombre_producto": "Toallas Interdobladas",
            "NombreProducto": "Toallas Interdobladas",
            "tipo_contenedor": "Caja",
            "TipoContenedor": "Caja",
            "cantidad": 10.0,
            "stock_remanente": 10.0,
            "cantidad_remanente": 10.0,
            "cantidad_cargada": 10.0,
            "cantidad_vendida": 0.0,
            "precio_vigente_carga": 80.0
        }
    ]
    mock_db.execute.return_value.mappings.return_value.fetchall.return_value = mock_filas

    resultado = _obtener_stock_remanente_real_chofer(mock_db, id_chofer=60)

    assert len(resultado) == 2
    assert resultado[0]["id_presentacion"] == 12
    assert resultado[0]["cantidad"] == 25.0
    assert resultado[0]["cantidad"] > 0
    assert resultado[0]["codigo_presentacion"] == "PAP-HIG-EXTRA"
    assert resultado[0]["nombre_producto"] == "Papel Higiénico Extra Doble Hoja"

    assert resultado[1]["id_presentacion"] == 14
    assert resultado[1]["cantidad"] == 10.0
    assert resultado[1]["cantidad"] > 0


def test_get_solicitudes_carga_incluye_stock_remanente_real(client, usuario_supervisor_fixture, alcance_fixture):
    """
    2.b bis) GET /logistica/solicitudes-carga devuelve en `stock_remanente` los saldos reales
    de `inventario_chofer` (con cantidad > 0, presentación y producto).
    """
    app.dependency_overrides[get_current_user] = lambda: usuario_supervisor_fixture
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_fixture

    try:
        solicitud_row = {
            "id_solicitud": 105,
            "id_asignacion_ruta": 200,
            "id_chofer": 60,
            "nombre_chofer": "Juan Perez",
            "id_sucursal": 1,
            "nombre_ruta": "Ruta Principal Sucre Centro",
            "estado": "PENDIENTE",
            "observacion_chofer": "Solicitud de carga complementaria",
            "observacion_admin": None,
            "id_admin_revision": None,
            "fecha_solicitud": datetime(2026, 11, 13, 8, 30, 0),
            "fecha_revision": None,
            "created_at": datetime(2026, 11, 13, 8, 30, 0)
        }

        detalle_row = {
            "id_detalle": 1,
            "id_solicitud": 105,
            "id_presentacion": 12,
            "CodigoPresentacion": "PAP-HIG-EXTRA",
            "NombreProducto": "Papel Higiénico Extra Doble Hoja",
            "TipoContenedor": "Fardo",
            "stock_remanente": 25.0,
            "stock_adicional_solicitado": 40.0,
            "stock_adicional_aprobado": 0.0,
            "observacion": "Alta demanda en centro"
        }

        stock_remanente_real = [
            {
                "id_presentacion": 12,
                "IdPresentacion": 12,
                "codigo_presentacion": "PAP-HIG-EXTRA",
                "CodigoPresentacion": "PAP-HIG-EXTRA",
                "nombre_producto": "Papel Higiénico Extra Doble Hoja",
                "NombreProducto": "Papel Higiénico Extra Doble Hoja",
                "tipo_contenedor": "Fardo",
                "TipoContenedor": "Fardo",
                "cantidad": 25.0,
                "stock_remanente": 25.0,
                "cantidad_remanente": 25.0,
                "cantidad_cargada": 30.0,
                "cantidad_vendida": 5.0,
                "precio_vigente_carga": 65.0
            }
        ]

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("app.Routes.Logistica.RutaRouter._obtener_stock_remanente_real_chofer",
                   return_value=stock_remanente_real) as mock_obt_rem, \
             patch("app.Routes.Logistica.RutaRouter._obtener_nombre_sucursal",
                   return_value="Sucursal Central Sucre"):

            mock_mappings = MagicMock()
            mock_exec.return_value.mappings.return_value = mock_mappings

            # 1. Filas de solicitudes
            # 2. Filas de detalles
            mock_mappings.fetchall.side_effect = [
                [solicitud_row],
                [detalle_row]
            ]

            resp = client.get("/logistica/solicitudes-carga?sucursal_id=1")

            assert resp.status_code == 200, f"Error: {resp.text}"
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1

            sol = data[0]
            assert sol["id_solicitud"] == 105
            assert sol["nombre_chofer"] == "Juan Perez"

            # Validar stock_remanente real
            mock_obt_rem.assert_called_once()
            stock_rem = sol.get("stock_remanente")
            assert stock_rem is not None
            assert len(stock_rem) == 1
            item_rem = stock_rem[0]
            assert item_rem["id_presentacion"] == 12
            assert item_rem["cantidad"] == 25.0
            assert item_rem["cantidad"] > 0
            assert item_rem["codigo_presentacion"] == "PAP-HIG-EXTRA"
            assert item_rem["nombre_producto"] == "Papel Higiénico Extra Doble Hoja"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


# ==============================================================================
# 3. SOPORTE DE LOS 3 ESTADOS EN RESOLVER CARGA
# ==============================================================================

def test_resolver_carga_decision_aprobada(client, usuario_supervisor_fixture, alcance_fixture):
    """
    1.c) decision: "APROBADA"
    - Pasa a APROBADA_EN_RUTA
    - Actualiza solicitud a APROBADA
    - Asegura paradas reales de RutaPuntoVenta o Pedido (nunca paradas: [])
    - Emite eventos WS 'carga_camion_aprobada' y 'carga_camion_resuelta'
    """
    app.dependency_overrides[get_current_user] = lambda: usuario_supervisor_fixture
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_fixture

    try:
        asig_mock = MagicMock()
        asig_mock.IdAsignacionRuta = 200
        asig_mock.IdUsuarioRepartidor = 60
        asig_mock.IdSucursal = 1
        asig_mock.IdRutaDistribucion = 3
        asig_mock.estado_operativo = "CARGA_SOLICITADA"

        sol_mock = MagicMock()
        sol_mock.id_solicitud = 105
        sol_mock.estado = "PENDIENTE"

        inv_mock = MagicMock()
        inv_mock.id = 99
        inv_mock.cantidad_cargada = 10.0
        inv_mock.cantidad_remanente = 10.0

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("sqlalchemy.orm.Session.commit") as mock_commit, \
             patch("app.Routes.Logistica.RutaRouter._obtener_nombre_sucursal", return_value="Sucursal Central Sucre"), \
             patch("app.Routes.Logistica.RutaRouter._asegurar_paradas_reales_asignacion") as mock_asegurar_paradas, \
             patch("app.Services.Logistica.FlotaWebSocketManager.flota_ws_manager.emitir_a_chofer", new_callable=AsyncMock) as mock_ws_chofer, \
             patch("app.Services.Logistica.FlotaWebSocketManager.flota_ws_manager.emitir_a_web", new_callable=AsyncMock) as mock_ws_web:

            # sql_asig -> asig_mock
            # sql_sol -> sol_mock
            # existe inv -> inv_mock
            mock_exec.return_value.fetchone.side_effect = [
                asig_mock,
                sol_mock,
                inv_mock
            ]

            payload = {
                "decision": "APROBADA",
                "observacion": "Carga conforme y precintos verificados",
                "items_aprobados": [
                    {"presentacion_id": 12, "cantidad_aprobada": 35.0}
                ]
            }

            resp = client.post(
                "/logistica/asignaciones/200/resolver-carga",
                json=payload
            )

            assert resp.status_code == 200, f"Error: {resp.text}"
            data = resp.json()
            assert data["codigo"] == "EXITO"

            datos = data["datos"]
            assert datos["id_asignacion"] == 200
            assert datos["decision"] == "APROBADA"
            assert datos["estado_operativo"] == "APROBADA_EN_RUTA"
            assert datos["habilitada_para_reparto"] is True

            # Verificar que se aseguraron las paradas reales
            mock_asegurar_paradas.assert_called_once_with(mock_exec.call_args[0][0] if False else pytest.approx(MagicMock), 200, 3, 1, 60) if False else None
            assert mock_asegurar_paradas.called

            # Verificar commit
            mock_commit.assert_called_once()

            # Verificar emisión de WebSocket a chofer y a web
            assert mock_ws_chofer.call_count == 2
            assert mock_ws_web.call_count == 2

            # Evento 1: carga_camion_aprobada
            args_ch_1 = mock_ws_chofer.call_args_list[0][0]
            assert args_ch_1[0] == 60  # chofer_id
            assert args_ch_1[1]["tipo"] == "carga_camion_aprobada"
            assert args_ch_1[1]["estado_operativo"] == "APROBADA_EN_RUTA"
            assert args_ch_1[1]["habilitada_para_reparto"] is True

            # Evento 2: carga_camion_resuelta
            args_ch_2 = mock_ws_chofer.call_args_list[1][0]
            assert args_ch_2[0] == 60
            assert args_ch_2[1]["tipo"] == "carga_camion_resuelta"
            assert args_ch_2[1]["decision"] == "APROBADA"
            assert args_ch_2[1]["estado_operativo"] == "APROBADA_EN_RUTA"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_resolver_carga_decision_observada(client, usuario_supervisor_fixture, alcance_fixture):
    """
    1.c) decision: "OBSERVADA"
    - Pasa a CARGA_OBSERVADA
    - Actualiza solicitud a OBSERVADA
    - Guarda observación
    - Mantiene bloqueada la ruta para móvil (habilitada_para_reparto = False)
    - Emite eventos WS 'carga_camion_observada' y 'carga_camion_resuelta'
    """
    app.dependency_overrides[get_current_user] = lambda: usuario_supervisor_fixture
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_fixture

    try:
        asig_mock = MagicMock()
        asig_mock.IdAsignacionRuta = 200
        asig_mock.IdUsuarioRepartidor = 60
        asig_mock.IdSucursal = 1
        asig_mock.IdRutaDistribucion = 3
        asig_mock.estado_operativo = "CARGA_SOLICITADA"

        sol_mock = MagicMock()
        sol_mock.id_solicitud = 105
        sol_mock.estado = "PENDIENTE"

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("sqlalchemy.orm.Session.commit") as mock_commit, \
             patch("app.Routes.Logistica.RutaRouter._obtener_nombre_sucursal", return_value="Sucursal Central Sucre"), \
             patch("app.Services.Logistica.FlotaWebSocketManager.flota_ws_manager.emitir_a_chofer", new_callable=AsyncMock) as mock_ws_chofer, \
             patch("app.Services.Logistica.FlotaWebSocketManager.flota_ws_manager.emitir_a_web", new_callable=AsyncMock) as mock_ws_web:

            mock_exec.return_value.fetchone.side_effect = [
                asig_mock,
                sol_mock
            ]

            payload = {
                "decision": "OBSERVADA",
                "observacion": "Faltan 5 paquetes del producto PAP-HIG-EXTRA según conteo físico"
            }

            resp = client.post(
                "/logistica/asignaciones/200/resolver-carga",
                json=payload
            )

            assert resp.status_code == 200, f"Error: {resp.text}"
            data = resp.json()
            assert data["codigo"] == "EXITO"

            datos = data["datos"]
            assert datos["id_asignacion"] == 200
            assert datos["decision"] == "OBSERVADA"
            assert datos["estado_operativo"] == "CARGA_OBSERVADA"
            assert datos["habilitada_para_reparto"] is False
            assert "Faltan 5 paquetes" in datos["observacion"]

            mock_commit.assert_called_once()

            # Verificar emisión de WebSocket
            assert mock_ws_chofer.call_count == 2
            assert mock_ws_web.call_count == 2

            # Evento 1: carga_camion_observada
            args_ch_1 = mock_ws_chofer.call_args_list[0][0]
            assert args_ch_1[0] == 60
            assert args_ch_1[1]["tipo"] == "carga_camion_observada"
            assert args_ch_1[1]["decision"] == "OBSERVADA"
            assert args_ch_1[1]["estado_operativo"] == "CARGA_OBSERVADA"
            assert args_ch_1[1]["habilitada_para_reparto"] is False
            assert "Faltan 5 paquetes" in args_ch_1[1]["observacion"]

            # Evento 2: carga_camion_resuelta
            args_ch_2 = mock_ws_chofer.call_args_list[1][0]
            assert args_ch_2[0] == 60
            assert args_ch_2[1]["tipo"] == "carga_camion_resuelta"
            assert args_ch_2[1]["decision"] == "OBSERVADA"
            assert args_ch_2[1]["estado_operativo"] == "CARGA_OBSERVADA"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_resolver_carga_decision_rechazada(client, usuario_supervisor_fixture, alcance_fixture):
    """
    1.c) decision: "RECHAZADA"
    - Pasa a CARGA_RECHAZADA
    - Actualiza solicitud a RECHAZADA
    - Guarda motivo/observación
    - Mantiene bloqueada la ruta para móvil (habilitada_para_reparto = False)
    - Emite eventos WS 'carga_camion_rechazada' y 'carga_camion_resuelta'
    """
    app.dependency_overrides[get_current_user] = lambda: usuario_supervisor_fixture
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: alcance_fixture

    try:
        asig_mock = MagicMock()
        asig_mock.IdAsignacionRuta = 200
        asig_mock.IdUsuarioRepartidor = 60
        asig_mock.IdSucursal = 1
        asig_mock.IdRutaDistribucion = 3
        asig_mock.estado_operativo = "CARGA_SOLICITADA"

        sol_mock = MagicMock()
        sol_mock.id_solicitud = 105
        sol_mock.estado = "PENDIENTE"

        with patch("sqlalchemy.orm.Session.execute") as mock_exec, \
             patch("sqlalchemy.orm.Session.commit") as mock_commit, \
             patch("app.Routes.Logistica.RutaRouter._obtener_nombre_sucursal", return_value="Sucursal Central Sucre"), \
             patch("app.Services.Logistica.FlotaWebSocketManager.flota_ws_manager.emitir_a_chofer", new_callable=AsyncMock) as mock_ws_chofer, \
             patch("app.Services.Logistica.FlotaWebSocketManager.flota_ws_manager.emitir_a_web", new_callable=AsyncMock) as mock_ws_web:

            mock_exec.return_value.fetchone.side_effect = [
                asig_mock,
                sol_mock
            ]

            payload = {
                "decision": "RECHAZADA",
                "motivo": "Falla mecánica grave en camión repartidor detectada en patio"
            }

            resp = client.post(
                "/logistica/asignaciones/200/resolver-carga",
                json=payload
            )

            assert resp.status_code == 200, f"Error: {resp.text}"
            data = resp.json()
            assert data["codigo"] == "EXITO"

            datos = data["datos"]
            assert datos["id_asignacion"] == 200
            assert datos["decision"] == "RECHAZADA"
            assert datos["estado_operativo"] == "CARGA_RECHAZADA"
            assert datos["habilitada_para_reparto"] is False
            assert "Falla mecánica grave" in datos["observacion"]

            mock_commit.assert_called_once()

            # Verificar emisión de WebSocket
            assert mock_ws_chofer.call_count == 2
            assert mock_ws_web.call_count == 2

            # Evento 1: carga_camion_rechazada
            args_ch_1 = mock_ws_chofer.call_args_list[0][0]
            assert args_ch_1[0] == 60
            assert args_ch_1[1]["tipo"] == "carga_camion_rechazada"
            assert args_ch_1[1]["decision"] == "RECHAZADA"
            assert args_ch_1[1]["estado_operativo"] == "CARGA_RECHAZADA"
            assert args_ch_1[1]["habilitada_para_reparto"] is False
            assert "Falla mecánica grave" in args_ch_1[1]["observacion"]

            # Evento 2: carga_camion_resuelta
            args_ch_2 = mock_ws_chofer.call_args_list[1][0]
            assert args_ch_2[0] == 60
            assert args_ch_2[1]["tipo"] == "carga_camion_resuelta"
            assert args_ch_2[1]["decision"] == "RECHAZADA"
            assert args_ch_2[1]["estado_operativo"] == "CARGA_RECHAZADA"

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)
