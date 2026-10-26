import pytest
from datetime import date
from fastapi import status

class TestP2PRRHHAsistenciaNomina:
    """
    Pruebas de Integración Peer-to-Peer para el Módulo de Recursos Humanos y Planillas
    """

    def test_consulta_empleados_admin(self, client_admin):
        """
        El Administrador puede consultar la lista de empleados activos.
        """
        res = client_admin.get("/rrhh/empleados")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert isinstance(data, list)

    def test_chofer_denegado_acceso_planillas_rrhh(self, client_chofer):
        """
        Seguridad: Un chofer no puede acceder al módulo de planillas salariales ni empleados.
        """
        res = client_chofer.get("/rrhh/empleados")
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_consulta_asistencias_periodo(self, client_admin):
        """
        Consulta de marcas biométricas de asistencia con rango de fechas requerido.
        """
        res = client_admin.get("/rrhh/asistencia?fecha_inicio=2026-10-01&fecha_fin=2026-10-31")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert isinstance(data, list)

    def test_consulta_resumen_y_periodos(self, client_admin):
        """
        Consulta de resumen KPI y periodos de nómina configurados.
        """
        res_resumen = client_admin.get("/rrhh/resumen")
        assert res_resumen.status_code == status.HTTP_200_OK

        res_periodos = client_admin.get("/rrhh/periodos")
        assert res_periodos.status_code == status.HTTP_200_OK
        assert isinstance(res_periodos.json(), list)
