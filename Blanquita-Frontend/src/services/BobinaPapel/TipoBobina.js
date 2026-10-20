import {
  TipoBobinaAdminItem,
  CrearTipoBobinaRequest,
  EditarTipoBobinaRequest
} from "@/models/BobinaPapel/TipoBobina";
import {
  ListarTiposResponse,
  ProductoDisponible,
  CambiarEstadoTipoRequest,
  CambiarEstadoTipoResponse
} from "@/models/MateriaPrima/TipoMateriaPrima";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/bobinapapel/tipo";

export async function listarTiposBobina(filtros) {
  const data = await pedirJson(`${BASE_URL}/listar`);

  return ListarTiposResponse(data.map(TipoBobinaAdminItem), filtros, (t) => t.NombreTipoBobina);
}

export async function obtenerTipoBobina(idTipoBobina) {
  const data = await pedirJson(`${BASE_URL}/listar`);
  const tipo = data.find((t) => t.IdTipoBobina === idTipoBobina);
  if (!tipo) throw new Error("El tipo de bobina papel no existe");

  return TipoBobinaAdminItem(tipo);
}

export async function obtenerProductosTipoBobina() {
  const data = await pedirJson(`${BASE_URL}/productos`);

  return data.map(ProductoDisponible);
}

export async function crearTipoBobina(datos) {
  const data = await pedirJson(`${BASE_URL}/crear`, {
    method: "POST",
    body: CrearTipoBobinaRequest(datos)
  });

  return TipoBobinaAdminItem(data);
}

export async function editarTipoBobina(idTipoBobina, datos) {
  const data = await pedirJson(`${BASE_URL}/editar`, {
    method: "PATCH",
    body: EditarTipoBobinaRequest(idTipoBobina, datos)
  });

  return TipoBobinaAdminItem(data);
}

export async function cambiarEstadoTipoBobina(idTipoBobina, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/estado`, {
    method: "PATCH",
    body: CambiarEstadoTipoRequest(idTipoBobina, activo, motivo)
  });

  return CambiarEstadoTipoResponse(data);
}
