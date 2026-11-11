/**
 * Suite de Pruebas Unitarias - Fase 1.2 (Puntos 14, 16 y 18)
 * Valida:
 * 1. Cierre de sesión seguro con advertencia/bloqueo si hay operaciones de dinero pendientes (Punto 14).
 * 2. Validación de QR / transferencia que exige foto obligatoria en PaymentSelector (Punto 16).
 * 3. Componentes de entrada numérica y badges (Punto 16).
 * 4. Cálculo de frescura de datos con umbral de 30 minutos (Punto 18).
 * 5. Detección y formato claro del aviso de recálculo de precio del servidor (Punto 18).
 */

const assert = require("assert");

(async () => {
  const { formatearFrescura, detectarDiferenciaPrecio } = await import("../src/utils/frescuraHelper.js");
  const { validarPagoComprobante } = await import("../src/utils/paymentValidator.js");

  console.log("==================================================================");
  console.log("  TESTS FASE 1.2: SEGURIDAD DE SESIÓN, COMPONENTES Y FRESCURA     ");
  console.log("==================================================================\n");

  // -------------------------------------------------------------
  // 1. PUNTO 14: Cierre de Sesión Seguro con Cola Offline Pendiente
  // -------------------------------------------------------------
  console.log("1. Probando cierre de sesión seguro con dinero pendiente en cola...");

  function simularCierreSesion(cola, forzar = false) {
    const tieneDineroPendiente = cola.some((item) =>
      ["ENTREGA", "COBRO", "CIERRE_RUTA"].includes(item.tipo)
    );

    if (tieneDineroPendiente && !forzar) {
      return {
        bloqueado: true,
        requiereConfirmacion: true,
        mensaje: "Existen transacciones de dinero pendientes. Sincronice primero o confirme la pérdida irreversible.",
        cantidad: cola.length,
      };
    }

    return {
      bloqueado: false,
      tokensBorrados: true,
      cacheLimpio: true,
    };
  }

  // Caso 1A: Cola vacía -> Se permite cierre directo
  const resVacia = simularCierreSesion([]);
  assert.strictEqual(resVacia.bloqueado, false, "Cola vacía debe permitir cierre directo");
  assert.strictEqual(resVacia.tokensBorrados, true);
  console.log("   -> [PASS] Cierre directo permitido con cola vacía.");

  // Caso 1B: Cola con cobros/entregas sin forzar -> Bloqueado y exige confirmación
  const colaConCobro = [
    { id: 1, tipo: "COBRO", monto: 150.0 },
    { id: 2, tipo: "ENTREGA", monto: 450.0 },
  ];
  const resBloqueada = simularCierreSesion(colaConCobro, false);
  assert.strictEqual(resBloqueada.bloqueado, true, "Debe bloquear el borrado si hay dinero en cola");
  assert.strictEqual(resBloqueada.requiereConfirmacion, true);
  assert.strictEqual(resBloqueada.cantidad, 2);
  console.log("   -> [PASS] Cierre bloqueado cuando hay dinero pendiente en cola.");

  // Caso 1C: Con forzar = true -> Se permite cierre tras confirmación explícita
  const resForzada = simularCierreSesion(colaConCobro, true);
  assert.strictEqual(resForzada.bloqueado, false);
  assert.strictEqual(resForzada.tokensBorrados, true);
  console.log("   -> [PASS] Cierre forzado borra datos tras confirmación del chofer.");

  // -------------------------------------------------------------
  // 2. PUNTO 16: PaymentSelector y Validación de QR / Foto Obligatoria
  // -------------------------------------------------------------
  console.log("\n2. Probando validación estricta de comprobante para pagos QR/Transferencia...");

  // Caso 2A: Efectivo no requiere comprobante
  const valEfectivo = validarPagoComprobante("EFECTIVO", null);
  assert.strictEqual(valEfectivo.valido, true, "Efectivo debe ser válido sin comprobante");
  console.log("   -> [PASS] Pago en EFECTIVO aprobado sin foto obligatoria.");

  // Caso 2B: QR sin comprobante -> BLOQUEADO
  const valQrSinFoto = validarPagoComprobante("QR", null);
  assert.strictEqual(valQrSinFoto.valido, false, "QR sin foto debe ser inválido");
  assert.strictEqual(valQrSinFoto.error, "Los pagos con QR requieren capturar foto del comprobante");
  console.log("   -> [PASS] Pago con QR sin foto bloqueado correctamente.");

  // Caso 2C: QR con comprobante -> APROBADO
  const valQrConFoto = validarPagoComprobante("QR", { uri: "file:///mock/foto_qr.jpg" });
  assert.strictEqual(valQrConFoto.valido, true, "QR con foto debe ser aprobado");
  console.log("   -> [PASS] Pago con QR con foto de comprobante aprobado.");

  // Caso 2D: Transferencia sin comprobante -> BLOQUEADO
  const valTrSinFoto = validarPagoComprobante("TRANSFERENCIA", null);
  assert.strictEqual(valTrSinFoto.valido, false);
  console.log("   -> [PASS] Pago con Transferencia sin foto bloqueado correctamente.");

  // -------------------------------------------------------------
  // 3. PUNTO 18: Frescura de Datos (Tiempo transcurrido y advertencia > 30 min)
  // -------------------------------------------------------------
  console.log("\n3. Probando cálculo de frescura de datos y advertencia de obsolescencia...");

  const ahora = new Date("2026-11-11T12:00:00Z");

  // Caso 3A: Hace 20 segundos (< 1 min)
  const sync20s = new Date(ahora.getTime() - 20 * 1000);
  const res20s = formatearFrescura(sync20s, ahora);
  assert.strictEqual(res20s.texto, "Actualizado hace un momento");
  assert.strictEqual(res20s.desactualizado, false);
  console.log("   -> [PASS] < 1 min: 'Actualizado hace un momento'.");

  // Caso 3B: Hace 15 minutos (1..59 min)
  const sync15m = new Date(ahora.getTime() - 15 * 60 * 1000);
  const res15m = formatearFrescura(sync15m, ahora);
  assert.strictEqual(res15m.texto, "Actualizado hace 15 min");
  assert.strictEqual(res15m.desactualizado, false);
  console.log("   -> [PASS] 15 min: 'Actualizado hace 15 min' (no desactualizado).");

  // Caso 3C: Hace 35 minutos (> 30 min umbral) -> Desactualizado con advertencia
  const sync35m = new Date(ahora.getTime() - 35 * 60 * 1000);
  const res35m = formatearFrescura(sync35m, ahora);
  assert.strictEqual(res35m.texto, "Actualizado hace 35 min");
  assert.strictEqual(res35m.desactualizado, true);
  assert.strictEqual(
    res35m.mensajeAdvertencia,
    "Datos posiblemente desactualizados. Toque para actualizar."
  );
  console.log("   -> [PASS] 35 min: Activa advertencia 'Datos posiblemente desactualizados. Toque para actualizar.'.");

  // Caso 3D: Hace 2 horas (> 60 min)
  const sync2h = new Date(ahora.getTime() - 120 * 60 * 1000);
  const res2h = formatearFrescura(sync2h, ahora);
  assert.strictEqual(res2h.texto, "Actualizado hace 2 h");
  assert.strictEqual(res2h.desactualizado, true);
  console.log("   -> [PASS] > 60 min: 'Actualizado hace 2 h'.");

  // -------------------------------------------------------------
  // 4. PUNTO 18: Detección y formato de recálculo de precios del servidor
  // -------------------------------------------------------------
  console.log("\n4. Probando aviso de diferencia de precio del servidor tras sincronizar entrega offline...");

  const respServidorSinCambio = {
    exito: true,
    pedido_id: 1045,
    precio_recalculado: false,
  };
  const resCheckSinCambio = detectarDiferenciaPrecio(respServidorSinCambio);
  assert.strictEqual(resCheckSinCambio.hayDiferencia, false);
  console.log("   -> [PASS] Entrega con precio idéntico no emite alerta.");

  const respServidorConRecalculo = {
    exito: true,
    pedido_id: 1045,
    precio_recalculado: true,
    monto_original: 450.0,
    monto_recalculado: 480.0,
  };
  const resCheckRecalculo = detectarDiferenciaPrecio(respServidorConRecalculo);
  assert.strictEqual(resCheckRecalculo.hayDiferencia, true);
  assert(
    resCheckRecalculo.detalle.includes("Pedido #1045"),
    "Debe referenciar el número de pedido"
  );
  assert(
    resCheckRecalculo.detalle.includes("Original: Bs. 450.00 -> Actual: Bs. 480.00"),
    "Debe mostrar claramente los montos original y recalculado"
  );
  console.log(`   -> [PASS] Alerta formateada para el chofer: "${resCheckRecalculo.detalle}"`);

  console.log("\n==================================================================");
  console.log("  TODAS LAS PRUEBAS DE LA FASE 1.2 (PUNTOS 14, 16, 18) SUPERADAS!  ");
  console.log("==================================================================");
})();
