import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

export const SignaturePad = ({
  titulo = "Firma del Chofer (Recepción de Carga)",
  obligatoria = true,
  onFirmaGuardada,
}) => {
  const [firmado, setFirmado] = useState(false);

  const handleSimularFirma = () => {
    setFirmado(true);
    const mockSignatureSvg = "data:image/svg+xml;utf8,<svg>MOCK_SIGNATURE</svg>";
    if (onFirmaGuardada) {
      onFirmaGuardada(mockSignatureSvg);
    }
  };

  const handleLimpiarFirma = () => {
    setFirmado(false);
    if (onFirmaGuardada) {
      onFirmaGuardada(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{titulo}</Text>
        {obligatoria && (
          <View style={styles.badgeObligatorio}>
            <Text style={styles.badgeText}>OBLIGATORIA</Text>
          </View>
        )}
      </View>

      <View style={[styles.canvasBox, firmado && styles.canvasFirmado]}>
        {firmado ? (
          <View style={styles.firmaRegistrada}>
            <Text style={styles.firmaTexto}>✍️ Firma Digital Registrada</Text>
            <Text style={styles.firmaSubtexto}>Registrada con fecha y hora del dispositivo</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.canvasArea}
            onPress={handleSimularFirma}
            activeOpacity={0.8}
          >
            <Text style={styles.canvasPlaceholder}>Toque aquí para firmar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.btnLimpiar}
          onPress={handleLimpiarFirma}
          disabled={!firmado}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnLimpiarTexto, !firmado && styles.btnDisabled]}>LIMPIAR FIRMA</Text>
        </TouchableOpacity>
      </View>
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
  canvasBox: {
    height: 120,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  canvasFirmado: {
    borderColor: Colors.successBorder,
    backgroundColor: Colors.successLight,
  },
  canvasArea: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  canvasPlaceholder: {
    color: Colors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  firmaRegistrada: {
    alignItems: "center",
  },
  firmaTexto: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.success,
  },
  firmaSubtexto: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  btnLimpiar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    minHeight: 48,
    justifyContent: "center",
  },
  btnLimpiarTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.danger,
  },
  btnDisabled: {
    color: Colors.textMuted,
  },
});

export default SignaturePad;
