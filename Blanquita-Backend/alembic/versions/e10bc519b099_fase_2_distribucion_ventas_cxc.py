"""fase_2_distribucion_ventas_cxc

Revision ID: e10bc519b099
Revises: 3232a4f2311a
Create Date: 2026-11-09 00:56:37.643904
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e10bc519b099'
down_revision: Union[str, Sequence[str], None] = '3232a4f2311a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. EXTENSIONES ADITIVAS A NOTAVENTA (Subagente A - NV-501, Chofer, Firma, Pagos Mixtos)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."NotaVenta"
        ADD COLUMN IF NOT EXISTS "IdChofer" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "FirmaDigitalUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "FirmaNombre" TEXT,
        ADD COLUMN IF NOT EXISTS "FirmaCi" TEXT,
        ADD COLUMN IF NOT EXISTS "FirmaFecha" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "ObservacionAjuste" TEXT,
        ADD COLUMN IF NOT EXISTS "EditadoPorKevin" BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "MetodoPago" TEXT DEFAULT 'Efectivo',
        ADD COLUMN IF NOT EXISTS "MontoEfectivo" NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "MontoQR" NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "MontoCredito" NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "ComprobanteQRArchivoId" INTEGER REFERENCES public."ComprobanteArchivo"("IdComprobante") ON DELETE SET NULL;
    """)

    # -------------------------------------------------------------------------
    # 2. EXTENSIONES ADITIVAS A DETALLENOTAVENTA (Subagente A - Bandeo)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."DetalleNotaVenta"
        ADD COLUMN IF NOT EXISTS "EsBonificacionBandeo" BOOLEAN NOT NULL DEFAULT FALSE;
    """)

    # -------------------------------------------------------------------------
    # 3. EXTENSIONES ADITIVAS A RENDICIONRUTA (Subagente A - Cierre de Turno y Mermas)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."RendicionRuta"
        ADD COLUMN IF NOT EXISTS "MontoFaltante" NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "CantidadMerma" NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "ObservacionesCierre" TEXT,
        ADD COLUMN IF NOT EXISTS "EstadoConciliacion" TEXT NOT NULL DEFAULT 'PENDIENTE',
        ADD COLUMN IF NOT EXISTS "IdSucursal" INTEGER REFERENCES public."sucursales"("id") ON DELETE RESTRICT;
    """)

    # -------------------------------------------------------------------------
    # 4. EXTENSIONES ADITIVAS A CUENTACOBRAR Y ABONOCUENTACOBRAR (Subagente B - QR y Mora)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."CuentaCobrar"
        ADD COLUMN IF NOT EXISTS "EstadoCobranza" TEXT NOT NULL DEFAULT 'VIGENTE';

    ALTER TABLE public."AbonoCuentaCobrar"
        ADD COLUMN IF NOT EXISTS "EstadoAprobacion" TEXT NOT NULL DEFAULT 'PENDIENTE_APROBACION',
        ADD COLUMN IF NOT EXISTS "AprobadoPor" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "FechaAprobacion" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "IdComprobanteArchivo" INTEGER REFERENCES public."ComprobanteArchivo"("IdComprobante") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "MetodoPago" TEXT DEFAULT 'Efectivo';
    """)

    # -------------------------------------------------------------------------
    # 5. TABLAS DE DISTRIBUIDORES EXTERNOS (Subagente C - Oruro, Tarija, La Paz, Tupiza)
    # -------------------------------------------------------------------------
    op.execute("""
    CREATE TABLE IF NOT EXISTS public."distribuidores_externos" (
        "id" SERIAL PRIMARY KEY,
        "id_usuario" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL,
        "nombre_comercial" TEXT NOT NULL,
        "contacto_nombre" TEXT NOT NULL,
        "telefono" TEXT,
        "ciudad" TEXT NOT NULL,
        "nit_ci" TEXT,
        "direccion" TEXT,
        "activo" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public."pedidos_distribuidores" (
        "id" SERIAL PRIMARY KEY,
        "codigo_pedido" TEXT NOT NULL UNIQUE,
        "distribuidor_id" INTEGER NOT NULL REFERENCES public."distribuidores_externos"("id") ON DELETE RESTRICT,
        "fecha_pedido" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_REVISION',
        "monto_total" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "id_comprobante_archivo" INTEGER REFERENCES public."ComprobanteArchivo"("IdComprobante") ON DELETE SET NULL,
        "observacion_kevin" TEXT,
        "observacion_distribuidor" TEXT,
        "fecha_aprobacion" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public."detalles_pedido_distribuidor" (
        "id" SERIAL PRIMARY KEY,
        "pedido_id" INTEGER NOT NULL REFERENCES public."pedidos_distribuidores"("id") ON DELETE CASCADE,
        "presentacion_id" INTEGER NOT NULL REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
        "cantidad_solicitada" NUMERIC(10,2) NOT NULL,
        "cantidad_aprobada" NUMERIC(10,2),
        "precio_unitario" NUMERIC(10,2) NOT NULL,
        "subtotal" NUMERIC(12,2) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "idx_pedidos_dist_distribuidor" ON public."pedidos_distribuidores"("distribuidor_id");
    CREATE INDEX IF NOT EXISTS "idx_pedidos_dist_estado" ON public."pedidos_distribuidores"("estado");
    CREATE INDEX IF NOT EXISTS "idx_det_pedidos_dist_pedido" ON public."detalles_pedido_distribuidor"("pedido_id");
    """)

    # -------------------------------------------------------------------------
    # 6. SEED INICIAL: Distribuidores de prueba en Oruro, Tarija, La Paz y Tupiza
    # -------------------------------------------------------------------------
    op.execute("""
    INSERT INTO public."distribuidores_externos" ("id", "nombre_comercial", "contacto_nombre", "telefono", "ciudad", "nit_ci", "direccion")
    VALUES 
        (1, 'Distribuidora Altiplano Oruro', 'Carlos Mamani', '71234567', 'Oruro', '4589201015', 'Av. 6 de Octubre #450'),
        (2, 'Comercializadora del Sur Tarija', 'Paola Zenteno', '72345678', 'Tarija', '3210984012', 'Calle Las Retamas #12'),
        (3, 'Papeles La Paz Mayorista', 'Rodrigo Quispe', '73456789', 'La Paz', '8901235019', 'Zona Villa Fátima #88'),
        (4, 'Distribuidora Frontera Tupiza', 'Marcos Flores', '74567890', 'Tupiza', '5678901011', 'Av. Santa Cruz #204')
    ON CONFLICT ("id") DO NOTHING;
    SELECT setval(pg_get_serial_sequence('public.distribuidores_externos', 'id'), coalesce(max(id), 1)) FROM public."distribuidores_externos";
    """)


def downgrade() -> None:
    op.execute("""
    DROP TABLE IF EXISTS public."detalles_pedido_distribuidor" CASCADE;
    DROP TABLE IF EXISTS public."pedidos_distribuidores" CASCADE;
    DROP TABLE IF EXISTS public."distribuidores_externos" CASCADE;

    ALTER TABLE public."AbonoCuentaCobrar"
        DROP COLUMN IF EXISTS "EstadoAprobacion",
        DROP COLUMN IF EXISTS "AprobadoPor",
        DROP COLUMN IF EXISTS "FechaAprobacion",
        DROP COLUMN IF EXISTS "IdComprobanteArchivo",
        DROP COLUMN IF EXISTS "MetodoPago";

    ALTER TABLE public."CuentaCobrar"
        DROP COLUMN IF EXISTS "EstadoCobranza";

    ALTER TABLE public."RendicionRuta"
        DROP COLUMN IF EXISTS "MontoFaltante",
        DROP COLUMN IF EXISTS "CantidadMerma",
        DROP COLUMN IF EXISTS "ObservacionesCierre",
        DROP COLUMN IF EXISTS "EstadoConciliacion",
        DROP COLUMN IF EXISTS "IdSucursal";

    ALTER TABLE public."DetalleNotaVenta"
        DROP COLUMN IF EXISTS "EsBonificacionBandeo";

    ALTER TABLE public."NotaVenta"
        DROP COLUMN IF EXISTS "IdChofer",
        DROP COLUMN IF EXISTS "FirmaDigitalUrl",
        DROP COLUMN IF EXISTS "FirmaNombre",
        DROP COLUMN IF EXISTS "FirmaCi",
        DROP COLUMN IF EXISTS "FirmaFecha",
        DROP COLUMN IF EXISTS "ObservacionAjuste",
        DROP COLUMN IF EXISTS "EditadoPorKevin",
        DROP COLUMN IF EXISTS "MetodoPago",
        DROP COLUMN IF EXISTS "MontoEfectivo",
        DROP COLUMN IF EXISTS "MontoQR",
        DROP COLUMN IF EXISTS "MontoCredito",
        DROP COLUMN IF EXISTS "ComprobanteQRArchivoId";
    """)
