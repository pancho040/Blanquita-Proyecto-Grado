// Servicio centralizado de reportes para todos los módulos
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

// 1. Reportes de Contabilidad
export const getReporteFlujoCaja = async (params = {}) => {
  const res = await fetch(`/api/reportes/contabilidad/flujo-caja${buildQueryString(params)}`);
  return await handleResponse(res);
};

export const getReporteCuentasCobrar = async (params = {}) => {
  const res = await fetch(`/api/reportes/contabilidad/cuentas-cobrar${buildQueryString(params)}`);
  return await handleResponse(res);
};

export const getReporteCuentasPagar = async (params = {}) => {
  const res = await fetch(`/api/reportes/contabilidad/cuentas-pagar${buildQueryString(params)}`);
  return await handleResponse(res);
};

export const getReporteNotasVenta = async (params = {}) => {
  const res = await fetch(`/api/reportes/contabilidad/notas-venta${buildQueryString(params)}`);
  return await handleResponse(res);
};

// 2. Reportes de Logística
export const getReporteDesempenoRutas = async (params = {}) => {
  const res = await fetch(`/api/reportes/logistica/desempeno-rutas${buildQueryString(params)}`);
  return await handleResponse(res);
};

export const getReporteCoberturaClientes = async (params = {}) => {
  const res = await fetch(`/api/reportes/logistica/cobertura-clientes${buildQueryString(params)}`);
  return await handleResponse(res);
};

// 3. Reportes de Recursos Humanos
export const getReporteAsistenciaPuntualidad = async (params = {}) => {
  const res = await fetch(`/api/reportes/rrhh/asistencia-puntualidad${buildQueryString(params)}`);
  return await handleResponse(res);
};

export const getReporteNominaHistorica = async (params = {}) => {
  const res = await fetch(`/api/reportes/rrhh/nomina-historica${buildQueryString(params)}`);
  return await handleResponse(res);
};

// 4. Reportes de Auditoría y Seguridad
export const getReporteAuditoriaSeguridad = async (params = {}) => {
  const res = await fetch(`/api/reportes/auditoria/actividad-seguridad${buildQueryString(params)}`);
  return await handleResponse(res);
};

export const getReporteActividadSeguridad = getReporteAuditoriaSeguridad;
