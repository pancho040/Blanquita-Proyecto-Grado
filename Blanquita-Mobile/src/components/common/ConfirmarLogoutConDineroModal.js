import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Colors } from "../../constants/Colors";
import { AlertTriangle, LogOut, X } from "lucide-react-native";

/**
 * Modal de Advertencia y Confirmación Explícita de Cierre de Sesión (Punto 6).
 * Se activa si el chofer intenta cerrar sesión con dinero en cola.
 * Muestra el desglose de cobros y montos en Bs., y permite confirmación forzada.
 * Diseño responsivo seguro con ScrollView <= 80% de pantalla y contraste WCAG AA.
 */
export const ConfirmarLogoutConDineroModal = ({
  visible,
  resumenBloqueo,
  onCancelar,
  onConfirmarForzar,
}) => {
  if (!visible || !resumenBloqueo) return null;

  const {
    cantidad,
    montoTotal,
    desgloseReintentables = [],
    desgloseNoReintentables = [],
  } = resumenBloqueo;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Botón de cierre en cabecera superior derecha */}
          <TouchableOpacity
            style={styles.btnCerrarSuperior}
            onPress={onCancelar}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Cerrar modal"
            accessibilityRole="button"
          >
            <X size={20} color="#64748B" />
          </TouchableOpacity>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.iconContainer}>
              <AlertTriangle size={36} color="#B45309" />
            </View>

            <Text style={styles.title}>DINERO SIN SINCRONIZAR</Text>
            <Text style={styles.sub}>
              Tienes <Text style={styles.bold}>{cantidad} cobro(s)</Text> en cola por un total de:
            </Text>
            <Text style={styles.montoPrincipal}>
              Bs. {Number(montoTotal || 0).toFixed(2)}
            </Text>

            {/* Desglose de cobros */}
            <View style={styles.desgloseContenedor}>
              {desgloseReintentables.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInfoCol}>
                    <Text style={styles.itemCliente} numberOfLines={1}>
                      {item.cliente}
                    </Text>
                    <Text style={styles.itemTipo}>{item.tipo}</Text>
                  </View>
                  <Text style={styles.itemMonto}>
                    Bs. {Number(item.monto || 0).toFixed(2)}
                  </Text>
                </View>
              ))}

              {desgloseNoReintentables.length > 0 ? (
                <View style={styles.noReintentablesBox}>
                  <Text style={styles.noReintentablesTitle}>
                    Validaciones del servidor ({desgloseNoReintentables.length}):
                  </Text>
                  <Text style={styles.noReintentablesSub}>
                    No bloquean el cierre ya que son observaciones permanentes.
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.advertencia}>
              Si sales ahora, los cobros no sincronizados podrían perderse si se borran los datos del dispositivo.
            </Text>

            {/* Acciones */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.btnCancelar}
                onPress={onCancelar}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Cancelar y sincronizar dinero"
              >
                <X size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnCancelarText}>CANCELAR Y SINCRONIZAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnForzar}
                onPress={onConfirmarForzar}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Cerrar sesión de todos modos"
              >
                <LogOut size={16} color="#B91C1C" style={{ marginRight: 6 }} />
                <Text style={styles.btnForzarText}>CERRAR SESIÓN DE TODOS MODOS</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    position: "relative",
  },
  btnCerrarSuperior: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  modalScroll: {
    maxHeight: "100%",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 4,
    textAlign: "center",
    flexShrink: 1,
    flexWrap: "wrap",
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 13,
    color: "#334155",
    textAlign: "center",
    flexShrink: 1,
    flexWrap: "wrap",
    lineHeight: 18,
  },
  bold: {
    fontWeight: "700",
    color: "#0F172A",
  },
  montoPrincipal: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.primaryDark || "#0369A1",
    marginVertical: 8,
    fontVariant: ["tabular-nums"],
  },
  desgloseContenedor: {
    width: "100%",
    maxHeight: 150,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
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
  itemInfoCol: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  itemCliente: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemTipo: {
    fontSize: 10,
    color: "#475569",
    marginTop: 1,
  },
  itemMonto: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
    fontVariant: ["tabular-nums"],
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
    color: "#475569",
    marginTop: 1,
  },
  advertencia: {
    fontSize: 11.5,
    color: "#B91C1C",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 14,
    fontWeight: "600",
    flexShrink: 1,
    flexWrap: "wrap",
  },
  actionsContainer: {
    width: "100%",
    gap: 8,
  },
  btnCancelar: {
    backgroundColor: Colors.primaryDark || "#0369A1",
    paddingVertical: 12,
    borderRadius: 6,
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
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 48,
  },
  btnForzarText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.4,
  },
});

export default ConfirmarLogoutConDineroModal;
