/**
 * Store reactivo global para apertura del modal de aprobación de carga de camión.
 * Permite que NotificacionesBell, ToastLiveContainer o cualquier vista
 * abran el modal de aprobación de carga sin redirigir a Despachos.
 */

let estado = {
  abierto: false,
  idSolicitud: null,
  idAsignacion: null,
  solicitud: null,
  asignacion: null,
};

const suscriptores = new Set();

function notificar() {
  const copia = { ...estado };
  suscriptores.forEach((fn) => {
    try {
      fn(copia);
    } catch (e) {
      console.error("[aprobacionCargaStore] Error en suscriptor:", e);
    }
  });
}

/**
 * Abre el modal global de aprobación de carga.
 * @param {Object} params
 * @param {number|string} [params.idSolicitud]
 * @param {number|string} [params.idAsignacion]
 * @param {Object} [params.solicitud]
 * @param {Object} [params.asignacion]
 */
export function abrirAprobarCarga({ idSolicitud = null, idAsignacion = null, solicitud = null, asignacion = null } = {}) {
  estado = {
    abierto: true,
    idSolicitud: idSolicitud ?? solicitud?.id_solicitud ?? solicitud?.id ?? null,
    idAsignacion: idAsignacion ?? asignacion?.IdAsignacionRuta ?? solicitud?.id_asignacion ?? null,
    solicitud,
    asignacion,
  };
  notificar();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("blanquita:abrir-modal-aprobar-carga", {
        detail: { ...estado },
      })
    );
  }
}

/**
 * Cierra el modal global de aprobación de carga.
 */
export function cerrarAprobarCarga() {
  estado = {
    ...estado,
    abierto: false,
  };
  notificar();
}

/**
 * Suscribe un callback a los cambios de estado.
 * @param {Function} callback
 * @returns {Function} Desuscriptor
 */
export function suscribirAprobacionCarga(callback) {
  if (typeof callback !== "function") return () => {};
  suscriptores.add(callback);
  callback({ ...estado });
  return () => suscriptores.delete(callback);
}

/**
 * Retorna una copia del estado actual.
 */
export function obtenerEstadoAprobacionCarga() {
  return { ...estado };
}

// Escuchar evento personalizado en window para sincronización entre componentes
if (typeof window !== "undefined") {
  window.addEventListener("blanquita:abrir-modal-aprobar-carga", (e) => {
    const detail = e.detail || {};
    if (detail && !estado.abierto) {
      estado = {
        abierto: true,
        idSolicitud: detail.idSolicitud ?? detail.id_solicitud ?? null,
        idAsignacion: detail.idAsignacion ?? detail.id_asignacion ?? null,
        solicitud: detail.solicitud ?? null,
        asignacion: detail.asignacion ?? null,
      };
      notificar();
    }
  });
}

export default {
  abrirAprobarCarga,
  cerrarAprobarCarga,
  suscribirAprobacionCarga,
  obtenerEstadoAprobacionCarga,
};
