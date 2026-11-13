"""
Pruebas Unitarias y de Integración para SUB-AGENTE A:
1. Reordenamiento Compacto 1..N:
   - Quitar parada #4: paradas #5 y #6 pasan a ser #4 y #5 sin huecos.
   - Regla inquebrantable: Si una parada ya tiene entrega o cobro hoy, lanza HTTP 400 y prohíbe eliminarla o moverla.
   - Agregar parada manual / ENTREGA_INMEDIATA en posición 3: desplaza las paradas >= 3 en +1 y asigna orden 3.
   - Mover parada de ruta origen a ruta destino: recalcula 1..N en ambas rutas.
2. Invocación de fn_generar_rutas_diarias (idempotente).
3. Ciclo de Carga de Camión: solicitud, detalle de stock remanente + adicional, aprobación con estado APROBADA_EN_RUTA.
4. Auditoría / Revisión Web de entregas y pagos.
"""

from datetime import date
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException

from app.Services.Logistica.RutaService import RutaService
from app.Models.Logistica.RutaModel import (
    InsertarParadaOrdenRequest, QuitarParadaRequest, MoverParadaRutaRequest,
    SolicitudCargaCrear, ItemSolicitudCarga, SolicitudCargaRevision,
    RevisionWebOperacionRequest
)


class MockDbCaller:
    def __init__(self):
        self.llamadas = []
        self.paradas_db = {} # id_ruta -> list of dicts: {"IdRutaPuntoVenta": int, "IdPuntoVenta": int, "OrdenVisita": int}
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
                "observacion_chofer": params.get("obs_chofer")
            }
        if "INSERT INTO public.\"detalle_solicitud_carga_camion\"" in sql:
            return {
                "id_detalle": 201,
                "id_solicitud": params["id_sol"],
                "id_presentacion": params["p_id"],
                "stock_remanente": params["s_rem"],
                "stock_adicional_solicitado": params["s_sol"],
                "stock_adicional_aprobado": params["s_sol"]
            }
        if "UPDATE public.\"solicitud_carga_camion\"" in sql:
            return {
                "id_solicitud": params["id_sol"],
                "id_asignacion_ruta": 15,
                "estado": params["estado"],
                "observacion_admin": params.get("obs_admin")
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
                "created_at": "2026-11-13T08:00:00"
            }
        if "UPDATE public.\"Pedido\"" in sql:
            return {
                "IdPedido": params["id_p"],
                "NumeroPedido": "PED-001",
                "estado_revision_web": params["est"],
                "observacion_revision": params.get("obs")
            }
        if "UPDATE public.\"PagoPedido\"" in sql:
            return {
                "IdPagoPedido": params["id_pago"],
                "IdPedido": 10,
                "Monto": 150.0,
                "estado_revision_web": params["est"],
                "observacion_revision": params.get("obs")
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
            # Si ya existe, actualizar
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
        if "SELECT * FROM public.\"detalle_solicitud_carga_camion\"" in sql:
            return [{"id_detalle": 201, "id_solicitud": params["id_sol"], "id_presentacion": 1, "stock_remanente": 10.0, "stock_adicional_solicitado": 20.0, "stock_adicional_aprobado": 20.0}]
        return []


def test_reordenamiento_compacto_al_quitar_parada():
    """
    Si se quita una parada PENDIENTE (ej. la #4),
    las paradas #5 y #6 pasan a ser #4 y #5 automáticamente sin huecos.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    # Inicializar ruta con 6 paradas
    id_ruta = 1
    mock_caller.paradas_db[id_ruta] = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 101, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 102, "OrdenVisita": 2},
        {"IdRutaPuntoVenta": 3, "IdPuntoVenta": 103, "OrdenVisita": 3},
        {"IdRutaPuntoVenta": 4, "IdPuntoVenta": 104, "OrdenVisita": 4},
        {"IdRutaPuntoVenta": 5, "IdPuntoVenta": 105, "OrdenVisita": 5},
        {"IdRutaPuntoVenta": 6, "IdPuntoVenta": 106, "OrdenVisita": 6},
    ]

    # Quitar parada #4 (IdPuntoVenta = 104)
    dto = QuitarParadaRequest(IdRuta=id_ruta, IdPuntoVenta=104)
    resultado = service.quitar_parada_ruta(dto)

    assert len(resultado) == 5
    ordenes = [p["OrdenVisita"] for p in resultado]
    pvs = [p["IdPuntoVenta"] for p in resultado]

    # Verifica secuencia estricta 1..5 sin huecos
    assert ordenes == [1, 2, 3, 4, 5]
    # 105 y 106 pasaron a ser #4 y #5
    assert pvs == [101, 102, 103, 105, 106]


def test_regla_inquebrantable_parada_operada_hoy_lanza_http_400():
    """
    Regla inquebrantable:
    Si una parada YA tiene entrega o cobro realizado hoy, lanza HTTP 400
    y prohíbe eliminarla o cambiarla de ruta/día hoy.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    mock_caller.operada_hoy = True  # Simula que ya se entregó o cobró hoy
    service.repo.caller = mock_caller

    id_ruta = 1
    mock_caller.paradas_db[id_ruta] = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 101, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 102, "OrdenVisita": 2},
    ]

    # Intento 1: Quitar parada operada hoy -> debe lanzar HTTP 400
    dto_quitar = QuitarParadaRequest(IdRuta=id_ruta, IdPuntoVenta=101)
    with pytest.raises(HTTPException) as exc_info_quitar:
        service.quitar_parada_ruta(dto_quitar)
    assert exc_info_quitar.value.status_code == 400
    assert "Regla inquebrantable" in exc_info_quitar.value.detail
    assert "prohibido eliminarla" in exc_info_quitar.value.detail

    # Intento 2: Mover parada operada hoy a otra ruta -> debe lanzar HTTP 400
    dto_mover = MoverParadaRutaRequest(
        IdPuntoVenta=101, IdRutaOrigen=1, IdRutaDestino=2, PosicionDestino=1
    )
    with pytest.raises(HTTPException) as exc_info_mover:
        service.mover_cliente_de_ruta(dto_mover)
    assert exc_info_mover.value.status_code == 400
    assert "Regla inquebrantable" in exc_info_mover.value.detail
    assert "prohibido moverla" in exc_info_mover.value.detail


