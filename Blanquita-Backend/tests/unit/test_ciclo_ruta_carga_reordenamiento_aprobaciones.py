"""
Suite de Pruebas Integrales y Unitarias de Ciclo de Ruta, Carga de Camión,
Reordenamiento 1..N y Aprobaciones Web.

Cubre exhaustivamente:
1. Bloqueo HTTP 403 de entrega y cobro antes de aprobar carga de camión
   (estados PENDIENTE_CARGA y CARGA_SOLICITADA) y desbloqueo tras aprobarla (APROBADA_EN_RUTA).
2. Reordenamiento Compacto 1..N:
   - Eliminar la parada #4 convierte automáticamente a #5 y #6 en #4 y #5 sin huecos.
   - Prohibición HTTP 400 al intentar borrar o mover una parada ya entregada o cobrada hoy.
   - Inserción de venta inmediata después de parada #2 pasa a ser #3 y desplaza paradas >= 3 en +1.
3. Flujo de aprobación web y cierre:
   - Aprobación 1 a 1 de operaciones en Web (PATCH /logistica/operaciones-ruta/{tipo}/{id}/revisar).
   - Prohibición HTTP 400 de cerrar ruta si hay operaciones en PENDIENTE de revisión.
   - Prohibición HTTP 403 si un usuario con rol Chofer intenta cerrar la ruta.
   - Finalización de ruta y reasignación de paradas pendientes hacia otro chofer / asignación.
"""

