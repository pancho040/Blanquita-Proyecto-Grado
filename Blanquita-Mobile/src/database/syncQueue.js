import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../constants/Config";

/**
 * Cola de Sincronización Asíncrona (Outbox Pattern con Idempotencia)
 * Implementa HU-27 (Modo Offline) y HU-28 (Sincronización Automática Cifrada)
 * Almacena operaciones en local con claves UUID v4 y las transmite secuencialmente al volver la red.
 */
export const SyncQueue = {
  // Generar clave UUID v4 estándar RFC 4122 para Idempotencia Transaccional
  generarUuidV4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  // Obtener todas las operaciones encoladas pendientes
  async obtenerCola() {
    try {
      const raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_COLA);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Error leyendo cola de sincronización:", e);
      return [];
    }
  },

  // Guardar la cola completa
  async guardarCola(cola) {
    try {
      await AsyncStorage.setItem(CONFIG.SYNC.CLAVE_STORAGE_COLA, JSON.stringify(cola));
      return true;
    } catch (e) {
      console.error("Error guardando cola de sincronización:", e);
      return false;
    }
  },

  // Obtener la cantidad de operaciones pendientes
  async contarPendientes() {
    const cola = await this.obtenerCola();
    return cola.filter((item) => item.estado === "pendiente de sincronizar").length;
  },

  // Obtener operaciones pendientes que involucran dinero (cobros, entregas con pago)
  async obtenerPendientesConDinero() {
    const cola = await this.obtenerCola();
    return cola.filter((item) =>
      item.estado === "pendiente de sincronizar" &&
      (item.tipo === "COBRO" || (item.payload && (item.payload.monto || item.payload.montoCobrado || item.payload.monto_efectivo || item.payload.monto_qr)))
    );
  },

  /**
   * Resumen detallado de dinero en cola para cierre de sesión (Punto 6).
   * Desglosa operaciones reintentables vs errores 4xx no reintentables.
   */
  async obtenerResumenDineroPendiente() {
    const cola = await this.obtenerCola();
    const operacionesDinero = cola.filter((item) =>
      item.tipo === "COBRO" ||
      (item.payload && (
        item.payload.monto ||
        item.payload.montoCobrado ||
        item.payload.monto_efectivo ||
        item.payload.monto_qr
      ))
    );

    let totalBs = 0;
    const reintentables = [];
    const noReintentables4xx = [];

    for (const op of operacionesDinero) {
      const monto = Number(
        op.payload?.monto ||
        op.payload?.montoCobrado ||
        op.payload?.monto_efectivo ||
        op.payload?.monto_qr ||
        0
      );

      const itemResumen = {
        id: op.id,
        tipo: op.tipo,
        monto: isNaN(monto) ? 0 : monto,
        cliente: op.payload?.cliente || op.payload?.nombreCliente || `Operación #${(op.id || "").slice(0, 8)}`,
        esErrorPermanente: Boolean(op.esErrorPermanente),
        ultimoError: op.ultimoError || null,
      };

      if (op.esErrorPermanente) {
        noReintentables4xx.push(itemResumen);
      } else {
        reintentables.push(itemResumen);
        totalBs += itemResumen.monto;
      }
    }

    return {
      totalOperaciones: operacionesDinero.length,
      cantidadReintentables: reintentables.length,
      cantidadNoReintentables4xx: noReintentables4xx.length,
      totalDineroBs: totalBs,
      reintentables,
      noReintentables4xx,
      // Solo bloquea si hay dinero en operaciones reintentables; los 4xx no impiden logout
      bloqueoRequerido: reintentables.length > 0,
    };
  },

  /**
   * Encolar una nueva operación realizada en campo
   * @param {string} tipo - "ENTREGA" | "COBRO" | "NUEVO_CLIENTE" | "CIERRE_RUTA" | "PING_GPS"
   * @param {object} payload - Datos de la operación
   * @param {object} gps - { latitud, longitud, precision, fechaHora } (HU-33)
   */
  async encolarOperacion(tipo, payload, gps = null) {
    try {
      const cola = await this.obtenerCola();
      const idempotencyKey = this.generarUuidV4();
      const nuevaOperacion = {
        id: idempotencyKey,
        idempotencyKey,
        tipo,
        payload,
        estado: "pendiente de sincronizar", // Siempre se muestra pendiente hasta confirmación del servidor
        gps: gps || {
          latitud: 0,
          longitud: 0,
          precision: 0,
          fechaHora: new Date().toISOString(),
        },
        fechaCreacion: new Date().toISOString(),
        intentos: 0,
        ultimoError: null,
        esErrorPermanente: false,
      };

      cola.push(nuevaOperacion);
      await this.guardarCola(cola);
      return nuevaOperacion;
    } catch (e) {
      console.error("Error encolando operación:", e);
      throw e;
    }
  },

  // Eliminar una operación exitosa de la cola
  async removerOperacion(idOperacion) {
    try {
      const cola = await this.obtenerCola();
      const filtrada = cola.filter((item) => item.id !== idOperacion);
      await this.guardarCola(filtrada);
      return true;
    } catch (e) {
      console.error("Error removiendo operación sincronizada:", e);
      return false;
    }
  },

  // Registrar fallo distinguiendo 4xx (no reintentable) de 5xx/red (reintentable)
  async registrarFalloOperacion(idOperacion, error) {
    try {
      const cola = await this.obtenerCola();
      const status = error?.response?.status || error?.status;
      const esError4xx = typeof status === "number" && status >= 400 && status < 500;
      const mensaje = error?.friendlyMessage || error?.message || String(error);

      const actualizada = cola.map((item) => {
        if (item.id === idOperacion) {
          return {
            ...item,
            intentos: (item.intentos || 0) + 1,
            ultimoError: mensaje,
            ultimoIntento: new Date().toISOString(),
            // Si es 4xx (reglas de negocio, conflicto o datos inválidos), no se sigue reintentando en loop
            esErrorPermanente: esError4xx,
            estado: esError4xx ? "error_validacion" : "pendiente de sincronizar",
          };
        }
        return item;
      });
      await this.guardarCola(actualizada);
    } catch (e) {
      console.error("Error registrando fallo en operación:", e);
    }
  },

  // Limpiar toda la cola
  async limpiarCola() {
    try {
      await AsyncStorage.removeItem(CONFIG.SYNC.CLAVE_STORAGE_COLA);
      return true;
    } catch (e) {
      console.error("Error limpiando cola:", e);
      return false;
    }
  },
};
