import {
  IniciarConteoRequest,
  RegistrarCantidadesConteoRequest,
  CerrarConteoRequest,
  AnularConteoRequest,
  ConteoResponse,
  ResumenConteoResponse,
  EstadoConteoResponse,
} from "../../models/Inventario/conteo";

import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";
import { descargarDesdeUrl } from "@/utils/downloadFile";

const BASE_URL = "/api/productofinal/conteo";

export async function verConteoActivo() {
  const data = await pedirJson(`${BASE_URL}/activo`);

  return EstadoConteoResponse(data);
}

export async function listarConteos(fechaInicio, fechaFin, estados) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/listar`, {
      FechaInicio: fechaInicio,
      FechaFin: fechaFin,
      Estados: estados,
    })
  );

  return data.map(ResumenConteoResponse);
}

export async function verConteo(idConteo) {
  const data = await pedirJson(`${BASE_URL}/${idConteo}`);

  return ConteoResponse(data);
}

export async function iniciarConteo(motivo) {
  const data = await pedirJson(`${BASE_URL}/iniciar`, {
    method: "POST",
    body: IniciarConteoRequest({ Motivo: motivo })
  });

  return ConteoResponse(data);
}

export async function registrarCantidadesConteo(idConteo, cantidades) {
  const data = await pedirJson(`${BASE_URL}/${idConteo}/cantidades`, {
    method: "PUT",
    body: RegistrarCantidadesConteoRequest(cantidades)
  });

  return ConteoResponse(data);
}

export async function cerrarConteo(idConteo, motivos, confirmado) {
  const data = await pedirJson(`${BASE_URL}/${idConteo}/cerrar`, {
    method: "POST",
    body: CerrarConteoRequest({ Motivos: motivos, Confirmado: confirmado })
  });

  return ConteoResponse(data);
}

export async function anularConteo(idConteo, motivo, confirmado) {
  const data = await pedirJson(`${BASE_URL}/${idConteo}/anular`, {
    method: "POST",
    body: AnularConteoRequest({ Motivo: motivo, Confirmado: confirmado })
  });

  return ConteoResponse(data);
}

export async function descargarHojaConteo() {
  return descargarDesdeUrl(`${BASE_URL}/hoja`, "hoja-conteo-producto-terminado.pdf");
}

export async function descargarReporteConteos({ FechaInicio, FechaFin, Estados }) {
  return descargarDesdeUrl(
    conQueryParams(`${BASE_URL}/reporte`, { FechaInicio, FechaFin, Estados }),
    "conteos-producto-terminado.pdf"
  );
}

export async function descargarActaConteo(idConteo) {
  return descargarDesdeUrl(
    `${BASE_URL}/${idConteo}/acta`,
    `acta-conteo-producto-terminado-${idConteo}.pdf`
  );
}
