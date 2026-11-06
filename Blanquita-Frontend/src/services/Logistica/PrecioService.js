import { manejarErrorBackend } from "@/utils/validators";
import { fetchConCache, invalidarCache } from "@/lib/api-cache";

export async function ObtenerPrecios() {
  const response = await fetchConCache("/api/logistica/precios", {}, 45000);
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
