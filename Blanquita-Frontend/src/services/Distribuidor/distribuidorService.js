import { manejarErrorBackend } from "@/utils/validators";

export async function ObtenerCatalogoStock() {
  const res = await fetch("/api/distribuidores/catalogo-stock");
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ListarDistribuidores(activo = null) {
  const url = activo !== null ? `/api/distribuidores?activo=${activo}` : "/api/distribuidores";
  const res = await fetch(url);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ListarPedidos(distribuidorId = null, estado = null) {
  const params = new URLSearchParams();
  if (distribuidorId) params.append("distribuidor_id", distribuidorId);
  if (estado) params.append("estado", estado);

  const res = await fetch(`/api/distribuidores/pedidos?${params.toString()}`);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ObtenerPedidoDetalle(pedidoId) {
  const res = await fetch(`/api/distribuidores/pedidos/${pedidoId}`);
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function CrearPedidoDistribuidor(datos) {
  const res = await fetch("/api/distribuidores/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function AjustarPedidoKevin(pedidoId, datosAjuste) {
  const res = await fetch(`/api/distribuidores/pedidos/${pedidoId}/ajuste-kevin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datosAjuste),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function SubirBoletaPago(pedidoId, idComprobanteArchivo) {
  const res = await fetch(`/api/distribuidores/pedidos/${pedidoId}/comprobante`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_comprobante_archivo: idComprobanteArchivo }),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function AprobarDespachoKevin(pedidoId, { observacion = "" } = {}) {
  const res = await fetch(`/api/distribuidores/pedidos/${pedidoId}/aprobar-despacho`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observacion }),
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}
