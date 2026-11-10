/**
 * Contexto y utilidades de Sucursal por Usuario
 * Gestiona el alcance territorial (Sucre, Potosí o Multisede General).
 */

export const SUCURSALES_DISPONIBLES = [
  { id: 1, nombre: "Sucursal Central Sucre", ciudad: "Sucre" },
  { id: 2, nombre: "Sucursal Potosí", ciudad: "Potosí" }
];

/**
 * Determina si el usuario tiene perfil General / Multisede y puede conmutar entre sucursales.
 * Los usuarios específicos de sede (ej. cajero o chofer de Sucre) están bloqueados a su sucursal.
 */
export function esUsuarioGeneral(usuario) {
  if (!usuario) return true;
  if (usuario.IsAdmin) return true;
  if (Number(usuario.IdRol) === 3) return true; // Gerente General
  // Si explícitamente se configuró como multisede (null, 0 o "todas")
  if (
    usuario.IdSucursal === null ||
    usuario.IdSucursal === undefined ||
    usuario.IdSucursal === 0 ||
    usuario.IdSucursal === "todas"
  ) {
    return true;
  }
  return false;
}

/**
 * Obtiene la sucursal activa para el usuario.
 * Si el usuario es de sede fija (ej. 1 Sucre o 2 Potosí), devuelve inmutablemente esa sede.
 * Si es usuario General, devuelve la sucursal seleccionada en el conmutador global.
 */
export function obtenerSucursalActiva(usuario) {
  // 1. Si el usuario pertenece a una sucursal específica, SIEMPRE manda su sucursal
  if (!esUsuarioGeneral(usuario) && usuario?.IdSucursal) {
    return Number(usuario.IdSucursal);
  }

  // 2. Si es usuario General, respetar la elección del conmutador superior
  if (typeof window !== "undefined") {
    try {
      const guardada = localStorage.getItem("blanquita_sucursal_activa");
      if (guardada) {
        return guardada === "todas" ? "todas" : Number(guardada);
      }
    } catch {
      /* noop */
    }
  }

  return 1; // Default Sucre
}

/**
 * Nombre descriptivo de la sucursal
 */
export function obtenerNombreSucursal(id) {
  if (!id || id === "todas" || id === "0" || id === 0) {
    return "Todas las Sedes (Consolidado)";
  }
  const s = SUCURSALES_DISPONIBLES.find((item) => String(item.id) === String(id));
  return s ? s.nombre : `Sucursal #${id}`;
}

/**
 * Cambia la sucursal activa globalmente (Solo permitido para usuarios Generales/Admin)
 */
export function cambiarSucursalActiva(nuevaSucursalId) {
  if (typeof window === "undefined") return;
  const valor = String(nuevaSucursalId);
  localStorage.setItem("blanquita_sucursal_activa", valor);
  window.dispatchEvent(
    new CustomEvent("sucursal_cambiada", {
      detail: { sucursalId: valor }
    })
  );
}
