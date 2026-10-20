import {
  LineaProductoAdminItem,
  TiposOrigenResponse,
  CrearLineaProductoRequest,
  EditarLineaProductoRequest,
  CrearPresentacionRequest
} from "@/models/Producto/LineaProducto";
import {
  ListarTiposResponse,
  CambiarEstadoTipoRequest,
  CambiarEstadoTipoResponse
} from "@/models/MateriaPrima/TipoMateriaPrima";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/producto";

export async function listarLineasProducto(filtros) {
  const data = await pedirJson(`${BASE_URL}/linea/listar`);

  return ListarTiposResponse(
    data.map(LineaProductoAdminItem),
    filtros,
    (l) => `${l.NombreProducto} ${l.SiglasProducto} ${l.Presentaciones.map((p) => p.CodigoPresentacion).join(" ")}`
  );
}

export async function obtenerLineaProducto(idProducto) {
  const data = await pedirJson(`${BASE_URL}/linea/detalle/${idProducto}`);

  return LineaProductoAdminItem(data);
}

export async function obtenerTiposOrigenLinea() {
  const data = await pedirJson(`${BASE_URL}/linea/tipos`);

  return TiposOrigenResponse(data);
}

export async function crearLineaProducto(datos) {
  const data = await pedirJson(`${BASE_URL}/linea/crear`, {
    method: "POST",
    body: CrearLineaProductoRequest(datos)
  });

  return LineaProductoAdminItem(data);
}

export async function editarLineaProducto(idProducto, origen) {
  const data = await pedirJson(`${BASE_URL}/linea/editar`, {
    method: "PATCH",
    body: EditarLineaProductoRequest(idProducto, origen)
  });

  return LineaProductoAdminItem(data);
}

export async function cambiarEstadoLineaProducto(idProducto, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/linea/estado`, {
    method: "PATCH",
    body: CambiarEstadoTipoRequest(idProducto, activo, motivo)
  });

  return CambiarEstadoTipoResponse(data);
}

export async function crearPresentacionProducto(idProducto, fila) {
  const data = await pedirJson(`${BASE_URL}/presentacion/crear`, {
    method: "POST",
    body: CrearPresentacionRequest(idProducto, fila)
  });

  return LineaProductoAdminItem(data);
}

export async function cambiarEstadoPresentacionProducto(idPresentacion, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/presentacion/estado`, {
    method: "PATCH",
    body: CambiarEstadoTipoRequest(idPresentacion, activo, motivo)
  });

  return CambiarEstadoTipoResponse(data);
}
