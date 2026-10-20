import {
  TipoEmpaqueAdminItem,
  CrearTipoEmpaqueRequest,
  EditarTipoEmpaqueRequest
} from "@/models/Empaque/TipoEmpaque";
import {
  ListarTiposResponse,
  CambiarEstadoTipoRequest,
  CambiarEstadoTipoResponse
} from "@/models/MateriaPrima/TipoMateriaPrima";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/empaque/tipo";

export async function listarTiposEmpaque(clase, filtros) {
  const data = await pedirJson(`${BASE_URL}/${clase}/listar`);

  return ListarTiposResponse(data.map(TipoEmpaqueAdminItem), filtros, (t) => t.Nombre);
}

export async function obtenerTipoEmpaque(clase, id) {
  const data = await pedirJson(`${BASE_URL}/${clase}/detalle/${id}`);

  return TipoEmpaqueAdminItem(data);
}

export async function crearTipoEmpaque(clase, datos) {
  const data = await pedirJson(`${BASE_URL}/${clase}/crear`, {
    method: "POST",
    body: CrearTipoEmpaqueRequest(datos)
  });

  return TipoEmpaqueAdminItem(data);
}

export async function editarTipoEmpaque(clase, id, datos) {
  const data = await pedirJson(`${BASE_URL}/${clase}/editar`, {
    method: "PATCH",
    body: EditarTipoEmpaqueRequest(id, datos)
  });

  return TipoEmpaqueAdminItem(data);
}

export async function cambiarEstadoTipoEmpaque(clase, id, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/${clase}/estado`, {
    method: "PATCH",
    body: CambiarEstadoTipoRequest(id, activo, motivo)
  });

  return CambiarEstadoTipoResponse(data);
}
