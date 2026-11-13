import apiClient, { parsearDetalleErrorServidor } from "./client";

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
 * Servicios para Registro y Consulta de Clientes en Campo (HU-29 y Fase Repartidores)
 * Conexión a endpoints especializados /api/movil/v1/chofer/cliente-en-ruta y /resumen-sincronizacion
 */
export const ClientesApi = {
  /**
   * Alta de cliente en ruta con 3 modalidades según handoff-sync.md (Sección 5.3):
   * - SOLO_REGISTRO
   * - PROGRAMAR_ENTREGA
   * - ENTREGA_INMEDIATA
   *
   * @param {Object} payload - { datos_cliente, modalidad, dia_semana_programado, items_programados, parada_actual_orden, entrega_con_cobro }
   * @param {string|null} idempotencyKey - UUIDv4 para garantizar no duplicación
   */
  async registrarClienteEnRuta(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }

    try {
      const response = await apiClient.post("/api/movil/v1/chofer/cliente-en-ruta", payload, { headers });
      return {
        success: true,
        data: response.data?.datos || response.data,
        codigo: response.data?.codigo || "EXITO",
        mensaje: response.data?.mensaje || "Cliente en ruta registrado exitosamente",
      };
    } catch (err) {
      // Fallback si el endpoint aún no está expuesto en backend
      if (err.response?.status === 404 || err.status === 404) {
        try {
          const fallbackPayload = {
            razon_social: payload.datos_cliente?.razon_social || "Nuevo Cliente",
            nombre_comercial: payload.datos_cliente?.nombre_comercial || payload.datos_cliente?.razon_social,
            nit_ci: payload.datos_cliente?.ci_nit || payload.datos_cliente?.nit_ci || null,
            telefono: payload.datos_cliente?.telefono || null,
            direccion: payload.datos_cliente?.direccion || "Sin dirección",
            zona: payload.datos_cliente?.zona || null,
            tipo_negocio: payload.datos_cliente?.tipo_negocio || null,
            observaciones: payload.datos_cliente?.observaciones || null,
            latitud: payload.datos_cliente?.latitud || -19.0431,
            longitud: payload.datos_cliente?.longitud || -65.2592,
          };
          const fallback = await apiClient.post("/api/movil/v1/chofer/clientes", fallbackPayload, { headers });
          return {
            success: true,
            data: fallback.data?.datos || fallback.data,
            codigo: fallback.data?.codigo || "EXITO",
            mensaje: "Cliente registrado (modo compatibilidad)",
          };
        } catch (fErr) {
          return procesarErrorApi(fErr);
        }
      }
      return procesarErrorApi(err);
    }
  },

  /**
   * Resumen de Sincronización Manual y Estado de Aprobación Web (Sección 5.2 de handoff-sync.md)
   * Devuelve asignación activa, inventario del camión e historial de operaciones de hoy
   * con su estado_revision_web ('PENDIENTE' | 'APROBADO' | 'OBSERVADO' | 'RECHAZADO')
   */
  async obtenerResumenSincronizacion() {
    try {
      const response = await apiClient.get("/api/movil/v1/chofer/resumen-sincronizacion");
      if (response.data && (response.data.codigo === "EXITO" || response.data.datos)) {
        return {
          success: true,
          data: response.data.datos || response.data,
        };
      }
      return { success: true, data: response.data };
    } catch (err) {
      return procesarErrorApi(err);
    }
  },

  /**
   * Consultar historial de operaciones del día con estado de revisión del supervisor Web
   */
  async obtenerHistorialOperacionesHoy() {
    const res = await this.obtenerResumenSincronizacion();
    if (res.success && res.data) {
      const historial = res.data.historial_operaciones_hoy || res.data.historial || [];
      return { success: true, historial };
    }
    return { success: false, historial: [], error: res.error };
  },

  // Registrar nuevo cliente directo o punto de venta desde la app móvil (legado)
  async crearCliente(clientePayload) {
    const response = await apiClient.post("/logistica/clientes", clientePayload);
    return response.data;
  },

  // Listar clientes para búsqueda rápida en campo
  async listarClientes(terminoBusqueda = "") {
    const params = {};
    if (terminoBusqueda) params.q = terminoBusqueda;
    const response = await apiClient.get("/logistica/clientes", { params });
    return response.data;
  },

  // Obtener puntos de venta asociados
  async obtenerPuntosVenta(idCliente) {
    const response = await apiClient.get(`/logistica/clientes/${idCliente}/puntos-venta`);
    return response.data;
  },
};

export default ClientesApi;
