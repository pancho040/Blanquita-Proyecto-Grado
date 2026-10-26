import React from "react";
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
  size = "md",          // "sm" | "md" | "lg" | "small" | "large"
  loading = false,
  disabled = false,
  icon: IconComponent = null,
  style = {},
  textStyle = {},
}) => {
  const getBackgroundColor = () => {
    if (disabled) return "#475569";
    switch (variant) {
      case "primary":
        return Colors.primary;
      case "secondary":
        return Colors.secondary;
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
    if (disabled) return "#94A3B8";
    if (variant === "outline") return Colors.primary;
    return "#FFFFFF";
  };

  const getPadding = () => {
    switch (size) {
      case "sm":
      case "small":
        return { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 };
      case "lg":
      case "large":
        return { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 14 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 };
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
        variant === "outline" && {
          borderWidth: 1.5,
          borderColor: disabled ? "#475569" : Colors.primary,
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
                    ? 16
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
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
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
    textAlign: "center",
  },
});

export default Button;
