-- ====================================================================
-- FASE 3: TRIGGERS ENRIQUECIDOS PARA NOTIFICACIONES ACCIONABLES Y SSE
-- Aditivo, idempotente y con guardas estrictas
-- ====================================================================

-- 1. Trigger PagoPedido enriquecido con nombres reales (Ruta, Chofer, Cliente, Monto)
CREATE OR REPLACE FUNCTION public.fn_trg_evento_logistica_pago()
RETURNS TRIGGER AS $$
DECLARE
    v_sucursal_id INTEGER;
    v_asignacion_id BIGINT;
    v_chofer_id INTEGER;
    v_nombre_chofer TEXT;
    v_nombre_ruta TEXT;
    v_numero_pedido TEXT;
    v_cliente TEXT;
    v_evento_id BIGINT;
BEGIN
    SELECT 
        p."IdAsignacionRuta", 
        p."IdUsuarioRepartidor", 
        r."IdSucursal",
        r."NombreRuta",
        p."NumeroPedido",
        CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno"),
        COALESCE(c."NombreComercial", c."RazonSocial", c."NombrePropietario", 'Cliente')
    INTO 
        v_asignacion_id, 
        v_chofer_id, 
        v_sucursal_id,
        v_nombre_ruta,
        v_numero_pedido,
        v_nombre_chofer,
        v_cliente
    FROM public."Pedido" p
    LEFT JOIN public."AsignacionRuta" a ON a."IdAsignacionRuta" = p."IdAsignacionRuta"
    LEFT JOIN public."RutaDistribucion" r ON r."IdRutaDistribucion" = a."IdRutaDistribucion"
    LEFT JOIN public."Usuario" u ON u."IdUsuario" = p."IdUsuarioRepartidor"
    LEFT JOIN public."Cliente" c ON c."IdCliente" = p."IdCliente"
    WHERE p."IdPedido" = NEW."IdPedido";

    INSERT INTO public.evento_logistica (
        sucursal_id, usuario_id, asignacion_id, tipo, payload
    ) VALUES (
        COALESCE(v_sucursal_id, 1),
        v_chofer_id,
        v_asignacion_id,
        'COBRO_REGISTRADO',
        jsonb_build_object(
            'id_pago', NEW."IdPagoPedido",
            'id_pedido', NEW."IdPedido",
            'numero_pedido', v_numero_pedido,
            'id_asignacion', v_asignacion_id,
            'id_chofer', v_chofer_id,
            'nombre_chofer', COALESCE(v_nombre_chofer, 'Chofer en ruta'),
            'nombre_ruta', COALESCE(v_nombre_ruta, 'Ruta Asignada'),
            'cliente', v_cliente,
            'tipo_operacion', 'COBRO',
            'monto', NEW."Monto",
            'fecha_pago', NEW."FechaPago"::text,
            'mensaje', FORMAT('Cobro registrado · %s · %s · Bs. %s', 
                              COALESCE(SPLIT_PART(v_nombre_ruta, ' - ', 1), 'Ruta'), 
                              COALESCE(v_nombre_chofer, 'Chofer'), 
                              NEW."Monto"::text)
        )
    ) RETURNING id INTO v_evento_id;

    PERFORM pg_notify('logistica_eventos', v_evento_id::text);
    PERFORM pg_notify('evento_logistica', v_evento_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evento_logistica_pago ON public."PagoPedido";
CREATE TRIGGER trg_evento_logistica_pago
AFTER INSERT ON public."PagoPedido"
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_evento_logistica_pago();


-- 2. Trigger solicitud_carga_camion enriquecido con nombre de chofer y ruta
CREATE OR REPLACE FUNCTION public.fn_trg_evento_logistica_solicitud_carga()
RETURNS TRIGGER AS $$
DECLARE
    v_sucursal_id INTEGER;
    v_nombre_chofer TEXT;
    v_nombre_ruta TEXT;
    v_tipo TEXT;
    v_evento_id BIGINT;
BEGIN
    SELECT 
        r."IdSucursal",
        r."NombreRuta",
        CONCAT(u."PrimerNombre", ' ', u."ApellidoPaterno")
    INTO 
        v_sucursal_id,
        v_nombre_ruta,
        v_nombre_chofer
    FROM public."AsignacionRuta" a
    JOIN public."RutaDistribucion" r ON r."IdRutaDistribucion" = a."IdRutaDistribucion"
    LEFT JOIN public."Usuario" u ON u."IdUsuario" = a."IdUsuarioRepartidor"
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
            'nombre_chofer', COALESCE(v_nombre_chofer, 'Chofer en planta'),
            'nombre_ruta', COALESCE(v_nombre_ruta, 'Ruta Asignada'),
            'estado', NEW.estado,
            'observacion_chofer', NEW.observacion_chofer,
            'observacion_admin', NEW.observacion_admin,
            'mensaje', FORMAT('Solicitud de carga · %s · %s', 
                              COALESCE(SPLIT_PART(v_nombre_ruta, ' - ', 1), 'Ruta'), 
                              COALESCE(v_nombre_chofer, 'Chofer'))
        )
    ) RETURNING id INTO v_evento_id;

    PERFORM pg_notify('logistica_eventos', v_evento_id::text);
    PERFORM pg_notify('evento_logistica', v_evento_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evento_logistica_solicitud_carga ON public.solicitud_carga_camion;
CREATE TRIGGER trg_evento_logistica_solicitud_carga
AFTER INSERT OR UPDATE ON public.solicitud_carga_camion
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_evento_logistica_solicitud_carga();
