"""tabla aditiva saldo_favor_cliente e insercion idempotente pedidos 461 y 462

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-15 21:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Crear tabla aditiva e idempotente public.saldo_favor_cliente
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.saldo_favor_cliente (
        id BIGSERIAL PRIMARY KEY,
        id_cliente INTEGER NOT NULL,
        id_pedido BIGINT,
        id_pago BIGINT,
        monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
        motivo TEXT NOT NULL,
        estado TEXT NOT NULL DEFAULT 'PENDIENTE',
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        usado_en TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS ix_saldo_favor_cliente_id_cliente ON public.saldo_favor_cliente (id_cliente);
    CREATE INDEX IF NOT EXISTS ix_saldo_favor_cliente_id_pedido ON public.saldo_favor_cliente (id_pedido);
    CREATE INDEX IF NOT EXISTS ix_saldo_favor_cliente_estado ON public.saldo_favor_cliente (estado);
    """)

    # 2. Inserción idempotente de saldos a favor auditados
    op.execute("""
    INSERT INTO public.saldo_favor_cliente (
        id_cliente, id_pedido, id_pago, monto, motivo, estado, creado_en
    )
    SELECT 192, 461, 281, 78.44, 'Excedente de cobro sobre entrega parcial (Pedido 461)', 'PENDIENTE', now()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.saldo_favor_cliente WHERE id_pedido = 461
    );

    INSERT INTO public.saldo_favor_cliente (
        id_cliente, id_pedido, id_pago, monto, motivo, estado, creado_en
    )
    SELECT 193, 462, 282, 10.68, 'Excedente de cobro sobre entrega parcial (Pedido 462)', 'PENDIENTE', now()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.saldo_favor_cliente WHERE id_pedido = 462
    );
    """)


def downgrade():
    op.execute("""
    DROP TABLE IF EXISTS public.saldo_favor_cliente CASCADE;
    """)
