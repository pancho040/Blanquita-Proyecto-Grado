import pytest

class TestReglasNegocioRRHH:
    """
    Pruebas Unitarias para el Módulo de Recursos Humanos, Asistencia y Planillas
    """

    def test_calculo_aportes_laborales_ley_bolivia(self):
        """
        Deducciones de Ley del Trabajador en Bolivia:
        - Cuenta Individual Jubilación: 10.00%
        - Riesgo Común: 1.71%
        - Comisión Administradora de Fondos de Pensiones: 0.50%
        - Aporte Solidario del Asegurado: 0.50%
        Total Aportes Laborales = 12.71%
        """
        sueldo_base = 4000.00
        porcentaje_afp = 0.1271

        deduccion_ley = round(sueldo_base * porcentaje_afp, 2)
        assert deduccion_ley == 508.40

        # Sueldo Mínimo Nacional referencial
        sueldo_minimo = 2500.00
        deduccion_minimo = round(sueldo_minimo * porcentaje_afp, 2)
        assert deduccion_minimo == 317.75

    def test_calculo_horas_extraordinarias(self):
        """
        Fórmula Legal:
        Valor Hora Normal = Sueldo Básico / 240 (o 30 días x 8 hrs)
        Valor Hora Extra = Valor Hora Normal * 2.0 (Recargo del 100%)
        """
        sueldo_basico = 4800.00
        horas_mes_base = 240.0
        valor_hora_normal = round(sueldo_basico / horas_mes_base, 2)
        assert valor_hora_normal == 20.00

        horas_extras_trabajadas = 12.5
        monto_horas_extras = round(horas_extras_trabajadas * (valor_hora_normal * 2), 2)
        assert monto_horas_extras == 500.00

    def test_descuento_atrasos_con_tolerancia(self):
        """
        Política laboral:
        - Tolerancia de ingreso: 10 minutos al día.
        - Si el atraso <= 10 min: Sin descuento.
        - Si el atraso > 10 min: Descuento por minutos excedentes o escala formal.
        """
        tolerancia_min = 10
        valor_minuto_trabajo = 0.50  # 30 Bs / hr

        def calcular_descuento_atraso(minutos_atraso: int) -> float:
            if minutos_atraso <= tolerancia_min:
                return 0.0
            minutos_sancionables = minutos_atraso - tolerancia_min
            return round(minutos_sancionables * valor_minuto_trabajo, 2)

        # 8 minutos -> Dentro de tolerancia
        assert calcular_descuento_atraso(8) == 0.0

        # 10 minutos -> En el límite
        assert calcular_descuento_atraso(10) == 0.0

        # 25 minutos -> 15 minutos sancionables
        assert calcular_descuento_atraso(25) == 7.50

        # 60 minutos -> 50 minutos sancionables
        assert calcular_descuento_atraso(60) == 25.00

    def test_formula_liquido_pagable(self):
        """
        Líquido Pagable = Total Ganado - Total Descuentos
        Donde:
        Total Ganado = Sueldo Básico + Horas Extras + Bonos
        Total Descuentos = Aportes Ley (12.71%) + Anticipos + Sanciones
        """
        sueldo_basico = 5000.00
        horas_extras = 400.00
        bono_antiguedad = 250.00
        total_ganado = sueldo_basico + horas_extras + bono_antiguedad
        assert total_ganado == 5650.00

        aporte_afp = round(total_ganado * 0.1271, 2)
        anticipos = 800.00
        descuento_atrasos = 50.00
        total_descuentos = round(aporte_afp + anticipos + descuento_atrasos, 2)

        liquido_pagable = round(total_ganado - total_descuentos, 2)
        assert aporte_afp == 718.11
        assert total_descuentos == 1568.11
        assert liquido_pagable == 4081.89
        assert liquido_pagable > 0
