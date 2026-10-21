import {
  InventarioEmpaqueBolsaResponse,
  IngresoEmpaqueBolsaRequest,
  IngresoEmpaqueBolsaResponse,
  SalidaEmpaqueBolsaRequest,
  SalidaEmpaqueBolsaResponse,
  ReingresoEmpaqueBolsaRequest,
  ReingresoEmpaqueBolsaResponse
} from "../../models/Empaque/EmpaqueBolsa";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";

const BASE_URL = "/api/empaquebolsa";

export async function verInventarioEmpaqueBolsa(incluirInactivos = false) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/inventario`, { IncluirInactivos: incluirInactivos || null })
  );

  return data.map(InventarioEmpaqueBolsaResponse);
}

export async function cargarLoteEmpaqueBolsa(idProveedor, cantidadToneladasPedida, empaquesBolsa) {
  const data = await pedirJson(`${BASE_URL}/cargarlote`, {
    method: "POST",
    body: IngresoEmpaqueBolsaRequest(idProveedor, cantidadToneladasPedida, empaquesBolsa)
  });

  return IngresoEmpaqueBolsaResponse(data);
}

export async function sacarEmpaqueBolsa(idTipoEmpaqueBolsa, cantidad, observacion) {
  const data = await pedirJson(`${BASE_URL}/salida`, {
    method: "POST",
    body: SalidaEmpaqueBolsaRequest(idTipoEmpaqueBolsa, cantidad, observacion)
  });

  return SalidaEmpaqueBolsaResponse(data);
}

export async function reingresarEmpaqueBolsa(idTipo, cantidad, observacion) {
  const data = await pedirJson(`${BASE_URL}/reingreso`, {
    method: "POST",
    body: ReingresoEmpaqueBolsaRequest(idTipo, cantidad, observacion)
  });

  return ReingresoEmpaqueBolsaResponse(data);
}
