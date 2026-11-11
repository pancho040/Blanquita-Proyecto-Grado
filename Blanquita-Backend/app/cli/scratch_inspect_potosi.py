import os, sys
sys.path.insert(0, os.path.abspath("."))
from sqlalchemy import text
from app.Config.supabase import SessionLocal

def inspect_inv():
    db = SessionLocal()
    try:
        inv1 = db.execute(text("SELECT * FROM inventario_sucursal WHERE sucursal_id = 1")).fetchall()
        print("Registros inventario_sucursal para sucursal_id = 1:")
        for r in inv1:
            print("  ", dict(r._mapping))
    finally:
        db.close()

if __name__ == "__main__":
    inspect_inv()
