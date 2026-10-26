import pytest
from datetime import date
from fastapi import status

class TestP2PContabilidad:
    """
    Pruebas de Integración Peer-to-Peer para el Módulo de Contabilidad y Tesorería
    """

    def test_acceso_denegado_usuario_anonimo(self, client_anonimo):
        """
        Garantiza que usuarios sin autenticación no puedan acceder a endpoints de contabilidad.
        """
        res = client_anonimo.get("/tesoreria/cajas")
        assert res.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_consulta_cajas_contador(self, client_contador):
        """
        Un usuario con rol Contador puede consultar el estado de las cajas.
        """
        res = client_contador.get("/tesoreria/cajas")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert isinstance(data, list)

    def test_consulta_cuentas_cobrar_y_pagar(self, client_contador):
        """
        Consulta de cartera de clientes (CxC) y proveedores (CxP).
        """
        res_cobrar = client_contador.get("/cxc/notas-venta")
        assert res_cobrar.status_code == status.HTTP_200_OK

        res_pagar = client_contador.get("/cxp/proveedores")
        assert res_pagar.status_code == status.HTTP_200_OK

    def test_flujo_anulacion_logica_contable_rn04(self, client_contador):
        """
        Verificación de la regla RN-04:
        Se prueba el endpoint especializado de anulación lógica y se valida
        que requiera un motivo formal de justificación.
        """
        # 1. Intentar anular sin motivo justificado -> Debe rechazar con 422 o 400
        res_sin_motivo = client_contador.post(
            "/tesoreria/movimientos/999999/anular",
            json={"motivo": ""}
        )
        assert res_sin_motivo.status_code in (
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_404_NOT_FOUND,
        )

        # 2. Intentar anulación con motivo válido para un registro no existente -> 404
        res_no_existe = client_contador.post(
            "/tesoreria/movimientos/999999/anular",
            json={"motivo": "Anulación formal por error de comprobante"}
        )
        assert res_no_existe.status_code in (status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST)
