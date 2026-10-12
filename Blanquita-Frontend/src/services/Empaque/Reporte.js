import {
  ReporteEmpaqueRequest,
  ReporteMovimientosEmpaqueResponse,
  ReporteLotesEmpaqueResponse
} from "../../models/Empaque/Reporte";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/empaque/reportes";

export async function descargarReporteInventarioEmpaque(clase) {
  await descargarDesdeUrl(`${BASE_URL}/${clase}/inventario`, `inventario-empaque-${clase}.pdf`);
}

export async function verResumenMovimientosEmpaque(clase, filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/${clase}/movimientos/resumen`, ReporteEmpaqueRequest(filtros))
  );

  return ReporteMovimientosEmpaqueResponse(data);
}

export async function descargarReporteMovimientosEmpaque(clase, filtros) {
  await descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/${clase}/movimientos`, ReporteEmpaqueRequest(filtros)),
    `movimientos-empaque-${clase}-${filtros.FechaInicio}-${filtros.FechaFin}.pdf`
  );
}

export async function verResumenLotesEmpaque(clase, filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/${clase}/lotes/resumen`, ReporteEmpaqueRequest(filtros))
  );

  return ReporteLotesEmpaqueResponse(data);
}

export async function descargarReporteLotesEmpaque(clase, filtros) {
  await descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/${clase}/lotes`, ReporteEmpaqueRequest(filtros)),
    `lotes-empaque-${clase}-${filtros.FechaInicio}-${filtros.FechaFin}.pdf`
  );
}
