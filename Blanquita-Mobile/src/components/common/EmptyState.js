// import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const EmptyState = ({
  titulo = "Sin registros disponibles",
  mensaje = "No hay datos para mostrar en este momento.",
  textoBoton,
  onPressBoton,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.message}>{mensaje}</Text>
      {textoBoton && onPressBoton && (
        <TouchableOpacity style={styles.button} onPress={onPressBoton} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{textoBoton}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    marginVertical: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  button: {
    marginTop: 16,
    backgroundColor: Colors.primaryDark,
    borderRadius: 4,
    minHeight: 48,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default EmptyState;