from datetime import date
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.Config.supabase import get_db
from app.Auth.Dependencies import get_current_user
from app.Auth.AlcanceSucursal import DependenciaAlcanceSucursal
from app.Constants.Roles import ROL_AGENTE_REPARTO, ROL_SUPERVISOR, ROL_GERENTE_GENERAL
from app.Services.Logistica.RutaService import RutaService
from app.Models.Logistica.RutaModel import (
    InsertarParadaOrdenRequest,
    QuitarParadaRequest,
    MoverParadaRutaRequest,
    SolicitudCargaCrear,
    ItemSolicitudCarga,
    SolicitudCargaRevision,
    RevisionWebOperacionRequest,
    RevisionOperacionRequest,
    AprobarCargaRequest,
    ItemAprobarCargaDTO,
    FinalizarAdminRequest,
    ReasignarPendientesRequest,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures y Helpers de Usuario y Alcance
# ---------------------------------------------------------------------------

def mock_chofer_user():
    return {
        "IdUsuario": 99,
        "IdRol": ROL_AGENTE_REPARTO,
        "id_rol": ROL_AGENTE_REPARTO,
        "IdSucursal": 1,
        "id_sucursal": 1,
        "Correo": "chofer99@blanquita.com",
    }


def mock_admin_user():
    return {
        "IdUsuario": 1,
        "IdRol": ROL_SUPERVISOR,
        "id_rol": ROL_SUPERVISOR,
        "IdSucursal": 1,
        "id_sucursal": 1,
        "Correo": "admin@blanquita.com",
    }


def mock_alcance():
    alc = MagicMock()
    alc.id_usuario = 1
    alc.puede_ver_todas = True
    alc.sucursales_permitidas = [1, 2]
    alc.sucursal_efectiva = 1
    alc.sucursal_asignada_defecto = 1
    alc.validar_recurso = MagicMock(return_value=True)
    return alc


class MockDbCaller:
    """Simulador en memoria de llamadas a BD para RutaService/RutaRepository."""

    def __init__(self):
        self.llamadas = []
        self.paradas_db = {}  # id_ruta -> list of dicts
        self.operada_hoy = False

    def LlamarUnRegistro(self, sql, params=None, commit=False):
        self.llamadas.append((sql, params))
        if "fn_generar_rutas_diarias" in sql:
            return {"resultado": {"fecha": str(params.get("fecha")), "asignaciones_creadas": 1, "paradas_programadas": 0}}
        if "SELECT COUNT(*) as total" in sql:
            return {"total": 1 if self.operada_hoy else 0}
        if "SELECT COALESCE(MAX(\"OrdenVisita\"), 0)" in sql:
            id_ruta = params.get("id_ruta")
            pts = self.paradas_db.get(id_ruta, [])
            max_o = max([p["OrdenVisita"] for p in pts], default=0)
            return {"max_o": max_o}
        if "INSERT INTO public.\"solicitud_carga_camion\"" in sql:
            return {
                "id_solicitud": 101,
                "id_asignacion_ruta": params["id_asig"],
                "id_chofer": params["id_chofer"],
                "estado": "PENDIENTE",
                "observacion_chofer": params.get("obs_chofer"),
            }
        if "INSERT INTO public.\"detalle_solicitud_carga_camion\"" in sql:
            return {
                "id_detalle": 201,
                "id_solicitud": params["id_sol"],
                "id_presentacion": params["p_id"],
                "stock_remanente": params["s_rem"],
                "stock_adicional_solicitado": params["s_sol"],
                "stock_adicional_aprobado": params["s_sol"],
            }
        if "UPDATE public.\"solicitud_carga_camion\"" in sql:
            return {
                "id_solicitud": params["id_sol"],
                "id_asignacion_ruta": 15,
                "estado": params["estado"],
                "observacion_admin": params.get("obs_admin"),
            }
        if "SELECT" in sql and "solicitud_carga_camion" in sql:
            return {
                "id_solicitud": params["id_sol"],
                "id_asignacion_ruta": 15,
                "id_chofer": 9,
                "nombre_chofer": "Carlos Chofer",
                "estado": "APROBADO",
                "observacion_chofer": "Carga inicial",
                "observacion_admin": "Aprobado almacén",
                "id_admin_revision": 1,
                "fecha_solicitud": "2026-11-13T08:00:00",
                "fecha_revision": "2026-11-13T08:15:00",
                "created_at": "2026-11-13T08:00:00",
            }
        if "UPDATE public.\"Pedido\"" in sql:
            return {
                "IdPedido": params["id_p"],
                "NumeroPedido": "PED-001",
                "estado_revision_web": params["est"],
                "observacion_revision": params.get("obs"),
            }
        if "UPDATE public.\"PagoPedido\"" in sql:
            return {
                "IdPagoPedido": params["id_pago"],
                "IdPedido": 10,
                "Monto": 150.0,
                "estado_revision_web": params["est"],
                "observacion_revision": params.get("obs"),
            }
        return {}

    def LlamarFuncion(self, sql, params=None, commit=False):
        self.llamadas.append((sql, params))
        if "SELECT \"IdRutaPuntoVenta\", \"IdPuntoVenta\", \"OrdenVisita\"" in sql:
            id_ruta = params.get("id_ruta")
            return sorted(self.paradas_db.get(id_ruta, []), key=lambda x: x["OrdenVisita"])
        if "UPDATE \"RutaPuntoVenta\"" in sql and "SET \"OrdenVisita\" = :nuevo_orden" in sql:
            id_rpv = params["id_rpv"]
            nuevo_orden = params["nuevo_orden"]
            for r_id, items in self.paradas_db.items():
                for it in items:
                    if it["IdRutaPuntoVenta"] == id_rpv:
                        it["OrdenVisita"] = nuevo_orden
            return []
        if "UPDATE \"RutaPuntoVenta\"" in sql and "\"OrdenVisita\" = \"OrdenVisita\" + 1" in sql:
            id_ruta = params["id_ruta"]
            posicion = params["posicion"]
            for it in self.paradas_db.get(id_ruta, []):
                if it["OrdenVisita"] >= posicion:
                    it["OrdenVisita"] += 1
            return []
        if "INSERT INTO \"RutaPuntoVenta\"" in sql:
            id_ruta = params["id_ruta"]
            id_pv = params["id_pv"]
            pos = params["posicion"]
            items = self.paradas_db.setdefault(id_ruta, [])
            existente = next((x for x in items if x["IdPuntoVenta"] == id_pv), None)
            if existente:
                existente["OrdenVisita"] = pos
            else:
                next_id = max([x["IdRutaPuntoVenta"] for x in items], default=0) + 1
                items.append({"IdRutaPuntoVenta": next_id, "IdPuntoVenta": id_pv, "OrdenVisita": pos})
            return []
        if "DELETE FROM \"RutaPuntoVenta\"" in sql:
            id_ruta = params.get("id_ruta") or params.get("id_o")
            id_pv = params["id_pv"]
            self.paradas_db[id_ruta] = [x for x in self.paradas_db.get(id_ruta, []) if x["IdPuntoVenta"] != id_pv]
            return []
        return []


# ===========================================================================
# SECCIÓN A: GATEKEEPER DE CARGA DE CAMIÓN (BLOQUEO 403 Y DESBLOQUEO)
# ===========================================================================

@pytest.mark.parametrize("estado_operativo_bloqueante", ["PENDIENTE_CARGA", "CARGA_SOLICITADA"])
def test_gatekeeper_bloquea_entrega_en_estados_no_aprobados(estado_operativo_bloqueante):
    """
    Valida bloqueo HTTP 403 en endpoint /entregar cuando la asignación del chofer
    se encuentra en PENDIENTE_CARGA o CARGA_SOLICITADA.
    """
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    mock_row = MagicMock()
    mock_row.estado_operativo = estado_operativo_bloqueante
    mock_row.IdUsuarioRepartidor = 99
    mock_row.IdSucursal = 1
    mock_row.IdPedido = 123
    mock_db.execute.return_value.fetchone.return_value = mock_row

    with patch("app.Routes.Movil.ChoferMovilRouter._validar_pertenencia_pedido_chofer", return_value={"IdSucursal": 1}):
        response = client.post(
            "/api/movil/v1/chofer/entregar",
            headers={"X-Idempotency-Key": "11111111-2222-3333-4444-555555555555"},
            json={
                "id_pedido": 123,
                "latitud": -19.04,
                "longitud": -65.26,
                "firma_chofer": "data:image/svg+xml;base64,dGVzdA==",
            },
        )

    assert response.status_code == 403
    assert "La carga de tu camión aún no fue aprobada en Web" in response.text
    app.dependency_overrides.clear()


@pytest.mark.parametrize("estado_operativo_bloqueante", ["PENDIENTE_CARGA", "CARGA_SOLICITADA"])
def test_gatekeeper_bloquea_cobro_en_estados_no_aprobados(estado_operativo_bloqueante):
    """
    Valida bloqueo HTTP 403 en endpoint /cobrar cuando la asignación del chofer
    se encuentra en PENDIENTE_CARGA o CARGA_SOLICITADA.
    """
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    mock_row = MagicMock()
    mock_row.estado_operativo = estado_operativo_bloqueante
    mock_row.IdUsuarioRepartidor = 99
    mock_row.IdSucursal = 1
    mock_row.IdPedido = 123
    mock_db.execute.return_value.fetchone.return_value = mock_row

    with patch("app.Routes.Movil.ChoferMovilRouter._validar_pertenencia_pedido_chofer", return_value={"IdSucursal": 1}):
        response = client.post(
            "/api/movil/v1/chofer/cobrar",
            headers={"X-Idempotency-Key": "22222222-3333-4444-5555-666666666666"},
            json={
                "id_pedido": 123,
                "monto_total": 150.0,
                "latitud": -19.04,
                "longitud": -65.26,
                "pagos": [
                    {"metodo_pago": "EFECTIVO", "monto": 150.0}
                ],
            },
        )

    assert response.status_code == 403
    assert "La carga de tu camión aún no fue aprobada en Web" in response.text
    app.dependency_overrides.clear()


def test_aprobacion_carga_camion_web_pasa_a_aprobada_en_ruta():
    """
    Valida que POST /logistica/asignaciones/{id}/aprobar-carga transicione
    el estado operativo a APROBADA_EN_RUTA y reporte habilitada_para_reparto: true.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    asig_row = MagicMock()
    asig_row.IdAsignacionRuta = 10
    asig_row.IdUsuarioRepartidor = 99
    asig_row.IdSucursal = 1
    asig_row.estado_operativo = "CARGA_SOLICITADA"
    # fetchone devuelve asig_row, luego solicitud_carga_camion = None, luego inventario_chofer = None
    mock_db.execute.return_value.fetchone.side_effect = [asig_row, None, None]

    response = client.post(
        "/logistica/asignaciones/10/aprobar-carga",
        json={
            "items": [{"presentacion_id": 1, "cantidad_aprobada": 45}],
            "observacion": "Carga conforme para salida a ruta",
        },
    )

    assert response.status_code == 200
    res = response.json()
    assert res["codigo"] == "EXITO"
    assert res["datos"]["estado_operativo"] == "APROBADA_EN_RUTA"
    assert res["datos"]["habilitada_para_reparto"] is True
    app.dependency_overrides.clear()


def test_desbloqueo_gatekeeper_tras_aprobar_carga():
    """
    Valida que tras aprobar la carga (estado APROBADA_EN_RUTA), el Gatekeeper
    no levante HTTP 403 y permita procesar la entrega con normalidad.
    """
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    mock_row = MagicMock()
    mock_row.estado_operativo = "APROBADA_EN_RUTA"
    mock_row.IdUsuarioRepartidor = 99
    mock_row.IdSucursal = 1
    mock_row.IdPedido = 123
    mock_db.execute.return_value.fetchone.return_value = mock_row

    # Al consultar el Gatekeeper con APROBADA_EN_RUTA no debe lanzar excepción 403
    from app.Routes.Movil.ChoferMovilRouter import _validar_gatekeeper_carga_camion
    # Debe ejecutarse sin lanzar HTTPException
    _validar_gatekeeper_carga_camion(mock_db, id_pedido=123, uid=99)
    app.dependency_overrides.clear()


# ===========================================================================
# SECCIÓN B: REORDENAMIENTO 1..N Y REGLA INQUEBRANTABLE
# ===========================================================================

def test_reordenamiento_compacto_eliminar_parada_4_convierte_5_y_6_en_4_y_5():
    """
    Regla: Eliminar la parada #4 convierte automáticamente a #5 y #6 en #4 y #5 sin huecos.
    Verifica secuencia estricta 1..N.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    id_ruta = 10
    mock_caller.paradas_db[id_ruta] = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 101, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 102, "OrdenVisita": 2},
        {"IdRutaPuntoVenta": 3, "IdPuntoVenta": 103, "OrdenVisita": 3},
        {"IdRutaPuntoVenta": 4, "IdPuntoVenta": 104, "OrdenVisita": 4},
        {"IdRutaPuntoVenta": 5, "IdPuntoVenta": 105, "OrdenVisita": 5},
        {"IdRutaPuntoVenta": 6, "IdPuntoVenta": 106, "OrdenVisita": 6},
    ]

    dto = QuitarParadaRequest(IdRuta=id_ruta, IdPuntoVenta=104)
    resultado = service.quitar_parada_ruta(dto)

    assert len(resultado) == 5
    ordenes = [p["OrdenVisita"] for p in resultado]
    pvs = [p["IdPuntoVenta"] for p in resultado]

    # Secuencia 1..5 exacta sin huecos
    assert ordenes == [1, 2, 3, 4, 5]
    # Clientes 105 y 106 tomaron las posiciones #4 y #5
    assert pvs == [101, 102, 103, 105, 106]


