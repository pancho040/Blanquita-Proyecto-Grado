import {
  FormatoSubBobinaAdminItem,
  CrearFormatoSubBobinaRequest
} from "@/models/BobinaServilleta/FormatoSubBobina";
import {
  CambiarEstadoTipoRequest,
  CambiarEstadoTipoResponse
} from "@/models/MateriaPrima/TipoMateriaPrima";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/bobinaservilleta/formato";

export async function listarFormatosSubBobina() {
  const data = await pedirJson(`${BASE_URL}/listar`);

  return data.map(FormatoSubBobinaAdminItem);
}

export async function crearFormatoSubBobina(filas) {
  const data = await pedirJson(`${BASE_URL}/crear`, {
    method: "POST",
    body: CrearFormatoSubBobinaRequest(filas)
  });

  return FormatoSubBobinaAdminItem(data);
}

export async function cambiarEstadoFormatoSubBobina(idFormatoSubBobina, activo, motivo) {
  const data = await pedirJson(`${BASE_URL}/estado`, {
    method: "PATCH",
    body: CambiarEstadoTipoRequest(idFormatoSubBobina, activo, motivo)
  });

  return CambiarEstadoTipoResponse(data);
}
