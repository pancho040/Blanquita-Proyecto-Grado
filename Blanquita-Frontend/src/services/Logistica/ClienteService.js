import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

export async function ObtenerClientes(busqueda = "", idEstado = null) {
  let url = `/api/logistica/clientes?busqueda=${encodeURIComponent(busqueda)}`;
  if (idEstado !== null) {
    url += `&id_estado=${idEstado}`;
  }
  const response = await fetchConCache(url, {}, 30000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerClienteDetalle(idCliente) {
  const response = await fetchConCache(`/api/logistica/clientes/${idCliente}`, {}, 30000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function CrearCliente(cliente) {
  const response = await fetch("/api/logistica/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cliente),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica/clientes");
  return await response.json();
}

export async function ActualizarCliente(idCliente, datos) {
  const response = await fetch(`/api/logistica/clientes/${idCliente}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica/clientes");
  return await response.json();
}

export async function AgregarPuntoVenta(idCliente, puntoVenta) {
  const response = await fetch(`/api/logistica/clientes/${idCliente}/puntos-venta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(puntoVenta),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica/clientes");
  return await response.json();
}

export async function ObtenerTodosPuntosVenta() {
  const response = await fetchConCache("/api/logistica/clientes/puntos-venta/todos", {}, 45000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}
