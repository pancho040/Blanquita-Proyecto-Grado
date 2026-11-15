/**
 * Utilidades canónicas de fecha para Blanquita Mobile.
 * Zona Horaria Oficial: America/La_Paz (UTC-4).
 * Evita el problema de que toISOString().slice(0, 10) avance al día siguiente a partir de las 20:00 BOT.
 */

const FORMATEADOR_BOLIVIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Retorna la fecha actual en Bolivia en formato 'YYYY-MM-DD'.
 * @returns {string}
 */
export function obtenerFechaHoyBolivia() {
  return FORMATEADOR_BOLIVIA.format(new Date());
}

/**
 * Verifica si un string de fecha (YYYY-MM-DD) corresponde a hoy en Bolivia.
 * @param {string} fechaStr 
 * @returns {boolean}
 */
export function esHoyBolivia(fechaStr) {
  if (!fechaStr) return false;
  return String(fechaStr).trim().slice(0, 10) === obtenerFechaHoyBolivia();
}

/**
 * Retorna la fecha de un Date o string en formato Bolivia YYYY-MM-DD.
 * @param {Date|string} fechaInput 
 * @returns {string}
 */
export function formatearFechaBolivia(fechaInput) {
  if (!fechaInput) return obtenerFechaHoyBolivia();
  const d = typeof fechaInput === "string" ? new Date(fechaInput) : fechaInput;
  if (isNaN(d.getTime())) return obtenerFechaHoyBolivia();
  return FORMATEADOR_BOLIVIA.format(d);
}

export default {
  obtenerFechaHoyBolivia,
  esHoyBolivia,
  formatearFechaBolivia,
};
