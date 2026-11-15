import pytest
from datetime import date
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import AlcanceUsuario, DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_SUPERVISOR
from app.utils.fechas import fecha_actual_bolivia, ahora_bolivia

ID_ADMIN = 1
ID_CHOFER_TEST = 9
ID_SUCURSAL_TEST = 1
ID_ASIGNACION_TEST = 770
ID_PRESENTACION_TEST = 1


@pytest.fixture
def datos_carga_test(db_session_rollback):
    db = db_session_rollback

    # 1. Asegurar ruta y asignación
    db.execute(text("""
        INSERT INTO "ZonaDistribucion" ("IdZonaDistribucion", "NombreZona", "Ciudad")
        VALUES (770, 'Zona Test Carga', 'Sucre')
        ON CONFLICT ("IdZonaDistribucion") DO NOTHING;

        INSERT INTO "RutaDistribucion" ("IdRutaDistribucion", "NombreRuta", "IdZonaDistribucion", "IdSucursal")
        VALUES (770, 'Ruta 770 Carga', 770, :sid)
        ON CONFLICT ("IdRutaDistribucion") DO UPDATE SET "IdSucursal" = EXCLUDED."IdSucursal";

        INSERT INTO "AsignacionRuta" ("IdAsignacionRuta", "IdRutaDistribucion", "IdUsuarioRepartidor", "IdUsuarioAsigna", "FechaAsignacion", "Estado")
        VALUES (770, 770, :uid, :admin, :hoy, 'Pendiente')
        ON CONFLICT ("IdAsignacionRuta") DO UPDATE
        SET "IdUsuarioRepartidor" = EXCLUDED."IdUsuarioRepartidor", "FechaAsignacion" = :hoy;
    """), {
        "sid": ID_SUCURSAL_TEST,
        "uid": ID_CHOFER_TEST,
        "admin": ID_ADMIN,
        "hoy": fecha_actual_bolivia()
    })

    # 2. Asegurar que haya un precio vigente para la presentación 1
    db.execute(text("""
        INSERT INTO "PrecioProducto" ("IdPresentacion", "IdSucursal", "PrecioUnitario", "Activo", "VigenteDesde")
        VALUES (:pid, :sid, 35.50, TRUE, :hoy)
        ON CONFLICT DO NOTHING;
    """), {
        "pid": ID_PRESENTACION_TEST,
        "sid": ID_SUCURSAL_TEST,
        "hoy": fecha_actual_bolivia()
    })

    # Limpiar inventario_chofer previo para id_chofer y presentacion 1
    db.execute(text("""
        DELETE FROM public.inventario_chofer WHERE chofer_id = :uid AND presentacion_id = :pid;
        DELETE FROM public.detalle_solicitud_carga_camion WHERE id_presentacion = :pid;
        DELETE FROM public.solicitud_carga_camion WHERE id_asignacion_ruta = 770;
    """), {"uid": ID_CHOFER_TEST, "pid": ID_PRESENTACION_TEST})

    return {
        "asig_id": 770,
        "chofer_id": ID_CHOFER_TEST,
        "presentacion_id": ID_PRESENTACION_TEST,
        "sucursal_id": ID_SUCURSAL_TEST
    }


def _setup_admin_override():
    app.dependency_overrides[get_current_user] = lambda: {
        "IdUsuario": ID_ADMIN,
        "IdRol": ROL_SUPERVISOR,
        "IsAdmin": True,
        "IdSucursal": 1,
        "Correo": "admin@blanquita.com",
        "IdEstadoUsuario": 1
    }
    app.dependency_overrides[DependenciaAlcanceSucursal] = lambda: AlcanceUsuario(
        id_usuario=ID_ADMIN,
        puede_ver_todas=True,
        sucursales_permitidas=[1, 2],
        sucursal_efectiva=1,
        sucursal_asignada_defecto=1
    )


