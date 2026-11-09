import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

// ==========================================
// NOTAS DE VENTA Y DESPACHOS
// ==========================================
export async function ObtenerNotasVenta({
  idCliente = null,
  estadoPago = null,
  fechaDesde = null,
  fechaHasta = null,
  busqueda = "",
  limit = 25,
  offset = 0,
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  if (idCliente) params.append("id_cliente", idCliente);
  if (estadoPago && estadoPago !== "TODOS") params.append("estado_pago", estadoPago);
  if (fechaDesde) params.append("fecha_desde", fechaDesde);
  if (fechaHasta) params.append("fecha_hasta", fechaHasta);
  if (busqueda) params.append("busqueda", busqueda);
  params.append("limit", limit);
  params.append("offset", offset);
  if (page) params.append("page", page);

  const res = await fetchConCache(`/api/cxc/notas-venta?${params.toString()}`, {}, 15000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerNotaVentaDetalle(idNotaVenta) {
  const res = await fetchConCache(`/api/cxc/notas-venta/${idNotaVenta}`, {}, 20000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearNotaVenta(datos) {
  const res = await fetch("/api/cxc/notas-venta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

// ==========================================
// CUENTAS POR COBRAR Y CARTERA
// ==========================================
export async function ObtenerCuentasCobrar({
  idCliente = null,
  estado = null,
  busqueda = "",
  soloVencidas = false,
  limit = 25,
  offset = 0,
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  if (idCliente) params.append("id_cliente", idCliente);
  if (estado && estado !== "TODOS") params.append("id_estado", estado);
  if (busqueda) params.append("busqueda", busqueda);
  if (soloVencidas) params.append("solo_vencidas", "true");
  params.append("limit", limit);
  params.append("offset", offset);
  if (page) params.append("page", page);

  const res = await fetchConCache(`/api/cxc/cuentas?${params.toString()}`, {}, 15000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerCuentaCobrarDetalle(idCuentaCobrar) {
  const res = await fetchConCache(`/api/cxc/cuentas/${idCuentaCobrar}`, {}, 20000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearCuentaCobrar(datos) {
  const res = await fetch("/api/cxc/cuentas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

// ==========================================
// ABONOS Y COBRANZAS
// ==========================================
export async function RegistrarAbono(datos) {
  const res = await fetch("/api/cxc/abonos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

export async function RegistrarAbonoChofer(datos) {
  const res = await fetch("/api/cxc/abonos/chofer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

export async function ObtenerAbonosPendientes(idSucursal = null) {
  const url = idSucursal ? `/api/cxc/abonos/pendientes?id_sucursal=${idSucursal}` : "/api/cxc/abonos/pendientes";
  const res = await fetch(url);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ResolverAbonoKevin(idAbono, { aprobado, observacion = "" }) {
  const res = await fetch(`/api/cxc/abonos/${idAbono}/resolver`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aprobado, observacion }),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

export async function ProcesarAbonosMasivos(abonos) {
  const res = await fetch("/api/cxc/abonos/masivos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Abonos: abonos }),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

// ==========================================
// AJUSTES Y CIERRE DE TURNO (FASE 2)
// ==========================================
export async function AjustarNotaVentaKevin(idNota, datosAjuste) {
  const res = await fetch(`/api/cxc/notas-venta/${idNota}/ajuste-kevin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datosAjuste),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

export async function CierreTurnoChofer(datosCierre) {
  const res = await fetch("/api/cxc/chofer/cierre-turno", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datosCierre),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/cxc");
  return await res.json();
}

export async function ObtenerCarteraResumen() {
  const res = await fetchConCache("/api/cxc/cartera-resumen", {}, 20000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerClientesCxC() {
  const res = await fetchConCache("/api/cxc/clientes", {}, 60000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}
