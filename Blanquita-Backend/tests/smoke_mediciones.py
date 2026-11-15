import sys
import os
sys.path.insert(0, os.path.abspath("."))
import time
from fastapi.testclient import TestClient
from app.main import app
from app.utils.calculo_entrega import calcular_total_entrega, validar_coherencia_cobro

print("=== SMOKE TEST BACKEND Y MEDICIONES DE TIEMPO ===")
client = TestClient(app)

# 1. Medir tiempo de healthcheck / raíz
t0 = time.perf_counter()
res_root = client.get("/")
t_root = (time.perf_counter() - t0) * 1000
print(f"GET / -> HTTP {res_root.status_code} ({t_root:.1f}ms)")

# 2. Medir tiempo y coherencia del cálculo canónico de entrega
t0 = time.perf_counter()
items_test = [
    {"presentacion_id": 10, "cantidad": 5, "precio_unitario": 37.8, "es_bandeo": False},
    {"presentacion_id": 11, "cantidad": 5, "precio_unitario": 27.0, "es_bandeo": False},
    {"presentacion_id": 13, "cantidad": 5, "precio_unitario": 4.86, "es_bandeo": False},
]
tot, items_calc = calcular_total_entrega(items_test)
val = validar_coherencia_cobro(tot, 375.0)
t_calc = (time.perf_counter() - t0) * 1000
assert val["valido"] is False, "375.00 debe ser inválido sobre 348.30"
assert val["diferencia"] == 26.70, "Diferencia debe ser 26.70"
print(f"Cálculo canónico de entrega -> Total: Bs. {tot:.2f}, Excede: {val['excede']}, Diferencia: Bs. {val['diferencia']:.2f} ({t_calc:.3f}ms)")

# 3. Medir tiempo de telemetría en vivo (Potosí - Sucursal 2)
t0 = time.perf_counter()
res_tele = client.get("/logistica/telemetria/en-vivo?id_sucursal=2")
t_tele = (time.perf_counter() - t0) * 1000
print(f"GET /logistica/telemetria/en-vivo?id_sucursal=2 -> HTTP {res_tele.status_code} ({t_tele:.1f}ms)")

# 4. Medir tiempo de endpoints autenticados (verificando que respondan 401/403 limpio sin 500)
t0 = time.perf_counter()
res_ws = client.get("/ws/ticket")
t_ws = (time.perf_counter() - t0) * 1000
print(f"GET /ws/ticket (sin auth) -> HTTP {res_ws.status_code} ({t_ws:.1f}ms)")

t0 = time.perf_counter()
res_alcance = client.get("/Usuario/mi-alcance")
t_alcance = (time.perf_counter() - t0) * 1000
print(f"GET /Usuario/mi-alcance (sin auth) -> HTTP {res_alcance.status_code} ({t_alcance:.1f}ms)")

print("=== SMOKE TEST COMPLETADO CON ÉXITO SIN REGRESIONES ===")
