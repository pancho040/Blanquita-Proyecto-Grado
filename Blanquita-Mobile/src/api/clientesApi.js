import apiClient from "./client";

/**
 * Servicios para Registro y Consulta de Clientes en Campo (HU-29)
 */
export const ClientesApi = {
  // Registrar nuevo cliente directo o punto de venta desde la app móvil
  async crearCliente(clientePayload) {
    // clientePayload: { Nombre, RazonSocial, NitCi, Telefono, Direccion, Referencia, Latitud, Longitud, IdZona }
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
