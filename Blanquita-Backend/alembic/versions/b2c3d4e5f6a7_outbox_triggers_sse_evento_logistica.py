"""outbox triggers sse evento_logistica

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-15 19:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Crear tabla outbox evento_logistica
    op.execute("""
    CREATE TABLE IF NOT EXISTS public.evento_logistica (
        id BIGSERIAL PRIMARY KEY,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        sucursal_id INTEGER,
        usuario_id INTEGER,
        asignacion_id BIGINT,
        tipo VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS ix_evento_logistica_sucursal_id ON public.evento_logistica (sucursal_id, id);
    CREATE INDEX IF NOT EXISTS ix_evento_logistica_creado_en ON public.evento_logistica (creado_en);
    """)

    # 2. Función de limpieza periódica de eventos > 48 horas
    op.execute("""
    CREATE OR REPLACE FUNCTION public.limpiar_eventos_logistica_antiguos()
    RETURNS INTEGER AS $$
    DECLARE
        filas_eliminadas INTEGER;
    BEGIN
        DELETE FROM public.evento_logistica
        WHERE creado_en < now() - INTERVAL '48 hours';
        GET DIAGNOSTICS filas_eliminadas = ROW_COUNT;
        RETURN filas_eliminadas;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # 3. Trigger y función para AsignacionRuta
    op.execute("""
    CREATE OR REPLACE FUNCTION public.fn_trg_evento_logistica_asignacion()
    RETURNS TRIGGER AS $$
    DECLARE
        v_sucursal_id INTEGER;
        v_tipo TEXT;
        v_evento_id BIGINT;
    BEGIN
        SELECT "IdSucursal" INTO v_sucursal_id
        FROM public."RutaDistribucion"
        WHERE "IdRutaDistribucion" = NEW."IdRutaDistribucion";

        IF TG_OP = 'INSERT' THEN
            v_tipo := 'ASIGNACION_CREADA';
        ELSIF TG_OP = 'UPDATE' THEN
            IF (NEW."Estado" IN ('Finalizada', 'Completada') OR NEW."estado_operativo" = 'COMPLETADA')
               AND (OLD."Estado" NOT IN ('Finalizada', 'Completada') AND OLD."estado_operativo" IS DISTINCT FROM 'COMPLETADA') THEN
                v_tipo := 'ASIGNACION_COMPLETADA';
            ELSIF NEW."Estado" IS DISTINCT FROM OLD."Estado" 
               OR NEW."estado_operativo" IS DISTINCT FROM OLD."estado_operativo"
               OR NEW."IdUsuarioRepartidor" IS DISTINCT FROM OLD."IdUsuarioRepartidor" THEN
                v_tipo := 'ASIGNACION_ACTUALIZADA';
            ELSE
                RETURN NEW;
            END IF;
        ELSE
            RETURN NEW;
        END IF;

        INSERT INTO public.evento_logistica (
            sucursal_id, usuario_id, asignacion_id, tipo, payload
        ) VALUES (
            v_sucursal_id,
            NEW."IdUsuarioRepartidor",
            NEW."IdAsignacionRuta",
            v_tipo,
            jsonb_build_object(
                'id_asignacion', NEW."IdAsignacionRuta",
                'id_ruta', NEW."IdRutaDistribucion",
                'id_chofer', NEW."IdUsuarioRepartidor",
                'estado', NEW."Estado",
                'estado_operativo', NEW."estado_operativo",
                'fecha', NEW."FechaAsignacion"::text
            )
        ) RETURNING id INTO v_evento_id;

        PERFORM pg_notify('evento_logistica', v_evento_id::text);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_evento_logistica_asignacion ON public."AsignacionRuta";
    CREATE TRIGGER trg_evento_logistica_asignacion
    AFTER INSERT OR UPDATE ON public."AsignacionRuta"
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trg_evento_logistica_asignacion();
    """)

    # 4. Trigger y función para solicitud_carga_camion
    op.execute("""
    CREATE OR REPLACE FUNCTION public.fn_trg_evento_logistica_solicitud_carga()
    RETURNS TRIGGER AS $$
    DECLARE
        v_sucursal_id INTEGER;
        v_tipo TEXT;
        v_evento_id BIGINT;
    BEGIN
        SELECT r."IdSucursal" INTO v_sucursal_id
        FROM public."AsignacionRuta" a
        JOIN public."RutaDistribucion" r ON r."IdRutaDistribucion" = a."IdRutaDistribucion"
        WHERE a."IdAsignacionRuta" = NEW.id_asignacion_ruta;

        IF TG_OP = 'INSERT' THEN
            v_tipo := 'SOLICITUD_CARGA_CREADA';
        ELSIF TG_OP = 'UPDATE' THEN
            IF UPPER(NEW.estado) = 'APROBADA' AND UPPER(OLD.estado) <> 'APROBADA' THEN
                v_tipo := 'CARGA_APROBADA';
            ELSIF UPPER(NEW.estado) = 'RECHAZADA' AND UPPER(OLD.estado) <> 'RECHAZADA' THEN
                v_tipo := 'CARGA_RECHAZADA';
            ELSE
                RETURN NEW;
            END IF;
        ELSE
            RETURN NEW;
        END IF;

        INSERT INTO public.evento_logistica (
            sucursal_id, usuario_id, asignacion_id, tipo, payload
        ) VALUES (
            COALESCE(v_sucursal_id, 1),
            NEW.id_chofer,
            NEW.id_asignacion_ruta,
            v_tipo,
            jsonb_build_object(
                'id_solicitud', NEW.id_solicitud,
                'id_asignacion', NEW.id_asignacion_ruta,
                'id_chofer', NEW.id_chofer,
                'estado', NEW.estado,
                'observacion_chofer', NEW.observacion_chofer,
                'observacion_admin', NEW.observacion_admin
            )
        ) RETURNING id INTO v_evento_id;

        PERFORM pg_notify('evento_logistica', v_evento_id::text);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_evento_logistica_solicitud_carga ON public.solicitud_carga_camion;
    CREATE TRIGGER trg_evento_logistica_solicitud_carga
    AFTER INSERT OR UPDATE ON public.solicitud_carga_camion
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trg_evento_logistica_solicitud_carga();
    """)

    # 5. Trigger y función para TrackingChofer con throttle de 5s
    op.execute("""
    CREATE OR REPLACE FUNCTION public.fn_trg_evento_logistica_tracking()
    RETURNS TRIGGER AS $$
    DECLARE
        v_sucursal_id INTEGER;
        v_ultimo_evento TIMESTAMPTZ;
        v_evento_id BIGINT;
    BEGIN
        SELECT creado_en INTO v_ultimo_evento
        FROM public.evento_logistica
        WHERE usuario_id = NEW."IdUsuarioRepartidor"
          AND tipo = 'UBICACION'
        ORDER BY id DESC
        LIMIT 1;

        IF v_ultimo_evento IS NOT NULL AND v_ultimo_evento > now() - INTERVAL '5 seconds' THEN
            RETURN NEW;
        END IF;

        SELECT r."IdSucursal" INTO v_sucursal_id
        FROM public."AsignacionRuta" a
        JOIN public."RutaDistribucion" r ON r."IdRutaDistribucion" = a."IdRutaDistribucion"
        WHERE a."IdAsignacionRuta" = NEW."IdAsignacionRuta";

        INSERT INTO public.evento_logistica (
            sucursal_id, usuario_id, asignacion_id, tipo, payload
        ) VALUES (
            COALESCE(v_sucursal_id, 1),
            NEW."IdUsuarioRepartidor",
            NEW."IdAsignacionRuta",
            'UBICACION',
            jsonb_build_object(
                'id_tracking', NEW."IdTracking",
                'id_chofer', NEW."IdUsuarioRepartidor",
                'id_asignacion', NEW."IdAsignacionRuta",
                'latitud', NEW."Latitud",
                'longitud', NEW."Longitud",
                'velocidad', NEW."Velocidad",
                'bateria', NEW."Bateria",
                'estado_movimiento', NEW."EstadoMovimiento",
                'parada_actual', NEW."ParadaActual",
                'total_paradas', NEW."TotalParadas",
                'paradas_completadas', NEW."ParadasCompletadas",
                'monto_cobrado', NEW."MontoCobradoTotal"
            )
        ) RETURNING id INTO v_evento_id;

        PERFORM pg_notify('evento_logistica', v_evento_id::text);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_evento_logistica_tracking ON public."TrackingChofer";
    CREATE TRIGGER trg_evento_logistica_tracking
    AFTER INSERT OR UPDATE ON public."TrackingChofer"
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trg_evento_logistica_tracking();
    """)

    # 6. Trigger y función para PagoPedido (entrega registrada)
    op.execute("""
    CREATE OR REPLACE FUNCTION public.fn_trg_evento_logistica_pago()
    RETURNS TRIGGER AS $$
    DECLARE
        v_sucursal_id INTEGER;
        v_asignacion_id BIGINT;
        v_chofer_id INTEGER;
        v_evento_id BIGINT;
    BEGIN
        SELECT p."IdAsignacionRuta", p."IdUsuarioRepartidor", r."IdSucursal"
        INTO v_asignacion_id, v_chofer_id, v_sucursal_id
        FROM public."Pedido" p
        LEFT JOIN public."AsignacionRuta" a ON a."IdAsignacionRuta" = p."IdAsignacionRuta"
        LEFT JOIN public."RutaDistribucion" r ON r."IdRutaDistribucion" = a."IdRutaDistribucion"
        WHERE p."IdPedido" = NEW."IdPedido";

        INSERT INTO public.evento_logistica (
            sucursal_id, usuario_id, asignacion_id, tipo, payload
        ) VALUES (
            COALESCE(v_sucursal_id, 1),
            v_chofer_id,
            v_asignacion_id,
            'ENTREGA_REGISTRADA',
            jsonb_build_object(
                'id_pago', NEW."IdPagoPedido",
                'id_pedido', NEW."IdPedido",
                'id_asignacion', v_asignacion_id,
                'id_chofer', v_chofer_id,
                'monto', NEW."Monto",
                'fecha_pago', NEW."FechaPago"::text
            )
        ) RETURNING id INTO v_evento_id;

        PERFORM pg_notify('evento_logistica', v_evento_id::text);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_evento_logistica_pago ON public."PagoPedido";
    CREATE TRIGGER trg_evento_logistica_pago
    AFTER INSERT ON public."PagoPedido"
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trg_evento_logistica_pago();
    """)

    # 7. Trigger y función para inventario_chofer
    op.execute("""
    CREATE OR REPLACE FUNCTION public.fn_trg_evento_logistica_inventario()
    RETURNS TRIGGER AS $$
    DECLARE
        v_evento_id BIGINT;
    BEGIN
        INSERT INTO public.evento_logistica (
            sucursal_id, usuario_id, asignacion_id, tipo, payload
        ) VALUES (
            NEW.sucursal_id,
            NEW.chofer_id,
            NULL,
            'STOCK_ACTUALIZADO',
            jsonb_build_object(
                'chofer_id', NEW.chofer_id,
                'sucursal_id', NEW.sucursal_id,
                'presentacion_id', NEW.presentacion_id,
                'cantidad_cargada', NEW.cantidad_cargada,
                'cantidad_vendida', NEW.cantidad_vendida,
                'cantidad_remanente', NEW.cantidad_remanente
            )
        ) RETURNING id INTO v_evento_id;

        PERFORM pg_notify('evento_logistica', v_evento_id::text);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_evento_logistica_inventario ON public.inventario_chofer;
    CREATE TRIGGER trg_evento_logistica_inventario
    AFTER INSERT OR UPDATE ON public.inventario_chofer
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trg_evento_logistica_inventario();
    """)


def downgrade():
    op.execute("""
    DROP TRIGGER IF EXISTS trg_evento_logistica_inventario ON public.inventario_chofer;
    DROP FUNCTION IF EXISTS public.fn_trg_evento_logistica_inventario();

    DROP TRIGGER IF EXISTS trg_evento_logistica_pago ON public."PagoPedido";
    DROP FUNCTION IF EXISTS public.fn_trg_evento_logistica_pago();

    DROP TRIGGER IF EXISTS trg_evento_logistica_tracking ON public."TrackingChofer";
    DROP FUNCTION IF EXISTS public.fn_trg_evento_logistica_tracking();

    DROP TRIGGER IF EXISTS trg_evento_logistica_solicitud_carga ON public.solicitud_carga_camion;
    DROP FUNCTION IF EXISTS public.fn_trg_evento_logistica_solicitud_carga();

    DROP TRIGGER IF EXISTS trg_evento_logistica_asignacion ON public."AsignacionRuta";
    DROP FUNCTION IF EXISTS public.fn_trg_evento_logistica_asignacion();

    DROP FUNCTION IF EXISTS public.limpiar_eventos_logistica_antiguos();

    DROP INDEX IF EXISTS ix_evento_logistica_creado_en;
    DROP INDEX IF EXISTS ix_evento_logistica_sucursal_id;
    DROP TABLE IF EXISTS public.evento_logistica;
    """)
