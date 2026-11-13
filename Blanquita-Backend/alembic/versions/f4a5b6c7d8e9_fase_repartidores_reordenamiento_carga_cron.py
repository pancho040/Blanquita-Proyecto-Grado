"""fase_repartidores_reordenamiento_carga_cron

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-11-12 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f4a5b6c7d8e9'
down_revision = 'e3f4a5b6c7d8'
branch_labels = None
depends_on = None


def upgrade():
    # -------------------------------------------------------------------------
    # 1. Extensiones en RutaDistribucion (Plantillas y Asignación Automática)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."RutaDistribucion"
        ADD COLUMN IF NOT EXISTS "es_asignacion_automatica" BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "id_chofer_por_defecto" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "dia_semana" INTEGER;

    UPDATE public."RutaDistribucion"
    SET "dia_semana" = "DiaSemana"
    WHERE "dia_semana" IS NULL AND "DiaSemana" IS NOT NULL;
    """)

    # -------------------------------------------------------------------------
    # 2. Extensiones en AsignacionRuta (Estado Operativo y Cierre de Jornada)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."AsignacionRuta"
        ADD COLUMN IF NOT EXISTS "estado_operativo" VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE_CARGA',
        ADD COLUMN IF NOT EXISTS "observacion_cierre_admin" TEXT,
        ADD COLUMN IF NOT EXISTS "cerrado_por_id" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL;
    """)

    # -------------------------------------------------------------------------
    # 3. Tablas de Solicitud de Carga de Camión
    # -------------------------------------------------------------------------
    op.execute("""
    CREATE TABLE IF NOT EXISTS public."solicitud_carga_camion" (
        "id_solicitud" BIGSERIAL PRIMARY KEY,
        "id_asignacion_ruta" BIGINT NOT NULL REFERENCES public."AsignacionRuta"("IdAsignacionRuta") ON DELETE CASCADE,
        "id_chofer" INTEGER NOT NULL REFERENCES public."Usuario"("IdUsuario") ON DELETE RESTRICT,
        "estado" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE' CHECK ("estado" IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
        "observacion_chofer" TEXT,
        "observacion_admin" TEXT,
        "id_admin_revision" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL,
        "fecha_solicitud" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "fecha_revision" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public."detalle_solicitud_carga_camion" (
        "id_detalle" BIGSERIAL PRIMARY KEY,
        "id_solicitud" BIGINT NOT NULL REFERENCES public."solicitud_carga_camion"("id_solicitud") ON DELETE CASCADE,
        "id_presentacion" INTEGER NOT NULL REFERENCES public."PresentacionProducto"("IdPresentacion") ON DELETE RESTRICT,
        "stock_remanente" NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK ("stock_remanente" >= 0),
        "stock_adicional_solicitado" NUMERIC(10,2) NOT NULL CHECK ("stock_adicional_solicitado" >= 0),
        "stock_adicional_aprobado" NUMERIC(10,2) CHECK ("stock_adicional_aprobado" >= 0),
        "observacion" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "idx_solicitud_carga_asignacion" ON public."solicitud_carga_camion"("id_asignacion_ruta");
    CREATE INDEX IF NOT EXISTS "idx_solicitud_carga_chofer" ON public."solicitud_carga_camion"("id_chofer");
    CREATE INDEX IF NOT EXISTS "idx_solicitud_carga_estado" ON public."solicitud_carga_camion"("estado");
    CREATE INDEX IF NOT EXISTS "idx_det_solicitud_carga_solicitud" ON public."detalle_solicitud_carga_camion"("id_solicitud");
    """)

    # -------------------------------------------------------------------------
    # 4. Extensiones en Pedido y PagoPedido (Revisión Web de Auditoría)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."Pedido"
        ADD COLUMN IF NOT EXISTS "estado_revision_web" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
        ADD COLUMN IF NOT EXISTS "observacion_revision" TEXT,
        ADD COLUMN IF NOT EXISTS "revisado_por_id" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "fecha_revision" TIMESTAMPTZ;

    ALTER TABLE public."PagoPedido"
        ADD COLUMN IF NOT EXISTS "estado_revision_web" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
        ADD COLUMN IF NOT EXISTS "observacion_revision" TEXT,
        ADD COLUMN IF NOT EXISTS "revisado_por_id" INTEGER REFERENCES public."Usuario"("IdUsuario") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "fecha_revision" TIMESTAMPTZ;
    """)

    # -------------------------------------------------------------------------
    # 5. Extensiones en Cliente (Programación de entrega y cliente en ruta)
    # -------------------------------------------------------------------------
    op.execute("""
    ALTER TABLE public."Cliente"
        ADD COLUMN IF NOT EXISTS "modalidad_registro" VARCHAR(50) DEFAULT 'SOLO_REGISTRO',
        ADD COLUMN IF NOT EXISTS "dia_semana_programado" INTEGER,
        ADD COLUMN IF NOT EXISTS "fecha_entrega_programada" DATE,
        ADD COLUMN IF NOT EXISTS "id_ruta_sugerida" INTEGER REFERENCES public."RutaDistribucion"("IdRutaDistribucion") ON DELETE SET NULL;
    """)

    # -------------------------------------------------------------------------
    # 6. Función PostgreSQL fn_generar_rutas_diarias(p_fecha DATE)
    # -------------------------------------------------------------------------
    op.execute("""
    CREATE OR REPLACE FUNCTION public.fn_generar_rutas_diarias(p_fecha DATE DEFAULT CURRENT_DATE)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        v_dia_semana INTEGER;
        v_ruta RECORD;
        v_cliente RECORD;
        v_id_asignacion BIGINT;
        v_asignaciones_creadas INTEGER := 0;
        v_paradas_programadas INTEGER := 0;
        v_max_orden INTEGER;
        v_id_punto_venta INTEGER;
    BEGIN
        -- Determinar día de la semana (1 = Lunes, ..., 7 = Domingo)
        v_dia_semana := EXTRACT(ISODOW FROM p_fecha)::INTEGER;

        -- 1. Asignaciones automáticas para rutas activas de este día
        FOR v_ruta IN
            SELECT r."IdRutaDistribucion", r."id_chofer_por_defecto", r."IdSucursal"
            FROM public."RutaDistribucion" r
            WHERE r."Activa" = TRUE
              AND r."es_asignacion_automatica" = TRUE
              AND r."id_chofer_por_defecto" IS NOT NULL
              AND (r."dia_semana" = v_dia_semana OR r."DiaSemana" = v_dia_semana)
        LOOP
            -- Verificar si ya existe asignación para esa ruta, chofer y fecha
            SELECT "IdAsignacionRuta" INTO v_id_asignacion
            FROM public."AsignacionRuta"
            WHERE "IdRutaDistribucion" = v_ruta."IdRutaDistribucion"
              AND "FechaAsignacion" = p_fecha
            LIMIT 1;

            IF v_id_asignacion IS NULL THEN
                INSERT INTO public."AsignacionRuta" (
                    "IdRutaDistribucion",
                    "IdUsuarioRepartidor",
                    "FechaAsignacion",
                    "IdUsuarioAsigna",
                    "Estado",
                    "estado_operativo",
                    "Observacion"
                ) VALUES (
                    v_ruta."IdRutaDistribucion",
                    v_ruta."id_chofer_por_defecto",
                    p_fecha,
                    v_ruta."id_chofer_por_defecto",
                    'Pendiente',
                    'PENDIENTE_CARGA',
                    'Generada automáticamente por cron diario'
                )
                RETURNING "IdAsignacionRuta" INTO v_id_asignacion;

                v_asignaciones_creadas := v_asignaciones_creadas + 1;
            END IF;
        END LOOP;

        -- 2. Incorporar clientes nuevos con PROGRAMAR_ENTREGA para hoy
        FOR v_cliente IN
            SELECT c."IdCliente", c."id_ruta_sugerida"
            FROM public."Cliente" c
            WHERE c."modalidad_registro" = 'PROGRAMAR_ENTREGA'
              AND (
                  c."fecha_entrega_programada" = p_fecha
                  OR (c."fecha_entrega_programada" IS NULL AND c."dia_semana_programado" = v_dia_semana)
              )
              AND c."id_ruta_sugerida" IS NOT NULL
        LOOP
            -- Obtener o asegurar PuntoVenta para este cliente
            SELECT "IdPuntoVenta" INTO v_id_punto_venta
            FROM public."PuntoVenta"
            WHERE "IdCliente" = v_cliente."IdCliente"
              AND "Activo" = TRUE
            ORDER BY "IdPuntoVenta" ASC
            LIMIT 1;

            IF v_id_punto_venta IS NOT NULL THEN
                -- Verificar si ya está en la ruta
                IF NOT EXISTS (
                    SELECT 1 FROM public."RutaPuntoVenta"
                    WHERE "IdRutaDistribucion" = v_cliente."id_ruta_sugerida"
                      AND "IdPuntoVenta" = v_id_punto_venta
                ) THEN
                    SELECT COALESCE(MAX("OrdenVisita"), 0) INTO v_max_orden
                    FROM public."RutaPuntoVenta"
                    WHERE "IdRutaDistribucion" = v_cliente."id_ruta_sugerida";

                    INSERT INTO public."RutaPuntoVenta" (
                        "IdRutaDistribucion",
                        "IdPuntoVenta",
                        "OrdenVisita"
                    ) VALUES (
                        v_cliente."id_ruta_sugerida",
                        v_id_punto_venta,
                        v_max_orden + 1
                    );

                    v_paradas_programadas := v_paradas_programadas + 1;
                END IF;
            END IF;
        END LOOP;

        RETURN jsonb_build_object(
            'fecha', p_fecha,
            'dia_semana', v_dia_semana,
            'asignaciones_creadas', v_asignaciones_creadas,
            'paradas_programadas', v_paradas_programadas
        );
    END;
    $$;
    """)

    # -------------------------------------------------------------------------
    # 7. Programación Segura en pg_cron (a medianoche 04:00 UTC = 00:00 BOT)
    # -------------------------------------------------------------------------
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
            BEGIN
                PERFORM cron.unschedule('generar-rutas-diarias');
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;

            PERFORM cron.schedule(
                'generar-rutas-diarias',
                '0 4 * * *',
                'SELECT public.fn_generar_rutas_diarias(CURRENT_DATE)'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron no disponible o permisos insuficientes: %', SQLERRM;
    END $$;
    """)


def downgrade():
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
            PERFORM cron.unschedule('generar-rutas-diarias');
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END $$;

    DROP FUNCTION IF EXISTS public.fn_generar_rutas_diarias(DATE);

    ALTER TABLE public."Cliente"
        DROP COLUMN IF EXISTS "modalidad_registro",
        DROP COLUMN IF EXISTS "dia_semana_programado",
        DROP COLUMN IF EXISTS "fecha_entrega_programada",
        DROP COLUMN IF EXISTS "id_ruta_sugerida";

    ALTER TABLE public."PagoPedido"
        DROP COLUMN IF EXISTS "estado_revision_web",
        DROP COLUMN IF EXISTS "observacion_revision",
        DROP COLUMN IF EXISTS "revisado_por_id",
        DROP COLUMN IF EXISTS "fecha_revision";

    ALTER TABLE public."Pedido"
        DROP COLUMN IF EXISTS "estado_revision_web",
        DROP COLUMN IF EXISTS "observacion_revision",
        DROP COLUMN IF EXISTS "revisado_por_id",
        DROP COLUMN IF EXISTS "fecha_revision";

    DROP TABLE IF EXISTS public."detalle_solicitud_carga_camion" CASCADE;
    DROP TABLE IF EXISTS public."solicitud_carga_camion" CASCADE;

    ALTER TABLE public."AsignacionRuta"
        DROP COLUMN IF EXISTS "estado_operativo",
        DROP COLUMN IF EXISTS "observacion_cierre_admin",
        DROP COLUMN IF EXISTS "cerrado_por_id";

    ALTER TABLE public."RutaDistribucion"
        DROP COLUMN IF EXISTS "es_asignacion_automatica",
        DROP COLUMN IF EXISTS "id_chofer_por_defecto",
        DROP COLUMN IF EXISTS "dia_semana";
    """)
