import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from "react-native";
import { Wifi, WifiOff, RefreshCw, User, ChevronLeft, LogOut } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { useNetwork } from "../../context/NetworkContext";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export const Header = ({
  title,
  titulo,
  subtitle,
  subtitulo,
  onPerfilPress,
  showBackButton = false,
  onBackPress = null,
  showSyncButton = true,
  showActualizarButton = true,
  showLogoutButton = true,
  onActualizarPress = null,
  onLogoutPress = null,
  showLogo = true,
}) => {
  const navigation = useNavigation();
  const {
    isOnline,
    syncInProgress,
    forzarSincronizacion,
    actualizandoDatos,
    refrescarDatosServidor,
  } = useNetwork();
  const { token, estaAutenticado, cerrarSesionConConfirmacion } = useAuth();

  const textoTitulo = title || titulo || "Blanquita";
  const textoSubtitulo = subtitle || subtitulo;

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation?.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleSync = async () => {
    if (forzarSincronizacion) {
      await forzarSincronizacion(token);
    }
  };

  const handleActualizar = async () => {
    if (onActualizarPress) {
      await onActualizarPress();
      return;
    }
    if (!isOnline) {
      Alert.alert(
        "Sin Conexión",
        "No hay conexión a internet para actualizar datos desde el servidor central."
      );
      return;
    }
    const res = await refrescarDatosServidor();
    if (res && res.exito) {
      Alert.alert("Actualizado", "Datos actualizados correctamente desde el servidor central.");
    } else {
      Alert.alert("Aviso", res?.error || res?.mensaje || "No se pudo actualizar en este momento.");
    }
  };

  const handleLogout = () => {
    if (onLogoutPress) {
      onLogoutPress();
    } else if (cerrarSesionConConfirmacion) {
      cerrarSesionConConfirmacion();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Volver"
            accessibilityRole="button"
          >
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        )}

        {showLogo && (
          <Image
            source={require("../../../assets/LogoBlanquita.webp")}
            style={styles.logo}
            resizeMode="contain"
          />
        )}

        <View style={styles.infoCol}>
          <Text style={styles.titulo} numberOfLines={1}>
            {textoTitulo}
          </Text>
          {textoSubtitulo ? (
            <Text style={styles.subtitulo} numberOfLines={1}>
              {textoSubtitulo}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionsRow}>
        {showActualizarButton && estaAutenticado && (
          <TouchableOpacity
            onPress={handleActualizar}
            activeOpacity={0.7}
            disabled={actualizandoDatos || syncInProgress}
            style={styles.actionIconBtn}
            accessibilityLabel="Actualizar datos del servidor"
            accessibilityRole="button"
          >
            {actualizandoDatos ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <RefreshCw size={16} color={Colors.primary} />
            )}
          </TouchableOpacity>
        )}

        {showSyncButton && (
          <TouchableOpacity
            onPress={handleSync}
            activeOpacity={0.7}
            disabled={syncInProgress}
            style={[
              styles.syncBadge,
              isOnline ? styles.syncBadgeOnline : styles.syncBadgeOffline,
            ]}
          >
            {isOnline ? (
              <Wifi size={13} color={Colors.success} />
            ) : (
              <WifiOff size={13} color={Colors.danger} />
            )}
            <Text
              style={[
                styles.syncText,
                { color: isOnline ? "#15803D" : "#B91C1C" },
              ]}
            >
              {syncInProgress ? "..." : isOnline ? "Online" : "Offline"}
            </Text>
          </TouchableOpacity>
        )}

        {showLogoutButton && estaAutenticado && (
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={styles.logoutBtn}
            accessibilityLabel="Cerrar sesión"
            accessibilityRole="button"
          >
            <LogOut size={16} color={Colors.danger} />
          </TouchableOpacity>
        )}

        {onPerfilPress && (
          <TouchableOpacity
            style={styles.perfilBtn}
            onPress={onPerfilPress}
            activeOpacity={0.7}
            accessibilityLabel="Perfil de usuario"
            accessibilityRole="button"
          >
            <User size={17} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  leftSection: {
    flex: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  backBtn: {
    marginRight: 8,
    padding: 2,
    flexShrink: 0,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "#F0F9FF",
    flexShrink: 0,
  },
  infoCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  titulo: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  subtitulo: {
    fontSize: 11.5,
    color: Colors.primaryDark || "#0369A1",
    fontWeight: "700",
    marginTop: 1,
    flexShrink: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  syncBadgeOnline: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  syncBadgeOffline: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  syncText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  perfilBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default Header;
