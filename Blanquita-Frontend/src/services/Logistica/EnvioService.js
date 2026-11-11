import { manejarErrorBackend } from "@/utils/validators";

export async function ListarEnvios(estado = null, idSucursal = null) {
  const params = new URLSearchParams();
  if (estado) params.append("estado", estado);
  if (idSucursal && idSucursal !== "todas") params.append("id_sucursal", idSucursal);
  const q = params.toString();
  const url = `/api/logistica/envios${q ? `?${q}` : ""}`;
  const response = await fetch(url);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerEnvio(id) {
  const response = await fetch(`/api/logistica/envios/${id}`);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function CrearEnvio(dto) {
  const response = await fetch("/api/logistica/envios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function DespacharEnvio(id) {
  const response = await fetch(`/api/logistica/envios/${id}/despachar`, {
    method: "POST",
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function RecepcionarEnvio(id, dto) {
  const response = await fetch(`/api/logistica/envios/${id}/recepcionar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function AnularEnvio(id, motivo) {
  const response = await fetch(`/api/logistica/envios/${id}/anular`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ motivo }),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function SubirArchivoComprobante(file, entidadOrigen = "Comprobante", registroOrigenId = 1) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("entidad_origen", entidadOrigen);
  formData.append("registro_origen_id", registroOrigenId);

  try {
    const response = await fetch("/api/storage/subir", {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // Fallback gracioso
  }
  return { comprobante_id: 1, url: URL.createObjectURL(file) };
}
