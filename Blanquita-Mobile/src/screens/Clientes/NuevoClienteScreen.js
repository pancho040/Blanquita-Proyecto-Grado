import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useRuta } from "../../context/RutaContext";
import { useLocation } from "../../context/LocationContext";
import { Header } from "../../components/common/Header";
import { Card } from "../../components/common/Card";
import { Input } from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import {
  UserPlus,
  Store,
  MapPin,
  Phone,
  RotateCw,
  Navigation,
  AlertCircle,
} from "lucide-react-native";

const TIPOS_NEGOCIO = [
  "TIENDA_BARRIO",
  "DISTRIBUIDORA_MAYORISTA",
  "SUPERMERCADO",
  "FARMACIA",
  "INSTITUCION_EDUCATIVA",
  "OTRO",
];

export const NuevoClienteScreen = ({ navigation }) => {
  const { registrarNuevoCliente } = useRuta();
  const { location, getCurrentCoords } = useLocation();

  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [nombrePropietario, setNombrePropietario] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("Sucre");
  const [tipoNegocio, setTipoNegocio] = useState("TIENDA_BARRIO");
  const [observaciones, setObservaciones] = useState("");

  const [loading, setLoading] = useState(false);
  const [refreshingGps, setRefreshingGps] = useState(false);
  const [gpsManualActivado, setGpsManualActivado] = useState(false);
  const [mostrarFallbackGps, setMostrarFallbackGps] = useState(false);

  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    // Si no hay coordenadas satelitales en 4 segundos, ofrecer fallback para interiores
    fallbackTimerRef.current = setTimeout(() => {
      if (!location) {
        setMostrarFallbackGps(true);
      }
    }, 4000);

    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [location]);

  const handleRefrescarGps = async () => {
    setRefreshingGps(true);
    setGpsManualActivado(false);
    await getCurrentCoords();
    setRefreshingGps(false);
  };

  const handleActivarFallbackGps = () => {
    setGpsManualActivado(true);
    setMostrarFallbackGps(false);
  };

  const coordenadasEfectivas = location || (gpsManualActivado ? { latitude: -19.0431, longitude: -65.2592, accuracy: 50 } : null);

  const handleGuardarCliente = async () => {
    if (!razonSocial.trim()) {
      Alert.alert("Falta Información", "Ingrese el nombre o razón social del cliente.");
      return;
    }
    if (!direccion.trim()) {
      Alert.alert("Falta Dirección", "Ingrese la dirección o referencia del negocio.");
      return;
    }

    setLoading(true);

    const lat = coordenadasEfectivas?.latitude || -19.0431;
    const lng = coordenadasEfectivas?.longitude || -65.2592;

    const payload = {
      razon_social: razonSocial.trim(),
      nombre_comercial: nombreComercial.trim() || razonSocial.trim(),
      nombre_propietario: nombrePropietario.trim() || null,
      nit_ci: nitCi.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim(),
      zona: zona.trim(),
      tipo_negocio: tipoNegocio,
      observaciones: observaciones.trim() || null,
      latitud: lat,
      longitud: lng,
    };

    try {
      const resultado = await registrarNuevoCliente(payload);
      setLoading(false);

      if (resultado && (resultado.success || resultado.exito)) {
        Alert.alert(
          "Cliente Registrado",
          "El nuevo cliente y su punto de venta han sido guardados con sus coordenadas GPS.",
          [
            {
              text: "Aceptar",
              onPress: () => {
                if (navigation && navigation.goBack) {
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", resultado?.message || resultado?.error || "No se pudo registrar el cliente.");
      }
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", err.message || "Fallo inesperado al registrar cliente.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Nuevo Cliente"
        subtitle="Registro de punto de venta en ruta"
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Captura de Coordenadas GPS con Fallback para Interiores */}
        <Card title="Punto GPS del Negocio" icon={MapPin} style={styles.cardSection}>
          <View style={styles.gpsRow}>
            <View style={styles.gpsInfo}>
              <Text style={styles.gpsCoords}>
                {coordenadasEfectivas
                  ? `Lat: ${coordenadasEfectivas.latitude.toFixed(6)}, Lng: ${coordenadasEfectivas.longitude.toFixed(6)}`
                  : "Buscando señal satelital..."}
              </Text>
              <Text style={styles.gpsSub}>
                {coordenadasEfectivas
                  ? gpsManualActivado
                    ? "Coordenada de referencia local (modo interiores/sótano)"
                    : `Precisión satelital: ±${Math.round(coordenadasEfectivas.accuracy || 10)}m`
                  : "Acérquese a la puerta del negocio para fijar el punto"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshGpsBtn}
              onPress={handleRefrescarGps}
              disabled={refreshingGps}
              accessibilityLabel="Refrescar señal GPS"
            >
              <RotateCw size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {(!coordenadasEfectivas || mostrarFallbackGps) && !gpsManualActivado && (
            <View style={styles.fallbackContainer}>
              <View style={styles.fallbackHeader}>
                <AlertCircle size={16} color={Colors.warning} />
                <Text style={styles.fallbackTitle}>Baja señal de satélite en interiores</Text>
              </View>
              <Text style={styles.fallbackText}>
                Si está dentro de una galería, sótano o mercado cubierto sin visibilidad al cielo, puede continuar con la coordenada aproximada de la zona.
              </Text>
              <TouchableOpacity
                style={styles.fallbackButton}
                onPress={handleActivarFallbackGps}
                activeOpacity={0.8}
              >
                <Text style={styles.fallbackButtonText}>Continuar sin señal GPS precisa</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Datos Comerciales */}
        <Card title="Datos Comerciales" icon={Store} style={styles.cardSection}>
          <Input
            label="Razón Social *"
            placeholder="Ej: Comercial Los Andes S.R.L. o Flores Rosa"
            value={razonSocial}
            onChangeText={setRazonSocial}
          />

          <Input
            label="Nombre Comercial del Negocio"
            placeholder="Ej: Abarrotes La Esquina"
            value={nombreComercial}
            onChangeText={setNombreComercial}
          />

          <Input
            label="Nombre del Propietario / Encargado"
            placeholder="Ej: Doña Rosa Flores"
            value={nombrePropietario}
            onChangeText={setNombrePropietario}
          />

          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="NIT o CI"
                placeholder="Ej: 4930120"
                value={nitCi}
                onChangeText={setNitCi}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Teléfono / Celular"
                placeholder="Ej: 71234567"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
                icon={Phone}
              />
            </View>
          </View>

          {/* Tipo de Negocio */}
          <Text style={styles.selectorLabel}>Tipo de Establecimiento</Text>
          <View style={styles.tipoGrid}>
            {TIPOS_NEGOCIO.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tipoChip,
                  tipoNegocio === t && styles.tipoChipActive,
                ]}
                onPress={() => setTipoNegocio(t)}
              >
                <Text
                  style={[
                    styles.tipoChipText,
                    tipoNegocio === t && styles.tipoChipTextActive,
                  ]}
                >
                  {t.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Ubicación y Referencias */}
        <Card title="Ubicación y Referencia" icon={Navigation} style={styles.cardSection}>
          <Input
            label="Dirección / Calle *"
            placeholder="Ej: Calle Junín #340 casi esq. Estudiantes"
            value={direccion}
            onChangeText={setDireccion}
          />

          <Input
            label="Zona / Barrio (Sucre)"
            placeholder="Ej: Mercado Campesino / San Roque"
            value={zona}
            onChangeText={setZona}
          />

          <Input
            label="Observaciones adicionales"
            placeholder="Ej: Frente al kiosco azul, atiende por las tardes"
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Botón de Guardado */}
        <View style={styles.submitContainer}>
          <Button
            title="Guardar Cliente"
            icon={UserPlus}
            variant="primary"
            size="large"
            loading={loading}
            onPress={handleGuardarCliente}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  cardSection: {
    marginBottom: 16,
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gpsInfo: {
    flex: 1,
  },
  gpsCoords: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  gpsSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshGpsBtn: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: Colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fallbackContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
  fallbackText: {
    fontSize: 11,
    color: "#92400E",
    lineHeight: 16,
    marginBottom: 8,
  },
  fallbackButton: {
    minHeight: 48,
    backgroundColor: "#F59E0B",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  fallbackButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  formRow: {
    flexDirection: "row",
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  tipoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tipoChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
    justifyContent: "center",
  },
  tipoChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  tipoChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tipoChipTextActive: {
    color: Colors.primary,
    fontWeight: "800",
  },
  submitContainer: {
    marginTop: 8,
  },
});

export default NuevoClienteScreen;
