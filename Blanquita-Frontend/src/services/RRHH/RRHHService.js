import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

// 1. DASHBOARD RESUMEN
export async function ObtenerResumenRRHH() {
  const response = await fetchConCache("/api/rrhh/resumen", {}, 30000);
  if (!response.ok) await manejarErrorBackend(response);
  return await response.json();
}

// 2. EMPLEADOS & DATOS LABORALES
export async function ObtenerEmpleados(busqueda = "", area = "", activo = null) {
  let url = "/api/rrhh/empleados?";
  const params = new URLSearchParams();
  if (busqueda) params.append("busqueda", busqueda);
  if (area && area !== "TODAS") params.append("area", area);
  if (activo !== null && activo !== undefined && activo !== "") params.append("activo", activo);
  
  const response = await fetchConCache(url + params.toString(), {}, 30000);
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
export async function ObtenerCronograma(fechaInicio, fechaFin, area = "") {
  let url = `/api/rrhh/cronograma?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
  if (area && area !== "TODAS") url += `&area=${encodeURIComponent(area)}`;
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
export async function ObtenerAsistencias(fechaInicio, fechaFin, idUsuario = null, area = "") {
  let url = `/api/rrhh/asistencia?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
  if (idUsuario) url += `&id_usuario=${idUsuario}`;
  if (area && area !== "TODAS") url += `&area=${encodeURIComponent(area)}`;
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
