"""
Script de Limpieza Controlada de Usuarios de Prueba Multi-Sede
Sistema ERP Papelera Blanquita

Lee el manifiesto docs/manifests/manifest_usuarios_prueba_sedes.json y borra ÚNICAMENTE
los usuarios y permisos creados por la siembra.
"""

import os
import sys
import json
import argparse
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import text
from app.Config.supabase import SessionLocal

MANIFEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../docs/manifests"))
MANIFEST_FILE = os.path.join(MANIFEST_DIR, "manifest_usuarios_prueba_sedes.json")
CREDENTIALS_FILE = os.path.join(MANIFEST_DIR, ".test_credentials.local.json")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def clean_usuarios(dry_run: bool = False):
    if not os.path.exists(MANIFEST_FILE):
        print(f"No existe manifiesto en {MANIFEST_FILE}. Nada que limpiar.")
        return

    with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    usuarios = data.get("usuarios", [])
    if not usuarios:
        print("El manifiesto no contiene usuarios. Nada que limpiar.")
        return

    print(f"=== LIMPIEZA DE USUARIOS DE PRUEBA {'[MODO DRY-RUN]' if dry_run else ''} ===")
    print(f"Total usuarios a eliminar: {len(usuarios)}")

    db = SessionLocal()
    try:
        for u in usuarios:
            alias = u.get("alias")
            uid = u.get("id_usuario")
            auth_id = u.get("auth_user_id")

            if uid == "DRY-RUN":
                continue

            if dry_run:
                print(f"[DRY-RUN] Se eliminaría {alias} (ID {uid}, AuthUserId {auth_id})")
            else:
                # 1. Eliminar permisos territoriales
                db.execute(text("DELETE FROM usuario_sucursal_permiso WHERE id_usuario = :uid"), {"uid": uid})
                # 2. Eliminar de tabla Usuario
                res = db.execute(text('DELETE FROM public."Usuario" WHERE "IdUsuario" = :uid'), {"uid": uid})
                db.commit()
                print(f"[ELIMINADO BD] Usuario {alias} (ID {uid})")

                # 3. Eliminar de Supabase Auth si existe auth_id
                if auth_id and SUPABASE_URL and SUPABASE_SECRET_KEY:
                    try:
                        resp = httpx.delete(
                            f"{SUPABASE_URL}/auth/v1/admin/users/{auth_id}",
                            headers={
                                "apikey": SUPABASE_SECRET_KEY,
                                "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
                            },
                            timeout=10.0
                        )
                        if resp.status_code in (200, 204):
                            print(f"[ELIMINADO AUTH] Cuenta auth {auth_id}")
                    except Exception as err:
                        print(f"[WARN AUTH] No se pudo borrar de Auth {auth_id}: {err}")

        if not dry_run:
            if os.path.exists(MANIFEST_FILE):
                os.remove(MANIFEST_FILE)
            if os.path.exists(CREDENTIALS_FILE):
                os.remove(CREDENTIALS_FILE)
            print("[OK] Manifiesto y archivo local de credenciales eliminados.")
        else:
            print("[DRY-RUN] Simulación completa. No se modificó nada.")

    except Exception as e:
        db.rollback()
        print(f"ERROR durante la limpieza de usuarios: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Limpiar usuarios de prueba de sedes.")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin eliminar")
    args = parser.parse_args()
    clean_usuarios(dry_run=args.dry_run)
