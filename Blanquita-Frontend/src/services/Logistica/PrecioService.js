import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

export async function ObtenerPrecios(idSucursal = 1) {
  const url = `/api/logistica/precios?id_sucursal=${idSucursal}`;
  const response = await fetchConCache(url, {}, 30000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function GuardarPrecio(precio) {
  const response = await fetch("/api/logistica/precios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(precio),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica/precios");
  return await response.json();
}

export async function ObtenerHistorialPrecios(idPresentacion, idSucursal = 1) {
  const url = `/api/logistica/precios/${idPresentacion}/historial?id_sucursal=${idSucursal}`;
  const response = await fetchConCache(url, {}, 10000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}
