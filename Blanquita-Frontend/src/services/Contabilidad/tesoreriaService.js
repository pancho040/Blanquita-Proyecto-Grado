import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

// ==========================================
// CUENTAS BANCARIAS
// ==========================================
export async function ObtenerCuentasBancarias(soloActivas = true) {
  const res = await fetchConCache(`/api/tesoreria/bancos?solo_activas=${soloActivas}`, {}, 60000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearCuentaBancaria(datos) {
  const res = await fetch("/api/tesoreria/bancos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function ActualizarCuentaBancaria(idCuenta, datos) {
  const res = await fetch(`/api/tesoreria/bancos/${idCuenta}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

// ==========================================
// CATEGORÍAS DE MOVIMIENTO DE CAJA
// ==========================================
export async function ObtenerCategoriasCaja(tipo = null) {
  let url = "/api/tesoreria/categorias-caja";
  if (tipo) url += `?tipo=${tipo}`;
  const res = await fetchConCache(url, {}, 120000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearCategoriaCaja(datos) {
  const res = await fetch("/api/tesoreria/categorias-caja", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria/categorias-caja");
  return await res.json();
}

// ==========================================
// APERTURA, CIERRE Y ARQUEO DE CAJA
// ==========================================
export async function ObtenerCajas(limit = 20, offset = 0) {
  const res = await fetchConCache(`/api/tesoreria/cajas?limit=${limit}&offset=${offset}`, {}, 30000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerCajaActual() {
  const res = await fetchConCache("/api/tesoreria/cajas/actual", {}, 15000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function AperturarCaja(datos) {
  const res = await fetch("/api/tesoreria/cajas/apertura", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function CerrarCaja(datos) {
  const res = await fetch("/api/tesoreria/cajas/cierre", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function RegistrarArqueo(datos) {
  const res = await fetch("/api/tesoreria/cajas/arqueo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

// ==========================================
// MOVIMIENTOS DE CAJA / LIBRO DIARIO
// ==========================================
export async function ObtenerMovimientosCaja({
  idAperturaCierre = null,
  tipo = null,
  idCategoria = null,
  idCuentaBancaria = null,
  fechaDesde = null,
  fechaHasta = null,
  busqueda = "",
  limit = 25,
  offset = 0,
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  if (idAperturaCierre) params.append("id_apertura_cierre", idAperturaCierre);
  if (tipo && tipo !== "TODOS") params.append("tipo", tipo);
  if (idCategoria) params.append("id_categoria", idCategoria);
  if (idCuentaBancaria) params.append("id_cuenta_bancaria", idCuentaBancaria);
  if (fechaDesde) params.append("fecha_desde", fechaDesde);
  if (fechaHasta) params.append("fecha_hasta", fechaHasta);
  if (busqueda) params.append("busqueda", busqueda);
  params.append("limit", limit);
  params.append("offset", offset);
  if (page) params.append("page", page);

  const res = await fetchConCache(`/api/tesoreria/movimientos?${params.toString()}`, {}, 15000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function RegistrarMovimientoCaja(datos) {
  const res = await fetch("/api/tesoreria/movimientos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

// ==========================================
// SOLICITUDES DE CAJA CHICA (SC) Y KPIS
// ==========================================
export async function ObtenerCajaChicaKpis() {
  const res = await fetchConCache("/api/tesoreria/caja-chica-kpis", {}, 20000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerSolicitudesCajaChica({
  estado = null,
  solicitante = null,
  busqueda = "",
  fechaDesde = null,
  fechaHasta = null,
  limit = 25,
  offset = 0,
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  if (estado && estado !== "TODOS") params.append("estado", estado);
  if (solicitante) params.append("solicitante", solicitante);
  if (busqueda) params.append("busqueda", busqueda);
  if (fechaDesde) params.append("fecha_desde", fechaDesde);
  if (fechaHasta) params.append("fecha_hasta", fechaHasta);
  params.append("limit", limit);
  params.append("offset", offset);
  if (page) params.append("page", page);

  const res = await fetchConCache(`/api/tesoreria/solicitudes-caja-chica?${params.toString()}`, {}, 15000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearSolicitudCajaChica(datos) {
  const res = await fetch("/api/tesoreria/solicitudes-caja-chica", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function AprobarSolicitudCajaChica(idSolicitud, datos = {}) {
  const res = await fetch(`/api/tesoreria/solicitudes-caja-chica/${idSolicitud}/aprobar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function RechazarSolicitudCajaChica(idSolicitud, datos) {
  const res = await fetch(`/api/tesoreria/solicitudes-caja-chica/${idSolicitud}/rechazar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function DescargarSolicitudCajaChica(idSolicitud, datos) {
  const res = await fetch(`/api/tesoreria/solicitudes-caja-chica/${idSolicitud}/descargar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/tesoreria");
  return await res.json();
}

// ==========================================
// KPIS Y DASHBOARD
// ==========================================
export async function ObtenerDashboardKPIs() {
  const res = await fetchConCache("/api/tesoreria/dashboard-kpis", {}, 20000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}
