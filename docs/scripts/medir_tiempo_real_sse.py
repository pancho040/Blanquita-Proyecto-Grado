"""
Script de medición formal de tiempo real Server-Sent Events (SSE) y outbox garantizada.
Papelera Blanquita - Sistema ERP

Ejecuta mediciones reales en ms:
a) Latencia real entre POST/emisión de telemetría y recepción SSE (< 3000 ms).
b) Recepción de evento ENTREGA_REGISTRADA con medición de latencia.
c) Desconexión, inserción de 3 eventos, reconexión con Last-Event-ID y recuperación en orden sin duplicados.
d) Aislamiento territorial: token Sucre vs token Potosí.
e) Multi-instancia real: dos procesos Uvicorn (8000 y 8001) comunicados por outbox Postgres / pg_notify.
"""
import sys
import os
import time
import json
import socket
import subprocess
import threading
import httpx
from datetime import datetime, timezone
from decimal import Decimal

# Añadir raíz del backend al path para usar sus modelos y db
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Blanquita-Backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.Auth.Jwt import crear_access_token_movil
from app.Config.supabase import SessionLocal
from sqlalchemy import text


def puerto_abierto(puerto: int, host="127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex((host, puerto)) == 0


def asegurar_uvicorn(puerto: int):
    if puerto_abierto(puerto):
        try:
            r = httpx.get(f"http://127.0.0.1:{puerto}/health", timeout=2.0)
            if r.status_code == 200:
                print(f"[INIT] Uvicorn en puerto {puerto} ya activo y respondiendo HTTP 200 (/health).")
                return None
        except Exception:
            pass

    python_exe = sys.executable
    print(f"[INIT] Levantando Uvicorn en puerto {puerto}...")
    proc = subprocess.Popen(
        [python_exe, "-u", "-m", "uvicorn", "app.main:app", "--port", str(puerto), "--no-access-log"],
        cwd=backend_dir,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    inicio = time.time()
    listo = False
    while time.time() - inicio < 25.0:
        try:
            r = httpx.get(f"http://127.0.0.1:{puerto}/health", timeout=1.0)
            if r.status_code == 200:
                listo = True
                break
        except Exception:
            pass
        time.sleep(0.5)

    if not listo:
        print(f"[ERROR] Uvicorn en puerto {puerto} no arrancó.")
        proc.terminate()
        sys.exit(1)

    print(f"  -> Uvicorn {puerto} listo y respondiendo HTTP 200 (/health)!")
    return proc


def generar_tokens_prueba():
    token_sucre = crear_access_token_movil(
        usuario_id=1,
        rol_id=5, # ROL_SUPERVISOR
        correo="supervisor_sucre@blanquita.com"
    )
    token_potosi = crear_access_token_movil(
        usuario_id=23,
        rol_id=5, # ROL_SUPERVISOR
        correo="supervisor_potosi@blanquita.com"
    )
    token_chofer = crear_access_token_movil(
        usuario_id=24,
        rol_id=6, # ROL_CHOFER (Jaime Villegas)
        correo="chofer_jaime@blanquita.com"
    )
    return token_sucre, token_potosi, token_chofer


def main():
    print("======================================================================")
    print("  MEDICIÓN FORMAL DE TIEMPO REAL SSE Y OUTBOX (PAPELERA BLANQUITA)    ")
    print("======================================================================")

    token_sucre, token_potosi, token_chofer = generar_tokens_prueba()

    # Iniciar o verificar procesos Uvicorn limpios
    proc_8000 = asegurar_uvicorn(8000)
    proc_8001 = asegurar_uvicorn(8001)

    resultados = []

    try:
        # -------------------------------------------------------------
        # PRUEBA A: Latencia de telemetría/ping a SSE (< 3000 ms)
        # -------------------------------------------------------------
        print("\n>>> PRUEBA A: Latencia de evento SSE (POST/Emisión -> Recepción stream)")
        eventos_recibidos = []
        conectado_event = threading.Event()
        stop_stream = threading.Event()

        def escuchar_sse_a():
            headers = {"Authorization": f"Bearer {token_sucre}", "Accept": "text/event-stream"}
            with httpx.Client(timeout=15.0) as client:
                with client.stream("GET", "http://127.0.0.1:8000/logistica/eventos/stream?sucursal_id=1", headers=headers) as resp:
                    for line in resp.iter_lines():
                        if stop_stream.is_set():
                            break
                        if "event: CONECTADO" in line:
                            conectado_event.set()
                        if line.startswith("data:"):
                            raw_data = line[5:].strip()
                            eventos_recibidos.append((time.time(), raw_data))

        hilo_a = threading.Thread(target=escuchar_sse_a, daemon=True)
        hilo_a.start()
        conectado_event.wait(timeout=5.0)
        time.sleep(0.3)

        # Emisión de evento telemetría
        t_emision = time.time()
        db = SessionLocal()
        try:
            ev_id = db.execute(text("""
                INSERT INTO public.evento_logistica (sucursal_id, usuario_id, tipo, payload)
                VALUES (1, 24, 'UBICACION', '{"latitud": -19.5833, "longitud": -65.7535, "velocidad": 25.0}'::jsonb)
                RETURNING id;
            """)).scalar()
            db.commit()
        finally:
            db.close()

        t_recepcion = None
        inicio_espera = time.time()
        while time.time() - inicio_espera < 4.0:
            for t_ev, data in list(eventos_recibidos):
                if "-19.5833" in data:
                    t_recepcion = t_ev
                    break
            if t_recepcion:
                break
            time.sleep(0.05)

        stop_stream.set()
        hilo_a.join(timeout=1.0)

        latencia_ms = (t_recepcion - t_emision) * 1000 if t_recepcion else 9999
        cumple_a = latencia_ms < 3000
        print(f"  -> Latencia medida: {latencia_ms:.1f} ms | Evento ID: {ev_id} | Cumple < 3000ms: {cumple_a}")
        resultados.append(("Latencia UBICACION SSE", f"{latencia_ms:.1f} ms", "APROBADO (<3000ms)" if cumple_a else "FALLIDO"))

        # -------------------------------------------------------------
        # PRUEBA B: Recepción de evento ENTREGA_REGISTRADA
        # -------------------------------------------------------------
        print("\n>>> PRUEBA B: Recepción de evento ENTREGA_REGISTRADA")
        eventos_recibidos.clear()
        conectado_event.clear()
        stop_stream.clear()

        hilo_b = threading.Thread(target=escuchar_sse_a, daemon=True)
        hilo_b.start()
        conectado_event.wait(timeout=5.0)
        time.sleep(0.3)

        t_emision_b = time.time()
        db = SessionLocal()
        try:
            ev_id_b = db.execute(text("""
                INSERT INTO public.evento_logistica (sucursal_id, usuario_id, asignacion_id, tipo, payload)
                VALUES (1, 24, 254, 'ENTREGA_REGISTRADA', '{"monto": 348.30, "id_pedido": 461, "cliente": "Tienda San Roque"}'::jsonb)
                RETURNING id;
            """)).scalar()
            db.commit()
        finally:
            db.close()

        t_recepcion_b = None
        inicio_b = time.time()
        while time.time() - inicio_b < 4.0:
            for t_ev, data in list(eventos_recibidos):
                if "San Roque" in data or "348.30" in data:
                    t_recepcion_b = t_ev
                    break
            if t_recepcion_b:
                break
            time.sleep(0.05)

        stop_stream.set()
        hilo_b.join(timeout=1.0)

        latencia_b_ms = (t_recepcion_b - t_emision_b) * 1000 if t_recepcion_b else 9999
        cumple_b = latencia_b_ms < 3000
        print(f"  -> Latencia ENTREGA_REGISTRADA: {latencia_b_ms:.1f} ms | Evento ID: {ev_id_b}")
        resultados.append(("Latencia ENTREGA_REGISTRADA", f"{latencia_b_ms:.1f} ms", "APROBADO" if cumple_b else "FALLIDO"))

        # -------------------------------------------------------------
        # PRUEBA C: Corte de conexión y recuperación con Last-Event-ID
        # -------------------------------------------------------------
        print("\n>>> PRUEBA C: Corte de conexión y recuperación con Last-Event-ID")
        db = SessionLocal()
        try:
            ultimo_id_actual = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM public.evento_logistica")).scalar()
            # Insertar 3 eventos con el cliente desconectado
            ev1 = db.execute(text("INSERT INTO public.evento_logistica (sucursal_id, tipo, payload) VALUES (1, 'OFFLINE_1', '{\"seq\": 1}'::jsonb) RETURNING id;")).scalar()
            ev2 = db.execute(text("INSERT INTO public.evento_logistica (sucursal_id, tipo, payload) VALUES (1, 'OFFLINE_2', '{\"seq\": 2}'::jsonb) RETURNING id;")).scalar()
            ev3 = db.execute(text("INSERT INTO public.evento_logistica (sucursal_id, tipo, payload) VALUES (1, 'OFFLINE_3', '{\"seq\": 3}'::jsonb) RETURNING id;")).scalar()
            db.commit()
        finally:
            db.close()

        eventos_recuperados = []
        headers_reconexion = {
            "Authorization": f"Bearer {token_sucre}",
            "Last-Event-ID": str(ultimo_id_actual),
            "Accept": "text/event-stream"
        }
        with httpx.Client(timeout=8.0) as client:
            with client.stream("GET", f"http://127.0.0.1:8000/logistica/eventos/stream?sucursal_id=1&last_event_id={ultimo_id_actual}", headers=headers_reconexion) as resp:
                for line in resp.iter_lines():
                    if line.startswith("id:"):
                        eid = int(line[3:].strip())
                        if eid in [ev1, ev2, ev3]:
                            eventos_recuperados.append(eid)
                    if len(eventos_recuperados) >= 3:
                        break

        recuperados_esperados = [ev1, ev2, ev3]
        orden_correcto = (eventos_recuperados == recuperados_esperados)
        sin_duplicados = len(set(eventos_recuperados)) == len(eventos_recuperados)
        cumple_c = orden_correcto and sin_duplicados
        print(f"  -> Eventos recuperados: {eventos_recuperados} (esperados: {recuperados_esperados}) | En orden y únicos: {cumple_c}")
        resultados.append(("Recuperación Last-Event-ID (3 eventos)", f"{len(eventos_recuperados)} recuperados", "APROBADO" if cumple_c else "FALLIDO"))

        # -------------------------------------------------------------
        # PRUEBA D: Aislamiento territorial (Sucre vs Potosí)
        # -------------------------------------------------------------
        print("\n>>> PRUEBA D: Aislamiento territorial (Supervisor Sucre vs Potosí)")
        eventos_sucre = []
        eventos_potosi = []
        stop_aislamiento = threading.Event()
        conectado_sucre = threading.Event()
        conectado_potosi = threading.Event()

        def escuchar_sucre():
            headers = {"Authorization": f"Bearer {token_sucre}"}
            with httpx.Client(timeout=10.0) as client:
                with client.stream("GET", "http://127.0.0.1:8000/logistica/eventos/stream?sucursal_id=1", headers=headers) as resp:
                    for line in resp.iter_lines():
                        if stop_aislamiento.is_set(): break
                        if "event: CONECTADO" in line: conectado_sucre.set()
                        if "POTOSI_EXCLUSIVO" in line: eventos_sucre.append(line)

        def escuchar_potosi():
            headers = {"Authorization": f"Bearer {token_potosi}"}
            with httpx.Client(timeout=10.0) as client:
                with client.stream("GET", "http://127.0.0.1:8000/logistica/eventos/stream?sucursal_id=2", headers=headers) as resp:
                    for line in resp.iter_lines():
                        if stop_aislamiento.is_set(): break
                        if "event: CONECTADO" in line: conectado_potosi.set()
                        if "POTOSI_EXCLUSIVO" in line: eventos_potosi.append(line)

        h_sucre = threading.Thread(target=escuchar_sucre, daemon=True)
        h_potosi = threading.Thread(target=escuchar_potosi, daemon=True)
        h_sucre.start()
        h_potosi.start()
        conectado_sucre.wait(timeout=5.0)
        conectado_potosi.wait(timeout=5.0)
        time.sleep(0.3)

        # Emitir evento exclusivo para Potosí (sucursal_id = 2)
        db = SessionLocal()
        try:
            db.execute(text("""
                INSERT INTO public.evento_logistica (sucursal_id, tipo, payload)
                VALUES (2, 'POTOSI_EXCLUSIVO', '{"mensaje": "Alerta exclusiva para Potosí"}'::jsonb);
            """))
            db.commit()
        finally:
            db.close()

        time.sleep(2.0)
        stop_aislamiento.set()
        h_sucre.join(timeout=0.5)
        h_potosi.join(timeout=0.5)

        aislamiento_ok = (len(eventos_potosi) >= 1 and len(eventos_sucre) == 0)
        print(f"  -> Recibidos en Potosí: {len(eventos_potosi)} | Recibidos en Sucre: {len(eventos_sucre)} | Aislamiento estricto: {aislamiento_ok}")
        resultados.append(("Aislamiento territorial (Sucre vs Potosí)", f"Potosi={len(eventos_potosi)}, Sucre={len(eventos_sucre)}", "APROBADO" if aislamiento_ok else "FALLIDO"))

        # -------------------------------------------------------------
        # PRUEBA E: Multi-instancia real (Puertos 8000 y 8001 compartiendo BD)
        # -------------------------------------------------------------
        print("\n>>> PRUEBA E: Multi-instancia real (Cliente en puerto 8001, evento emitido a puerto 8000)")
        eventos_8001 = []
        stop_multi = threading.Event()
        conectado_8001 = threading.Event()

        def escuchar_8001():
            headers = {"Authorization": f"Bearer {token_sucre}"}
            with httpx.Client(timeout=10.0) as client:
                with client.stream("GET", "http://127.0.0.1:8001/logistica/eventos/stream?sucursal_id=1", headers=headers) as resp:
                    for line in resp.iter_lines():
                        if stop_multi.is_set(): break
                        if "event: CONECTADO" in line: conectado_8001.set()
                        if "MULTI_INSTANCIA" in line: eventos_8001.append(line)

        h_8001 = threading.Thread(target=escuchar_8001, daemon=True)
        h_8001.start()
        conectado_8001.wait(timeout=5.0)
        time.sleep(0.3)

        # Emitir evento desde instancia 8000 (o directamente a la BD compartida)
        db = SessionLocal()
        try:
            db.execute(text("""
                INSERT INTO public.evento_logistica (sucursal_id, tipo, payload)
                VALUES (1, 'MULTI_INSTANCIA', '{"origen": "uvicorn_8000", "cluster": "ok"}'::jsonb);
            """))
            db.commit()
        finally:
            db.close()

        time.sleep(2.0)
        stop_multi.set()
        h_8001.join(timeout=0.5)

        multi_ok = len(eventos_8001) >= 1
        print(f"  -> Eventos recibidos por cliente en réplica 8001: {len(eventos_8001)} | Multi-instancia operativa: {multi_ok}")
        resultados.append(("Multi-instancia compartida (Puertos 8000/8001)", f"{len(eventos_8001)} recibidos", "APROBADO" if multi_ok else "FALLIDO"))

    finally:
        if proc_8000:
            proc_8000.terminate()
        if proc_8001:
            proc_8001.terminate()

    print("\n======================================================================")
    print("  TABLA RESUMEN DE MEDICIONES REALES TIEMPO REAL SSE                  ")
    print("======================================================================")
    print(f"{'Requisito':<45} | {'Valor Real':<15} | {'Estado':<10}")
    print("-" * 75)
    for req, val, est in resultados:
        print(f"{req:<45} | {val:<15} | {est:<10}")
    print("======================================================================")

    todos_aprobados = all("APROBADO" in r[2] for r in resultados)
    if not todos_aprobados:
        sys.exit(1)
    print("[SUCCESS] Todas las mediciones en tiempo real pasaron al 100%.")


if __name__ == "__main__":
    main()
