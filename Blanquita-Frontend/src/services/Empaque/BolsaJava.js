import {
  InventarioBolsaJavaResponse,
  IngresoBolsaJavaRequest,
  IngresoBolsaJavaResponse,
  SalidaBolsaJavaRequest,
  SalidaBolsaJavaResponse,
  ReingresoBolsaJavaRequest,
  ReingresoBolsaJavaResponse
} from "../../models/Empaque/BolsaJava";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";

const BASE_URL = "/api/bolsajava";

export async function verInventarioBolsaJava(incluirInactivos = false) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/inventario`, { IncluirInactivos: incluirInactivos || null })
  );

  return data.map(InventarioBolsaJavaResponse);
}

export async function cargarLoteBolsaJava(idProveedor, cantidadToneladasPedida, bolsasJava) {
  const data = await pedirJson(`${BASE_URL}/cargarlote`, {
    method: "POST",
    body: IngresoBolsaJavaRequest(idProveedor, cantidadToneladasPedida, bolsasJava)
  });

  return IngresoBolsaJavaResponse(data);
}

export async function sacarBolsaJava(idTipoBolsaJava, cantidad, observacion) {
  const data = await pedirJson(`${BASE_URL}/salida`, {
    method: "POST",
    body: SalidaBolsaJavaRequest(idTipoBolsaJava, cantidad, observacion)
  });

  return SalidaBolsaJavaResponse(data);
}

export async function reingresarBolsaJava(idTipo, cantidad, observacion) {
  const data = await pedirJson(`${BASE_URL}/reingreso`, {
    method: "POST",
    body: ReingresoBolsaJavaRequest(idTipo, cantidad, observacion)
  });

  return ReingresoBolsaJavaResponse(data);
}
