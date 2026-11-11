"""
Pruebas de Integración P2P - Módulo Chofer Móvil (Fase 2)
Sistema ERP Papelera Blanquita

Verifica de extremo a extremo:
1. Consulta de inventario en camión y desglose de promociones/bandeo con cortesía a costo 0.
2. Entrega física con firma digital táctil obligatoria, descuento de stock y protección contra doble descuento por idempotencia.
3. Detección y alerta de revalorización de precios al sincronizar con el servidor.
4. Cobros mixtos (Efectivo + QR/Transferencia), exigencia de foto para QR y estado PENDIENTE_APROBACION para Kevin.
5. Cierre de turno completo: arqueo financiero, cuadre físico de camión, mermas/faltantes y firma de conformidad.
6. Subida de fotos y comprobantes a ComprobanteArchivo (<= 5MB, depuración a 60 días).
7. Ejecución con aislamiento transaccional y rollback estricto mediante db_session_rollback.
"""

import os
import io
import uuid
import secrets
from datetime import datetime, date, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Constants.Roles import ROL_AGENTE_REPARTO

client = TestClient(app)


@pytest.fixture
def chofer_test(db_session_rollback):
    """Localiza o prepara el chofer TEST_Potosi_Chofer (CI 9000004)."""
    db = db_session_rollback
    row = db.execute(
        text('SELECT "IdUsuario", "IdRol", "IdSucursal", "Ci", "AuthUserId" FROM public."Usuario" WHERE "Ci" = :ci'),
        {"ci": "9000004"}
    ).fetchone()
    assert row is not None, "El usuario chofer de prueba con CI 9000004 debe existir en la BD"
    return {
        "IdUsuario": row[0],
        "IdRol": row[1],
        "IdSucursal": row[2] or 2,
        "Ci": str(row[3]),
        "AuthUserId": str(row[4])
    }


def _generar_auth_headers(chofer):
    """Genera token simulado para TestClient."""
    return {
        "Authorization": f"Bearer mock_token_{chofer['IdUsuario']}",
        "X-Request-ID": str(uuid.uuid4())
    }


def _mock_verificar_token(chofer):
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


def _obtener_o_crear_asignacion(db, uid, sid):
    ruta_row = db.execute(text("""
        SELECT "IdRutaDistribucion" FROM public."RutaDistribucion" WHERE "IdSucursal" = :sid LIMIT 1;
    """), {"sid": sid}).fetchone()
    assert ruta_row is not None, f"Debe existir al menos una ruta para la sucursal {sid}"
    id_ruta = ruta_row[0]

    row = db.execute(text("""
        SELECT ar."IdAsignacionRuta"
        FROM public."AsignacionRuta" ar
        WHERE ar."IdUsuarioRepartidor" = :uid AND ar."FechaAsignacion" = CURRENT_DATE
        LIMIT 1;
    """), {"uid": uid}).fetchone()
    if row:
        db.execute(text("""
            UPDATE public."AsignacionRuta"
            SET "IdRutaDistribucion" = :rid, "Estado" = 'En Ruta'
            WHERE "IdAsignacionRuta" = :asig;
        """), {"rid": id_ruta, "asig": row[0]})
        db.flush()
        return row[0]

    ins = db.execute(text("""
        INSERT INTO public."AsignacionRuta" ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion", "Estado", "IdUsuarioAsigna")
        VALUES (:rid, :uid, CURRENT_DATE, 'En Ruta', :uid)
        RETURNING "IdAsignacionRuta";
    """), {"rid": id_ruta, "uid": uid}).fetchone()
    db.flush()
    return ins[0]


def _obtener_cliente_sucursal(db, sid):
    cl_row = db.execute(text("""
        SELECT "IdCliente" FROM public."Cliente" WHERE "IdSucursal" = :sid LIMIT 1;
    """), {"sid": sid}).fetchone()
    assert cl_row is not None, f"Debe existir al menos un cliente en la sucursal {sid}"
    return cl_row[0]


