import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Truck, CheckCircle2, DollarSign, Wallet } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { Card } from "../common/Card";

export const MetricasResumen = ({ metricas, asignacion, recaudacion }) => {
  // Soporta tanto prop 'metricas' como 'asignacion/recaudacion'
  const total = metricas?.total_paradas ?? asignacion?.paradas?.length ?? 0;
  const visitadas =
    metricas?.entregados ??
    asignacion?.paradas?.filter((p) => (p.Estado || p.estado) === "ENTREGADO").length ??
    0;
  const porcentaje = total > 0 ? Math.round((visitadas / total) * 100) : 0;

  const efectivo = Number(metricas?.total_efectivo ?? recaudacion?.efectivo ?? 0);
  const transferencias = Number(metricas?.total_qr ?? recaudacion?.transferencias ?? 0);

  return (
    <Card style={styles.container}>
      {/* Barra de Progreso de Entregas */}
      <View style={styles.progresoSection}>
        <View style={styles.progresoLabels}>
          <Text style={styles.progresoTitulo}>Progreso de Entregas en Ruta</Text>
          <Text style={styles.progresoValor}>
            {visitadas} de {total} ({porcentaje}%)
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, Math.max(0, porcentaje))}%` },
            ]}
          />
        </View>
      </View>

      {/* Recaudación de la Jornada */}
      <View style={styles.metricasFinancierasGrid}>
        <View style={styles.cajaItem}>
          <View style={styles.cajaIconWrapper}>
            <DollarSign size={14} color={Colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cajaLabel}>Efectivo en Mano</Text>
            <Text style={styles.cajaMonto}>Bs. {efectivo.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.cajaItem}>
          <View style={[styles.cajaIconWrapper, { backgroundColor: Colors.primaryMuted }]}>
            <Wallet size={14} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cajaLabel}>QR / Transferencias</Text>
            <Text style={[styles.cajaMonto, { color: Colors.primary }]}>
              Bs. {transferencias.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  progresoSection: {
    marginBottom: 12,
  },
  progresoLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progresoTitulo: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "700",
  },
  progresoValor: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  metricasFinancierasGrid: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  cajaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cajaIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cajaLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  cajaMonto: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.success,
    marginTop: 1,
  },
});

export default MetricasResumen;
