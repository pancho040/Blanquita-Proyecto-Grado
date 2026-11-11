import axios from "axios";
import { CONFIG } from "../constants/Config";
import { SecureStorage } from "../services/secureStorage";
import { LocalDB } from "../database/localDb";

// Escuchador global de arranque en frío (Render Free)
let onServerWakingUpListener = null;
export function setServerWakingUpListener(listener) {
  onServerWakingUpListener = listener;
}

// Escuchadores globales de versión
let onHardBlockListener = null;
let onSoftUpdateListener = null;

export function setHardBlockListener(listener) {
  onHardBlockListener = listener;
}

export function setSoftUpdateListener(listener) {
  onSoftUpdateListener = listener;
}

// Compatibilidad hacia atrás con versión anterior
export function setUpdateRequiredListener(listener) {
  onHardBlockListener = (required, version) => listener(required, version);
}

// Cliente HTTP configurado para interactuar con FastAPI de Blanquita-Backend
const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: CONFIG.API_TIMEOUT_MS, // 65s para tolerar arranque en frío de Render
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Client-Version": CONFIG.CLIENT_VERSION,
    "x-client-user-agent": `BlanquitaMobile/${CONFIG.CLIENT_VERSION} (Android)`,
  },
});

// Interceptor para inyectar token Bearer desde SecureStorage o LocalDB
apiClient.interceptors.request.use(
  async (config) => {
    try {
      let token = await SecureStorage.obtenerToken();
      if (!token) {
        const sesion = await LocalDB.obtenerSesion();
        if (sesion?.tokens?.AccessToken) {
          token = sesion.tokens.AccessToken;
        }
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_e) {
      // Continuar sin token si falla la lectura segura
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejo de reintentos, versión mínima y formato de errores
apiClient.interceptors.response.use(
  (response) => {
    if (onServerWakingUpListener) {
      onServerWakingUpListener(false);
    }
    // Requisito C6 / Punto 5: Comprobación de versión
    const minVersion =
      response.headers?.["x-minimum-client-version"] ||
      response.headers?.["x-min-client-version"];
    const latestVersion =
      response.headers?.["x-latest-client-version"] ||
      response.headers?.["x-available-client-version"];
    const upgradeRequired = response.headers?.["x-upgrade-required"] === "true";

    // 1. Bloqueo duro: solo si el backend envía explícitamente x-upgrade-required: true
    if (upgradeRequired) {
      if (onHardBlockListener) {
        onHardBlockListener(true, minVersion || latestVersion || "1.0.1");
      }
    } else if (
      (latestVersion && latestVersion > CONFIG.CLIENT_VERSION) ||
      (minVersion && minVersion > CONFIG.CLIENT_VERSION)
    ) {
      // 2. Si solo hay versión nueva disponible: banner no bloqueante (chofer puede seguir operando)
      if (onSoftUpdateListener) {
        onSoftUpdateListener(latestVersion || minVersion);
      }
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config) {
      return Promise.reject(error);
    }

    // Comprobación de versión si el backend rechaza con 426 Upgrade Required (Bloqueo duro)
    if (error.response?.status === 426) {
      const minVersion = error.response.headers?.["x-min-client-version"] || "1.0.1";
      if (onHardBlockListener) {
        onHardBlockListener(true, minVersion);
      }
    }

    // Detección de arranque en frío de Render (timeout en la primera petición)
    if (
      (error.code === "ECONNABORTED" || error.message?.includes("timeout") || !error.response) &&
      !config._retry
    ) {
      config._retry = true;
      if (onServerWakingUpListener) {
        onServerWakingUpListener(true);
      }
      return apiClient(config);
    }

    if (onServerWakingUpListener) {
      onServerWakingUpListener(false);
    }

    // Normalizar error amigable
    const errorNormalizado = {
      status: error.response?.status || 500,
      code: error.response?.data?.codigo || error.code || "ERROR_RED",
      message: error.response?.data?.mensaje || error.response?.data?.detail || error.message,
      friendlyMessage: "Ocurrió un error al comunicarse con el servidor.",
      originalError: error,
    };

    if (error.response?.status === 401) {
      errorNormalizado.friendlyMessage = "Credenciales inválidas o sesión expirada.";
    } else if (error.response?.status === 409) {
      errorNormalizado.friendlyMessage = "Conflicto: la operación ya fue registrada.";
    } else if (error.response?.status === 429) {
      errorNormalizado.friendlyMessage = "Demasiados intentos. Por favor espere un momento.";
    }

    return Promise.reject(errorNormalizado);
  }
);

export default apiClient;
export { apiClient };
