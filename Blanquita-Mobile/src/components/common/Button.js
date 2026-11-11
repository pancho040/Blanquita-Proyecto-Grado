// import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";

export const Button = ({
  title,
  onPress,
  variant = "primary", // "primary" | "secondary" | "success" | "danger" | "outline"
  size = "md",          // "sm" | "md" | "lg"
  loading = false,
  disabled = false,
  icon: IconComponent = null,
  style = {},
  textStyle = {},
}) => {
  const getBackgroundColor = () => {
    if (disabled) return "#94A3B8";
    switch (variant) {
      case "primary":
        return Colors.primary;
      case "secondary":
        return Colors.surface;
      case "success":
        return Colors.success;
      case "danger":
        return Colors.danger;
      case "outline":
        return "transparent";
      default:
        return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return "#FFFFFF";
    if (variant === "outline") return Colors.primary;
    if (variant === "secondary") return Colors.text;
    return "#FFFFFF";
  };

  const getPadding = () => {
    switch (size) {
      case "sm":
      case "small":
        return { paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 };
      case "lg":
      case "large":
        return { paddingVertical: 14, paddingHorizontal: 20, minHeight: 52 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 }; // Target táctil >= 48px
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        getPadding(),
        { backgroundColor: getBackgroundColor() },
        (variant === "outline" || variant === "secondary") && {
          borderWidth: 1,
          borderColor: disabled ? "#94A3B8" : (variant === "secondary" ? Colors.border : Colors.primary),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {IconComponent && (
            <View style={styles.iconContainer}>
              <IconComponent
                size={size === "sm" || size === "small" ? 16 : 18}
                color={getTextColor()}
              />
            </View>
          )}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize:
                  size === "sm" || size === "small"
                    ? 13
                    : size === "lg" || size === "large"
                    ? 15
                    : 14,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 4, // DESIGN.md: Máximo 4px de radio
    alignItems: "center",
    justifyContent: "center",
    elevation: 0, // Sin sombras AI-slop
    shadowOpacity: 0,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export default Button;
