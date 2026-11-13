import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { AppState, Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { NotificacionesApi } from "../api/notificacionesApi";
import { useAuth } from "./AuthContext";
import { wsService } from "../services/wsService";
import { LogisticaApi } from "../api/logisticaApi";
import { LocalDB } from "../database/localDb";
import { SyncQueue } from "../database/syncQueue";
import apiClient, { getTokenEnMemoria } from "../api/client";

const NotificacionesContext = createContext(null);

export function NotificacionesProvider({ children, navigationRef }) {
  const { user, usuario, token } = useAuth();
  const sesionActiva = Boolean(user || usuario);

  const [notificaciones, setNotificaciones] = useState([]);
  const [conteoNoLeidas, setConteoNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const peticionEnVueloRef = useRef(null);
  const wasConnectedRef = useRef(null);

  // Cargar notificaciones bajo demanda (Cero Polling recurrente para Plan Gratuito)
  const sincronizarNotificaciones = useCallback(async () => {
    if (!sesionActiva) return [];

    if (peticionEnVueloRef.current) {
      return peticionEnVueloRef.current;
    }

    setCargando(true);
    peticionEnVueloRef.current = (async () => {
      try {
        const items = await NotificacionesApi.obtenerNotificaciones({ soloNoLeidas: false });
        const listado = Array.isArray(items) ? items : [];
        setNotificaciones(listado);
        const noLeidas = listado.filter((n) => !n.leido).length;
        setConteoNoLeidas(noLeidas);
        return listado;
      } catch (_err) {
        return [];
      } finally {
        setCargando(false);
        peticionEnVueloRef.current = null;
      }
    })();

    return peticionEnVueloRef.current;
  }, [sesionActiva]);

  // Refrescar estado local tras eventos WebSocket en tiempo real
  const refrescarEstadoLocalDesdeWS = useCallback(async (tipoEvento) => {
    try {
      if (tipoEvento === "carga_camion_aprobada") {
        const inv = await LogisticaApi.obtenerMiInventarioCamion();
        if (inv) await LocalDB.guardarInventarioCamion(inv);
      } else {
        const [ruta, inv] = await Promise.allSettled([
          LogisticaApi.obtenerHojaRutaActiva(),
          LogisticaApi.obtenerMiInventarioCamion(),
        ]);
        if (ruta.status === "fulfilled" && ruta.value) {
          await LocalDB.guardarRutaActiva(ruta.value);
        }
        if (inv.status === "fulfilled" && inv.value) {
          await LocalDB.guardarInventarioCamion(inv.value);
        }
      }
      console.log(`[NotificacionesContext] Estado local actualizado tras evento WebSocket: ${tipoEvento}`);
    } catch (err) {
      console.warn(`[NotificacionesContext] Error refrescando estado local tras ${tipoEvento}:`, err.message);
    }
  }, []);

  // Agregar notificación instantánea y emitir alerta/banner
  const registrarAvisoPush = useCallback(
    async (titulo, mensaje, tipo, metadata = {}) => {
      const nuevaNotif = {
        id: `ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        titulo,
        mensaje,
        tipo: (tipo || "AVISO_ADMIN").toUpperCase(),
        leido: false,
        fecha_creacion: new Date().toISOString(),
        codigo_referencia: metadata.codigo_referencia || metadata.id_asignacion || null,
        ...metadata,
      };

      setNotificaciones((prev) => [nuevaNotif, ...prev]);
      setConteoNoLeidas((c) => c + 1);

      // Banner / Alerta accesible en pantalla
      Alert.alert(titulo, mensaje);

      // Refresco de datos operativos sin requerir recarga manual
      await refrescarEstadoLocalDesdeWS(tipo);
    },
    [refrescarEstadoLocalDesdeWS]
  );

  // Atender solicitud de telemetría puntual emitida desde el panel Web (HU-30 / Task 3)
  const atenderSolicitudUbicacionActual = useCallback(
    async (data) => {
      console.log("[NotificacionesContext] Petición de ubicación satelital puntual recibida por WebSocket:", data);
      try {
        let gpsData = null;

        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 3000,
            });
            gpsData = {
              latitud: Number(pos.coords.latitude.toFixed(6)),
              longitud: Number(pos.coords.longitude.toFixed(6)),
              precision: Math.round(pos.coords.accuracy || 10),
              velocidad: Math.max(0, Math.round((pos.coords.speed || 0) * 3.6)),
            };
          }
        } catch (_e) {
          try {
            const ultimaPos = await Location.getLastKnownPositionAsync();
            if (ultimaPos) {
              gpsData = {
                latitud: Number(ultimaPos.coords.latitude.toFixed(6)),
                longitud: Number(ultimaPos.coords.longitude.toFixed(6)),
                precision: Math.round(ultimaPos.coords.accuracy || 15),
                velocidad: 0,
              };
            }
          } catch (_e2) {}
        }

        if (!gpsData) {
          gpsData = { latitud: -19.0435, longitud: -65.258, precision: 20, velocidad: 0 };
        }

        const idChofer = usuario?.IdUsuario || usuario?.id_usuario || user?.IdUsuario;
        const payload = {
          IdUsuarioRepartidor: idChofer,
          IdAsignacion: data?.id_asignacion || null,
          Latitud: gpsData.latitud,
          Longitud: gpsData.longitud,
          PrecisionMts: gpsData.precision,
          VelocidadKmh: gpsData.velocidad,
          FechaHora: new Date().toISOString(),
        };

        const netState = await NetInfo.fetch();
        if (netState.isConnected && netState.isInternetReachable !== false) {
          try {
            await apiClient.post("/logistica/telemetria/ping", payload, { timeout: 8000 });
            console.log("[NotificacionesContext] Ping puntual enviado a /logistica/telemetria/ping exitosamente.");
            return;
          } catch (errPing) {
            console.log("[NotificacionesContext] Fallo enviando ping puntual, guardando en local:", errPing.message);
          }
        }

        // Si no hay red o falló el envío directo, almacenar en la cola local para enviarse al reconectar
        await SyncQueue.encolarOperacion("PING_GPS", payload, gpsData, idChofer);
        console.log("[NotificacionesContext] Coordenada puntual encolada en local para reintento automático.");
      } catch (err) {
        console.warn("[NotificacionesContext] Error procesando solicitar_ubicacion_actual:", err.message);
      }
    },
    [usuario, user]
  );

  // 1. Carga inicial al activar sesión (Cero Polling periódico)
  useEffect(() => {
    if (sesionActiva) {
      sincronizarNotificaciones();
    } else {
      setNotificaciones([]);
      setConteoNoLeidas(0);
    }
  }, [sesionActiva, sincronizarNotificaciones]);

  // 2. Refresco solo al volver a primer plano (AppState)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        sesionActiva
      ) {
        sincronizarNotificaciones();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [sesionActiva, sincronizarNotificaciones]);

  // 3. Refresco en transición sin conexión -> con conexión (NetInfo)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isNowConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (isNowConnected && wasConnectedRef.current === false && sesionActiva) {
        sincronizarNotificaciones();
      }
      wasConnectedRef.current = isNowConnected;
    });

    return () => {
      unsubscribe();
    };
  }, [sesionActiva, sincronizarNotificaciones]);

  // 4. Conexión WebSocket y gestión de eventos en tiempo real
  useEffect(() => {
    if (!sesionActiva) {
      wsService.desconectar();
      return;
    }

    const tokenActual = token || getTokenEnMemoria();
    if (tokenActual) {
      wsService.conectar(tokenActual);
    }

    // Suscripción a eventos requeridos
    const unsubs = [
      wsService.on("ruta_asignada", (d) => {
        registrarAvisoPush(
          "Nueva Ruta Asignada",
          d?.mensaje || "Se te ha asignado una nueva hoja de ruta.",
          "ruta_asignada",
          d
        );
      }),

      wsService.on("carga_camion_aprobada", (d) => {
        registrarAvisoPush(
          "Carga Aprobada",
          d?.mensaje || "La carga de tu camión ha sido verificada y aprobada.",
          "carga_camion_aprobada",
          d
        );
      }),

      wsService.on("ruta_reordenada", (d) => {
        registrarAvisoPush(
          "Ruta Reordenada",
          d?.mensaje || "El orden de entrega de las paradas ha sido actualizado.",
          "ruta_reordenada",
          d
        );
      }),

      wsService.on("operacion_revisada", (d) => {
        registrarAvisoPush(
          "Operación Revisada",
          d?.mensaje || "Una entrega o cobro fue revisada por supervisión.",
          "operacion_revisada",
          d
        );
      }),

      wsService.on("ruta_finalizada_admin", (d) => {
        registrarAvisoPush(
          "Ruta Finalizada",
          d?.mensaje || "Tu ruta de reparto ha sido cerrada por el administrador.",
          "ruta_finalizada_admin",
          d
        );
      }),

      wsService.on("solicitar_ubicacion_actual", (d) => {
        atenderSolicitudUbicacionActual(d);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [sesionActiva, token, registrarAvisoPush, atenderSolicitudUbicacionActual]);

  /**
   * Al tocar un aviso: se marca leído con PATCH y navega a la pantalla/parada relevante.
   */
  const manejarPresionarAviso = async (notificacion, navigation) => {
    try {
      if (!notificacion.leido) {
        await NotificacionesApi.marcarComoLeida(notificacion.id).catch(() => {});
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === notificacion.id ? { ...n, leido: true } : n))
        );
        setConteoNoLeidas((c) => Math.max(0, c - 1));
      }

      const nav = navigation || navigationRef?.current;
      if (!nav) return;

      const tipoUpper = (notificacion.tipo || "").toUpperCase();
      switch (tipoUpper) {
        case "RUTA_ASIGNADA":
        case "RECORDATORIO_CIERRE":
        case "AVISO_ADMIN":
        case "RUTA_REORDENADA":
        case "RUTA_FINALIZADA_ADMIN":
          nav.navigate("HojaRutaTab");
          break;
        case "AJUSTE_NOTA":
        case "CAMBIO_PRECIO":
        case "STOCK_ACTUALIZADO":
        case "OPERACION_REVISADA":
          if (notificacion.codigo_referencia) {
            nav.navigate("DetalleParada", { paradaId: notificacion.codigo_referencia });
          } else {
            nav.navigate("HojaRutaTab");
          }
          break;
        case "CARGA_CAMION_APROBADA":
          nav.navigate("MiInventarioTab");
          break;
        case "ABONO_APROBADO":
        case "ABONO_RECHAZADO":
        case "FALTANTE_CIERRE":
          nav.navigate("CierreRutaTab");
          break;
        default:
          nav.navigate("HojaRutaTab");
          break;
      }
    } catch (err) {
      console.warn("[Notificaciones] Error al marcar o navegar aviso:", err.message);
    }
  };

  return (
    <NotificacionesContext.Provider
      value={{
        notificaciones,
        conteoNoLeidas,
        cargando,
        refrescarNotificaciones: sincronizarNotificaciones,
        manejarPresionarAviso,
      }}
    >
      {children}
    </NotificacionesContext.Provider>
  );
}

export function useNotificaciones() {
  const ctx = useContext(NotificacionesContext);
  if (!ctx) {
    throw new Error("useNotificaciones debe usarse dentro de NotificacionesProvider");
  }
  return ctx;
}
