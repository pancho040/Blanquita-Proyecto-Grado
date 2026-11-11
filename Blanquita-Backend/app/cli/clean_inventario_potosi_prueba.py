"""
Script de Limpieza Controlada de Inventario de Prueba de Sucursal Potosí (IdSucursal = 2)
Sistema ERP Papelera Blanquita

Lee el manifiesto docs/manifests/manifest_inventario_potosi_test.json y borra ÚNICAMENTE
los registros insertados por el script de siembra.
"""

import os
import sys
import json
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import text
from app.Config.supabase import SessionLocal

MANIFEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../docs/manifests"))
MANIFEST_FILE = os.path.join(MANIFEST_DIR, "manifest_inventario_potosi_test.json")

def clean_inventario_potosi(dry_run: bool = False):
    if not os.path.exists(MANIFEST_FILE):
        print(f"No existe manifiesto en {MANIFEST_FILE}. Nada que limpiar.")
        return

    with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    ids = data.get("registro_ids", [])
    if not ids:
        print("El manifiesto no contiene IDs de registros. Nada que limpiar.")
        return

    print(f"=== LIMPIEZA DE INVENTARIO COMERCIAL POTOSÍ {'[MODO DRY-RUN]' if dry_run else ''} ===")
    print(f"IDs a eliminar ({len(ids)}): {ids}")

    db = SessionLocal()
    try:
        if dry_run:
            for rid in ids:
                reg = db.execute(text("SELECT id, sucursal_id, presentacion_id, cantidad_disponible FROM inventario_sucursal WHERE id = :id"), {"id": rid}).fetchone()
                if reg:
                    print(f"[DRY-RUN] Se eliminaría registro {reg.id}: presentacion_id={reg.presentacion_id}, cantidad={reg.cantidad_disponible}")
                else:
                    print(f"[DRY-RUN] Registro {rid} ya no existe en inventario_sucursal")
        else:
            eliminados = 0
            for rid in ids:
                res = db.execute(text("DELETE FROM inventario_sucursal WHERE id = :id AND sucursal_id = 2"), {"id": rid})
                if res.rowcount > 0:
                    eliminados += res.rowcount
                    print(f"[ELIMINADO] Registro ID {rid} de inventario_sucursal")
            db.commit()
            print(f"[OK] Total registros eliminados: {eliminados}")
            os.remove(MANIFEST_FILE)
            print(f"[OK] Manifiesto {MANIFEST_FILE} removido.")
    except Exception as e:
        db.rollback()
        print(f"ERROR durante la limpieza: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Limpiar inventario comercial de prueba para Potosí.")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin eliminar")
    args = parser.parse_args()
    clean_inventario_potosi(dry_run=args.dry_run)
