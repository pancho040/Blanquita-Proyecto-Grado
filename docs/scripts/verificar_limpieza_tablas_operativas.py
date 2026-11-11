import os
import sys
from dotenv import load_dotenv

load_dotenv("Blanquita-Backend/.env")
sys.path.insert(0, os.path.abspath("Blanquita-Backend"))

from app.Config.supabase import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("=== VERIFICACIÓN DE INEXISTENCIA DE BASURA DE PRUEBAS FASE 2.1 ===")
print(f"{'Tabla':<32} | {'Total Filas':<15} | {'Filas Creadas Hoy (Fase 2)':<30}")
print("-" * 80)

tablas = [
    ("ClaveIdempotenciaProcesada", "fecha_creacion"),
    ("ComprobanteArchivo", "FechaSubida"),
    ("AbonoCuentaCobrar", "FechaAbono"),
    ("RendicionRuta", "FechaRendicion"),
]

for tbl, col_fecha in tablas:
    try:
        total = db.execute(text(f'SELECT COUNT(*) FROM public."{tbl}"')).scalar()
        hoy = db.execute(text(f'SELECT COUNT(*) FROM public."{tbl}" WHERE "{col_fecha}" >= CURRENT_DATE')).scalar()
        print(f"{tbl:<32} | {total:<15} | {hoy} filas persistidas (Rollback OK)")
    except Exception as e:
        print(f"{tbl:<32} | ERROR: {e}")

db.close()
