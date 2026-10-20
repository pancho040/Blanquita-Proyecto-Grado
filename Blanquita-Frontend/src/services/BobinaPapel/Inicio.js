import { InicioBobinaPapelResponse } from "@/models/BobinaPapel/Inicio";
import { pedirJson } from "@/utils/api";

export async function verInicioBobinaPapel() {
  const data = await pedirJson("/api/papelbobina/inicio/resumen");
  return InicioBobinaPapelResponse(data);
}
