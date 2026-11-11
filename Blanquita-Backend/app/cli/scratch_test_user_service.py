import os, sys
sys.path.insert(0, os.path.abspath("."))
from sqlalchemy import text
from app.Config.supabase import SessionLocal

def check_roles():
    db = SessionLocal()
    try:
        roles = db.execute(text('SELECT "IdRol", "NombreRol" FROM "Rol" ORDER BY "IdRol"')).fetchall()
        print("Roles existentes:")
        for r in roles:
            print(" ", dict(r._mapping))
            
        print("\nUsuarios que comienzan con TEST_:")
        users = db.execute(text('SELECT "IdUsuario", "PrimerNombre", "ApellidoPaterno", "Ci", "IdRol", "IdSucursal" FROM "Usuario" WHERE "PrimerNombre" LIKE \'TEST_%\' OR "ApellidoPaterno" LIKE \'TEST_%\'')).fetchall()
        for u in users:
            print(" ", dict(u._mapping))
    finally:
        db.close()

if __name__ == "__main__":
    check_roles()
