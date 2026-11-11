"""fase_1_movil_idempotencia_y_dispositivos

Revision ID: 8f5a1b02cd67
Revises: 7e4f9c93ab56
Create Date: 2026-11-10 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '8f5a1b02cd67'
down_revision = '9a6b2c15ef78'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Tabla ClaveIdempotenciaProcesada
    op.create_table(
        'ClaveIdempotenciaProcesada',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('usuario_id', sa.Integer(), sa.ForeignKey('Usuario.IdUsuario', ondelete='CASCADE'), nullable=False),
        sa.Column('clave_idempotencia', sa.String(length=64), nullable=False),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('hash_cuerpo', sa.String(length=64), nullable=False),
        sa.Column('codigo_estado', sa.Integer(), nullable=False),
        sa.Column('cuerpo_respuesta', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('usuario_id', 'clave_idempotencia', name='uq_idempotencia_usuario_clave')
    )
    op.create_index('ix_idempotencia_clave', 'ClaveIdempotenciaProcesada', ['clave_idempotencia'])
    op.create_index('ix_idempotencia_usuario', 'ClaveIdempotenciaProcesada', ['usuario_id'])

    # RLS y restricciones de seguridad para ClaveIdempotenciaProcesada
    op.execute('ALTER TABLE public."ClaveIdempotenciaProcesada" ENABLE ROW LEVEL SECURITY;')
    op.execute('ALTER TABLE public."ClaveIdempotenciaProcesada" FORCE ROW LEVEL SECURITY;')
    op.execute('REVOKE ALL ON public."ClaveIdempotenciaProcesada" FROM anon, authenticated;')

    # 2. Tabla DispositivoUsuario
    op.create_table(
        'DispositivoUsuario',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('usuario_id', sa.Integer(), sa.ForeignKey('Usuario.IdUsuario', ondelete='CASCADE'), nullable=False),
        sa.Column('token_push', sa.String(length=255), nullable=False),
        sa.Column('plataforma', sa.String(length=20), nullable=False),
        sa.Column('version_app', sa.String(length=50), nullable=True),
        sa.Column('ultimo_uso', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('activo', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('usuario_id', 'token_push', name='uq_dispositivo_usuario_token')
    )
    op.create_index('ix_dispositivo_usuario_activo', 'DispositivoUsuario', ['usuario_id', 'activo'])

    # RLS y restricciones de seguridad para DispositivoUsuario
    op.execute('ALTER TABLE public."DispositivoUsuario" ENABLE ROW LEVEL SECURITY;')
    op.execute('ALTER TABLE public."DispositivoUsuario" FORCE ROW LEVEL SECURITY;')
    op.execute('REVOKE ALL ON public."DispositivoUsuario" FROM anon, authenticated;')


def downgrade():
    op.drop_table('DispositivoUsuario')
    op.drop_table('ClaveIdempotenciaProcesada')
