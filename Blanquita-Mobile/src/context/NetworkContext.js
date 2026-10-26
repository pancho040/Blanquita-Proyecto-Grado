import React, { createContext, useContext, useState, useEffect } from "react";
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

  // Actualizar conteo de pendientes de la cola offline
  const refrescarPendientes = async () => {
    try {
      const total = await SyncQueue.contarPendientes();
      setPendientes(total);
    } catch {}
  };

  useEffect(() => {
    refrescarPendientes();

    // 1. Monitorear estado de la red (HU-28)
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      setConnectionType(state.type || "unknown");

      // Si se recuperó la conexión, disparar sincronización automática
      if (online) {
        console.log("[NetworkContext] Red reestablecida. Disparando sincronización automática...");
        syncService.procesarCola();
      }
    });

    // 2. Suscribirse a eventos de SyncService
    const unsubscribeSync = syncService.suscribir((estado) => {
      setSincronizando(Boolean(estado.enProgreso));
      if (estado.mensaje) setMensajeSync(estado.mensaje);
      if (typeof estado.pendientes === "number") setPendientes(estado.pendientes);
      else refrescarPendientes();
    });

    return () => {
      unsubscribeNetInfo();
      unsubscribeSync();
    };
  }, []);

  // Forzar sincronización manual desde botón en la app
  const sincronizarAhora = async () => {
    if (!isOnline) {
      return { exito: false, mensaje: "Sin conexión a internet disponible." };
    }
    return await syncService.procesarCola(true);
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
