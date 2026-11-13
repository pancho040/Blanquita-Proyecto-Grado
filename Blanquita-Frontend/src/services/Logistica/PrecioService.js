import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

export async function ObtenerPrecios(idSucursal = null) {
  const query = idSucursal && idSucursal !== "todas" ? `?id_sucursal=${encodeURIComponent(idSucursal)}` : "";
  const url = `/api/logistica/precios${query}`;
  const response = await fetchConCache(url, {}, 30000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function GuardarPrecio(precio) {
  const rawSid = precio?.IdSucursal != null ? precio.IdSucursal : precio?.id_sucursal;
  const sid = rawSid != null && rawSid !== "" && rawSid !== "todas" ? Number(rawSid) : null;
  const query = sid != null ? `?sucursal=${sid}&id_sucursal=${sid}` : "";
  const bodyData = sid != null ? { ...precio, IdSucursal: sid, id_sucursal: sid } : { ...precio };
  const response = await fetch(`/api/logistica/precios${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyData),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  invalidarCache("/api/logistica/precios");
  return await response.json();
}

export async function ObtenerHistorialPrecios(idPresentacion, idSucursal = null) {
  const query = idSucursal && idSucursal !== "todas" ? `?id_sucursal=${encodeURIComponent(idSucursal)}` : "";
  const url = `/api/logistica/precios/${idPresentacion}/historial${query}`;
  const response = await fetchConCache(url, {}, 10000);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}
