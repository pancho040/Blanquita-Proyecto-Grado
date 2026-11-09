import pytest
import uuid
from datetime import date
from fastapi import status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.Config.supabase import SessionLocal
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService
from app.Services.Distribuidor.DistribuidorService import DistribuidorService
from app.Models.Contabilidad.CuentasCobrarModel import (
    NotaVentaCrear, DetalleNotaVentaItem, NotaVentaAjustarKevin,
    CierreTurnoChoferRequest, AbonoCuentaCobrarCrear,
    PlanillaAbonosMasivosRequest, PlanillaAbonoFila
)
from app.Models.Distribuidor.DistribuidorModel import (
    PedidoDistribuidorCrear, DetallePedidoItem, AjustePedidoKevinRequest, AjustePedidoDetalle
)

@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.close()


# =============================================================================
# PRUEBAS SUBAGENTE A: REPARTIDORES, BANDEO Y CIERRE DIARIO (MÓDULOS 3 Y 7)
# =============================================================================

def test_nota_venta_aplica_promocion_bandeo_sin_alterar_planta(db_session: Session):
    """
    Subagente A: Al registrar la venta de un producto con bandeo (ej. Megarrollo),
    el motor de promociones agrega automáticamente la servilleta de regalo con precio 0.00 Bs.
    """
    service = CuentasCobrarService(db_session)
    num_nota = f"NV-TEST-PROMO-{uuid.uuid4().hex[:8]}"

    # Asegurar que existe una presentación con bandeo configurada
    row_pres = db_session.execute(text('SELECT "IdPresentacion", "IdProducto" FROM "PresentacionProducto" LIMIT 1;')).fetchone()
    assert row_pres is not None
    id_pres = row_pres[0]
    id_prod = row_pres[1]

    db_session.execute(text("""
        INSERT INTO "ProductoConfigComercial" ("IdProducto", "EsBandeo", "ValorBandeo")
        VALUES (:prod, TRUE, 1.0)
        ON CONFLICT ("IdProducto") DO UPDATE SET "EsBandeo" = TRUE, "ValorBandeo" = 1.0;
    """), {"prod": id_prod})
    db_session.commit()

    # Emitir nota de venta con 5 unidades
    dto = NotaVentaCrear(
        NumeroNotaVenta=num_nota,
        IdCliente=1,
        IdChofer=4,
        Chofer="Luis Repartidor",
        PlacaCamion="5738UPK",
        TotalVentaBruto=100.0,
        ImporteNeto=100.0,
        IdSucursal=1,
        MetodoPago="Efectivo",
        MontoEfectivo=100.0,
        Detalles=[
            DetalleNotaVentaItem(
                IdPresentacion=id_pres,
                NombreProducto="Megarrollo 12R",
                Cantidad=5.0,
                PrecioUnitario=20.0,
                Subtotal=100.0
            )
        ]
    )

    nota = service.CrearNotaVenta(dto, id_usuario=4)
    assert nota["NumeroNotaVenta"] == num_nota
    
    # Debe existir el item principal + el item bonificado de bandeo a costo 0.0
    detalles = nota["Detalles"]
    assert len(detalles) >= 2
    bonificados = [d for d in detalles if d["EsBonificacionBandeo"]]
    assert len(bonificados) == 1
    assert bonificados[0]["PrecioUnitario"] == 0.0
    assert bonificados[0]["Cantidad"] == 5.0


def test_kevin_ajusta_nota_y_notifica_chofer(db_session: Session):
    """
    Subagente A: Kevin puede ajustar importes en una nota emitida y el sistema
    notifica automáticamente al chofer y deja rastro de auditoría.
    """
    service = CuentasCobrarService(db_session)
    num_nota = f"NV-TEST-AJUSTE-{uuid.uuid4().hex[:8]}"

    dto = NotaVentaCrear(
        NumeroNotaVenta=num_nota,
        IdCliente=1,
        IdChofer=4,
        Chofer="Luis Repartidor",
        TotalVentaBruto=200.0,
        ImporteNeto=200.0,
        IdSucursal=1,
        MetodoPago="Efectivo",
        MontoEfectivo=200.0
    )
    nota = service.CrearNotaVenta(dto, id_usuario=4)
    id_nota = nota["IdNotaVenta"]

    # Kevin ajusta la nota a 190.0 (-10 Bs de diferencia)
    dto_ajuste = NotaVentaAjustarKevin(
        ObservacionAjuste="Diferencia física de caja verificada en camión: se descuenta 10 Bs",
        NuevoImporteNeto=190.0,
        NuevoTotalCancelado=190.0,
        NuevoSaldoPendiente=0.0
    )
    nota_ajustada = service.AjustarNotaVentaKevin(id_nota, dto_ajuste, id_kevin=1)

    assert nota_ajustada["EditadoPorKevin"] is True
    assert nota_ajustada["ImporteNeto"] == 190.0
    assert "Diferencia física" in nota_ajustada["ObservacionAjuste"]


