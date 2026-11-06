/**
 * Sistema de Caché en Memoria con TTL (Time-To-Live)
 * Servicio centralizado de caché en memoria con expiración por TTL.
 * Sincronizado bidireccionalmente con api-cache para máxima coherencia.
 */
import { invalidarCache as apiInvalidarCache, onInvalidate } from "./api-cache";

class CacheService {
  constructor() {
    this.store = new Map();

    // Sincronizar automáticamente cuando api-cache invalide
    if (typeof window !== "undefined") {
      onInvalidate((prefijo) => {
        if (!prefijo) {
          this.store.clear();
        } else {
          // Normalizar formato de prefijo (ej. /api/rrhh -> rrhh:)
          const limpio = prefijo.replace(/^\/api\//, "").replace(/\//g, ":");
          for (const key of this.store.keys()) {
            if (key.startsWith(limpio) || key.includes(limpio)) {
              this.store.delete(key);
            }
          }
        }
      });
    }
  }

  /**
   * Obtiene un elemento de la caché si no ha expirado.
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Almacena datos en la caché con un tiempo de expiración.
   * @param {string} key
   * @param {any} data
   * @param {number} ttlSegundos - Por defecto 300 segundos (5 minutos)
   */
  set(key, data, ttlSegundos = 300) {
    this.store.set(key, {
      data,
      expiry: Date.now() + ttlSegundos * 1000,
      createdAt: Date.now(),
    });
  }

  /**
   * Invalida una clave exacta o todas las que comiencen con un prefijo.
   * @param {string} keyOrPrefix
   */
  invalidate(keyOrPrefix) {
    for (const key of this.store.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
    // Propagar también a api-cache
    if (keyOrPrefix) {
      const rutaApi = "/api/" + keyOrPrefix.replace(/:/g, "/").replace(/\/$/, "");
      apiInvalidarCache(rutaApi);
    } else {
      apiInvalidarCache();
    }
  }

  /**
   * Limpia toda la memoria caché.
   */
  clear() {
    this.store.clear();
    apiInvalidarCache();
  }

  // Helpers de dominio
  invalidateRRHH() {
    this.invalidate("rrhh:");
  }

  invalidateContabilidad() {
    this.invalidate("contabilidad:");
  }

  invalidateLogistica() {
    this.invalidate("logistica:");
  }
}

export const cache = new CacheService();
export const invalidateRRHH = () => cache.invalidateRRHH();
export const invalidateContabilidad = () => cache.invalidateContabilidad();
export const invalidateLogistica = () => cache.invalidateLogistica();
