import apiClient from "./client";

/**
 * API Client para la bandeja de notificaciones internas del chofer (NotificacionInterna).
 * Soporta consulta periódica/manual y marcado como leída individual y masivo mediante PATCH oficial.
 */
export const NotificacionesApi = {
  /**
   * Obtiene las notificaciones del chofer autenticado.
   * @param {Object} params
   * @param {boolean} params.soloNoLeidas - Filtrar únicamente pendientes.
   */
  async obtenerNotificaciones({ soloNoLeidas = false } = {}) {
    const response = await apiClient.get("/api/movil/v1/notificaciones", {
      params: { solo_no_leidas: soloNoLeidas },
    });
    return response.data?.datos || [];
  },

  /**
   * Marca una notificación como leída mediante PATCH oficial.
   * Filtra IDs locales y sintéticos (banner-, ws-, etc.) para evitar 422 del backend.
   * @param {number|string} idNotificacion - ID de la notificación interna.
   */
  async marcarComoLeida(idNotificacion) {
    if (idNotificacion == null) return null;
    const strId = String(idNotificacion).trim();
    // Banners locales en la app o eventos WS no son IDs numéricos persistidos en la base del backend
    if (!/^\d+$/.test(strId)) {
      return { success: true, localOnly: true, id: idNotificacion };
    }
    try {
      const response = await apiClient.patch(
        `/api/movil/v1/notificaciones/${strId}/leida`
      );
      return response.data;
    } catch (error) {
      // Degradar silenciosamente si no existe en backend (404/422)
      if (error?.response?.status === 404 || error?.response?.status === 422) {
        return { success: true, degraded: true, id: idNotificacion };
      }
      throw error;
    }
  },

  /**
   * Marca una lista de notificaciones como leídas en paralelo.
   * Descarta IDs locales temporales generados por banners o WebSocket antes de enviar al servidor.
   * @param {Array<number|string>} idsNotificaciones
   */
  async marcarTodasComoLeidas(idsNotificaciones = []) {
    if (!Array.isArray(idsNotificaciones) || idsNotificaciones.length === 0) {
      return [];
    }
    const peticiones = idsNotificaciones
      .filter((id) => id != null && /^\d+$/.test(String(id).trim()))
      .map((id) => this.marcarComoLeida(id).catch(() => null));
    return await Promise.allSettled(peticiones);
  },
};

export default NotificacionesApi;
