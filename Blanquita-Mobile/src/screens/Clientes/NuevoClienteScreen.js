import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { useLocation } from '../../context/LocationContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  UserPlus,
  Store,
  MapPin,
  Phone,
  FileText,
  RotateCw,
  CheckCircle2,
  Navigation,
} from 'lucide-react-native';

const TIPOS_NEGOCIO = [
  'TIENDA_BARRIO',
  'DISTRIBUIDORA_MAYORISTA',
  'SUPERMERCADO',
  'FARMACIA',
  'INSTITUCION_EDUCATIVA',
  'OTRO',
];

export const NuevoClienteScreen = ({ navigation }) => {
  const { registrarNuevoCliente } = useRuta();
  const { location, getCurrentCoords } = useLocation();

  const [razonSocial, setRazonSocial] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [nitCi, setNitCi] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [zona, setZona] = useState('Sucre');
  const [tipoNegocio, setTipoNegocio] = useState('TIENDA_BARRIO');
  const [observaciones, setObservaciones] = useState('');

  const [loading, setLoading] = useState(false);
  const [refreshingGps, setRefreshingGps] = useState(false);

  const handleRefrescarGps = async () => {
    setRefreshingGps(true);
    await getCurrentCoords();
    setRefreshingGps(false);
  };

  const handleGuardarCliente = async () => {
    if (!razonSocial.trim()) {
      Alert.alert('Falta Información', 'Ingrese el nombre o razón social del cliente.');
      return;
    }
    if (!direccion.trim()) {
      Alert.alert('Falta Dirección', 'Ingrese la dirección o referencia del negocio.');
      return;
    }

    setLoading(true);

    const payload = {
      razon_social: razonSocial.trim(),
      nombre_comercial: nombreComercial.trim() || razonSocial.trim(),
      nit_ci: nitCi.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim(),
      zona: zona.trim(),
      tipo_negocio: tipoNegocio,
      observaciones: observaciones.trim() || null,
      latitud: location?.latitude || -19.0431,
      longitud: location?.longitude || -65.2592,
    };

    const resultado = await registrarNuevoCliente(payload);
    setLoading(false);

    if (resultado.success) {
      Alert.alert(
        'Cliente Registrado',
        'El nuevo cliente y su punto de venta han sido guardados con sus coordenadas GPS.',
        [
          {
            text: 'Aceptar',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      Alert.alert('Error', resultado.message || 'No se pudo registrar el cliente.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Nuevo Cliente"
        subtitle="Registro de punto de venta"
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Captura de Coordenadas GPS Automática */}
        <Card title="Punto GPS del Negocio" icon={MapPin} style={styles.cardSection}>
          <View style={styles.gpsRow}>
            <View style={styles.gpsInfo}>
              <Text style={styles.gpsCoords}>
                {location
                  ? `Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}`
                  : 'Esperando señal satelital...'}
              </Text>
              <Text style={styles.gpsSub}>
                {location
                  ? `Precisión de sensor: ±${Math.round(location.accuracy || 10)}m`
                  : 'Acérquese a la puerta del negocio para fijar el punto'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshGpsBtn}
              onPress={handleRefrescarGps}
              disabled={refreshingGps}
            >
              <RotateCw size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Datos Principales */}
        <Card title="Datos Comerciales" icon={Store} style={styles.cardSection}>
          <Input
            label="Razón Social / Nombre del Propietario *"
            placeholder="Ej: Doña Rosa Flores"
            value={razonSocial}
            onChangeText={setRazonSocial}
          />

          <Input
            label="Nombre Comercial del Negocio"
            placeholder="Ej: Abarrotes La Esquina"
            value={nombreComercial}
            onChangeText={setNombreComercial}
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
                  {t.replace('_', ' ')}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpsInfo: {
    flex: 1,
  },
  gpsCoords: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  gpsSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshGpsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  formRow: {
    flexDirection: 'row',
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  tipoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tipoChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipoChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  tipoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tipoChipTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  submitContainer: {
    marginTop: 8,
  },
});

export default NuevoClienteScreen;
