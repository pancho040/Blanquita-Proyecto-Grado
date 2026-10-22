import {
  FiltroRegistroIngresoRequest,
  ListarRegistroIngresoRequest,
  ListarUsuarioRegistroIngresoResponse,
  ListarRegistroIngresoResponse,
  ReporteUsuarioRegistroIngresoResponse,
} from "../../models/Usuario/RegistroIngreso";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/registroingreso";

export async function listarRegistroIngreso(filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/listar`, ListarRegistroIngresoRequest(filtros)),
  );
  return ListarRegistroIngresoResponse(data);
}

export async function listarAccesosUsuario(filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/usuario/listar`, ListarRegistroIngresoRequest(filtros)),
  );
  return ListarUsuarioRegistroIngresoResponse(data);
}

export async function verResumenUsuarioRegistroIngreso(filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/usuario/resumen`, FiltroRegistroIngresoRequest(filtros)),
  );
  return ReporteUsuarioRegistroIngresoResponse(data);
}

export async function descargarReporteRegistroIngreso(filtros) {
  const params = FiltroRegistroIngresoRequest(filtros);
  await descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/reporte`, params),
    `registro-accesos-${params.FechaInicio}-${params.FechaFin}.pdf`,
  );
}

export async function descargarReporteUsuarioRegistroIngreso(filtros) {
  const params = FiltroRegistroIngresoRequest(filtros);
  await descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/usuario/reporte`, params),
    `registro-accesos-ci-${params.Ci}-${params.FechaInicio ?? "todo"}-${params.FechaFin ?? "todo"}.pdf`,
  );
}
