import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Colors } from "../../constants/Colors";
import { AlertTriangle, LogOut, X } from "lucide-react-native";

/**
 * Modal de Advertencia y Confirmación Explícita de Cierre de Sesión (Punto 6).
 * Se activa si el chofer intenta cerrar sesión con dinero en cola.
 * Muestra el desglose de cobros y montos en Bs., y permite confirmación forzada.
 * Los errores 4xx no reintentables no impiden el cierre.
 */
export const ConfirmarLogoutConDineroModal = ({
  visible,
  resumenBloqueo,
  onCancelar,
  onConfirmarForzar,
}) => {
  if (!visible || !resumenBloqueo) return null;

  const { cantidad, montoTotal, desgloseReintentables = [], desgloseNoReintentables = [] } = resumenBloqueo;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={48} color={Colors.warning || "#B45309"} />
          </View>

          <Text style={styles.title}>DINERO SIN SINCRONIZAR</Text>
          <Text style={styles.sub}>
            Tienes <Text style={styles.bold}>{cantidad} cobro(s)</Text> en cola por un total de:
          </Text>
          <Text style={styles.montoPrincipal}>Bs. {Number(montoTotal || 0).toFixed(2)}</Text>

          {/* Desglose de cobros */}
          <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingVertical: 4 }}>
            {desgloseReintentables.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemCliente} numberOfLines={1}>{item.cliente}</Text>
                  <Text style={styles.itemTipo}>{item.tipo}</Text>
                </View>
                <Text style={styles.itemMonto}>Bs. {Number(item.monto || 0).toFixed(2)}</Text>
              </View>
            ))}

            {desgloseNoReintentables.length > 0 ? (
              <View style={styles.noReintentablesBox}>
                <Text style={styles.noReintentablesTitle}>
                  Errores 4xx detectados ({desgloseNoReintentables.length}):
                </Text>
                <Text style={styles.noReintentablesSub}>
                  No bloquean el cierre ya que son rechazos permanentes de validación.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <Text style={styles.advertencia}>
            Si sales ahora, los cobros no sincronizados podrían perderse si se borran los datos del teléfono.
          </Text>

          {/* Acciones */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.btnCancelar}
              onPress={onCancelar}
              activeOpacity={0.8}
            >
              <X size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnCancelarText}>CANCELAR Y SINCRONIZAR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnForzar}
              onPress={onConfirmarForzar}
              activeOpacity={0.8}
            >
              <LogOut size={16} color={Colors.danger || "#B91C1C"} style={{ marginRight: 6 }} />
              <Text style={styles.btnForzarText}>CERRAR SESIÓN DE TODOS MODOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 4,
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
  },
  bold: {
    fontWeight: "700",
    color: "#0F172A",
  },
  montoPrincipal: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.primaryDark || "#157A9E",
    marginVertical: 8,
  },
  scrollList: {
    width: "100%",
    maxHeight: 160,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  itemCliente: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  itemTipo: {
    fontSize: 10,
    color: "#64748B",
  },
  itemMonto: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  noReintentablesBox: {
    paddingVertical: 8,
  },
  noReintentablesTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },
  noReintentablesSub: {
    fontSize: 10,
    color: "#64748B",
  },
  advertencia: {
    fontSize: 11,
    color: "#DC2626",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 14,
  },
  actionsContainer: {
    width: "100%",
    gap: 8,
  },
  btnCancelar: {
    backgroundColor: Colors.primaryDark || "#157A9E",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 48,
  },
  btnCancelarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  btnForzar: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 48,
  },
  btnForzarText: {
    color: Colors.danger || "#B91C1C",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.4,
  },
});

export default ConfirmarLogoutConDineroModal;
