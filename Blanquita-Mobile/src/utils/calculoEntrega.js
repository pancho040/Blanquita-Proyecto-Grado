/**
 * calculoEntrega.js
 * Función canónica de cálculo del total de entrega e ítems.
 * Garantiza 100% de paridad matemática con el backend.
 */

function redondearDosDecimales(num) {
  const n = Number(num);
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el subtotal por ítem y el total general de la entrega.
 * @param {Array} items - Lista de ítems con cantidad, precio_unitario, es_bandeo y descuento
 * @returns {{ total: number, items: Array, itemsCalculados: Array }}
 */
function calcularTotalEntrega(items = []) {
  if (!Array.isArray(items)) return { total: 0, items: [], itemsCalculados: [] };

  let totalAcumulado = 0;
  const itemsCalculados = items.map((it) => {
    const cantidad = Math.max(0, Number(it.cantidad ?? it.cantidadAEntregar ?? 0));
    const precioUnitario = Math.max(0, Number(it.precio_unitario ?? it.PrecioUnitario ?? it.precio ?? 0));
    const esBandeo = Boolean(it.es_bandeo || it.es_cortesia_bandeo);
    const descuento = Math.max(0, Number(it.descuento || 0));

    let subtotalItem = 0;
    if (!esBandeo) {
      subtotalItem = redondearDosDecimales(cantidad * precioUnitario - descuento);
      subtotalItem = Math.max(0, subtotalItem);
    }

    totalAcumulado = redondearDosDecimales(totalAcumulado + subtotalItem);

    return {
      ...it,
      cantidad,
      precio_unitario: precioUnitario,
      es_bandeo: esBandeo,
      subtotal: subtotalItem,
    };
  });

  return {
    total: totalAcumulado,
    items: itemsCalculados,
    itemsCalculados,
  };
}

/**
 * Valida si el monto cobrado es coherente con el total entregado.
 * @param {number} totalEntregado
 * @param {number} montoCobrado
 * @param {string|number} condicionPago - Condición de pago o tolerancia numérica
 * @param {number} excedente - Excedente declarado formalmente como saldo a favor
 * @param {number} tolerancia - Margen de centavos (por defecto 0.05)
 * @returns {{ valido: boolean, esValido: boolean, excede: boolean, totalEntregado: number, montoCobrado: number, diferencia: number, codigo: string|null }}
 */
function validarCoherenciaCobro(totalEntregado, montoCobrado, condicionPago = "COMPLETO", excedente = 0, tolerancia = 0.05) {
  const tol = typeof condicionPago === "number" ? condicionPago : tolerancia;
  const tot = redondearDosDecimales(totalEntregado);
  const cob = redondearDosDecimales(montoCobrado);
  const excede = cob > redondearDosDecimales(tot + tol);
  const diferencia = redondearDosDecimales(cob - tot);
  const exc = redondearDosDecimales(excedente);

  // Es válido si no excede o si el excedente declarado justifica la diferencia
  const esValido = !excede || (exc > 0 && Math.abs(exc - diferencia) <= tol);

  return {
    valido: esValido,
    esValido,
    excede,
    totalEntregado: tot,
    montoCobrado: cob,
    diferencia: Math.max(0, diferencia),
    codigo: excede && !esValido ? "COBRO_EXCEDE_ENTREGADO" : null,
  };
}

// Soporte dual ES Modules y CommonJS (Node tests)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    redondearDosDecimales,
    calcularTotalEntrega,
    validarCoherenciaCobro,
  };
}

export { redondearDosDecimales, calcularTotalEntrega, validarCoherenciaCobro };
