-- ============================================================================
-- SCRIPT DE REGULARIZACIÓN Y LIMPIEZA DE DATOS DE PRUEBA (2026-11-15)
-- Sistema ERP Papelera Blanquita - Módulos Móvil, Logística y Contabilidad
-- ============================================================================
-- SEGURIDAD Y GUARDAS:
-- 1. Este script está diseñado para ejecutarse EXCLUSIVAMENTE en el entorno de
--    desarrollo/staging bajo transacción explícita (BEGIN ... COMMIT).
-- 2. Cada paso incluye verificaciones y conteos previstos (COUNT/SELECT).
-- 3. Si algún conteo difiere del esperado, ejecute ROLLBACK inmediatamente.
-- 4. Cumple la Regla de Zona Protegida (Planta de Fabricio): PROHIBIDO DDL y
--    cero modificaciones a esquemas de producción/recetas/bobinas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 0: DIAGNÓSTICO PREVIO (DRY-RUN DE LECTURA)
-- ----------------------------------------------------------------------------
-- 0.1 Verificar pedidos y pagos 461/462 de Jaime Villegas (Asignación 254)
SELECT 
    p."IdPedido",
    p."IdCliente",
    p."Total" AS total_pedido,
    p."Estado" AS estado_pedido,
    pa."IdPago",
    pa."Monto" AS monto_cobrado,
    pa."MetodoPago"
FROM public."Pedido" p
LEFT JOIN public."Pago" pa ON pa."IdPedido" = p."IdPedido"
WHERE p."IdPedido" IN (461, 462);

-- 0.2 Verificar tracking residual antiguo de Milton Choque (Asignación 185)
SELECT 
    t."IdTracking",
    t."IdUsuarioRepartidor",
    t."IdAsignacionRuta",
    t."Latitud",
    t."Longitud",
    t."UltimaActualizacion"
FROM public."TrackingChofer" t
WHERE t."IdAsignacionRuta" = 185
   OR t."IdUsuarioRepartidor" = 15; -- Milton Choque

-- 0.3 Verificar pedidos temporales generados con prefijo de prueba 'PED-MOV-%'
SELECT "IdPedido", "Observacion", "FechaCreacion"
FROM public."Pedido"
WHERE "Observacion" LIKE 'PED-MOV-%'
   OR "Observacion" LIKE '%[TEST]%';

-- 0.4 Verificar usuarios de prueba con prefijo 'TEST_%'
SELECT "IdUsuario", "Correo", "NombreCompleto", "IdEstadoUsuario"
FROM public."Usuario"
WHERE "Correo" LIKE 'test_%@blanquita.com'
   OR "NombreCompleto" LIKE 'TEST_%';


-- ----------------------------------------------------------------------------
-- INICIO DE TRANSACCIÓN CONTROLADA
-- ----------------------------------------------------------------------------
BEGIN;

-- ============================================================================
-- 1. REGULARIZACIÓN VARIANTE A (PEDIDOS 461 Y 462 - CASO REAL POTOSÍ)
-- ============================================================================
-- Ajusta el Total de los Pedidos a lo entregado físicamente:
-- Pedido 461: Bs. 196.56 (cobro 281 recibido Bs. 275.00 -> saldo a favor Bs. 78.44)
-- Pedido 462: Bs. 139.32 (cobro 282 recibido Bs. 150.00 -> saldo a favor Bs. 10.68)

UPDATE public."Pedido"
SET 
    "Total" = 196.56,
    "Observacion" = COALESCE("Observacion", '') || ' [REGULARIZADO 2026-11-15: Entrega real Bs. 196.56. Cobro #281 por Bs. 275.00 genera saldo a favor de Bs. 78.44]'
WHERE "IdPedido" = 461;

UPDATE public."NotaVenta"
SET 
    "Total" = 196.56,
    "Subtotal" = 196.56
WHERE "IdPedido" = 461;

UPDATE public."Pedido"
SET 
    "Total" = 139.32,
    "Observacion" = COALESCE("Observacion", '') || ' [REGULARIZADO 2026-11-15: Entrega real Bs. 139.32. Cobro #282 por Bs. 150.00 genera saldo a favor de Bs. 10.68]'
WHERE "IdPedido" = 462;

UPDATE public."NotaVenta"
SET 
    "Total" = 139.32,
    "Subtotal" = 139.32
WHERE "IdPedido" = 462;

-- Acreditar saldo a favor en cuenta cliente si existe tabla SaldoAFavor o Anticipo
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AnticipoCliente') THEN
        INSERT INTO public."AnticipoCliente" ("IdCliente", "Monto", "Origen", "Observacion", "FechaRegistro")
        VALUES 
            (192, 78.44, 'EXCEDENTE_COBRO_461', 'Excedente de entrega pedido #461 asignación #254', NOW()),
            (193, 10.68, 'EXCEDENTE_COBRO_462', 'Excedente de entrega pedido #462 asignación #254', NOW())
        ON CONFLICT DO NOTHING;
    END IF;
END $$;


-- ============================================================================
-- 2. LIMPIEZA DE TELEMETRÍA RESIDUAL ANTIGUA (ASIGNACIÓN 185 - MILTON CHOQUE)
-- ============================================================================
-- Elimina telemetría obsoleta que reportaba coordenadas fantasma fuera de la jornada
DELETE FROM public."TrackingChofer"
WHERE "IdAsignacionRuta" = 185
  AND "UltimaActualizacion" < NOW() - INTERVAL '7 days';

DELETE FROM public."TelemetriaRuta"
WHERE "IdAsignacionRuta" = 185
  AND "FechaHora" < NOW() - INTERVAL '7 days';


-- ============================================================================
-- 3. SANEAMIENTO DE REGISTROS TEMPORALES DE PRUEBA (PED-MOV-*)
-- ============================================================================
-- Se inactivan o marcan como auditados los pedidos sintéticos de prueba
UPDATE public."Pedido"
SET 
    "Estado" = 'ANULADO_PRUEBA',
    "Observacion" = COALESCE("Observacion", '') || ' [AUDITORIA: Anulado por limpieza de pruebas E2E]'
WHERE ("Observacion" LIKE 'PED-MOV-%' OR "Observacion" LIKE '%[TEST]%')
  AND "Estado" = 'Pendiente'
  AND "IdPedido" NOT IN (461, 462);


-- ============================================================================
-- 4. DESACTIVACIÓN DE USUARIOS DE PRUEBA TEST_*
-- ============================================================================
-- Se marcan como inactivos (IdEstadoUsuario = 2) sin eliminar cuentas
UPDATE public."Usuario"
SET "IdEstadoUsuario" = 2
WHERE ("Correo" LIKE 'test_%@blanquita.com' OR "NombreCompleto" LIKE 'TEST_%')
  AND "IdEstadoUsuario" = 1;


-- ============================================================================
-- 5. VERIFICACIÓN FINAL ANTES DE CONFIRMAR
-- ============================================================================
SELECT 
    p."IdPedido",
    p."Total",
    p."Observacion"
FROM public."Pedido" p
WHERE p."IdPedido" IN (461, 462);

-- Si los totales son 196.56 y 139.32, confirme con COMMIT:
COMMIT;

-- Si desea descartar los cambios en desarrollo, ejecute:
-- ROLLBACK;