def test_agregar_parada_desplaza_orden_en_mas_uno():
    """
    Si se agrega una parada manual en Web o por ENTREGA_INMEDIATA del chofer
    en calle después de la parada #2 (cuando #1 y #2 ya fueron hechas),
    desplaza las paradas con orden >= 3 en +1 y asigna orden = 3 a la nueva parada.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    id_ruta = 1
    # Ruta inicial con 4 paradas: #1, #2, #3, #4
    mock_caller.paradas_db[id_ruta] = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 101, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 102, "OrdenVisita": 2},
        {"IdRutaPuntoVenta": 3, "IdPuntoVenta": 103, "OrdenVisita": 3},
        {"IdRutaPuntoVenta": 4, "IdPuntoVenta": 104, "OrdenVisita": 4},
    ]

    # Insertar nueva parada 999 en posicion 3
    dto = InsertarParadaOrdenRequest(IdRuta=id_ruta, IdPuntoVenta=999, Posicion=3)
    resultado = service.insertar_parada_en_orden(dto)

    assert len(resultado) == 5
    ordenes = [p["OrdenVisita"] for p in resultado]
    pvs = [p["IdPuntoVenta"] for p in resultado]

    assert ordenes == [1, 2, 3, 4, 5]
    # Parada 999 debe ser la #3, y las antiguas #3 y #4 ahora son #4 y #5
    assert pvs == [101, 102, 999, 103, 104]


def test_mover_cliente_a_otra_ruta_recalcula_ambas():
    """
    Permite mover un cliente PENDIENTE a otra ruta del mismo día o de otro día,
    recalculando el orden 1..N tanto en la ruta origen como en la ruta destino.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    # Ruta Origen (id 1): [101, 102, 103]
    mock_caller.paradas_db[1] = [
        {"IdRutaPuntoVenta": 1, "IdPuntoVenta": 101, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 2, "IdPuntoVenta": 102, "OrdenVisita": 2},
        {"IdRutaPuntoVenta": 3, "IdPuntoVenta": 103, "OrdenVisita": 3},
    ]
    # Ruta Destino (id 2): [201, 202]
    mock_caller.paradas_db[2] = [
        {"IdRutaPuntoVenta": 10, "IdPuntoVenta": 201, "OrdenVisita": 1},
        {"IdRutaPuntoVenta": 11, "IdPuntoVenta": 202, "OrdenVisita": 2},
    ]

    # Mover cliente 102 de Ruta 1 a Ruta 2 en la posición 2
    dto = MoverParadaRutaRequest(
        IdPuntoVenta=102, IdRutaOrigen=1, IdRutaDestino=2, PosicionDestino=2
    )
    res = service.mover_cliente_de_ruta(dto)

    # Origen debe quedar con [101, 103] ordenados [1, 2]
    paradas_origen = res["paradas_origen"]
    assert len(paradas_origen) == 2
    assert [p["OrdenVisita"] for p in paradas_origen] == [1, 2]
    assert [p["IdPuntoVenta"] for p in paradas_origen] == [101, 103]

    # Destino debe quedar con [201, 102, 202] ordenados [1, 2, 3]
    paradas_destino = res["paradas_destino"]
    assert len(paradas_destino) == 3
    assert [p["OrdenVisita"] for p in paradas_destino] == [1, 2, 3]
    assert [p["IdPuntoVenta"] for p in paradas_destino] == [201, 102, 202]


