"""
Script de Limpieza Selectiva de Datos de Prueba (Módulos de Logística y Ventas - Kevin)
Papelera Blanquita.

ADVERTENCIA:
Este script está diseñado para ejecutarse EXCLUSIVAMENTE en entornos de desarrollo/staging
o para depurar corridas de pruebas automáticas en las tablas comerciales de Kevin.
Bajo NINGUNA circunstancia afecta las tablas de producción/planta de Fabricio ni los
registros de configuración de sistema (roles, usuarios base, sucursales, plantas).

Modo por defecto: --dry-run (solo simulación y conteo de filas, no aplica cambios).
Para ejecutar realmente: python -m app.cli.limpiar_datos_prueba_kevin --confirm
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BACKEND_DIR / ".env")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("[ERROR] DATABASE_URL no configurada en .env")
    sys.exit(1)

# Tablas comerciales de Kevin seguras de purgar para pruebas
TABLAS_OBJETIVO = [
    ("mermas_envio", "Mermas registradas en envíos de inventario"),
    ("detalles_envio_inventario", "Detalles de líneas de envíos comerciales"),
    ("envios_inventario", "Cabeceras de envíos multi-sucursal"),
    ("RevalorizacionInventarioChofer", "Historial de revalorización en camión por cambio de precio"),
    ("inventario_chofer", "Stock asignado a choferes de reparto"),
    ("ComprobanteArchivo", "Archivos adjuntos de comprobantes y remisiones"),
    ("NotificacionInterna", "Bandeja de notificaciones internas"),
]

def main():
    parser = argparse.ArgumentParser(
        description="Limpieza selectiva de datos de prueba en módulos de Kevin (Papelera Blanquita)"
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirma la ejecución real del borrado de datos. Si no se indica, corre en modo simulación (--dry-run).",
    )
    parser.add_argument(
        "--solo-envios",
        action="store_true",
        help="Limpiar únicamente envíos y sus mermas/detalles asociados.",
    )
    args = parser.parse_args()

    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    print("======================================================================")
    print(" SCRIPT DE LIMPIEZA SELECTIVA DE DATOS DE PRUEBA (MÓDULOS DE KEVIN)")
    print("======================================================================")
    print(f"Modo: {'EJECUCIÓN REAL (--confirm)' if args.confirm else 'SIMULACIÓN SEGURA (--dry-run)'}")
    print(f"Base de datos objetivo: {engine.url.database} en {engine.url.host}")
    print("----------------------------------------------------------------------")

    tablas_a_procesar = TABLAS_OBJETIVO
    if args.solo_envios:
        tablas_a_procesar = [
            t for t in TABLAS_OBJETIVO if "envio" in t[0]
        ]

    try:
        total_filas_a_borrar = 0
        conteo_por_tabla = {}

        # 1. Fase de Conteo
        for tabla, desc in tablas_a_procesar:
            try:
                res = session.execute(text(f'SELECT COUNT(*) FROM "{tabla}";')).scalar()
                conteo_por_tabla[tabla] = res
                total_filas_a_borrar += res
                print(f"[CONTEO] {tabla:35} -> {res:5} registros ({desc})")
            except Exception as e:
                session.rollback()
                print(f"[OMITIDA] {tabla:33} -> Tabla no existe o inaccesible: {e}")
                conteo_por_tabla[tabla] = 0

        print("----------------------------------------------------------------------")
        print(f"Total registros detectados para depuración: {total_filas_a_borrar}")

        if not args.confirm:
            print("\n[DRY-RUN FINALIZADO] Ningún registro fue modificado ni eliminado.")
            print("Para aplicar el borrado real de datos de prueba, ejecute:")
            print("python -m app.cli.limpiar_datos_prueba_kevin --confirm")
            session.rollback()
            return

        if total_filas_a_borrar == 0:
            print("\n[INFO] Las tablas ya se encuentran vacías. Nada que depurar.")
            return

        print("\n[PROCEDIENDO CON EL BORRADO TRANSACCIONAL EN CASCADA CONTROLADA...]")
        
        # 2. Borrado ordenado respetando dependencias de Foreign Keys
        for tabla, _ in tablas_a_procesar:
            if conteo_por_tabla.get(tabla, 0) > 0:
                print(f"Borrando registros de {tabla}...")
                session.execute(text(f'DELETE FROM "{tabla}";'))

        session.commit()
        print("\n[EXITO] Limpieza selectiva completada satisfactoriamente.")

    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Ocurrió una falla durante la ejecución: {e}")
        print("Se aplicó ROLLBACK completo. La base de datos no fue alterada.")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    main()
