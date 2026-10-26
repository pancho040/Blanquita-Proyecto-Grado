import pytest
from datetime import datetime

class TestReglasNegocioAuditoria:
    """
    Pruebas Unitarias para el Módulo de Auditoría y Trazabilidad Transaccional
    """

    def test_clasificacion_operaciones_criticas(self):
        """
        Detección automática de transacciones financieras o de seguridad críticas:
        - CIERRE_CAJA, ARQUEO_CAJA, ANULACION_COMPROBANTE, APROBACION_NOMINA, CAMBIO_PRECIO.
        """
        operaciones_criticas = {
            "CIERRE_CAJA",
            "ARQUEO_CAJA",
            "ANULACION_COMPROBANTE",
            "APROBACION_NOMINA",
            "CAMBIO_PRECIO",
            "ELIMINACION_USUARIO",
        }

        def es_operacion_critica(accion: str) -> bool:
            return accion.upper() in operaciones_criticas

        assert es_operacion_critica("CIERRE_CAJA") is True
        assert es_operacion_critica("ANULACION_COMPROBANTE") is True
        assert es_operacion_critica("APROBACION_NOMINA") is True
        assert es_operacion_critica("CONSULTA_SALDO") is False
        assert es_operacion_critica("LISTAR_CLIENTES") is False

    def test_integridad_payload_auditoria(self):
        """
        Verificación de campos indispensables en cada registro de bitácora.
        """
        log_entry = {
            "IdUsuario": 1,
            "Modulo": "CONTABILIDAD",
            "Accion": "ANULACION_MOVIMIENTO",
            "Tabla": "MovimientoCaja",
            "IdRegistro": 105,
            "ValoresAnteriores": {"Anulado": False},
            "ValoresNuevos": {"Anulado": True, "Motivo": "Comprobante duplicado"},
            "IpOrigen": "192.168.1.45",
            "FechaHora": datetime.now().isoformat(),
        }

        campos_obligatorios = ["IdUsuario", "Modulo", "Accion", "Tabla", "IdRegistro", "FechaHora"]
        for campo in campos_obligatorios:
            assert campo in log_entry
            assert log_entry[campo] is not None
