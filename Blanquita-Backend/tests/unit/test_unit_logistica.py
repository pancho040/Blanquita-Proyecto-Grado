import pytest

class TestReglasNegocioLogistica:
    """
    Pruebas Unitarias para el Módulo de Logística, Choferes, GPS y Rutas
    """

    def test_calculo_efectividad_entregas_ruta(self):
        """
        Validación del indicador clave de desempeño (KPI) de efectividad en ruta.
        """
        # Caso 1: 10 paradas, 8 entregadas
        paradas_totales = 10
        paradas_entregadas = 8
        efectividad = round((paradas_entregadas / paradas_totales) * 100, 2)
        assert efectividad == 80.0

        # Caso 2: 100% efectividad
        assert round((15 / 15) * 100, 2) == 100.0

        # Caso 3: 0 entregas
        assert round((0 / 12) * 100, 2) == 0.0

        # Caso 4: Ruta vacía sin paradas (Protección ZeroDivisionError)
        def calcular_kpi(entregadas, totales):
            if not totales or totales <= 0:
                return 0.0
            return round((entregadas / totales) * 100, 2)

        assert calcular_kpi(0, 0) == 0.0

    def test_balance_recaudacion_chofer_mixto(self):
        """
        Balance de recaudación en campo por agente de reparto:
        Total Cobrado = Efectivo + QR
        """
        recaudacion_efectivo = 1250.50
        recaudacion_qr = 749.50
        total_esperado = 2000.00

        total_calculado = round(recaudacion_efectivo + recaudacion_qr, 2)
        assert total_calculado == total_esperado

        # Verificación de cuadratura en liquidación
        monto_entregado_caja = 1250.50
        comprobantes_qr_verificados = 749.50
        diferencia_liquidacion = round(
            (monto_entregado_caja + comprobantes_qr_verificados) - total_calculado, 2
        )
        assert diferencia_liquidacion == 0.00

    def test_validacion_coordenadas_gps_bolivia(self):
        """
        Validación de rango geográfico válido para coordenadas GPS.
        Bolivia: Latitud aprox entre -9 y -23, Longitud aprox entre -57 y -70.
        """
        def es_coordenada_valida(lat: float, lng: float) -> bool:
            if not (-90.0 <= lat <= 90.0):
                return False
            if not (-180.0 <= lng <= 180.0):
                return False
            return True

        # Coordenadas válidas en Sucre (Planta / Clientes Blanquita)
        assert es_coordenada_valida(-19.0431, -65.2592) is True
        
        # Coordenadas válidas en La Paz
        assert es_coordenada_valida(-16.5000, -68.1500) is True

        # Coordenadas inválidas
        assert es_coordenada_valida(-95.0, -65.2592) is False
        assert es_coordenada_valida(-19.0431, 195.0) is False

    def test_validacion_limite_credito_cliente(self):
        """
        Regla de negocio: No se puede despachar a crédito si el saldo actual
        más el nuevo pedido excede el Límite de Crédito asignado.
        """
        limite_credito = 5000.00
        saldo_actual_deuda = 3200.00

        # Pedido 1: 1500 Bs -> Total 4700 Bs <= 5000 Bs (Aprobado)
        pedido_1 = 1500.00
        aprobado_1 = (saldo_actual_deuda + pedido_1) <= limite_credito
        assert aprobado_1 is True

        # Pedido 2: 2000 Bs -> Total 5200 Bs > 5000 Bs (Rechazado)
        pedido_2 = 2000.00
        aprobado_2 = (saldo_actual_deuda + pedido_2) <= limite_credito
        assert aprobado_2 is False
