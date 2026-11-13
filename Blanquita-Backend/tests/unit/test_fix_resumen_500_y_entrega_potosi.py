"""
Suite de tests de regresión para correcciones de Chofer Móvil y Logística:
1. GET /api/movil/v1/chofer/resumen-sincronizacion:
   - Uso de pp."Monto" en lugar de pp."MontoPagado", garantizando 200 OK con codigo: "EXITO"
     y 0 errores UndefinedColumn.
2. POST /api/movil/v1/chofer/entregar:
   - Payload del celular de Potosí (con id_pedido: 1 de Sucre y idPuntoVenta: 53 de Potosí)
     auto-crea o resuelve pedido en sucursal Potosí, respondiendo 200 OK sin 404.
3. POST /logistica/telemetria/entrega:
   - Acepta tanto id_pedido / IdPedido como id_punto_venta / idPuntoVenta sin lanzar 400 IdPedido es obligatorio.
"""

import uuid
import secrets
from datetime import datetime, date
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Auth.Dependencies import get_current_user, require_role
from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal, AlcanceUsuario
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL

client = TestClient(app)


@pytest.fixture
def chofer_24_potosi(db_session_rollback):
    db = db_session_rollback
    row = db.execute(text("""
        SELECT "IdUsuario", "IdRol", "IdSucursal", "Ci", "AuthUserId"
        FROM public."Usuario"
        WHERE "IdUsuario" = 24;
    """)).fetchone()
    assert row is not None, "El usuario chofer 24 de Potosí debe existir"
    return {
        "IdUsuario": row[0],
        "IdRol": row[1],
        "IdSucursal": row[2] or 2,
        "id_rol": row[1],
        "id_sucursal": row[2] or 2,
        "Ci": str(row[3]),
        "AuthUserId": str(row[4]),
        "Correo": "chofer24@blanquita.com"
    }


def _auth_headers(chofer, idemp_key=None):
    h = {
        "Authorization": f"Bearer token_simulado_{chofer['IdUsuario']}",
        "X-Request-ID": str(uuid.uuid4())
    }
    if idemp_key:
        h["X-Idempotency-Key"] = idemp_key
    return h


def _mock_payload(chofer):
    return {
        "sub": str(chofer["AuthUserId"]),
        "email": f"chofer_{chofer['IdUsuario']}@papelerablanquita.com",
        "aud": "authenticated",
        "role": "authenticated",
        "app_metadata": {
            "IdUsuario": chofer["IdUsuario"],
            "IdRol": chofer["IdRol"],
            "IdEstadoUsuario": 1,
            "IsAdmin": False
        }
    }


def _mock_alcance_potosi():
    alc = AlcanceUsuario(
        id_usuario=24,
        puede_ver_todas=False,
        sucursales_permitidas=[2],
        sucursal_efectiva=2,
        sucursal_asignada_defecto=2
    )
    return alc


