/**
 * Utilidades de fecha canónicas para Papelera Blanquita.
 * Zona Horaria Oficial: America/La_Paz (UTC-4).
 * Prohibido usar new Date().toISOString().slice(0, 10) porque después de las 20:00 BOT
 * la fecha UTC avanza al día siguiente.
 */

const FORMATEADOR_BOLIVIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

/**
 * Retorna la fecha actual en Bolivia en formato YYYY-MM-DD.
 * @returns {string} Fecha local 'YYYY-MM-DD'
 */
export function obtenerFechaHoyBolivia() {
  return FORMATEADOR_BOLIVIA.format(new Date());
}

/**
 * Valida si un string de fecha (YYYY-MM-DD) corresponde al día de hoy en Bolivia.
 * @param {string} fechaStr 
 * @returns {boolean}
 */
export function esHoyBolivia(fechaStr) {
  if (!fechaStr) return false;
  return String(fechaStr).trim().slice(0, 10) === obtenerFechaHoyBolivia();
}

/**
 * Suma días a una fecha en Bolivia (por defecto hoy) y retorna YYYY-MM-DD.
 * @param {number} dias 
 * @param {string} [fechaBaseStr] 
 * @returns {string} 'YYYY-MM-DD'
 */
export function sumarDiasBolivia(dias = 0, fechaBaseStr = null) {
  const base = fechaBaseStr ? String(fechaBaseStr).trim().slice(0, 10) : obtenerFechaHoyBolivia();
  const [y, m, d] = base.split("-").map(Number);
  const fecha = new Date(y, m - 1, d, 12, 0, 0);
  fecha.setDate(fecha.getDate() + dias);
  return FORMATEADOR_BOLIVIA.format(fecha);
}

/**
 * Retorna un objeto Date ajustado o el string formateado.
 */
export function formatearFechaBolivia(fechaInput) {
  if (!fechaInput) return obtenerFechaHoyBolivia();
  const d = typeof fechaInput === "string" ? new Date(fechaInput) : fechaInput;
  if (isNaN(d.getTime())) return obtenerFechaHoyBolivia();
  return FORMATEADOR_BOLIVIA.format(d);
}
