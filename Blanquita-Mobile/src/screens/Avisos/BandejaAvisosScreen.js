import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useNotificaciones } from "../../context/NotificacionesContext";
import { Header } from "../../components/common/Header";
import { BellOff } from "lucide-react-native";

export const BandejaAvisosScreen = ({ navigation }) => {
  const { notificaciones, conteoNoLeidas, cargando, refrescarNotificaciones, manejarPresionarAviso } =
    useNotificaciones();

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={[styles.card, !item.leido && styles.cardNoLeida]}
        onPress={() => manejarPresionarAviso(item, navigation)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.tipo, !item.leido && styles.tipoNoLeido]}>
            {item.tipo || "AVISO"}
          </Text>
          <Text style={styles.fecha}>
            {item.fecha_creacion
              ? new Date(item.fecha_creacion).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </Text>
        </View>
        <Text style={styles.titulo}>{item.titulo}</Text>
        <Text style={styles.mensaje}>{item.mensaje}</Text>
        {!item.leido && (
          <View style={styles.badgePendiente}>
            <Text style={styles.badgePendienteText}>PENDIENTE</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Bandeja de Avisos"
        subtitle={
          conteoNoLeidas > 0
            ? `${conteoNoLeidas} avisos pendientes`
            : "Todos los avisos leídos"
        }
      />
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={cargando}
            onRefresh={refrescarNotificaciones}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <BellOff size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin avisos pendientes</Text>
            <Text style={styles.emptySubtitle}>
              Aquí se notificarán ajustes de ruta, cambios de precio y avisos de administración.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardNoLeida: {
    borderColor: Colors.primary,
    borderLeftWidth: 4,
    backgroundColor: "#F0F9FF",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  tipo: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tipoNoLeido: {
    color: Colors.primary,
  },
  fecha: {
    fontSize: 11,
    color: "#94A3B8",
  },
  titulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  mensaje: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  badgePendiente: {
    alignSelf: "flex-start",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
  },
  badgePendienteText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18,
  },
});

export default BandejaAvisosScreen;
