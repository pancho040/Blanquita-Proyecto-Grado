import { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "../../constants/Colors";
import { setHardBlockListener } from "../../api/client";
import { SyncQueue } from "../../database/syncQueue";
import { SyncService } from "../../services/syncService";
import { ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react-native";

/**
 * Modal NO cancelable de actualización obligatoria (Punto 5 / Cierre 1.3).
 * Se activa ÚNICAMENTE si el backend devuelve un bloqueo duro explícito
 * (x-upgrade-required: true o HTTP 426).
 *
 * REGLA ESTRICTA (Punto 5):
 * "El modal de bloqueo duro NUNCA debe impedir sincronizar la cola pendiente."
 * Incluye acceso directo y operativo para sincronizar los cobros y entregas locales
 * antes de salir a instalar el nuevo APK.
 */
export const ActualizacionRequeridaModal = () => {
  const [bloqueado, setBloqueado] = useState(false);
  const [minVersion, setMinVersion] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [mensajeSync, setMensajeSync] = useState(null);

  useEffect(() => {
    setHardBlockListener((required, version) => {
      setBloqueado(Boolean(required));
      if (version) setMinVersion(version);
      if (required) {
        SyncQueue.contarPendientes().then((cnt) => setPendientes(cnt));
      }
    });
  }, []);

  const handleSincronizarCola = async () => {
    setSincronizando(true);
    setMensajeSync(null);
    try {
      const resultado = await SyncService.procesarCola(true);
      const restantes = await SyncQueue.contarPendientes();
      setPendientes(restantes);
      if (resultado.exito) {
        setMensajeSync(`Cola sincronizada con éxito (${resultado.procesadas || 0} enviadas).`);
      } else {
        setMensajeSync(resultado.mensaje || "Sincronización completada parcialmente.");
      }
    } catch (_err) {
      setMensajeSync("No se pudo conectar con el servidor para sincronizar.");
    } finally {
      setSincronizando(false);
    }
  };

  if (!bloqueado) return null;

  return (
    <Modal
      visible={bloqueado}
      transparent={false}
      animationType="fade"
      onRequestClose={() => {
        // Bloqueo duro: no cancelable con botón atrás
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <ShieldAlert size={56} color={Colors.error} />
          </View>
          <Text style={styles.title}>ACTUALIZACIÓN REQUERIDA</Text>
          <Text style={styles.mensaje}>
            Actualización requerida. Contacte al administrador.
          </Text>
          {minVersion ? (
            <Text style={styles.versionInfo}>
              Versión mínima exigida por el servidor: v{minVersion}
            </Text>
          ) : null}

          <View style={styles.avisoBloqueo}>
            <Text style={styles.avisoBloqueoText}>
              Por motivos de seguridad y consistencia, se ha suspendido el registro de nuevas operaciones locales hasta instalar la nueva versión.
            </Text>
          </View>

          {/* Sección de Sincronización de Cola Pendiente Permitida */}
          <View style={styles.syncSection}>
            <Text style={styles.syncSectionTitle}>
              COLA LOCAL PENDIENTE: {pendientes} OPERACIÓN(ES)
            </Text>
            <Text style={styles.syncSectionSub}>
              Puedes sincronizar tus transacciones registradas para no perder información antes de actualizar:
            </Text>

            <TouchableOpacity
              style={[styles.syncButton, sincronizando && styles.syncButtonDisabled]}
              onPress={handleSincronizarCola}
              disabled={sincronizando}
              activeOpacity={0.8}
            >
              {sincronizando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <RefreshCw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.syncButtonText}>
                {sincronizando ? "SINCRONIZANDO COLA..." : "SINCRONIZAR COLA PENDIENTE"}
              </Text>
            </TouchableOpacity>

            {mensajeSync ? (
              <View style={styles.syncFeedbackRow}>
                <CheckCircle2 size={16} color={Colors.success} />
                <Text style={styles.syncFeedbackText}>{mensajeSync}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  mensaje: {
    fontSize: 15,
    fontWeight: "600",
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 20,
  },
  versionInfo: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
    textAlign: "center",
  },
  avisoBloqueo: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    width: "100%",
  },
  avisoBloqueoText: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    lineHeight: 18,
  },
  syncSection: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  syncSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  syncSectionSub: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 16,
  },
  syncButton: {
    flexDirection: "row",
    backgroundColor: Colors.primaryDark || "#157A9E",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 48,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  syncFeedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 8,
  },
  syncFeedbackText: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: "600",
    marginLeft: 6,
    textAlign: "center",
  },
});

export default ActualizacionRequeridaModal;
