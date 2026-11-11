import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

// 1. DASHBOARD RESUMEN
export async function ObtenerResumenRRHH(idSucursal = null) {
  const query = idSucursal && idSucursal !== "todas" ? `?id_sucursal=${idSucursal}` : "";
  const response = await fetchConCache(`/api/rrhh/resumen${query}`, {}, 30000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

// 2. EMPLEADOS & DATOS LABORALES
export async function ObtenerEmpleados(busqueda = "", area = "", activo = null, idSucursal = null) {
  let url = "/api/rrhh/empleados?";
  const params = new URLSearchParams();
  if (busqueda) params.append("busqueda", busqueda);
  if (area && area !== "TODAS") params.append("area", area);
  if (activo !== null && activo !== undefined && activo !== "") params.append("activo", activo);
  if (idSucursal && idSucursal !== "todas") params.append("id_sucursal", idSucursal);
  
  const response = await fetchConCache(url + params.toString(), {}, 30000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function ObtenerEmpleadosSimple(area = "") {
  let url = "/api/rrhh/empleados/simple";
  if (area && area !== "TODAS") url += `?area=${encodeURIComponent(area)}`;
  const response = await fetchConCache(url, {}, 60000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function ObtenerEmpleado(idUsuario) {
  const response = await fetchConCache(`/api/rrhh/empleados/${idUsuario}`, {}, 30000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function ActualizarEmpleado(idUsuario, datos) {
  const response = await fetch(`/api/rrhh/empleados/${idUsuario}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

// 3. TURNOS & HORARIOS
export async function ObtenerTurnos(area = "") {
  let url = "/api/rrhh/turnos";
  if (area && area !== "TODAS") url += `?area=${encodeURIComponent(area)}`;
  const response = await fetchConCache(url, {}, 60000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function CrearTurno(datos) {
  const response = await fetch("/api/rrhh/turnos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ActualizarTurno(idTurno, datos) {
  const response = await fetch(`/api/rrhh/turnos/${idTurno}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function EliminarTurno(idTurno) {
  const response = await fetch(`/api/rrhh/turnos/${idTurno}`, {
    method: "DELETE",
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

// 4. CRONOGRAMA DE TURNOS SEMANAL
export async function ObtenerCronograma(fechaInicio, fechaFin, area = "", idSucursal = null) {
  let url = `/api/rrhh/cronograma?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
  if (area && area !== "TODAS") url += `&area=${encodeURIComponent(area)}`;
  if (idSucursal && idSucursal !== "todas") url += `&id_sucursal=${idSucursal}`;
  const response = await fetchConCache(url, {}, 20000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function AsignarTurno(datos) {
  const response = await fetch("/api/rrhh/cronograma/asignar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function AsignarTurnosBatch(asignaciones) {
  const response = await fetch("/api/rrhh/cronograma/asignar-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Asignaciones: asignaciones }),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function DesasignarTurno(idUsuario, fecha) {
  const response = await fetch(`/api/rrhh/cronograma/desasignar?id_usuario=${idUsuario}&fecha=${fecha}`, {
    method: "DELETE",
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

// 5. ASISTENCIA & BIOMÉTRICO (NG-ECO)
export async function ObtenerAsistencia(params = {}) {
  if (typeof params === "string") {
    return ObtenerAsistencias(arguments[0], arguments[1], arguments[2], arguments[3]);
  }
  const fIni = params.FechaInicio || params.fechaInicio || new Date().toISOString().split("T")[0];
  const fFin = params.FechaFin || params.fechaFin || fIni;
  const idU = params.IdUsuario || params.idUsuario || null;
  const area = params.Area || params.area || "";
  const idSuc = params.id_sucursal || params.idSucursal || null;
  return ObtenerAsistencias(fIni, fFin, idU, area, idSuc);
}

export async function ObtenerAsistencias(fechaInicio, fechaFin, idUsuario = null, area = "", idSucursal = null) {
  let url = `/api/rrhh/asistencia?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
  if (idUsuario) url += `&id_usuario=${idUsuario}`;
  if (area && area !== "TODAS") url += `&area=${encodeURIComponent(area)}`;
  if (idSucursal && idSucursal !== "todas") url += `&id_sucursal=${idSucursal}`;
  const response = await fetchConCache(url, {}, 20000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function ActualizarAsistencia(idAsistencia, datos) {
  const response = await fetch(`/api/rrhh/asistencia/${idAsistencia}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function RegistrarMarcaManual(datos) {
  const response = await fetch("/api/rrhh/asistencia/marca-manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ImportarBiometrico(marcas) {
  const response = await fetch("/api/rrhh/biometrico/importar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Marcas: marcas }),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ObtenerMarcasBiometricas(fechaInicio, fechaFin, idUsuario = null) {
  let url = `/api/rrhh/biometrico/marcas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
  if (idUsuario) url += `&id_usuario=${idUsuario}`;
  const response = await fetchConCache(url, {}, 20000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

// 6. CONFIGURACIÓN LABORAL
export async function ObtenerConfiguracionLaboral() {
  const response = await fetchConCache("/api/rrhh/configuracion", {}, 120000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function ActualizarConfiguracionLaboral(idConfig, datos) {
  const response = await fetch(`/api/rrhh/configuracion/${idConfig}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

// 7. PERIODOS & PLANILLAS DE SUELDOS
export async function ObtenerPeriodosNomina() {
  const response = await fetchConCache("/api/rrhh/periodos", {}, 30000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function CrearPeriodoNomina(datos) {
  const response = await fetch("/api/rrhh/periodos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ObtenerPlanilla(idPeriodo) {
  const response = await fetchConCache(`/api/rrhh/planillas/${idPeriodo}`, {}, 20000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function GenerarPlanilla(idPeriodo) {
  const response = await fetch("/api/rrhh/planillas/generar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IdPeriodoNomina: idPeriodo }),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function EditarDetallePlanilla(idDetalle, datos) {
  const response = await fetch(`/api/rrhh/planillas/detalle/${idDetalle}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function AprobarPlanilla(idPlanilla, observacion = "") {
  const response = await fetch(`/api/rrhh/planillas/${idPlanilla}/aprobar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Observacion: observacion }),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ObtenerBoletaPago(idDetalle) {
  const response = await fetchConCache(`/api/rrhh/planillas/boleta/${idDetalle}`, {}, 60000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

// ==========================================
// FASE 3: PLANILLAS DUALES, ASISTENCIA Y FINIQUITOS (SUBAGENTE D)
// ==========================================

export async function ObtenerBoletaPagoDoble(idDetalle) {
  const response = await fetchConCache(`/api/rrhh/planillas/boleta-doble/${idDetalle}`, {}, 30000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function GenerarPlanillaDual({ idPeriodo, tipoPlanilla = "INTERNA", idSucursal = null }) {
  const response = await fetch("/api/rrhh/planillas/generar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      IdPeriodoNomina: idPeriodo,
      TipoPlanilla: tipoPlanilla,
      IdSucursal: idSucursal,
    }),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ListarEmpleadosDual({ area = "", asegurado = null, idSucursal = null, busqueda = "" } = {}) {
  const params = new URLSearchParams();
  if (area) params.append("area", area);
  if (asegurado !== null && asegurado !== undefined) params.append("asegurado", asegurado);
  if (idSucursal) params.append("id_sucursal", idSucursal);
  if (busqueda) params.append("busqueda", busqueda);
  const response = await fetchConCache(`/api/rrhh/empleados?${params.toString()}`, {}, 15000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function CalcularFiniquito(datos) {
  const response = await fetch("/api/rrhh/finiquitos/calcular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ListarFiniquitos(params = {}) {
  const q = new URLSearchParams(params).toString();
  const response = await fetchConCache(`/api/rrhh/finiquitos?${q}`, {}, 15000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function ObtenerFiniquito(idFiniquito) {
  const response = await fetchConCache(`/api/rrhh/finiquitos/${idFiniquito}`, {}, 15000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function RegistrarNoVenta(datos) {
  const response = await fetch("/api/rrhh/no-venta/registrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}

export async function ListarNoVenta(mes = null, anio = null) {
  let url = "/api/rrhh/no-venta";
  const params = [];
  if (mes) params.push(`mes=${mes}`);
  if (anio) params.push(`anio=${anio}`);
  if (params.length) url += `?${params.join("&")}`;
  const response = await fetchConCache(url, {}, 15000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

export async function ImportarExcelOsvaldo(formData) {
  const response = await fetch("/api/rrhh/importar-excel-osvaldo", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) await manejarErrorBackend(response);
  invalidarCache("/api/rrhh");
  return await response.json();
}
