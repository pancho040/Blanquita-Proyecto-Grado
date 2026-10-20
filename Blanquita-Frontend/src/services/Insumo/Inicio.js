import { InicioInsumoResponse } from "@/models/Insumo/Inicio";
import { pedirJson } from "@/utils/api";

export async function verInicioInsumo() {
  const data = await pedirJson("/api/insumo/inicio/resumen");
  return InicioInsumoResponse(data);
}
