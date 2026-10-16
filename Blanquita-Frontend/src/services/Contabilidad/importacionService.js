import { manejarErrorBackend } from "@/utils/validators";

export async function ImportarFlujoCaja() {
  const res = await fetch("/api/contabilidad/importar/flujo-caja", {
    method: "POST",
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ImportarNotasVenta() {
  const res = await fetch("/api/contabilidad/importar/notas-venta", {
    method: "POST",
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ImportarCuentasCobrar() {
  const res = await fetch("/api/contabilidad/importar/cuentas-cobrar", {
    method: "POST",
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ImportarProveedores() {
  const res = await fetch("/api/contabilidad/importar/proveedores", {
    method: "POST",
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ImportarTodasLasTablas() {
  const res = await fetch("/api/contabilidad/importar/todas", {
    method: "POST",
  });
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}
