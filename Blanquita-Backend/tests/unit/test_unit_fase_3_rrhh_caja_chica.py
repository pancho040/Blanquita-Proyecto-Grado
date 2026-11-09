import pytest
from datetime import date
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.Config.supabase import SessionLocal
from app.Services.RRHH.RRHHService import RRHHService
from app.Services.Contabilidad.TesoreriaService import TesoreriaService
from app.Models.RRHH.RRHHModel import (
    FiniquitoCalcularRequest, RegistrarNoVentaRequest, PlanillaGenerarRequest
)
from app.Models.Contabilidad.TesoreriaModel import (
    SolicitudCajaChicaCrear, EntregaFondosCajaChicaRequest,
    RendicionGastoCajaChicaRequest, DetalleGastoItem,
    ResolverAprobacionGerenciaRequest
)

@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.close()


# =============================================================================
# PRUEBAS SUBAGENTE D: PERSONAL, PLANILLAS DUALES, FINIQUITOS Y NO VENTA (MÓDULO 2)
# =============================================================================

from decimal import Decimal, ROUND_HALF_UP

def test_tc_rrhh_01_valor_hora_laboral():
    """TC-RRHH-01: Valor hora (sueldo / 30 / 8 = 13.75) y cálculo de horas a favor."""
    sueldo_basico = Decimal("3300.00")
    # Fórmula: sueldo / 240
    valor_hora = (sueldo_basico / Decimal("240")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    assert valor_hora == Decimal("13.7500")

    # 1.5 horas adicionales
    horas = Decimal("1.5")
    monto_horas = (horas * valor_hora).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert monto_horas == Decimal("20.63")


def test_tc_rrhh_02_descuento_faltas_30_dias():
    """TC-RRHH-02: Descuento de 7 días faltados sobre sueldo base de 3.000 Bs da 2.300 Bs."""
    sueldo_basico = Decimal("3000.00")
    dias_faltados = 7
    dias_computables = 30 - dias_faltados
    assert dias_computables == 23

    valor_dia = sueldo_basico / Decimal("30")
    pago_base = (valor_dia * Decimal(str(dias_computables))).quantize(Decimal("0.01"))
    assert pago_base == Decimal("2300.00")


def test_tc_rrhh_03_deduccion_compartida_no_venta(db_session: Session):
    """TC-RRHH-03: Descuento de 1.185 Bs de No Venta dividido entre 2 vendedores (592.50 Bs cada uno)."""
    service = RRHHService(db_session)
    dto = RegistrarNoVentaRequest(
        Concepto="Cliente no habido ruta este deja saldo impago",
        MontoTotal=Decimal("1185.00"),
        ResponsablesIds=[1, 4], # 2 empleados
        FechaIncidente=date(2026, 10, 15),
        IdSucursal=1
    )

    res = service.RegistrarNoVenta(dto)
    assert res["NumResponsables"] == 2
    assert res["CuotaIndividual"] == Decimal("592.50")
    assert len(res["Detalles"]) == 2
    for det in res["Detalles"]:
        assert det["CuotaDescuento"] == Decimal("592.50")
        assert det["Aplicado"] is False


def test_tc_rrhh_04_finiquito_fechas_calendario_exactas(db_session: Session):
    """TC-RRHH-04: Finiquito con ingreso 18/11/2025 y retiro 30/10/2026 arroja 0 años, 11 meses y 12 días con indemnización de 3.230 Bs."""
    service = RRHHService(db_session)
    f_ingreso = date(2025, 11, 18)
    f_retiro = date(2026, 10, 30)

    # 1. Antigüedad calendario
    anios, meses, dias = service.calcular_antiguedad_calendario(f_ingreso, f_retiro)
    assert anios == 0
    assert meses == 11
    assert dias == 12

    # 2. Configurar temporalmente fecha de ingreso del empleado 1
    service.repository.ActualizarEmpleado(1, {}, {"FechaIngreso": f_ingreso, "SueldoBasico": Decimal("3400.00")})

    dto = FiniquitoCalcularRequest(
        IdUsuario=1,
        FechaRetiro=f_retiro,
        MotivoRetiro="Retiro Voluntario",
        Sueldo1=Decimal("3400.00"),
        Sueldo2=Decimal("3400.00"),
        Sueldo3=Decimal("3400.00"),
        IncluirAguinaldoDuodecimas=False, # Evaluar solo la indemnización legal pura
        IncluirVacacionDuodecimas=False,
        Deducciones=Decimal("0.00")
    )

    fin = service.CalcularYRegistrarFiniquito(dto)
    assert fin["Anios"] == 0
    assert fin["Meses"] == 11
    assert fin["Dias"] == 12
    assert Decimal(str(fin["SueldoPromedio"])) == Decimal("3400.00")
    assert Decimal(str(fin["MontoIndemnizacion"])) == Decimal("3230.00")
    assert Decimal(str(fin["MontoTotal"])) == Decimal("3230.00")


def test_tc_rrhh_05_finiquito_rechaza_antiguedad_menor_a_3_meses(db_session: Session):
    """Elegibilidad legal: Antigüedad menor a 90 días (3 meses) es rechazada con HTTP 400."""
    service = RRHHService(db_session)
    f_ingreso = date(2026, 8, 1)
    f_retiro = date(2026, 9, 15) # 45 días

    service.repository.ActualizarEmpleado(1, {}, {"FechaIngreso": f_ingreso})

    dto = FiniquitoCalcularRequest(
        IdUsuario=1,
        FechaRetiro=f_retiro,
        MotivoRetiro="Retiro Voluntario"
    )

    with pytest.raises(HTTPException) as exc_info:
        service.CalcularYRegistrarFiniquito(dto)
    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert "3 meses" in exc_info.value.detail or "90 días" in exc_info.value.detail


def test_tc_rrhh_06_planilla_dual_oficial_vs_interna(db_session: Session):
    """Test: Planilla Oficial solo incluye personal asegurado y descuenta Gestora (12.71%)."""
    service = RRHHService(db_session)
    # Crear periodo para prueba si no existe
    per = service.CrearPeriodo(mes=11, anio=2026, fecha_inicio=date(2026, 11, 1), fecha_fin=date(2026, 11, 30))
    id_per = per["IdPeriodoNomina"]

    # Generar planilla oficial
    pl_oficial = service.GenerarPlanilla(id_periodo=id_per, id_usuario_genera=1, tipo_planilla="OFICIAL")
    assert pl_oficial["TipoPlanilla"] == "OFICIAL"
    for det in pl_oficial["Detalles"]:
        assert det["EsAsegurado"] is True
        # En la oficial no hay horas extras ni penalizaciones de No Venta
        assert Decimal(str(det["MontoHorasExtra"])) == Decimal("0.00")
        assert Decimal(str(det["DescuentoNoVenta"])) == Decimal("0.00")
        # El aporte AFP es exactamente el 12.71% del TotalGanado
        sueldo = Decimal(str(det["SueldoBasico"]))
        afp_esperado = (sueldo * Decimal("0.1271")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert Decimal(str(det["AporteAFP"])) == afp_esperado


# =============================================================================
# PRUEBAS SUBAGENTE E: CAJA CHICA, CICLO OPERATIVO Y APROBACIÓN GERENCIAL (MÓDULO 5)
# =============================================================================

def test_tc_tes_01_flujo_caja_chica_entrega_reintegro_y_egreso_caja(db_session: Session):
    """TC-TES-01: Entrega de 700 Bs y gasto de 600 Bs genera reintegro de 100 Bs y egreso en caja de 600 Bs."""
    service = TesoreriaService(db_session)

    # 1. Crear solicitud inicial (PENDIENTE)
    dto_crear = SolicitudCajaChicaCrear(
        solicitante="Kevin Poveda",
        departamento="Contabilidad",
        monto_solicitado=700.0,
        justificacion="Compra menor de repuestos para máquina rebobinadora",
        IdSucursal=1
    )
    sol = service.CrearSolicitudCajaChica(dto_crear)
    id_sol = sol["IdSolicitudCajaChica"]
    assert sol["Estado"] == "PENDIENTE"
    assert sol["AprobacionGerencia"] == "PENDIENTE"

    # 2. Entregar fondos (ENTREGADO con 700 Bs)
    dto_entrega = EntregaFondosCajaChicaRequest(
        monto_entregado=700.0,
        entregado_por="Don Osvaldo - Gerencia"
    )
    sol_entregada = service.EntregarFondosCajaChica(id_sol, dto_entrega)
    assert sol_entregada["Estado"] == "ENTREGADO"
    assert float(sol_entregada["MontoEntregado"]) == 700.0

    # 3. Rendición de cuentas con comprobante (600 Bs de gasto real)
    dto_rendicion = RendicionGastoCajaChicaRequest(
        Items=[
            DetalleGastoItem(Concepto="Correa dentada de repuesto", NroFactura="F-1029", Proveedor="Ferretería Industrial", Monto=450.0),
            DetalleGastoItem(Concepto="Aceite lubricante sintético", NroFactura="F-8821", Proveedor="Lubricentro Sucre", Monto=150.0)
        ],
        IdComprobanteArchivo=1, # Comprobante existente
        RespaldoDoc="Facturas combinadas repuestos rebobinadora"
    )
    sol_rendida = service.RendirGastoCajaChica(id_sol, dto_rendicion)
    assert sol_rendida["Estado"] == "RENDIDO"
    assert float(sol_rendida["MontoGastoReal"]) == 600.0
    # Cálculo automático de reintegro: 700 - 600 = 100 Bs
    assert float(sol_rendida["MontoReintegro"]) == 100.0
    assert sol_rendida["AprobacionGerencia"] == "PENDIENTE"

    # 4. Aprobación gerencial por Don Osvaldo -> genera egreso de 600 Bs en caja
    dto_aprobacion = ResolverAprobacionGerenciaRequest(
        Aprobado=True,
        Observaciones="Gasto operativo debidamente respaldado por Kevin"
    )
    sol_aprobada = service.ResolverAprobacionGerencia(id_sol, dto_aprobacion, id_gerente=1)
    assert sol_aprobada["AprobacionGerencia"] == "APROBADO"
    assert sol_aprobada["IdMovimientoCaja"] is not None

    # Verificar que el movimiento registrado en caja es por los 600 Bs netos reales
    mov = service.repo.ObtenerMovimientoCajaPorId(sol_aprobada["IdMovimientoCaja"])
    assert float(mov["Monto"]) == 600.0


def test_tc_tes_02_bloqueo_impresion_si_gerencia_no_ha_aprobado(db_session: Session):
    """Test: Intento de imprimir o descargar vale con AprobacionGerencia != 'APROBADO' retorna error 403."""
    service = TesoreriaService(db_session)

    # Crear solicitud que queda pendiente de gerencia
    dto_crear = SolicitudCajaChicaCrear(
        solicitante="Kevin Poveda",
        departamento="Contabilidad",
        monto_solicitado=300.0,
        justificacion="Útiles de oficina y papelería",
        IdSucursal=1
    )
    sol = service.CrearSolicitudCajaChica(dto_crear)
    id_sol = sol["IdSolicitudCajaChica"]

    with pytest.raises(HTTPException) as exc_info:
        service.ValidarImpresionVale(id_sol)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "aprobación de Gerencia" in exc_info.value.detail
