import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { syncService } from "../services/syncService";
import { SyncQueue } from "../database/syncQueue";
import apiClient from "../api/client";
import { LogisticaApi } from "../api/logisticaApi";
import { LocalDB } from "../database/localDb";

const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState("unknown");
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState("");
  const [actualizandoDatos, setActualizandoDatos] = useState(false);

  const wasConnectedRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const tiempoMontajeRef = useRef(Date.now());

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
    // Cero Polling: Solo dispara cuando isOnline pasa a true y SyncQueue.contarPendientes() > 0 con debounce de 2 segundos.
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      setConnectionType(state.type || "unknown");

      if (online && wasConnectedRef.current === false) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(async () => {
          const cant = await SyncQueue.contarPendientes();
          if (cant > 0) {
            console.log(`[NetworkContext] Red reestablecida (offline -> online). Disparando sincronización de ${cant} pendientes...`);
            await syncService.procesarCola();
          }
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

    // 3. Disparador: Volver a primer plano (AppState inactive/background -> active con cooldown de 3s al montar)
    // Cero Polling: Solo dispara si hay operaciones pendientes en cola
    const subscriptionAppState = AppState.addEventListener("change", (nextAppState) => {
      const tiempoDesdeMontaje = Date.now() - tiempoMontajeRef.current;
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        if (tiempoDesdeMontaje < 3000) {
          appStateRef.current = nextAppState;
          return;
        }
        refrescarPendientes().then((cant) => {
          if (cant > 0) {
            console.log(`[NetworkContext] App en primer plano. Sincronizando ${cant} pendientes...`);
            syncService.procesarCola();
          }
        });
      }
      appStateRef.current = nextAppState;
    });

    // 4. Disparador inicial al abrir la app: Solo si hay pendientes en cola
    const timerInicial = setTimeout(() => {
      refrescarPendientes().then((cant) => {
        if (cant > 0) {
          syncService.procesarCola();
        }
      });
    }, 1500);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      clearTimeout(timerInicial);
      unsubscribeNetInfo();
      unsubscribeSync();
      if (subscriptionAppState?.remove) {
        subscriptionAppState.remove();
      }
    };
  }, [refrescarPendientes]);

  // Actualización bajo demanda (Cero Polling de lectura para Plan Gratuito)
  // Consulta GET /api/movil/v1/chofer/resumen-sincronizacion con fallback a hoja de ruta + inventario
  const refrescarDatosServidor = useCallback(async () => {
    if (!isOnline) {
      return { exito: false, mensaje: "Sin conexión a internet disponible." };
    }
    setActualizandoDatos(true);
    try {
      let resumen = null;
      try {
        const resp = await apiClient.get("/api/movil/v1/chofer/resumen-sincronizacion", { timeout: 15000 });
        resumen = resp.data?.datos || resp.data;
      } catch (_err) {
        // Fallback si no está implementado aún en backend
      }

      // Cargar hoja de ruta e inventario bajo demanda y guardar en caché local
      const [hojaRutaRes, inventarioRes] = await Promise.allSettled([
        LogisticaApi.obtenerHojaRutaActiva(),
        LogisticaApi.obtenerMiInventarioCamion(),
      ]);

      if (hojaRutaRes.status === "fulfilled" && hojaRutaRes.value) {
        await LocalDB.guardarRutaActiva(hojaRutaRes.value);
      }
      if (inventarioRes.status === "fulfilled" && inventarioRes.value) {
        await LocalDB.guardarInventarioCamion(inventarioRes.value);
      }

      await refrescarPendientes();
      return {
        exito: true,
        resumen,
        hojaRuta: hojaRutaRes.status === "fulfilled" ? hojaRutaRes.value : null,
        inventario: inventarioRes.status === "fulfilled" ? inventarioRes.value : null,
      };
    } catch (err) {
      console.warn("[NetworkContext] Error actualizando datos bajo demanda:", err.message);
      return { exito: false, error: err.message };
    } finally {
      setActualizandoDatos(false);
    }
  }, [isOnline, refrescarPendientes]);

  // Forzar sincronización manual de la cola desde botón en la app
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
        actualizandoDatos,
        refrescarDatosServidor,
        actualizarBajoDemanda: refrescarDatosServidor,
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
