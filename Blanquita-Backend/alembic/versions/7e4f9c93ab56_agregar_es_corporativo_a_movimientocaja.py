"""agregar_es_corporativo_a_movimientocaja

Revision ID: 7e4f9c93ab56
Revises: 6d3e8b82fa45
Create Date: 2026-11-10 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '7e4f9c93ab56'
down_revision = '6d3e8b82fa45'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Agregar columna es_corporativo (booleano explícito, default false, not null)
    op.add_column(
        'MovimientoCaja',
        sa.Column('es_corporativo', sa.Boolean(), server_default=sa.text('false'), nullable=False)
    )
    # 2. Índice para consultas y filtros corporativos
    op.create_index(
        'ix_movimientocaja_es_corporativo',
        'MovimientoCaja',
        ['es_corporativo']
    )


def downgrade():
    op.drop_index('ix_movimientocaja_es_corporativo', table_name='MovimientoCaja')
    op.drop_column('MovimientoCaja', 'es_corporativo')
