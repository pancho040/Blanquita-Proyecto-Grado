"""
Test de Integración para SUB-AGENTE C: Visibilidad de Entregas y Cobros Móviles en el Panel Web
Sistema ERP Papelera Blanquita

Verifica que:
1. Una entrega con cobro registrada desde el endpoint móvil (/api/movil/v1/chofer/entregar)
   se asiente en NotaVenta y aparezca de inmediato en la consulta GET /contabilidad/cxc/notas-venta
   que alimenta el panel de Reparto / Historial.
2. Contenga el desglose correcto: Chofer, Monto Total, Efectivo, QR, Saldo en Crédito,
   Estado de Cobranza (Pendiente Aprobación / Liquidado) y firmas digitales.
"""

import uuid
import secrets
from datetime import date, timedelta
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService

client = TestClient(app)


@pytest.fixture
def chofer_operativo(db_session_rollback):
    db = db_session_rollback
    row = db.execute(
        text('SELECT "IdUsuario", "IdRol", "IdSucursal", "Ci", "AuthUserId", "PrimerNombre", "ApellidoPaterno" FROM public."Usuario" WHERE "Ci" = :ci'),
        {"ci": "9000004"}
    ).fetchone()
    assert row is not None
    return {
        "IdUsuario": row[0],
        "IdRol": row[1],
        "IdSucursal": row[2] or 2,
        "Ci": str(row[3]),
        "AuthUserId": str(row[4]),
        "NombreCompleto": f"{row[5]} {row[6]}".strip()
    }


def _auth_headers(chofer, idemp_key=None):
    h = {
        "Authorization": f"Bearer token_panel_{chofer['IdUsuario']}",
        "X-Request-ID": str(uuid.uuid4())
    }
    if idemp_key:
        h["X-Idempotency-Key"] = idemp_key
    return h


def _mock_payload(usuario):
    return {
        "sub": usuario["AuthUserId"],
        "email": f"user_{usuario['IdUsuario']}@papelerablanquita.com",
        "aud": "authenticated",
        "role": "authenticated",
        "app_metadata": {
            "IdUsuario": usuario["IdUsuario"],
            "IdRol": usuario["IdRol"],
            "IdEstadoUsuario": 1,
            "IsAdmin": False
        }
    }


