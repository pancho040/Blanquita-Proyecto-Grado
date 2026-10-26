import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Wifi, WifiOff, RefreshCw, User, ChevronLeft } from "lucide-react-native";
import { Colors, COLORS } from "../../constants/Colors";
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
  showLogo = true,
}) => {
  const navigation = useNavigation();
  const { isOnline, syncInProgress, forzarSincronizacion } = useNetwork();
  const { user, token } = useAuth();

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

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                { color: isOnline ? Colors.success : Colors.danger },
              ]}
            >
              {syncInProgress ? "..." : isOnline ? "Online" : "Offline"}
            </Text>
            {isOnline && (
              <RefreshCw
                size={11}
                color={Colors.success}
                style={{ marginLeft: 2 }}
              />
            )}
          </TouchableOpacity>
        )}

        {onPerfilPress && (
          <TouchableOpacity
            style={styles.perfilBtn}
            onPress={onPerfilPress}
            activeOpacity={0.7}
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
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  backBtn: {
    marginRight: 8,
    padding: 2,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "#F0F9FF",
  },
  infoCol: {
    flex: 1,
  },
  titulo: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 11.5,
    color: Colors.primary,
    fontWeight: "700",
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