def test_endpoint_quitar_parada_compacta_1_a_n():
    """
    Valida la invocación vía endpoint REST POST /logistica/rutas/paradas/quitar.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    paradas_resultado = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 101, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 102, "OrdenVisita": 2},
        {"IdRutaPuntoVenta": 3, "IdPuntoVenta": 103, "OrdenVisita": 3},
        {"IdRutaPuntoVenta": 5, "IdPuntoVenta": 105, "OrdenVisita": 4},
        {"IdRutaPuntoVenta": 6, "IdPuntoVenta": 106, "OrdenVisita": 5},
    ]

    with patch.object(RutaService, "quitar_parada_ruta", return_value=paradas_resultado):
        response = client.post(
            "/logistica/rutas/paradas/quitar",
            json={"IdRuta": 10, "IdPuntoVenta": 104},
        )

    assert response.status_code == 200
    datos = response.json()
    assert len(datos) == 5
    assert [p["OrdenVisita"] for p in datos] == [1, 2, 3, 4, 5]
    assert [p["IdPuntoVenta"] for p in datos] == [101, 102, 103, 105, 106]
    app.dependency_overrides.clear()


def test_regla_inquebrantable_prohibe_borrar_parada_operada_hoy_lanza_http_400():
    """
    Regla inquebrantable: Si una parada ya tiene entrega o cobro hoy,
    lanza HTTP 400 y prohíbe eliminarla.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    mock_caller.operada_hoy = True
    service.repo.caller = mock_caller

    id_ruta = 1
    mock_caller.paradas_db[id_ruta] = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 101, "OrdenVisita": 1},
    ]

    dto = QuitarParadaRequest(IdRuta=id_ruta, IdPuntoVenta=101)
    with pytest.raises(HTTPException) as exc:
        service.quitar_parada_ruta(dto)

    assert exc.value.status_code == 400
    assert "Regla inquebrantable" in exc.value.detail
    assert "prohibido eliminarla" in exc.value.detail