# ==============================================================================
# TEST 1: MI INVENTARIO EN CAMIÓN Y BANDEO DE CORTESÍA A COSTO 0
# ==============================================================================
def test_mi_inventario_y_bandeo_cortesia_costo_cero(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]

    pres_row = db.execute(text("""
        SELECT p."IdPresentacion", prod."IdProducto"
        FROM public."PresentacionProducto" p
        JOIN public."Producto" prod ON p."IdProducto" = prod."IdProducto"
        LIMIT 1;
    """)).fetchone()
    assert pres_row is not None, "Debe existir al menos un producto y presentación en la BD"
    pid, prod_id = pres_row[0], pres_row[1]

    db.execute(text("""
        INSERT INTO public."ProductoConfigComercial" ("IdProducto", "EsBandeo", "ValorBandeo")
        VALUES (:prod_id, true, 2)
        ON CONFLICT ("IdProducto") DO UPDATE SET "EsBandeo" = true, "ValorBandeo" = 2;
    """), {"prod_id": prod_id})

    db.execute(text("""
        DELETE FROM public.inventario_chofer WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        INSERT INTO public.inventario_chofer (
            "chofer_id", "sucursal_id", "presentacion_id",
            "cantidad_cargada", "cantidad_vendida", "cantidad_remanente",
            "precio_vigente_carga", "fecha_carga"
        ) VALUES (
            :cid, :sid, :pid, 50.0, 10.0, 40.0, 25.0, CURRENT_DATE
        );
    """), {"cid": uid, "sid": sid, "pid": pid})
    db.flush()

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp = client.get("/api/movil/v1/chofer/mi-inventario", headers=_generar_auth_headers(chofer_test))

    assert resp.status_code == 200
    data = resp.json()
    assert data["codigo"] == "EXITO"
    datos = data["datos"]
    assert datos["chofer_id"] == uid
    assert datos["total_saldo_camion"] >= 40.0

    item = next((it for it in datos["items"] if it["presentacion_id"] == pid), None)
    assert item is not None
    assert item["cantidad_cargada"] == 50.0
    assert item["cantidad_remanente"] == 40.0
    if item["es_bandeo"]:
        assert item["valor_bandeo"] > 0
        assert "Costo Bs. 0.00" in (item["cortesia_bandeo_descripcion"] or "")