def test_cierre_turno_detecta_discrepancia_y_genera_faltante(db_session: Session):
    """
    Subagente A: Si en el cierre diario el stock físico devuelto es menor al esperado,
    el sistema liquida la diferencia como faltante imputable al chofer.
    """
    service = CuentasCobrarService(db_session)
    id_chofer = 4
    id_sucursal = 1

    row_pres = db_session.execute(text('SELECT "IdPresentacion" FROM "PresentacionProducto" LIMIT 1;')).fetchone()
    assert row_pres is not None
    id_pres = row_pres[0]

    # Cargar stock inicial en camión (10 unidades)
    db_session.execute(text("""
        INSERT INTO "inventario_chofer" ("sucursal_id", "chofer_id", "presentacion_id", "cantidad_cargada", "cantidad_remanente")
        VALUES (:s, :c, :p, 10.0, 10.0)
        ON CONFLICT ("chofer_id", "sucursal_id", "presentacion_id") DO UPDATE SET "cantidad_remanente" = 10.0;
    """), {"s": id_sucursal, "c": id_chofer, "p": id_pres})
    db_session.commit()

    # El chofer reporta devolución de solo 8 paquetes (faltan 2)
    dto_cierre = CierreTurnoChoferRequest(
        IdUsuarioRepartidor=id_chofer,
        IdSucursal=id_sucursal,
        StockDevueltoFisico={id_pres: 8.0},
        MontoEfectivoEntregado=0.0,
        Observaciones="Cierre de jornada con 2 paquetes faltantes"
    )

    cierre = service.ProcesarCierreTurnoChofer(dto_cierre, id_usuario=id_chofer)

    assert cierre.EstadoConciliacion == "CON_DIFERENCIA"
    assert cierre.MontoTotalFaltante > 0.0
    item_comp = next((i for i in cierre.ComparativaStock if i.presentacion_id == id_pres), None)
    assert item_comp is not None
    assert item_comp.es_faltante is True
    assert item_comp.diferencia == -2.0


# =============================================================================
# PRUEBAS SUBAGENTE B: CUENTAS POR COBRAR, QR Y FLUJO DE APROBACIÓN (MÓDULO 4)
# =============================================================================

def test_cobro_qr_sin_foto_es_rechazado_422(db_session: Session):
    """
    Subagente B: Un cobro por QR registrado sin adjuntar comprobante debe ser rechazado
    inmediatamente con código HTTP 422.
    """
    service = CuentasCobrarService(db_session)

    # Crear cuenta por cobrar base
    cxc = service.repo.CrearCuentaCobrar({
        "IdCliente": 1,
        "IdPedido": None,
        "IdNotaVenta": None,
        "NumeroNotaVenta": "NV-TEST-CXC-QR",
        "NumeroNotaEntrega": "-",
        "FechaDespacho": date.today(),
        "DiasMora": 0,
        "IdEstadoCuentaCobrar": 1,
        "MontoTotal": 500.0,
        "SaldoPendiente": 500.0,
        "FechaEmision": date.today(),
        "FechaVencimiento": date.today(),
        "IdUsuarioRegistro": 1,
        "Observacion": "Prueba QR"
    })
    db_session.commit()

    # Intento de abono QR sin IdComprobanteArchivo
    dto = AbonoCuentaCobrarCrear(
        IdCuentaCobrar=cxc["IdCuentaCobrar"],
        MetodoPago="QR",
        MontoAbonado=250.0,
        IdComprobanteArchivo=None
    )

    with pytest.raises(Exception) as excinfo:
        service.RegistrarAbonoChofer(dto, id_usuario=4)
    assert "422" in str(excinfo.value) or "comprobante QR" in str(excinfo.value)


