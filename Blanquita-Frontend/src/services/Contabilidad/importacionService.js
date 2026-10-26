import { manejarErrorBackend } from "@/utils/validators";

function prepararOpciones(file) {
  if (file instanceof File) {
    const formData = new FormData();
    formData.append("archivo", file);
    return {
      method: "POST",
      body: formData,
    };
  } else if (file instanceof FormData) {
    return {
      method: "POST",
      body: file,
    };
  }
  return {
    method: "POST",
  };
}

export async function ImportarFlujoCaja(file = null) {
  const res = await fetch("/api/contabilidad/importar/flujo-caja", prepararOpciones(file));
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ImportarNotasVenta(file = null) {
  const res = await fetch("/api/contabilidad/importar/notas-venta", prepararOpciones(file));
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ImportarCuentasCobrar(file = null) {
  const res = await fetch("/api/contabilidad/importar/cuentas-cobrar", prepararOpciones(file));
  if (!res.ok) await manejarErrorBackend(res);
  return await res.json();
}

export async function ImportarProveedores(file = null) {
  const res = await fetch("/api/contabilidad/importar/proveedores", prepararOpciones(file));
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
