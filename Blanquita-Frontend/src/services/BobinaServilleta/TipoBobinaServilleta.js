import {
  TipoBobinaServilletaAdminItem,
  FormatoSubBobinaResponse,
  CrearTipoBobinaServilletaRequest,
  EditarTipoBobinaServilletaRequest
} from "@/models/BobinaServilleta/TipoBobinaServilleta";
import {
  ListarTiposResponse,
  ProductoDisponible,
  CambiarEstadoTipoRequest,
  CambiarEstadoTipoResponse
} from "@/models/MateriaPrima/TipoMateriaPrima";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/bobinaservilleta/tipo";

export async function listarTiposBobinaServilleta(filtros) {
  const data = await pedirJson(`${BASE_URL}/listar`);

  return ListarTiposResponse(
    data.map(TipoBobinaServilletaAdminItem),
    filtros,
    (t) => t.NombreTipoBobinaServilleta
  );
}

export async function obtenerTipoBobinaServilleta(idTipoBobinaServilleta) {
  const data = await pedirJson(`${BASE_URL}/listar`);
  const tipo = data.find((t) => t.IdTipoBobinaServilleta === idTipoBobinaServilleta);
  if (!tipo) throw new Error("El tipo de bobina servilleta no existe");

  return TipoBobinaServilletaAdminItem(tipo);
}

export async function obtenerFormatosTipoBobinaServilleta() {
  const data = await pedirJson(`${BASE_URL}/formatos`);

  return data.map(FormatoSubBobinaResponse);
}

export async function obtenerProductosTipoBobinaServilleta() {
  const data = await pedirJson(`${BASE_URL}/productos`);

  return data.map(ProductoDisponible);
}

export async function crearTipoBobinaServilleta(datos) {
  const data = await pedirJson(`${BASE_URL}/crear`, {
    method: "POST",
    body: CrearTipoBobinaServilletaRequest(datos)
  });

  return TipoBobinaServilletaAdminItem(data);
}

export async function editarTipoBobinaServilleta(idTipoBobinaServilleta, datos) {
  const data = await pedirJson(`${BASE_URL}/editar`, {
    method: "PATCH",
    body: EditarTipoBobinaServilletaRequest(idTipoBobinaServilleta, datos)
  });

  return TipoBobinaServilletaAdminItem(data);
}

export async function cambiarEstadoTipoBobinaServilleta(idTipoBobinaServilleta, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/estado`, {
    method: "PATCH",
    body: CambiarEstadoTipoRequest(idTipoBobinaServilleta, activo, motivo)
  });

  return CambiarEstadoTipoResponse(data);
}
