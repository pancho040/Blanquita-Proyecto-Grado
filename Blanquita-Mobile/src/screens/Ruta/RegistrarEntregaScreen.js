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
import { Badge } from '../../components/common/Badge';
import { ComprobanteModal } from '../../components/ruta/ComprobanteModal';
import {
  PackageCheck,
  UserCheck,
  MapPin,
  FileText,
  AlertTriangle,
  RotateCw,
  Plus,
  Minus,
} from 'lucide-react-native';

export const RegistrarEntregaScreen = ({ route, navigation }) => {
  const { parada, pedido } = route.params;
  const { registrarEntrega, comprobanteActual, cerrarComprobante } = useRuta();
  const { location, gpsStatus, getCurrentCoords } = useLocation();

  // Cantidades de los ítems
  const [items, setItems] = useState(
    (pedido?.items || []).map((i) => ({
      ...i,
      cantidadEntregada: i.cantidad || 1,
    }))
  );

  const [receptorNombre, setReceptorNombre] = useState(
    parada.cliente?.razon_social || ''
  );
  const [receptorCi, setReceptorCi] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);

  const actualizarCantidad = (index, delta) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          const nuevaCant = Math.max(0, item.cantidadEntregada + delta);
          return { ...item, cantidadEntregada: nuevaCant };
        }
        return item;
      })
    );
  };

  const handleRefrescarGps = async () => {
    setGettingGps(true);
    await getCurrentCoords();
    setGettingGps(false);
  };

  const calcularTotalEntregado = () => {
    return items.reduce((acc, item) => {
      return acc + (item.cantidadEntregada || 0) * (item.precio_unitario || 0);
    }, 0);
  };

  const handleConfirmarEntrega = async () => {
    if (!receptorNombre.trim()) {
      Alert.alert('Faltan Datos', 'Ingrese el nombre de la persona que recibe la mercadería.');
      return;
    }

    const totalFardos = items.reduce((acc, i) => acc + (i.cantidadEntregada || 0), 0);
    if (totalFardos === 0) {
      Alert.alert('Cantidad Inválida', 'La cantidad entregada debe ser mayor a 0 fardos.');
      return;
    }

    setLoading(true);

    const datosEntrega = {
      recibido_por: receptorNombre.trim(),
      ci_receptor: receptorCi.trim(),
      observaciones: observaciones.trim(),
      items_entregados: items.map((i) => ({
        producto_id: i.producto_id || i.id,
        producto_nombre: i.producto_nombre || i.producto?.nombre,
        cantidad: i.cantidadEntregada,
        precio_unitario: i.precio_unitario,
        subtotal: i.cantidadEntregada * (i.precio_unitario || 0),
      })),
      monto_total: calcularTotalEntregado(),
    };

    const resultado = await registrarEntrega(parada.id, datosEntrega);
    setLoading(false);

    if (resultado.success) {
      // El modal ComprobanteModal se abrirá automáticamente porque comprobanteActual fue seteado en el contexto
    } else {
      Alert.alert('Error', resultado.message || 'No se pudo registrar la entrega.');
    }
  };

  const handleCerrarComprobanteYVolver = () => {
    cerrarComprobante();
    navigation.popToTop(); // Volver a Hoja de Ruta
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Registrar Entrega"
        subtitle={parada.cliente?.razon_social || parada.cliente?.nombre_comercial}
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Coordenadas de Entrega */}
        <Card
          title="Ubicación GPS"
          icon={MapPin}
          style={styles.gpsCard}
        >
          <View style={styles.gpsRow}>
            <View style={styles.gpsInfo}>
              <Text style={styles.gpsCoords}>
                {location
                  ? `Lat: ${location.latitude.toFixed(5)}, Lng: ${location.longitude.toFixed(5)}`
                  : 'Obteniendo señal satelital...'}
              </Text>
              <Text style={styles.gpsSub}>
                {location
                  ? `Precisión: ±${Math.round(location.accuracy || 10)}m`
                  : 'Asegúrese de tener encendida la ubicación del teléfono'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshGpsBtn}
              onPress={handleRefrescarGps}
              disabled={gettingGps}
            >
              <RotateCw size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Ajuste de Fardos / Productos */}
        <Card
          title="Verificación de Fardos"
          icon={PackageCheck}
          style={styles.cardSection}
        >
          {items.map((item, index) => (
            <View key={index} style={styles.itemEditor}>
              <View style={styles.itemEditorDetails}>
                <Text style={styles.itemEditorName}>
                  {item.producto_nombre || item.producto?.nombre || 'Fardo de Papel'}
                </Text>
                <Text style={styles.itemEditorPrice}>
                  Bs. {Number(item.precio_unitario || 0).toFixed(2)} c/u
                </Text>
              </View>

              {/* Controles de incremento / decremento */}
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => actualizarCantidad(index, -1)}
                >
                  <Minus size={16} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{item.cantidadEntregada}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => actualizarCantidad(index, 1)}
                >
                  <Plus size={16} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={styles.totalBox}>
            <Text style={styles.totalBoxLabel}>Total a Facturar / Entregar:</Text>
            <Text style={styles.totalBoxAmount}>
              Bs. {calcularTotalEntregado().toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Datos del Receptor */}
        <Card
          title="Receptor de Mercadería"
          icon={UserCheck}
          style={styles.cardSection}
        >
          <Input
            label="Nombre de quien recibe *"
            placeholder="Ej: Juan Pérez (Encargado)"
            value={receptorNombre}
            onChangeText={setReceptorNombre}
          />

          <Input
            label="Cédula de Identidad (Receptor)"
            placeholder="Ej: 5849301 LP"
            value={receptorCi}
            onChangeText={setReceptorCi}
            keyboardType="default"
          />

          <Input
            label="Observaciones / Novedades"
            placeholder="Ej: Entregado en piso 2, producto conforme."
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Botón de Confirmación */}
        <View style={styles.submitContainer}>
          <Button
            title="Confirmar Entrega"
            icon={PackageCheck}
            variant="primary"
            size="large"
            loading={loading}
            onPress={handleConfirmarEntrega}
          />
        </View>
      </ScrollView>

      {/* Modal de Comprobante Digital */}
      <ComprobanteModal
        visible={!!comprobanteActual}
        comprobante={comprobanteActual}
        onClose={handleCerrarComprobanteYVolver}
      />
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
  gpsCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
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
  cardSection: {
    marginBottom: 16,
  },
  itemEditor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemEditorDetails: {
    flex: 1,
    marginRight: 10,
  },
  itemEditorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  itemEditorPrice: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  counterBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    minWidth: 32,
    textAlign: 'center',
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalBoxLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  totalBoxAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.secondary,
  },
  submitContainer: {
    marginTop: 8,
  },
});

export default RegistrarEntregaScreen;
