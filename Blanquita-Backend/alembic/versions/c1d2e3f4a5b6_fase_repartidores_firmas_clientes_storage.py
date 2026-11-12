"""fase_repartidores_firmas_clientes_storage

Revision ID: c1d2e3f4a5b6
Revises: 8f5a1b02cd67
Create Date: 2026-11-12 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c1d2e3f4a5b6'
down_revision = '8f5a1b02cd67'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Campo NombrePropietario en Cliente
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Cliente' AND column_name = 'NombrePropietario') THEN
                ALTER TABLE public."Cliente" ADD COLUMN "NombrePropietario" VARCHAR(150);
            END IF;
        END $$;
    """)

    # 2. Campos para segunda firma (cliente/receptor) en NotaVenta
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NotaVenta' AND column_name = 'FirmaClienteUrl') THEN
                ALTER TABLE public."NotaVenta" ADD COLUMN "FirmaClienteUrl" TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NotaVenta' AND column_name = 'FirmaClienteNombre') THEN
                ALTER TABLE public."NotaVenta" ADD COLUMN "FirmaClienteNombre" VARCHAR(150);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'NotaVenta' AND column_name = 'FirmaClienteCi') THEN
                ALTER TABLE public."NotaVenta" ADD COLUMN "FirmaClienteCi" VARCHAR(30);
            END IF;
        END $$;
    """)

    # 3. Campos de Storage y proveedor en ComprobanteArchivo
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ComprobanteArchivo' AND column_name = 'StorageProvider') THEN
                ALTER TABLE public."ComprobanteArchivo" ADD COLUMN "StorageProvider" VARCHAR(30) DEFAULT 'local';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ComprobanteArchivo' AND column_name = 'StoragePath') THEN
                ALTER TABLE public."ComprobanteArchivo" ADD COLUMN "StoragePath" TEXT;
            END IF;
        END $$;
    """)

    # 4. Campos para permanencia de sobrante en camión en RendicionRuta
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RendicionRuta' AND column_name = 'SobrantePermaneceEnCamion') THEN
                ALTER TABLE public."RendicionRuta" ADD COLUMN "SobrantePermaneceEnCamion" BOOLEAN DEFAULT TRUE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'RendicionRuta' AND column_name = 'ValorSobranteRevalorizado') THEN
                ALTER TABLE public."RendicionRuta" ADD COLUMN "ValorSobranteRevalorizado" NUMERIC(12, 2) DEFAULT 0.00;
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public."Cliente" DROP COLUMN IF EXISTS "NombrePropietario";
        ALTER TABLE public."NotaVenta" DROP COLUMN IF EXISTS "FirmaClienteUrl";
        ALTER TABLE public."NotaVenta" DROP COLUMN IF EXISTS "FirmaClienteNombre";
        ALTER TABLE public."NotaVenta" DROP COLUMN IF EXISTS "FirmaClienteCi";
        ALTER TABLE public."ComprobanteArchivo" DROP COLUMN IF EXISTS "StorageProvider";
        ALTER TABLE public."ComprobanteArchivo" DROP COLUMN IF EXISTS "StoragePath";
        ALTER TABLE public."RendicionRuta" DROP COLUMN IF EXISTS "SobrantePermaneceEnCamion";
        ALTER TABLE public."RendicionRuta" DROP COLUMN IF EXISTS "ValorSobranteRevalorizado";
    """)
