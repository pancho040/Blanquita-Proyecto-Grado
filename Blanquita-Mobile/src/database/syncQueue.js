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

  // Obtener todas las operaciones encoladas (opcionalmente filtradas por usuarioId)
  async obtenerCola(usuarioId = null) {
    try {
      const raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_COLA);
      const items = raw ? JSON.parse(raw) : [];
      if (usuarioId !== null && usuarioId !== undefined) {
        return items.filter(
          (item) => item.id_usuario === undefined || item.id_usuario === null || item.id_usuario === usuarioId
        );
      }
      return items;
    } catch (e) {
      console.error("Error leyendo cola de sincronización:", e);
      return [];
    }
  },

  // Alias para la pantalla de sincronización
  async obtenerPendientes(usuarioId = null) {
    return await this.obtenerCola(usuarioId);
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

  // Obtener la cantidad de operaciones pendientes (filtradas por usuarioId si se indica)
  async contarPendientes(usuarioId = null) {
    const cola = await this.obtenerCola(usuarioId);
    return cola.filter((item) => item.estado === "pendiente de sincronizar").length;
  },

  // Obtener operaciones pendientes que involucran dinero (cobros, entregas con pago)
  async obtenerPendientesConDinero(usuarioId = null) {
    const cola = await this.obtenerCola(usuarioId);
    return cola.filter((item) =>
      item.estado === "pendiente de sincronizar" &&
      (item.tipo === "COBRO" || (item.payload && (item.payload.monto || item.payload.montoCobrado || item.payload.monto_efectivo || item.payload.monto_qr)))
    );
  },

  /**
   * Resumen detallado de dinero en cola para cierre de sesión (Punto 6).
   * Desglosa operaciones reintentables vs errores 4xx no reintentables.
   */
  async obtenerResumenDineroPendiente(usuarioId = null) {
    const cola = await this.obtenerCola(usuarioId);
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
   * @param {string} tipo - "ENTREGA" | "COBRO" | "ENTREGA_CON_COBRO" | "NUEVO_CLIENTE" | "CIERRE_RUTA" | "PING_GPS"
   * @param {object} payload - Datos de la operación
   * @param {object} gps - { latitud, longitud, precision, fechaHora } (HU-33)
   * @param {number|null} usuarioId - ID del chofer autenticado que realiza la acción
   */
  async encolarOperacion(tipo, payload, gps = null, usuarioId = null) {
    try {
      const cola = await this.obtenerCola(); // toda la lista para persistir
      const idempotencyKey = this.generarUuidV4();
      const nuevaOperacion = {
        id: idempotencyKey,
        idempotencyKey,
        tipo,
        payload,
        id_usuario: usuarioId || payload?.id_usuario || payload?.chofer_id || null,
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
  // Requisito Subagente B: Un 401 durante la sync pausa la cola; no cuenta como error del ítem ni lo descarta.
  async registrarFalloOperacion(idOperacion, error) {
    try {
      const cola = await this.obtenerCola();
      const status = error?.response?.status || error?.status;
      const esError401 = status === 401 || String(error?.message).toLowerCase().includes("token expirado");
      const esError4xx = typeof status === "number" && status >= 400 && status < 500 && !esError401;
      const mensaje = error?.friendlyMessage || error?.message || String(error);

      const actualizada = cola.map((item) => {
        if (item.id === idOperacion) {
          return {
            ...item,
            // Si es 401 no penaliza intentos del item
            intentos: esError401 ? (item.intentos || 0) : (item.intentos || 0) + 1,
            ultimoError: mensaje,
            ultimoIntento: new Date().toISOString(),
            // Si es 4xx de validación de negocio, se marca permanente; 401 y 5xx/red NO son permanentes
            esErrorPermanente: esError401 ? false : esError4xx,
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

  // Limpiar cola (opcionalmente solo de un usuario específico)
  async limpiarCola(usuarioId = null) {
    try {
      if (usuarioId !== null && usuarioId !== undefined) {
        const cola = await this.obtenerCola();
        const preservadas = cola.filter((item) => item.id_usuario && item.id_usuario !== usuarioId);
        await this.guardarCola(preservadas);
      } else {
        await AsyncStorage.removeItem(CONFIG.SYNC.CLAVE_STORAGE_COLA);
      }
      return true;
    } catch (e) {
      console.error("Error limpiando cola:", e);
      return false;
    }
  },
};
