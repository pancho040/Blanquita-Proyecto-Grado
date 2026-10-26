import axios from "axios";
import { CONFIG } from "../constants/Config";
import { LocalDB } from "../database/localDb";

// Cliente HTTP configurado para interactuar con FastAPI de Blanquita-Backend
const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: CONFIG.API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor para inyectar token de autorización Bearer automáticamente
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const sesion = await LocalDB.obtenerSesion();
      if (sesion && sesion.tokens && sesion.tokens.AccessToken) {
        config.headers.Authorization = `Bearer ${sesion.tokens.AccessToken}`;
      }
    } catch (e) {
      // Continuar sin token si falla la lectura local
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejo unificado de errores y desconexiones
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Si no hay respuesta del servidor (modo offline o servidor caído)
    if (!error.response) {
      error.isOffline = true;
      error.friendlyMessage = "Sin conexión con el servidor. Operando en modo local.";
    } else {
      const status = error.response.status;
      if (status === 401) {
        error.friendlyMessage = "Sesión expirada o credenciales inválidas.";
      } else if (status === 403) {
        error.friendlyMessage = "No tienes permisos de Repartidor para esta acción.";
      } else if (status >= 500) {
        error.friendlyMessage = "Error interno en el servidor central.";
      } else {
        error.friendlyMessage =
          error.response.data?.detail || "Error en la solicitud al servidor.";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
