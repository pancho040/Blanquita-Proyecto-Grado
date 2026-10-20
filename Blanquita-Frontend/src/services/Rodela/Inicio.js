import { InicioRodelaResponse } from "@/models/Rodela/Inicio";
import { pedirJson } from "@/utils/api";

export async function verInicioRodela() {
  const data = await pedirJson("/api/rodela/inicio/resumen");
  return InicioRodelaResponse(data);
}
