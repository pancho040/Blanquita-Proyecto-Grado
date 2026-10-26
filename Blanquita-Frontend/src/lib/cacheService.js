/**
 * Sistema de Caché en Memoria con TTL (Time-To-Live)
 * Inspirado en la arquitectura de caché centralizada de front-focus.
 * Reduce llamadas duplicadas al backend y agiliza la navegación instantánea.
 */

class CacheService {
  constructor() {
    this.store = new Map();
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
  }

  /**
   * Limpia toda la memoria caché.
   */
  clear() {
    this.store.clear();
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
