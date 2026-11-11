"""
Pruebas de Integración: Mitigación de las 10 Fugas Críticas de Sucursal (Fase 2 - Paso 1)
Sistema Integral ERP Papelera Blanquita

Verifica que cada uno de los 10 endpoints con fuga previa aplique de forma estricta:
1. Filtrado forzado según el alcance del usuario (Sucre vs Potosí vs Consolidado).
2. Respuesta 403 Forbidden inmediata cuando un usuario de sede fija solicita datos de otra sucursal (?id_sucursal=X).
3. Acceso sin restricción con capacidad de filtrado o consolidado para el perfil Multisede.
"""

import pytest

class TestFugasCriticasSucursal:

    # =========================================================================
    # FUGA 1: GET /cxc/notas-venta
    # =========================================================================
    def test_fuga_01_notas_venta_sucre(self, client_prueba_sucre):
        res = client_prueba_sucre.get("/cxc/notas-venta?id_sucursal=2")
        assert res.status_code == 403
        assert "No tiene autorización" in res.json()["detail"]
        assert client_prueba_sucre.get("/cxc/notas-venta").status_code == 200

    def test_fuga_01_notas_venta_potosi(self, client_prueba_potosi):
        res = client_prueba_potosi.get("/cxc/notas-venta?id_sucursal=1")
        assert res.status_code == 403
        assert client_prueba_potosi.get("/cxc/notas-venta").status_code == 200

    def test_fuga_01_notas_venta_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/cxc/notas-venta").status_code == 200
        assert client_prueba_multisede.get("/cxc/notas-venta?id_sucursal=1").status_code == 200
        assert client_prueba_multisede.get("/cxc/notas-venta?id_sucursal=2").status_code == 200

    # =========================================================================
    # FUGA 2: GET /cxc/cuentas
    # =========================================================================
    def test_fuga_02_cuentas_cobrar_sucre(self, client_prueba_sucre):
        res = client_prueba_sucre.get("/cxc/cuentas?id_sucursal=2")
        assert res.status_code == 403
        assert client_prueba_sucre.get("/cxc/cuentas").status_code == 200

    def test_fuga_02_cuentas_cobrar_potosi(self, client_prueba_potosi):
        res = client_prueba_potosi.get("/cxc/cuentas?id_sucursal=1")
        assert res.status_code == 403
        assert client_prueba_potosi.get("/cxc/cuentas").status_code == 200

    def test_fuga_02_cuentas_cobrar_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/cxc/cuentas?id_sucursal=1").status_code == 200
        assert client_prueba_multisede.get("/cxc/cuentas?id_sucursal=2").status_code == 200

    # =========================================================================
    # FUGA 3: GET /cxc/abonos/pendientes
    # =========================================================================
    def test_fuga_03_abonos_pendientes_sucre(self, client_prueba_sucre):
        res = client_prueba_sucre.get("/cxc/abonos/pendientes?id_sucursal=2")
        assert res.status_code == 403
        assert client_prueba_sucre.get("/cxc/abonos/pendientes").status_code == 200

    def test_fuga_03_abonos_pendientes_potosi(self, client_prueba_potosi):
        assert client_prueba_potosi.get("/cxc/abonos/pendientes?id_sucursal=1").status_code == 403
        assert client_prueba_potosi.get("/cxc/abonos/pendientes").status_code == 200

    def test_fuga_03_abonos_pendientes_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/cxc/abonos/pendientes").status_code == 200

    # =========================================================================
    # FUGA 4: GET /tesoreria/caja/estado
    # =========================================================================
    def test_fuga_04_caja_estado_sucre(self, client_prueba_sucre):
        res = client_prueba_sucre.get("/tesoreria/caja/estado?id_sucursal=2")
        assert res.status_code == 403
        assert client_prueba_sucre.get("/tesoreria/caja/estado").status_code == 200

    def test_fuga_04_caja_estado_potosi(self, client_prueba_potosi):
        res = client_prueba_potosi.get("/tesoreria/caja/estado?id_sucursal=1")
        assert res.status_code == 403
        assert client_prueba_potosi.get("/tesoreria/caja/estado").status_code == 200

    def test_fuga_04_caja_estado_multisede(self, client_prueba_multisede):
        # En modo consolidado sin especificar sucursal exige 400 Bad Request
        assert client_prueba_multisede.get("/tesoreria/caja/estado").status_code == 400
        # Con sucursal explícita 1 o 2 responde 200 OK
        assert client_prueba_multisede.get("/tesoreria/caja/estado?id_sucursal=1").status_code == 200
        assert client_prueba_multisede.get("/tesoreria/caja/estado?id_sucursal=2").status_code == 200

    # =========================================================================
    # FUGA 5: GET /tesoreria/cajas
    # =========================================================================
    def test_fuga_05_cajas_historial_sucre(self, client_prueba_sucre):
        assert client_prueba_sucre.get("/tesoreria/cajas?id_sucursal=2").status_code == 403
        assert client_prueba_sucre.get("/tesoreria/cajas").status_code == 200

    def test_fuga_05_cajas_historial_potosi(self, client_prueba_potosi):
        assert client_prueba_potosi.get("/tesoreria/cajas?id_sucursal=1").status_code == 403
        assert client_prueba_potosi.get("/tesoreria/cajas").status_code == 200

    def test_fuga_05_cajas_historial_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/tesoreria/cajas").status_code == 200
        assert client_prueba_multisede.get("/tesoreria/cajas?id_sucursal=1").status_code == 200
        assert client_prueba_multisede.get("/tesoreria/cajas?id_sucursal=2").status_code == 200

    # =========================================================================
    # FUGA 6: GET /tesoreria/caja-chica/solicitudes
    # =========================================================================
    def test_fuga_06_caja_chica_solicitudes_sucre(self, client_prueba_sucre):
        assert client_prueba_sucre.get("/tesoreria/caja-chica/solicitudes?id_sucursal=2").status_code == 403
        assert client_prueba_sucre.get("/tesoreria/caja-chica/solicitudes").status_code == 200

    def test_fuga_06_caja_chica_solicitudes_potosi(self, client_prueba_potosi):
        assert client_prueba_potosi.get("/tesoreria/caja-chica/solicitudes?id_sucursal=1").status_code == 403
        assert client_prueba_potosi.get("/tesoreria/caja-chica/solicitudes").status_code == 200

    def test_fuga_06_caja_chica_solicitudes_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/tesoreria/caja-chica/solicitudes").status_code == 200

    # =========================================================================
    # FUGA 7: GET /logistica/asignaciones
    # =========================================================================
    def test_fuga_07_asignaciones_logistica_sucre(self, client_prueba_sucre):
        assert client_prueba_sucre.get("/logistica/asignaciones?id_sucursal=2").status_code == 403
        assert client_prueba_sucre.get("/logistica/asignaciones").status_code == 200

    def test_fuga_07_asignaciones_logistica_potosi(self, client_prueba_potosi):
        assert client_prueba_potosi.get("/logistica/asignaciones?id_sucursal=1").status_code == 403
        assert client_prueba_potosi.get("/logistica/asignaciones").status_code == 200

    def test_fuga_07_asignaciones_logistica_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/logistica/asignaciones").status_code == 200

    # =========================================================================
    # FUGA 8: GET /logistica/clientes
    # =========================================================================
    def test_fuga_08_clientes_sucre(self, client_prueba_sucre):
        assert client_prueba_sucre.get("/logistica/clientes?id_sucursal=2").status_code == 403
        assert client_prueba_sucre.get("/logistica/clientes").status_code == 200

    def test_fuga_08_clientes_potosi(self, client_prueba_potosi):
        assert client_prueba_potosi.get("/logistica/clientes?id_sucursal=1").status_code == 403
        assert client_prueba_potosi.get("/logistica/clientes").status_code == 200

    def test_fuga_08_clientes_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/logistica/clientes").status_code == 200

    # =========================================================================
    # FUGA 9: GET /rrhh/empleados
    # =========================================================================
    def test_fuga_09_empleados_sucre(self, client_prueba_sucre):
        assert client_prueba_sucre.get("/rrhh/empleados?id_sucursal=2").status_code == 403
        assert client_prueba_sucre.get("/rrhh/empleados").status_code == 200

    def test_fuga_09_empleados_potosi(self, client_prueba_potosi):
        assert client_prueba_potosi.get("/rrhh/empleados?id_sucursal=1").status_code == 403
        assert client_prueba_potosi.get("/rrhh/empleados").status_code == 200

    def test_fuga_09_empleados_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/rrhh/empleados").status_code == 200

    # =========================================================================
    # FUGA 10: GET /rrhh/asistencia
    # =========================================================================
    def test_fuga_10_asistencia_sucre(self, client_prueba_sucre):
        assert client_prueba_sucre.get("/rrhh/asistencia?id_sucursal=2").status_code == 403
        assert client_prueba_sucre.get("/rrhh/asistencia").status_code == 200

    def test_fuga_10_asistencia_potosi(self, client_prueba_potosi):
        assert client_prueba_potosi.get("/rrhh/asistencia?id_sucursal=1").status_code == 403
        assert client_prueba_potosi.get("/rrhh/asistencia").status_code == 200

    def test_fuga_10_asistencia_multisede(self, client_prueba_multisede):
        assert client_prueba_multisede.get("/rrhh/asistencia").status_code == 200
