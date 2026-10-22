import {
  ResumenProduccionDiariaRequest,
  ResumenProduccionDiariaResponse,
  ResumenInventarioRequest,
  ResumenInventarioResponse,
  ResumenSalidasRequest,
  ResumenSalidasResponse
} from "../../models/Inventario/Reportes";
import { pedirJson } from "@/utils/api";
import { construirQueryParams, conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/productofinal/reportes";

export async function verResumenProduccionDiaria(filtros) {
  const payload = ResumenProduccionDiariaRequest(filtros);
  const params = construirQueryParams(payload);

  const data = await pedirJson(`${BASE_URL}/produccion/diaria/resumen?${params.toString()}`);

  return ResumenProduccionDiariaResponse(data);
}

export async function descargarReporteProduccionDiaria(fechaInicio, fechaFin, idsProducto, verMovimientos) {
  const params = construirQueryParams({
    FechaInicio: fechaInicio,
    FechaFin: fechaFin,
    IdsProducto: idsProducto,
    VerMovimientos: verMovimientos ?? false
  });

  return descargarDesdeUrl(
    `${BASE_URL}/produccion/diaria?${params.toString()}`,
    `produccion-diaria-${fechaInicio}-${fechaFin}.pdf`
  );
}

export async function verResumenInventario(filtros) {
  const payload = ResumenInventarioRequest(filtros);
  const params = construirQueryParams(payload);

  const data = await pedirJson(`${BASE_URL}/inventario/resumen?${params.toString()}`);

  return ResumenInventarioResponse(data);
}

export async function descargarReporteInventarioProducto(idsProducto) {
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/inventario`, { IdsProducto: idsProducto }),
    "reporte-inventario-producto-terminado.pdf"
  );
}

export async function verResumenSalidas(filtros) {
  const data = await pedirJson(conQueryParams(`${BASE_URL}/salidas/resumen`, ResumenSalidasRequest(filtros)));

  return ResumenSalidasResponse(data);
}

export async function descargarReporteSalidas(filtros) {
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/salidas`, ResumenSalidasRequest(filtros)),
    `salidas-producto-terminado-${filtros.FechaInicio}-${filtros.FechaFin}.pdf`
  );
}

export async function descargarExcelSalidas(filtros) {
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/salidas/excel`, ResumenSalidasRequest(filtros)),
    `salidas-producto-terminado-${filtros.FechaInicio}-${filtros.FechaFin}.xlsx`
  );
}

export async function descargarReporteDespacho(idDespacho) {
  return descargarDesdeUrl(
    `${BASE_URL}/salidas/despacho/${idDespacho}`,
    `salida-producto-terminado-${idDespacho}.pdf`
  );
}

export async function descargarExcelDespacho(idDespacho) {
  return descargarDesdeUrl(
    `${BASE_URL}/salidas/despacho/${idDespacho}/excel`,
    `salida-producto-terminado-${idDespacho}.xlsx`
  );
}