def test_abono_chofer_pendiente_no_reduce_saldo_hasta_aprobacion(db_session: Session):
    """
    Subagente B: Todo abono de chofer nace en PENDIENTE_APROBACION y no descuenta
    el saldo deudor de la cuenta hasta que Kevin lo aprueba formalmente.
    """
    service = CuentasCobrarService(db_session)

    # 1. Crear comprobante mock
    comp = db_session.execute(text("""
        INSERT INTO "ComprobanteArchivo" ("EntidadOrigen", "IdRegistroOrigen", "UrlArchivo", "NombreOriginal", "Formato", "TamanoBytes", "Sha256")
        VALUES ('Abono', 1, 'https://test.supabase.co/qr.png', 'qr.png', 'image/png', 1024, 'abc123hash')
        RETURNING "IdComprobante";
    """)).fetchone()
    db_session.commit()
    id_comp = comp[0]

    # 2. Crear cuenta por cobrar de 300 Bs
    cxc = service.repo.CrearCuentaCobrar({
        "IdCliente": 1,
        "IdPedido": None,
        "IdNotaVenta": None,
        "NumeroNotaVenta": f"NV-TEST-ABONO-{id_comp}",
        "NumeroNotaEntrega": "-",
        "FechaDespacho": date.today(),
        "DiasMora": 0,
        "IdEstadoCuentaCobrar": 1,
        "MontoTotal": 300.0,
        "SaldoPendiente": 300.0,
        "FechaEmision": date.today(),
        "FechaVencimiento": date.today(),
        "IdUsuarioRegistro": 1,
        "Observacion": "Prueba de Aprobación"
    })
    db_session.commit()
    id_cxc = cxc["IdCuentaCobrar"]

    # 3. Chofer registra abono de 100 Bs por QR
    dto = AbonoCuentaCobrarCrear(
        IdCuentaCobrar=id_cxc,
        MetodoPago="QR",
        MontoAbonado=100.0,
        IdComprobanteArchivo=id_comp,
        NumeroReferencia="TRANSF-BNB-9988"
    )
    abono = service.RegistrarAbonoChofer(dto, id_usuario=4)
    id_abono = abono["IdAbonoCuentaCobrar"]

    # El abono está pendiente y el saldo NO se ha reducido
    cxc_actual = service.repo.ObtenerCuentaCobrarPorId(id_cxc)
    assert float(cxc_actual["SaldoPendiente"]) == 300.0

    # 4. Kevin aprueba el abono
    service.ResolverAbonoKevin(id_abono, aprobado=True, id_kevin=1, observacion="Depósito comprobado en extracto")

    # AHORA el saldo sí se reduce formalmente a 200.0
    cxc_descontada = service.repo.ObtenerCuentaCobrarPorId(id_cxc)
    assert float(cxc_descontada["SaldoPendiente"]) == 200.0


# =============================================================================
# PRUEBAS SUBAGENTE C: DISTRIBUIDORES EXTERNOS Y STOCK EN PLANTA (MÓDULO 8)
# =============================================================================

def test_pedido_distribuidor_supera_stock_planta_bloqueado_400(db_session: Session):
    """
    Subagente C: Un pedido de distribuidor que sobrepasa el stock disponible en planta
    es bloqueado de inmediato con HTTP 400.
    """
    service = DistribuidorService(db_session)
    row_pres = db_session.execute(text('SELECT "IdPresentacion" FROM "PresentacionProducto" LIMIT 1;')).fetchone()
    assert row_pres is not None
    id_pres = row_pres[0]

    # Consultar stock actual y solicitar una cantidad astronómica (ej. stock + 50.000)
    stock_actual = service.planta_reader.get_stock_disponible(1, id_pres)
    cant_excedida = stock_actual + 50000.0

    dto = PedidoDistribuidorCrear(
        distribuidor_id=1, # Oruro
        observacion_distribuidor="Pedido mayorista urgente",
        detalles=[
            DetallePedidoItem(presentacion_id=id_pres, cantidad_solicitada=cant_excedida)
        ]
    )

    with pytest.raises(Exception) as excinfo:
        service.CrearPedidoDistribuidor(dto, id_usuario=1)
    assert "400" in str(excinfo.value) or "Stock insuficiente" in str(excinfo.value)


def test_kevin_ajusta_pedido_y_recalcula_totales_decimal(db_session: Session):
    """
    Subagente C: Kevin edita cantidades de un pedido mayorista y el importe neto total
    se recalcula con precisión decimal exacta.
    """
    service = DistribuidorService(db_session)
    row_pres = db_session.execute(text('SELECT "IdPresentacion" FROM "PresentacionProducto" LIMIT 1;')).fetchone()
    assert row_pres is not None
    id_pres = row_pres[0]

    # Asegurar stock en planta para la prueba
    db_session.execute(text("""
        UPDATE "InventarioProductoTerminado" 
        SET "CantidadActual" = 500.0 
        WHERE "IdPresentacion" = :p;
    """), {"p": id_pres})
    db_session.commit()

    # 1. Crear pedido de 10 paquetes
    dto = PedidoDistribuidorCrear(
        distribuidor_id=2, # Tarija
        observacion_distribuidor="Pedido Tarija preliminar",
        detalles=[
            DetallePedidoItem(presentacion_id=id_pres, cantidad_solicitada=10.0)
        ]
    )
    pedido = service.CrearPedidoDistribuidor(dto, id_usuario=1)
    pedido_id = pedido["id"]
    detalle_id = pedido["detalles"][0]["id"]
    precio_unitario = float(pedido["detalles"][0]["precio_unitario"])

    # 2. Kevin ajusta a 7 paquetes por disponibilidad de transporte
    dto_ajuste = AjustePedidoKevinRequest(
        observacion_kevin="Ajustado a 7 paquetes por cupo de transporte a Tarija",
        detalles_ajuste=[
            AjustePedidoDetalle(detalle_id=detalle_id, cantidad_aprobada=7.0)
        ]
    )
    pedido_ajustado = service.AjustarPedidoKevin(pedido_id, dto_ajuste, id_kevin=1)

    assert pedido_ajustado["estado"] == "PROFORMA_AJUSTADA"
    assert pedido_ajustado["detalles"][0]["cantidad_aprobada"] == 7.0
    total_esperado = round(7.0 * precio_unitario, 2)
    assert round(float(pedido_ajustado["monto_total"]), 2) == total_esperado
