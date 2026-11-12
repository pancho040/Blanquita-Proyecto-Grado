"""fase_repartidores_refresh_token_movil

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-11-12 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e3f4a5b6c7d8'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'RefreshTokenMovil',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('usuario_id', sa.Integer(), sa.ForeignKey('Usuario.IdUsuario', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False, unique=True),
        sa.Column('familia_id', sa.String(length=64), nullable=False),
        sa.Column('dispositivo_id', sa.String(length=255), nullable=True),
        sa.Column('supabase_refresh_token', sa.Text(), nullable=True),
        sa.Column('expira_en', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revocado', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('motivo_revocacion', sa.String(length=50), nullable=True),
        sa.Column('fecha_revocacion', sa.DateTime(timezone=True), nullable=True),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False)
    )
    op.create_index('ix_refresh_token_movil_hash', 'RefreshTokenMovil', ['token_hash'])
    op.create_index('ix_refresh_token_movil_familia', 'RefreshTokenMovil', ['familia_id'])
    op.create_index('ix_refresh_token_movil_usuario', 'RefreshTokenMovil', ['usuario_id'])

    # RLS de seguridad
    op.execute('ALTER TABLE public."RefreshTokenMovil" ENABLE ROW LEVEL SECURITY;')
    op.execute('ALTER TABLE public."RefreshTokenMovil" FORCE ROW LEVEL SECURITY;')
    op.execute('REVOKE ALL ON public."RefreshTokenMovil" FROM anon, authenticated;')


def downgrade():
    op.drop_table('RefreshTokenMovil')
