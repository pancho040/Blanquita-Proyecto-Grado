import apiClient from "./client";

/**
 * Servicios de Logística, Rutas, Entregas y Telemetría para el Chofer.
 * Conexión exclusiva a través del Backend FastAPI.
 * Toda operación encolada offline se gestiona en syncQueue sin comunicación directa a base de datos.
 */
export const LogisticaApi = {
  // Sincronización Batch Offline-First para Choferes
  async sincronizarBatch(operaciones) {
    if (!operaciones || operaciones.length === 0) return { success: true, sincronizados: [] };
    try {
      const response = await apiClient.post("/logistica/chofer/sincronizar-batch", {
        operaciones,
      }, { timeout: 30000 });
      return response.data;
    } catch (err) {
      console.log("[LogisticaApi] Sincronización batch falló o sin red:", err.message);
      return { success: false, error: err.friendlyMessage || err.message, sincronizados: [] };
    }
  },

  // Obtener ruta activa especializada para el chofer
  async obtenerRutaActivaChofer(idChofer) {
    try {
      const response = await apiClient.get("/logistica/chofer/mi-ruta-activa", {
        params: idChofer ? { id_chofer: idChofer } : {},
      });
      if (response.data && response.data.success && response.data.asignacion) {
        return response.data.asignacion;
      }
    } catch (e) {
      console.log("[LogisticaApi] Fallo consulta ruta chofer:", e.message);
    }
    return null;
  },

  // Obtener asignación de ruta activa del día para el repartidor
  async obtenerAsignaciones(fecha, idRepartidor) {
    try {
      const params = {};
      if (fecha) params.fecha = fecha;
      if (idRepartidor) params.id_repartidor = idRepartidor;

      const response = await apiClient.get("/logistica/asignaciones", { params });
      if (response.data && response.data.length > 0) {
        return response.data;
      }
    } catch (err) {
      console.log("[LogisticaApi] Error al obtener asignaciones:", err.message);
    }
    return [];
  },

  // Obtener detalle completo de la asignación con paradas y pedidos
  async obtenerTrackingAsignacion(idAsignacion) {
    try {
      const response = await apiClient.get(`/logistica/telemetria/asignacion/${idAsignacion}`);
      if (response.data && response.data.paradas && response.data.paradas.length > 0) {
        return response.data;
      }
    } catch (err) {
      console.log("[LogisticaApi] Error al obtener tracking de asignación:", err.message);
    }
    return null;
  },

  // Enviar ping de ubicación GPS en tiempo real para rastreo en vivo
  async enviarTelemetriaPing(payload) {
    try {
      const response = await apiClient.post("/logistica/telemetria/ping", payload, { timeout: 8000 });
      return response.data;
    } catch (err) {
      return { success: false, error: err.friendlyMessage || err.message };
    }
  },

  // Registrar entrega de producto en parada con GPS e Idempotencia
  async registrarEntrega(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    try {
      const response = await apiClient.post("/logistica/telemetria/entrega", payload, { headers });
      return response.data;
    } catch (err) {
      return {
        success: false,
        error: err.friendlyMessage || err.message,
        status: err.response?.status,
      };
    }
  },

  // Registrar cobro realizado a cliente con GPS e Idempotencia
  async registrarCobro(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    try {
      const response = await apiClient.post("/logistica/telemetria/cobro", payload, { headers });
      return response.data;
    } catch (err) {
      return {
        success: false,
        error: err.friendlyMessage || err.message,
        status: err.response?.status,
      };
    }
  },

  // Obtener resumen de liquidación para el cierre de ruta
  async obtenerLiquidacionRuta(idAsignacion) {
    try {
      const response = await apiClient.get(`/logistica/asignaciones/${idAsignacion}/liquidacion`);
      return response.data;
    } catch (_err) {
      return null;
    }
  },

  // Cerrar y liquidar ruta diaria del chofer (exige conexión obligatoria)
  async cerrarYLiquidarRuta(idAsignacion, payload) {
    try {
      const response = await apiClient.post(`/logistica/asignaciones/${idAsignacion}/liquidar`, payload);
      return response.data;
    } catch (err) {
      return {
        success: false,
        error: err.friendlyMessage || err.message || "Error al liquidar ruta",
        status: err.response?.status,
      };
    }
  },

  // Obtener lista de precios y productos vigentes
  async obtenerListaPrecios() {
    try {
      const response = await apiClient.get("/logistica/precios");
      return response.data;
    } catch (_err) {
      return [];
    }
  },
};

export default LogisticaApi;
