/**
/**
 * Helper Central de API y Manejo de Sucursales
 * Inyecta sucursal, gestiona cancelación de peticiones en vuelo y normaliza errores 400/403/404.
 */

import { getSnapshot } from "@/stores/branchStore";

/**
 * Añade la sucursal activa a un objeto de parámetros de consulta (query params).
 * Si la sucursal activa es "todas", no añade el filtro para permitir la vista consolidada nacional.
 */
export function conSucursal(params = {}, sucursalPersonalizada = null) {
  const snap = getSnapshot();
  const sucursal = sucursalPersonalizada !== null ? sucursalPersonalizada : snap.sucursalActiva;

  const resultado = { ...params };
  if (sucursal && sucursal !== "todas") {
    resultado.id_sucursal = Number(sucursal);
  }
  return resultado;
}

/**
 * Añade el parámetro de sucursal directamente a una URL o path de string.
 */
export function urlConSucursal(urlBase, sucursalPersonalizada = null) {
  const snap = getSnapshot();
  const sucursal = sucursalPersonalizada !== null ? sucursalPersonalizada : snap.sucursalActiva;
  if (!sucursal || sucursal === "todas") return urlBase;

  const separador = urlBase.includes("?") ? "&" : "?";
  return `${urlBase}${separador}id_sucursal=${encodeURIComponent(sucursal)}`;
}

/**
 * Administrador de peticiones cancelables para evitar mezclar datos
 * cuando el usuario conmuta rápidamente entre sucursales.
 */
export class GestorPeticionCancelable {
  constructor() {
    this.controladorActual = null;
  }

  nuevoSignal() {
    if (this.controladorActual) {
      try {
        this.controladorActual.abort("Cambio de sucursal o nueva consulta solicitada");
      } catch {
        /* noop */
      }
    }
    this.controladorActual = new AbortController();
    return this.controladorActual.signal;
  }

  cancelar() {
    if (this.controladorActual) {
      try {
        this.controladorActual.abort("Cancelación manual");
      } catch {
        /* noop */
      }
      this.controladorActual = null;
    }
  }
}

/**
 * Traduce y formatea los códigos de error de seguridad de sucursal (400, 403, 404).
 */
export function interpretarErrorSucursal(error) {
  const status = error?.status || error?.response?.status;
  const detail = error?.response?.data?.detail || error?.message || "";

  if (status === 400) {
    if (detail.toLowerCase().includes("sucursal")) {
      return detail;
    }
    return "Debe seleccionar una sucursal específica para realizar esta operación.";
  }

  if (status === 403) {
    if (detail.toLowerCase().includes("sucursal") || detail.toLowerCase().includes("autorización")) {
      return detail;
    }
    return "Acceso denegado: no tiene autorización para operar o consultar datos en esta sucursal.";
  }

  if (status === 404) {
    if (detail.toLowerCase().includes("no encontrad")) {
      return detail;
    }
    return "El registro solicitado no existe o no pertenece a la sucursal autorizada.";
  }

  return detail || "Ocurrió un error inesperado al consultar los datos.";
}
