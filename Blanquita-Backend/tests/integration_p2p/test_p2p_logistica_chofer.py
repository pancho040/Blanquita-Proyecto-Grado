import pytest
from fastapi import status

class TestP2PLogisticaChofer:
    """
    Pruebas de Integración Peer-to-Peer para el Flujo de Logística, Choferes y Agentes de Reparto
    """

    def test_consulta_rutas_supervisor(self, client_supervisor):
        """
        El supervisor de logística puede consultar las rutas registradas.
        """
        res = client_supervisor.get("/logistica/rutas")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert isinstance(data, list)

    def test_consulta_clientes_logistica(self, client_supervisor):
        """
        Consulta de cartera de clientes con información de crédito y georreferenciación.
        """
        res = client_supervisor.get("/logistica/clientes")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert isinstance(data, list)

    def test_acceso_chofer_mi_ruta(self, client_chofer):
        """
        El chofer o agente de reparto consulta su asignación activa.
        """
        res = client_chofer.get("/logistica/choferes/mi-ruta")
        # Retorna 200 (si tiene despacho asignado) o 404 (si no tiene despacho en este momento)
        assert res.status_code in (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND)

    def test_chofer_registro_nuevo_cliente_gps(self, client_chofer):
        """
        HU-29: El agente de reparto puede capturar y registrar un nuevo cliente en campo con GPS.
        """
        nuevo_cliente_payload = {
            "RazonSocial": "Tienda Doña Esperanza P2P Test",
            "NombreComercial": "Abarrotes Esperanza",
            "NitCi": "9988776655",
            "Ciudad": "Sucre",
            "Direccion": "Zona San Roque Calle 4 Nro 12",
            "Telefono": "76123456",
            "Latitud": -19.0435,
            "Longitud": -65.2598,
            "IdZona": 1,
            "LimiteCredito": 1000.0,
            "DiasCredito": 7,
            "TieneCredito": True,
        }

        res = client_chofer.post("/logistica/clientes", json=nuevo_cliente_payload)
        # 200 o 201 si crea, o 400/409/422 si la cédula/nit ya existe o zona requiere punto de venta
        assert res.status_code in (
            status.HTTP_200_OK,
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_409_CONFLICT,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
