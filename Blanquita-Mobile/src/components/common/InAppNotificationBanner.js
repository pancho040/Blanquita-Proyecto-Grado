import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MapPin,
  CheckCircle2,
  RefreshCw,
  ClipboardCheck,
  Flag,
  X,
  Bell,
  AlertTriangle,
  XCircle,
} from "lucide-react-native";
import { wsService } from "../../services/wsService";
import { useNotificaciones } from "../../context/NotificacionesContext";

/**
 * Duración visible del banner en milisegundos antes del autocierre.
 */
const DURACION_BANNER_MS = 5000;

/**
 * Elimina cualquier caracter emoji accidental para preservar la estética sobria.
 */
const limpiarTextoEmojis = (texto) => {
  if (!texto || typeof texto !== "string") return "";
  return texto
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{203C}\u{2049}\u{2139}]/gu,
      ""
    )
    .trim();
};

/**
 * Componente flotante superior para notificaciones operativas en tiempo real (HU-30).
 * Presenta animaciones suaves de entrada/salida (translateY / opacity),
 * barra de progreso regresiva de 5 segundos, vibración haptica de 200ms
 * e iconos vectoriales limpios sin emojis (lucide-react-native).
 */
export const InAppNotificationBanner = () => {
  const insets = useSafeAreaInsets();
  const notificacionesContext = useNotificaciones();

  const [notificacionActual, setNotificacionActual] = useState(null);

  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progresoAnim = useRef(new Animated.Value(1)).current;

  const autoCerrarTimerRef = useRef(null);
  const animacionProgresoRef = useRef(null);

  const cerrarBanner = useCallback(() => {
    if (autoCerrarTimerRef.current) {
      clearTimeout(autoCerrarTimerRef.current);
      autoCerrarTimerRef.current = null;
    }
    if (animacionProgresoRef.current) {
      animacionProgresoRef.current.stop();
      animacionProgresoRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setNotificacionActual(null);
    });
  }, [translateY, opacity]);

  const dispararBanner = useCallback(
    (notif) => {
      if (autoCerrarTimerRef.current) {
        clearTimeout(autoCerrarTimerRef.current);
        autoCerrarTimerRef.current = null;
      }
      if (animacionProgresoRef.current) {
        animacionProgresoRef.current.stop();
        animacionProgresoRef.current = null;
      }

      setNotificacionActual(notif);
      progresoAnim.setValue(1);

      // Vibración corta de 200ms con salvaguarda de compatibilidad
      try {
        if (Platform.OS !== "web" && Vibration && typeof Vibration.vibrate === "function") {
          Vibration.vibrate(200);
        }
      } catch (_e) {}

      // Animación de entrada
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Animación de la barra de progreso decreciente (5 segundos)
      animacionProgresoRef.current = Animated.timing(progresoAnim, {
        toValue: 0,
        duration: DURACION_BANNER_MS,
        useNativeDriver: false,
      });

      animacionProgresoRef.current.start(({ finished }) => {
        if (finished) {
          cerrarBanner();
        }
      });
    },
    [translateY, opacity, progresoAnim, cerrarBanner]
  );

  // Suscripción a eventos tipados del WebSocket con textos e iconos limpios
  useEffect(() => {
    const unsubs = [
      wsService.on("ruta_asignada", (d) => {
        const mensajeBackend = limpiarTextoEmojis(d?.mensaje);
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "ruta_asignada",
          titulo: "Ruta Asignada",
          mensaje:
            mensajeBackend ||
            "Ruta Asignada: Se te asignó una nueva ruta para hoy. Solicita tu carga de inventario.",
          icono: MapPin,
          colorFondo: "#0284C7",
          colorIcono: "#E0F2FE",
          datos: d,
        });
      }),

      wsService.on("carga_camion_aprobada", (d) => {
        const mensajeBackend = limpiarTextoEmojis(d?.mensaje);
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "carga_camion_aprobada",
          titulo: "Carga Aprobada",
          mensaje:
            mensajeBackend ||
            "Carga Aprobada: Tu carga de inventario fue aprobada. Ya puedes iniciar tu reparto.",
          icono: CheckCircle2,
          colorFondo: "#15803D",
          colorIcono: "#DCFCE7",
          datos: d,
        });
      }),

      wsService.on("carga_camion_observada", (d) => {
        const mensajeBackend = limpiarTextoEmojis(d?.mensaje);
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "carga_camion_observada",
          titulo: "Carga Observada",
          mensaje:
            mensajeBackend ||
            "Carga Observada: Tu solicitud de carga tiene observaciones. Revisa los detalles para corregirla.",
          icono: AlertTriangle,
          colorFondo: "#B45309",
          colorIcono: "#FEF3C7",
          datos: d,
        });
      }),

      wsService.on("carga_camion_rechazada", (d) => {
        const mensajeBackend = limpiarTextoEmojis(d?.mensaje);
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "carga_camion_rechazada",
          titulo: "Carga Rechazada",
          mensaje:
            mensajeBackend ||
            "Carga Rechazada: Tu solicitud de carga fue rechazada por Administración.",
          icono: XCircle,
          colorFondo: "#B91C1C",
          colorIcono: "#FEE2E2",
          datos: d,
        });
      }),

      wsService.on("ruta_reordenada", (d) => {
        const mensajeBackend = limpiarTextoEmojis(d?.mensaje);
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "ruta_reordenada",
          titulo: "Ruta Reordenada",
          mensaje:
            mensajeBackend ||
            "Ruta Reordenada: Administración actualizó el orden de tus paradas.",
          icono: RefreshCw,
          colorFondo: "#0E7490",
          colorIcono: "#CFFAFE",
          datos: d,
        });
      }),

      wsService.on("operacion_revisada", (d) => {
        const esObservado =
          d?.estado === "OBSERVADO" ||
          d?.estado === "observado" ||
          Boolean(d?.observado) ||
          Boolean(d?.es_observado);

        const mensajeBackend = limpiarTextoEmojis(d?.mensaje);
        const mensajeFallback = esObservado
          ? "Operación Observada: Tu entrega o cobro fue observado por Administración."
          : "Operación Revisada: Tu entrega o cobro fue revisado por Administración.";

        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "operacion_revisada",
          titulo: esObservado ? "Operación Observada" : "Operación Revisada",
          mensaje: mensajeBackend || mensajeFallback,
          icono: esObservado ? AlertTriangle : ClipboardCheck,
          colorFondo: esObservado ? "#B91C1C" : "#0E7490",
          colorIcono: esObservado ? "#FEE2E2" : "#CFFAFE",
          datos: d,
        });
      }),

      wsService.on("ruta_finalizada_admin", (d) => {
        const mensajeBackend = limpiarTextoEmojis(d?.mensaje);
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "ruta_finalizada_admin",
          titulo: "Ruta Finalizada",
          mensaje:
            mensajeBackend ||
            "Ruta Finalizada: Administración dio por concluida tu ruta de hoy.",
          icono: Flag,
          colorFondo: "#4338CA",
          colorIcono: "#E0E7FF",
          datos: d,
        });
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
      if (autoCerrarTimerRef.current) {
        clearTimeout(autoCerrarTimerRef.current);
      }
      if (animacionProgresoRef.current) {
        animacionProgresoRef.current.stop();
      }
    };
  }, [dispararBanner]);

  if (!notificacionActual) {
    return null;
  }

  const IconoComponente = notificacionActual.icono || Bell;
  const topPosition = Math.max(insets.top + 8, 14);

  const anchoProgresoInterpolado = progresoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const handlePressBanner = () => {
    if (notificacionesContext?.manejarPresionarAviso) {
      notificacionesContext.manejarPresionarAviso(
        {
          id: notificacionActual.id,
          tipo: notificacionActual.tipo,
          codigo_referencia:
            notificacionActual.datos?.codigo_referencia ||
            notificacionActual.datos?.id_asignacion ||
            notificacionActual.datos?.id_pedido,
        },
        null
      );
    }
    cerrarBanner();
  };

  return (
    <Animated.View
      style={[
        styles.contenedorFlotante,
        {
          top: topPosition,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePressBanner}
        style={[styles.bannerCard, { backgroundColor: notificacionActual.colorFondo }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        <View style={styles.filaContenido}>
          <View style={styles.circuloIcono}>
            <IconoComponente size={20} color={notificacionActual.colorIcono} />
          </View>

          <View style={styles.columnaTexto}>
            <Text style={styles.titulo} numberOfLines={1}>
              {notificacionActual.titulo}
            </Text>
            <Text style={styles.mensaje} numberOfLines={3}>
              {notificacionActual.mensaje}
            </Text>
          </View>

          <TouchableOpacity
            onPress={cerrarBanner}
            style={styles.botonCerrar}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Cerrar notificación"
            accessibilityRole="button"
          >
            <X size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Barra de progreso de autocierre (5 segundos) */}
        <View style={styles.pistaProgreso}>
          <Animated.View
            style={[
              styles.barraProgreso,
              {
                width: anchoProgresoInterpolado,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  contenedorFlotante: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 99999,
    elevation: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  bannerCard: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  filaContenido: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  circuloIcono: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  columnaTexto: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 4,
  },
  titulo: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
    marginBottom: 2,
    flexShrink: 1,
  },
  mensaje: {
    fontSize: 12,
    fontWeight: "500",
    color: "#F8FAFC",
    lineHeight: 16,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  botonCerrar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pistaProgreso: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  barraProgreso: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
});

export default InAppNotificationBanner;
