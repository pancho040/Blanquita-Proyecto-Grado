import { InicioEmpaqueResponse } from "@/models/Empaque/Inicio";
import { pedirJson } from "@/utils/api";

export async function verInicioEmpaque(clase) {
  const data = await pedirJson(`/api/empaque/inicio/${clase}/resumen`);
  return InicioEmpaqueResponse(data);
}
