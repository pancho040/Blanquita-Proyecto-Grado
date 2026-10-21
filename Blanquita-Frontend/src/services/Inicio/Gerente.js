import { InicioGerenteResponse } from "@/models/Inicio/Gerente";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/gerente/inicio";

export async function verInicioGerente(periodo) {
  const data = await pedirJson(`${BASE_URL}/${periodo}/resumen`);
  return InicioGerenteResponse(data);
}
