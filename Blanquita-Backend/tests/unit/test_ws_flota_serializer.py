import unittest
from decimal import Decimal
from datetime import datetime, date
import uuid
import json

from app.Services.Logistica.FlotaWebSocketManager import serializar_json_ws, default_json_ws_serializer

class TestWSFlotaSerializer(unittest.TestCase):
    def test_serializar_decimal_datetime_uuid(self):
        ahora = datetime(2026, 11, 14, 23, 30, 0)
        hoy = date(2026, 11, 14)
        uid = uuid.UUID("12345678-1234-5678-1234-567812345678")
        
        datos = {
            "tipo": "snapshot_flota",
            "monto": Decimal("150.75"),
            "entero_decimal": Decimal("10"),
            "fecha_creacion": ahora,
            "dia": hoy,
            "id_sesion": uid,
            "choferes": [
                {
                    "id": 24,
                    "latitud": Decimal("-19.043123"),
                    "longitud": Decimal("-65.259876"),
                    "velocidad": Decimal("0.0"),
                }
            ]
        }
        
        json_str = serializar_json_ws(datos)
        self.assertIsInstance(json_str, str)
        
        parsed = json.loads(json_str)
        self.assertEqual(parsed["tipo"], "snapshot_flota")
        self.assertEqual(parsed["monto"], 150.75)
        self.assertEqual(parsed["entero_decimal"], 10.0)
        self.assertEqual(parsed["fecha_creacion"], ahora.isoformat())
        self.assertEqual(parsed["dia"], hoy.isoformat())
        self.assertEqual(parsed["id_sesion"], str(uid))
        self.assertEqual(parsed["choferes"][0]["latitud"], -19.043123)
        self.assertEqual(parsed["choferes"][0]["longitud"], -65.259876)

    def test_default_json_ws_serializer_tipo_desconocido(self):
        class ObjDesconocido:
            pass
        
        with self.assertRaises(TypeError):
            default_json_ws_serializer(ObjDesconocido())

if __name__ == "__main__":
    unittest.main()
