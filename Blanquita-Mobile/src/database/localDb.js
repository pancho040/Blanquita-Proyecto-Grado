import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../constants/Config";

/**
 * Base de Datos Local en Dispositivo Móvil
 * Soporta HU-27: Operar aplicación en modo offline
 * Permite persistir sesión, rutas, paradas, catálogo de precios y liquidación
 */
export const LocalDB = {
  // -------------------------------------------------------------
  // SESIÓN DEL CHOFER
  // -------------------------------------------------------------
  async guardarSesion(usuario, tokens) {
    try {
      const data = {
        usuario,
        tokens,
        fechaGuardado: new Date().toISOString(),
      };
      await AsyncStorage.setItem(CONFIG.SYNC.CLAVE_STORAGE_SESION, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("Error guardando sesión local:", e);
      return false;
    }
  },

  async obtenerSesion() {
    try {
      const raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_SESION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Error leyendo sesión local:", e);
      return null;
    }
  },

  async eliminarSesion() {
    try {
      await AsyncStorage.removeItem(CONFIG.SYNC.CLAVE_STORAGE_SESION);
      return true;
    } catch (e) {
      console.error("Error eliminando sesión local:", e);
      return false;
    }
  },

  // -------------------------------------------------------------
  // HOJA DE RUTA DIARIA (HU-30)
  // -------------------------------------------------------------
  async guardarRutaActiva(rutaData) {
    try {
      const payload = {
        ...rutaData,
        ultimaActualizacion: new Date().toISOString(),
      };
      await AsyncStorage.setItem(CONFIG.SYNC.CLAVE_STORAGE_RUTA, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error("Error guardando ruta activa local:", e);
      return false;
    }
  },

  async obtenerRutaActiva() {
    try {
      const raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_RUTA);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Error leyendo ruta activa local:", e);
      return null;
    }
  },

  async actualizarEstadoParada(idPuntoVenta, nuevoEstado, datosOperacion = {}) {
    try {
      const ruta = await this.obtenerRutaActiva();
      if (!ruta || !ruta.paradas) return false;

      const paradasActualizadas = ruta.paradas.map((p) => {
        if (p.IdPuntoVenta === idPuntoVenta || p.id === idPuntoVenta) {
          return {
            ...p,
            estado: nuevoEstado, // "ENTREGADO", "NO_ENTREGADO", "PENDIENTE"
            datosOperacion,
            fechaAtencion: new Date().toISOString(),
          };
        }
        return p;
      });

      ruta.paradas = paradasActualizadas;
      await this.guardarRutaActiva(ruta);
      return true;
    } catch (e) {
      console.error("Error actualizando estado de parada local:", e);
      return false;
    }
  },

  // -------------------------------------------------------------
  // CATÁLOGO DE PRODUCTOS Y PRECIOS VIGENTES
  // -------------------------------------------------------------
  async guardarProductos(productos) {
    try {
      await AsyncStorage.setItem(CONFIG.SYNC.CLAVE_STORAGE_PRODUCTOS, JSON.stringify(productos));
      return true;
    } catch (e) {
      console.error("Error guardando productos en caché:", e);
      return false;
    }
  },

  async obtenerProductos() {
    try {
      const raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_PRODUCTOS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Error leyendo productos en caché:", e);
      return [];
    }
  },

  // -------------------------------------------------------------
  // CLIENTES EN CACHÉ (HU-29)
  // -------------------------------------------------------------
  async guardarClientesCache(clientes) {
    try {
      await AsyncStorage.setItem(CONFIG.SYNC.CLAVE_STORAGE_CLIENTES, JSON.stringify(clientes));
      return true;
    } catch (e) {
      console.error("Error guardando clientes en caché:", e);
      return false;
    }
  },

  async obtenerClientesCache() {
    try {
      const raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_CLIENTES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Error leyendo clientes en caché:", e);
      return [];
    }
  },

  async agregarClienteLocal(nuevoCliente) {
    try {
      const clientes = await this.obtenerClientesCache();
      clientes.unshift(nuevoCliente);
      await this.guardarClientesCache(clientes);
      return true;
    } catch (e) {
      console.error("Error agregando cliente local:", e);
      return false;
    }
  },

  // -------------------------------------------------------------
  // LIQUIDACIÓN Y CIERRE DE RUTA (HU-34)
  // -------------------------------------------------------------
  async guardarLiquidacionLocal(liquidacion) {
    try {
      await AsyncStorage.setItem(CONFIG.SYNC.CLAVE_STORAGE_LIQUIDACION, JSON.stringify(liquidacion));
      return true;
    } catch (e) {
      console.error("Error guardando liquidación local:", e);
      return false;
    }
  },

  async obtenerLiquidacionLocal() {
    try {
      const raw = await AsyncStorage.getItem(CONFIG.SYNC.CLAVE_STORAGE_LIQUIDACION);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Error leyendo liquidación local:", e);
      return null;
    }
  },

  // Limpiar toda la base local (excepto cola de sincronización si tuviera pendientes)
  async limpiarTodo() {
    try {
      await AsyncStorage.multiRemove([
        CONFIG.SYNC.CLAVE_STORAGE_SESION,
        CONFIG.SYNC.CLAVE_STORAGE_RUTA,
        CONFIG.SYNC.CLAVE_STORAGE_CLIENTES,
        CONFIG.SYNC.CLAVE_STORAGE_PRODUCTOS,
        CONFIG.SYNC.CLAVE_STORAGE_LIQUIDACION,
      ]);
      return true;
    } catch (e) {
      console.error("Error limpiando almacenamiento local:", e);
      return false;
    }
  },
};