def test_regla_inquebrantable_prohibe_mover_parada_operada_hoy_lanza_http_400():
    """
    Regla inquebrantable: Si una parada ya tiene entrega o cobro hoy,
    lanza HTTP 400 y prohíbe moverla de ruta/día.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    mock_caller.operada_hoy = True
    service.repo.caller = mock_caller

    dto = MoverParadaRutaRequest(
        IdPuntoVenta=101, IdRutaOrigen=1, IdRutaDestino=2, PosicionDestino=1
    )
    with pytest.raises(HTTPException) as exc:
        service.mover_cliente_de_ruta(dto)

    assert exc.value.status_code == 400
    assert "Regla inquebrantable" in exc.value.detail
    assert "prohibido moverla" in exc.value.detail


def test_insercion_venta_inmediata_desplaza_paradas_posteriores():
    """
    Inserción de venta inmediata o parada manual después de parada #2 (posición 3):
    - La nueva parada pasa a ser #3.
    - Las paradas >= 3 se desplazan en +1 (#3 y #4 pasan a ser #4 y #5).
    - La secuencia resultante es 1..N sin huecos.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    id_ruta = 5
    mock_caller.paradas_db[id_ruta] = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 201, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 202, "OrdenVisita": 2},
        {"IdRutaPuntoVenta": 3, "IdPuntoVenta": 203, "OrdenVisita": 3},
        {"IdRutaPuntoVenta": 4, "IdPuntoVenta": 204, "OrdenVisita": 4},
    ]

    # Insertar nueva venta inmediata con IdPuntoVenta=777 en posicion 3
    dto = InsertarParadaOrdenRequest(IdRuta=id_ruta, IdPuntoVenta=777, Posicion=3)
    resultado = service.insertar_parada_en_orden(dto)

    assert len(resultado) == 5
    ordenes = [p["OrdenVisita"] for p in resultado]
    pvs = [p["IdPuntoVenta"] for p in resultado]

    assert ordenes == [1, 2, 3, 4, 5]
    # Parada 777 es #3, 203 pasó a #4, 204 pasó a #5
    assert pvs == [201, 202, 777, 203, 204]


