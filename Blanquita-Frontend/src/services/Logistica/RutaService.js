import { manejarErrorBackend } from "@/utils/validators";

export async function ObtenerZonas() {
  const response = await fetch("/api/logistica/zonas");
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function CrearZona(zona) {
  const response = await fetch("/api/logistica/zonas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(zona),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerRutas(idZona = null) {
  let url = "/api/logistica/rutas";
  if (idZona !== null) {
    url += `?id_zona=${idZona}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerRutaDetalle(idRuta) {
  const response = await fetch(`/api/logistica/rutas/${idRuta}`);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function CrearRuta(ruta) {
  const response = await fetch("/api/logistica/rutas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ruta),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ActualizarRuta(idRuta, datos) {
  const response = await fetch(`/api/logistica/rutas/${idRuta}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function GuardarPuntosVentaRuta(idRuta, puntosVenta) {
  const response = await fetch(`/api/logistica/rutas/${idRuta}/puntos-venta`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ PuntosVenta: puntosVenta }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerAsignaciones(fecha = null, idRepartidor = null) {
  let url = "/api/logistica/asignaciones?";
  if (fecha) url += `fecha=${fecha}&`;
  if (idRepartidor) url += `id_repartidor=${idRepartidor}&`;

  const response = await fetch(url);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function CrearAsignacion(asignacion) {
  const response = await fetch("/api/logistica/asignaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(asignacion),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerRepartidores() {
  const response = await fetch("/api/logistica/repartidores");
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}
