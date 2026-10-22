import {
  FiltroHistorialAdminRequest,
  ListarHistorialAdminRequest,
  ListarUsuarioHistorialAdminResponse,
  ListarHistorialAdminResponse,
  ReporteUsuarioHistorialAdminResponse,
} from "../../models/Usuario/HistorialAdmin";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/historialadmin";

export async function listarHistorialAdmin(filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/listar`, ListarHistorialAdminRequest(filtros)),
  );
  return ListarHistorialAdminResponse(data);
}

export async function listarAccionesUsuario(filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/usuario/listar`, ListarHistorialAdminRequest(filtros)),
  );
  return ListarUsuarioHistorialAdminResponse(data);
}

export async function verResumenUsuarioHistorialAdmin(filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/usuario/resumen`, FiltroHistorialAdminRequest(filtros)),
  );
  return ReporteUsuarioHistorialAdminResponse(data);
}

export async function descargarReporteHistorialAdmin(filtros) {
  const params = FiltroHistorialAdminRequest(filtros);
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/reporte`, params),
    `acciones-administrador-${params.FechaInicio}-${params.FechaFin}.pdf`,
  );
}

export async function descargarReporteUsuarioHistorialAdmin(filtros) {
  const params = FiltroHistorialAdminRequest(filtros);
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/usuario/reporte`, params),
    `acciones-administrador-ci-${params.Ci}-${params.FechaInicio ?? "todo"}-${params.FechaFin ?? "todo"}.pdf`,
  );
}
