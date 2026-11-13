/* global FormData */
import apiClient, { parsearDetalleErrorServidor } from "./client";

export const ESTADOS_RUTA = Object.freeze({
  SIN_RUTA: "SIN_RUTA",
  PENDIENTE_CARGA: "PENDIENTE_CARGA",
  CARGA_SOLICITADA: "CARGA_SOLICITADA",
  APROBADA_EN_RUTA: "APROBADA_EN_RUTA",
  FINALIZADA: "FINALIZADA",
});

function procesarErrorApi(err) {
  const status = err.status || err.response?.status;
  const serverData = err.serverDetail || err.response?.data;
  const msgParsed = parsearDetalleErrorServidor(serverData);
  const errorMsg =
    msgParsed ||
    err.friendlyMessage ||
    err.message ||
    "Ocurrió un error al comunicarse con el servidor.";

  return {
    success: false,
    error: errorMsg,
    status,
    serverDetail: serverData,
  };
}

/**
 * Servicios de Logística, Rutas, Entregas y Telemetría para el Chofer Móvil (Fase 2).
 * Conexión exclusiva a través del Backend FastAPI bajo /api/movil/v1/chofer/*.
 * Toda operación encolada offline se gestiona en syncQueue sin comunicación directa a base de datos.
 */
export const LogisticaApi = {
  // 1. Obtener hoja de ruta activa especializada del chofer autenticado (Fase 2)
  async obtenerHojaRutaActiva() {
    try {
      const response = await apiClient.get("/api/movil/v1/chofer/hoja-ruta/activa");
      if (response.data && response.data.codigo === "EXITO") {
        return response.data.datos;
      }
      return null;
    } catch (err) {
      console.log("[LogisticaApi] Fallo al consultar hoja de ruta activa:", err.message);
      return null;
    }
  },

  // 2. Obtener inventario actual en camión y desglose de bandeo a costo 0 (Fase 2)
  async obtenerMiInventarioCamion() {
    try {
      const response = await apiClient.get("/api/movil/v1/chofer/mi-inventario");
      if (response.data && response.data.codigo === "EXITO") {
        return response.data.datos;
      }
      return null;
    } catch (err) {
      console.log("[LogisticaApi] Fallo al consultar inventario en camión:", err.message);
      return null;
    }
  },

  // 3. Registrar entrega de producto (Total o Parcial) con Firma, Idempotencia y Alerta de Revalorización
  async registrarEntrega(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    try {
      // Intentar primero endpoint especializado Fase 2
      const response = await apiClient.post("/api/movil/v1/chofer/entregar", payload, { headers });
      return {
        success: true,
        data: response.data?.datos || response.data,
        alertaRevalorizacion: response.data?.datos?.alerta_revalorizacion || null,
        codigo: response.data?.codigo || "EXITO",
      };
    } catch (err) {
      // Fallback a endpoint telemetria si existiera
      if (err.response?.status === 404 || err.status === 404) {
        try {
          const fallback = await apiClient.post("/logistica/telemetria/entrega", payload, { headers });
          return { success: true, data: fallback.data };
        } catch (fErr) {
          return procesarErrorApi(fErr);
        }
      }
      return procesarErrorApi(err);
    }
  },

  // 4. Registrar cobro simple o mixto (Efectivo, QR, Transferencia, Crédito) con Idempotencia
  async registrarCobro(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    try {
      const response = await apiClient.post("/api/movil/v1/chofer/cobrar", payload, { headers });
      return {
        success: true,
        data: response.data?.datos || response.data,
        codigo: response.data?.codigo || "EXITO",
      };
    } catch (err) {
      if (err.response?.status === 404 || err.status === 404) {
        try {
          const fallback = await apiClient.post("/logistica/telemetria/cobro", payload, { headers });
          return { success: true, data: fallback.data };
        } catch (fErr) {
          return procesarErrorApi(fErr);
        }
      }
      return procesarErrorApi(err);
    }
  },

  // 5. Registrar no-entrega con georreferenciación y motivo
  async registrarNoEntrega(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    try {
      const response = await apiClient.post("/api/movil/v1/chofer/no-entrega", payload, { headers });
      return {
        success: true,
        data: response.data?.datos || response.data,
      };
    } catch (err) {
      return procesarErrorApi(err);
    }
  },

  // 6. Cierre de turno definitivo del chofer (Arqueo financiero, cuadre de bultos, mermas y firma)
  async registrarCierreTurno(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    try {
      const response = await apiClient.post("/api/movil/v1/chofer/cierre-turno", payload, { headers });
      return {
        success: true,
        data: response.data?.datos || response.data,
        codigo: response.data?.codigo || "EXITO",
      };
    } catch (err) {
      return procesarErrorApi(err);
    }
  },

  // 7. Alta de Nuevo Cliente en Ruta con asignación forzosa a sucursal y ruta (Fase 3)
  async registrarNuevoCliente(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    try {
      const response = await apiClient.post("/api/movil/v1/chofer/clientes", payload, { headers });
      return {
        success: true,
        data: response.data?.datos || response.data,
        codigo: response.data?.codigo || "EXITO",
      };
    } catch (err) {
      return procesarErrorApi(err);
    }
  },

  // 7. Subida multipart de fotos y comprobantes (Regla 4: fotos fuera de la cola JSON, <= 5MB)
  async subirArchivoComprobante(archivoUri, entidadOrigen = "COMPROBANTE_COBRO", idRegistroOrigen = 0) {
    try {
      const formData = new FormData();
      const nombreArchivo = archivoUri.split("/").pop() || "comprobante.jpg";
      const tipoMime = nombreArchivo.endsWith(".png") ? "image/png" : "image/jpeg";

      formData.append("archivo", {
        uri: archivoUri,
        name: nombreArchivo,
        type: tipoMime,
      });
      formData.append("entidad_origen", entidadOrigen);
      formData.append("id_registro_origen", String(idRegistroOrigen));

      const response = await apiClient.post("/api/movil/v1/chofer/subir-archivo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });

      if (response.data && response.data.codigo === "EXITO") {
        return {
          success: true,
          idComprobante: response.data.datos.id_comprobante,
          urlArchivo: response.data.datos.url_archivo,
        };
      }
      return { success: false, error: "Respuesta no exitosa al subir archivo" };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.detail || err.friendlyMessage || err.message,
        status: err.response?.status,
      };
    }
  },

  // 8. Sincronización Batch Offline-First para Choferes
  async sincronizarBatch(operaciones) {
    if (!operaciones || operaciones.length === 0) return { success: true, sincronizados: [] };
    try {
      const response = await apiClient.post("/api/movil/v1/chofer/sincronizar-batch", {
        operaciones,
      }, { timeout: 35000 });
      return response.data;
    } catch (err) {
      try {
        const fallback = await apiClient.post("/logistica/chofer/sincronizar-batch", { operaciones }, { timeout: 30000 });
        return fallback.data;
      } catch (fErr) {
        return { success: false, error: fErr.friendlyMessage || fErr.message, sincronizados: [] };
      }
    }
  },

  // 9. Enviar ping de telemetría GPS
  async enviarTelemetriaPing(payload) {
    try {
      const response = await apiClient.post("/logistica/telemetria/ping", payload, { timeout: 8000 });
      return response.data;
    } catch (err) {
      return { success: false, error: err.friendlyMessage || err.message };
    }
  },

  // 10. Solicitar Carga de Inventario a Almacén/Web (Subagente B - Gatekeeper de Ruta)
  async solicitarCargaCamion(
    { id_asignacion, idAsignacion, usar_remanente = false, usarRemanente = false, observacion = "", items = [] } = {},
    idempotencyKey = null
  ) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }
    const payload = {
      id_asignacion: id_asignacion || idAsignacion,
      usar_remanente: Boolean(usar_remanente || usarRemanente),
      observacion: observacion || "",
      items: (items || []).map((it) => ({
        presentacion_id: it.presentacion_id || it.IdPresentacion || it.id,
        cantidad_solicitada: Number(it.cantidad_solicitada || it.cantidad || 0),
        nombre_producto: it.nombre_producto || it.nombre || undefined,
      })),
    };
    try {
      const response = await apiClient.post("/api/movil/v1/chofer/solicitar-carga", payload, { headers });
      return {
        success: true,
        data: response.data?.datos || response.data,
        codigo: response.data?.codigo || "EXITO",
        mensaje: response.data?.mensaje || "Solicitud de carga enviada a Almacén con éxito.",
      };
    } catch (err) {
      return procesarErrorApi(err);
    }
  },

  // 11. Obtener Resumen de Sincronización para Chofer (Subagente B)
  async obtenerResumenSincronizacion() {
    try {
      const response = await apiClient.get("/api/movil/v1/chofer/resumen-sincronizacion");
      return {
        success: true,
        data: response.data?.datos || response.data,
        codigo: response.data?.codigo || "EXITO",
      };
    } catch (err) {
      return procesarErrorApi(err);
    }
  },

  // Métodos de retrocompatibilidad
  async obtenerRutaActivaChofer(idChofer) {
    const res = await this.obtenerHojaRutaActiva();
    if (res && res.asignacion) {
      return res.asignacion;
    }
    try {
      const response = await apiClient.get("/logistica/chofer/mi-ruta-activa", {
        params: idChofer ? { id_chofer: idChofer } : {},
      });
      return response.data?.asignacion || null;
    } catch (_e) {
      return null;
    }
  },

  async obtenerAsignaciones(fecha, idRepartidor) {
    try {
      const params = {};
      if (fecha) params.fecha = fecha;
      if (idRepartidor) params.id_repartidor = idRepartidor;
      const response = await apiClient.get("/logistica/asignaciones", { params });
      return response.data || [];
    } catch (_err) {
      return [];
    }
  },

  async obtenerTrackingAsignacion(idAsignacion) {
    try {
      const response = await apiClient.get(`/logistica/telemetria/asignacion/${idAsignacion}`);
      return response.data || null;
    } catch (_err) {
      return null;
    }
  },

  async obtenerLiquidacionRuta(idAsignacion) {
    try {
      const response = await apiClient.get(`/logistica/asignaciones/${idAsignacion}/liquidacion`);
      return response.data;
    } catch (_err) {
      return null;
    }
  },

  async cerrarYLiquidarRuta(idAsignacion, payload) {
    return this.registrarCierreTurno(payload);
  },

  async obtenerListaPrecios() {
    try {
      const response = await apiClient.get("/logistica/precios");
      return response.data || [];
    } catch (_err) {
      return [];
    }
  },
};

export const logisticaApi = LogisticaApi;
export default LogisticaApi;
