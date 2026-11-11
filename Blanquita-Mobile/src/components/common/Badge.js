// import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const Badge = ({
  text,
  texto,
  variant = "neutral",
  variante,
  icon: IconComponent = null,
  isNumeric = false,
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
          bg: Colors.successLight,
          text: Colors.success,
          border: Colors.successBorder,
        };
      case "danger":
      case "NO_ENTREGADO":
      case "CANCELADO":
      case "OFFLINE":
        return {
          bg: Colors.dangerLight,
          text: Colors.danger,
          border: Colors.dangerBorder,
        };
      case "warning":
      case "PENDIENTE":
      case "CREDITO":
        return {
          bg: Colors.warningLight,
          text: Colors.warning,
          border: Colors.warningBorder,
        };
      case "primary":
      case "EN_CAMINO":
      case "EN_CURSO":
        return {
          bg: Colors.primaryLight,
          text: Colors.primaryDark,
          border: Colors.borderStrong,
        };
      default:
        return {
          bg: Colors.backgroundDark,
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
      <Text
        style={[
          styles.text,
          { color: c.text },
          isNumeric && styles.tabularText,
          textStyle,
        ]}
      >
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
    borderRadius: 4, // DESIGN.md: Máximo 4px
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  tabularText: {
    fontVariant: ["tabular-nums"], // DESIGN.md: Cifras numéricas tabulares
  },
});

export default Badge;
