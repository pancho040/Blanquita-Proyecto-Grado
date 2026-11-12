import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { syncService } from "../services/syncService";
import { SyncQueue } from "../database/syncQueue";

const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState("unknown");
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState("");

  const wasConnectedRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Actualizar conteo de pendientes de la cola offline
  const refrescarPendientes = useCallback(async () => {
    try {
      const total = await SyncQueue.contarPendientes();
      setPendientes(total);
      return total;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    refrescarPendientes();

    // 1. Monitorear estado de la red (HU-28 / Subagente C)
    // Solo dispara en la transición estricta de sin conexión -> con conexión, con debounce de 2 segundos.
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      setConnectionType(state.type || "unknown");

      if (online && wasConnectedRef.current === false) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(async () => {
          console.log("[NetworkContext] Red reestablecida (offline -> online). Disparando sincronización con debounce de 2s...");
          await syncService.procesarCola();
        }, 2000);
      }

      wasConnectedRef.current = online;
    });

    // 2. Suscribirse a eventos de SyncService para feedback en tiempo real
    const unsubscribeSync = syncService.suscribir((estado) => {
      setSincronizando(Boolean(estado.enProgreso));
      if (estado.mensaje) setMensajeSync(estado.mensaje);
      if (typeof estado.pendientes === "number") setPendientes(estado.pendientes);
      else refrescarPendientes();
    });

    // 3. Disparador: Volver a primer plano (AppState inactive/background -> active)
    const subscriptionAppState = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log("[NetworkContext] App en primer plano. Verificando pendientes para sincronizar...");
        refrescarPendientes().then((cant) => {
          if (cant > 0) {
            syncService.procesarCola();
          }
        });
      }
      appStateRef.current = nextAppState;
    });

    // 4. Disparador inicial al abrir la app
    const timerInicial = setTimeout(() => {
      refrescarPendientes().then((cant) => {
        if (cant > 0) {
          syncService.procesarCola();
        }
      });
    }, 1500);

    // 5. Disparador periódico cada 60s mientras haya pendientes
    const intervalPeriodico = setInterval(async () => {
      const cant = await refrescarPendientes();
      if (cant > 0) {
        const net = await NetInfo.fetch();
        if (net.isConnected && net.isInternetReachable !== false) {
          console.log(`[NetworkContext] Ciclo 60s: procesando ${cant} operaciones pendientes...`);
          syncService.procesarCola();
        }
      }
    }, 60000);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      clearTimeout(timerInicial);
      clearInterval(intervalPeriodico);
      unsubscribeNetInfo();
      unsubscribeSync();
      if (subscriptionAppState?.remove) {
        subscriptionAppState.remove();
      }
    };
  }, [refrescarPendientes]);

  // Forzar sincronización manual desde botón en la app
  const sincronizarAhora = async () => {
    if (!isOnline) {
      return { exito: false, mensaje: "Sin conexión a internet disponible." };
    }
    const res = await syncService.procesarCola(true);
    await refrescarPendientes();
    return res;
  };

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        connectionType,
        pendientes,
        sincronizando,
        syncInProgress: sincronizando,
        mensajeSync,
        sincronizarAhora,
        forzarSincronizacion: sincronizarAhora,
        refrescarPendientes,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork debe usarse dentro de un NetworkProvider");
  }
  return context;
}
