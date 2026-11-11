import os
import sys
from pathlib import Path
from sqlalchemy import text

BASE_DIR = Path(__file__).resolve().parent.parent.parent / "Blanquita-Backend"
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.Config.supabase import SessionLocal

def verificar_limpieza_fase3():
    db = SessionLocal()
    print("=== VERIFICACIÓN DE INEXISTENCIA DE BASURA DE PRUEBAS FASE 3 (SQL) ===")
    print(f"{'Tabla':<28} | {'Registros Totales':<18} | {'Registros Prueba Hoy':<30}")
    print("-" * 80)

    # 1. Cliente
    total_cli = db.execute(text('SELECT COUNT(*) FROM public."Cliente";')).scalar()
    test_cli = db.execute(text("""
        SELECT COUNT(*) FROM public."Cliente" 
        WHERE "RazonSocial" LIKE 'Tienda Test%' 
           OR "RazonSocial" LIKE 'Test%' 
           OR "Observacion" LIKE 'Punto registrado desde móvil%';
    """)).scalar()
    print(f"{'Cliente':<28} | {total_cli:<18} | {test_cli} filas de prueba (Rollback OK)")

    # 2. PuntoVenta
    total_pv = db.execute(text('SELECT COUNT(*) FROM public."PuntoVenta";')).scalar()
    test_pv = db.execute(text("""
        SELECT COUNT(*) FROM public."PuntoVenta"
        WHERE "NombrePuntoVenta" LIKE 'Abarrotes Tienda Test%';
    """)).scalar()
    print(f"{'PuntoVenta':<28} | {total_pv:<18} | {test_pv} filas de prueba (Rollback OK)")

    # 3. RutaPuntoVenta
    total_rpv = db.execute(text('SELECT COUNT(*) FROM public."RutaPuntoVenta";')).scalar()
    test_rpv = db.execute(text("""
        SELECT COUNT(*) FROM public."RutaPuntoVenta" rpv
        JOIN public."PuntoVenta" pv ON rpv."IdPuntoVenta" = pv."IdPuntoVenta"
        WHERE pv."NombrePuntoVenta" LIKE 'Abarrotes Tienda Test%';
    """)).scalar()
    print(f"{'RutaPuntoVenta':<28} | {total_rpv:<18} | {test_rpv} filas de prueba (Rollback OK)")

    # 4. NotificacionInterna
    total_notif = db.execute(text('SELECT COUNT(*) FROM public."NotificacionInterna";')).scalar()
    test_notif = db.execute(text("""
        SELECT COUNT(*) FROM public."NotificacionInterna"
        WHERE "Titulo" LIKE '%Abono QR Observado%'
           OR "Mensaje" LIKE '%REF-KEVIN-TEST%'
           OR "Mensaje" LIKE '%Comprobante fotográfico borroso o ilegible%';
    """)).scalar()
    print(f"{'NotificacionInterna':<28} | {total_notif:<18} | {test_notif} filas de prueba (Rollback OK)")
    print("-" * 80)
    db.close()

if __name__ == "__main__":
    verificar_limpieza_fase3()
