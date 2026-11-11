/**
 * Servicio de Almacenamiento Seguro para Tokens JWT y Credenciales (Fase 1.1 - Punto C7)
 * Utiliza expo-secure-store en Android/iOS.
 * Prohíbe estrictamente el fallback a AsyncStorage cuando __DEV__ === false.
 */

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const KEY_ACCESS_TOKEN = "blanquita_secure_access_token";
const KEY_REFRESH_TOKEN = "blanquita_secure_refresh_token";

const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false;
const isSecureStoreAvailable = Platform.OS === "android" || Platform.OS === "ios";

function assertSecureStoreAvailability(operation) {
  if (!isSecureStoreAvailable && !isDev) {
    throw new Error(
      `[SecureStorage] Error de seguridad crítico en ${operation}: ` +
      `expo-secure-store no está disponible y el entorno no es desarrollo. ` +
      `Prohibido usar almacenamiento no encriptado en producción.`
    );
  }
}

export const SecureStorage = {
  async guardarToken(token) {
    if (!token) return;
    assertSecureStoreAvailability("guardarToken");

    try {
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, token);
        return;
      }
      if (isDev) {
        await AsyncStorage.setItem(KEY_ACCESS_TOKEN, token);
      }
    } catch (e) {
      if (!isDev) {
        throw new Error(`[SecureStorage] Fallo crítico al persistir access token en producción: ${e.message}`);
      }
      console.warn("[SecureStorage DEV] Fallo SecureStore, usando AsyncStorage:", e.message);
      await AsyncStorage.setItem(KEY_ACCESS_TOKEN, token);
    }
  },

  async obtenerToken() {
    assertSecureStoreAvailability("obtenerToken");

    try {
      if (isSecureStoreAvailable) {
        const token = await SecureStore.getItemAsync(KEY_ACCESS_TOKEN);
        if (token) return token;
      }
      if (isDev) {
        return await AsyncStorage.getItem(KEY_ACCESS_TOKEN);
      }
      return null;
    } catch (e) {
      if (!isDev) {
        throw new Error(`[SecureStorage] Fallo crítico al recuperar access token en producción: ${e.message}`);
      }
      console.warn("[SecureStorage DEV] Fallo SecureStore, leyendo de AsyncStorage:", e.message);
      return await AsyncStorage.getItem(KEY_ACCESS_TOKEN);
    }
  },

  async guardarRefreshToken(token) {
    if (!token) return;
    assertSecureStoreAvailability("guardarRefreshToken");

    try {
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, token);
        return;
      }
      if (isDev) {
        await AsyncStorage.setItem(KEY_REFRESH_TOKEN, token);
      }
    } catch (e) {
      if (!isDev) {
        throw new Error(`[SecureStorage] Fallo crítico al persistir refresh token en producción: ${e.message}`);
      }
      console.warn("[SecureStorage DEV] Fallo SecureStore, usando AsyncStorage:", e.message);
      await AsyncStorage.setItem(KEY_REFRESH_TOKEN, token);
    }
  },

  async obtenerRefreshToken() {
    assertSecureStoreAvailability("obtenerRefreshToken");

    try {
      if (isSecureStoreAvailable) {
        const token = await SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
        if (token) return token;
      }
      if (isDev) {
        return await AsyncStorage.getItem(KEY_REFRESH_TOKEN);
      }
      return null;
    } catch (e) {
      if (!isDev) {
        throw new Error(`[SecureStorage] Fallo crítico al recuperar refresh token en producción: ${e.message}`);
      }
      console.warn("[SecureStorage DEV] Fallo SecureStore, leyendo de AsyncStorage:", e.message);
      return await AsyncStorage.getItem(KEY_REFRESH_TOKEN);
    }
  },

  async limpiarTokens() {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN).catch(() => {});
        await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN).catch(() => {});
      }
      if (isDev) {
        await AsyncStorage.removeItem(KEY_ACCESS_TOKEN).catch(() => {});
        await AsyncStorage.removeItem(KEY_REFRESH_TOKEN).catch(() => {});
      }
    } catch (e) {
      if (!isDev) {
        throw new Error(`[SecureStorage] Fallo crítico al limpiar tokens en producción: ${e.message}`);
      }
      console.warn("[SecureStorage DEV] Fallo al limpiar tokens:", e.message);
    }
  },
};

export default SecureStorage;
