import {
  IniciarProduccionBobinaTuboRequest,
  IniciarProduccionBobinaTuboResponse,
  CambiarLineaProduccionBobinaTuboRequest,
  CambiarLineaProduccionBobinaTuboResponse,
  FinalizarProduccionBobinaTuboRequest,
  FinalizarProduccionBobinaTuboResponse,
  PausarProduccionBobinaTuboRequest,
  PausarProduccionBobinaTuboResponse,
  ReanudarProduccionBobinaTuboRequest,
  ReanudarProduccionBobinaTuboResponse,
  CancelarProduccionBobinaTuboRequest,
  CancelarProduccionBobinaTuboResponse,
  InsertarMovimientoOperadorLogsRequest,
  InsertarMovimientoOperadorLogsResponse,
  VerProduccionBobinaTuboResponse,
  VerPausasProduccionBobinaTuboActivasResponse
} from "../../models/BobinaPapel/Produccion";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";


export async function iniciarProduccion(idBobina1, idBobina2, idProducto) {
  const payload = IniciarProduccionBobinaTuboRequest(idBobina1, idBobina2, idProducto);

  const data = await pedirJson("/api/papelbobina/produccion/iniciar", {
    method: "POST",
    body: payload
  });

  return IniciarProduccionBobinaTuboResponse(data);
}

export async function cambiarLineaProduccion(idProduccionBobinaTubo, idProducto) {
  const payload = CambiarLineaProduccionBobinaTuboRequest(idProduccionBobinaTubo, idProducto);
  const data = await pedirJson("/api/papelbobina/produccion/cambiarlinea", {
    method: "POST",
    body: payload
  });
  return CambiarLineaProduccionBobinaTuboResponse(data);
}

export async function finalizarProduccion(idProduccionBobinaTubo) {
  const payload = FinalizarProduccionBobinaTuboRequest(idProduccionBobinaTubo);

  const data = await pedirJson("/api/papelbobina/produccion/finalizar", {
    method: "POST",
    body: payload
  });

  return FinalizarProduccionBobinaTuboResponse(data);
}

export async function pausarProduccion(idProduccionBobinaTubo, motivoPausaProduccion) {
  const payload = PausarProduccionBobinaTuboRequest(idProduccionBobinaTubo, motivoPausaProduccion);

  const data = await pedirJson("/api/papelbobina/produccion/pausar", {
    method: "POST",
    body: payload
  });

  return PausarProduccionBobinaTuboResponse(data);
}

export async function reanudarProduccion(idProduccionBobinaTubo, motivoReanudacion) {
  const payload = ReanudarProduccionBobinaTuboRequest(idProduccionBobinaTubo, motivoReanudacion);

  const data = await pedirJson("/api/papelbobina/produccion/reanudar", {
    method: "POST",
    body: payload
  });

  return ReanudarProduccionBobinaTuboResponse(data);
}

export async function cancelarProduccion(idProduccionBobinaTubo, motivoCancelacion) {
  const payload = CancelarProduccionBobinaTuboRequest(idProduccionBobinaTubo, motivoCancelacion);

  const data = await pedirJson("/api/papelbobina/produccion/cancelar", {
    method: "POST",
    body: payload
  });

  return CancelarProduccionBobinaTuboResponse(data);
}

export async function insertarMovimientoLog(idProduccionBobinaTubo, idTipoMovimientoOperadorLogs, cantidadLogs, observacion) {
  const payload = InsertarMovimientoOperadorLogsRequest(
    idProduccionBobinaTubo,
    idTipoMovimientoOperadorLogs,
    cantidadLogs,
    observacion
  );

  const data = await pedirJson("/api/papelbobina/produccion/insertarlog", {
    method: "POST",
    body: payload
  });

  return InsertarMovimientoOperadorLogsResponse(data);
}

export async function verProduccionBobinaTubo(idTipoBobina, idProducto) {
  const data = await pedirJson(
    conQueryParams("/api/papelbobina/produccion/activas", {
      IdTipoBobina: idTipoBobina,
      IdProducto: idProducto
    })
  );

  return data.map(VerProduccionBobinaTuboResponse);
}

export async function verPausasProduccionBobinaTuboActivas(filtroIdTipoBobina, filtroIdProducto) {
  const data = await pedirJson(
    conQueryParams("/api/papelbobina/produccion/pausadas", {
      FiltroIdTipoBobina: filtroIdTipoBobina,
      FiltroIdProducto: filtroIdProducto
    })
  );

  return data.map(VerPausasProduccionBobinaTuboActivasResponse);
}