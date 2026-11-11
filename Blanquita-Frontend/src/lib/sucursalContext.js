/**
 * Adaptador de Compatibilidad para Sucursal por Usuario
 * Redirige todas las operaciones al store centralizado 'branchStore.js'
 * eliminando almacenamiento local persistente entre pestañas y eventos obsoletos.
 */

import {
  SUCURSALES_CATALOGO,
  getSnapshot,
  cambiarSucursalActiva as cambiarEnStore
} from "@/stores/branchStore";

export const SUCURSALES_DISPONIBLES = SUCURSALES_CATALOGO;

/**
 * Determina si el usuario tiene permiso multisede explícito.
 * Fallo cerrado: no confía en IsAdmin, sino en permisos de sucursal.
 */
export function esUsuarioGeneral(usuario) {
  if (!usuario) return false;
  if (usuario.puede_ver_todas === true) return true;
  if (usuario.PermisosSucursal?.some((p) => p.puede_ver_todas)) return true;
  if (usuario.permisos_sucursales?.some((p) => p.puede_ver_todas)) return true;
  return false;
}

/**
 * Obtiene la sucursal activa desde el store centralizado.
 */
export function obtenerSucursalActiva(usuario = null) {
  const snap = getSnapshot();
  if (usuario && !snap.puedeVerTodas && usuario.IdSucursal) {
    return Number(usuario.IdSucursal);
  }
  return snap.sucursalActiva === "todas" ? "todas" : Number(snap.sucursalActiva);
}

/**
 * Nombre descriptivo de la sucursal
 */
export function obtenerNombreSucursal(id) {
  if (!id || id === "todas" || id === "0" || id === 0) {
    return "Todas las Sedes (Consolidado)";
  }
  const s = SUCURSALES_CATALOGO.find((item) => String(item.id) === String(id));
  return s ? s.nombre : `Sucursal #${id}`;
}

/**
 * Cambia la sucursal activa actualizando el store único (sin localStorage ni eventos ad-hoc).
 */
export function cambiarSucursalActiva(nuevaSucursalId) {
  cambiarEnStore(nuevaSucursalId);
}
