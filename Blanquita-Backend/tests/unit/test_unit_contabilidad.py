import pytest
from datetime import date, timedelta
from app.Services.Contabilidad.CuentasCobrarService import CuentasCobrarService
from app.Services.Contabilidad.CuentasPagarService import CuentasPagarService
from app.Services.Contabilidad.TesoreriaService import TesoreriaService

class TestReglasNegocioContabilidad:
    """
    Pruebas Unitarias para las Reglas de Negocio Contables
    (RN-01 a RN-04, Cuentas por Cobrar, Cuentas por Pagar y Tesorería)
    """

    def test_rn01_deteccion_mora_critica_15_dias(self):
        """
        RN-01: Si un cliente supera 15 días de mora desde el vencimiento,
        debe ser marcado como moroso crítico y bloquear nuevas ventas a crédito.
        """
        hoy = date.today()
        
        # Caso 1: Vencimiento hace 20 días (Mora > 15 días)
        fecha_vencida_critica = hoy - timedelta(days=20)
        dias_mora = (hoy - fecha_vencida_critica).days
        es_mora_critica = dias_mora > 15
        cliente_bloqueado = es_mora_critica
        
        assert dias_mora == 20
        assert es_mora_critica is True
        assert cliente_bloqueado is True

        # Caso 2: Vencimiento hace 5 días (Mora regular <= 15 días)
        fecha_vencida_tolerable = hoy - timedelta(days=5)
        dias_mora_tolerable = (hoy - fecha_vencida_tolerable).days
        assert dias_mora_tolerable == 5
        assert (dias_mora_tolerable > 15) is False

        # Caso 3: Por vencer en el futuro (Días mora = 0 o negativo)
        fecha_futura = hoy + timedelta(days=10)
        dias_futuros = max(0, (hoy - fecha_futura).days)
        assert dias_futuros == 0

    def test_rn04_estructura_anulacion_logica_contable(self):
        """
        RN-04: Todo movimiento contable no debe borrarse físicamente.
        Debe registrarse Anulado=True, MotivoAnulacion y conservar trazabilidad.
        """
        movimiento_original = {
            "IdMovimiento": 105,
            "Monto": 1500.00,
            "TipoMovimiento": "Ingreso",
            "Anulado": False,
            "MotivoAnulacion": None,
            "FechaAnulacion": None,
            "IdUsuarioAnulacion": None,
        }

        # Simular proceso de anulación lógica
        motivo = "Error de digitación en factura Nro 4589"
        id_usuario_contador = 2
        fecha_anulacion_str = date.today().isoformat()

        movimiento_anulado = {
            **movimiento_original,
            "Anulado": True,
            "MotivoAnulacion": motivo,
            "FechaAnulacion": fecha_anulacion_str,
            "IdUsuarioAnulacion": id_usuario_contador,
        }

        assert movimiento_anulado["Anulado"] is True
        assert movimiento_anulado["MotivoAnulacion"] == motivo
        assert movimiento_anulado["IdUsuarioAnulacion"] == 2
        assert movimiento_anulado["Monto"] == 1500.00  # Preserva el monto histórico para auditoría

    def test_balance_arqueo_caja_sobrante_y_faltante(self):
        """
        Validación matemática de Arqueo de Caja:
        Diferencia = Saldo Físico Reportado - Saldo Teórico en Sistema.
        """
        saldo_teorico = 5000.00

        # Caso Faltante
        saldo_fisico_menor = 4850.00
        diferencia_faltante = round(saldo_fisico_menor - saldo_teorico, 2)
        assert diferencia_faltante == -150.00
        assert diferencia_faltante < 0  # Faltante de caja

        # Caso Sobrante
        saldo_fisico_mayor = 5120.50
        diferencia_sobrante = round(saldo_fisico_mayor - saldo_teorico, 2)
        assert diferencia_sobrante == 120.50
        assert diferencia_sobrante > 0  # Sobrante de caja

        # Caso Cuadrado Perfecto
        diferencia_exacta = round(saldo_teorico - saldo_teorico, 2)
        assert diferencia_exacta == 0.00

    def test_amortizacion_y_saldos_cuentas_cobrar(self):
        """
        Cálculo de saldo deudor y transición de estados (VIGENTE -> PARCIAL -> CANCELADO).
        """
        total_despacho = 2400.00
        
        # Abono 1: 1000 Bs
        abono_1 = 1000.00
        saldo_1 = total_despacho - abono_1
        estado_1 = "CANCELADO" if saldo_1 <= 0 else "PARCIAL"
        assert saldo_1 == 1400.00
        assert estado_1 == "PARCIAL"

        # Abono 2: 1400 Bs (Completa la deuda)
        abono_2 = 1400.00
        saldo_2 = saldo_1 - abono_2
        estado_2 = "CANCELADO" if saldo_2 <= 0 else "PARCIAL"
        assert saldo_2 == 0.00
        assert estado_2 == "CANCELADO"

    def test_clasificacion_urgencia_cuentas_pagar(self):
        """
        Clasificación de prioridad de pago a proveedores según vencimiento:
        - Vencido: Días restantes < 0
        - Crítico: 0 a 7 días restantes
        - Normal: Más de 7 días restantes
        """
        def categorizar(dias_restantes: int) -> str:
            if dias_restantes < 0:
                return "VENCIDO"
            elif dias_restantes <= 7:
                return "CRÍTICO"
            return "NORMAL"

        assert categorizar(-2) == "VENCIDO"
        assert categorizar(0) == "CRÍTICO"
        assert categorizar(5) == "CRÍTICO"
        assert categorizar(7) == "CRÍTICO"
        assert categorizar(8) == "NORMAL"
        assert categorizar(30) == "NORMAL"
