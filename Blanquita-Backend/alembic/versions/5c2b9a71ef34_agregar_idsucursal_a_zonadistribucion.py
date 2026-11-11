"""agregar_idsucursal_a_zonadistribucion

Revision ID: 5c2b9a71ef34
Revises: 4b1a8c90ef12
Create Date: 2026-11-10 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5c2b9a71ef34'
down_revision = '4b1a8c90ef12'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Agregar columna IdSucursal a ZonaDistribucion (nullable inicialmente para permitir backfill ordenado)
    op.add_column(
        'ZonaDistribucion',
        sa.Column('IdSucursal', sa.Integer(), sa.ForeignKey('sucursales.id', ondelete='RESTRICT'), nullable=True)
    )
    # 2. Crear índice para optimizar filtros territoriales
    op.create_index(
        'ix_zonadistribucion_idsucursal',
        'ZonaDistribucion',
        ['IdSucursal']
    )


def downgrade():
    # 1. Eliminar índice
    op.drop_index('ix_zonadistribucion_idsucursal', table_name='ZonaDistribucion')
    # 2. Eliminar columna IdSucursal
    op.drop_column('ZonaDistribucion', 'IdSucursal')
