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
  CheckCircle2,
  XCircle,
  FileEdit,
  TrendingUp,
  AlertTriangle,
  Clock,
  Info,
  MapPin,
  RefreshCw,
  ClipboardCheck,
  Flag,
} from "lucide-react-native";

export const BandejaAvisosScreen = ({ navigation }) => {
  const {
    notificaciones,
    conteoNoLeidas,
    cargando,
    refrescarNotificaciones,
    manejarPresionarAviso,
  } = useNotificaciones();

  const obtenerIconoYColorPorTipo = (tipo) => {
    const tipoNorm = String(tipo || "").toUpperCase();
    switch (tipoNorm) {
      case "RUTA_ASIGNADA":
        return {
          icono: MapPin,
          color: "#0284C7",
          fondoBadge: "#F0F9FF",
          bordeBadge: "#BAE6FD",
          etiqueta: "Ruta Asignada",
        };
      case "CARGA_CAMION_APROBADA":
        return {
          icono: CheckCircle2,
          color: "#15803D",
          fondoBadge: "#F0FDF4",
          bordeBadge: "#86EFAC",
          etiqueta: "Carga Aprobada",
        };
      case "CARGA_CAMION_OBSERVADA":
        return {
          icono: AlertTriangle,
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
          icono: RefreshCw,
          color: "#0E7490",
          fondoBadge: "#F0FDFA",
          bordeBadge: "#99F6E4",
          etiqueta: "Ruta Reordenada",
        };
      case "OPERACION_REVISADA":
        return {
          icono: ClipboardCheck,
          color: "#0E7490",
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
      case "ABONO_APROBADO":
        return {
          icono: CheckCircle2,
          color: "#15803D",
          fondoBadge: "#F0FDF4",
          bordeBadge: "#86EFAC",
          etiqueta: "Abono QR Aprobado",
        };
      case "ABONO_RECHAZADO":
        return {
          icono: XCircle,
          color: "#B91C1C",
          fondoBadge: "#FEF2F2",
          bordeBadge: "#FCA5A5",
          etiqueta: "Abono QR Observado",
        };
      case "AJUSTE_NOTA":
        return {
          icono: FileEdit,
          color: "#B45309",
          fondoBadge: "#FFFBEB",
          bordeBadge: "#FDE68A",
          etiqueta: "Nota Modificada",
        };
      case "STOCK_ACTUALIZADO":
      case "ALERTA_REVALORIZACION":
        return {
          icono: TrendingUp,
          color: "#0369A1",
          fondoBadge: "#F0F9FF",
          bordeBadge: "#BAE6FD",
          etiqueta: "Revalorización Stock",
        };
      case "RECORDATORIO_CIERRE":
      case "FALTANTE_CIERRE":
        return {
          icono: AlertTriangle,
          color: "#B45309",
          fondoBadge: "#FFFBEB",
          bordeBadge: "#FDE68A",
          etiqueta: "Arqueo / Cierre",
        };
      case "CAMBIO_PRECIO":
        return {
          icono: Clock,
          color: "#4338CA",
          fondoBadge: "#EEF2FF",
          bordeBadge: "#C7D2FE",
          etiqueta: "Precios Actualizados",
        };
      default:
        return {
          icono: Info,
          color: Colors.primaryDark || "#0369A1",
          fondoBadge: "#F0F9FF",
          bordeBadge: "#BAE6FD",
          etiqueta: tipo || "Aviso Oficial",
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
              Aquí se notificarán aprobaciones/rechazos de cobros QR, ajustes de notas de venta y avisos de revalorización.
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
