import { manejarErrorBackend } from "@/utils/validators";

export async function ObtenerPrecios() {
  const response = await fetch("/api/logistica/precios");
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
  return await response.json();
}