def test_endpoint_insertar_parada_en_orden():
    """
    Valida endpoint REST POST /logistica/rutas/paradas/insertar.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    paradas_resultado = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 201, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 202, "OrdenVisita": 2},
        {"IdRutaPuntoVenta": 5, "IdPuntoVenta": 777, "OrdenVisita": 3},
        {"IdRutaPuntoVenta": 3, "IdPuntoVenta": 203, "OrdenVisita": 4},
        {"IdRutaPuntoVenta": 4, "IdPuntoVenta": 204, "OrdenVisita": 5},
    ]

    with patch.object(RutaService, "insertar_parada_en_orden", return_value=paradas_resultado):
        response = client.post(
            "/logistica/rutas/paradas/insertar",
            json={"IdRuta": 5, "IdPuntoVenta": 777, "Posicion": 3},
        )

    assert response.status_code == 200
    datos = response.json()
    assert len(datos) == 5
    assert [p["OrdenVisita"] for p in datos] == [1, 2, 3, 4, 5]
    assert datos[2]["IdPuntoVenta"] == 777
    app.dependency_overrides.clear()


# ===========================================================================
# SECCIÓN C: FLUJO DE APROBACIÓN WEB 1 A 1, CIERRE Y REASIGNACIÓN
# ===========================================================================

def test_aprobacion_web_1a1_entrega_aprobado_y_observado():
    """
    Valida PATCH /logistica/operaciones-ruta/entrega/{id}/revisar
    para estados APROBADO y OBSERVADO.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    ped_row = MagicMock()
    ped_row.IdPedido = 55
    ped_row.IdUsuarioRepartidor = 99
    ped_row.IdSucursal = 1
    mock_db.execute.return_value.fetchone.return_value = ped_row

    # 1. Aprobar Entrega
    res1 = client.patch(
        "/logistica/operaciones-ruta/entrega/55/revisar",
        json={"estado": "APROBADO", "observacion": "Firma y recepción conforme"},
    )
    assert res1.status_code == 200
    body1 = res1.json()
    assert body1["codigo"] == "EXITO"
    assert body1["datos"]["estado_revision_web"] == "APROBADO"
    assert body1["datos"]["tipo"] == "entrega"

    # 2. Observar Entrega
    res2 = client.patch(
        "/logistica/operaciones-ruta/entrega/55/revisar",
        json={"estado": "OBSERVADO", "observacion": "Falta fotografía nítida"},
    )
    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["datos"]["estado_revision_web"] == "OBSERVADO"
    app.dependency_overrides.clear()


