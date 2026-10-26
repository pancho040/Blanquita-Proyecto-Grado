import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

export async function ObtenerZonas() {
  const response = await fetchConCache("/api/logistica/zonas", {}, 60000);
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
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function ObtenerRutas(idZona = null) {
  let url = "/api/logistica/rutas";
  if (idZona !== null) {
    url += `?id_zona=${idZona}`;
  }
  const response = await fetchConCache(url, {}, 30000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerRutaDetalle(idRuta) {
  const response = await fetchConCache(`/api/logistica/rutas/${idRuta}`, {}, 30000);
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
  invalidarCache("/api/logistica");
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
  invalidarCache("/api/logistica");
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
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function ObtenerAsignaciones(fecha = null, idRepartidor = null) {
  let url = "/api/logistica/asignaciones?";
  if (fecha) url += `fecha=${fecha}&`;
  if (idRepartidor) url += `id_repartidor=${idRepartidor}&`;

  const response = await fetchConCache(url, {}, 15000);
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
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function ActualizarAsignacion(idAsignacion, datos) {
  const response = await fetch(`/api/logistica/asignaciones/${idAsignacion}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function ObtenerRepartidores() {
  const response = await fetchConCache("/api/logistica/repartidores", {}, 30000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function CrearRepartidor(repartidor) {
  const response = await fetch("/api/logistica/repartidores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(repartidor),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function CambiarEstadoRepartidor(idUsuario, idEstado) {
  const response = await fetch(`/api/logistica/repartidores/${idUsuario}/estado?id_estado=${idEstado}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" }
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

// -------------------------------------------------------------
// TELEMETRÍA Y RASTREO GPS EN VIVO (HU-30, HU-33)
// -------------------------------------------------------------
export async function ObtenerChoferesEnVivo() {
  const response = await fetchConCache("/api/logistica/telemetria/en-vivo", {}, 3000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerTrackingAsignacion(idAsignacion) {
  const response = await fetchConCache(`/api/logistica/telemetria/asignacion/${idAsignacion}`, {}, 3000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function EnviarPingTelemetria(datosPing) {
  const response = await fetch("/api/logistica/telemetria/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datosPing),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica/telemetria");
  return await response.json();
}

export async function RegistrarEntregaParada(datos) {
  const response = await fetch("/api/logistica/telemetria/entrega", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function RegistrarCobroParada(datos) {
  const response = await fetch("/api/logistica/telemetria/cobro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

// -------------------------------------------------------------
// LIQUIDACIÓN Y RENDICIÓN DE CUENTAS (HU-34)
// -------------------------------------------------------------
export async function ObtenerLiquidacionRuta(idAsignacion) {
  const response = await fetchConCache(`/api/logistica/asignaciones/${idAsignacion}/liquidacion`, {}, 5000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function CerrarYLiquidarRuta(idAsignacion, datos) {
  const response = await fetch(`/api/logistica/asignaciones/${idAsignacion}/liquidar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}
