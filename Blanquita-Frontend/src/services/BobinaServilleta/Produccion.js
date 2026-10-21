import {
  AbrirBobinaServilletaRequest,
  AbrirBobinaServilletaResponse,
  IniciarProduccionServilletaRequest,
  IniciarProduccionServilletaResponse,
  PausaProduccionServilletaRequest,
  PausaProduccionServilletaResponse,
  ReanudarProduccionServilletaRequest,
  ReanudarProduccionServilletaResponse,
  FinalizarProduccionServilletaRequest,
  FinalizarProduccionServilletaResponse,
  CancelarProduccionServilletaRequest,
  CancelarProduccionServilletaResponse,
  VerProduccionServilletaActivasResponse,
  VerPausasProduccionServilletaActivasResponse
} from "../../models/BobinaServilleta/Produccion";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";

export async function abrirBobinaServilleta(idBobinaServilleta, observacion) {
  const payload = AbrirBobinaServilletaRequest(idBobinaServilleta, observacion);

  const data = await pedirJson("/api/bobinaservilleta/produccion/abrir", {
    method: "POST",
    body: payload
  });

  return AbrirBobinaServilletaResponse(data);
}

export async function iniciarProduccionServilleta(idSubBobina) {
  const payload = IniciarProduccionServilletaRequest(idSubBobina);

  const data = await pedirJson("/api/bobinaservilleta/produccion/iniciar", {
    method: "POST",
    body: payload
  });

  return IniciarProduccionServilletaResponse(data);
}

export async function pausarProduccionServilleta(idProduccionServilleta, motivoPausaProduccion) {
  const payload = PausaProduccionServilletaRequest(idProduccionServilleta, motivoPausaProduccion);

  const data = await pedirJson("/api/bobinaservilleta/produccion/pausar", {
    method: "POST",
    body: payload
  });

  return PausaProduccionServilletaResponse(data);
}

export async function reanudarProduccionServilleta(idProduccionServilleta, motivoReanudacion) {
  const payload = ReanudarProduccionServilletaRequest(idProduccionServilleta, motivoReanudacion);

  const data = await pedirJson("/api/bobinaservilleta/produccion/reanudar", {
    method: "POST",
    body: payload
  });

  return ReanudarProduccionServilletaResponse(data);
}

export async function finalizarProduccionServilleta(idProduccionServilleta) {
  const payload = FinalizarProduccionServilletaRequest(idProduccionServilleta);

  const data = await pedirJson("/api/bobinaservilleta/produccion/finalizar", {
    method: "POST",
    body: payload
  });

  return FinalizarProduccionServilletaResponse(data);
}

export async function cancelarProduccionServilleta(idProduccionServilleta, motivoCancelacion) {
  const payload = CancelarProduccionServilletaRequest(idProduccionServilleta, motivoCancelacion);

  const data = await pedirJson("/api/bobinaservilleta/produccion/cancelar", {
    method: "POST",
    body: payload
  });

  return CancelarProduccionServilletaResponse(data);
}

export async function verProduccionServilletaActivas(idTipoMedidaSubBobina) {
  const data = await pedirJson(
    conQueryParams("/api/bobinaservilleta/produccion/activas", { IdTipoMedidaSubBobina: idTipoMedidaSubBobina })
  );

  return data.map(VerProduccionServilletaActivasResponse);
}

export async function verPausasProduccionServilletaActivas() {
  const data = await pedirJson("/api/bobinaservilleta/produccion/pausadas");

  return data.map(VerPausasProduccionServilletaActivasResponse);
}
