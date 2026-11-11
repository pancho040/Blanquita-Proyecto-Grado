// import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

/**
 * Indicador visual del estado de sincronización (Fase 1.1 - Punto C2)
 * Estados soportados: 'sincronizado', 'sincronizando', 'pendiente', 'error'
 */
export const SyncStatusBadge = ({ estado = "sincronizado", pendientesCount = 0 }) => {
  const configs = {
    sincronizado: {
      label: "SINCRONIZADO",
      bgColor: Colors.successLight,
      textColor: Colors.success,
      borderColor: Colors.successBorder,
    },
    sincronizando: {
      label: "SINCRONIZANDO...",
      bgColor: Colors.primaryLight,
      textColor: Colors.primaryDark,
      borderColor: Colors.borderFocus,
      loading: true,
    },
    pendiente: {
      label: `${pendientesCount} PENDIENTE${pendientesCount === 1 ? "" : "S"}`,
      bgColor: Colors.warningLight,
      textColor: Colors.warning,
      borderColor: Colors.warningBorder,
    },
    error: {
      label: "ERROR SYNC",
      bgColor: Colors.dangerLight,
      textColor: Colors.danger,
      borderColor: Colors.dangerBorder,
    },
  };

  const conf = configs[estado] || configs.sincronizado;

  return (
    <View style={[styles.badge, { backgroundColor: conf.bgColor, borderColor: conf.borderColor }]}>
      {conf.loading && (
        <ActivityIndicator size="small" color={conf.textColor} style={styles.spinner} />
      )}
      <Text style={[styles.label, { color: conf.textColor }]}>{conf.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  spinner: {
    marginRight: 4,
    transform: [{ scale: 0.7 }],
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

export default SyncStatusBadge;
