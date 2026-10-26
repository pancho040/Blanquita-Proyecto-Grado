import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache } from "@/lib/api-cache";

export async function ObtenerLogsAuditoria({
  page = 1,
  limit = 20,
  tabla = "",
  accion = "",
  id_usuario = "",
  fecha_inicio = "",
  fecha_fin = "",
  busqueda = ""
} = {}) {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (tabla) params.append("tabla", tabla);
  if (accion && accion !== "TODAS") params.append("accion", accion);
  if (id_usuario) params.append("id_usuario", id_usuario);
  if (fecha_inicio) params.append("fecha_inicio", fecha_inicio);
  if (fecha_fin) params.append("fecha_fin", fecha_fin);
  if (busqueda) params.append("busqueda", busqueda);

  const url = `/api/admin/auditoria?${params.toString()}`;
  const response = await fetchConCache(url, {}, 5000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerDetalleAuditoria(idAudit) {
  const response = await fetch(`/api/admin/auditoria/${idAudit}`);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}