# ==============================================================================
# a) Validación de GET /api/movil/v1/chofer/resumen-sincronizacion
# ==============================================================================
def test_resumen_sincronizacion_monto_pago_chofer_potosi(db_session_rollback, chofer_24_potosi):
    """
    Verifica que GET /api/movil/v1/chofer/resumen-sincronizacion para el chofer 24
    de Potosí con pagos previos retorne 200 OK con codigo: 'EXITO', comprobando
    que la consulta a public."PagoPedido" use pp."Monto" y no lance UndefinedColumn.
    """
    db = db_session_rollback
    uid = chofer_24_potosi["IdUsuario"]
    sid = chofer_24_potosi["IdSucursal"]

    # 1. Asegurar un pedido y un cobro previo hoy para el chofer 24
    cli_id = db.execute(text('SELECT "IdCliente" FROM public."Cliente" WHERE "IdSucursal" = :sid LIMIT 1;'), {"sid": sid}).scalar()
    if not cli_id:
        cli_id = db.execute(text('SELECT "IdCliente" FROM public."Cliente" LIMIT 1;')).scalar()

    nro_ped = f"PED-RES-{secrets.token_hex(4).upper()}"
    ped_id = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdUsuarioRepartidor", "IdEstadoPedido",
            "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, :uid, 2, NOW(), false, 150.0
        ) RETURNING "IdPedido";
    """), {"nro": nro_ped, "cli": cli_id, "uid": uid}).scalar()

    # Insertar pago hoy usando la columna real "Monto"
    pago_id = db.execute(text("""
        INSERT INTO public."PagoPedido" (
            "IdPedido", "FechaPago", "Monto", "IdMetodoPago", "NumeroReferencia", "observacion_revision"
        ) VALUES (
            :pid, NOW(), 150.0, 1, 'PAGO-TEST-MONTO', 'Cobro test sin error UndefinedColumn'
        ) RETURNING "IdPagoPedido";
    """), {"pid": ped_id}).scalar()
    db.flush()

    app.dependency_overrides[get_current_user] = lambda: chofer_24_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = _mock_alcance_potosi

    try:
        with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_payload(chofer_24_potosi)):
            resp = client.get(
                "/api/movil/v1/chofer/resumen-sincronizacion",
                headers=_auth_headers(chofer_24_potosi)
            )

        assert resp.status_code == 200, f"Error en resumen-sincronizacion: {resp.text}"
        data = resp.json()
        assert data["codigo"] == "EXITO"
        assert "datos" in data

        datos = data["datos"]
        historial = datos.get("historial_operaciones_hoy", [])
        cobro_encontrado = any(
            item.get("tipo") == "cobro" and item.get("monto") == 150.0
            for item in historial
        )
        assert cobro_encontrado, "El cobro de 150.0 debe estar presente en el historial consultado con pp.\"Monto\""
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


# ==============================================================================
# b) Validación de POST /api/movil/v1/chofer/entregar con payload exacto del celular
# ==============================================================================
def test_entrega_payload_exacto_celular_potosi_auto_pedido(db_session_rollback, chofer_24_potosi):
    """
    Verifica que POST /api/movil/v1/chofer/entregar con el payload exacto que falló
    en el celular del chofer 24 de Potosí responda 200 OK con codigo: 'EXITO',
    auto-creando o asociando el pedido para el punto de venta 53 de Potosí,
    sin lanzar 404 Not Found (a pesar de que id_pedido: 1 era de Sucre).
    """
    db = db_session_rollback
    uid = chofer_24_potosi["IdUsuario"]
    sid = chofer_24_potosi["IdSucursal"]

    # 1. Asegurar ruta y asignación activa en estado 'En Ruta' para evitar gatekeeper
    ruta_id = db.execute(text('SELECT "IdRutaDistribucion" FROM public."RutaDistribucion" WHERE "IdSucursal" = :sid LIMIT 1;'), {"sid": sid}).scalar()
    if not ruta_id:
        ruta_id = db.execute(text('SELECT "IdRutaDistribucion" FROM public."RutaDistribucion" LIMIT 1;')).scalar()

    asig_id = db.execute(text("""
        INSERT INTO public."AsignacionRuta" ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion", "Estado", "IdUsuarioAsigna")
        VALUES (:rid, :uid, CURRENT_DATE, 'En Ruta', :uid)
        RETURNING "IdAsignacionRuta";
    """), {"rid": ruta_id, "uid": uid}).scalar()

    # 2. Cargar inventario en camión para presentacion_id = 10
    db.execute(text("""
        DELETE FROM public.inventario_chofer WHERE "chofer_id" = :cid AND "presentacion_id" = 10;
        INSERT INTO public.inventario_chofer (
            "chofer_id", "sucursal_id", "presentacion_id",
            "cantidad_cargada", "cantidad_vendida", "cantidad_remanente",
            "precio_vigente_carga", "fecha_carga"
        ) VALUES (
            :cid, :sid, 10, 50.0, 0.0, 50.0, 20.0, CURRENT_DATE
        );
    """), {"cid": uid, "sid": sid})

    db.flush()

    # Payload EXACTO reportado desde el celular de Potosí
    payload_celular = {
        "idPuntoVenta": 53,
        "id_punto_venta": 53,
        "id_pedido": 1,
        "idAsignacion": 192,
        "items_entregados": [{"presentacion_id": 10, "cantidad": 5.0}],
        "cobro": {
            "monto_total": 100.0,
            "pagos": [{"metodo": "EFECTIVO", "monto": 100.0}]
        }
    }

    idemp_key = str(uuid.uuid4())
    app.dependency_overrides[get_current_user] = lambda: chofer_24_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = _mock_alcance_potosi

    try:
        with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_payload(chofer_24_potosi)):
            resp = client.post(
                "/api/movil/v1/chofer/entregar",
                json=payload_celular,
                headers=_auth_headers(chofer_24_potosi, idemp_key)
            )

        assert resp.status_code == 200, f"Fallo al entregar con payload móvil: {resp.status_code} - {resp.text}"
        data = resp.json()
        assert data["codigo"] == "EXITO"
        assert "datos" in data

        datos = data["datos"]
        # El pedido resultante NO debe ser 1 (que era de Sucre), sino uno auto-creado/resuelto para Potosí
        assert datos["id_pedido"] != 1, f"El id_pedido devuelto debe ser el auto-creado para Potosí, no el 1 de Sucre"

        # Verificar que el pedido generado en BD esté asociado al punto de venta 53
        ped_db = db.execute(text("""
            SELECT "IdPedido", "IdPuntoVenta", "IdEstadoPedido"
            FROM public."Pedido"
            WHERE "IdPedido" = :pid;
        """), {"pid": datos["id_pedido"]}).mappings().fetchone()

        assert ped_db is not None, "El pedido creado debe existir en la base de datos"
        assert ped_db["IdPuntoVenta"] == 53, f"El pedido debe pertenecer al punto de venta 53, no {ped_db['IdPuntoVenta']}"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)


# ==============================================================================
# c) Validación de POST /logistica/telemetria/entrega
# ==============================================================================
def test_telemetria_entrega_con_id_pedido_y_punto_venta(db_session_rollback, chofer_24_potosi):
    """
    Verifica que POST /logistica/telemetria/entrega acepte tanto:
    1. IdPedido / id_pedido explícito.
    2. idPuntoVenta / id_punto_venta (auto-resolviendo pedido sin lanzar 400 IdPedido es obligatorio).
    """
    db = db_session_rollback
    uid = chofer_24_potosi["IdUsuario"]
    sid = chofer_24_potosi["IdSucursal"]

    cli_id = db.execute(text('SELECT "IdCliente" FROM public."Cliente" WHERE "IdSucursal" = :sid LIMIT 1;'), {"sid": sid}).scalar()
    if not cli_id:
        cli_id = db.execute(text('SELECT "IdCliente" FROM public."Cliente" LIMIT 1;')).scalar()

    # 1. Crear un pedido previo para prueba directa con id_pedido
    nro_ped = f"PED-TEL-TEST-{secrets.token_hex(3).upper()}"
    ped_id = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdPuntoVenta", "IdUsuarioRepartidor",
            "IdEstadoPedido", "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, 53, :uid, 2, NOW(), true, 80.0
        ) RETURNING "IdPedido";
    """), {"nro": nro_ped, "cli": cli_id, "uid": uid}).scalar()
    db.flush()

    app.dependency_overrides[get_current_user] = lambda: chofer_24_potosi
    app.dependency_overrides[DependenciaAlcanceSucursal] = _mock_alcance_potosi

    try:
        # 1. Caso id_pedido explícito (snake_case)
        resp1 = client.post(
            "/logistica/telemetria/entrega",
            json={
                "id_pedido": ped_id,
                "latitud": -19.582,
                "longitud": -65.755,
                "observacion": "Entrega telemetria con id_pedido snake_case"
            },
            headers=_auth_headers(chofer_24_potosi)
        )
        assert resp1.status_code == 200, f"Error con id_pedido snake_case: {resp1.text}"
        data1 = resp1.json()
        assert data1["IdPedido"] == ped_id
        assert data1["IdEstadoPedido"] == 3  # Entregado

        # 2. Caso IdPedido en PascalCase
        resp2 = client.post(
            "/logistica/telemetria/entrega",
            json={
                "IdPedido": ped_id,
                "LatitudEntrega": -19.582,
                "LongitudEntrega": -65.755,
                "Observacion": "Entrega telemetria con IdPedido PascalCase"
            },
            headers=_auth_headers(chofer_24_potosi)
        )
        assert resp2.status_code == 200, f"Error con IdPedido PascalCase: {resp2.text}"

        # 3. Caso sin id_pedido pero con idPuntoVenta / id_punto_venta (no debe lanzar 400)
        resp3 = client.post(
            "/logistica/telemetria/entrega",
            json={
                "idPuntoVenta": 53,
                "id_punto_venta": 53,
                "latitud": -19.582,
                "longitud": -65.755,
                "observacion": "Entrega telemetria sin id_pedido explicito"
            },
            headers=_auth_headers(chofer_24_potosi)
        )
        assert resp3.status_code == 200, f"Error con idPuntoVenta sin id_pedido: {resp3.text}"
        data3 = resp3.json()
        assert "IdPedido" in data3
        assert data3["IdPedido"] is not None
        assert data3["IdEstadoPedido"] == 3
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(DependenciaAlcanceSucursal, None)
