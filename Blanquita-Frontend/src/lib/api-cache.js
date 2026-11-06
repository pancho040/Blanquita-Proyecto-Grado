/**
 * Sistema de caché ultra-rápido en memoria + sessionStorage para el frontend.
 * Previene llamadas HTTP duplicadas al navegar entre módulos o pestañas,
 * e implementa Request Coalescing (fusión de peticiones simultáneas idénticas).
 */

const cacheStore = new Map();
const pendingRequests = new Map();
const invalidationListeners = new Set();

const PREFIX_SESSION = "bq_cache_";

/**
 * Registra un listener para ser notificado cuando se invalide la caché.
 */
export function onInvalidate(listener) {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

function obtenerDeSession(clave, ahora, ttlMs) {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX_SESSION + clave);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (ahora - item.timestamp < ttlMs) {
      return item;
    }
    window.sessionStorage.removeItem(PREFIX_SESSION + clave);
  } catch {
    /* error de parseo o sessionStorage deshabilitado */
  }
  return null;
}

function guardarEnSession(clave, data, timestamp) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    // Solo almacenar strings de tamaño moderado (< 500KB) para no saturar sessionStorage
    const str = JSON.stringify({ data, timestamp });
    if (str.length < 500000) {
      window.sessionStorage.setItem(PREFIX_SESSION + clave, str);
    }
  } catch {
    /* quota excedida */
  }
}

function crearRespuestaCache(data) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => JSON.parse(JSON.stringify(data)),
    text: async () => JSON.stringify(data),
    clone: function () {
      return this;
    },
  };
}

/**
 * Realiza un fetch con caché de alto rendimiento para peticiones GET.
 * Fusiona peticiones en vuelo duplicadas para evitar disparar 2 consultas iguales.
 *
 * @param {string} url - URL del endpoint.
 * @param {RequestInit} [opciones] - Opciones de fetch.
 * @param {number} [ttlMs=45000] - Tiempo de vida en ms (por defecto 45s).
 */
export async function fetchConCache(url, opciones = {}, ttlMs = 45000) {
  const metodo = (opciones.method || "GET").toUpperCase();

  // Si es una mutación (POST, PUT, DELETE, PATCH), ejecutar e invalidar
  if (metodo !== "GET") {
    const respuesta = await fetch(url, opciones);
    if (respuesta.ok) {
      // Invalida la raíz del endpoint (ej: /api/rrhh/asistencia/1 -> /api/rrhh)
      const rutaBase = url.split("?")[0].replace(/\/\d+$/, "");
      invalidarCache(rutaBase);
    }
    return respuesta;
  }

  const clave = url;
  const ahora = Date.now();

  // 1. Revisar memoria RAM (0 ms)
  let entrada = cacheStore.get(clave);
  if (!entrada) {
    // 2. Revisar sessionStorage (mantiene caché viva entre cambios de módulo en Astro)
    entrada = obtenerDeSession(clave, ahora, ttlMs * 4);
    if (entrada) {
      cacheStore.set(clave, entrada);
    }
  }

  // Si está completamente fresca (< ttlMs), responder de inmediato
  if (entrada && ahora - entrada.timestamp < ttlMs) {
    return crearRespuestaCache(entrada.data);
  }

  // Stale-While-Revalidate (SWR): si tenemos datos útiles (< 3 minutos), devolverlos de inmediato y revalidar en segundo plano
  const esStaleAceptable = entrada && (ahora - entrada.timestamp < Math.max(ttlMs * 4, 180000));
  if (esStaleAceptable) {
    if (!pendingRequests.has(clave)) {
      const bgPromise = (async () => {
        try {
          const res = await fetch(url, opciones);
          if (res.ok) {
            const data = await res.clone().json();
            const reg = { data, timestamp: Date.now() };
            cacheStore.set(clave, reg);
            guardarEnSession(clave, data, reg.timestamp);
          }
        } catch {}
      })().finally(() => {
        pendingRequests.delete(clave);
      });
      pendingRequests.set(clave, bgPromise);
    }
    return crearRespuestaCache(entrada.data);
  }

  // 3. Request Coalescing: Si ya hay una petición IDÉNTICA en curso, no disparar otra
  if (pendingRequests.has(clave)) {
    try {
      const dataCompartida = await pendingRequests.get(clave);
      if (dataCompartida !== null && dataCompartida !== undefined) {
        return crearRespuestaCache(dataCompartida);
      }
    } catch {
      /* Reintentar con fetch normal si falló la compartida */
    }
  }

  // 4. Disparar fetch y registrar promesa en vuelo
  const fetchPromise = (async () => {
    try {
      const respuesta = await fetch(url, opciones);
      if (respuesta.ok) {
        const data = await respuesta.clone().json();
        const registro = { data, timestamp: Date.now() };
        cacheStore.set(clave, registro);
        guardarEnSession(clave, data, registro.timestamp);
        return data;
      }
    } catch (err) {
      /* ignorar para permitir fallback */
    }
    return null;
  })();

  pendingRequests.set(clave, fetchPromise);

  let dataFinal;
  try {
    dataFinal = await fetchPromise;
  } finally {
    pendingRequests.delete(clave);
  }

  if (dataFinal !== null && dataFinal !== undefined) {
    return crearRespuestaCache(dataFinal);
  }

  // Fallback si no fue JSON o dio error
  return await fetch(url, opciones);
}

/**
 * Invalida entradas de caché que inicien con el prefijo dado.
 * Si no se proporciona prefijo, limpia toda la caché.
 */
export function invalidarCache(prefijo = null) {
  if (!prefijo) {
    cacheStore.clear();
    pendingRequests.clear();
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        Object.keys(window.sessionStorage).forEach((k) => {
          if (k.startsWith(PREFIX_SESSION)) window.sessionStorage.removeItem(k);
        });
      } catch {}
    }
  } else {
    for (const clave of cacheStore.keys()) {
      if (clave.startsWith(prefijo) || clave.includes(prefijo)) {
        cacheStore.delete(clave);
      }
    }
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        Object.keys(window.sessionStorage).forEach((k) => {
          if (k.startsWith(PREFIX_SESSION) && (k.includes(prefijo) || k.startsWith(PREFIX_SESSION + prefijo))) {
            window.sessionStorage.removeItem(k);
          }
        });
      } catch {}
    }
  }

  // Notificar a listeners registrados (ej. cacheService)
  for (const listener of invalidationListeners) {
    try {
      listener(prefijo);
    } catch {}
  }
}
