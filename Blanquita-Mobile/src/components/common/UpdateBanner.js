import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { setSoftUpdateListener } from "../../api/client";
import { Info, X } from "lucide-react-native";

/**
 * Banner no bloqueante de versión sugerida (Punto 5 / Cierre 1.3).
 * Se activa si el servidor indica que hay una versión más reciente disponible,
 * pero SIN cabecera de bloqueo duro (x-upgrade-required).
 * Permite que el chofer continúe operando normalmente en la calle.
 */
export const UpdateBanner = () => {
  const [visible, setVisible] = useState(false);
  const [sugeridaVersion, setSugeridaVersion] = useState("");

  useEffect(() => {
    setSoftUpdateListener((version) => {
      if (version) {
        setSugeridaVersion(version);
        setVisible(true);
      }
    });
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.leftIcon}>
        <Info size={18} color="#FFFFFF" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>NUEVA VERSIÓN DISPONIBLE {sugeridaVersion ? `(v${sugeridaVersion})` : ""}</Text>
        <Text style={styles.message}>
          Hay una actualización lista. Puedes continuar trabajando y actualizar al terminar tu turno.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setVisible(false)}
        activeOpacity={0.7}
        accessibilityLabel="Cerrar aviso"
      >
        <X size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0369A1", // Slate sky 700 (AA contrast > 4.5:1 con blanco)
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#0284C7",
  },
  leftIcon: {
    marginRight: 10,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  message: {
    fontSize: 11,
    color: "#F0F9FF",
    marginTop: 2,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default UpdateBanner;
