import pytest
from datetime import date
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_AGENTE_REPARTO

# Usuarios reales existentes con cuenta en auth.users:
# IdUsuario 9: Marcos Condori (Chofer Sucre, IdSucursal 1)
# IdUsuario 10: Alejandro Vargas (Chofer Sucre, IdSucursal 1)
# IdUsuario 17: TEST_Potosi Chofer (Chofer Potosi, IdSucursal 2)
ID_CHOFER_SUCRE_A = 9
ID_CHOFER_SUCRE_B = 10
ID_CHOFER_POTOSI_C = 17


def _crear_override_usuario_alcance(id_usuario: int, id_rol: int, id_sucursal: int, puede_ver_todas: bool = False):
    usuario_mock = {
        "IdUsuario": id_usuario,
        "IdRol": id_rol,
        "IsAdmin": False,
        "IdSucursal": id_sucursal,
        "Correo": f"chofer_{id_usuario}@blanquita.com",
        "IdEstadoUsuario": 1,
    }

    def _override_user():
        return usuario_mock

    def _override_alcance():
        sedes = [1, 2] if puede_ver_todas else [id_sucursal]
        return AlcanceUsuario(
            id_usuario=id_usuario,
            puede_ver_todas=puede_ver_todas,
            sucursales_permitidas=sedes,
            sucursal_efectiva=id_sucursal,
            sucursal_asignada_defecto=id_sucursal,
        )

    return _override_user, _override_alcance


