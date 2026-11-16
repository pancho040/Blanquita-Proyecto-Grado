/**
 * Gestor Centralizado y Atómico de Modales de Logística
 * Garantiza que SOLO UN modal principal esté activo a la vez en la pantalla.
 * Previene la apertura concurrente o solapada de modales desde eventos o deep links.
 */

// Tipos de modales soportados
export const MODAL_TIPOS = {
  DETALLE_RUTA: "DETALLE_RUTA",             // ExpedienteChoferModal (Auditoría, entregas, cobros)
  APROBAR_CARGA: "APROBAR_CARGA",           // BandejaSolicitudCargaModal (Revisión de carga)
  REASIGNAR_RUTA: "REASIGNAR_RUTA",         // ModalReasignarRuta
  EDITOR_PARADAS: "EDITOR_PARADAS",         // EditorParadasDinamicoModal
  STOCK_CAMION: "STOCK_CAMION",             // ModalStockCamion
  HOJA_RUTA: "HOJA_RUTA"                    // HojaDeRutaModal
};

let estadoActual = {
  modalActivo: null, // null o uno de MODAL_TIPOS
  datos: null        // payload/contexto del modal activo
};

const listeners = new Set();

function notificar() {
  listeners.forEach((fn) => {
    try {
      fn({ ...estadoActual });
    } catch (e) {
      console.warn("[modalesLogisticaStore] Error en listener:", e);
    }
  });
}

/**
 * Abre un modal de forma exclusiva, cerrando automáticamente cualquier otro.
 * @param {string} tipo - Uno de MODAL_TIPOS
 * @param {object} datos - Contexto (asignacion, chofer, tab, focoId, etc.)
 */
export function abrirModalExclusivo(tipo, datos = {}) {
  estadoActual = {
    modalActivo: tipo,
    datos: { ...datos }
  };
  notificar();
}

/**
 * Cierra el modal activo actual.
 */
export function cerrarModalActivo() {
  estadoActual = {
    modalActivo: null,
    datos: null
  };
  notificar();
}

/**
 * Obtiene el estado actual del gestor.
 */
export function obtenerEstadoModales() {
  return { ...estadoActual };
}

/**
 * Suscribe un componente al cambio de modales activos.
 * @param {Function} callback 
 * @returns {Function} Desuscriptor
 */
export function suscribirModalesLogistica(callback) {
  listeners.add(callback);
  callback({ ...estadoActual });
  return () => {
    listeners.delete(callback);
  };
}
