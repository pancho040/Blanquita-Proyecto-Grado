import apiClient from "./client";

/**
 * Servicios de Autenticación para Choferes / Repartidores
 */
export const AuthApi = {
  // Iniciar sesión con CI y Contraseña
  async login(ci, clave) {
    const response = await apiClient.post("/auth/login", {
      Ci: ci.trim(),
      Clave: clave,
    });
    return response.data; // { AccessToken, RefreshToken }
  },

  // Refrescar token de acceso
  async refreshToken(refreshTokenCrudo) {
    const response = await apiClient.post("/auth/refresh", {
      RefreshToken: refreshTokenCrudo,
    });
    return response.data;
  },

  // Obtener perfil del usuario autenticado
  async obtenerPerfil() {
    const response = await apiClient.get("/usuario/perfil");
    return response.data;
  },
};