def test_entrega_movil_aparece_en_consulta_panel_web(db_session_rollback, chofer_operativo):
    """
    Test de Integración Causa Raíz:
    Entrega con cobro registrada por chofer -> debe figurar inmediatamente en ListarNotasVenta
    con su estado (Pendiente Aprobación si hay QR), firmas y montos conciliados.
    """
    db = db_session_rollback
    uid = chofer_operativo["IdUsuario"]
    sid = chofer_operativo["IdSucursal"]

    # 1. Preparar asignación de ruta y cliente
    ruta_id = db.execute(text('SELECT "IdRutaDistribucion" FROM public."RutaDistribucion" WHERE "IdSucursal" = :sid LIMIT 1;'), {"sid": sid}).scalar()
    asig_id = db.execute(text("""
        INSERT INTO public."AsignacionRuta" ("IdRutaDistribucion", "IdUsuarioRepartidor", "FechaAsignacion", "Estado", "IdUsuarioAsigna")
        VALUES (:rid, :uid, CURRENT_DATE, 'En Ruta', :uid)
        RETURNING "IdAsignacionRuta";
    """), {"rid": ruta_id, "uid": uid}).scalar()

    cli_id = db.execute(text('SELECT "IdCliente" FROM public."Cliente" WHERE "IdSucursal" = :sid LIMIT 1;'), {"sid": sid}).scalar()

    # 2. Crear pedido
    nro_ped = f"PED-PANEL-{secrets.token_hex(4).upper()}"
    monto_ped = 300.0
    ped_id = db.execute(text("""
        INSERT INTO public."Pedido" (
            "NumeroPedido", "IdCliente", "IdUsuarioRepartidor", "IdEstadoPedido",
            "IdAsignacionRuta", "FechaPedido", "EsVentaDirecta", "MontoTotal"
        ) VALUES (
            :nro, :cli, :uid, 2, :asig, NOW(), false, :monto
        ) RETURNING "IdPedido";
    """), {"nro": nro_ped, "cli": cli_id, "uid": uid, "asig": asig_id, "monto": monto_ped}).scalar()

    pres_id = db.execute(text('SELECT "IdPresentacion" FROM public."PresentacionProducto" LIMIT 1;')).scalar()
    db.execute(text("""
        INSERT INTO public."DetallePedido" ("IdPedido", "IdPresentacion", "Cantidad", "PrecioUnitarioAplicado", "Subtotal")
        VALUES (:id_ped, :pid, 6.0, 50.0, 300.0);
    """), {"id_ped": ped_id, "pid": pres_id})

    # Cargar stock al camión
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

    # ComprobanteArchivo
    comp_id = db.execute(text("""
        INSERT INTO public."ComprobanteArchivo" (
            "EntidadOrigen", "IdRegistroOrigen", "UrlArchivo", "NombreOriginal",
            "Formato", "TamanoBytes", "Sha256", "ArchivoEliminado", "FechaSubida", "FechaExpiracion"
        ) VALUES (
            'PEDIDO', :pid, '/uploads/comprobantes/test_panel.jpg', 'test_panel.jpg',
            'image/jpeg', 1024, 'sha256_mock_panel', false, NOW(), CURRENT_DATE + INTERVAL '60 days'
        ) RETURNING "IdComprobante";
    """), {"pid": ped_id}).scalar()

    # 3. Chofer ejecuta entrega con cobro mixto (100 Efectivo + 100 QR + 100 Crédito)
    payload_entrega = {
        "id_pedido": ped_id,
        "latitud": -19.043,
        "longitud": -65.258,
        "tipo_entrega": "TOTAL",
        "recibido_por": "Dña. Rosa Méndez",
        "ci_receptor": "1234567 PT",
        "firma_chofer": "data:image/svg+xml;utf8,<svg>firma_chofer_panel</svg>",
        "firma_cliente": "data:image/svg+xml;utf8,<svg>firma_cliente_panel</svg>",
        "cobro": {
            "monto_total": 300.0,
            "pagos": [
                {"metodo": "EFECTIVO", "monto": 100.0},
                {"metodo": "QR", "monto": 100.0, "id_comprobante_archivo": comp_id, "numero_referencia": "BNB-PANEL-88"}
            ],
            "credito": {
                "saldo": 100.0,
                "plazo_dias": 15
            }
        }
    }

    with patch("app.Auth.Dependencies.verificar_token", return_value=_mock_payload(chofer_operativo)):
        r_movil = client.post(
            "/api/movil/v1/chofer/entregar",
            json=payload_entrega,
            headers=_auth_headers(chofer_operativo, str(uuid.uuid4()))
        )
    assert r_movil.status_code == 200, f"Error entrega móvil: {r_movil.text}"

    # 4. Consultar las notas de venta tal como lo hace el panel web de Reparto
    cxc_service = CuentasCobrarService(db)
    notas_panel = cxc_service.ListarNotasVenta(
        fecha_inicio=date.today(),
        fecha_fin=date.today(),
        id_sucursal=sid
    )

    nota_encontrada = next((n for n in notas_panel if n.get("NumeroNotaEntrega") == nro_ped), None)
    assert nota_encontrada is not None, f"La nota de venta para el pedido {nro_ped} DEBE aparecer en el panel web"

    assert float(nota_encontrada["TotalVentaBruto"]) == 300.0
    assert float(nota_encontrada["MontoEfectivo"]) == 100.0
    assert float(nota_encontrada["MontoQR"]) == 100.0
    assert float(nota_encontrada["SaldoPendiente"]) == 100.0
    assert nota_encontrada["EstadoCobranza"] == "Pendiente Aprobación"  # Porque tiene QR pendiente
    assert nota_encontrada["IdChofer"] == uid
    assert nota_encontrada["FirmaDigitalUrl"] is not None
    assert nota_encontrada["FirmaClienteUrl"] is not None
    assert nota_encontrada["FirmaClienteNombre"] == "Dña. Rosa Méndez"
