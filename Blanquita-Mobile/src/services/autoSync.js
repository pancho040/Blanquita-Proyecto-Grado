import NetInfo from "@react-native-community/netinfo";
import { SyncQueue } from "../database/syncQueue";
import { LogisticaApi } from "../api/logisticaApi";

/**
 * Servicio de Auto-Sincronización Silenciosa en Segundo Plano (Offline-First)
 * Inspirado en la arquitectura outbox de Focus Mobile.
 * Escucha cambios de conectividad y vacía la cola local automáticamente.
 */

let isSyncing = false;

export const runSyncIfConnected = async (onSyncSuccess = null) => {
  if (isSyncing) return;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || !netState.isInternetReachable) {
      return;
    }

    const cola = await SyncQueue.obtenerCola();
    if (!cola || cola.length === 0) {
      return;
    }

    isSyncing = true;

    // Enviar lote completo al endpoint batch
    const resultado = await LogisticaApi.sincronizarBatch(cola);

    if (resultado && resultado.sincronizados && resultado.sincronizados.length > 0) {
      for (const opId of resultado.sincronizados) {
        await SyncQueue.removerOperacion(opId);
      }
      if (onSyncSuccess) {
        onSyncSuccess(resultado.sincronizados);
      }
    } else if (!resultado.success) {
      // Fallback: procesar una por una secuencialmente
      for (const item of cola) {
        try {
          if (item.tipo === "ENTREGA") {
            await LogisticaApi.registrarEntrega(item.payload);
            await SyncQueue.removerOperacion(item.id);
          } else if (item.tipo === "COBRO") {
            await LogisticaApi.registrarCobro(item.payload);
            await SyncQueue.removerOperacion(item.id);
          }
        } catch (singleErr) {
          await SyncQueue.registrarFalloOperacion(item.id, singleErr.message);
        }
      }
    }
  } catch (err) {
    console.log("[AutoSync] Sincronización en background aplazada:", err.message);
  } finally {
    isSyncing = false;
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
    const isNowConnected = !!state.isConnected && state.isInternetReachable !== false;

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
