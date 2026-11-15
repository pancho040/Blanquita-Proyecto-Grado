"""cierre_turno_check_constraint

Revision ID: a1b2c3d4e5f6
Revises: f4a5b6c7d8e9
Create Date: 2026-11-15 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f4a5b6c7d8e9'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
    ALTER TABLE public."AsignacionRuta"
        DROP CONSTRAINT IF EXISTS "AsignacionRuta_Estado_check";

    ALTER TABLE public."AsignacionRuta"
        ADD CONSTRAINT "AsignacionRuta_Estado_check"
        CHECK ("Estado" = ANY (ARRAY['Pendiente'::text, 'En Ruta'::text, 'Finalizada'::text, 'Completada'::text, 'Cancelada'::text]));
    """)

def downgrade():
    op.execute("""
    ALTER TABLE public."AsignacionRuta"
        DROP CONSTRAINT IF EXISTS "AsignacionRuta_Estado_check";

    ALTER TABLE public."AsignacionRuta"
        ADD CONSTRAINT "AsignacionRuta_Estado_check"
        CHECK ("Estado" = ANY (ARRAY['Pendiente'::text, 'En Ruta'::text, 'Finalizada'::text, 'Cancelada'::text]));
    """)
