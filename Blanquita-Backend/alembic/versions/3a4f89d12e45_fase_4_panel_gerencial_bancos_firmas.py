"""fase_4_panel_gerencial_bancos_firmas

Revision ID: 3a4f89d12e45
Revises: 2665f0075b65
Create Date: 2026-11-09 02:12:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a4f89d12e45'
down_revision: Union[str, Sequence[str], None] = '2665f0075b65'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Columnas aditivas a CuentaBancariaEmpresa
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CuentaBancariaEmpresa' AND column_name = 'Proposito') THEN
                ALTER TABLE "CuentaBancariaEmpresa" ADD COLUMN "Proposito" VARCHAR(60) NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CuentaBancariaEmpresa' AND column_name = 'SaldoConciliado') THEN
                ALTER TABLE "CuentaBancariaEmpresa" ADD COLUMN "SaldoConciliado" NUMERIC(14,2) NOT NULL DEFAULT 0.00;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CuentaBancariaEmpresa' AND column_name = 'FechaUltimaConciliacion') THEN
                ALTER TABLE "CuentaBancariaEmpresa" ADD COLUMN "FechaUltimaConciliacion" TIMESTAMP WITH TIME ZONE NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'CuentaBancariaEmpresa' AND column_name = 'ObservacionesConciliacion') THEN
                ALTER TABLE "CuentaBancariaEmpresa" ADD COLUMN "ObservacionesConciliacion" TEXT NULL;
            END IF;
        END $$;
    """)

    # 2. Configurar propósitos en los 3 bancos referenciales del negocio
    op.execute("""
        UPDATE "CuentaBancariaEmpresa"
        SET "Proposito" = 'RECAUDACION_CHOFERES',
            "SaldoConciliado" = COALESCE("SaldoActual", 0.00)
        WHERE "Sigla" IN ('BMSC', 'MSC') OR "NombreBanco" ILIKE '%Mercantil%';

        UPDATE "CuentaBancariaEmpresa"
        SET "Proposito" = 'DISTRIBUIDORES_MAYORISTAS',
            "SaldoConciliado" = COALESCE("SaldoActual", 0.00)
        WHERE "Sigla" = 'BU' OR "NombreBanco" ILIKE '%Unión%';

        UPDATE "CuentaBancariaEmpresa"
        SET "Proposito" = 'OPERACIONES_INSTITUCIONALES',
            "SaldoConciliado" = COALESCE("SaldoActual", 0.00)
        WHERE "Sigla" = 'BNB' OR "NombreBanco" ILIKE '%Nacional de Bolivia%';
    """)

    # 3. Nueva tabla: FirmaDigitalDocumento (para autorizaciones y sellos gerenciales de Don Osvaldo)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public."FirmaDigitalDocumento" (
            "IdFirma" SERIAL PRIMARY KEY,
            "IdUsuario" INT NOT NULL REFERENCES public."Usuario"("IdUsuario") ON DELETE RESTRICT,
            "TipoDocumento" VARCHAR(50) NOT NULL,
            "IdRegistroDocumento" INT NOT NULL,
            "CodigoReferencia" VARCHAR(50) NULL,
            "UrlFotoFirmaSello" VARCHAR(500) NULL,
            "Observaciones" TEXT NULL,
            "FechaFirma" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "ix_FirmaDigital_TipoRegistro" ON public."FirmaDigitalDocumento"("TipoDocumento", "IdRegistroDocumento");
        CREATE INDEX IF NOT EXISTS "ix_FirmaDigital_CodigoReferencia" ON public."FirmaDigitalDocumento"("CodigoReferencia");
    """)

    # 4. Nueva tabla: ConciliacionBancariaHistorial (historial de conciliaciones referenciales)
    op.execute("""
        CREATE TABLE IF NOT EXISTS public."ConciliacionBancariaHistorial" (
            "IdConciliacion" SERIAL PRIMARY KEY,
            "IdCuentaBancaria" INT NOT NULL REFERENCES public."CuentaBancariaEmpresa"("IdCuentaBancaria") ON DELETE RESTRICT,
            "SaldoAnterior" NUMERIC(14,2) NOT NULL,
            "SaldoNuevo" NUMERIC(14,2) NOT NULL,
            "Diferencia" NUMERIC(14,2) NOT NULL DEFAULT 0.00,
            "IdUsuario" INT NOT NULL REFERENCES public."Usuario"("IdUsuario") ON DELETE RESTRICT,
            "Observacion" TEXT NULL,
            "FechaConciliacion" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "ix_Conciliacion_CuentaBancaria" ON public."ConciliacionBancariaHistorial"("IdCuentaBancaria");
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS public."ConciliacionBancariaHistorial";
        DROP TABLE IF EXISTS public."FirmaDigitalDocumento";
        ALTER TABLE "CuentaBancariaEmpresa" DROP COLUMN IF EXISTS "ObservacionesConciliacion";
        ALTER TABLE "CuentaBancariaEmpresa" DROP COLUMN IF EXISTS "FechaUltimaConciliacion";
        ALTER TABLE "CuentaBancariaEmpresa" DROP COLUMN IF EXISTS "SaldoConciliado";
        ALTER TABLE "CuentaBancariaEmpresa" DROP COLUMN IF EXISTS "Proposito";
    """)
