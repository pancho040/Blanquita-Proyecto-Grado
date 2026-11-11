import apiClient from "./client";

/**
 * Servicios de Autenticación y Dispositivos para la App Móvil (Fase 1)
 * Consume la API Móvil v1 centralizada de FastAPI (arquitectura cliente-servidor desacoplada)
 */
export const AuthApi = {
  // Iniciar sesión con CI y Contraseña
  async login(ci, clave) {
    const response = await apiClient.post("/api/movil/v1/auth/login", {
      Ci: ci.trim(),
      Clave: clave,
    });
    // Formato uniforme MovilResponse: { codigo, mensaje, request_id, datos }
    return response.data?.datos || response.data;
  },

  // Refrescar token de acceso
  async refreshToken(refreshTokenCrudo) {
    const response = await apiClient.post("/api/movil/v1/auth/refresh", {
      refresh_token: refreshTokenCrudo,
    });
    return response.data?.datos || response.data;
  },

  // Cerrar sesión y desasociar dispositivo push
  async logout(tokenPush = null) {
    try {
      const response = await apiClient.post("/api/movil/v1/auth/logout", {
        token_push: tokenPush,
      });
      return response.data?.datos || response.data;
    } catch (_e) {
      return { sesion_revocada: true };
    }
  },

  // Registrar token push Expo del chofer
  async registrarDispositivo(tokenPush, plataforma = "android", versionApp = "1.0.0") {
    const response = await apiClient.post("/api/movil/v1/dispositivos/registro", {
      token_push: tokenPush,
      plataforma,
      version_app: versionApp,
    });
    return response.data?.datos || response.data;
  },

  // Bandeja de notificaciones internas del chofer
  async obtenerNotificaciones(soloNoLeidas = false) {
    const response = await apiClient.get("/api/movil/v1/notificaciones", {
      params: { solo_no_leidas: soloNoLeidas },
    });
    return response.data?.datos || [];
  },

  // Marcar notificación como leída
  async marcarNotificacionLeida(idNotificacion) {
    const response = await apiClient.put(`/api/movil/v1/notificaciones/${idNotificacion}/leida`);
    return response.data?.datos || response.data;
  },
};
