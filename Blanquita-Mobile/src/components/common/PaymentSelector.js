// import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";
import { validarPagoComprobante } from "../../utils/paymentValidator";

export { validarPagoComprobante };

export const PaymentSelector = ({ metodoSeleccionado, onSeleccionarMetodo }) => {
  const metodos = [
    { id: "EFECTIVO", label: "Efectivo", icon: "💵" },
    { id: "QR", label: "QR Bancario", icon: "📱", badge: "Foto Obligatoria" },
    { id: "CREDITO", label: "Abono / Crédito", icon: "📝" },
    { id: "MIXTO", label: "Cobro Mixto", icon: "⚖️" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Método de Pago</Text>
      <View style={styles.grid}>
        {metodos.map((m) => {
          const activo = metodoSeleccionado === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.opcion, activo && styles.opcionActiva]}
              onPress={() => onSeleccionarMetodo(m.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.opcionTexto}>{m.label}</Text>
              {m.badge && (
                <View style={styles.badgeWarning}>
                  <Text style={styles.badgeText}>{m.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  opcion: {
    flexBasis: "48%",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  opcionActiva: {
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.primaryLight,
  },
  opcionTexto: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  badgeWarning: {
    marginTop: 4,
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningBorder,
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.warning,
  },
});

export default PaymentSelector;
