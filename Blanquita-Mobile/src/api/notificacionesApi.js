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
   * @param {number|string} idNotificacion - ID de la notificación interna.
   */
  async marcarComoLeida(idNotificacion) {
    if (!idNotificacion) return null;
    const response = await apiClient.patch(
      `/api/movil/v1/notificaciones/${idNotificacion}/leida`
    );
    return response.data;
  },

  /**
   * Marca una lista de notificaciones como leídas en paralelo.
   * Descarta IDs locales temporales generados por WebSocket antes de enviar al servidor.
   * @param {Array<number|string>} idsNotificaciones
   */
  async marcarTodasComoLeidas(idsNotificaciones = []) {
    if (!Array.isArray(idsNotificaciones) || idsNotificaciones.length === 0) {
      return [];
    }
    const peticiones = idsNotificaciones
      .filter((id) => id != null && !String(id).startsWith("ws-"))
      .map((id) => this.marcarComoLeida(id).catch(() => null));
    return await Promise.allSettled(peticiones);
  },
};

export default NotificacionesApi;
