import {
  TipoRodelaAdminItem,
  CrearTipoRodelaRequest,
  EditarTipoRodelaRequest
} from "@/models/Rodela/TipoRodela";
import {
  ListarTiposResponse,
  CambiarEstadoTipoRequest,
  CambiarEstadoTipoResponse
} from "@/models/MateriaPrima/TipoMateriaPrima";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/rodela/tipo";

export async function listarTiposRodela(filtros) {
  const data = await pedirJson(`${BASE_URL}/listar`);

  return ListarTiposResponse(data.map(TipoRodelaAdminItem), filtros, (t) => t.NombreTipoRodela);
}

export async function obtenerTipoRodela(idTipoRodela) {
  const data = await pedirJson(`${BASE_URL}/listar`);
  const tipo = data.find((t) => t.IdTipoRodela === idTipoRodela);
  if (!tipo) throw new Error("El tipo de rodela no existe");

  return TipoRodelaAdminItem(tipo);
}

export async function crearTipoRodela(datos) {
  const data = await pedirJson(`${BASE_URL}/crear`, {
    method: "POST",
    body: CrearTipoRodelaRequest(datos)
  });

  return TipoRodelaAdminItem(data);
}

export async function editarTipoRodela(idTipoRodela, datos) {
  const data = await pedirJson(`${BASE_URL}/editar`, {
    method: "PATCH",
    body: EditarTipoRodelaRequest(idTipoRodela, datos)
  });

  return TipoRodelaAdminItem(data);
}

export async function cambiarEstadoTipoRodela(idTipoRodela, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/estado`, {
    method: "PATCH",
    body: CambiarEstadoTipoRequest(idTipoRodela, activo, motivo)
  });

  return CambiarEstadoTipoResponse(data);
}
