import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const Badge = ({
  text,
  texto,
  variant = "neutral",
  variante,
  icon: IconComponent = null,
  style = {},
  textStyle = {},
}) => {
  const label = text || texto || "";
  const v = variant || variante || "neutral";

  const getColores = () => {
    switch (v) {
      case "success":
      case "ENTREGADO":
      case "PAGADO":
      case "ONLINE":
        return {
          bg: "rgba(16, 185, 129, 0.15)",
          text: Colors.success,
          border: "rgba(16, 185, 129, 0.3)",
        };
      case "danger":
      case "NO_ENTREGADO":
      case "CANCELADO":
      case "OFFLINE":
        return {
          bg: "rgba(239, 68, 68, 0.15)",
          text: Colors.danger,
          border: "rgba(239, 68, 68, 0.3)",
        };
      case "warning":
      case "PENDIENTE":
      case "CREDITO":
        return {
          bg: "rgba(245, 158, 11, 0.15)",
          text: Colors.accent,
          border: "rgba(245, 158, 11, 0.3)",
        };
      case "primary":
      case "EN_CAMINO":
      case "EN_CURSO":
        return {
          bg: Colors.primaryMuted,
          text: Colors.primary,
          border: Colors.primary,
        };
      default:
        return {
          bg: "rgba(148, 163, 184, 0.15)",
          text: Colors.textSecondary,
          border: Colors.border,
        };
    }
  };

  const c = getColores();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: c.bg, borderColor: c.border },
        style,
      ]}
    >
      {IconComponent && (
        <IconComponent size={12} color={c.text} style={styles.icon} />
      )}
      <Text style={[styles.text, { color: c.text }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});

export default Badge;
