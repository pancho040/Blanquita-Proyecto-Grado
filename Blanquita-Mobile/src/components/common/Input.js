// import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none",
  editable = true,
  error = null,
  icon: IconComponent = null,
  multiline = false,
  numberOfLines = 1,
  isNumeric = false,
  style = {},
  inputStyle = {},
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          !editable && styles.disabledWrapper,
          error && styles.errorWrapper,
        ]}
      >
        {IconComponent && (
          <View style={styles.iconContainer}>
            <IconComponent size={18} color={error ? Colors.danger : Colors.textMuted} />
          </View>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          style={[
            styles.input,
            multiline && { minHeight: numberOfLines * 24, textAlignVertical: "top" },
            isNumeric && styles.numericText,
            inputStyle,
          ]}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1, // DESIGN.md: 1px sólido
    borderColor: Colors.border,
    borderRadius: 4, // DESIGN.md: Máximo 4px
    paddingHorizontal: 12,
    minHeight: 48, // DESIGN.md: Target táctil >= 48px
  },
  disabledWrapper: {
    backgroundColor: Colors.backgroundDark,
    opacity: 0.7,
  },
  errorWrapper: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  iconContainer: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: Colors.text,
    fontSize: 15,
  },
  numericText: {
    fontVariant: ["tabular-nums"], // DESIGN.md: Números tabulares alineados
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: "600",
    marginTop: 4,
  },
});

export default Input;
