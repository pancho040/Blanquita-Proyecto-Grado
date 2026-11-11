import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { formatearFrescura } from "../../utils/frescuraHelper";
import { Clock, AlertTriangle, RefreshCw } from "lucide-react-native";

export const FrescuraIndicador = ({ ultimaSincronizacion, onActualizar, cargando = false }) => {
  const [frescura, setFrescura] = useState(() => formatearFrescura(ultimaSincronizacion));

  useEffect(() => {
    setFrescura(formatearFrescura(ultimaSincronizacion));
    // Actualizar el contador de tiempo cada 30 segundos
    const timer = setInterval(() => {
      setFrescura(formatearFrescura(ultimaSincronizacion));
    }, 30000);

    return () => clearInterval(timer);
  }, [ultimaSincronizacion]);

  return (
    <View style={styles.container}>
      <View style={styles.tiempoFila}>
        <Clock size={12} color="#64748B" />
        <Text style={styles.tiempoTexto}>{frescura.texto}</Text>
      </View>

      {frescura.desactualizado && (
        <TouchableOpacity
          style={styles.avisoDesactualizado}
          onPress={onActualizar}
          disabled={cargando}
          activeOpacity={0.8}
        >
          <View style={styles.avisoContenido}>
            <AlertTriangle size={14} color="#B45309" />
            <Text style={styles.avisoTexto}>
              {frescura.mensajeAdvertencia}
            </Text>
          </View>
          <RefreshCw size={13} color="#B45309" style={cargando ? styles.rotando : null} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#F8FAFC",
  },
  tiempoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tiempoTexto: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  avisoDesactualizado: {
    marginTop: 4,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avisoContenido: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  avisoTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
    flex: 1,
  },
  rotando: {
    opacity: 0.5,
  },
});

export default FrescuraIndicador;
