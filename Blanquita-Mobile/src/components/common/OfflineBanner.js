import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { CloudOff, RefreshCw, Lock } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useNetwork } from "../../context/NetworkContext";
import { useAuth } from "../../context/AuthContext";
import { setServerWakingUpListener } from "../../api/client";

export const OfflineBanner = () => {
  const { isOnline, pendientes, sincronizando, syncInProgress, sincronizarAhora } = useNetwork();
  const { sesionExpirada } = useAuth();
  const cargando = sincronizando || syncInProgress;
  const [despertandoServidor, setDespertandoServidor] = useState(false);
  const [mensajeServidor, setMensajeServidor] = useState("");

  useEffect(() => {
    setServerWakingUpListener((activo, mensaje = "") => {
      setDespertandoServidor(activo);
      setMensajeServidor(mensaje || "Despertando servidor central...");
    });
    return () => setServerWakingUpListener(null);
  }, []);

  // 1. Prioridad: Sesión expirada (offline-first: chofer sigue trabajando con datos seguros)
  if (sesionExpirada) {
    return (
      <View style={[styles.banner, styles.bannerExpirada]}>
        <View style={styles.contentRow}>
          <Lock size={16} color="#FFFFFF" />
          <Text style={styles.texto}>
            Inicia sesión para sincronizar (tus datos están seguros)
          </Text>
        </View>
      </View>
    );
  }

  // 2. Prioridad: Notificación de arranque en frío de Render
  if (despertandoServidor) {
    return (
      <View style={[styles.banner, styles.bannerWakingUp]}>
        <View style={styles.contentRow}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.texto}>
            {mensajeServidor || "Despertando servidor central... Por favor espere (~50s)"}
          </Text>
        </View>
      </View>
    );
  }

  // 3. Si está online y no hay pendientes, no mostrar nada
  if (isOnline && (!pendientes || pendientes === 0)) return null;

  return (
    <View
      style={[
        styles.banner,
        isOnline ? styles.bannerSyncPending : styles.bannerOffline,
      ]}
    >
      <View style={styles.contentRow}>
        {!isOnline ? (
          <CloudOff size={16} color="#FFFFFF" />
        ) : (
          <RefreshCw size={16} color="#FFFFFF" />
        )}
        <Text style={styles.texto}>
          {!isOnline
            ? `Modo Fuera de Línea • Guardado en el teléfono, pendiente de enviar (${pendientes || 0})`
            : `${pendientes} guardado(s) en el teléfono, pendiente de enviar`}
        </Text>
      </View>

      {isOnline && pendientes > 0 && (
        <TouchableOpacity
          onPress={sincronizarAhora}
          disabled={cargando}
          style={styles.btnSync}
          activeOpacity={0.8}
        >
          <Text style={styles.btnSyncTexto}>
            {cargando ? "Subiendo..." : "Sincronizar"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerOffline: {
    backgroundColor: Colors.danger,
  },
  bannerSyncPending: {
    backgroundColor: Colors.accent,
  },
  bannerWakingUp: {
    backgroundColor: Colors.info,
  },
  bannerExpirada: {
    backgroundColor: "#B45309", // Ámbar de advertencia
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  texto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  btnSync: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4, // DESIGN.md: Máximo 4px
  },
  btnSyncTexto: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});

export default OfflineBanner;