def test_resolver_carga_subconsulta_precio_y_transaccional(datos_carga_test, db_session_rollback):
    """
    Verifica que resolver-carga aplique correctamente la subconsulta a PrecioProducto
    sin fallar con UndefinedColumn y actualice el inventario con el precio vigente.
    """
    _setup_admin_override()
    client = TestClient(app)

    payload = {
        "decision": "APROBADA",
        "observacion": "Carga aprobada en test de integración",
        "items": [
            {
                "presentacion_id": datos_carga_test["presentacion_id"],
                "cantidad_aprobada": 25.0
            }
        ]
    }

    resp = client.post(f"/logistica/asignaciones/{datos_carga_test['asig_id']}/resolver-carga", json=payload)
    assert resp.status_code == status.HTTP_200_OK, f"Error devuelto: {resp.text}"
    body = resp.json()
    assert body.get("codigo") == "EXITO"

    # Verificar inserción en inventario_chofer
    row = db_session_rollback.execute(text("""
        SELECT cantidad_cargada, cantidad_remanente, precio_vigente_carga
        FROM public.inventario_chofer
        WHERE chofer_id = :uid AND presentacion_id = :pid
        ORDER BY id DESC LIMIT 1;
    """), {"uid": datos_carga_test["chofer_id"], "pid": datos_carga_test["presentacion_id"]}).fetchone()

    assert row is not None
    assert float(row.cantidad_cargada) == 25.0
    assert float(row.cantidad_remanente) == 25.0
    assert float(row.precio_vigente_carga) > 0.0


def test_resolver_carga_cantidad_cero_no_inserta_stock(datos_carga_test, db_session_rollback):
    """
    Verifica que items con cantidad 0 no se inserten en inventario_chofer.
    """
    _setup_admin_override()
    client = TestClient(app)

    # Limpiar
    db_session_rollback.execute(text("""
        DELETE FROM public.inventario_chofer WHERE chofer_id = :uid AND presentacion_id = :pid;
    """), {"uid": datos_carga_test["chofer_id"], "pid": datos_carga_test["presentacion_id"]})

    payload = {
        "decision": "APROBADA",
        "observacion": "Carga con cantidad 0",
        "items": [
            {
                "presentacion_id": datos_carga_test["presentacion_id"],
                "cantidad_aprobada": 0.0
            }
        ]
    }

    resp = client.post(f"/logistica/asignaciones/{datos_carga_test['asig_id']}/resolver-carga", json=payload)
    assert resp.status_code == status.HTTP_200_OK

    row = db_session_rollback.execute(text("""
        SELECT id FROM public.inventario_chofer
        WHERE chofer_id = :uid AND presentacion_id = :pid;
    """), {"uid": datos_carga_test["chofer_id"], "pid": datos_carga_test["presentacion_id"]}).fetchone()

    assert row is None, "No debe haberse insertado stock con cantidad 0"


def test_resolver_carga_idempotencia_no_duplica(datos_carga_test, db_session_rollback):
    """
    Verifica que resolver dos veces la misma solicitud aprobada sea idempotente y no duplique stock.
    """
    _setup_admin_override()
    client = TestClient(app)

    payload = {
        "decision": "APROBADA",
        "observacion": "Primera aprobación",
        "items": [
            {
                "presentacion_id": datos_carga_test["presentacion_id"],
                "cantidad_aprobada": 10.0
            }
        ]
    }

    # Primera vez
    resp1 = client.post(f"/logistica/asignaciones/{datos_carga_test['asig_id']}/resolver-carga", json=payload)
    assert resp1.status_code == status.HTTP_200_OK

    # Segunda vez: debe rechazar con 409 Conflict porque ya fue aprobada y no duplicar stock
    resp2 = client.post(f"/logistica/asignaciones/{datos_carga_test['asig_id']}/resolver-carga", json=payload)
    assert resp2.status_code == status.HTTP_409_CONFLICT

    row = db_session_rollback.execute(text("""
        SELECT SUM(cantidad_cargada) as total_cargado
        FROM public.inventario_chofer
        WHERE chofer_id = :uid AND presentacion_id = :pid;
    """), {"uid": datos_carga_test["chofer_id"], "pid": datos_carga_test["presentacion_id"]}).fetchone()

    assert float(row.total_cargado) == 10.0, f"Se duplicó el stock: {row.total_cargado}"
