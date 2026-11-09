"""fase_3_rrhh_planillas_caja_chica

Revision ID: 2665f0075b65
Revises: e10bc519b099
Create Date: 2026-11-09 01:32:30.281922

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2665f0075b65'
down_revision: Union[str, Sequence[str], None] = 'e10bc519b099'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Modificaciones aditivas y actualización de CHECK a SolicitudCajaChica (Subagente E)
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SolicitudCajaChica' AND column_name = 'MontoEntregado') THEN
                ALTER TABLE "SolicitudCajaChica" ADD COLUMN "MontoEntregado" NUMERIC(12,2) NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SolicitudCajaChica' AND column_name = 'MontoGastoReal') THEN
                ALTER TABLE "SolicitudCajaChica" ADD COLUMN "MontoGastoReal" NUMERIC(12,2) NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SolicitudCajaChica' AND column_name = 'IdComprobanteArchivo') THEN
                ALTER TABLE "SolicitudCajaChica" ADD COLUMN "IdComprobanteArchivo" INT NULL REFERENCES "ComprobanteArchivo"("IdComprobante") ON DELETE SET NULL;
            END IF;
        END $$;

        ALTER TABLE "SolicitudCajaChica" DROP CONSTRAINT IF EXISTS "SolicitudCajaChica_Estado_check";
        ALTER TABLE "SolicitudCajaChica" ADD CONSTRAINT "SolicitudCajaChica_Estado_check" 
        CHECK ("Estado" = ANY (ARRAY[
            'Pendiente'::text, 'Entregado'::text, 'Rendida'::text, 'Rendido'::text, 'Aprobada'::text, 'Rechazada'::text,
            'PENDIENTE'::text, 'ENTREGADO'::text, 'RENDIDO'::text, 'APROBADA'::text, 'RECHAZADA'::text
        ]));
    """)

    # 2. Nueva tabla DetalleGastoCajaChica (Subagente E)
    op.execute("""
        CREATE TABLE IF NOT EXISTS "DetalleGastoCajaChica" (
            "id" SERIAL PRIMARY KEY,
            "solicitud_id" INT NOT NULL REFERENCES "SolicitudCajaChica"("IdSolicitudCajaChica") ON DELETE CASCADE,
            "concepto" VARCHAR(255) NOT NULL,
            "nro_factura" VARCHAR(50) NULL,
            "proveedor" VARCHAR(120) NULL,
            "monto" NUMERIC(12,2) NOT NULL,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 3. Modificaciones aditivas a Planilla y DetallePlanilla (Subagente D)
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Planilla' AND column_name = 'TipoPlanilla') THEN
                ALTER TABLE "Planilla" ADD COLUMN "TipoPlanilla" VARCHAR(20) NOT NULL DEFAULT 'INTERNA';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Planilla' AND column_name = 'IdSucursal') THEN
                ALTER TABLE "Planilla" ADD COLUMN "IdSucursal" INT NULL REFERENCES "sucursales"("id") ON DELETE RESTRICT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DetallePlanilla' AND column_name = 'DescuentoNoVenta') THEN
                ALTER TABLE "DetallePlanilla" ADD COLUMN "DescuentoNoVenta" NUMERIC(12,2) NOT NULL DEFAULT 0.00;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DetallePlanilla' AND column_name = 'HorasTrabajadasAJ') THEN
                ALTER TABLE "DetallePlanilla" ADD COLUMN "HorasTrabajadasAJ" NUMERIC(12,2) NOT NULL DEFAULT 0.00;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DetallePlanilla' AND column_name = 'ValorHora') THEN
                ALTER TABLE "DetallePlanilla" ADD COLUMN "ValorHora" NUMERIC(12,4) NOT NULL DEFAULT 0.0000;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'DatosLaboralesEmpleado' AND column_name = 'FechaRetiro') THEN
                ALTER TABLE "DatosLaboralesEmpleado" ADD COLUMN "FechaRetiro" DATE NULL;
            END IF;
        END $$;
    """)

    # 4. Nueva tabla Finiquito (Subagente D)
    op.execute("""
        CREATE TABLE IF NOT EXISTS "Finiquito" (
            "IdFiniquito" SERIAL PRIMARY KEY,
            "IdUsuario" INT NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
            "FechaIngreso" DATE NOT NULL,
            "FechaRetiro" DATE NOT NULL,
            "MotivoRetiro" VARCHAR(100) NOT NULL DEFAULT 'Retiro Voluntario',
            "Anios" INT NOT NULL DEFAULT 0,
            "Meses" INT NOT NULL DEFAULT 0,
            "Dias" INT NOT NULL DEFAULT 0,
            "Sueldo1" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "Sueldo2" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "Sueldo3" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "SueldoPromedio" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "MontoIndemnizacion" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "AguinaldoDuodecimas" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "VacacionDuodecimas" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "Desahucios" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "Deducciones" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "MontoTotal" NUMERIC(12,2) NOT NULL DEFAULT 0.00,
            "AprobadoPorGerencia" BOOLEAN NOT NULL DEFAULT FALSE,
            "FechaCalculo" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 5. Nuevas tablas para No Venta Compartida (Subagente D)
    op.execute("""
        CREATE TABLE IF NOT EXISTS "deudas_no_venta" (
            "id" SERIAL PRIMARY KEY,
            "concepto" VARCHAR(255) NOT NULL,
            "monto_total" NUMERIC(12,2) NOT NULL,
            "num_responsables" INT NOT NULL DEFAULT 1,
            "fecha_incidente" DATE NOT NULL DEFAULT CURRENT_DATE,
            "estado" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
            "id_sucursal" INT NULL REFERENCES "sucursales"("id") ON DELETE RESTRICT,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "detalles_no_venta_empleado" (
            "id" SERIAL PRIMARY KEY,
            "deuda_no_venta_id" INT NOT NULL REFERENCES "deudas_no_venta"("id") ON DELETE CASCADE,
            "id_usuario" INT NOT NULL REFERENCES "Usuario"("IdUsuario") ON DELETE RESTRICT,
            "cuota_descuento" NUMERIC(12,2) NOT NULL,
            "id_planilla_aplicada" INT NULL REFERENCES "Planilla"("IdPlanilla") ON DELETE SET NULL,
            "aplicado" BOOLEAN NOT NULL DEFAULT FALSE
        );
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS "detalles_no_venta_empleado" CASCADE;
        DROP TABLE IF EXISTS "deudas_no_venta" CASCADE;
        DROP TABLE IF EXISTS "Finiquito" CASCADE;
        DROP TABLE IF EXISTS "DetalleGastoCajaChica" CASCADE;
    """)
