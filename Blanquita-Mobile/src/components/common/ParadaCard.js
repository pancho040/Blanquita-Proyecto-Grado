// import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const ParadaCard = ({ parada, onPress }) => {
  if (!parada) return null;

  const orden = parada.orden || 1;
  const nombre = parada.nombre_cliente || parada.nombre || "Cliente General";
  const direccion = parada.direccion || "Sin dirección registrada";
  const estado = parada.estado || "PENDIENTE";
  const monto = parada.monto_total || parada.total || 0;

  const estadoConfigs = {
    PENDIENTE: { bg: Colors.warningLight, text: Colors.warning, border: Colors.warningBorder },
    ENTREGADO: { bg: Colors.successLight, text: Colors.success, border: Colors.successBorder },
    NO_ENTREGADO: { bg: Colors.dangerLight, text: Colors.danger, border: Colors.dangerBorder },
  };

  const st = estadoConfigs[estado] || estadoConfigs.PENDIENTE;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <View style={styles.ordenBadge}>
          <Text style={styles.ordenText}>#{orden}</Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
          <Text style={[styles.estadoText, { color: st.text }]}>{estado}</Text>
        </View>
      </View>

      <Text style={styles.nombre}>{nombre}</Text>
      <Text style={styles.direccion} numberOfLines={2}>{direccion}</Text>

      <View style={styles.footerRow}>
        <Text style={styles.montoLabel}>Total Pedido:</Text>
        <Text style={styles.montoValor}>Bs {Number(monto).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    padding: 14,
    marginVertical: 6,
    minHeight: 48,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ordenBadge: {
    backgroundColor: Colors.backgroundDark,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ordenText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  estadoBadge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  estadoText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  nombre: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  direccion: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  montoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  montoValor: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primaryDark,
    fontVariant: ["tabular-nums"],
  },
});

export default ParadaCard;
