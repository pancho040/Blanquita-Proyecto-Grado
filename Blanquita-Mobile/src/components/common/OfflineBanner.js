import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CloudOff, RefreshCw } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useNetwork } from "../../context/NetworkContext";

export const OfflineBanner = () => {
  const { isOnline, pendientes, sincronizando, syncInProgress, sincronizarAhora } = useNetwork();
  const cargando = sincronizando || syncInProgress;

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
            ? `Modo Fuera de Línea • ${pendientes || 0} pendientes de subir`
            : `${pendientes} operaciones pendientes de sincronizar`}
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
    paddingVertical: 7,
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
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  texto: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  btnSync: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  btnSyncTexto: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});

export default OfflineBanner;