@pytest.fixture
def datos_choferes_test(db_session_rollback):
    """
    Siembra dentro de la transacción aislada con rollback:
    - Rutas, Zonas, Asignaciones y Pedidos para Chofer A (9) en Sucre y Chofer C (17) en Potosí.
    """
    db = db_session_rollback

    # 1. Zonas y Rutas de prueba
    db.execute(text("""
        INSERT INTO "ZonaDistribucion" ("IdZonaDistribucion", "NombreZona", "Ciudad")
        VALUES 
            (881, 'Zona Test Sucre Chofer', 'Sucre'),
            (882, 'Zona Test Potosi Chofer', 'Potosi')
        ON CONFLICT ("IdZonaDistribucion") DO NOTHING;

        INSERT INTO "RutaDistribucion" ("IdRutaDistribucion", "NombreRuta", "IdZonaDistribucion", "IdSucursal")
        VALUES 
            (881, 'Ruta 881 Sucre', 881, 1),
            (882, 'Ruta 882 Potosi', 882, 2)
        ON CONFLICT ("IdRutaDistribucion") DO UPDATE SET "IdSucursal" = EXCLUDED."IdSucursal";
    """))

    # 2. Asignaciones para hoy
    hoy = date.today()
    db.execute(text("""
        INSERT INTO "AsignacionRuta" ("IdAsignacionRuta", "IdRutaDistribucion", "IdUsuarioRepartidor", "IdUsuarioAsigna", "FechaAsignacion", "Estado")
        VALUES 
            (881, 881, :chofer_sucre, 4, :hoy, 'En Ruta'),
            (882, 882, :chofer_potosi, 4, :hoy, 'En Ruta')
        ON CONFLICT ("IdAsignacionRuta") DO UPDATE 
        SET "IdUsuarioRepartidor" = EXCLUDED."IdUsuarioRepartidor", "IdUsuarioAsigna" = EXCLUDED."IdUsuarioAsigna", "FechaAsignacion" = :hoy, "Estado" = EXCLUDED."Estado";
    """), {"hoy": hoy, "chofer_sucre": ID_CHOFER_SUCRE_A, "chofer_potosi": ID_CHOFER_POTOSI_C})

    # 3. Clientes y Puntos de Venta
    db.execute(text("""
        INSERT INTO "Cliente" ("IdCliente", "RazonSocial", "IdSucursal")
        VALUES 
            (881, 'Tienda Sucre 881', 1),
            (882, 'Tienda Potosi 882', 2)
        ON CONFLICT ("IdCliente") DO UPDATE SET "IdSucursal" = EXCLUDED."IdSucursal";

        INSERT INTO "PuntoVenta" ("IdPuntoVenta", "IdCliente", "NombrePuntoVenta", "Direccion")
        VALUES 
            (881, 881, 'PV Sucre 881', 'Calle Test Sucre'),
            (882, 882, 'PV Potosi 882', 'Calle Test Potosi')
        ON CONFLICT ("IdPuntoVenta") DO NOTHING;

        INSERT INTO "RutaPuntoVenta" ("IdRutaPuntoVenta", "IdRutaDistribucion", "IdPuntoVenta", "OrdenVisita")
        VALUES 
            (881, 881, 881, 1),
            (882, 882, 882, 1)
        ON CONFLICT ("IdRutaPuntoVenta") DO NOTHING;
    """))

    # 4. Pedidos asociados a las asignaciones
    db.execute(text("""
        INSERT INTO "Pedido" ("IdPedido", "IdAsignacionRuta", "IdCliente", "IdPuntoVenta", "IdUsuarioRepartidor", "MontoTotal", "IdEstadoPedido")
        VALUES 
            (881, 881, 881, 881, :chofer_sucre, 250.00, 1),
            (882, 882, 882, 882, :chofer_potosi, 350.00, 1)
        ON CONFLICT ("IdPedido") DO UPDATE 
        SET "IdAsignacionRuta" = EXCLUDED."IdAsignacionRuta", "IdPuntoVenta" = EXCLUDED."IdPuntoVenta", "IdUsuarioRepartidor" = EXCLUDED."IdUsuarioRepartidor";
    """), {"chofer_sucre": ID_CHOFER_SUCRE_A, "chofer_potosi": ID_CHOFER_POTOSI_C})

    # 5. Inventario de chofer cargado
    db.execute(text("""
        INSERT INTO public.inventario_chofer (id, chofer_id, sucursal_id, presentacion_id, cantidad_cargada, cantidad_vendida, cantidad_remanente, precio_vigente_carga)
        VALUES 
            (881, :chofer_sucre, 1, 1, 20.0, 5.0, 15.0, 25.0),
            (882, :chofer_potosi, 2, 1, 15.0, 2.0, 13.0, 30.0)
        ON CONFLICT (id) DO UPDATE 
        SET chofer_id = EXCLUDED.chofer_id, sucursal_id = EXCLUDED.sucursal_id, cantidad_remanente = EXCLUDED.cantidad_remanente;
    """), {"chofer_sucre": ID_CHOFER_SUCRE_A, "chofer_potosi": ID_CHOFER_POTOSI_C})

    return {
        "chofer_sucre_a": ID_CHOFER_SUCRE_A,
        "chofer_sucre_b": ID_CHOFER_SUCRE_B,
        "chofer_potosi_c": ID_CHOFER_POTOSI_C,
        "asig_sucre": 881,
        "asig_potosi": 882,
        "pedido_sucre": 881,
        "pedido_potosi": 882,
    }


# =============================================================================
# PRUEBAS DE SEGURIDAD: CHOFER ROUTER Y ALCANCE TERRITORIAL
# =============================================================================

def test_sin_token_da_401():
    """Cualquier petición sin token Bearer a /logistica/chofer/* debe devolver 401 Unauthorized."""
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)

    with TestClient(app) as client:
        r1 = client.get("/logistica/chofer/mi-ruta-activa")
        assert r1.status_code == status.HTTP_401_UNAUTHORIZED

        r2 = client.post("/logistica/chofer/entregar", json={"IdPedido": 1, "LatitudEntrega": 0.0, "LongitudEntrega": 0.0})
        assert r2.status_code == status.HTTP_401_UNAUTHORIZED

        r3 = client.post("/logistica/chofer/cobrar", json={"IdPedido": 1, "Monto": 100.0, "LatitudCobro": 0.0, "LongitudCobro": 0.0})
        assert r3.status_code == status.HTTP_401_UNAUTHORIZED

        r4 = client.post("/logistica/chofer/sincronizar-batch", json={"operaciones": []})
        assert r4.status_code == status.HTTP_401_UNAUTHORIZED

        r5 = client.get("/logistica/chofer/resumen-turno/1")
        assert r5.status_code == status.HTTP_401_UNAUTHORIZED


