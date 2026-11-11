"""
Script Idempotente de Siembra de Inventario de Prueba para Sucursal Potosí (IdSucursal = 2)
Sistema ERP Papelera Blanquita

Reglas:
- No modifica esquemas ni toca tablas de Planta (Zona Protegida).
- Soporta argumento --dry-run para simulación sin persistir.
- Genera manifiesto JSON en docs/manifests/ para limpieza controlada.
- Idempotente: si ya existe inventario para presentacion_id en sucursal_id=2, no duplica.
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from sqlalchemy import text
from app.Config.supabase import SessionLocal

MANIFEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../docs/manifests"))
MANIFEST_FILE = os.path.join(MANIFEST_DIR, "manifest_inventario_potosi_test.json")

ITEMS_A_SEMBRAR = [
    {"presentacion_id": 10, "cantidad_disponible": Decimal("250.00"), "cantidad_reservada": Decimal("0.00"), "nota": "TEST Potosí PH Clásico"},
    {"presentacion_id": 11, "cantidad_disponible": Decimal("180.00"), "cantidad_reservada": Decimal("0.00"), "nota": "TEST Potosí PH Rendidor"},
    {"presentacion_id": 13, "cantidad_disponible": Decimal("120.00"), "cantidad_reservada": Decimal("0.00"), "nota": "TEST Potosí Toalla Interdoblada"},
    {"presentacion_id": 14, "cantidad_disponible": Decimal("90.00"), "cantidad_reservada": Decimal("0.00"), "nota": "TEST Potosí Servilleta Estándar"},
]

def seed_inventario_potosi(dry_run: bool = False):
    os.makedirs(MANIFEST_DIR, exist_ok=True)
    db = SessionLocal()
    inserted_ids = []

    print(f"=== SIEMBRA DE INVENTARIO COMERCIAL POTOSÍ (IdSucursal=2) {'[MODO DRY-RUN]' if dry_run else ''} ===")

    try:
        # Verificar que la sucursal 2 existe y está activa
        suc_activa = db.execute(text("SELECT id, nombre, activa FROM sucursales WHERE id = 2")).fetchone()
        if not suc_activa or not suc_activa.activa:
            print("ERROR: La sucursal 2 (Potosí) no existe o no está activa.")
            return

        for item in ITEMS_A_SEMBRAR:
            pid = item["presentacion_id"]
            cant_disp = item["cantidad_disponible"]
            cant_res = item["cantidad_reservada"]

            # Comprobar idempotencia
            existente = db.execute(
                text("SELECT id, cantidad_disponible FROM inventario_sucursal WHERE sucursal_id = 2 AND presentacion_id = :pid"),
                {"pid": pid}
            ).fetchone()

            if existente:
                print(f"[YA EXISTE] Presentación {pid} en Sucursal 2 (ID registro: {existente.id}, Cantidad: {existente.cantidad_disponible}). Omitiendo.")
                inserted_ids.append(existente.id)
                continue

            if dry_run:
                print(f"[DRY-RUN] Se insertaría presentacion_id={pid}, cantidad_disponible={cant_disp}, cantidad_reservada={cant_res} en sucursal_id=2")
            else:
                stmt = text("""
                    INSERT INTO inventario_sucursal (sucursal_id, presentacion_id, cantidad_disponible, cantidad_reservada, updated_at)
                    VALUES (2, :pid, :cant_disp, :cant_res, :ahora)
                    RETURNING id
                """)
                nuevo_id = db.execute(stmt, {
                    "pid": pid,
                    "cant_disp": cant_disp,
                    "cant_res": cant_res,
                    "ahora": datetime.now(timezone.utc)
                }).scalar()
                inserted_ids.append(nuevo_id)
                print(f"[INSERTADO] ID {nuevo_id}: presentacion_id={pid}, cantidad={cant_disp} en Sucursal 2 (Potosí)")

        if not dry_run:
            db.commit()
            # Guardar manifiesto
            manifest_data = {
                "tipo": "inventario_sucursal_potosi_test",
                "fecha": datetime.now(timezone.utc).isoformat(),
                "sucursal_id": 2,
                "registro_ids": inserted_ids,
                "observacion": "TEST"
            }
            with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
                json.dump(manifest_data, f, indent=2)
            print(f"[OK] Manifiesto guardado en: {MANIFEST_FILE}")
        else:
            print("[DRY-RUN] Simulación completa. No se modificó la base de datos.")

    except Exception as e:
        db.rollback()
        print(f"ERROR durante la siembra: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sembrar inventario comercial de prueba para Potosí.")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin persistir en la base de datos")
    args = parser.parse_args()
    seed_inventario_potosi(dry_run=args.dry_run)