def test_generador_rutas_diarias_e_invocacion_en_listar():
    """
    Verifica que ListarAsignaciones ejecute el generador diario de rutas de forma transparente.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    # Invocación directa
    res_gen = service.GenerarRutasDiarias(date(2026, 11, 13))
    assert res_gen["asignaciones_creadas"] == 1

    # Invocación automática al listar asignaciones
    service.ListarAsignaciones(fecha=date(2026, 11, 13))
    # Comprobar que fn_generar_rutas_diarias fue llamada
    consultas_sql = [sql for sql, _ in mock_caller.llamadas]
    assert any("fn_generar_rutas_diarias" in q for q in consultas_sql)


def test_ciclo_solicitud_carga_camion():
    """
    Verifica creación y aprobación de solicitud de carga de camión con stock remanente y adicional.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    # 1. Chofer crea solicitud
    dto_crear = SolicitudCargaCrear(
        id_asignacion=15,
        id_chofer=9,
        observacion="Carga inicial de la mañana",
        items=[
            ItemSolicitudCarga(presentacion_id=1, stock_remanente=5.0, stock_adicional_solicitado=20.0),
            ItemSolicitudCarga(presentacion_id=2, stock_remanente=2.0, stock_adicional_solicitado=10.0),
        ]
    )
    sol = service.CrearSolicitudCarga(dto_crear)
    assert sol["id_solicitud"] == 101
    assert sol["estado"] == "PENDIENTE"

    # Verificar que se actualizó estado operativo de AsignacionRuta a CARGA_SOLICITADA
    consultas = [sql for sql, _ in mock_caller.llamadas]
    assert any("CARGA_SOLICITADA" in q for q in consultas)

    # 2. Supervisor aprueba solicitud
    dto_rev = SolicitudCargaRevision(
        estado="APROBADO",
        observacion="Todo correcto, stock despachado"
    )
    sol_aprobada = service.RevisarSolicitudCarga(101, dto_rev, id_admin=1)
    assert sol_aprobada["estado"] == "APROBADO"


def test_revision_web_auditoria_entrega_y_pago():
    """
    Verifica que el supervisor/contador pueda auditar y marcar como APROBADO u OBSERVADO
    las entregas físicas y los pagos registrados.
    """
    mock_db = MagicMock()
    service = RutaService(mock_db)
    mock_caller = MockDbCaller()
    service.repo.caller = mock_caller

    # Revisar Entrega
    dto_ent = RevisionWebOperacionRequest(EstadoRevisionWeb="APROBADO", ObservacionRevision="Foto comprobante nítida")
    res_ent = service.RevisarEntregaWeb(id_pedido=55, dto=dto_ent, id_admin=1)
    assert res_ent["estado_revision_web"] == "APROBADO"

    # Revisar Pago
    dto_pago = RevisionWebOperacionRequest(EstadoRevisionWeb="OBSERVADO", ObservacionRevision="Falta voucher legible")
    res_pago = service.RevisarPagoWeb(id_pago_pedido=88, dto=dto_pago, id_admin=1)
    assert res_pago["estado_revision_web"] == "OBSERVADO"