def test_chofer_sucre_consulta_su_propia_ruta_exitosamente(datos_choferes_test):
    """El chofer legítimo de Sucre obtiene su asignación activa usando la identidad de su token."""
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_SUCRE_A, ROL_AGENTE_REPARTO, 1)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            res = client.get("/logistica/chofer/mi-ruta-activa")
            assert res.status_code == status.HTTP_200_OK
            body = res.json()
            assert body["success"] is True
            assert body["asignacion"] is not None
            assert body["asignacion"]["IdAsignacionRuta"] == datos_choferes_test["asig_sucre"]
            assert body["asignacion"]["IdUsuarioRepartidor"] == ID_CHOFER_SUCRE_A
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_chofer_sucre_no_puede_ver_ni_actuar_sobre_asignacion_ajena(datos_choferes_test):
    """
    Chofer A de Sucre intenta consultar el resumen de turno de la asignación de Potosí (882):
    debe responder 404 Not Found (nunca 200 ni datos ajenos).
    """
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_SUCRE_A, ROL_AGENTE_REPARTO, 1)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            # Asignación de Potosí -> 404
            res = client.get(f"/logistica/chofer/resumen-turno/{datos_choferes_test['asig_potosi']}")
            assert res.status_code == status.HTTP_404_NOT_FOUND
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_chofer_sucre_intentando_entregar_pedido_de_potosi_da_404(datos_choferes_test):
    """
    Chofer A (Sucre) intenta registrar entrega en un pedido asignado a Potosí:
    debe responder 404 Not Found para no filtrar información.
    """
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_SUCRE_A, ROL_AGENTE_REPARTO, 1)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            payload = {
                "IdPedido": datos_choferes_test["pedido_potosi"],
                "LatitudEntrega": -19.5830,
                "LongitudEntrega": -65.7530,
                "RecibidoPor": "Cliente Intruso",
            }
            res = client.post("/logistica/chofer/entregar", json=payload)
            assert res.status_code == status.HTTP_404_NOT_FOUND
            assert "no encontrado o no asignado a su ruta" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_chofer_potosi_no_ve_datos_de_sucre(datos_choferes_test):
    """
    Chofer C (Potosí, IdSucursal=2) no puede cobrar ni ver asignaciones de Sucre (IdSucursal=1).
    """
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_POTOSI_C, ROL_AGENTE_REPARTO, 2)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            # Intentar cobrar pedido de Sucre -> 404
            payload = {
                "IdPedido": datos_choferes_test["pedido_sucre"],
                "IdMetodoPago": 1,
                "Monto": 250.00,
                "LatitudCobro": -19.0430,
                "LongitudCobro": -65.2530,
            }
            res = client.post("/logistica/chofer/cobrar", json=payload)
            assert res.status_code == status.HTTP_404_NOT_FOUND

            # Intentar ver resumen de asignación de Sucre -> 404
            res_asig = client.get(f"/logistica/chofer/resumen-turno/{datos_choferes_test['asig_sucre']}")
            assert res_asig.status_code == status.HTTP_404_NOT_FOUND
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_excepcion_en_entrega_devuelve_error_nunca_success_true(datos_choferes_test):
    """
    Si se intenta entregar un pedido inexistente, debe retornar HTTP 404 o 400 con detail explícito,
    NUNCA {'success': True, 'advertencia': ...}.
    """
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_SUCRE_A, ROL_AGENTE_REPARTO, 1)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            payload = {
                "IdPedido": 99999999,  # Inexistente
                "LatitudEntrega": -19.0430,
                "LongitudEntrega": -65.2530,
            }
            res = client.post("/logistica/chofer/entregar", json=payload)
            assert res.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST]
            assert res.status_code != status.HTTP_200_OK
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_sincronizar_batch_con_pedido_ajeno_reporta_error(datos_choferes_test):
    """
    La sincronización batch offline-first con un pedido inexistente o ajeno
    debe reportar error explícito y success=False.
    """
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_SUCRE_A, ROL_AGENTE_REPARTO, 1)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            batch = {
                "operaciones": [
                    {
                        "id": "op-local-1",
                        "tipo": "ENTREGA",
                        "payload": {"IdPedido": 9999999},  # Inexistente
                        "gps": {"latitud": -19.04, "longitud": -65.25}
                    }
                ]
            }
            res = client.post("/logistica/chofer/sincronizar-batch", json=batch)
            assert res.status_code == status.HTTP_200_OK
            body = res.json()
            assert body["success"] is False
            assert len(body["errores"]) == 1
            assert len(body["sincronizados"]) == 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_chofer_solo_consulta_su_propio_inventario(datos_choferes_test):
    """
    En /logistica/inventario/chofer/{id}:
    - Chofer A (9) consultando a Chofer A (9) -> 200 OK.
    - Chofer A (9) consultando a Chofer B (10) o Chofer C (17) -> 404 NOT FOUND.
    """
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_SUCRE_A, ROL_AGENTE_REPARTO, 1)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            # Chofer propio (9) -> 200 OK
            r_propio = client.get(f"/logistica/inventario/chofer/{ID_CHOFER_SUCRE_A}")
            assert r_propio.status_code == status.HTTP_200_OK
            items = r_propio.json()
            assert isinstance(items, list)

            # Chofer ajeno de Sucre (10) -> 404 NOT FOUND
            r_ajeno_sucre = client.get(f"/logistica/inventario/chofer/{ID_CHOFER_SUCRE_B}")
            assert r_ajeno_sucre.status_code == status.HTTP_404_NOT_FOUND

            # Chofer ajeno de Potosí (17) -> 404 NOT FOUND
            r_ajeno_potosi = client.get(f"/logistica/inventario/chofer/{ID_CHOFER_POTOSI_C}")
            assert r_ajeno_potosi.status_code == status.HTTP_404_NOT_FOUND
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


