import {
  IngresoEmpaqueRequest,
  IngresoEmpaqueResponse,
  ResumenInventarioEmpaqueResponse,
  DetalleInventarioEmpaqueResponse,
  TrasladarEmpaquesProduccionRequest,
  TrasladarEmpaquesProduccionResponseItem,
  TipoEmpaqueIngreso,
  EmpaqueReingresableResponse,
  ReingresarEmpaqueRequest,
  ReingresarEmpaqueResponse
} from "../../models/Empaque/EmpaqueBobina";
import { pedirJson } from "@/utils/api";

export async function cargarLoteEmpaque(idProveedor, cantidadToneladasPedida, empaques) {
  const payload = IngresoEmpaqueRequest(idProveedor, cantidadToneladasPedida, empaques);

  const data = await pedirJson("/api/empaquebobina/cargarlote", {
    method: "POST",
    body: payload
  });

  return IngresoEmpaqueResponse(data);
}

export async function verResumenInventarioEmpaque() {
  const data = await pedirJson("/api/empaquebobina/inventario");

  return data.map(ResumenInventarioEmpaqueResponse);
}

export async function verDetalleInventarioEmpaque(idTipoEmpaque) {
  const params = new URLSearchParams({ IdTipoEmpaque: idTipoEmpaque });

  const data = await pedirJson(`/api/empaquebobina/inventariodetalle?${params.toString()}`);

  return data.map(DetalleInventarioEmpaqueResponse);
}

export async function trasladarEmpaquesAProduccion(idsEmpaque) {
  const payload = TrasladarEmpaquesProduccionRequest(idsEmpaque);

  const data = await pedirJson("/api/empaquebobina/trasladarproduccion", {
    method: "POST",
    body: payload
  });

  return data.map(TrasladarEmpaquesProduccionResponseItem);
}

export async function obtenerTiposEmpaque() {
  const data = await pedirJson("/api/empaquebobina/obtenertipos");

  return data.map(TipoEmpaqueIngreso);
}

export async function listarEmpaquesReingresables() {
  const data = await pedirJson("/api/empaquebobina/reingresables");

  return data.map(EmpaqueReingresableResponse);
}

export async function reingresarEmpaque(idEmpaque, observacion) {
  const payload = ReingresarEmpaqueRequest(idEmpaque, observacion);

  const data = await pedirJson("/api/empaquebobina/reingresar", {
    method: "POST",
    body: payload
  });

  return ReingresarEmpaqueResponse(data);
}
