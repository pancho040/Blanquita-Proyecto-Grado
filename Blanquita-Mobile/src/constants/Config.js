// Configuración del entorno de la aplicación móvil Blanquita Choferes
// Conexión exclusiva al Backend FastAPI del Sistema Central ERP (Sin claves directas a BD)

export const CONFIG = {
  // Versión del cliente móvil para verificación de compatibilidad
  CLIENT_VERSION: "1.0.0",

  // --- DESARROLLO LOCAL ---
  API_BASE_URL: "http://192.168.1.65:8000",

  // URL del Servidor Backend FastAPI (Render o Red Local)
  //API_BASE_URL: "https://blanquita-proyecto-grado-9f7j.onrender.com",
  // 65 segundos en primera llamada para tolerar arranque en frío del plan gratis en Render (~54s)
  API_TIMEOUT_MS: 65000,
  API_MAX_RETRIES: 2,

  // Parámetros de Telemetría GPS en Vivo (HU-30, HU-33)
  GPS: {
    INTERVALO_PING_SEGUNDOS: 30, // Intervalo para enviar ubicación en tiempo real
    DISTANCIA_MINIMA_METROS: 10, // Cambio mínimo de metros para registrar movimiento
    PRECISION_ALTA: true,
    MAX_REINTENTOS_UBICACION: 3,
    RADIO_MAX_LLEGADA_METROS: 150, // Radio de proximidad al punto de venta
  },

  // Configuración de Autenticación y Refresh Token (Offline-First)
  AUTH: {
    REFRESH_TOKEN_ENABLED: true,
    REFRESH_ENDPOINT: "/api/movil/v1/auth/refresh",
    TIEMPO_GRACIA_SESION_MS: 300000,
  },

  // Cola de Sincronización Offline (HU-27, HU-28)
  SYNC: {
    INTERVALO_REINTENTO_MS: 15000,
    MAX_INTENTOS_FALLIDOS: 5,
    CLAVE_STORAGE_COLA: "@blanquita_cola_offline",
    CLAVE_STORAGE_SESION: "@blanquita_sesion_chofer",
    CLAVE_STORAGE_RUTA: "@blanquita_ruta_activa",
    CLAVE_STORAGE_CLIENTES: "@blanquita_clientes_cache",
    CLAVE_STORAGE_PRODUCTOS: "@blanquita_productos_cache",
    CLAVE_STORAGE_INVENTARIO: "@blanquita_inventario_camion",
    CLAVE_STORAGE_LIQUIDACION: "@blanquita_liquidacion_local",
  },
};
