import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useNetwork } from "../../context/NetworkContext";
import { useAuth } from "../../context/AuthContext";
import { SyncQueue } from "../../database/syncQueue";
import { LocalDB } from "../../database/localDb";
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
  Lock,
  User,
  Clock,
} from "lucide-react-native";

export const SincronizacionScreen = () => {
  const { isOnline, connectionType, forzarSincronizacion, syncInProgress, pendientes } = useNetwork();
  const { usuario, sesionExpirada } = useAuth();

  const [itemsCola, setItemsCola] = useState([]);
  const [cargandoCola, setCargandoCola] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);

  const cargarCola = useCallback(async () => {
    setCargandoCola(true);
    try {
      const usuarioId = usuario?.IdUsuario || usuario?.id_usuario;
      const items = await SyncQueue.obtenerPendientes(usuarioId);
      setItemsCola(items || []);
      const ultima = await LocalDB.obtenerUltimaSincronizacion();
      setUltimaSync(ultima);
    } catch (_err) {
      setItemsCola([]);
    } finally {
      setCargandoCola(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargarCola();
  }, [cargarCola, pendientes, syncInProgress]);

  const handleSincronizar = async () => {
    if (!isOnline) {
      Alert.alert(
        "Sin Conexión",
        "El teléfono no tiene acceso a internet actualmente. Las operaciones están resguardadas en la memoria local cifrada y se enviarán automáticamente al retomar señal."
      );
      return;
    }

    if (sesionExpirada) {
      Alert.alert(
        "Sesión Expirada",
        "Debes volver a ingresar tus credenciales para reanudar el envío. Tus datos están guardados seguros en el teléfono."
      );
      return;
    }

    const resultado = await forzarSincronizacion();
    await cargarCola();

    if (resultado.procesadas > 0) {
      Alert.alert(
        "Sincronización Exitosa",
        `Se enviaron con éxito ${resultado.procesadas} operaciones al servidor central.`
      );
    } else if (resultado.fallidas > 0) {
      Alert.alert(
        "Aviso de Transmisión",
        `${resultado.fallidas} operaciones presentaron fallas y se mantendrán guardadas en el teléfono para reintento.`
      );
    } else if (resultado.omitidas4xx > 0) {
      Alert.alert(
        "Observación de Validación",
        `Hay ${resultado.omitidas4xx} operación(es) con error de validación 4xx. Revisa el motivo e intenta corregirla.`
      );
    } else {
      Alert.alert("Al Día", "Todas las operaciones ya fueron transmitidas.");
    }
  };

  const handleReintentarItem = async (idOperacion) => {
    await SyncQueue.resetearErrorOperacion(idOperacion);
    await cargarCola();
    if (isOnline && !sesionExpirada) {
      await forzarSincronizacion();
      await cargarCola();
    }
  };

  const formatearTipoOperacion = (tipo) => {
    switch (tipo) {
      case "ENTREGA":
      case "ENTREGA_PEDIDO":
        return "Entrega de Mercadería";
      case "ENTREGA_CON_COBRO":
        return "Entrega y Cobro Unificado";
      case "COBRO":
      case "REGISTRO_COBRO":
        return "Cobro de Saldo / Deuda";
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

  const formatearHora = (isoStr) => {
    if (!isoStr) return "--:--";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "--:--";
      return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "--:--";
    }
  };

  const formatearFechaHora = (isoStr) => {
    if (!isoStr) return "Sin registro reciente";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "Sin registro reciente";
      return `${d.toLocaleDateString("es-BO")} ${d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return "Sin registro reciente";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Conexión y Sincronización"
        subtitle="Monitor de transmisiones y almacenamiento local"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={cargandoCola} onRefresh={cargarCola} />
        }
      >
        {/* Banner de Sesión Expirada si aplica */}
        {sesionExpirada && (
          <View style={styles.bannerSesionExpirada}>
            <Lock size={18} color="#FFFFFF" />
            <View style={styles.bannerSesionTexto}>
              <Text style={styles.bannerSesionTitulo}>Sesión Pausada</Text>
              <Text style={styles.bannerSesionSub}>
                Inicia sesión para sincronizar (tus datos están seguros en el teléfono).
              </Text>
            </View>
          </View>
        )}

        {/* Estado del Enlace de Datos */}
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
                  ? `Canal: ${String(connectionType).toUpperCase()} • Enlace disponible`
                  : "Guardado en el teléfono, pendiente de enviar"}
              </Text>
            </View>
            <Badge
              text={isOnline ? "ONLINE" : "OFFLINE"}
              variant={isOnline ? "success" : "danger"}
            />
          </View>

          <View style={styles.divider} />

          {/* Estado de la Sesión y Chofer */}
          <View style={styles.sessionInfoRow}>
            <User size={16} color={Colors.textSecondary} />
            <Text style={styles.sessionInfoText}>
              Chofer: <Text style={styles.bold}>{usuario?.NombreCompleto || usuario?.nombre || "Carlos Mamani"}</Text>
            </Text>
            <Badge
              text={sesionExpirada ? "RENOVAR SESIÓN" : "SESIÓN VIGENTE"}
              variant={sesionExpirada ? "warning" : "success"}
            />
          </View>

          {/* Última Sincronización Exitosa */}
          <View style={styles.lastSyncRow}>
            <Clock size={15} color={Colors.textMuted} />
            <Text style={styles.lastSyncText}>
              Último envío exitoso: {formatearFechaHora(ultimaSync)}
            </Text>
          </View>
        </Card>

        {/* Resumen de Cola */}
        <Card title="Almacén Local de Operaciones" icon={Database} style={styles.cardSection}>
          <View style={styles.colaSummaryRow}>
            <View style={styles.colaItem}>
              <Text style={styles.colaLabel}>Pendientes de Enviar</Text>
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
              <Text style={styles.colaLabel}>Estado Local</Text>
              <Text style={[styles.colaValue, { color: Colors.secondary }]}>Protegido</Text>
            </View>
          </View>

          <View style={styles.syncBtnContainer}>
            <Button
              title={syncInProgress ? "Transmitiendo datos..." : "Sincronizar ahora"}
              icon={RotateCw}
              variant="primary"
              loading={syncInProgress}
              disabled={!isOnline || itemsCola.length === 0 || sesionExpirada}
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
              <Text style={styles.emptyQueueTitle}>Bandeja al Día</Text>
              <Text style={styles.emptyQueueSub}>
                Todas las entregas, cobros y cierres han sido transmitidos al servidor central.
              </Text>
            </View>
          ) : (
            itemsCola.map((item) => {
              const esError4xx = Boolean(item.esErrorPermanente);
              const hora = formatearHora(item.fechaCreacion || item.timestamp || item.fechaHora);
              const intentos = item.intentos || item.reintentos || 0;

              return (
                <View key={item.id} style={styles.queueItemRow}>
                  <View style={styles.queueItemLeft}>
                    <Text style={styles.queueItemTitle}>
                      {formatearTipoOperacion(item.tipo)}
                    </Text>
                    <Text style={styles.queueItemTime}>
                      Hora: {hora} • Intentos: {intentos} • {item.estado || "Guardado en el teléfono, pendiente de enviar"}
                    </Text>
                    {item.ultimoError ? (
                      <View style={styles.errorContainer}>
                        <AlertTriangle size={13} color={esError4xx ? Colors.danger : Colors.warning} />
                        <Text style={[styles.queueItemError, esError4xx && styles.queueItemError4xx]}>
                          {item.ultimoError}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.queueItemRight}>
                    <Badge
                      text={
                        esError4xx
                          ? "Error de Validación"
                          : intentos > 0
                          ? "Reintentando"
                          : "Pendiente"
                      }
                      variant={esError4xx ? "danger" : intentos > 0 ? "warning" : "neutral"}
                    />
                    {esError4xx && (
                      <TouchableOpacity
                        style={styles.btnReintentarItem}
                        onPress={() => handleReintentarItem(item.id)}
                      >
                        <Text style={styles.btnReintentarItemTexto}>Reintentar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
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
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  cardSection: {
    marginBottom: 16,
  },
  bannerSesionExpirada: {
    backgroundColor: "#B45309",
    borderRadius: 4,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bannerSesionTexto: {
    flex: 1,
  },
  bannerSesionTitulo: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  bannerSesionSub: {
    color: "#FFFFFF",
    fontSize: 11,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIconBox: {
    width: 42,
    height: 42,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  sessionInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionInfoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    marginLeft: 6,
  },
  bold: {
    fontWeight: "700",
    color: Colors.text,
  },
  lastSyncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  lastSyncText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  colaSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
  },
  colaItem: {
    alignItems: "center",
  },
  colaLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  colaValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
  },
  colaDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  syncBtnContainer: {
    marginTop: 14,
  },
  emptyQueue: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyQueueTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 8,
  },
  emptyQueueSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 16,
  },
  queueItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  queueItemLeft: {
    flex: 1,
    paddingRight: 8,
  },
  queueItemRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  queueItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  queueItemTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  queueItemError: {
    fontSize: 11,
    color: Colors.warning,
    flex: 1,
  },
  queueItemError4xx: {
    color: Colors.danger,
    fontWeight: "600",
  },
  btnReintentarItem: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  btnReintentarItemTexto: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primaryDark,
  },
});

export default SincronizacionScreen;
