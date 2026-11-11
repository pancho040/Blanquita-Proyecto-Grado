"""
Pruebas de Integración P2P - Módulo Chofer Móvil y Supervisión (Fase 3)
Sistema ERP Papelera Blanquita

Verifica de extremo a extremo:
1. Cobro QR enviado vía POST /api/movil/v1/chofer/sincronizar-batch resuelve dinámicamente IdMetodoPago=3 (QR),
   crea AbonoCuentaCobrar en PENDIENTE_APROBACION y aparece en la bandeja de supervisión de Kevin (ListarAbonosPendientes).
2. Cobro Transferencia enviado vía /sincronizar-batch asienta con IdMetodoPago=2 (Transferencia).
3. Alta de cliente vía POST /api/movil/v1/chofer/clientes con X-Idempotency-Key crea Cliente y PuntoVenta
   asignados forzosamente a la sucursal del chofer; un segundo envío con la misma clave devuelve HIT sin duplicar filas.
4. Cuando Kevin resuelve un abono QR (aprobación o rechazo con motivo) se genera notificación interna para el chofer
   e invoca PushNotificationService con privacidad estricta (cero montos en Bs. y cero nombres de clientes).
"""

import uuid
import secrets
from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService
from app.Services.Movil.PushNotificationService import PushNotificationService

client = TestClient(app)


@pytest.fixture
def chofer_test(db_session_rollback):
    """Localiza el chofer TEST_Potosi_Chofer (CI 9000004)."""
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


