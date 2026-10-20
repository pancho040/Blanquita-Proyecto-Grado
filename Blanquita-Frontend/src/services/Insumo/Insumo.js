import {
  CatalogoInsumoResponse,
  MovimientoInsumoRequest,
  MovimientoInsumoResponse,
  ListarInsumosRequest,
  ListarInsumosResponse,
  CrearInsumoRequest,
  EditarInsumoRequest,
  InsumoResponse
} from "../../models/Insumo/Insumo";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";

const BASE_URL = "/api/insumo";

export async function verCatalogoInsumo() {
  const data = await pedirJson(`${BASE_URL}/inventario`);

  return data.map(CatalogoInsumoResponse);
}

export async function ingresarInsumo(idTipoInsumo, cantidad, observacion) {
  const payload = MovimientoInsumoRequest(idTipoInsumo, cantidad, observacion);

  const data = await pedirJson(`${BASE_URL}/ingreso`, {
    method: "POST",
    body: payload
  });

  return MovimientoInsumoResponse(data);
}

export async function sacarInsumo(idTipoInsumo, cantidad, observacion) {
  const payload = MovimientoInsumoRequest(idTipoInsumo, cantidad, observacion);

  const data = await pedirJson(`${BASE_URL}/salida`, {
    method: "POST",
    body: payload
  });

  return MovimientoInsumoResponse(data);
}

export async function listarInsumos(filtros) {
  const data = await pedirJson(conQueryParams(`${BASE_URL}/listar`, ListarInsumosRequest(filtros)));

  return ListarInsumosResponse(data);
}

export async function obtenerInsumo(idTipoInsumo) {
  const data = await pedirJson(`${BASE_URL}/detalle/${idTipoInsumo}`);

  return InsumoResponse(data);
}

export async function crearInsumo(datos) {
  const data = await pedirJson(`${BASE_URL}/crear`, {
    method: "POST",
    body: CrearInsumoRequest(datos)
  });

  return InsumoResponse(data);
}

export async function editarInsumo(idTipoInsumo, datos) {
  const data = await pedirJson(`${BASE_URL}/editar`, {
    method: "PATCH",
    body: EditarInsumoRequest(idTipoInsumo, datos)
  });

  return InsumoResponse(data);
}
