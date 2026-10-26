import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../constants/Config";

/**
 * Cola de Sincronización Asíncrona (Outbox Pattern)
 * Implementa HU-27 (Modo Offline) y HU-28 (Sincronización Automática Cifrada)
 * Almacena operaciones en local y las transmite secuencialmente al volver la red
 */
export const SyncQueue = {
  // Generar ID único para cada transacción
  generarIdUnico() {
    return `trx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    return cola.length;
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
      const nuevaOperacion = {
        id: this.generarIdUnico(),
        tipo,
        payload,
        gps: gps || {
          latitud: 0,
          longitud: 0,
          precision: 0,
          fechaHora: new Date().toISOString(),
        },
        fechaCreacion: new Date().toISOString(),
        intentos: 0,
        ultimoError: null,
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

  // Incrementar intento y guardar error si falló el envío
  async registrarFalloOperacion(idOperacion, errorMensaje) {
    try {
      const cola = await this.obtenerCola();
      const actualizada = cola.map((item) => {
        if (item.id === idOperacion) {
          return {
            ...item,
            intentos: (item.intentos || 0) + 1,
            ultimoError: String(errorMensaje),
            ultimoIntento: new Date().toISOString(),
          };
        }
        return item;
      });
      await this.guardarCola(actualizada);
    } catch (e) {
      console.error("Error registrando fallo en operación:", e);
    }
  },

  // Limpiar toda la cola (en caso de reseteo manual de emergencia)
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
