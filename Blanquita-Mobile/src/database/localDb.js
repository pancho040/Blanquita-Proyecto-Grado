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
  // INVENTARIO EN CAMIÓN Y REVALORIZACIÓN (FASE 2)
  // -------------------------------------------------------------
  async guardarInventarioCamion(inventario) {
    try {
      const payload = {
        ...inventario,
        fechaGuardado: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        CONFIG.SYNC.CLAVE_STORAGE_INVENTARIO || "@blanquita_inventario_camion",
        JSON.stringify(payload)
      );
      return true;
    } catch (e) {
      console.error("Error guardando inventario en camión:", e);
      return false;
    }
  },

  async obtenerInventarioCamion() {
    try {
      const raw = await AsyncStorage.getItem(
        CONFIG.SYNC.CLAVE_STORAGE_INVENTARIO || "@blanquita_inventario_camion"
      );
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Error leyendo inventario en camión:", e);
      return null;
    }
  },

  async descontarInventarioCamion(itemsEntregados = []) {
    try {
      const inv = await this.obtenerInventarioCamion();
      if (!inv || !Array.isArray(inv.items)) return false;

      const itemsActualizados = inv.items.map((itemCamion) => {
        const idPresentacionCamion = itemCamion.presentacion_id || itemCamion.IdPresentacion || itemCamion.id;
        const entregado = itemsEntregados.find(
          (it) => (it.presentacion_id || it.IdPresentacion || it.id) === idPresentacionCamion
        );
        if (entregado) {
          const cantEntregada = Number(entregado.cantidad || entregado.Cantidad || 0);
          const saldoPrevio = Number(itemCamion.saldo_camion ?? itemCamion.cantidad_disponible ?? itemCamion.cantidad ?? 0);
          const nuevoSaldo = Math.max(0, saldoPrevio - cantEntregada);
          const nuevoEntregado = Number(itemCamion.total_entregado || 0) + cantEntregada;
          return {
            ...itemCamion,
            saldo_camion: nuevoSaldo,
            cantidad_disponible: nuevoSaldo,
            total_entregado: nuevoEntregado,
          };
        }
        return itemCamion;
      });

      const totalEntregados = itemsActualizados.reduce((acc, it) => acc + Number(it.total_entregado || 0), 0);
      const totalSaldo = itemsActualizados.reduce((acc, it) => acc + Number(it.saldo_camion || 0), 0);

      const invActualizado = {
        ...inv,
        items: itemsActualizados,
        total_bultos_entregados: totalEntregados,
        total_saldo_camion: totalSaldo,
      };

      await this.guardarInventarioCamion(invActualizado);
      return true;
    } catch (e) {
      console.error("Error descontando inventario en camión:", e);
      return false;
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

  // -------------------------------------------------------------
  // REGISTRO DE ÚLTIMA SINCRONIZACIÓN EXITOSA
  // -------------------------------------------------------------
  async guardarUltimaSincronizacion(fechaIso = null) {
    try {
      const fecha = fechaIso || new Date().toISOString();
      await AsyncStorage.setItem("@blanquita_ultima_sync_exitosa", fecha);
      return fecha;
    } catch (_e) {
      return null;
    }
  },

  async obtenerUltimaSincronizacion() {
    try {
      return await AsyncStorage.getItem("@blanquita_ultima_sync_exitosa");
    } catch (_e) {
      return null;
    }
  },

  // -------------------------------------------------------------
  // SELLO LOCAL DE SOLICITUD DE CARGA (SUBAGENTE A - PERSISTENCIA Y BLOQUEO)
  // -------------------------------------------------------------
  async guardarSelloSolicitudCarga(idAsignacion, datos = {}) {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const clave = `@blanquita_sello_solicitud_carga_${idAsignacion || "activa"}`;
      const payload = {
        idAsignacion: idAsignacion || "activa",
        estado_operativo: "CARGA_SOLICITADA",
        fecha_solicitud: datos?.fecha_solicitud || new Date().toISOString(),
        fecha_dia: hoy,
        items_solicitados: datos?.items_solicitados || datos?.items || [],
        usar_remanente: Boolean(datos?.usar_remanente ?? datos?.usarRemanente),
        observacion: datos?.observacion || "",
      };
      await AsyncStorage.setItem(clave, JSON.stringify(payload));
      return payload;
    } catch (e) {
      console.error("Error guardando sello de solicitud de carga local:", e);
      return null;
    }
  },

  async obtenerSelloSolicitudCarga(idAsignacion) {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      let clave = `@blanquita_sello_solicitud_carga_${idAsignacion || "activa"}`;
      let raw = await AsyncStorage.getItem(clave);
      if (!raw && idAsignacion && idAsignacion !== "activa") {
        clave = "@blanquita_sello_solicitud_carga_activa";
        raw = await AsyncStorage.getItem(clave);
      }
      if (!raw) return null;
      const sello = JSON.parse(raw);
      if (sello.fecha_dia && sello.fecha_dia !== hoy) {
        await AsyncStorage.removeItem(clave);
        return null;
      }
      return sello;
    } catch (e) {
      console.error("Error leyendo sello de solicitud de carga local:", e);
      return null;
    }
  },

  async limpiarSelloSolicitudCarga(idAsignacion) {
    try {
      if (idAsignacion && idAsignacion !== "activa") {
        await AsyncStorage.removeItem(`@blanquita_sello_solicitud_carga_${idAsignacion}`);
      }
      await AsyncStorage.removeItem("@blanquita_sello_solicitud_carga_activa");
      return true;
    } catch (e) {
      console.error("Error eliminando sello de solicitud de carga local:", e);
      return false;
    }
  },

  // -------------------------------------------------------------
  // SELLO LOCAL DE CARGA APROBADA (SUBAGENTE A - BLINDAJE RUTA APROBADA)
  // -------------------------------------------------------------
  async guardarSelloCargaAprobada(idAsignacion, datosAprobacion = {}) {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const clave = `@blanquita_sello_carga_aprobada_${idAsignacion || "activa"}`;
      const payload = {
        idAsignacion: idAsignacion || "activa",
        estado_operativo: "APROBADA_EN_RUTA",
        fecha_aprobacion: datosAprobacion?.fecha_aprobacion || new Date().toISOString(),
        fecha_dia: hoy,
        datos: datosAprobacion || {},
      };
      await AsyncStorage.setItem(clave, JSON.stringify(payload));
      return payload;
    } catch (e) {
      console.error("Error guardando sello de carga aprobada local:", e);
      return null;
    }
  },

  async obtenerSelloCargaAprobada(idAsignacion) {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      let clave = `@blanquita_sello_carga_aprobada_${idAsignacion || "activa"}`;
      let raw = await AsyncStorage.getItem(clave);
      if (!raw && idAsignacion && idAsignacion !== "activa") {
        clave = "@blanquita_sello_carga_aprobada_activa";
        raw = await AsyncStorage.getItem(clave);
      }
      if (!raw) return null;
      const sello = JSON.parse(raw);
      if (sello.fecha_dia && sello.fecha_dia !== hoy) {
        await AsyncStorage.removeItem(clave);
        return null;
      }
      return sello;
    } catch (e) {
      console.error("Error leyendo sello de carga aprobada local:", e);
      return null;
    }
  },

  async limpiarSelloCargaAprobada(idAsignacion) {
    try {
      if (idAsignacion && idAsignacion !== "activa") {
        await AsyncStorage.removeItem(`@blanquita_sello_carga_aprobada_${idAsignacion}`);
      }
      await AsyncStorage.removeItem("@blanquita_sello_carga_aprobada_activa");
      return true;
    } catch (e) {
      console.error("Error eliminando sello de carga aprobada local:", e);
      return false;
    }
  },

  // -------------------------------------------------------------
  // NOTIFICACIONES AISLADAS POR USUARIO (SUBAGENTE B)
  // Clave aislada: @blanquita_notificaciones_{usuarioId}
  // -------------------------------------------------------------
  async guardarNotificacionesLocales(usuarioId, notificaciones = []) {
    try {
      if (!usuarioId) return false;
      const clave = `@blanquita_notificaciones_${usuarioId}`;
      const payload = {
        usuarioId,
        items: Array.isArray(notificaciones) ? notificaciones : [],
        ultimaActualizacion: new Date().toISOString(),
      };
      await AsyncStorage.setItem(clave, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error("Error guardando notificaciones locales:", e);
      return false;
    }
  },

  async obtenerNotificacionesLocales(usuarioId) {
    try {
      if (!usuarioId) return [];
      const clave = `@blanquita_notificaciones_${usuarioId}`;
      const raw = await AsyncStorage.getItem(clave);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch (e) {
      console.error("Error leyendo notificaciones locales:", e);
      return [];
    }
  },

  async limpiarNotificacionesLocales(usuarioId) {
    try {
      if (!usuarioId) return false;
      const clave = `@blanquita_notificaciones_${usuarioId}`;
      await AsyncStorage.removeItem(clave);
      return true;
    } catch (e) {
      console.error("Error eliminando notificaciones locales:", e);
      return false;
    }
  },

  // Limpiar toda la base local (excepto cola de sincronización si tuviera pendientes)
  async limpiarTodo() {
    try {
      const sesion = await this.obtenerSesion();
      const uid = sesion?.usuario?.IdUsuario || sesion?.usuario?.id_usuario;
      if (uid) {
        await this.limpiarNotificacionesLocales(uid);
      }
      await this.limpiarSelloSolicitudCarga();
      await this.limpiarSelloCargaAprobada();
      await AsyncStorage.multiRemove([
        CONFIG.SYNC.CLAVE_STORAGE_SESION,
        CONFIG.SYNC.CLAVE_STORAGE_RUTA,
        CONFIG.SYNC.CLAVE_STORAGE_CLIENTES,
        CONFIG.SYNC.CLAVE_STORAGE_PRODUCTOS,
        CONFIG.SYNC.CLAVE_STORAGE_INVENTARIO || "@blanquita_inventario_camion",
        CONFIG.SYNC.CLAVE_STORAGE_LIQUIDACION,
      ]);
      return true;
    } catch (e) {
      console.error("Error limpiando almacenamiento local:", e);
      return false;
    }
  },
};
