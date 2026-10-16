import { manejarErrorBackend } from "@/utils/validators";

// ==========================================
// PROVEEDORES CONTABLES
// ==========================================
export async function ObtenerProveedoresContabilidad(soloActivos = true) {
  const res = await fetch(`/api/cxp/proveedores?solo_activos=${soloActivos}`);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearProveedorContabilidad(datos) {
  const res = await fetch("/api/cxp/proveedores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

// ==========================================
// CUENTAS POR PAGAR (FACTURAS DE COMPRA)
// ==========================================
export async function ObtenerKpisCxP() {
  const res = await fetch("/api/cxp/kpis-resumen");
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerCuentasPagar({
  idProveedor = null,
  estado = null,
  busqueda = "",
  soloVencidas = false,
  limit = 25,
  offset = 0,
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  if (idProveedor) params.append("id_proveedor", idProveedor);
  if (estado && estado !== "TODOS") params.append("estado", estado);
  if (busqueda) params.append("busqueda", busqueda);
  if (soloVencidas) params.append("solo_vencidas", "true");
  params.append("limit", limit);
  params.append("offset", offset);
  if (page) params.append("page", page);

  const res = await fetch(`/api/cxp/cuentas?${params.toString()}`);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerCuentaPagarDetalle(idCuentaPagar) {
  const res = await fetch(`/api/cxp/cuentas/${idCuentaPagar}`);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearCuentaPagar(datos) {
  const res = await fetch("/api/cxp/cuentas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

// ==========================================
// PAGOS A PROVEEDORES
// ==========================================
export async function RegistrarPagoCxP(datos) {
  const res = await fetch("/api/cxp/pagos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

// ==========================================
// DEVOLUCIONES Y COMPENSACIONES
// ==========================================
export async function RegistrarDevolucionCxP(datos) {
  const res = await fetch("/api/cxp/devoluciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

// ==========================================
// BALANCE Y ESTADOS DE CUENTA PROVEEDORES
// ==========================================
export async function ObtenerBalanceProveedores() {
  const res = await fetch("/api/cxp/balance-proveedores");
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}
