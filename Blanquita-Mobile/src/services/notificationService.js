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

      const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
      const pushToken = tokenData?.data || "ExponentPushToken[mock-local-token]";

      // Registrar token en FastAPI
      await apiClient.post("/api/movil/v1/dispositivos/registro", {
        token_push: pushToken,
        plataforma: Platform.OS,
        version_app: "1.0.0",
      });

      console.log("[Push] Dispositivo registrado exitosamente en FastAPI.");
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
