"""unificacion_permisos_sucursal

Revision ID: 4b1a8c90ef12
Revises: 3a4f89d12e45
Create Date: 2026-11-10 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

# revision identifiers, used by Alembic.
revision = '4b1a8c90ef12'
down_revision = '3a4f89d12e45'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Crear tabla usuario_sucursal_permiso
    op.create_table(
        'usuario_sucursal_permiso',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('id_usuario', sa.Integer(), sa.ForeignKey('Usuario.IdUsuario', ondelete='CASCADE'), nullable=False),
        sa.Column('id_sucursal', sa.Integer(), sa.ForeignKey('sucursales.id', ondelete='CASCADE'), nullable=True),
        sa.Column('puede_ver_todas', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('puede_escribir', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('creado_por', sa.Integer(), sa.ForeignKey('Usuario.IdUsuario', ondelete='SET NULL'), nullable=True),
    )
    
    # Crear índice único parcial: (id_usuario, id_sucursal)
    op.create_index(
        'ix_usp_usuario_sucursal',
        'usuario_sucursal_permiso',
        ['id_usuario', 'id_sucursal'],
        unique=True,
        postgresql_where=sa.text('id_sucursal IS NOT NULL')
    )
    # Crear índice único para la fila "puede_ver_todas"
    op.create_index(
        'ix_usp_usuario_todas',
        'usuario_sucursal_permiso',
        ['id_usuario'],
        unique=True,
        postgresql_where=sa.text('id_sucursal IS NULL')
    )

    # 2. Asegurar existencia de caja en Potosí (IdCaja=2, IdSucursal=2) y sincronizar secuencia
    op.execute("""
        INSERT INTO "Caja" ("IdCaja", "NombreCaja", "Descripcion", "Activa", "IdSucursal")
        VALUES (2, 'Caja Sucursal Potosí', 'Caja operativa comercial en sucursal Potosí', true, 2)
        ON CONFLICT ("IdCaja") DO UPDATE SET "IdSucursal" = 2;
        SELECT setval(pg_get_serial_sequence('"Caja"', 'IdCaja'), COALESCE((SELECT MAX("IdCaja") FROM "Caja"), 1));
    """)

    # 3. Población inicial de permisos garantizando que nadie pierda acceso:
    # - Gerente General (IdRol=3), Contador (IdRol=4) y Supervisor (IdRol=5) reciben permiso explícito de "ver todas".
    # - Todos los colaboradores reciben fila explícita para Sucre (IdSucursal=1).
    # - No se agregan filas de Potosí (IdSucursal=2) hasta confirmación explícita del usuario.
    op.execute("""
        -- Roles con acceso multisede explícito por rol (Gerencia General, Contabilidad, Supervisión)
        INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir)
        SELECT u."IdUsuario", NULL, true, true
        FROM "Usuario" u
        WHERE u."IdRol" IN (3, 4, 5)
        ON CONFLICT DO NOTHING;

        -- Acceso explícito a Sucre (1) para todos los colaboradores registrados
        INSERT INTO usuario_sucursal_permiso (id_usuario, id_sucursal, puede_ver_todas, puede_escribir)
        SELECT u."IdUsuario", 1, false, true
        FROM "Usuario" u
        WHERE NOT EXISTS (
            SELECT 1 FROM usuario_sucursal_permiso usp
            WHERE usp.id_usuario = u."IdUsuario" AND usp.id_sucursal = 1
        );
    """)


def downgrade():
    op.drop_index('ix_usp_usuario_todas', table_name='usuario_sucursal_permiso')
    op.drop_index('ix_usp_usuario_sucursal', table_name='usuario_sucursal_permiso')
    op.drop_table('usuario_sucursal_permiso')
    op.execute("""
        DELETE FROM "Caja" WHERE "IdCaja" = 2;
        SELECT setval(pg_get_serial_sequence('"Caja"', 'IdCaja'), COALESCE((SELECT MAX("IdCaja") FROM "Caja"), 1));
    """)
