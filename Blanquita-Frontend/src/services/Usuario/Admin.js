import {
  ListarUsuariosRequest,
  ListarUsuariosResponse,
  CrearUsuarioRequest,
  CrearUsuarioResponse,
  CambiarEstadoUsuarioRequest,
  CambiarEstadoUsuarioResponse,
  EditarUsuarioRequest,
  EditarUsuarioResponse,
  RestablecerClaveRequest,
  RestablecerClaveResponse,
  UsuarioDetalleResponse,
  CambiarRolUsuarioRequest,
  CambiarRolUsuarioResponse,
  CambiarAdminUsuarioRequest,
  CambiarAdminUsuarioResponse,
} from "../../models/Usuario/Admin";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";

const BASE_URL = "/api/Usuario";

export async function listarUsuarios(filtros) {
  const data = await pedirJson(conQueryParams(`${BASE_URL}/listar`, ListarUsuariosRequest(filtros)));
  return ListarUsuariosResponse(data);
}

export async function crearUsuario(datos) {
  const data = await pedirJson(`${BASE_URL}/crear`, {
    method: "POST",
    body: CrearUsuarioRequest(datos),
  });
  return CrearUsuarioResponse(data);
}

export async function cambiarEstadoUsuario(idUsuario, idEstadoUsuario, motivo) {
  const data = await pedirJson(`${BASE_URL}/estado`, {
    method: "PATCH",
    body: CambiarEstadoUsuarioRequest(idUsuario, idEstadoUsuario, motivo),
  });
  return CambiarEstadoUsuarioResponse(data);
}

export async function editarUsuario(idUsuario, datos) {
  const data = await pedirJson(`${BASE_URL}/editar`, {
    method: "PATCH",
    body: EditarUsuarioRequest(idUsuario, datos),
  });
  return EditarUsuarioResponse(data);
}

export async function restablecerClave(idUsuario, claveNueva) {
  const data = await pedirJson(`${BASE_URL}/clave`, {
    method: "PATCH",
    body: RestablecerClaveRequest(idUsuario, claveNueva),
  });
  return RestablecerClaveResponse(data);
}

export async function verDetalleUsuario(idUsuario) {
  const data = await pedirJson(conQueryParams(`${BASE_URL}/detalle`, { IdUsuario: idUsuario }));
  return UsuarioDetalleResponse(data);
}

export async function cambiarRolUsuario(idUsuario, idRol, motivo) {
  const data = await pedirJson(`${BASE_URL}/rol`, {
    method: "PATCH",
    body: CambiarRolUsuarioRequest(idUsuario, idRol, motivo),
  });
  return CambiarRolUsuarioResponse(data);
}

export async function cambiarAdminUsuario(idUsuario, isAdmin, motivo) {
  const data = await pedirJson(`${BASE_URL}/admin`, {
    method: "PATCH",
    body: CambiarAdminUsuarioRequest(idUsuario, isAdmin, motivo),
  });
  return CambiarAdminUsuarioResponse(data);
}
