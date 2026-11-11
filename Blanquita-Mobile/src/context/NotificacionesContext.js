import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { NotificacionesApi } from "../api/notificacionesApi";
import { useAuth } from "./AuthContext";

const NotificacionesContext = createContext(null);

const INTERVALO_BASE_MS = 60 * 1000; // 60s
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutos (300s)

export function NotificacionesProvider({ children, navigationRef }) {
  const { user, usuario } = useAuth();
  const sesionActiva = Boolean(user || usuario);

  const [notificaciones, setNotificaciones] = useState([]);
  const [conteoNoLeidas, setConteoNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);

  const backoffIntervalMs = useRef(INTERVALO_BASE_MS);
  const timerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const sincronizarNotificaciones = useCallback(async () => {
    if (!sesionActiva) return;

    setCargando(true);
    try {
      const items = await NotificacionesApi.obtenerNotificaciones({ soloNoLeidas: false });
      setNotificaciones(items);
      const noLeidas = items.filter((n) => !n.leido).length;
      setConteoNoLeidas(noLeidas);
      // Éxito: restablecer intervalo base
      backoffIntervalMs.current = INTERVALO_BASE_MS;
    } catch (_err) {
      // Fallo de red / servidor: backoff exponencial (60s -> 120s -> 240s -> 300s)
      backoffIntervalMs.current = Math.min(backoffIntervalMs.current * 2, MAX_BACKOFF_MS);
    } finally {
      setCargando(false);
      reiniciarTimer();
    }
  }, [sesionActiva]);

  const reiniciarTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!sesionActiva) return;

    timerRef.current = setTimeout(() => {
      sincronizarNotificaciones();
    }, backoffIntervalMs.current);
  }, [sesionActiva, sincronizarNotificaciones]);

  // 1. Polling al montar o cambiar de usuario
  useEffect(() => {
    if (sesionActiva) {
      sincronizarNotificaciones();
    } else {
      setNotificaciones([]);
      setConteoNoLeidas(0);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sesionActiva, sincronizarNotificaciones]);

  // 2. Polling al volver a primer plano (AppState change)
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

  // 3. Polling al recuperar conexión (NetInfo)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && sesionActiva) {
        sincronizarNotificaciones();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sesionActiva, sincronizarNotificaciones]);

  /**
   * Al tocar un aviso: se marca leído con PATCH y navega a la pantalla/parada relevante.
   */
  const manejarPresionarAviso = async (notificacion, navigation) => {
    try {
      if (!notificacion.leido) {
        await NotificacionesApi.marcarComoLeida(notificacion.id);
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === notificacion.id ? { ...n, leido: true } : n))
        );
        setConteoNoLeidas((c) => Math.max(0, c - 1));
      }

      // Navegación según el tipo de notificación del catálogo oficial de 8 eventos
      const nav = navigation || navigationRef?.current;
      if (!nav) return;

      switch (notificacion.tipo) {
        case "RUTA_ASIGNADA":
        case "RECORDATORIO_CIERRE":
        case "AVISO_ADMIN":
          nav.navigate("HojaRutaTab");
          break;
        case "AJUSTE_NOTA":
        case "CAMBIO_PRECIO":
        case "STOCK_ACTUALIZADO":
          if (notificacion.codigo_referencia) {
            nav.navigate("DetalleParada", { paradaId: notificacion.codigo_referencia });
          } else {
            nav.navigate("HojaRutaTab");
          }
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
