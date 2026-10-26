import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import {
  MapPin,
  Phone,
  Package,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";

export const ParadaCard = ({ parada, onPress, onDetalle, onEntregar, onCobrar }) => {
  const handlePress = onPress || onDetalle;

  const estado = (parada.Estado || parada.estado || "PENDIENTE").toUpperCase();
  const esEntregado = estado === "ENTREGADO";
  const esNoEntregado = estado === "NO_ENTREGADO";
  const esPendiente = !esEntregado && !esNoEntregado;

  const orden = parada.OrdenVisita || parada.secuencia || parada.orden || "1";
  const nombrePunto =
    parada.NombrePuntoVenta ||
    parada.cliente?.nombre_comercial ||
    parada.cliente?.razon_social ||
    "Punto de Entrega";
  const nombreCliente =
    parada.NombreCliente ||
    parada.cliente?.razon_social ||
    parada.cliente?.nombre_comercial ||
    "Cliente";
  const direccion =
    parada.Direccion || parada.cliente?.direccion || "Sucre, Bolivia";
  const telefono = parada.Telefono || parada.cliente?.telefono;
  const monto = Number(
    parada.MontoPedido || parada.pedido?.monto_total || parada.monto_total || 0
  );

  const llamarCliente = () => {
    if (telefono) {
      Linking.openURL(`tel:${telefono}`).catch(() => {});
    }
  };

  return (
    <Card style={styles.card} onPress={handlePress}>
      {/* Encabezado: Número de Parada + Nombre Cliente + Badge Estado */}
      <View style={styles.headerRow}>
        <View style={styles.ordenBadge}>
          <Text style={styles.ordenText}>#{orden}</Text>
        </View>

        <View style={styles.clienteInfo}>
          <Text style={styles.nombrePunto} numberOfLines={1}>
            {nombrePunto}
          </Text>
          <Text style={styles.nombreCliente} numberOfLines={1}>
            {nombreCliente}
          </Text>
        </View>

        <Badge
          text={esEntregado ? "Entregado" : esNoEntregado ? "No Entregado" : "Pendiente"}
          variant={esEntregado ? "success" : esNoEntregado ? "danger" : "warning"}
        />
      </View>

      {/* Dirección */}
      <View style={styles.detailRow}>
        <MapPin size={15} color={Colors.primary} style={styles.detailIcon} />
        <Text style={styles.detailText} numberOfLines={1}>
          {direccion}
        </Text>
      </View>

      {/* Monto y Teléfono */}
      <View style={styles.footerRow}>
        <View style={styles.montoBox}>
          <DollarSign size={15} color={Colors.success} />
          <Text style={styles.montoText}>Bs. {monto.toFixed(2)}</Text>
        </View>

        <View style={styles.rightActions}>
          {telefono && (
            <TouchableOpacity
              onPress={llamarCliente}
              style={styles.callBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Phone size={14} color={Colors.primary} />
              <Text style={styles.callText}>Llamar</Text>
            </TouchableOpacity>
          )}
          <ChevronRight size={18} color={Colors.textMuted} />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: Colors.card,
    borderColor: Colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  ordenBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  ordenText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
  },
  clienteInfo: {
    flex: 1,
    marginRight: 8,
  },
  nombrePunto: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  nombreCliente: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  detailIcon: {
    marginRight: 6,
  },
  detailText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  montoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  montoText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.success,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  callText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
});

export default ParadaCard;