# ==============================================================================
# TEST 2: ENTREGA FÍSICA TOTAL O PARCIAL, FIRMA Y PROTECCIÓN DE IDEMPOTENCIA
# ==============================================================================
def test_entrega_parcial_y_total_con_firma_y_descuento_stock(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]
    clave_idempotencia = str(uuid.uuid4())

    id_asig = _obtener_o_crear_asignacion(db, uid, sid)
    id_cliente = _obtener_cliente_sucursal(db, sid)

    ped_row = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdUsuarioRepartidor", "IdEstadoPedido",
            "IdAsignacionRuta", "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, :uid, 2, :asig, NOW(), false, 200.00
        ) RETURNING "IdPedido";
    """), {"nro": f"PED-TEST-{secrets.token_hex(4).upper()}", "cli": id_cliente, "uid": uid, "asig": id_asig}).fetchone()
    id_ped = ped_row[0]

    pres_row = db.execute(text('SELECT "IdPresentacion" FROM public."PresentacionProducto" LIMIT 1;')).fetchone()
    pid = pres_row[0]

    db.execute(text("""
        INSERT INTO public."DetallePedido" ("IdPedido", "IdPresentacion", "Cantidad", "PrecioUnitarioAplicado", "Subtotal")
        VALUES (:id_ped, :pid, 4.0, 50.0, 200.0);
    """), {"id_ped": id_ped, "pid": pid})

    db.execute(text("""
        DELETE FROM public.inventario_chofer WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        INSERT INTO public.inventario_chofer (
            "chofer_id", "sucursal_id", "presentacion_id",
            "cantidad_cargada", "cantidad_vendida", "cantidad_remanente",
            "precio_vigente_carga", "fecha_carga"
        ) VALUES (
            :cid, :sid, :pid, 10.0, 0.0, 10.0, 50.0, CURRENT_DATE
        );
    """), {"cid": uid, "sid": sid, "pid": pid})
    db.flush()

    payload_entrega = {
        "id_pedido": id_ped,
        "latitud": -19.0483,
        "longitud": -65.2598,
        "tipo_entrega": "TOTAL",
        "recibido_por": "Doña Carmen",
        "observacion": "Entregado conforme en tienda",
        "firma_chofer": "data:image/svg+xml;utf8,<svg>M10 10 L50 50</svg>",
        "firma_cliente": "data:image/svg+xml;utf8,<svg>M20 20 L60 60</svg>"
    }

    headers = _generar_auth_headers(chofer_test)
    headers["X-Idempotency-Key"] = clave_idempotencia

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp1 = client.post("/api/movil/v1/chofer/entregar", json=payload_entrega, headers=headers)

    assert resp1.status_code == 200, f"Error en entrega: {resp1.text}"
    data1 = resp1.json()
    assert data1["codigo"] == "EXITO"

    stock_post = db.execute(text("""
        SELECT "cantidad_vendida", "cantidad_remanente"
        FROM public.inventario_chofer
        WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
    """), {"cid": uid, "pid": pid}).fetchone()
    assert float(stock_post[0]) == 4.0
    assert float(stock_post[1]) == 6.0

    firma_db = db.execute(text("""
        SELECT "IdFirma", "TipoDocumento", "IdRegistroDocumento"
        FROM public."FirmaDigitalDocumento"
        WHERE "IdRegistroDocumento" = :id_ped AND "TipoDocumento" = 'ENTREGA_PEDIDO';
    """), {"id_ped": id_ped}).fetchone()
    assert firma_db is not None

    # Idempotencia: segunda llamada no duplica descuento
    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp2 = client.post("/api/movil/v1/chofer/entregar", json=payload_entrega, headers=headers)

    assert resp2.status_code == 200
    stock_post2 = db.execute(text("""
        SELECT "cantidad_vendida", "cantidad_remanente"
        FROM public.inventario_chofer
        WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
    """), {"cid": uid, "pid": pid}).fetchone()
    assert float(stock_post2[0]) == 4.0
    assert float(stock_post2[1]) == 6.0


# ==============================================================================
# TEST 3: ALERTA DE REVALORIZACIÓN DE PRECIOS POR KEVIN AL SINCRONIZAR
# ==============================================================================
def test_alerta_revalorizacion_al_sincronizar(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]
    clave_idemp = str(uuid.uuid4())

    id_asig = _obtener_o_crear_asignacion(db, uid, sid)
    id_cliente = _obtener_cliente_sucursal(db, sid)

    pres_row = db.execute(text('SELECT "IdPresentacion" FROM public."PresentacionProducto" LIMIT 1;')).fetchone()
    pid = pres_row[0]

    ped_row = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdUsuarioRepartidor", "IdEstadoPedido",
            "IdAsignacionRuta", "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, :uid, 2, :asig, NOW(), false, 100.00
        ) RETURNING "IdPedido";
    """), {"nro": f"PED-REV-{secrets.token_hex(4).upper()}", "cli": id_cliente, "uid": uid, "asig": id_asig}).fetchone()
    id_ped = ped_row[0]

    db.execute(text("""
        INSERT INTO public."DetallePedido" ("IdPedido", "IdPresentacion", "Cantidad", "PrecioUnitarioAplicado", "Subtotal")
        VALUES (:id_ped, :pid, 2.0, 50.0, 100.0);
    """), {"id_ped": id_ped, "pid": pid})

    db.execute(text("""
        DELETE FROM public.inventario_chofer WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        INSERT INTO public.inventario_chofer (
            "chofer_id", "sucursal_id", "presentacion_id",
            "cantidad_cargada", "cantidad_vendida", "cantidad_remanente",
            "precio_vigente_carga", "fecha_carga"
        ) VALUES (:cid, :sid, :pid, 10.0, 0.0, 10.0, 50.0, CURRENT_DATE);
    """), {"cid": uid, "sid": sid, "pid": pid})

    db.execute(text("""
        DELETE FROM public."RevalorizacionInventarioChofer" WHERE "IdChofer" = :cid AND "IdPresentacion" = :pid;
        INSERT INTO public."RevalorizacionInventarioChofer" (
            "IdChofer", "IdSucursal", "IdPresentacion", "CantidadRemanente",
            "PrecioAnterior", "PrecioNuevo", "MontoAjuste", "FechaRevalorizacion", "DetalleNotificacion"
        ) VALUES (
            :cid, :sid, :pid, 10.0, 50.00, 55.00, 50.00, NOW(), 'Ajuste de tarifa Kevin'
        );
    """), {"cid": uid, "sid": sid, "pid": pid})
    db.flush()

    payload = {
        "id_pedido": id_ped,
        "latitud": -19.0483,
        "longitud": -65.2598,
        "tipo_entrega": "TOTAL",
        "recibido_por": "Don Mario",
        "firma_chofer": "data:image/svg+xml;utf8,<svg>M0 0 L10 10</svg>"
    }
    headers = _generar_auth_headers(chofer_test)
    headers["X-Idempotency-Key"] = clave_idemp

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp = client.post("/api/movil/v1/chofer/entregar", json=payload, headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    alerta = data["datos"].get("alerta_revalorizacion")
    assert alerta is not None
    assert "El precio fue recalculado por el servidor" in alerta
    assert "50.00" in alerta and "55.00" in alerta


# ==============================================================================
# TEST 4: COBROS MIXTOS, QR EXIGE COMPROBANTE Y PENDIENTE_APROBACION
# ==============================================================================
def test_cobro_mixto_qr_pendiente_aprobacion_exige_comprobante(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]
    clave_idemp = str(uuid.uuid4())

    id_asig = _obtener_o_crear_asignacion(db, uid, sid)
    id_cliente = _obtener_cliente_sucursal(db, sid)

    ped_row = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdUsuarioRepartidor", "IdEstadoPedido",
            "IdAsignacionRuta", "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, :uid, 2, :asig, NOW(), false, 150.00
        ) RETURNING "IdPedido";
    """), {"nro": f"PED-COB-{secrets.token_hex(4).upper()}", "cli": id_cliente, "uid": uid, "asig": id_asig}).fetchone()
    id_ped = ped_row[0]
    db.flush()

    headers = _generar_auth_headers(chofer_test)

    # 1. Pago QR sin foto es rechazado con 422
    headers["X-Idempotency-Key"] = str(uuid.uuid4())
    payload_sin_foto = {
        "id_pedido": id_ped,
        "monto_total": 150.0,
        "latitud": -19.0483,
        "longitud": -65.2598,
        "pagos": [
            {"metodo": "EFECTIVO", "monto": 50.0},
            {"metodo": "QR", "monto": 100.0}
        ]
    }
    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp_fail = client.post("/api/movil/v1/chofer/cobrar", json=payload_sin_foto, headers=headers)
    assert resp_fail.status_code == 422
    assert "exige obligatoriamente fotografía" in resp_fail.json().get("detail", "")

    # 2. Pago QR con comprobante es exitoso y queda PENDIENTE_APROBACION
    headers["X-Idempotency-Key"] = clave_idemp
    payload_valido = {
        "id_pedido": id_ped,
        "monto_total": 150.0,
        "latitud": -19.0483,
        "longitud": -65.2598,
        "pagos": [
            {"metodo": "EFECTIVO", "monto": 50.0},
            {
                "metodo": "QR",
                "monto": 100.0,
                "numero_referencia": "BNB-QR-889922",
                "id_comprobante_archivo": 9999,
                "url_comprobante": "/uploads/comprobantes/test_qr.jpg"
            }
        ],
        "observacion": "Pago mixto recibido"
    }
    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp_ok = client.post("/api/movil/v1/chofer/cobrar", json=payload_valido, headers=headers)

    assert resp_ok.status_code == 200
    data_ok = resp_ok.json()
    assert data_ok["codigo"] == "EXITO"
    tramos = data_ok["datos"]["tramos"]
    assert len(tramos) == 2

    tramo_efectivo = next(t for t in tramos if t["metodo"] == "EFECTIVO")
    assert tramo_efectivo["estado"] == "CONFIRMADO"

    tramo_qr = next(t for t in tramos if t["metodo"] == "QR")
    assert tramo_qr["estado"] == "PENDIENTE_APROBACION"

    notif = db.execute(text("""
        SELECT "IdNotificacion", "Titulo", "Mensaje"
        FROM public."NotificacionInterna"
        WHERE "CodigoReferencia" = :id_ped
        ORDER BY "FechaCreacion" DESC LIMIT 1;
    """), {"id_ped": id_ped}).fetchone()
    assert notif is not None
    assert "Cobro QR/Transferencia Móvil Pendiente" in notif[1]


# ==============================================================================
# TEST 5: CIERRE DE TURNO COMPLETO CON ARQUEO, FALTANTES Y FIRMA
# ==============================================================================
def test_cierre_turno_completo_con_faltantes_y_firma(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]
    clave_idemp = str(uuid.uuid4())

    id_asig = _obtener_o_crear_asignacion(db, uid, sid)

    pres_row = db.execute(text('SELECT "IdPresentacion" FROM public."PresentacionProducto" LIMIT 1;')).fetchone()
    pid = pres_row[0]

    db.execute(text("""
        DELETE FROM public.inventario_chofer WHERE "chofer_id" = :cid AND "presentacion_id" = :pid;
        INSERT INTO public.inventario_chofer (
            "chofer_id", "sucursal_id", "presentacion_id",
            "cantidad_cargada", "cantidad_vendida", "cantidad_remanente",
            "precio_vigente_carga", "fecha_carga"
        ) VALUES (
            :cid, :sid, :pid, 20.0, 0.0, 20.0, 30.0, CURRENT_DATE
        );
    """), {"cid": uid, "sid": sid, "pid": pid})
    db.flush()

    headers = _generar_auth_headers(chofer_test)
    headers["X-Idempotency-Key"] = clave_idemp

    payload_cierre = {
        "id_asignacion": id_asig,
        "monto_efectivo_entregado": 500.0,
        "monto_qr_reportado": 200.0,
        "monto_transferencia_reportada": 100.0,
        "monto_credito_reportado": 0.0,
        "stock_devuelto": [
            {"presentacion_id": pid, "cantidad_devuelta": 18.0}
        ],
        "mermas_declaradas": [
            {"presentacion_id": pid, "cantidad_merma": 2.0, "motivo": "Empaque dañado", "imputable_chofer": False}
        ],
        "firma_chofer": "data:image/svg+xml;utf8,<svg>M0 0 L100 100</svg>",
        "observaciones": "Cierre con 2 bultos faltantes declarados"
    }

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp = client.post("/api/movil/v1/chofer/cierre-turno", json=payload_cierre, headers=headers)

    assert resp.status_code == 200, f"Fallo cierre turno: {resp.text}"
    data = resp.json()
    assert data["codigo"] == "EXITO"
    datos = data["datos"]
    id_rendicion = datos["id_rendicion"]

    rend_row = db.execute(text("""
        SELECT "IdRendicionRuta", "MontoFaltante", "MontoEfectivoEntregado", "MontoQrReportado"
        FROM public."RendicionRuta"
        WHERE "IdRendicionRuta" = :id;
    """), {"id": id_rendicion}).fetchone()
    assert rend_row is not None
    assert float(rend_row[1]) > 0.0
    assert float(rend_row[2]) == 500.0
    assert float(rend_row[3]) == 200.0

    firma = db.execute(text("""
        SELECT "IdFirma" FROM public."FirmaDigitalDocumento"
        WHERE "TipoDocumento" = 'CIERRE_TURNO' AND "IdRegistroDocumento" = :id_asig;
    """), {"id_asig": id_asig}).fetchone()
    assert firma is not None


# ==============================================================================
# TEST 6: SUBIDA DE ARCHIVOS A COMPROBANTEARCHIVO (LIMITE 5MB Y 60 DÍAS)
# ==============================================================================
def test_subida_archivo_comprobante_limite_y_retencion(db_session_rollback, chofer_test):
    db = db_session_rollback
    headers = _generar_auth_headers(chofer_test)
    contenido_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    archivos = {"archivo": ("recibo_qr_test.png", io.BytesIO(contenido_png), "image/png")}
    form_data = {"entidad_origen": "COMPROBANTE_COBRO", "id_registro_origen": 1001}

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp = client.post("/api/movil/v1/chofer/subir-archivo", files=archivos, data=form_data, headers=headers)

    assert resp.status_code == 200, f"Fallo subida archivo: {resp.text}"
    data = resp.json()
    assert data["codigo"] == "EXITO"
    datos = data["datos"]
    id_comprobante = datos["id_comprobante"]
    assert id_comprobante > 0
    assert datos["tamano_bytes"] == len(contenido_png)

    fila = db.execute(text("""
        SELECT "FechaSubida", "FechaExpiracion"
        FROM public."ComprobanteArchivo"
        WHERE "IdComprobante" = :id;
    """), {"id": id_comprobante}).fetchone()
    assert fila is not None
    diff_dias = (fila[1].date() - fila[0].date()).days
    assert 59 <= diff_dias <= 61

    # Rechazo por tamaño excesivo (> 5MB)
    contenido_pesado = b"X" * (5 * 1024 * 1024 + 1024)
    archivos_pesados = {"archivo": ("foto_gigante.png", io.BytesIO(contenido_pesado), "image/png")}
    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp_pesado = client.post("/api/movil/v1/chofer/subir-archivo", files=archivos_pesados, data=form_data, headers=headers)
    assert resp_pesado.status_code == 413
