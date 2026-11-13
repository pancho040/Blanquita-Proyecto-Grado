import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

export async function ObtenerZonas(idSucursal = null) {
  let url = "/api/logistica/zonas";
  if (idSucursal && idSucursal !== "todas") {
    url += `?id_sucursal=${idSucursal}`;
  }
  const response = await fetchConCache(url, {}, 60000);
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

export async function ObtenerRutas(idZona = null, idSucursal = null) {
  const params = new URLSearchParams();
  if (idZona !== null) params.append("id_zona", idZona);
  if (idSucursal && idSucursal !== "todas") params.append("id_sucursal", idSucursal);
  const q = params.toString();
  const url = `/api/logistica/rutas${q ? `?${q}` : ""}`;
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

export async function ObtenerAsignaciones(fecha = null, idRepartidor = null, idSucursal = null) {
  const params = new URLSearchParams();
  if (fecha) params.append("fecha", fecha);
  if (idRepartidor) params.append("id_repartidor", idRepartidor);
  if (idSucursal && idSucursal !== "todas") params.append("id_sucursal", idSucursal);

  const q = params.toString();
  const url = `/api/logistica/asignaciones${q ? `?${q}` : ""}`;
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

export async function ObtenerRepartidores(idSucursal = null) {
  let url = "/api/logistica/repartidores";
  if (idSucursal && idSucursal !== "todas") {
    url += `?id_sucursal=${idSucursal}`;
  }
  const response = await fetchConCache(url, {}, 30000);
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
// Telemetría y rastreo GPS en vivo
// -------------------------------------------------------------
export async function ObtenerWsTicketFlota() {
  const response = await fetchConCache("/api/logistica/flota/ws-ticket", {
    method: "POST"
  }, 0);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerChoferesEnVivo(idSucursal = null) {
  let url = "/api/logistica/telemetria/en-vivo";
  if (idSucursal && idSucursal !== "todas") {
    url += `?id_sucursal=${idSucursal}`;
  }
  const response = await fetchConCache(url, {}, 3000);
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
// Liquidación y rendición de cuentas
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

// -------------------------------------------------------------
// Solicitud de Carga, Aprobación y Telemetría Bajo Demanda
// -------------------------------------------------------------
export async function AprobarCargaCamion(idAsignacion, datos = {}) {
  const response = await fetch(`/api/logistica/asignaciones/${idAsignacion}/aprobar-carga`, {
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

export async function SolicitarUbicacionActualChoferes(idSucursal = null) {
  let url = "/api/logistica/telemetria/solicitar-ubicacion-actual";
  if (idSucursal && idSucursal !== "todas") {
    url += `?id_sucursal=${idSucursal}`;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica/telemetria");
  return await response.json();
}

export async function ReasignarParadasPendientes(idAsignacionOrigen, idChoferDestino, idsParadas = []) {
  const response = await fetch(`/api/logistica/asignaciones/reasignar-paradas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_asignacion_origen: idAsignacionOrigen,
      id_chofer_destino: idChoferDestino,
      paradas_pendientes: idsParadas,
    }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function ListarSolicitudesCarga(idAsignacion = null, estado = null) {
  const params = new URLSearchParams();
  if (idAsignacion) params.append("id_asignacion", idAsignacion);
  if (estado && estado !== "TODOS") params.append("estado", estado);
  const qs = params.toString();
  const url = `/api/logistica/solicitudes-carga${qs ? `?${qs}` : ""}`;
  const response = await fetchConCache(url, {}, 5000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerSolicitudCarga(idSolicitud) {
  const response = await fetchConCache(`/api/logistica/solicitudes-carga/${idSolicitud}`, {}, 5000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function RevisarSolicitudCarga(idSolicitud, dto = {}) {
  const response = await fetch(`/api/logistica/solicitudes-carga/${idSolicitud}/revisar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

// -------------------------------------------------------------
// Motor de Reordenamiento y Secuencia Vial 1..N
// -------------------------------------------------------------
export async function RecalcularOrdenParadas(idRuta) {
  const response = await fetch(`/api/logistica/rutas/${idRuta}/paradas/reordenar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function InsertarParadaOrden(idRuta, idPuntoVenta, posicion = null) {
  const response = await fetch("/api/logistica/rutas/paradas/insertar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdRuta: Number(idRuta),
      IdPuntoVenta: Number(idPuntoVenta),
      Posicion: posicion ? Number(posicion) : null,
    }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function QuitarParadaRuta(idRuta, idPuntoVenta, fecha = null) {
  let url = "/api/logistica/rutas/paradas/quitar";
  if (fecha) url += `?fecha=${fecha}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdRuta: Number(idRuta),
      IdPuntoVenta: Number(idPuntoVenta),
    }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function MoverParadaRuta(idPuntoVenta, idRutaOrigen, idRutaDestino, posicionDestino = null, fecha = null) {
  let url = "/api/logistica/rutas/paradas/mover";
  if (fecha) url += `?fecha=${fecha}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdPuntoVenta: Number(idPuntoVenta),
      IdRutaOrigen: Number(idRutaOrigen),
      IdRutaDestino: Number(idRutaDestino),
      PosicionDestino: posicionDestino ? Number(posicionDestino) : null,
    }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function GenerarRutasDiarias(fecha = null) {
  let url = "/api/logistica/rutas/generar-diarias";
  if (fecha) url += `?fecha=${fecha}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

export async function RevisarOperacionRuta(idOperacion, estado, observacion = "", tipo = "entrega") {
  // Intentar endpoint REST 1 a 1 de auditoría
  const tipoNorm = tipo === "cobro" ? "cobro" : "entrega";
  try {
    const resPatch = await fetch(`/api/logistica/operaciones-ruta/${tipoNorm}/${idOperacion}/revisar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: estado, // 'APROBADO' | 'OBSERVADO' | 'RECHAZADO'
        observacion: observacion,
      }),
    });
    if (resPatch.ok) {
      invalidarCache("/api/logistica");
      invalidarCache("/api/cxc");
      return await resPatch.json();
    }
  } catch (err) {
    // Si falla conexión directa, intentar fallback
  }

  const response = await fetch(`/api/logistica/operaciones/${idOperacion}/revisar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      estado: estado, // 'APROBADO' | 'OBSERVADO' | 'RECHAZADO'
      observacion: observacion,
    }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  invalidarCache("/api/cxc");
  return await response.json();
}

export async function FinalizarRutaAdmin(idAsignacion, observacionGeneral = "", estadoFinal = "APROBADA") {
  const response = await fetch(`/api/logistica/asignaciones/${idAsignacion}/finalizar-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      observacion_general: observacionGeneral,
      ObservacionCierre: observacionGeneral,
      estado_final: estadoFinal,
      EstadoFinal: estadoFinal,
    }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica");
  return await response.json();
}

