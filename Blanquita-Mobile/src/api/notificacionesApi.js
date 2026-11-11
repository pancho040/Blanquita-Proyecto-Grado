import apiClient from "./client";

/**
 * API Client para la bandeja de notificaciones internas del chofer (NotificacionInterna).
 * Soporta consulta periódica (polling) y marcado como leída mediante PATCH.
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
    const response = await apiClient.patch(
      `/api/movil/v1/notificaciones/${idNotificacion}/leida`
    );
    return response.data;
  },
};

export default NotificacionesApi;
