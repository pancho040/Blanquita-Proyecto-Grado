import {
  VerRodelasRequest,
  VerRodelasResponse,
  VerLotesRodelaRequest,
  VerLotesRodelaResponse
} from "../../models/Rodela/Reportes";
import { pedirJson } from "@/utils/api";
import { construirQueryParams, conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/rodela/reportes";

export async function verRodelasReporte(filtros) {
  const payload = VerRodelasRequest(filtros);
  const params = construirQueryParams(payload);

  const data = await pedirJson(`${BASE_URL}/inventario/catalogo?${params.toString()}`);

  return VerRodelasResponse(data);
}

export async function descargarReporteInventarioRodela(idsTipoRodela) {
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/inventario`, { tipos: idsTipoRodela }),
    "reporte-inventario-rodela.pdf"
  );
}

export async function descargarReporteMovimientosRodela(idRodela) {
  return descargarDesdeUrl(
    `${BASE_URL}/movimientos/reporte/${idRodela}`,
    `reporte-movimientos-rodela-${idRodela}.pdf`
  );
}

export async function verLotesRodela(filtros) {
  const payload = VerLotesRodelaRequest(filtros);
  const params = construirQueryParams(payload);

  const data = await pedirJson(`${BASE_URL}/lote/catalogo?${params.toString()}`);

  return VerLotesRodelaResponse(data);
}

export async function descargarReporteLoteRodelaDetalle(idLoteRodela) {
  return descargarDesdeUrl(
    `${BASE_URL}/lote/detalle/${idLoteRodela}`,
    `reporte-lote-rodela-${idLoteRodela}.pdf`
  );
}

export async function descargarReporteLotesRodelaPorPeriodo(fechaInicio, fechaFin) {
  const params = construirQueryParams({
    FechaInicio: fechaInicio,
    FechaFin: fechaFin
  });

  return descargarDesdeUrl(
    `${BASE_URL}/lote/periodo?${params.toString()}`,
    `ingresos-lotes-rodela-periodo-${fechaInicio}-${fechaFin}.pdf`
  );
}
