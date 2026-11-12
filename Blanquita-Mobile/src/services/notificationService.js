/**
 * Servicio de Notificaciones Push (Fase 1.1 - Punto C4)
 * Maneja solicitud de permisos, registro del token en FastAPI (/api/movil/v1/dispositivos/registro)
 * y escuchadores para primer y segundo plano.
 */

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import apiClient from "../api/client";

// Configuración de comportamiento de notificación en primer plano (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationService = {
  /**
   * Solicita permisos de notificación al sistema operativo y obtiene el ExponentPushToken.
   * En simuladores o tests devuelve un token mock.
   */
  async registrarTokenDispositivo() {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Notificaciones ERP Blanquita",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#1C96C5",
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn("[Push] Permiso de notificaciones denegado por el usuario.");
        return null;
      }

      let tokenData = null;
      try {
        tokenData = await Notifications.getExpoPushTokenAsync();
      } catch (tokenErr) {
        // En desarrollo local o emulador sin projectId de EAS configurado en app.json,
        // no se puede obtener el ExponentPushToken remoto.
        console.warn(
          "[Push] No se pudo obtener Expo Push Token remoto (requiere projectId de EAS en app.json). " +
          "La bandeja interna de notificaciones locales continuará funcionando normalmente.",
          tokenErr.message
        );
      }

      const pushToken = tokenData?.data || null;
      if (!pushToken) {
        console.info("[Push] Sin token remoto para registrar; se opera exclusivamente con bandeja interna.");
        return null;
      }

      // Registrar token real en FastAPI asociado al chofer autenticado
      await apiClient.post("/api/movil/v1/dispositivos/registro", {
        token_push: pushToken,
        plataforma: Platform.OS,
        version_app: "1.0.0",
      });

      console.log("[Push] Dispositivo registrado exitosamente en FastAPI con token real.");
      return pushToken;
    } catch (e) {
      console.warn("[Push] Error al registrar dispositivo:", e.message);
      return null;
    }
  },

  /**
   * Configura escuchadores de notificaciones entrantes.
   */
  configurarEscuchadores(onNotificationReceived, onNotificationResponse) {
    const subReceived = Notifications.addNotificationReceivedListener((notification) => {
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });

    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  },
};

export default NotificationService;
