import NetInfo from "@react-native-community/netinfo";
import { syncService } from "./syncService";

/**
 * Servicio de Auto-Sincronización en Segundo Plano (Offline-First)
 * Unificado con syncService para garantizar una sola sincronización a la vez,
 * respeto de candados, watchdog y orden FIFO estricto.
 */

export const runSyncIfConnected = async (onSyncSuccess = null) => {
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.isInternetReachable === false) {
      return;
    }

    const resultado = await syncService.procesarCola();
    if (resultado && resultado.procesadas > 0 && onSyncSuccess) {
      onSyncSuccess(resultado);
    }
  } catch (err) {
    console.log("[AutoSync] Sincronización en background aplazada:", err.message);
  }
};

/**
 * Hook / Listener para ejecutar en segundo plano durante la vida de la app
 */
export const iniciarAutoSync = (onSyncChange = null) => {
  let wasConnected = null;

  // Intento inicial
  runSyncIfConnected(onSyncChange);

  // Escuchar reconexión
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isNowConnected = Boolean(state.isConnected && state.isInternetReachable !== false);

    if (isNowConnected && wasConnected === false) {
      runSyncIfConnected(onSyncChange);
    }

    wasConnected = isNowConnected;
  });

  return unsubscribe;
};

export default {
  runSyncIfConnected,
  iniciarAutoSync,
};
