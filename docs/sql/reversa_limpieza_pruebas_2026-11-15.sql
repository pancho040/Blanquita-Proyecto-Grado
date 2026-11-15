-- ============================================================================
-- SCRIPT DE REVERSA: LIMPIEZA DE DATOS DE PRUEBA (2026-11-15)
-- Sistema ERP Papelera Blanquita
-- ============================================================================
-- Permite restaurar los valores de los Pedidos 461 y 462 al estado previo
-- a la regularización si el administrador o contador así lo dispone.
-- ============================================================================

BEGIN;

-- Restaurar totales originales de Pedidos 461 y 462
UPDATE public."Pedido"
SET 
    "Total" = 275.00,
    "Observacion" = REPLACE("Observacion", ' [REGULARIZADO 2026-11-15: Entrega real Bs. 196.56. Cobro #281 por Bs. 275.00 genera saldo a favor de Bs. 78.44]', '')
WHERE "IdPedido" = 461;

UPDATE public."NotaVenta"
SET 
    "Total" = 275.00,
    "Subtotal" = 275.00
WHERE "IdPedido" = 461;

UPDATE public."Pedido"
SET 
    "Total" = 150.00,
    "Observacion" = REPLACE("Observacion", ' [REGULARIZADO 2026-11-15: Entrega real Bs. 139.32. Cobro #282 por Bs. 150.00 genera saldo a favor de Bs. 10.68]', '')
WHERE "IdPedido" = 462;

UPDATE public."NotaVenta"
SET 
    "Total" = 150.00,
    "Subtotal" = 150.00
WHERE "IdPedido" = 462;

-- Reactivar usuarios de prueba si fuera necesario en entorno local
UPDATE public."Usuario"
SET "IdEstadoUsuario" = 1
WHERE ("Correo" LIKE 'test_%@blanquita.com' OR "NombreCompleto" LIKE 'TEST_%')
  AND "IdEstadoUsuario" = 2;

COMMIT;
