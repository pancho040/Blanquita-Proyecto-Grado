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
  CheckCircle,
  RefreshCw,
  ClipboardCheck,
  Flag,
  X,
  Bell,
  AlertTriangle,
} from "lucide-react-native";
import { wsService } from "../../services/wsService";
import { useNotificaciones } from "../../context/NotificacionesContext";
import { Colors } from "../../constants/Colors";

/**
 * Duración visible del banner en milisegundos antes del autocierre.
 */
const DURACION_BANNER_MS = 5000;

/**
 * Componente flotante superior para notificaciones operativas en tiempo real (HU-30).
 * Presenta animaciones suaves de entrada/salida (translateY / opacity),
 * barra de progreso regresiva de 5 segundos, vibración haptica de 200ms
 * y mapeo tipado con iconos institucionales para choferes.
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
      // Si ya hay un banner mostrándose, limpiar timers
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

  // Suscripción a eventos tipados del WebSocket
  useEffect(() => {
    const unsubs = [
      wsService.on("ruta_asignada", (d) => {
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "ruta_asignada",
          titulo: "Nueva Ruta Asignada",
          mensaje: d?.mensaje || "📍 Te asignaron una nueva ruta para hoy. Solicita tu carga de inventario.",
          icono: MapPin,
          colorFondo: "#0284C7",
          colorIcono: "#BAE6FD",
          datos: d,
        });
      }),

      wsService.on("carga_camion_aprobada", (d) => {
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "carga_camion_aprobada",
          titulo: "Carga Aprobada",
          mensaje: d?.mensaje || "✅ ¡Carga de inventario aprobada! Tu ruta ya está habilitada para repartir.",
          icono: CheckCircle,
          colorFondo: "#15803D",
          colorIcono: "#BBF7D0",
          datos: d,
        });
      }),

      wsService.on("ruta_reordenada", (d) => {
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "ruta_reordenada",
          titulo: "Ruta Reordenada",
          mensaje: d?.mensaje || "🔄 Administración actualizó el orden de paradas de tu ruta.",
          icono: RefreshCw,
          colorFondo: "#B45309",
          colorIcono: "#FDE68A",
          datos: d,
        });
      }),

      wsService.on("operacion_revisada", (d) => {
        const esObservado =
          d?.estado === "OBSERVADO" ||
          d?.estado === "observado" ||
          Boolean(d?.observado) ||
          Boolean(d?.es_observado);

        const mensajeFormateado = d?.mensaje || (esObservado
          ? "📋 Tu entrega/cobro fue observado por Administración."
          : "📋 Tu entrega/cobro fue revisado por Administración.");

        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "operacion_revisada",
          titulo: esObservado ? "Operación Observada" : "Operación Revisada",
          mensaje: mensajeFormateado,
          icono: esObservado ? AlertTriangle : ClipboardCheck,
          colorFondo: esObservado ? "#B91C1C" : "#0E7490",
          colorIcono: esObservado ? "#FECACA" : "#CFFAFE",
          datos: d,
        });
      }),

      wsService.on("ruta_finalizada_admin", (d) => {
        dispararBanner({
          id: `banner-${Date.now()}`,
          tipo: "ruta_finalizada_admin",
          titulo: "Ruta Finalizada",
          mensaje: d?.mensaje || "🏁 Administración dio por finalizada y aprobada tu ruta.",
          icono: Flag,
          colorFondo: "#4338CA",
          colorIcono: "#C7D2FE",
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
            <IconoComponente size={22} color={notificacionActual.colorIcono} />
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
            <X size={18} color="#FFFFFF" />
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
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  filaContenido: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  circuloIcono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  columnaTexto: {
    flex: 1,
  },
  titulo: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  mensaje: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#F8FAFC",
    lineHeight: 16.5,
  },
  botonCerrar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  pistaProgreso: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  barraProgreso: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
});

export default InAppNotificationBanner;
