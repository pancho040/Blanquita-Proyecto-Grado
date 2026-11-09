#!/usr/bin/env python3
"""
conciliar_envios_pendientes.py - Script CLI de Reconciliación de Descuentos en Planta.
Procesa en lote aquellos envíos despachados con DESCONTAR_PLANTA_ACTIVO=false para
descontar atómicamente el stock físico en la Planta Sucre una vez validada la política con Fabricio.
"""

import sys
import os
from decimal import Decimal
from pathlib import Path
from dotenv import load_dotenv

# Configurar entorno
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BACKEND_DIR / ".env")
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text
from app.Config.supabase import SessionLocal
from app.adapters.planta_fabricio_adapter import FabricioLegacyAdapter
from app.Services.Usuario.AuditService import AuditService


def conciliar_envios():
    print("=" * 70)
    print("RECONCILIACIÓN DE ENVÍOS PENDIENTES - PAPELERA BLANQUITA")
    print("=" * 70)

    # Forzar activación local del descuento en el contexto del script
    os.environ["DESCONTAR_PLANTA_ACTIVO"] = "true"

    db = SessionLocal()
    adapter = FabricioLegacyAdapter()

    try:
        stmt_pendientes = text("""
            SELECT id, numero_guia, origen_id, estado
            FROM public.envios_inventario
            WHERE origen_tipo = 'PLANTA'
              AND descuento_planta_aplicado = false
              AND estado IN ('EN_TRANSITO', 'RECEPCIONADO')
            ORDER BY created_at ASC;
        """)
        envios_pendientes = db.execute(stmt_pendientes).fetchall()

        if not envios_pendientes:
            print("[INFO] No hay envíos pendientes de conciliar con la Planta Sucre.")
            return

        print(f"[INFO] Se encontraron {len(envios_pendientes)} envíos pendientes de descuento en planta.")
        procesados = 0

        for env in envios_pendientes:
            eid = env.id
            guia = env.numero_guia
            planta_id = env.origen_id

            stmt_det = text("""
                SELECT presentacion_id, cantidad_enviada
                FROM public.detalles_envio_inventario
                WHERE envio_id = :eid;
            """)
            detalles = db.execute(stmt_det, {"eid": eid}).fetchall()

            print(f"  -> Procesando Guía {guia} (Envío #{eid}, Planta #{planta_id}) con {len(detalles)} ítems...")

            for d in detalles:
                pid = d.presentacion_id
                cant = Decimal(str(d.cantidad_enviada))

                adapter.descontar_stock_despacho(
                    session=db,
                    planta_id=planta_id,
                    presentacion_id=pid,
                    cantidad=cant,
                    usuario_id=1,  # Sistema / Admin
                    referencia_guia=f"{guia}-CONCILIADO"
                )

            # Marcar envío como conciliado
            db.execute(text("""
                UPDATE public.envios_inventario
                SET descuento_planta_aplicado = true
                WHERE id = :id;
            """), {"id": eid})

            AuditService.registrar_evento(
                db,
                id_usuario=1,
                usuario_nombre="CLI Conciliador",
                rol="Sistema",
                modulo_tabla="envios_inventario",
                accion="CONCILIACION_DESCUENTO_PLANTA",
                id_registro=str(eid),
                detalle=f"Descuento reconciliado en lote para envío {guia} sobre InventarioProductoTerminado."
            )

            db.commit()
            procesados += 1
            print(f"     [OK] Envío {guia} reconciliado con éxito.")

        print("=" * 70)
        print(f"[EXITO] Reconciliación finalizada: {procesados} envíos regularizados en la planta Sucre.")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error durante la reconciliación: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    conciliar_envios()
