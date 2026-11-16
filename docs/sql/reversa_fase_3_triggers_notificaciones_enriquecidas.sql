-- ====================================================================
-- REVERSA FASE 3: TRIGGERS ENRIQUECIDOS PARA NOTIFICACIONES
-- ====================================================================

-- Reversa Trigger PagoPedido a versión fase 2
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
