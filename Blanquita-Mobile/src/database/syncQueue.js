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
      let raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_COLA);
      if (!raw) {
        raw = await AsyncStorage.getItem("@blanquita_sync_queue");
      }
      let items = raw ? JSON.parse(raw) : [];
      let huboCambios = false;

      // Migración automática general de ítems con error de validación:
      // Cualquier ítem con error 4xx de negocio pasa a 'REQUIERE_CORRECCION'
      // para permitir al chofer abrirlos, corregir cantidades o cobro y reenviarlos.
      items = items.map((item) => {
        const esItemRequiereCorreccion =
          item.estado === "error_validacion" ||
          (item.esErrorPermanente && item.estado !== "REQUIERE_CORRECCION") ||
          (typeof item.status === "number" && item.status >= 400 && item.status < 500 && item.status !== 401 && item.estado !== "REQUIERE_CORRECCION");

        if (esItemRequiereCorreccion) {
          huboCambios = true;
          return {
            ...item,
            estado: "REQUIERE_CORRECCION",
            esErrorPermanente: true,
            ultimoError: item.ultimoError || "La operación requiere corrección antes de sincronizar.",
          };
        }
        return item;
      });

      if (huboCambios) {
        await AsyncStorage.setItem(CONFIG.SYNC.CLAVE_STORAGE_COLA, JSON.stringify(items));
      }

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

  // Registrar fallo distinguiendo 4xx (no reintentable / requiere corrección) de 5xx/red (reintentable)
  // Requisito Subagente B y Fase 3: Un 401 durante la sync pausa la cola; no cuenta como error del ítem ni lo descarta.
  async registrarFalloOperacion(idOperacion, error) {
    try {
      const cola = await this.obtenerCola();
      const status = error?.status || error?.response?.status;
      const mensaje =
        error?.friendlyMessage ||
        error?.message ||
        (typeof error?.serverDetail?.mensaje === "string" ? error.serverDetail.mensaje : null) ||
        (typeof error?.serverDetail?.detail === "string" ? error.serverDetail.detail : null) ||
        String(error);
      const msgLower = String(mensaje).toLowerCase();
      const esError401 = status === 401 || msgLower.includes("token expirado") || msgLower.includes("sesión expirada");
      const esError4xx = typeof status === "number" && status >= 400 && status < 500 && !esError401;

      const actualizada = cola.map((item) => {
        if (item.id === idOperacion) {
          return {
            ...item,
            // Si es 401 no penaliza intentos del item
            intentos: esError401 ? (item.intentos || 0) : (item.intentos || 0) + 1,
            ultimoError: mensaje,
            ultimoIntento: new Date().toISOString(),
            codigoError: error?.codigo || error?.serverDetail?.codigo || null,
            detalleError: error?.serverDetail || null,
            // Si es 4xx de validación de negocio, se marca permanente y en estado REQUIERE_CORRECCION
            esErrorPermanente: esError401 ? false : esError4xx,
            estado: esError4xx ? "REQUIERE_CORRECCION" : "pendiente de sincronizar",
          };
        }
        return item;
      });
      await this.guardarCola(actualizada);
    } catch (e) {
      console.error("Error registrando fallo en operación:", e);
    }
  },

  /**
   * Actualizar una operación existente en cola (por ejemplo tras corrección en formulario)
   * Conserva el MISMO id e idempotencyKey para garantizar idempotencia transaccional.
   */
  async actualizarOperacion(idOperacion, payloadActualizado, nuevoEstado = "pendiente de sincronizar") {
    try {
      const cola = await this.obtenerCola();
      let encontrada = false;
      const actualizada = cola.map((item) => {
        if (item.id === idOperacion || item.idempotencyKey === idOperacion) {
          encontrada = true;
          return {
            ...item,
            payload: {
              ...(item.payload || {}),
              ...payloadActualizado,
            },
            estado: nuevoEstado,
            esErrorPermanente: false,
            intentos: 0,
            ultimoError: null,
            codigoError: null,
            detalleError: null,
            fechaActualizacion: new Date().toISOString(),
          };
        }
        return item;
      });

      if (!encontrada) {
        console.warn(`[SyncQueue] Operación ${idOperacion} no encontrada para actualizar.`);
        return false;
      }

      await this.guardarCola(actualizada);
      return true;
    } catch (e) {
      console.error("Error actualizando operación en cola:", e);
      return false;
    }
  },

  // Marcar explícitamente una operación como REQUIERE_CORRECCION
  async marcarOperacionRequiereCorreccion(idOperacion, detalleError = {}) {
    return await this.registrarFalloOperacion(idOperacion, {
      status: 422,
      friendlyMessage: detalleError.mensaje || detalleError.message || "Requiere corrección de datos",
      serverDetail: detalleError,
    });
  },

  // Resetear estado de error para forzar reintento manual (Subagente C)
  async resetearErrorOperacion(idOperacion) {
    try {
      const cola = await this.obtenerCola();
      const actualizada = cola.map((item) => {
        if (item.id === idOperacion) {
          return {
            ...item,
            intentos: 0,
            esErrorPermanente: false,
            estado: "pendiente de sincronizar",
            ultimoError: null,
          };
        }
        return item;
      });
      await this.guardarCola(actualizada);
      return true;
    } catch (e) {
      console.error("Error reseteando error de operación:", e);
      return false;
    }
  },

  // Resetear todos los errores permanentes de la cola
  async resetearTodosLosErrores(usuarioId = null) {
    try {
      const cola = await this.obtenerCola();
      const actualizada = cola.map((item) => {
        if (usuarioId === null || usuarioId === undefined || item.id_usuario === usuarioId) {
          return {
            ...item,
            esErrorPermanente: false,
            estado: "pendiente de sincronizar",
          };
        }
        return item;
      });
      await this.guardarCola(actualizada);
      return true;
    } catch (e) {
      console.error("Error reseteando errores de la cola:", e);
      return false;
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
