// import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const LoadingState = ({ mensaje = "Cargando..." }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primaryDark} />
      <Text style={styles.text}>{mensaje}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
});

export default LoadingState;
