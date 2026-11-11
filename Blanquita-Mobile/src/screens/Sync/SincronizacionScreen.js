import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useNetwork } from "../../context/NetworkContext";
import { useRuta } from "../../context/RutaContext";
import { useAuth } from "../../context/AuthContext";
import { SyncQueue } from "../../database/syncQueue";
import { Header } from "../../components/common/Header";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import {
  Wifi,
  WifiOff,
  RotateCw,
  Database,
  Server,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react-native";

export const SincronizacionScreen = () => {
  const { isOnline, connectionType, forzarSincronizacion, syncInProgress } = useNetwork();
  const { syncPendientes } = useRuta();
  const { token } = useAuth();

  const [itemsCola, setItemsCola] = useState([]);
  const [cargandoCola, setCargandoCola] = useState(false);

  const cargarCola = async () => {
    setCargandoCola(true);
    const items = await SyncQueue.obtenerPendientes();
    setItemsCola(items || []);
    setCargandoCola(false);
  };

  useEffect(() => {
    cargarCola();
  }, [syncPendientes, syncInProgress]);

  const handleSincronizar = async () => {
    if (!isOnline) {
      Alert.alert(
        "Sin Conexión",
        "El teléfono no tiene acceso a internet actualmente. Las operaciones están resguardadas en la memoria local cifrada y se enviarán automáticamente al retomar señal."
      );
      return;
    }

    const resultado = await forzarSincronizacion(token);
    await cargarCola();

    if (resultado.exitosos > 0) {
      Alert.alert(
        "Sincronización Finalizada",
        `Se procesaron con éxito ${resultado.exitosos} transacciones con el servidor central.`
      );
    } else if (resultado.fallidos > 0) {
      Alert.alert(
        "Aviso de Transmisión",
        `${resultado.fallidos} transacciones presentaron observaciones y continúan en la bandeja local.`
      );
    } else {
      Alert.alert("Bandeja al Día", "No existen operaciones pendientes de transmisión.");
    }
  };

  const formatearTipoOperacion = (tipo) => {
    switch (tipo) {
      case "ENTREGA":
      case "ENTREGA_PEDIDO":
        return "Entrega de Mercadería";
      case "COBRO":
      case "REGISTRO_COBRO":
        return "Cobro de Pedido / Cuota";
      case "ALTA_CLIENTE":
      case "NUEVO_CLIENTE":
        return "Alta de Cliente en Ruta";
      case "NO_ENTREGA":
        return "Constancia de No Entrega";
      case "PING_GPS":
      case "TELEMETRIA_PING":
        return "Posición Satelital GPS";
      case "CIERRE_RUTA":
        return "Arqueo y Cierre de Jornada";
      default:
        return tipo;
    }
  };

  const esErrorCliente4xx = (item) => {
    if (!item.ultimoError) return false;
    const msg = String(item.ultimoError);
    return (
      msg.includes("400") ||
      msg.includes("404") ||
      msg.includes("422") ||
      msg.includes("inválido") ||
      msg.includes("no encontrado") ||
      msg.includes("comprobante")
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Sincronización"
        subtitle="Monitor de transmisiones y almacenamiento local"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Estado de Conectividad */}
        <Card title="Estado del Enlace de Datos" icon={Server} style={styles.cardSection}>
          <View style={styles.statusRow}>
            <View style={styles.statusIconBox}>
              {isOnline ? (
                <Wifi size={22} color={Colors.secondary} />
              ) : (
                <WifiOff size={22} color={Colors.danger} />
              )}
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isOnline ? "Conexión Activa" : "Modo Offline Autónomo"}
              </Text>
              <Text style={styles.statusSub}>
                {isOnline
                  ? `Canal: ${connectionType?.toUpperCase() || "DATOS MÓVILES"} • Enlace establecido`
                  : "Guardando datos localmente con verificación de integridad"}
              </Text>
            </View>
            <Badge
              text={isOnline ? "ONLINE" : "OFFLINE"}
              variant={isOnline ? "success" : "danger"}
            />
          </View>
        </Card>

        {/* Resumen de Cola */}
        <Card title="Almacén Local de Operaciones" icon={Database} style={styles.cardSection}>
          <View style={styles.colaSummaryRow}>
            <View style={styles.colaItem}>
              <Text style={styles.colaLabel}>Operaciones en Bandeja</Text>
              <Text
                style={[
                  styles.colaValue,
                  itemsCola.length > 0 && { color: Colors.accent },
                ]}
              >
                {itemsCola.length}
              </Text>
            </View>

            <View style={styles.colaDivider} />

            <View style={styles.colaItem}>
              <Text style={styles.colaLabel}>Persistencia Local</Text>
              <Text style={[styles.colaValue, { color: Colors.secondary }]}>Protegida</Text>
            </View>
          </View>

          <View style={styles.syncBtnContainer}>
            <Button
              title={syncInProgress ? "Transmitiendo datos..." : "Sincronizar ahora"}
              icon={RotateCw}
              variant="primary"
              loading={syncInProgress || cargandoCola}
              disabled={!isOnline || itemsCola.length === 0}
              onPress={handleSincronizar}
            />
          </View>
        </Card>

        {/* Detalle de Elementos en Cola */}
        <Card
          title={`Detalle de Operaciones (${itemsCola.length})`}
          icon={FileText}
          style={styles.cardSection}
        >
          {itemsCola.length === 0 ? (
            <View style={styles.emptyQueue}>
              <CheckCircle2 size={36} color={Colors.secondary} />
              <Text style={styles.emptyQueueTitle}>Bandeja de Transmisión Vacía</Text>
              <Text style={styles.emptyQueueSub}>
                Todas las entregas, cobros, altas de clientes y cierres están al día en el servidor.
              </Text>
            </View>
          ) : (
            itemsCola.map((item) => {
              const es4xx = esErrorCliente4xx(item);
              return (
                <View key={item.id} style={styles.queueItemRow}>
                  <View style={styles.queueItemLeft}>
                    <Text style={styles.queueItemTitle}>
                      {formatearTipoOperacion(item.tipo)}
                    </Text>
                    <Text style={styles.queueItemTime}>
                      Hora: {new Date(item.timestamp).toLocaleTimeString()} • Intentos:{" "}
                      {item.reintentos || 0}
                    </Text>
                    {item.ultimoError ? (
                      <View style={styles.errorContainer}>
                        {es4xx && <AlertTriangle size={13} color={Colors.warning} />}
                        <Text style={[styles.queueItemError, es4xx && styles.queueItemError4xx]}>
                          {es4xx ? "Observación: " : "Error de red: "}
                          {item.ultimoError}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Badge
                    text={
                      es4xx
                        ? "Requiere Revisión"
                        : item.reintentos > 0
                        ? "Reintentando"
                        : "En Espera"
                    }
                    variant={es4xx ? "warning" : item.reintentos > 0 ? "neutral" : "neutral"}
                  />
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  cardSection: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIconBox: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  statusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  colaSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colaItem: {
    flex: 1,
    alignItems: "center",
  },
  colaDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  colaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  colaValue: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  syncBtnContainer: {
    marginTop: 16,
  },
  emptyQueue: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyQueueTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 10,
  },
  emptyQueueSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  queueItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 48,
  },
  queueItemLeft: {
    flex: 1,
    marginRight: 10,
  },
  queueItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  queueItemTime: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  queueItemError: {
    fontSize: 11,
    color: Colors.danger,
  },
  queueItemError4xx: {
    color: "#B45309",
    fontWeight: "600",
  },
});

export default SincronizacionScreen;
