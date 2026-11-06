// Servicio centralizado de reportes optimizado con caché en memoria
import { fetchConCache } from "@/lib/api-cache";

export const buildQueryString = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== null && val !== undefined && val !== "" && val !== "TODOS" && val !== "TODAS") {
      query.append(key, val);
    }
  });
  const qStr = query.toString();
  return qStr ? `?${qStr}` : "";
};

const handleResponse = async (res) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `Error ${res.status}: ${res.statusText}`);
  }
  return await res.json();
};

const TTL_REPORTES_MS = 30000; // 30 segundos de respuesta instantánea (0 ms)

// 1. Reportes de Contabilidad
export const getReporteFlujoCaja = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/contabilidad/flujo-caja${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

export const getReporteCuentasCobrar = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/contabilidad/cuentas-cobrar${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

export const getReporteCuentasPagar = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/contabilidad/cuentas-pagar${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

export const getReporteNotasVenta = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/contabilidad/notas-venta${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

// 2. Reportes de Logística
export const getReporteDesempenoRutas = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/logistica/desempeno-rutas${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

export const getReporteCoberturaClientes = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/logistica/cobertura-clientes${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

// 3. Reportes de Recursos Humanos
export const getReporteAsistenciaPuntualidad = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/rrhh/asistencia-puntualidad${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

export const getReporteNominaHistorica = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/rrhh/nomina-historica${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

// 4. Reportes de Auditoría y Seguridad
export const getReporteAuditoriaSeguridad = async (params = {}) => {
  const res = await fetchConCache(`/api/reportes/auditoria/actividad-seguridad${buildQueryString(params)}`, {}, TTL_REPORTES_MS);
  return await handleResponse(res);
};

export const getReporteActividadSeguridad = getReporteAuditoriaSeguridad;
