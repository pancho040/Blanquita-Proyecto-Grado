import axios from "axios";
import { CONFIG } from "../constants/Config";
import { SecureStorage } from "../services/secureStorage";
import { LocalDB } from "../database/localDb";

// Escuchador global de arranque en frío (Render Free)
let onServerWakingUpListener = null;
export function setServerWakingUpListener(listener) {
  onServerWakingUpListener = listener;
}

// Escuchadores globales de versión y sesión
let onHardBlockListener = null;
let onSoftUpdateListener = null;
let onSesionExpiradaListener = null;
let onTokenRenovadoListener = null;

export function setHardBlockListener(listener) {
  onHardBlockListener = listener;
}

export function setSoftUpdateListener(listener) {
  onSoftUpdateListener = listener;
}

export function setSesionExpiradaListener(listener) {
  onSesionExpiradaListener = listener;
}

export function setTokenRenovadoListener(listener) {
  onTokenRenovadoListener = listener;
}

// Variable en memoria para acceso síncrono e inmediato al token (Subagente A)
let tokenEnMemoria = null;

export function setTokenEnMemoria(token) {
  tokenEnMemoria = token || null;
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
}

export function getTokenEnMemoria() {
  return tokenEnMemoria;
}

// Single-flight refresh token
let refreshTokenPromise = null;

export async function renovarTokenSingleFlight() {
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  refreshTokenPromise = (async () => {
    try {
      let refreshToken = await SecureStorage.obtenerRefreshToken();
      if (!refreshToken) {
        const sesion = await LocalDB.obtenerSesion();
        refreshToken = sesion?.tokens?.RefreshToken;
      }
      if (!refreshToken) {
        throw new Error("No hay refresh token almacenado");
      }

      // Llamada aislada sin interceptores para evitar bucle de 401
      const respuesta = await axios.post(
        `${CONFIG.API_BASE_URL}${CONFIG.AUTH?.REFRESH_ENDPOINT || "/api/movil/v1/auth/refresh"}`,
        { refresh_token: refreshToken },
        {
          timeout: 20000,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Client-Version": CONFIG.CLIENT_VERSION,
          },
        }
      );

      // Soportar tanto res.data?.datos?.access_token como res.data?.access_token
      const data = respuesta.data?.datos || respuesta.data || {};
      const nuevoAccessToken =
        data.access_token ||
        data.AccessToken ||
        respuesta.data?.access_token ||
        respuesta.data?.AccessToken;
      const nuevoRefreshToken =
        data.refresh_token ||
        data.RefreshToken ||
        respuesta.data?.refresh_token ||
        respuesta.data?.RefreshToken ||
        refreshToken;

      if (!nuevoAccessToken) {
        throw new Error("El servidor no retornó un access_token válido.");
      }

      // 1. Actualizar memoria y cabeceras por defecto de Axios ANTES de resolver peticiones
      setTokenEnMemoria(nuevoAccessToken);

      // 2. Persistir en almacenamiento seguro y en LocalDB
      await SecureStorage.guardarToken(nuevoAccessToken);
      if (nuevoRefreshToken) {
        await SecureStorage.guardarRefreshToken(nuevoRefreshToken);
      }

      const sesionActual = await LocalDB.obtenerSesion();
      if (sesionActual) {
        sesionActual.tokens = {
          ...sesionActual.tokens,
          AccessToken: nuevoAccessToken,
          RefreshToken: nuevoRefreshToken,
        };
        await LocalDB.guardarSesion(sesionActual.usuario, sesionActual.tokens);
      }

      // 3. Notificar a listeners (ej. AuthContext)
      if (onTokenRenovadoListener) {
        try {
          onTokenRenovadoListener(nuevoAccessToken, nuevoRefreshToken);
        } catch (_listenerErr) {}
      }

      return nuevoAccessToken;
    } catch (err) {
      console.log("[ApiClient] Renovación de token falló:", err.message);
      if (onSesionExpiradaListener) {
        onSesionExpiradaListener();
      }
      throw err;
    } finally {
      refreshTokenPromise = null;
    }
  })();

  return refreshTokenPromise;
}

// Compatibilidad hacia atrás con versión anterior
export function setUpdateRequiredListener(listener) {
  onHardBlockListener = (required, version) => listener(required, version);
}

// Cliente HTTP configurado para interactuar con FastAPI de Blanquita-Backend
const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: 20000, // 20s para prevenir candados pegados (Subagente C)
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Client-Version": CONFIG.CLIENT_VERSION,
    "x-client-user-agent": `BlanquitaMobile/${CONFIG.CLIENT_VERSION} (Android)`,
  },
});

