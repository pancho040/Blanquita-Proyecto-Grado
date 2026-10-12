import {
  ResumenInventarioInsumoRequest,
  ResumenInventarioInsumoResponse,
  ResumenMovimientosInsumoRequest,
  ResumenMovimientosInsumoResponse
} from "../../models/Insumo/Reporte";
import { pedirJson } from "@/utils/api";
import { construirQueryParams, conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/insumo/reportes";

export async function verResumenInventarioInsumo(filtros) {
  const params = construirQueryParams(ResumenInventarioInsumoRequest(filtros));

  const data = await pedirJson(`${BASE_URL}/inventario/resumen?${params.toString()}`);

  return ResumenInventarioInsumoResponse(data);
}

export async function descargarReporteInventarioInsumo(idsTipoInsumo) {
  await descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/inventario`, { IdsTipoInsumo: idsTipoInsumo }),
    "reporte-inventario-insumos.pdf"
  );
}

export async function verResumenMovimientosInsumo(filtros) {
  const params = construirQueryParams(ResumenMovimientosInsumoRequest(filtros));

  const data = await pedirJson(`${BASE_URL}/movimientos/resumen?${params.toString()}`);

  return ResumenMovimientosInsumoResponse(data);
}

export async function descargarReporteMovimientosInsumo(fechaInicio, fechaFin, idsTipoInsumo) {
  await descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/movimientos`, {
      FechaInicio: fechaInicio,
      FechaFin: fechaFin,
      IdsTipoInsumo: idsTipoInsumo
    }),
    `movimientos-insumos-${fechaInicio}-${fechaFin}.pdf`
  );
}
