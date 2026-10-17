import {
  ProveedorForm,
  ListarProveedoresRequest,
  ListarProveedoresResponse,
  CrearProveedorRequest,
  EditarProveedorRequest,
  ProveedorResponse,
  CambiarEstadoProveedorRequest,
  CambiarEstadoProveedorResponse,
} from "../../models/Proveedor/Proveedor";
import { pedirJson } from "@/utils/api";
import { conQueryParams } from "@/utils/params";

const BASE_URL = "/api/proveedor";

export async function ObtenerProveedoresForm() {
  const data = await pedirJson(`${BASE_URL}/formulario`);

  return data.map(ProveedorForm);
}

export async function listarProveedores(filtros) {
  const data = await pedirJson(
    conQueryParams(`${BASE_URL}/listar`, ListarProveedoresRequest(filtros)),
  );
  return ListarProveedoresResponse(data);
}

export async function crearProveedor(datos) {
  const data = await pedirJson(`${BASE_URL}/crear`, {
    method: "POST",
    body: CrearProveedorRequest(datos),
  });
  return ProveedorResponse(data);
}

export async function editarProveedor(idProveedor, datos) {
  const data = await pedirJson(`${BASE_URL}/editar`, {
    method: "PUT",
    body: EditarProveedorRequest(idProveedor, datos),
  });
  return ProveedorResponse(data);
}

export async function cambiarEstadoProveedor(idProveedor, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/estado`, {
    method: "PATCH",
    body: CambiarEstadoProveedorRequest(idProveedor, activo, motivo),
  });
  return CambiarEstadoProveedorResponse(data);
}