// Interceptor para inyectar token Bearer desde memoria, SecureStorage o LocalDB
apiClient.interceptors.request.use(
  async (config) => {
    try {
      let token = tokenEnMemoria;
      if (!token) {
        token = await SecureStorage.obtenerToken();
        if (!token) {
          const sesion = await LocalDB.obtenerSesion();
          if (sesion?.tokens?.AccessToken) {
            token = sesion.tokens.AccessToken;
          }
        }
        if (token) {
          setTokenEnMemoria(token);
        }
      }
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_e) {
      // Continuar sin token si falla la lectura segura
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Función auxiliar para extraer el mensaje real del backend (Subagente B)
export function parsearDetalleErrorServidor(data) {
  if (!data) return null;
  if (typeof data.mensaje === "string" && data.mensaje) return data.mensaje;
  if (typeof data.detail === "string" && data.detail) return data.detail;
  if (typeof data.error === "string" && data.error) return data.error;

  // Si detail es una lista de errores de validación de Pydantic
  if (Array.isArray(data.detail)) {
    const mensajes = data.detail.map((d) => {
      if (typeof d === "string") return d;
      const campo = Array.isArray(d.loc)
        ? d.loc.filter((part) => part !== "body").join(".")
        : d.loc || "";
      const msg = d.msg || JSON.stringify(d);
      return campo ? `${campo}: ${msg}` : msg;
    });
    return mensajes.join(" | ");
  }

  if (typeof data === "string") return data;
  return null;
}

// Interceptor para manejo de reintentos, versión mínima y formato de errores
apiClient.interceptors.response.use(
  (response) => {
    if (onServerWakingUpListener) {
      onServerWakingUpListener(false);
    }
    const minVersion =
      response.headers?.["x-minimum-client-version"] ||
      response.headers?.["x-min-client-version"];
    const latestVersion =
      response.headers?.["x-latest-client-version"] ||
      response.headers?.["x-available-client-version"];
    const upgradeRequired = response.headers?.["x-upgrade-required"] === "true";

    if (upgradeRequired) {
      if (onHardBlockListener) {
        onHardBlockListener(true, minVersion || latestVersion || "1.0.1");
      }
    } else if (
      (latestVersion && latestVersion > CONFIG.CLIENT_VERSION) ||
      (minVersion && minVersion > CONFIG.CLIENT_VERSION)
    ) {
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

    if (error.response?.status === 426) {
      const minVersion = error.response.headers?.["x-min-client-version"] || "1.0.1";
      if (onHardBlockListener) {
        onHardBlockListener(true, minVersion);
      }
    }

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

    // 401: Renovación automática con refresh token en cola single-flight
    if (error.response?.status === 401 && !config._retryAuth) {
      const urlStr = String(config.url || "");
      const esLogin = urlStr.includes("/auth/login");
      const esRefresh = urlStr.includes(CONFIG.AUTH?.REFRESH_ENDPOINT || "/auth/refresh");

      if (!esLogin && !esRefresh && CONFIG.AUTH?.REFRESH_TOKEN_ENABLED) {
        config._retryAuth = true;
        try {
          const nuevoToken = await renovarTokenSingleFlight();
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${nuevoToken}`;
          return apiClient(config);
        } catch (_refreshError) {
          if (onSesionExpiradaListener) {
            onSesionExpiradaListener();
          }
        }
      } else if (!esLogin && !esRefresh) {
        if (onSesionExpiradaListener) {
          onSesionExpiradaListener();
        }
      }
    }

    // Extracción limpia del error real del servidor (Subagente B)
    const mensajeServidor = parsearDetalleErrorServidor(error.response?.data);
    const mensajeReal = mensajeServidor || error.message || "Error desconocido";

    const errorNormalizado = {
      status: error.response?.status || (error.response ? 500 : 0),
      code: error.response?.data?.codigo || error.code || (error.response ? "ERROR_SERVIDOR" : "ERROR_RED"),
      message: mensajeReal,
      friendlyMessage: mensajeReal, // NO reemplazar por mensaje genérico en 4xx (Subagente B)
      serverDetail: error.response?.data,
      response: error.response,
      originalError: error,
    };

    if (!error.response) {
      errorNormalizado.friendlyMessage = "Sin conexión con el servidor central.";
    } else if (error.response.status === 401) {
      errorNormalizado.friendlyMessage = mensajeServidor || "Credenciales inválidas o sesión expirada.";
    }

    return Promise.reject(errorNormalizado);
  }
);

export default apiClient;
export { apiClient };
