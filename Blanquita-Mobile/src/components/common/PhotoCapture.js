import { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const PhotoCapture = ({
  titulo = "Foto de Respaldo / Comprobante QR",
  obligatorio = false,
  fotoUri,
  onFotoCapturada,
}) => {
  const [cargando, setCargando] = useState(false);

  const capturarFotoSimulada = () => {
    setCargando(true);
    setTimeout(() => {
      // Mock uri en base64 / dummy para dev y pruebas
      const mockUri = "https://images.unsplash.com/photo-1554415707-9e490171bc4c?w=400";
      onFotoCapturada(mockUri);
      setCargando(false);
    }, 300);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{titulo}</Text>
        {obligatorio && (
          <View style={styles.badgeObligatorio}>
            <Text style={styles.badgeText}>OBLIGATORIO</Text>
          </View>
        )}
      </View>

      {fotoUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: fotoUri }} style={styles.previewImage} resizeMode="cover" />
          <TouchableOpacity
            style={styles.btnCambiar}
            onPress={capturarFotoSimulada}
            activeOpacity={0.8}
          >
            <Text style={styles.btnCambiarTexto}>Cambiar Foto</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.btnCaptura, obligatorio && styles.btnCapturaObligatoria]}
          onPress={capturarFotoSimulada}
          activeOpacity={0.8}
        >
          <Text style={styles.btnIcon}>📷</Text>
          <Text style={styles.btnText}>
            {cargando ? "Abriendo cámara..." : "Capturar Comprobante (Cámara)"}
          </Text>
          <Text style={styles.subtext}>JPG / PNG - Máximo 5MB</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  badgeObligatorio: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.danger,
  },
  btnCaptura: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    minHeight: 80,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  btnCapturaObligatoria: {
    borderColor: Colors.warning,
    borderStyle: "dashed",
  },
  btnIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  subtext: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  previewContainer: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  previewImage: {
    width: "100%",
    height: 160,
  },
  btnCambiar: {
    padding: 10,
    backgroundColor: Colors.backgroundDark,
    alignItems: "center",
  },
  btnCambiarTexto: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});

export default PhotoCapture;
