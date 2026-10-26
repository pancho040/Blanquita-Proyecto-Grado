/**
 * Sistema de caché ligero en memoria para el frontend.
 * Evita repetir llamadas HTTP idénticas cuando el usuario navega entre módulos.
 */

const cacheStore = new Map();

/**
 * Realiza un fetch con caché en memoria para peticiones GET.
 * Si es una mutación (POST, PUT, DELETE, PATCH), invalida automáticamente
 * la caché asociada a ese endpoint para mantener los datos siempre actualizados.
 *
 * @param {string} url - URL del endpoint.
 * @param {RequestInit} [opciones] - Opciones de fetch.
 * @param {number} [ttlMs=45000] - Tiempo de vida en ms (por defecto 45s).
 */
export async function fetchConCache(url, opciones = {}, ttlMs = 45000) {
  const metodo = (opciones.method || "GET").toUpperCase();

  // Si no es GET, ejecutar directamente y purgar caché del módulo
  if (metodo !== "GET") {
    const respuesta = await fetch(url, opciones);
    if (respuesta.ok) {
      // Purgar la raíz del endpoint (ej: /api/tesoreria/... -> /api/tesoreria)
      const rutaBase = url.split("?")[0].replace(/\/\d+$/, "");
      invalidarCache(rutaBase);
    }
    return respuesta;
  }

  const clave = url;
  const ahora = Date.now();
  const entrada = cacheStore.get(clave);

  // Si está en caché y aún no expiró, retornar clon de los datos
  if (entrada && ahora - entrada.timestamp < ttlMs) {
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(JSON.stringify(entrada.data)),
      text: async () => JSON.stringify(entrada.data),
    };
  }

  const respuesta = await fetch(url, opciones);

  if (respuesta.ok) {
    try {
      const data = await respuesta.clone().json();
      cacheStore.set(clave, { data, timestamp: ahora });
    } catch {
      /* no es json */
    }
  }

  return respuesta;
}

/**
 * Invalida entradas de caché que inicien con el prefijo dado.
 * Si no se proporciona prefijo, limpia toda la caché.
 */
export function invalidarCache(prefijo = null) {
  if (!prefijo) {
    cacheStore.clear();
    return;
  }
  for (const clave of cacheStore.keys()) {
    if (clave.startsWith(prefijo)) {
      cacheStore.delete(clave);
    }
  }
}
