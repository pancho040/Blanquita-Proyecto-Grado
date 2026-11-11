import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

// ==========================================
// SERVICIOS GERENCIALES - DON OSVALDO (FASE 4)
// ==========================================

export async function BuscarReporteGlobal(codigo, idSucursal = null, options = {}) {
  if (!codigo) return null;
  const params = new URLSearchParams();
  params.append("codigo", codigo);
  if (idSucursal && idSucursal !== "todas") params.append("id_sucursal", idSucursal);
  const res = await fetch(`/api/gerencia/buscar-reporte?${params.toString()}`, {
    signal: options?.signal,
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerKPIsEjecutivos(idSucursal = null) {
  const query = idSucursal && idSucursal !== "todas" ? `?id_sucursal=${idSucursal}` : "";
  const res = await fetchConCache(`/api/gerencia/kpis-ejecutivos${query}`, {}, 10000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function FirmarDocumentoGerencial(datos, idGerente = 1) {
  const res = await fetch(`/api/gerencia/firmar-documento?id_gerente=${idGerente}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/gerencia");
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function ListarFirmasHistorial(limit = 20) {
  const res = await fetchConCache(`/api/gerencia/firmas-historial?limit=${limit}`, {}, 15000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ListarBancosReferenciales() {
  const res = await fetchConCache("/api/gerencia/bancos-referenciales", {}, 15000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ConciliarBancoReferencial(idCuenta, datos, idUsuario = 1) {
  const res = await fetch(`/api/gerencia/bancos-referenciales/${idCuenta}/conciliar?id_usuario=${idUsuario}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  invalidarCache("/api/gerencia");
  invalidarCache("/api/tesoreria");
  return await res.json();
}

export async function ObtenerReporteConsolidadoPlanta() {
  const res = await fetchConCache("/api/gerencia/reporte-consolidado-planta", {}, 30000);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}