def test_aprobacion_web_1a1_cobro_aprobado_y_rechazado():
    """
    Valida PATCH /logistica/operaciones-ruta/cobro/{id}/revisar
    para estados APROBADO y RECHAZADO.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    pago_row = MagicMock()
    pago_row.IdPagoPedido = 88
    pago_row.IdUsuarioRepartidor = 99
    pago_row.IdSucursal = 1
    mock_db.execute.return_value.fetchone.return_value = pago_row

    # 1. Aprobar Cobro
    res1 = client.patch(
        "/logistica/operaciones-ruta/cobro/88/revisar",
        json={"estado": "APROBADO", "observacion": "Depósito bancario conciliado"},
    )
    assert res1.status_code == 200
    body1 = res1.json()
    assert body1["codigo"] == "EXITO"
    assert body1["datos"]["estado_revision_web"] == "APROBADO"
    assert body1["datos"]["tipo"] == "cobro"

    # 2. Rechazar Cobro
    res2 = client.patch(
        "/logistica/operaciones-ruta/cobro/88/revisar",
        json={"estado": "RECHAZADO", "observacion": "Comprobante falso o duplicado"},
    )
    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["datos"]["estado_revision_web"] == "RECHAZADO"
    app.dependency_overrides.clear()


def test_aprobacion_web_1a1_valida_tipo_y_estado_invalidos():
    """
    Valida HTTP 400 si se envía un tipo de operación inválido o un estado no permitido.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    # Tipo inválido
    res_tipo = client.patch(
        "/logistica/operaciones-ruta/inventario/1/revisar",
        json={"estado": "APROBADO"},
    )
    assert res_tipo.status_code == 400
    assert "Tipo de operación inválido" in res_tipo.text

    # Estado inválido
    res_estado = client.patch(
        "/logistica/operaciones-ruta/entrega/55/revisar",
        json={"estado": "INVENTADO"},
    )
    assert res_estado.status_code == 400
    assert "Estado de revisión inválido" in res_estado.text
    app.dependency_overrides.clear()


def test_finalizar_ruta_admin_prohibicion_http_403_para_chofer():
    """
    Valida que un usuario con rol Chofer (Agente de Reparto) reciba HTTP 403
    al intentar finalizar la ruta por administración.
    """
    app.dependency_overrides[get_current_user] = mock_chofer_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.post(
        "/logistica/asignaciones/10/finalizar-admin",
        json={"observacion_cierre_admin": "Intento de chofer de auto-cerrar ruta"},
    )

    assert response.status_code == 403
    assert "exclusivo del administrador" in response.text
    app.dependency_overrides.clear()


