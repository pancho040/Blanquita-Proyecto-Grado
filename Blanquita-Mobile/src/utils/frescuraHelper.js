/**
 * Helper para el cálculo y formato del indicador de frescura de datos (Punto 18).
 */

export const UMBRAL_DESACTUALIZADO_MINUTOS = 30;

/**
 * Calcula el texto de frescura y determina si los datos están desactualizados.
 * @param {Date|number|string|null} fechaSync - Fecha de la última sincronización exitosa.
 * @param {Date|number} [fechaReferencia=new Date()] - Fecha actual para comparar.
 * @returns {{ texto: string, minutos: number, desactualizado: boolean, mensajeAdvertencia: string|null }}
 */
export function formatearFrescura(fechaSync, fechaReferencia = new Date()) {
  if (!fechaSync) {
    return {
      texto: "Sin sincronizar",
      minutos: Infinity,
      desactualizado: true,
      mensajeAdvertencia: "Datos posiblemente desactualizados. Toque para actualizar.",
    };
  }

  const syncTime = new Date(fechaSync).getTime();
  const refTime = new Date(fechaReferencia).getTime();
  const diffMs = Math.max(0, refTime - syncTime);
  const minutos = diffMs / (60 * 1000);

  let texto = "";
  if (minutos < 1) {
    texto = "Actualizado hace un momento";
  } else if (minutos < 60) {
    texto = `Actualizado hace ${Math.floor(minutos)} min`;
  } else {
    const horas = Math.floor(minutos / 60);
    texto = `Actualizado hace ${horas} h`;
  }

  const desactualizado = minutos > UMBRAL_DESACTUALIZADO_MINUTOS;

  return {
    texto,
    minutos: Math.floor(minutos),
    desactualizado,
    mensajeAdvertencia: desactualizado
      ? "Datos posiblemente desactualizados. Toque para actualizar."
      : null,
  };
}

/**
 * Procesa la respuesta de sincronización del servidor para detectar cambios o recálculos de precio.
 * @param {Object} resultadoServidor
 * @returns {{ hayDiferencia: boolean, detalle: string|null }}
 */
export function detectarDiferenciaPrecio(resultadoServidor) {
  if (!resultadoServidor) return { hayDiferencia: false, detalle: null };

  const {
    precio_recalculado,
    diferencia_precio,
    monto_original,
    monto_recalculado,
    pedido_id,
  } = resultadoServidor;

  if (precio_recalculado || diferencia_precio) {
    const ref = pedido_id ? `Pedido #${pedido_id}` : "La entrega";
    const origen = monto_original !== undefined ? `Bs. ${Number(monto_original).toFixed(2)}` : "";
    const nuevo = monto_recalculado !== undefined ? `Bs. ${Number(monto_recalculado).toFixed(2)}` : "";

    return {
      hayDiferencia: true,
      detalle: `${ref}: El precio fue recalculado por el servidor al sincronizar (Original: ${origen} -> Actual: ${nuevo}).`,
    };
  }

  return { hayDiferencia: false, detalle: null };
}
