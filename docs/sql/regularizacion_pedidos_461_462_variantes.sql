-- ============================================================================
-- PROPUESTA DE REGULARIZACIÓN CONTABLE: PEDIDOS #461 Y #462 (POTOSÍ)
-- ============================================================================
-- Chofer: Jaime Villegas (IdUsuario = 24)
-- Asignación de Ruta: #254 (Ruta 202 - Mercado Uyuni y Feria Popular)
-- Fecha: 2026-11-14 / 2026-11-15
-- 
-- ANTECEDENTES Y DIAGNÓSTICO FINANCIERO:
-- 1. Pedido #461 (Cliente 192 - Abarrotes Don Pedro - Centro):
--    - Monto original cargado: Bs. 275.00
--    - Monto efectivamente entregado: Bs. 196.56
--    - Cobro registrado (#281): Bs. 275.00
--    - Excedente cobrado sobre lo entregado: Bs. 78.44
--
-- 2. Pedido #462 (Cliente 193 - Minimarket El Sol - Mercado Central):
--    - Monto original cargado: Bs. 150.00
--    - Monto efectivamente entregado: Bs. 139.32
--    - Cobro registrado (#282): Bs. 150.00
--    - Excedente cobrado sobre lo entregado: Bs. 10.68
--
-- Total diferencia en custodia del chofer: Bs. 78.44 + Bs. 10.68 = Bs. 89.12
--
-- NOTA OBLIGATORIA: Este script NO debe ejecutarse automáticamente.
-- Se presenta para revisión y aprobación contable del administrador.
-- ============================================================================

-- ============================================================================
-- 0. CONSULTAS PREVIAS DE DIAGNÓSTICO (SOLO LECTURA)
-- ============================================================================
SELECT 
    p."IdPedido",
    p."IdCliente",
    c."RazonSocial",
    p."Total" AS total_pedido,
    p."Estado" AS estado_pedido,
    nv."IdNotaVenta",
    nv."Total" AS total_nota_venta,
    pa."IdPago",
    pa."Monto" AS monto_cobrado,
    pa."MetodoPago",
    pa."FechaPago"
FROM public."Pedido" p
JOIN public."Cliente" c ON c."IdCliente" = p."IdCliente"
LEFT JOIN public."NotaVenta" nv ON nv."IdPedido" = p."IdPedido"
LEFT JOIN public."Pago" pa ON pa."IdPedido" = p."IdPedido"
WHERE p."IdPedido" IN (461, 462);

-- Detalle de ítems entregados y precios unitarios
SELECT 
    dp."IdPedido",
    dp."IdPresentacion",
    pres."Nombre" AS presentacion,
    dp."Cantidad" AS cantidad_registrada,
    dp."PrecioUnitario",
    dp."Subtotal"
FROM public."DetallePedido" dp
JOIN public."PresentacionProducto" pres ON pres."IdPresentacion" = dp."IdPresentacion"
WHERE dp."IdPedido" IN (461, 462)
ORDER BY dp."IdPedido", dp."IdPresentacion";


-- ============================================================================
-- VARIANTE A (RECOMENDADA CONTABLEMENTE):
-- CONSERVAR EL COBRO REAL Y GENERAR SALDO A FAVOR / ANTICIPO DEL CLIENTE
-- ============================================================================
-- Justificación:
-- El chofer Jaime Villegas efectivamente recibió Bs. 275.00 y Bs. 150.00 en efectivo.
-- Si se reduce el monto del pago en el sistema, la rendición de caja del chofer
-- al final del día tendrá un sobrante ficticio o no cuadrará con el dinero físico entregado.
-- En esta variante:
-- 1. La Nota de Venta y el Pedido se ajustan a lo efectivamente entregado (196.56 y 139.32).
-- 2. El pago original se mantiene como ingreso registrado en caja por el total entregado por el cliente.
-- 3. La diferencia (Bs. 78.44 y Bs. 10.68) se acredita formalmente como Saldo a Favor / Anticipo
--    del cliente para su próximo pedido o visita.
-- ============================================================================

BEGIN;

-- 1. Ajustar el total del Pedido #461 al valor entregado y registrar trazabilidad
UPDATE public."Pedido"
SET 
    "Total" = 196.56,
    "Observacion" = COALESCE("Observacion", '') || ' [Ajuste Entrega Real: Bs. 196.56. Cobro #281 por Bs. 275.00 genera anticipo a favor del cliente por Bs. 78.44]',
    "FechaModificacion" = NOW()
WHERE "IdPedido" = 461;

-- 2. Ajustar la Nota de Venta #461 al valor entregado
UPDATE public."NotaVenta"
SET 
    "Total" = 196.56,
    "Observaciones" = COALESCE("Observaciones", '') || ' [Entrega parcial ajustada: Bs. 196.56. Saldo a favor cliente: Bs. 78.44]'
WHERE "IdPedido" = 461;

-- 3. Ajustar el total del Pedido #462 al valor entregado y registrar trazabilidad
UPDATE public."Pedido"
SET 
    "Total" = 139.32,
    "Observacion" = COALESCE("Observacion", '') || ' [Ajuste Entrega Real: Bs. 139.32. Cobro #282 por Bs. 150.00 genera anticipo a favor del cliente por Bs. 10.68]',
    "FechaModificacion" = NOW()
WHERE "IdPedido" = 462;

-- 4. Ajustar la Nota de Venta #462 al valor entregado
UPDATE public."NotaVenta"
SET 
    "Total" = 139.32,
    "Observaciones" = COALESCE("Observaciones", '') || ' [Entrega parcial ajustada: Bs. 139.32. Saldo a favor cliente: Bs. 10.68]'
WHERE "IdPedido" = 462;

-- 5. Registrar anticipo / saldo a favor de los clientes (si existe tabla de anticipos o saldo deudor)
-- En caso de contar con columna SaldoPendiente / SaldoFavor en Cliente:
-- UPDATE public."Cliente" SET "SaldoAFavor" = COALESCE("SaldoAFavor", 0) + 78.44 WHERE "IdCliente" = 192;
-- UPDATE public."Cliente" SET "SaldoAFavor" = COALESCE("SaldoAFavor", 0) + 10.68 WHERE "IdCliente" = 193;

-- Descomentar COMMIT si la revisión contable aprueba la Variante A
-- COMMIT;
ROLLBACK;


-- ============================================================================
-- VARIANTE B:
-- AJUSTAR COBRO A LO ENTREGADO Y REGISTRAR DEVOLUCIÓN EN RENDICIÓN DEL CHOFER
-- ============================================================================
-- Justificación:
-- Si el dinero sobrante (Bs. 89.12) fue devuelto en efectivo de inmediato a los clientes
-- o si el chofer rendirá únicamente lo facturado legalmente y se le solicita devolver
-- la diferencia en la liquidación de caja.
-- En esta variante:
-- 1. Pedido, Nota de Venta y Pago se ajustan exactamente a Bs. 196.56 y Bs. 139.32.
-- 2. El dinero cobrado en exceso se descuenta del Pago registrado.
-- ============================================================================

BEGIN;

-- 1. Pedido #461 y Pago #281
UPDATE public."Pedido"
SET 
    "Total" = 196.56,
    "Observacion" = COALESCE("Observacion", '') || ' [Ajustado a valor entregado Bs. 196.56. Devolución de cambio en efectivo: Bs. 78.44]',
    "FechaModificacion" = NOW()
WHERE "IdPedido" = 461;

UPDATE public."NotaVenta"
SET 
    "Total" = 196.56
WHERE "IdPedido" = 461;

UPDATE public."Pago"
SET 
    "Monto" = 196.56,
    "Observacion" = COALESCE("Observacion", '') || ' [Ajuste de cobro a lo entregado. Devolución Bs. 78.44]'
WHERE "IdPago" = 281 AND "IdPedido" = 461;

-- 2. Pedido #462 y Pago #282
UPDATE public."Pedido"
SET 
    "Total" = 139.32,
    "Observacion" = COALESCE("Observacion", '') || ' [Ajustado a valor entregado Bs. 139.32. Devolución de cambio en efectivo: Bs. 10.68]',
    "FechaModificacion" = NOW()
WHERE "IdPedido" = 462;

UPDATE public."NotaVenta"
SET 
    "Total" = 139.32
WHERE "IdPedido" = 462;

UPDATE public."Pago"
SET 
    "Monto" = 139.32,
    "Observacion" = COALESCE("Observacion", '') || ' [Ajuste de cobro a lo entregado. Devolución Bs. 10.68]'
WHERE "IdPago" = 282 AND "IdPedido" = 462;

-- Descomentar COMMIT si la revisión contable aprueba la Variante B
-- COMMIT;
ROLLBACK;


-- ============================================================================
-- 3. CONSULTA POSTERIOR DE VERIFICACIÓN
-- ============================================================================
SELECT 
    p."IdPedido",
    c."RazonSocial",
    p."Total" AS total_pedido,
    nv."Total" AS total_nota_venta,
    pa."Monto" AS monto_pago,
    (pa."Monto" - p."Total") AS balance_excedente,
    p."Observacion"
FROM public."Pedido" p
JOIN public."Cliente" c ON c."IdCliente" = p."IdCliente"
LEFT JOIN public."NotaVenta" nv ON nv."IdPedido" = p."IdPedido"
LEFT JOIN public."Pago" pa ON pa."IdPedido" = p."IdPedido"
WHERE p."IdPedido" IN (461, 462);
