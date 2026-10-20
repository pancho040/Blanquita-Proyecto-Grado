import {
  InicioInventarioProductoTerminadoResponse,
  InicioProduccionProductoTerminadoResponse,
  InicioSalidasProductoTerminadoResponse,
} from "@/models/Inventario/Inicio";
import { pedirJson } from "@/utils/api";

const BASE_URL = "/api/productofinal/inicio";

export async function verInicioInventarioProducto() {
  const data = await pedirJson(`${BASE_URL}/inventario/resumen`);
  return InicioInventarioProductoTerminadoResponse(data);
}

export async function verInicioProduccionProducto() {
  const data = await pedirJson(`${BASE_URL}/produccion/resumen`);
  return InicioProduccionProductoTerminadoResponse(data);
}

export async function verInicioSalidasProducto() {
  const data = await pedirJson(`${BASE_URL}/salidas/resumen`);
  return InicioSalidasProductoTerminadoResponse(data);
}
