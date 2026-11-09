import { manejarErrorBackend } from "@/utils/validators";

export async function ObtenerInventarioSucursal(sucursalId = 1) {
  const response = await fetch(`/api/logistica/inventario/sucursal/${sucursalId}`);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerInventarioChofer(choferId) {
  const response = await fetch(`/api/logistica/inventario/chofer/${choferId}`);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export const ListarInventarioChofer = ObtenerInventarioChofer;

export async function CargarChofer(dto) {
  const response = await fetch("/api/logistica/inventario/cargar-chofer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}

export async function ObtenerReporteInventarioValorizado(sucursalId = 1, fechaCorte = null) {
  let url = `/api/logistica/inventario/reportes/valorizado?sucursal_id=${sucursalId}`;
  if (fechaCorte) {
    url += `&fecha_corte=${encodeURIComponent(fechaCorte)}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    await manejarErrorBackend(response);
  }
  return await response.json();
}
