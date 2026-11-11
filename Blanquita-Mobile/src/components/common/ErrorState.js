// import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const ErrorState = ({
  titulo = "Ocurrió un problema",
  mensaje = "No se pudieron obtener los datos. Verifique su conexión.",
  onReintentar,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.message}>{mensaje}</Text>
      {onReintentar && (
        <TouchableOpacity style={styles.button} onPress={onReintentar} activeOpacity={0.8}>
          <Text style={styles.buttonText}>REINTENTAR</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: 4,
    alignItems: "center",
    marginVertical: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.danger,
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  button: {
    marginTop: 14,
    backgroundColor: Colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default ErrorState;