def test_flujo_legitimo_entrega_y_cobro_propio(datos_choferes_test):
    """
    Flujo legítimo: el chofer A entrega su pedido asignado legítimo y cobra;
    ambas operaciones se completan exitosamente (200 OK).
    """
    override_u, override_a = _crear_override_usuario_alcance(ID_CHOFER_SUCRE_A, ROL_AGENTE_REPARTO, 1)
    app.dependency_overrides[get_current_user] = override_u
    app.dependency_overrides[DependenciaAlcanceSucursal] = override_a

    try:
        with TestClient(app) as client:
            # Entrega legítima
            p_entrega = {
                "IdPedido": datos_choferes_test["pedido_sucre"],
                "LatitudEntrega": -19.0435,
                "LongitudEntrega": -65.2580,
                "RecibidoPor": "Dra. San Agustin",
                "Observacion": "Entrega conforme"
            }
            r_entrega = client.post("/logistica/chofer/entregar", json=p_entrega)
            assert r_entrega.status_code == status.HTTP_200_OK
            assert r_entrega.json()["success"] is True

            # Cobro legítimo
            p_cobro = {
                "IdPedido": datos_choferes_test["pedido_sucre"],
                "IdMetodoPago": 1,
                "Monto": 250.00,
                "LatitudCobro": -19.0435,
                "LongitudCobro": -65.2580,
                "Observacion": "Cobro en efectivo"
            }
            r_cobro = client.post("/logistica/chofer/cobrar", json=p_cobro)
            assert r_cobro.status_code == status.HTTP_200_OK
            assert r_cobro.json()["success"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)