def test_finalizar_ruta_admin_prohibicion_http_400_con_operaciones_pendientes():
    """
    Valida HTTP 400 si se intenta cerrar la ruta cuando existen operaciones
    con estado_revision_web en PENDIENTE.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    asig_row = MagicMock()
    asig_row.IdAsignacionRuta = 10
    asig_row.IdUsuarioRepartidor = 99
    asig_row.IdSucursal = 1
    asig_row.estado_operativo = "APROBADA_EN_RUTA"
    mock_db.execute.return_value.fetchone.return_value = asig_row
    # Simula 2 entregas pendientes y 1 cobro pendiente
    mock_db.execute.return_value.scalar.side_effect = [2, 1]

    response = client.post(
        "/logistica/asignaciones/10/finalizar-admin",
        json={"observacion_cierre_admin": "Cierre con pendientes"},
    )

    assert response.status_code == 400
    assert "quedan 3 operaciones pendientes de revisión (2 entregas, 1 cobros)" in response.text
    app.dependency_overrides.clear()


def test_finalizar_ruta_admin_exito_cero_pendientes():
    """
    Valida finalización exitosa de ruta por Administrador cuando total_pendientes == 0.
    Pasa a estado_operativo FINALIZADA y registra kilometraje final y observación.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    asig_row = MagicMock()
    asig_row.IdAsignacionRuta = 10
    asig_row.IdUsuarioRepartidor = 99
    asig_row.IdSucursal = 1
    asig_row.estado_operativo = "APROBADA_EN_RUTA"
    mock_db.execute.return_value.fetchone.return_value = asig_row
    # 0 entregas pendientes, 0 cobros pendientes
    mock_db.execute.return_value.scalar.side_effect = [0, 0]

    response = client.post(
        "/logistica/asignaciones/10/finalizar-admin",
        json={
            "observacion_cierre_admin": "Ruta liquidada y conforme al 100%",
            "kilometraje_final": 185.5,
        },
    )

    assert response.status_code == 200
    datos = response.json()
    assert datos["codigo"] == "EXITO"
    assert datos["datos"]["estado_operativo"] == "FINALIZADA"
    assert datos["datos"]["observacion_cierre_admin"] == "Ruta liquidada y conforme al 100%"
    app.dependency_overrides.clear()


def test_reasignar_paradas_pendientes_a_otro_chofer():
    """
    Valida POST /logistica/asignaciones/{id}/reasignar-pendientes:
    Toma los pedidos no entregados y los transfiere a un nuevo chofer / asignación.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    # Simular 3 pedidos pendientes en la asignación #10
    mock_db.execute.return_value.fetchall.return_value = [(101,), (102,), (103,)]

    response = client.post(
        "/logistica/asignaciones/10/reasignar-pendientes",
        json={
            "nuevo_id_chofer": 88,
            "nueva_id_asignacion": 25,
        },
    )

    assert response.status_code == 200
    res = response.json()
    assert res["codigo"] == "EXITO"
    assert res["datos"]["id_asignacion_origen"] == 10
    assert res["datos"]["nuevo_id_chofer"] == 88
    assert res["datos"]["nueva_id_asignacion"] == 25
    assert res["datos"]["pedidos_reasignados"] == 3
    app.dependency_overrides.clear()


def test_reasignar_paradas_pendientes_sin_pedidos_retorna_cero():
    """
    Valida que si no hay pedidos pendientes en la asignación, devuelva conteo 0.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    app.dependency_overrides[DependenciaAlcanceSucursal] = mock_alcance
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    # Sin pedidos pendientes
    mock_db.execute.return_value.fetchall.return_value = []

    response = client.post(
        "/logistica/asignaciones/10/reasignar-pendientes",
        json={
            "nuevo_id_chofer": 88,
            "nueva_id_asignacion": 25,
        },
    )

    assert response.status_code == 200
    res = response.json()
    assert res["codigo"] == "EXITO"
    assert res["paradas_reasignadas"] == 0
    assert "No hay pedidos pendientes para reasignar" in res["mensaje"]
    app.dependency_overrides.clear()
