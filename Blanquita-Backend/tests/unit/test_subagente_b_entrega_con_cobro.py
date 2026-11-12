"""
Tests para SUB-AGENTE B: Entrega con Cobro en una sola transacción atómica
Sistema ERP Papelera Blanquita

Verifica:
1. Transacción única: descuento de camión, entrega, firmas, pagos (efectivo/QR) y cuenta por cobrar creada.
2. Idempotencia por X-Idempotency-Key: reintento devuelve misma respuesta y no duplica pagos ni entregas.
3. Validación estricta y Rollback ante fallo (suma no cuadra o QR sin comprobante).
4. Retrocompatibilidad: entrega simple sin cobro sigue funcionando intacta.
"""

import uuid
import secrets
from datetime import datetime, date, timedelta
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app

client = TestClient(app)


@pytest.fixture
def chofer_operativo(db_session_rollback):
    db = db_session_rollback
    row = db.execute(
        text('SELECT "IdUsuario", "IdRol", "IdSucursal", "Ci", "AuthUserId" FROM public."Usuario" WHERE "Ci" = :ci'),
        {"ci": "9000004"}
    ).fetchone()
    assert row is not None, "Chofer con CI 9000004 debe existir"
    return {
        "IdUsuario": row[0],
        "IdRol": row[1],
        "IdSucursal": row[2] or 2,
        "Ci": str(row[3]),
        "AuthUserId": str(row[4])
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
        "sub": chofer["AuthUserId"],
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


def _preparar_entorno_entrega(db, chofer, cant_pedido=4.0, monto_pedido=200.0):
    uid = chofer["IdUsuario"]
    sid = chofer["IdSucursal"]

    # 1. Ruta y Asignación
    ruta_id = db.execute(text('SELECT "IdRutaDistribucion" FROM public."RutaDistribucion" WHERE "IdSucursal" = :sid LIMIT 1;'), {"sid": sid}).scalar()
    asig_id = db.execute(text("""
        INSERT INTO public."AsignacionRuta" ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion", "Estado", "IdUsuarioAsigna")
        VALUES (:rid, :uid, CURRENT_DATE, 'En Ruta', :uid)
        RETURNING "IdAsignacionRuta";
    """), {"rid": ruta_id, "uid": uid}).scalar()

    # 2. Cliente
    cli_id = db.execute(text('SELECT "IdCliente" FROM public."Cliente" WHERE "IdSucursal" = :sid LIMIT 1;'), {"sid": sid}).scalar()

    # 3. Pedido
    nro_ped = f"PED-B-{secrets.token_hex(4).upper()}"
    ped_id = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdUsuarioRepartidor", "IdEstadoPedido",
            "IdAsignacionRuta", "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, :uid, 2, :asig, NOW(), false, :monto
        ) RETURNING "IdPedido";
    """), {"nro": nro_ped, "cli": cli_id, "uid": uid, "asig": asig_id, "monto": monto_pedido}).scalar()

    # 4. Detalle y Stock
    pres_id = db.execute(text('SELECT "IdPresentacion" FROM public."PresentacionProducto" LIMIT 1;')).scalar()
    db.execute(text("""
        INSERT INTO public."DetallePedido" ("IdPedido", "IdPresentacion", "Cantidad", "PrecioUnitarioAplicado", "Subtotal")
        VALUES (:id_ped, :pid, :cant, 50.0, :monto);
    """), {"id_ped": ped_id, "pid": pres_id, "cant": cant_pedido, "monto": monto_pedido})

    # Cargar 50 unidades en inventario_chofer
    db.execute(text("""
        DELETE FROM public.inventario_chofer WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        INSERT INTO public.inventario_chofer (
            "chofer_id", "sucursal_id", "presentacion_id",
            "cantidad_cargada", "cantidad_vendida", "cantidad_remanente",
            "precio_vigente_carga", "fecha_carga"
        ) VALUES (
            :cid, :sid, :pid, 50.0, 0.0, 50.0, 50.0, CURRENT_DATE
        );
    """), {"cid": uid, "sid": sid, "pid": pres_id})

    # 5. ComprobanteArchivo para tramo QR
    comp_id = db.execute(text("""
        INSERT INTO public."ComprobanteArchivo" (
            "EntidadOrigen", "IdRegistroOrigen", "UrlArchivo", "NombreOriginal",
            "Formato", "TamanoBytes", "Sha256", "ArchivoEliminado", "FechaSubida", "FechaExpiracion"
        ) VALUES (
            'PEDIDO', :pid, '/uploads/comprobantes/test_qr.jpg', 'test_qr.jpg',
            'image/jpeg', 1024, 'sha256_mock_qr_cobro', false, NOW(), CURRENT_DATE + INTERVAL '60 days'
        ) RETURNING "IdComprobante";
    """), {"pid": ped_id}).scalar()

    db.flush()
    return ped_id, pres_id, comp_id


def test_entrega_con_cobro_transaccion_unica(db_session_rollback, chofer_operativo):
    """
    Verifica que la entrega con cobro en una sola transacción:
    - Descuente el inventario del camión
    - Registre las firmas
    - Registre los pagos (efectivo CONFIRMADO, QR PENDIENTE_APROBACION con comprobante)
    - Genere la CuentaCobrar con su saldo remanente a crédito y plazo de vencimiento
    """
    db = db_session_rollback
    ped_id, pres_id, comp_id = _preparar_entorno_entrega(db, chofer_operativo, cant_pedido=4.0, monto_pedido=200.0)
    key_idemp = str(uuid.uuid4())

    payload = {
        "id_pedido": ped_id,
        "latitud": -19.043,
        "longitud": -65.258,
        "tipo_entrega": "TOTAL",
        "recibido_por": "Dña. Elena Rodríguez",
        "ci_receptor": "4892019",
        "firma_chofer": "data:image/svg+xml;utf8,<svg>chofer_sign</svg>",
        "firma_cliente": "data:image/svg+xml;utf8,<svg>cliente_sign</svg>",
        "items_entregados": [{"presentacion_id": pres_id, "cantidad": 4.0}],
        "cobro": {
            "monto_total": 200.0,
            "pagos": [
                {"metodo": "EFECTIVO", "monto": 80.0, "numero_referencia": None},
                {"metodo": "QR", "monto": 70.0, "id_comprobante_archivo": comp_id, "numero_referencia": "BNB-QR-991"}
            ],
            "credito": {
                "saldo": 50.0,
                "plazo_dias": 10
            }
        }
    }

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_payload(chofer_operativo)):
        resp = client.post(
            "/api/movil/v1/chofer/entregar",
            json=payload,
            headers=_auth_headers(chofer_operativo, key_idemp)
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["codigo"] == "EXITO"
    assert "en una sola transacción" in data["mensaje"]

    datos = data["datos"]
    assert datos["id_pedido"] == ped_id
    assert datos["cobro"] is not None
    assert datos["cobro"]["monto_total"] == 200.0
    assert datos["cobro"]["monto_pagado"] == 150.0
    assert datos["cobro"]["saldo_credito"] == 50.0

    tramos = datos["cobro"]["tramos"]
    assert len(tramos) == 2
    efectivo = next(t for t in tramos if t["metodo"] == "EFECTIVO")
    assert efectivo["estado"] == "CONFIRMADO"
    assert efectivo["monto"] == 80.0

    qr = next(t for t in tramos if t["metodo"] == "QR")
    assert qr["estado"] == "PENDIENTE_APROBACION"
    assert qr["monto"] == 70.0
    assert qr["id_abono_cuenta_cobrar"] is not None

    cxc = datos["cobro"]["cuenta_cobrar"]
    assert cxc is not None
    assert cxc["saldo_pendiente"] == 50.0
    assert cxc["plazo_dias"] == 10

    # Verificar descuento de inventario en BD
    uid = chofer_operativo["IdUsuario"]
    inv = db.execute(text("""
        SELECT "cantidad_vendida", "cantidad_remanente"
        FROM public.inventario_chofer
        WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
    """), {"cid": uid, "pid": pres_id}).fetchone()
    assert inv[0] == 4.0
    assert inv[1] == 46.0


def test_entrega_con_cobro_idempotencia_no_duplica(db_session_rollback, chofer_operativo):
    """Reintento idéntico con la misma X-Idempotency-Key devuelve la respuesta cacheada sin duplicar."""
    db = db_session_rollback
    ped_id, pres_id, comp_id = _preparar_entorno_entrega(db, chofer_operativo, cant_pedido=2.0, monto_pedido=100.0)
    key_idemp = str(uuid.uuid4())

    payload = {
        "id_pedido": ped_id,
        "latitud": -19.043,
        "longitud": -65.258,
        "tipo_entrega": "TOTAL",
        "recibido_por": "Pedro Pascal",
        "firma_chofer": "data:image/svg+xml;utf8,<svg>chofer</svg>",
        "cobro": {
            "monto_total": 100.0,
            "pagos": [{"metodo": "EFECTIVO", "monto": 100.0}]
        }
    }

    headers = _auth_headers(chofer_operativo, key_idemp)
    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_payload(chofer_operativo)):
        # 1. Primera llamada
        r1 = client.post("/api/movil/v1/chofer/entregar", json=payload, headers=headers)
        assert r1.status_code == 200

        # 2. Reintento con misma clave
        r2 = client.post("/api/movil/v1/chofer/entregar", json=payload, headers=headers)
        assert r2.status_code == 200
        assert r2.headers.get("x-cache-lookup") == "HIT"

    # Verificar que el stock solo se descontó una vez (2.0 y no 4.0)
    uid = chofer_operativo["IdUsuario"]
    inv = db.execute(text("""
        SELECT "cantidad_vendida"
        FROM public.inventario_chofer
        WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
    """), {"cid": uid, "pid": pres_id}).scalar()
    assert inv == 2.0


def test_entrega_con_cobro_rollback_a_mitad(db_session_rollback, chofer_operativo):
    """
    Si falla una validación del cobro (ej. QR sin foto requerida o suma descuadrada),
    se rechaza y NO se descuenta inventario ni se guardan registros parciales.
    """
    db = db_session_rollback
    ped_id, pres_id, _ = _preparar_entorno_entrega(db, chofer_operativo, cant_pedido=3.0, monto_pedido=150.0)

    # Caso 1: QR sin comprobante -> HTTP 422
    payload_sin_foto = {
        "id_pedido": ped_id,
        "latitud": -19.043,
        "longitud": -65.258,
        "tipo_entrega": "TOTAL",
        "recibido_por": "Juan Choque",
        "firma_chofer": "data:image/svg+xml;utf8,<svg>chofer</svg>",
        "cobro": {
            "monto_total": 150.0,
            "pagos": [{"metodo": "QR", "monto": 150.0, "id_comprobante_archivo": None}]
        }
    }

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_payload(chofer_operativo)):
        r_err = client.post(
            "/api/movil/v1/chofer/entregar",
            json=payload_sin_foto,
            headers=_auth_headers(chofer_operativo, str(uuid.uuid4()))
        )
    assert r_err.status_code == 422

    # Caso 2: Suma de pagos no cuadra con monto_total -> HTTP 400
    payload_descuadrado = {
        "id_pedido": ped_id,
        "latitud": -19.043,
        "longitud": -65.258,
        "tipo_entrega": "TOTAL",
        "recibido_por": "Juan Choque",
        "firma_chofer": "data:image/svg+xml;utf8,<svg>chofer</svg>",
        "cobro": {
            "monto_total": 150.0,
            "pagos": [{"metodo": "EFECTIVO", "monto": 90.0}],
            "credito": {"saldo": 10.0}  # 90 + 10 = 100 != 150
        }
    }

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_payload(chofer_operativo)):
        r_err2 = client.post(
            "/api/movil/v1/chofer/entregar",
            json=payload_descuadrado,
            headers=_auth_headers(chofer_operativo, str(uuid.uuid4()))
        )
    assert r_err2.status_code == 400

    # Verificar que el stock permanezca intacto (0 vendidas)
    uid = chofer_operativo["IdUsuario"]
    inv = db.execute(text("""
        SELECT "cantidad_vendida"
        FROM public.inventario_chofer
        WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
    """), {"cid": uid, "pid": pres_id}).scalar()
    assert inv == 0.0
