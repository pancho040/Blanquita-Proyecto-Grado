import os
import sys
from dotenv import load_dotenv

load_dotenv("Blanquita-Backend/.env")
sys.path.insert(0, os.path.abspath("Blanquita-Backend"))

from app.Config.supabase import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("=== LIMPIEZA DE RESIDUOS TEST DE SESIÓN PREVIA (07:00 UTC) ===")

# 1. Abonos vinculados
r1 = db.execute(text('DELETE FROM public."AbonoCuentaCobrar" WHERE "IdCuentaCobrar" IN (413, 414, 415, 416);'))
print(f"AbonoCuentaCobrar eliminados: {r1.rowcount}")

# 2. Cuentas por cobrar de prueba
r2 = db.execute(text('DELETE FROM public."CuentaCobrar" WHERE "IdCuentaCobrar" IN (413, 414, 415, 416);'))
print(f"CuentaCobrar eliminados: {r2.rowcount}")

# 3. Comprobantes 45 y 46
r3 = db.execute(text('DELETE FROM public."ComprobanteArchivo" WHERE "IdComprobante" IN (45, 46);'))
print(f"ComprobanteArchivo eliminados: {r3.rowcount}")

# 4. RendicionRuta creadas hoy
r4 = db.execute(text('DELETE FROM public."RendicionRuta" WHERE "FechaRendicion" >= CURRENT_DATE;'))
print(f"RendicionRuta eliminados: {r4.rowcount}")

db.commit()
db.close()
print("Commit ejecutado con éxito.")
