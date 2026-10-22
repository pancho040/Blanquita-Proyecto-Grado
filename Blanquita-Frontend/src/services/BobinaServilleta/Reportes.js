import {
  VerBobinasServilletaRequest,
  VerBobinasServilletaResponse,
  VerLotesBobinaServilletaRequest,
  VerLotesBobinaServilletaResponse,
  VerProduccionesServilletaRequest,
  VerProduccionesServilletaResponse
} from "../../models/BobinaServilleta/Reportes";
import { pedirJson } from "@/utils/api";
import { construirQueryParams, conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/bobinaservilleta/reporte";

export async function descargarReporteInventarioCompletoServilleta() {
  return descargarDesdeUrl(
    `${BASE_URL}/inventario/completo`,
    "reporte-inventario-servilleta.pdf"
  );
}

export async function descargarReporteInventarioBobinaServilleta(idsTipoBobinaServilleta) {
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/bobina/inventario`, { tipos: idsTipoBobinaServilleta }),
    "reporte-inventario-bobina-servilleta.pdf"
  );
}

export async function verBobinasServilletaReporte(filtros) {
  const payload = VerBobinasServilletaRequest(filtros);
  const params = construirQueryParams(payload);

  const data = await pedirJson(`${BASE_URL}/bobina/catalogo?${params.toString()}`);

  return VerBobinasServilletaResponse(data);
}

export async function descargarReporteDetalleBobinaServilleta(idBobinaServilleta) {
  return descargarDesdeUrl(
    `${BASE_URL}/bobina/detalle/${idBobinaServilleta}`,
    `reporte-detalle-bobina-servilleta-${idBobinaServilleta}.pdf`
  );
}

export async function descargarReporteMovimientosUnidadServilleta(idUnidadBobinaServilleta) {
  return descargarDesdeUrl(
    `${BASE_URL}/unidad/movimientos/${idUnidadBobinaServilleta}`,
    `reporte-movimientos-unidad-servilleta-${idUnidadBobinaServilleta}.pdf`
  );
}

export async function verLotesBobinaServilleta(filtros) {
  const payload = VerLotesBobinaServilletaRequest(filtros);
  const params = construirQueryParams(payload);

  const data = await pedirJson(`${BASE_URL}/lote/catalogo?${params.toString()}`);

  return VerLotesBobinaServilletaResponse(data);
}

export async function descargarReporteLoteServilletaDetalle(idLoteBobinaServilleta) {
  return descargarDesdeUrl(
    `${BASE_URL}/lote/detalle/${idLoteBobinaServilleta}`,
    `reporte-lote-servilleta-${idLoteBobinaServilleta}.pdf`
  );
}

export async function descargarReporteLotesServilletaPorPeriodo(fechaInicio, fechaFin) {
  const params = construirQueryParams({
    FechaInicio: fechaInicio,
    FechaFin: fechaFin
  });

  return descargarDesdeUrl(
    `${BASE_URL}/lote/periodo?${params.toString()}`,
    `ingresos-lotes-servilleta-periodo-${fechaInicio}-${fechaFin}.pdf`
  );
}

export async function verProduccionesServilleta(filtros) {
  const payload = VerProduccionesServilletaRequest(filtros);
  const params = construirQueryParams(payload);

  const data = await pedirJson(`${BASE_URL}/produccion/catalogo?${params.toString()}`);

  return VerProduccionesServilletaResponse(data);
}

export async function descargarReporteDetalleProduccionServilleta(idProduccion, verPausas) {
  const params = construirQueryParams({ VerPausas: verPausas ?? false });

  return descargarDesdeUrl(
    `${BASE_URL}/produccion/detalle/${idProduccion}?${params.toString()}`,
    `reporte-produccion-servilleta-${idProduccion}.pdf`
  );
}

export async function descargarReporteProduccionServilletaCancelada(idProduccion) {
  return descargarDesdeUrl(
    `${BASE_URL}/produccion/cancelada/${idProduccion}`,
    `reporte-produccion-servilleta-cancelada-${idProduccion}.pdf`
  );
}

export async function descargarReporteProduccionServilletaPorPeriodo(
  fechaInicio,
  fechaFin,
  verCancelaciones,
) {
  const params = construirQueryParams({
    FechaInicio: fechaInicio,
    FechaFin: fechaFin,
    VerCancelaciones: verCancelaciones ?? false
  });

  return descargarDesdeUrl(
    `${BASE_URL}/produccion/periodo?${params.toString()}`,
    `reporte-produccion-servilleta-periodo-${fechaInicio}-${fechaFin}.pdf`
  );
}
