import React from "react";
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
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  disabledWrapper: {
    backgroundColor: "#1E293B",
    opacity: 0.6,
  },
  errorWrapper: {
    borderColor: Colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  iconContainer: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 46,
    color: Colors.text,
    fontSize: 15,
  },
  errorText: {
    fontSize: 11,
    color: Colors.danger,
    fontWeight: "600",
    marginTop: 4,
  },
});

export default Input;
