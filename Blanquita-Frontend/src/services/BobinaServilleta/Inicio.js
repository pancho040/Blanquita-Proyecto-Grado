import { InicioBobinaServilletaResponse } from "@/models/BobinaServilleta/Inicio";
import { pedirJson } from "@/utils/api";

export async function verInicioBobinaServilleta() {
  const data = await pedirJson("/api/bobinaservilleta/inicio/resumen");
  return InicioBobinaServilletaResponse(data);
}
