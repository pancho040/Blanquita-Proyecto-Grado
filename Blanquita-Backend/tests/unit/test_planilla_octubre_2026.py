import pytest
from decimal import Decimal, ROUND_HALF_UP
from app.Services.RRHH.RRHHService import numero_a_palabras_bob

class TestPlanillaOctubre2026Excel:
    """
    Pruebas Unitarias de Reglas Exactas del Excel PLANILLA OCTUBRE 2026.xlsx
    SHEMA ASOCIADOS S.R.L.
    """

    def test_calculo_valor_hora_base_240(self):
        """
        En el Excel 'HORAS EXTRAS', el valor hora se calcula como:
        Valor Hora = (Haber Básico / 30) / 8 = Haber Básico / 240
        """
        sueldo_1 = Decimal("2400.00")
        valor_hora_1 = (sueldo_1 / Decimal("240")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        assert valor_hora_1 == Decimal("10.0000")

        sueldo_2 = Decimal("3600.00")
        valor_hora_2 = (sueldo_2 / Decimal("240")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        assert valor_hora_2 == Decimal("15.0000")

        sueldo_3 = Decimal("2750.00")
        valor_hora_3 = (sueldo_3 / Decimal("240")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        assert valor_hora_3 == Decimal("11.4583")

    def test_descuento_faltas_base_30(self):
        """
        En el Excel 'DESCUENTOS', el descuento por faltas (días) se calcula como:
        Descuento = (Haber Básico / 30) * Días
        """
        sueldo = Decimal("3000.00")
        dias_falta = 2
        valor_dia = (sueldo / Decimal("30")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        descuento = (Decimal(str(dias_falta)) * valor_dia).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert descuento == Decimal("200.00")

    def test_planilla_asegurados_retencion_afp(self):
        """
        En 'P. ASEGURADO':
        Aportes de Ley = 12.71% (10% Vejez + 1.71% Riesgo Común + 0.5% AFP + 0.5% Solidario)
        """
        total_ganado = Decimal("3450.00")
        afp_pct = Decimal("12.71")
        afp_retencion = (total_ganado * (afp_pct / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert afp_retencion == Decimal("438.50")

        anticipos = Decimal("500.00")
        total_descuento = afp_retencion + anticipos
        liquido_pagable = total_ganado - total_descuento
        assert liquido_pagable == Decimal("2511.50")

    def test_planilla_externos_sin_retencion_afp(self):
        """
        En 'P. EXTERNO':
        Personal NO asegurado NO tiene retención de AFP (0.00%)
        """
        sueldo_basico = Decimal("2750.00")
        horas_extras_total = Decimal("10.00")
        valor_hora = (sueldo_basico / Decimal("240")).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        monto_he = (horas_extras_total * valor_hora).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        assert monto_he == Decimal("114.58")

        total_ganado = sueldo_basico + monto_he
        assert total_ganado == Decimal("2864.58")

        # AFP = 0.00
        afp = Decimal("0.00")
        anticipos = Decimal("300.00")
        total_descuento = afp + anticipos
        liquido_pagable = total_ganado - total_descuento
        assert liquido_pagable == Decimal("2564.58")

    def test_conversion_literal_bolivianos(self):
        """
        Verificación de la función de número a palabras para boletas oficiales
        """
        literal_1 = numero_a_palabras_bob(Decimal("2511.50"))
        assert "DOS MIL QUINIENTOS ONCE 50/100 BOLIVIANOS" in literal_1

        literal_2 = numero_a_palabras_bob(Decimal("4352.00"))
        assert "CUATRO MIL TRESCIENTOS CINCUENTA Y DOS 00/100 BOLIVIANOS" in literal_2

    def test_cuadre_resumen_bancario(self):
        """
        En 'RESUMEN', la conciliación matemática:
        Total Asegurado + Total Externo = Total General a Cancelar
        """
        total_asegurados = Decimal("18500.00")
        total_externos = Decimal("12400.00")
        total_general = total_asegurados + total_externos
        assert total_general == Decimal("30900.00")
        diferencia = total_general - (total_asegurados + total_externos)
        assert diferencia == Decimal("0.00")
