// import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const NumericInput = ({
  label,
  value,
  onChangeText,
  placeholder = "0.00",
  moneda = "Bs",
  editable = true,
  error,
}) => {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error && styles.wrapperError]}>
        {moneda && <Text style={styles.moneda}>{moneda}</Text>}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType="numeric"
          editable={editable}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  wrapperError: {
    borderColor: Colors.danger,
  },
  moneda: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
});

export default NumericInput;
