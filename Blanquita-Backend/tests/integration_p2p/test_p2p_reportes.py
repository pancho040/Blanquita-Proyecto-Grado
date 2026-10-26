import pytest
from datetime import date
from fastapi import status

class TestP2PReportesCentrosAnalisis:
    """
    Pruebas de Integración Peer-to-Peer para los 9 Endpoints de Reportes y Análisis
    """

    def test_reporte_flujo_caja_contabilidad(self, client_contador):
        """
        Reporte 1: Flujo de Caja y Tesorería
        """
        res = client_contador.get("/reportes/contabilidad/flujo-caja")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        assert isinstance(body["data"], list)
        m = body["metricas"]
        assert "total_ingresos_bs" in m
        assert "total_egresos_bs" in m
        assert "saldo_neto_bs" in m

    def test_reporte_cuentas_cobrar_contabilidad(self, client_contador):
        """
        Reporte 2: Cuentas por Cobrar y Análisis de Mora
        """
        res = client_contador.get("/reportes/contabilidad/cuentas-cobrar")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "total_cartera_bs" in m
        assert "total_pendiente_bs" in m

    def test_reporte_cuentas_pagar_contabilidad(self, client_contador):
        """
        Reporte 3: Cuentas por Pagar a Proveedores
        """
        res = client_contador.get("/reportes/contabilidad/cuentas-pagar")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "deuda_total_acumulada_bs" in m

    def test_reporte_notas_venta_contabilidad(self, client_contador):
        """
        Reporte 4: Notas de Venta y Despachos Valorizados
        """
        res = client_contador.get("/reportes/contabilidad/notas-venta")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "total_neto_bs" in m

    def test_reporte_desempeno_rutas_logistica(self, client_supervisor):
        """
        Reporte 5: Desempeño y Efectividad de Rutas de Entrega
        """
        res = client_supervisor.get("/reportes/logistica/desempeno-rutas")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "total_rutas_ejecutadas" in m
        assert "efectividad_promedio" in m
        assert "total_recaudado_global_bs" in m

    def test_reporte_cobertura_clientes_gps_logistica(self, client_supervisor):
        """
        Reporte 6: Cobertura Geográfica y Georreferenciación GPS
        """
        res = client_supervisor.get("/reportes/logistica/cobertura-clientes")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "total_clientes" in m
        assert "clientes_con_gps" in m
        assert "total_puntos_venta" in m

    def test_reporte_asistencia_rrhh(self, client_admin):
        """
        Reporte 7: Asistencia y Puntualidad Biométrica
        """
        res = client_admin.get("/reportes/rrhh/asistencia-puntualidad")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "total_registros" in m
        assert "total_minutos_atraso" in m

    def test_reporte_planillas_rrhh(self, client_admin):
        """
        Reporte 8: Planillas Salariales y Nómina Histórica
        """
        res = client_admin.get("/reportes/rrhh/nomina-historica?mes=10&anio=2026")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "total_bruto_acumulado_bs" in m
        assert "total_liquido_pagable_bs" in m

    def test_reporte_auditoria_seguridad(self, client_admin):
        """
        Reporte 9: Auditoría, Seguridad y Trazabilidad Transaccional
        """
        res = client_admin.get("/reportes/auditoria/actividad-seguridad")
        assert res.status_code == status.HTTP_200_OK
        body = res.json()
        assert "metricas" in body
        assert "data" in body
        m = body["metricas"]
        assert "total_eventos_auditados" in m
        assert "eventos_criticos_financieros" in m

    def test_chofer_rechazado_en_reportes_financieros(self, client_chofer):
        """
        Seguridad de Roles: Un chofer no tiene permiso para consultar reportes financieros.
        """
        res = client_chofer.get("/reportes/contabilidad/flujo-caja")
        assert res.status_code == status.HTTP_403_FORBIDDEN
