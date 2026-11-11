/**
 * Validador estricto de métodos de pago y comprobantes (Punto 16).
 * Regla de negocio:
 * - EFECTIVO no exige comprobante fotográfico.
 * - QR y TRANSFERENCIA exigen foto/comprobante adjunto. Si falta, bloquea la confirmación.
 */

export function validarPagoComprobante(metodoPago, comprobante) {
  if (metodoPago === "QR") {
    if (!comprobante || (!comprobante.uri && !comprobante.base64 && !comprobante.id)) {
      return {
        valido: false,
        error: "Los pagos con QR requieren capturar foto del comprobante",
      };
    }
  }

  if (metodoPago === "TRANSFERENCIA") {
    if (!comprobante || (!comprobante.uri && !comprobante.base64 && !comprobante.id)) {
      return {
        valido: false,
        error: "Las transferencias requieren capturar foto del comprobante",
      };
    }
  }

  return { valido: true, error: null };
}

export default {
  validarPagoComprobante,
};
