"""agregar_resubida_pendiente_comprobantes

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-11-12 11:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd2e3f4a5b6c7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'ComprobanteArchivo' AND column_name = 'ResubidaPendiente'
            ) THEN
                ALTER TABLE public."ComprobanteArchivo" ADD COLUMN "ResubidaPendiente" BOOLEAN DEFAULT FALSE;
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public."ComprobanteArchivo" DROP COLUMN IF EXISTS "ResubidaPendiente";
    """)
