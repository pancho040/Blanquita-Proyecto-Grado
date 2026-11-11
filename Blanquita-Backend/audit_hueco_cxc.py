from sqlalchemy import text
from app.Config.supabase import SessionLocal

db = SessionLocal()
try:
    print("=== 1. CUENTAS COBRAR CON IdSucursal IS NULL ===")
    res = db.execute(text("""
        SELECT 
            cc."IdCuentaCobrar", 
            cc."IdNotaVenta", 
            cc."IdCliente", 
            cc."IdSucursal", 
            cc."MontoTotal", 
            cc."SaldoPendiente",
            nv."IdSucursal" as sede_nv,
            c."IdSucursal" as sede_cli,
            c."RazonSocial"
        FROM "CuentaCobrar" cc
        LEFT JOIN "NotaVenta" nv ON cc."IdNotaVenta" = nv."IdNotaVenta"
        LEFT JOIN "Cliente" c ON cc."IdCliente" = c."IdCliente"
        WHERE cc."IdSucursal" IS NULL;
    """)).fetchall()
    print(f"Total CuentaCobrar con IdSucursal NULL: {len(res)}")
    for r in res[:10]:
        print(" ", dict(r._mapping))

    # Ver si hay alguna donde nv.IdSucursal y c.IdSucursal sean distintos o ambiguos
    ambiguas = [r for r in res if r.sede_nv is not None and r.sede_cli is not None and r.sede_nv != r.sede_cli]
    sin_origen = [r for r in res if r.sede_nv is None and r.sede_cli is None]
    print(f"Filas ambiguas (sede_nv != sede_cli): {len(ambiguas)}")
    print(f"Filas sin origen (ambos None): {len(sin_origen)}")

    # Ver cómo filtra ListarCuentasCobrar en CuentasCobrarRepository
    print("\n=== 2. TOTALES EN CuentaCobrar ===")
    total_cc = db.execute(text('SELECT COUNT(*) FROM "CuentaCobrar"')).scalar()
    sucre_cc = db.execute(text('SELECT COUNT(*) FROM "CuentaCobrar" WHERE "IdSucursal" = 1')).scalar()
    potosi_cc = db.execute(text('SELECT COUNT(*) FROM "CuentaCobrar" WHERE "IdSucursal" = 2')).scalar()
    null_cc = db.execute(text('SELECT COUNT(*) FROM "CuentaCobrar" WHERE "IdSucursal" IS NULL')).scalar()
    print(f"Total: {total_cc} | Sucre (1): {sucre_cc} | Potosí (2): {potosi_cc} | NULL: {null_cc}")

    print("\n=== 3. ABONOS PENDIENTES Y SUS CUENTAS ASOCIADAS ===")
    total_abonos = db.execute(text('SELECT COUNT(*) FROM "AbonoCuentaCobrar"')).scalar()
    abonos_cc_null = db.execute(text("""
        SELECT COUNT(*) 
        FROM "AbonoCuentaCobrar" a
        JOIN "CuentaCobrar" cc ON a."IdCuentaCobrar" = cc."IdCuentaCobrar"
        WHERE cc."IdSucursal" IS NULL;
    """)).scalar()
    print(f"Total AbonoCuentaCobrar: {total_abonos}")
    print(f"Abonos vinculados a CuentaCobrar con IdSucursal NULL: {abonos_cc_null}")

finally:
    db.close()
