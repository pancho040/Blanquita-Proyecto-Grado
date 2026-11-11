"""check_movimientocaja_sede_o_corporativo

Revision ID: 9a6b2c15ef78
Revises: 8f5a1b02cd67
Create Date: 2026-11-10 23:55:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9a6b2c15ef78'
down_revision = '7e4f9c93ab56'
branch_labels = None
depends_on = None


def upgrade():
    op.create_check_constraint(
        'ck_movimientocaja_sede_o_corporativo',
        'MovimientoCaja',
        '("IdSucursal" IS NOT NULL AND es_corporativo = false) OR ("IdSucursal" IS NULL AND es_corporativo = true)'
    )


def downgrade():
    op.drop_constraint('ck_movimientocaja_sede_o_corporativo', 'MovimientoCaja', type_='check')
