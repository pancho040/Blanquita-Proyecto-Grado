// Configuración del entorno de la aplicación móvil Blanquita Choferes
// Alineado con el Backend FastAPI y Supabase del Sistema Central

export const CONFIG = {
  // URLs del Servidor Backend FastAPI
  // IP local de la computadora para que el celular físico se conecte por Wi-Fi
  API_BASE_URL: "http://192.168.1.65:8000",
  API_TIMEOUT_MS: 6000,

  // Credenciales de Supabase para acceso directo / autenticación / realtime
  SUPABASE_URL: "https://pyvimfqomqjdvopzsmts.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_u2CkFOXO1fxZi8np6TECYw_ZEGkMENZ",

  // Parámetros de Telemetría GPS en Vivo (HU-30, HU-33)
  GPS: {
    INTERVALO_PING_SEGUNDOS: 30, // Intervalo para enviar ubicación en tiempo real
    DISTANCIA_MINIMA_METROS: 10, // Cambio mínimo de metros para registrar movimiento
    PRECISION_ALTA: true,
    MAX_REINTENTOS_UBICACION: 3,
    RADIO_MAX_LLEGADA_METROS: 150, // Radio de proximidad al punto de venta
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
    CLAVE_STORAGE_LIQUIDACION: "@blanquita_liquidacion_local",
  },
};
