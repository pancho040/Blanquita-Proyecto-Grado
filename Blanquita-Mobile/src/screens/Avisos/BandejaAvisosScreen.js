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
import {
  BellOff,
  Truck,
  PackageCheck,
  AlertCircle,
  XCircle,
  RotateCw,
  CheckSquare,
  Flag,
  CheckCheck,
} from "lucide-react-native";

export const BandejaAvisosScreen = ({ navigation }) => {
  const {
    notificaciones,
    conteoNoLeidas,
    cargando,
    refrescarNotificaciones,
    manejarPresionarAviso,
    marcarTodasComoLeidas,
  } = useNotificaciones();

  const obtenerIconoYColorPorTipo = (tipo) => {
    const tipoNorm = String(tipo || "").toUpperCase();
    switch (tipoNorm) {
      case "RUTA_ASIGNADA":
        return {
          icono: Truck,
          color: "#0284C7",
          fondoBadge: "#F0F9FF",
          bordeBadge: "#BAE6FD",
          etiqueta: "Ruta Asignada",
        };
      case "CARGA_CAMION_APROBADA":
        return {
          icono: PackageCheck,
          color: "#15803D",
          fondoBadge: "#F0FDF4",
          bordeBadge: "#86EFAC",
          etiqueta: "Carga Aprobada",
        };
      case "CARGA_CAMION_OBSERVADA":
        return {
          icono: AlertCircle,
          color: "#B45309",
          fondoBadge: "#FFFBEB",
          bordeBadge: "#FDE68A",
          etiqueta: "Carga Observada",
        };
      case "CARGA_CAMION_RECHAZADA":
        return {
          icono: XCircle,
          color: "#B91C1C",
          fondoBadge: "#FEF2F2",
          bordeBadge: "#FCA5A5",
          etiqueta: "Carga Rechazada",
        };
      case "RUTA_REORDENADA":
        return {
          icono: RotateCw,
          color: "#0E7490",
          fondoBadge: "#F0FDFA",
          bordeBadge: "#99F6E4",
          etiqueta: "Ruta Reordenada",
        };
      case "OPERACION_REVISADA":
        return {
          icono: CheckSquare,
          color: "#0D9488",
          fondoBadge: "#F0FDFA",
          bordeBadge: "#99F6E4",
          etiqueta: "Operación Revisada",
        };
      case "RUTA_FINALIZADA_ADMIN":
        return {
          icono: Flag,
          color: "#4338CA",
          fondoBadge: "#EEF2FF",
          bordeBadge: "#C7D2FE",
          etiqueta: "Ruta Finalizada",
        };
      case "ABONO_QR_APROBADO":
      case "ABONO_APROBADO":
        return {
          icono: CheckSquare,
          color: "#16A34A",
          fondoBadge: "#F0FDF4",
          bordeBadge: "#86EFAC",
          etiqueta: "Abono QR Aprobado",
        };
      case "ABONO_QR_RECHAZADO":
      case "ABONO_RECHAZADO":
        return {
          icono: XCircle,
          color: "#DC2626",
          fondoBadge: "#FEF2F2",
          bordeBadge: "#FCA5A5",
          etiqueta: "Abono QR Observado",
        };
      case "TELEMETRIA_PING":
        return {
          icono: Truck,
          color: "#4338CA",
          fondoBadge: "#EEF2FF",
          bordeBadge: "#C7D2FE",
          etiqueta: "Ubicación Solicitada",
        };
      case "AVISO_RUTA":
        return {
          icono: Truck,
          color: "#0284C7",
          fondoBadge: "#F0F9FF",
          bordeBadge: "#BAE6FD",
          etiqueta: "Aviso de Ruta",
        };
      default:
        return {
          icono: AlertCircle,
          color: "#475569",
          fondoBadge: "#F1F5F9",
          bordeBadge: "#CBD5E1",
          etiqueta: "Aviso Operativo",
        };
    }
  };

  const renderItem = ({ item }) => {
    const meta = obtenerIconoYColorPorTipo(item.tipo);
    const IconoComponente = meta.icono;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          !item.leido && styles.cardNoLeida,
        ]}
        onPress={() => manejarPresionarAviso(item, navigation)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${meta.etiqueta}: ${item.titulo}`}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.tipoBadge, { backgroundColor: meta.fondoBadge, borderColor: meta.bordeBadge }]}>
            <IconoComponente size={14} color={meta.color} />
            <Text style={[styles.tipoTexto, { color: meta.color }]}>
              {meta.etiqueta}
            </Text>
          </View>
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
            <Text style={styles.badgePendienteText}>NUEVO • TOCAR PARA VER</Text>
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
            ? `${conteoNoLeidas} avisos pendientes de lectura`
            : "Todos los avisos al día"
        }
      />

      {notificaciones.length > 0 && (
        <View style={styles.barraAcciones}>
          <Text style={styles.contadorTexto}>
            {notificaciones.length} {notificaciones.length === 1 ? "aviso registrado" : "avisos registrados"}
          </Text>
          <TouchableOpacity
            style={[
              styles.botonMarcarTodas,
              conteoNoLeidas === 0 && styles.botonMarcarTodasInactivo,
            ]}
            onPress={marcarTodasComoLeidas}
            disabled={conteoNoLeidas === 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Marcar todas como leídas"
          >
            <CheckCheck
              size={15}
              color={conteoNoLeidas > 0 ? Colors.primaryDark || "#0369A1" : "#94A3B8"}
            />
            <Text
              style={[
                styles.botonMarcarTodasTexto,
                conteoNoLeidas === 0 && styles.botonMarcarTodasTextoInactivo,
              ]}
            >
              Marcar todas como leídas
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notificaciones}
        keyExtractor={(item) => String(item.id || item.id_notificacion || Math.random())}
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
            <BellOff size={40} color="#64748B" />
            <Text style={styles.emptyTitle}>Sin avisos pendientes</Text>
            <Text style={styles.emptySubtitle}>
              Aquí se mostrarán las asignaciones de ruta, aprobaciones de carga y confirmaciones operativas asignadas a ti.
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
    backgroundColor: Colors.backgroundDark,
  },
  barraAcciones: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contadorTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  botonMarcarTodas: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  botonMarcarTodasInactivo: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  botonMarcarTodasTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primaryDark || "#0369A1",
  },
  botonMarcarTodasTextoInactivo: {
    color: "#94A3B8",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  cardNoLeida: {
    borderColor: Colors.primary,
    borderLeftWidth: 4,
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  tipoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 1,
  },
  tipoTexto: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  fecha: {
    fontSize: 11,
    color: "#334155",
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
  },
  titulo: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  mensaje: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  badgePendiente: {
    alignSelf: "flex-start",
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgePendienteText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primaryDark || "#0369A1",
    letterSpacing: 0.5,
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
    color: "#334155",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18,
  },
});

export default BandejaAvisosScreen;
