"""agregar_idsucursal_a_movimientocaja

Revision ID: 6d3e8b82fa45
Revises: 5c2b9a71ef34
Create Date: 2026-11-10 22:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '6d3e8b82fa45'
down_revision = '5c2b9a71ef34'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Agregar columna IdSucursal (aditiva, nullable) a MovimientoCaja
    op.add_column(
        'MovimientoCaja',
        sa.Column('IdSucursal', sa.Integer(), sa.ForeignKey('sucursales.id', ondelete='RESTRICT'), nullable=True)
    )
    # 2. Índice de optimización de filtros por sede
    op.create_index(
        'ix_movimientocaja_idsucursal',
        'MovimientoCaja',
        ['IdSucursal']
    )


def downgrade():
    op.drop_index('ix_movimientocaja_idsucursal', table_name='MovimientoCaja')
    op.drop_column('MovimientoCaja', 'IdSucursal')
