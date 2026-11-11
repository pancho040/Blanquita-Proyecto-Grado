from sqlalchemy import text
from app.Config.supabase import SessionLocal

db = SessionLocal()
res = db.execute(text("""
    SELECT 
        COUNT(*) as total_pendientes,
        COUNT(CASE WHEN cxc."IdSucursal" = 1 THEN 1 END) as sucre,
        COUNT(CASE WHEN cxc."IdSucursal" = 2 THEN 1 END) as potosi,
        COUNT(CASE WHEN cxc."IdSucursal" IS NULL THEN 1 END) as nulos
    FROM "AbonoCuentaCobrar" a
    JOIN "CuentaCobrar" cxc ON a."IdCuentaCobrar" = cxc."IdCuentaCobrar"
    WHERE a."EstadoAprobacion" = 'PENDIENTE_APROBACION';
""")).fetchone()

print("ABONOS EN ESTADO PENDIENTE_APROBACION:")
print("  Total:", res.total_pendientes)
print("  Sucre (cxc.IdSucursal=1):", res.sucre)
print("  Potosi (cxc.IdSucursal=2):", res.potosi)
print("  Nulos (cxc.IdSucursal IS NULL):", res.nulos)

db.close()