def _crear_pedido_y_comprobante(db, uid, sid, monto=200.0):
    id_asig = _obtener_o_crear_asignacion(db, uid, sid)
    id_cli = _obtener_cliente_sucursal(db, sid)
    nro = f"PED-F3-{secrets.token_hex(4).upper()}"

    ped_row = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdUsuarioRepartidor", "IdEstadoPedido",
            "IdAsignacionRuta", "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, :uid, 2, :asig, NOW(), false, :monto
        ) RETURNING "IdPedido";
    """), {"nro": nro, "cli": id_cli, "uid": uid, "asig": id_asig, "monto": monto}).fetchone()
    id_ped = ped_row[0]

    comp_row = db.execute(text("""
        INSERT INTO public."ComprobanteArchivo" (
            "EntidadOrigen", "IdRegistroOrigen", "UrlArchivo", "NombreOriginal",
            "Formato", "TamanoBytes", "Sha256", "ArchivoEliminado", "FechaSubida", "FechaExpiracion"
        ) VALUES (
            'PEDIDO', :id_ped, '/uploads/comprobantes/test_batch_qr.jpg', 'test_batch_qr.jpg',
            'image/jpeg', 2048, 'sha256_mock_batch_qr', false, NOW(), CURRENT_DATE + INTERVAL '60 days'
        ) RETURNING "IdComprobante";
    """), {"id_ped": id_ped}).fetchone()
    id_comp = comp_row[0]
    db.flush()
    return id_ped, id_comp


# ==============================================================================
# TEST 1: BATCH COBRO QR ASIENTA IdMetodoPago=3 Y APARECE EN BANDEJA KEVIN
# ==============================================================================
def test_batch_cobro_qr_asienta_metodo_qr_y_aparece_en_kevin(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]

    id_ped, id_comp = _crear_pedido_y_comprobante(db, uid, sid, monto=300.0)
    clave_idemp = str(uuid.uuid4())

    payload_batch = {
        "lote_id": f"batch-{uuid.uuid4()}",
        "operaciones": [
            {
                "idempotency_key": clave_idemp,
                "tipo": "COBRO",
                "datos": {
                    "id_pedido": id_ped,
                    "monto_total": 300.0,
                    "latitud": -19.0483,
                    "longitud": -65.2598,
                    "pagos": [
                        {
                            "metodo": "QR",
                            "monto": 300.0,
                            "numero_referencia": "BNB-BATCH-QR-001",
                            "id_comprobante_archivo": id_comp,
                            "url_comprobante": "/uploads/comprobantes/test_batch_qr.jpg"
                        }
                    ],
                    "observacion": "Cobro QR vía batch offline"
                }
            }
        ]
    }

    headers = _generar_auth_headers(chofer_test)
    headers["X-Idempotency-Key"] = str(uuid.uuid4())

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp = client.post("/api/movil/v1/chofer/sincronizar-batch", json=payload_batch, headers=headers)

    assert resp.status_code == 200, f"Error en batch cobro QR: {resp.text}"
    data = resp.json()
    assert data["codigo"] == "EXITO"
    assert len(data["datos"]["sincronizados"]) == 1
    assert len(data["datos"]["errores"]) == 0

    # 1. Verificar que en AbonoCuentaCobrar se asentó con IdMetodoPago = 3 (QR) y PENDIENTE_APROBACION
    abono_row = db.execute(text("""
        SELECT a."IdAbonoCuentaCobrar", a."IdMetodoPago", a."EstadoAprobacion", a."MontoAbonado", a."IdComprobanteArchivo"
        FROM public."AbonoCuentaCobrar" a
        JOIN public."CuentaCobrar" cxc ON a."IdCuentaCobrar" = cxc."IdCuentaCobrar"
        WHERE cxc."IdPedido" = :id_ped
        ORDER BY a."IdAbonoCuentaCobrar" DESC
        LIMIT 1;
    """), {"id_ped": id_ped}).fetchone()

    assert abono_row is not None, "Debe haberse creado el AbonoCuentaCobrar para el cobro QR"
    id_abono, id_metodo, estado, monto, id_comp_abono = abono_row
    assert id_metodo == 3, f"El cobro QR debe asentarse con IdMetodoPago=3 (obtenido {id_metodo})"
    assert estado == "PENDIENTE_APROBACION"
    assert float(monto) == 300.0
    assert id_comp_abono == id_comp

    # 2. Verificar que Kevin ve este abono en su bandeja de pendientes (CuentasCobrarService.ListarAbonosPendientes)
    cxc_service = CuentasCobrarService(db)
    pendientes_kevin = cxc_service.ListarAbonosPendientes(id_sucursal=sid)
    encontrado = any(p["IdAbonoCuentaCobrar"] == id_abono for p in pendientes_kevin)
    assert encontrado, f"El abono QR {id_abono} debe aparecer en la bandeja de Kevin para la sucursal {sid}"


# ==============================================================================
# TEST 2: BATCH COBRO TRANSFERENCIA ASIENTA IdMetodoPago=2
# ==============================================================================
def test_batch_cobro_transferencia_asienta_metodo_transferencia(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]

    id_ped, id_comp = _crear_pedido_y_comprobante(db, uid, sid, monto=150.0)
    clave_idemp = str(uuid.uuid4())

    payload_batch = {
        "lote_id": f"batch-{uuid.uuid4()}",
        "operaciones": [
            {
                "idempotency_key": clave_idemp,
                "tipo": "COBRO",
                "datos": {
                    "id_pedido": id_ped,
                    "monto_total": 150.0,
                    "latitud": -19.0483,
                    "longitud": -65.2598,
                    "pagos": [
                        {
                            "metodo": "TRANSFERENCIA",
                            "monto": 150.0,
                            "numero_referencia": "TRANSF-BNB-5544",
                            "id_comprobante_archivo": id_comp,
                            "url_comprobante": "/uploads/comprobantes/test_batch_qr.jpg"
                        }
                    ],
                    "observacion": "Cobro Transferencia vía batch"
                }
            }
        ]
    }

    headers = _generar_auth_headers(chofer_test)
    headers["X-Idempotency-Key"] = str(uuid.uuid4())

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp = client.post("/api/movil/v1/chofer/sincronizar-batch", json=payload_batch, headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["codigo"] == "EXITO"

    abono_row = db.execute(text("""
        SELECT a."IdAbonoCuentaCobrar", a."IdMetodoPago", a."EstadoAprobacion", a."MontoAbonado"
        FROM public."AbonoCuentaCobrar" a
        JOIN public."CuentaCobrar" cxc ON a."IdCuentaCobrar" = cxc."IdCuentaCobrar"
        WHERE cxc."IdPedido" = :id_ped
        ORDER BY a."IdAbonoCuentaCobrar" DESC
        LIMIT 1;
    """), {"id_ped": id_ped}).fetchone()

    assert abono_row is not None
    assert abono_row[1] == 2, f"El cobro por transferencia debe asentarse con IdMetodoPago=2 (obtenido {abono_row[1]})"
    assert abono_row[2] == "PENDIENTE_APROBACION"
    assert float(abono_row[3]) == 150.0


# ==============================================================================
# TEST 3: ALTA DE CLIENTE EN RUTA CON IDEMPOTENCIA Y ASIGNACIÓN DE SUCURSAL
# ==============================================================================
def test_alta_cliente_idempotencia_y_asignacion_sucursal(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]

    ruta_row = db.execute(text("""
        SELECT "IdRutaDistribucion" FROM public."RutaDistribucion" WHERE "IdSucursal" = :sid LIMIT 1;
    """), {"sid": sid}).fetchone()
    id_ruta = ruta_row[0] if ruta_row else None

    clave_idemp = str(uuid.uuid4())
    razon_social = f"Tienda Test {uuid.uuid4().hex[:6]}"

    payload = {
        "razon_social": razon_social,
        "nombre_comercial": f"Abarrotes {razon_social}",
        "nit_ci": "4930129",
        "telefono": "71239847",
        "direccion": "Av. Principal #550",
        "zona": "Zona Mercado",
        "tipo_negocio": "TIENDA_BARRIO",
        "observaciones": "Punto registrado desde móvil",
        "latitud": -19.0431,
        "longitud": -65.2592,
        "id_ruta_distribucion": id_ruta
    }

    headers = _generar_auth_headers(chofer_test)
    headers["X-Idempotency-Key"] = clave_idemp

    # 1. Primer envío: creación exitosa
    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp1 = client.post("/api/movil/v1/chofer/clientes", json=payload, headers=headers)

    assert resp1.status_code == 200, f"Error al crear cliente: {resp1.text}"
    data1 = resp1.json()
    assert data1["codigo"] == "EXITO"
    id_cliente = data1["datos"]["id_cliente"]
    id_punto_venta = data1["datos"]["id_punto_venta"]

    # Verificar que el cliente se asignó a la sucursal del chofer
    cli_db = db.execute(text("""
        SELECT "IdSucursal", "IdUsuarioRegistro" FROM public."Cliente" WHERE "IdCliente" = :id;
    """), {"id": id_cliente}).fetchone()
    assert cli_db is not None
    assert cli_db[0] == sid, f"El cliente debe crearse en la sucursal del chofer ({sid})"
    assert cli_db[1] == uid

    # Verificar PuntoVenta
    pv_db = db.execute(text("""
        SELECT "IdPuntoVenta", "IdCliente", "Activo" FROM public."PuntoVenta" WHERE "IdPuntoVenta" = :id;
    """), {"id": id_punto_venta}).fetchone()
    assert pv_db is not None
    assert pv_db[1] == id_cliente
    assert pv_db[2] is True

    # 2. Segundo envío con la misma X-Idempotency-Key: respuesta cacheada sin duplicar filas
    conteo_antes_cli = db.execute(text('SELECT COUNT(*) FROM public."Cliente" WHERE "RazonSocial" = :rs'), {"rs": razon_social}).scalar()
    conteo_antes_pv = db.execute(text('SELECT COUNT(*) FROM public."PuntoVenta" WHERE "IdCliente" = :id'), {"id": id_cliente}).scalar()

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_verificar_token(chofer_test)):
        resp2 = client.post("/api/movil/v1/chofer/clientes", json=payload, headers=headers)

    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["codigo"] == "EXITO"
    assert data2["datos"]["id_cliente"] == id_cliente
    assert data2["datos"]["id_punto_venta"] == id_punto_venta

    conteo_despues_cli = db.execute(text('SELECT COUNT(*) FROM public."Cliente" WHERE "RazonSocial" = :rs'), {"rs": razon_social}).scalar()
    conteo_despues_pv = db.execute(text('SELECT COUNT(*) FROM public."PuntoVenta" WHERE "IdCliente" = :id'), {"id": id_cliente}).scalar()

    assert conteo_despues_cli == conteo_antes_cli == 1, "La idempotencia debe prevenir la creación de clientes duplicados"
    assert conteo_despues_pv == conteo_antes_pv == 1, "La idempotencia debe prevenir la creación de puntos de venta duplicados"


# ==============================================================================
# TEST 4: RESOLVER ABONO KEVIN NOTIFICA AL CHOFER CON MOTIVO Y PUSH PRIVADO
# ==============================================================================
def test_resolver_abono_kevin_notifica_chofer_con_motivo_y_push(db_session_rollback, chofer_test):
    db = db_session_rollback
    uid = chofer_test["IdUsuario"]
    sid = chofer_test["IdSucursal"]

    id_ped, id_comp = _crear_pedido_y_comprobante(db, uid, sid, monto=250.0)
    id_cli = _obtener_cliente_sucursal(db, sid)

    # Crear abono QR en estado PENDIENTE_APROBACION
    id_cxc = db.execute(text("""
        INSERT INTO public."CuentaCobrar" (
            "IdPedido", "MontoTotal", "SaldoPendiente", "IdEstadoCuentaCobrar",
            "IdSucursal", "FechaVencimiento", "IdCliente", "FechaEmision"
        ) VALUES (
            :id_ped, 250.0, 250.0, 1, :sid, CURRENT_DATE + INTERVAL '15 days', :cli, CURRENT_DATE
        ) RETURNING "IdCuentaCobrar";
    """), {"id_ped": id_ped, "sid": sid, "cli": id_cli}).fetchone()[0]

    id_abono = db.execute(text("""
        INSERT INTO public."AbonoCuentaCobrar" (
            "IdCuentaCobrar", "IdMetodoPago", "MontoAbonado", "FechaAbono",
            "IdUsuario", "NumeroReferencia", "EstadoAprobacion", "IdComprobanteArchivo"
        ) VALUES (
            :cxc, 3, 250.0, CURRENT_DATE, :uid, 'REF-KEVIN-TEST', 'PENDIENTE_APROBACION', :comp
        ) RETURNING "IdAbonoCuentaCobrar";
    """), {"cxc": id_cxc, "uid": uid, "comp": id_comp}).fetchone()[0]
    db.flush()

    # Kevin rechaza el abono con motivo específico
    motivo_rechazo = "Comprobante fotográfico borroso o ilegible"

    cxc_service = CuentasCobrarService(db)

    with patch.object(PushNotificationService, "notificar_usuario") as mock_push:
        resultado = cxc_service.ResolverAbonoKevin(
            id_abono=id_abono,
            aprobado=False,
            id_kevin=uid,
            observacion=motivo_rechazo
        )

        assert resultado["EstadoAprobacion"] == "RECHAZADO"

        # 1. Verificar NotificacionInterna generada para el chofer
        notif_row = db.execute(text("""
            SELECT "Titulo", "Mensaje", "IdUsuarioDestinatario", "Tipo"
            FROM public."NotificacionInterna"
            WHERE "IdUsuarioDestinatario" = :uid
            ORDER BY "IdNotificacion" DESC
            LIMIT 1;
        """), {"uid": uid}).fetchone()

        assert notif_row is not None
        titulo, mensaje, dest_id, tipo = notif_row
        assert dest_id == uid
        assert "Cobro Rechazado" in titulo
        assert f"Motivo: {motivo_rechazo}" in mensaje

        # 2. Verificar llamada a PushNotificationService.notificar_usuario
        mock_push.assert_called_once()
        call_args = mock_push.call_args
        args = call_args[0] if call_args[0] else []
        kwargs = call_args[1] if call_args[1] else {}

        titulo_push = kwargs.get("titulo") or (args[2] if len(args) > 2 else "")
        mensaje_push = kwargs.get("mensaje") or (args[3] if len(args) > 3 else "")

        # Verificación estricta de privacidad: sin montos en Bs ni nombres de clientes
        assert "Bs." not in mensaje_push, "El push no debe exponer montos en bolivianos"
        assert "Bs" not in mensaje_push
        assert "Doña" not in mensaje_push
