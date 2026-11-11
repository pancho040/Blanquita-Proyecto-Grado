from sqlalchemy import text
from app.Config.supabase import SessionLocal

db = SessionLocal()
res = db.execute(text("""
    SELECT 
        COUNT(*) as total_filas,
        COUNT(CASE WHEN "SaldoPendiente" > 0 THEN 1 END) as con_saldo,
        COUNT(CASE WHEN "SaldoPendiente" = 0 THEN 1 END) as sin_saldo,
        COUNT(CASE WHEN "IdSucursal" = 1 THEN 1 END) as sucre_total,
        COUNT(CASE WHEN "IdSucursal" = 1 AND "SaldoPendiente" > 0 THEN 1 END) as sucre_con_saldo,
        COUNT(CASE WHEN "IdSucursal" IS NULL THEN 1 END) as null_total,
        COUNT(CASE WHEN "IdSucursal" IS NULL AND "SaldoPendiente" > 0 THEN 1 END) as null_con_saldo,
        COALESCE(SUM("SaldoPendiente"), 0) as saldo_total,
        COALESCE(SUM(CASE WHEN "IdSucursal" = 1 THEN "SaldoPendiente" ELSE 0 END), 0) as saldo_sucre,
        COALESCE(SUM(CASE WHEN "IdSucursal" IS NULL THEN "SaldoPendiente" ELSE 0 END), 0) as saldo_null
    FROM "CuentaCobrar";
""")).fetchone()

print("DETALLE DE CUENTAS POR COBRAR:")
for k, v in res._mapping.items():
    print(f"  {k}: {v}")

db.close()
