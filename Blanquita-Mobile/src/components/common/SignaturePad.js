import { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Colors } from "../../constants/Colors";

export const SignaturePad = ({
  titulo = "Firma Digital Táctil",
  title = null,
  obligatoria = true,
  height = 150,
  onFirmaGuardada,
  onSign,
}) => {
  const labelTitulo = title || titulo;
  const callbackFirma = onSign || onFirmaGuardada;

  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [firmado, setFirmado] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState(null);

  // Referencias para acumular coordenadas durante el gesto táctil
  const currentPathRef = useRef([]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          if (firmado) return;
          setErrorValidacion(null);
          const { locationX, locationY } = evt.nativeEvent;
          const x = Math.round(locationX);
          const y = Math.round(locationY);
          const startPt = `M${x},${y}`;
          currentPathRef.current = [startPt];
          setCurrentPath(startPt);
        },
        onPanResponderMove: (evt) => {
          if (firmado) return;
          const { locationX, locationY } = evt.nativeEvent;
          const x = Math.round(locationX);
          const y = Math.round(locationY);
          const newPt = `L${x},${y}`;
          currentPathRef.current.push(newPt);
          setCurrentPath(currentPathRef.current.join(" "));
        },
        onPanResponderRelease: () => {
          if (firmado) return;
          if (currentPathRef.current && currentPathRef.current.length > 1) {
            const finalPath = currentPathRef.current.join(" ");
            setPaths((prev) => [...prev, finalPath]);
          }
          currentPathRef.current = [];
          setCurrentPath(null);
        },
      }),
    [firmado]
  );

  const handleLimpiarFirma = () => {
    setPaths([]);
    setCurrentPath(null);
    currentPathRef.current = [];
    setFirmado(false);
    setErrorValidacion(null);
    if (callbackFirma) {
      callbackFirma(null);
    }
  };

  const handleConfirmarFirma = () => {
    if (paths.length === 0 && !currentPath) {
      setErrorValidacion("Debe dibujar su firma en el recuadro antes de confirmar.");
      return;
    }

    // Generar vector SVG válido y ligero
    const allPaths = [...paths];
    if (currentPath) {
      allPaths.push(currentPath);
    }

    const pathElements = allPaths
      .map(
        (p) =>
          `<path d="${p}" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join("");

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${height}" viewBox="0 0 300 ${height}">${pathElements}</svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

    setFirmado(true);
    setErrorValidacion(null);
    if (callbackFirma) {
      callbackFirma(dataUri);
    }
  };

  // Helper para simular trazo en entornos sin gestos de pantalla (como pruebas automatizadas)
  const handleSimularTrazo = () => {
    const dummyPath = `M20,${Math.round(height / 2)} Q80,${Math.round(height / 4)} 150,${Math.round(height / 2)} T280,${Math.round(height / 2)}`;
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="${height}" viewBox="0 0 300 ${height}"><path d="${dummyPath}" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    setPaths([dummyPath]);
    setFirmado(true);
    setErrorValidacion(null);
    if (callbackFirma) {
      callbackFirma(dataUri);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{labelTitulo}</Text>
        {obligatoria && (
          <View style={styles.badgeObligatorio}>
            <Text style={styles.badgeText}>OBLIGATORIA</Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.canvasBox,
          { height },
          firmado && styles.canvasFirmado,
          Boolean(errorValidacion) && styles.canvasError,
        ]}
        {...(!firmado ? panResponder.panHandlers : {})}
      >
        {/* Renderizado de trazos SVG en tiempo real */}
        <Svg height={height} width="100%" style={StyleSheet.absoluteFill}>
          {paths.map((p, idx) => (
            <Path
              key={idx}
              d={p}
              fill="none"
              stroke={Colors.secondary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath && (
            <Path
              d={currentPath}
              fill="none"
              stroke={Colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>

        {/* Guía visual o estado firmado */}
        {!firmado && paths.length === 0 && !currentPath && (
          <View style={styles.placeholderContainer} pointerEvents="none">
            <Text style={styles.canvasPlaceholder}>Dibuje su firma con el dedo aquí</Text>
            <View style={styles.firmaLineaGuia} />
          </View>
        )}

        {firmado && (
          <View style={styles.badgeFirmadoFlotante} pointerEvents="none">
            <Text style={styles.firmaTexto}>✓ Firma Registrada</Text>
          </View>
        )}
      </View>

      {errorValidacion && (
        <Text style={styles.errorText}>{errorValidacion}</Text>
      )}

      <View style={styles.actionsRow}>
        {!firmado ? (
          <>
            <TouchableOpacity
              style={styles.btnSimularDev}
              onPress={handleSimularTrazo}
              activeOpacity={0.7}
            >
              <Text style={styles.btnSimularTexto}>Trazo Rápido</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnLimpiar}
              onPress={handleLimpiarFirma}
              disabled={paths.length === 0 && !currentPath}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.btnLimpiarTexto,
                  paths.length === 0 && !currentPath && styles.btnDisabled,
                ]}
              >
                LIMPIAR
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnConfirmar}
              onPress={handleConfirmarFirma}
              activeOpacity={0.8}
            >
              <Text style={styles.btnConfirmarTexto}>CONFIRMAR FIRMA</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.btnLimpiar}
            onPress={handleLimpiarFirma}
            activeOpacity={0.7}
          >
            <Text style={styles.btnLimpiarTexto}>VOLVER A FIRMAR</Text>
          </TouchableOpacity>
        )}
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
    fontWeight: "700",
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
    fontWeight: "800",
    color: Colors.danger,
  },
  canvasBox: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  canvasFirmado: {
    borderColor: Colors.success,
    backgroundColor: "#F0FDF4",
  },
  canvasError: {
    borderColor: Colors.danger,
  },
  placeholderContainer: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  canvasPlaceholder: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 4,
  },
  firmaLineaGuia: {
    width: "100%",
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    borderStyle: "dashed",
  },
  badgeFirmadoFlotante: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  firmaTexto: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.success,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  btnLimpiar: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  btnLimpiarTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.danger,
  },
  btnConfirmar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: Colors.primaryDark,
  },
  btnConfirmarTexto: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnSimularDev: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  btnSimularTexto: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  btnDisabled: {
    color: Colors.textMuted,
  },
});

export default SignaturePad;
