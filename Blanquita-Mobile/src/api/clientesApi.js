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
   * Soporta configuración de:
   * - frecuencia_visita ('DIARIO' | 'CADA_2_DIAS' | 'SEMANAL' | 'FECHA_ESPECIFICA')
   * - dias_semana (ej: ['LUNES', 'MIERCOLES', 'VIERNES'])
   * - pedido_habitual (array de items programados)
   * - fecha_primera_entrega (fecha puntual en formato YYYY-MM-DD)
   *
   * @param {Object} payload - { datos_cliente, modalidad, frecuencia_visita, dias_semana, pedido_habitual, fecha_primera_entrega, dia_semana_programado, items_programados, parada_actual_orden, entrega_con_cobro }
   * @param {string|null} idempotencyKey - UUIDv4 para garantizar no duplicación
   */
  async registrarClienteEnRuta(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }

    // Normalizar payload asegurando compatibilidad en raíz y en datos_cliente
    const frecuenciaVisita =
      payload.frecuencia_visita ||
      payload.datos_cliente?.frecuencia_visita ||
      "SEMANAL";

    const diasSemana = Array.isArray(payload.dias_semana)
      ? payload.dias_semana
      : Array.isArray(payload.datos_cliente?.dias_semana)
      ? payload.datos_cliente.dias_semana
      : [];

    const pedidoHabitual = Array.isArray(payload.pedido_habitual)
      ? payload.pedido_habitual
      : Array.isArray(payload.items_programados)
      ? payload.items_programados
      : Array.isArray(payload.datos_cliente?.pedido_habitual)
      ? payload.datos_cliente.pedido_habitual
      : [];

    const fechaPrimeraEntrega =
      payload.fecha_primera_entrega ||
      payload.datos_cliente?.fecha_primera_entrega ||
      payload.fecha_especifica ||
      null;

    const payloadNormalizado = {
      ...payload,
      frecuencia_visita: frecuenciaVisita,
      dias_semana: diasSemana,
      pedido_habitual: pedidoHabitual,
      fecha_primera_entrega: fechaPrimeraEntrega,
      datos_cliente: {
        ...payload.datos_cliente,
        frecuencia_visita: frecuenciaVisita,
        dias_semana: diasSemana,
        pedido_habitual: pedidoHabitual,
        fecha_primera_entrega: fechaPrimeraEntrega,
      },
    };

    try {
      const response = await apiClient.post(
        "/api/movil/v1/chofer/cliente-en-ruta",
        payloadNormalizado,
        { headers }
      );
      return {
        success: true,
        data: response.data?.datos || response.data,
        codigo: response.data?.codigo || "EXITO",
        mensaje:
          response.data?.mensaje || "Cliente en ruta registrado exitosamente",
      };
    } catch (err) {
      // Fallback si el endpoint aún no está expuesto en backend
      if (err.response?.status === 404 || err.status === 404) {
        try {
          const fallbackPayload = {
            razon_social:
              payloadNormalizado.datos_cliente?.razon_social || "Nuevo Cliente",
            nombre_comercial:
              payloadNormalizado.datos_cliente?.nombre_comercial ||
              payloadNormalizado.datos_cliente?.razon_social,
            nombre_propietario:
              payloadNormalizado.datos_cliente?.nombre_propietario || null,
            nit_ci:
              payloadNormalizado.datos_cliente?.ci_nit ||
              payloadNormalizado.datos_cliente?.nit_ci ||
              null,
            telefono: payloadNormalizado.datos_cliente?.telefono || null,
            direccion:
              payloadNormalizado.datos_cliente?.direccion || "Sin dirección",
            zona: payloadNormalizado.datos_cliente?.zona || null,
            tipo_negocio: payloadNormalizado.datos_cliente?.tipo_negocio || null,
            observaciones:
              payloadNormalizado.datos_cliente?.observaciones || null,
            latitud: payloadNormalizado.datos_cliente?.latitud || -19.0431,
            longitud: payloadNormalizado.datos_cliente?.longitud || -65.2592,
            frecuencia_visita: payloadNormalizado.frecuencia_visita,
            dias_semana: payloadNormalizado.dias_semana,
            pedido_habitual: payloadNormalizado.pedido_habitual,
            fecha_primera_entrega: payloadNormalizado.fecha_primera_entrega,
          };
          const fallback = await apiClient.post(
            "/api/movil/v1/chofer/clientes",
            fallbackPayload,
            { headers }
          );
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
