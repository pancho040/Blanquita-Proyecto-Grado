import { useState, useEffect } from 'react';
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
import { NumericInput } from '../../components/common/NumericInput';
import { SignaturePad } from '../../components/common/SignaturePad';
import { ComprobanteModal } from '../../components/ruta/ComprobanteModal';
import { LogisticaApi } from '../../api/logisticaApi';
import {
  PackageCheck,
  UserCheck,
  MapPin,
  RotateCw,
  Gift,
  Truck,
  FileCheck2,
} from 'lucide-react-native';

export const RegistrarEntregaScreen = ({ route, navigation }) => {
  const { parada, pedido } = route.params;
  const { registrarEntrega, comprobanteActual, cerrarComprobante } = useRuta();
  const { location, getCurrentCoords } = useLocation();

  // Stock en camión cargado por el chofer
  const [inventarioCamion, setInventarioCamion] = useState([]);
  const [tipoEntrega, setTipoEntrega] = useState('TOTAL'); // 'TOTAL' | 'PARCIAL'

  // Items a entregar
  const [items, setItems] = useState(
    (pedido?.items || []).map((i) => ({
      ...i,
      presentacion_id: i.presentacion_id || i.IdPresentacion || i.id,
      cantidadOriginal: Number(i.cantidad || i.Cantidad || 1),
      cantidadEntregada: Number(i.cantidad || i.Cantidad || 1),
      precio_unitario: Number(i.precio_unitario || i.PrecioUnitarioAplicado || 0),
      es_bandeo: Boolean(i.es_bandeo || i.EsBandeo),
      valor_bandeo: Number(i.valor_bandeo || i.ValorBandeo || 0),
    }))
  );

  const [receptorNombre, setReceptorNombre] = useState(
    parada?.cliente?.razon_social || parada?.NombreCliente || ''
  );
  const [receptorCi, setReceptorCi] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [firmaChofer, setFirmaChofer] = useState(null);
  const [firmaCliente, setFirmaCliente] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);

  // Cargar inventario del camión para verificar saldo
  useEffect(() => {
    let activo = true;
    async function cargarStock() {
      const datos = await LogisticaApi.obtenerMiInventarioCamion();
      if (activo && datos?.items) {
        setInventarioCamion(datos.items);
      }
    }
    cargarStock();
    return () => {
      activo = false;
    };
  }, []);

  const handleRefrescarGps = async () => {
    setGettingGps(true);
    await getCurrentCoords();
    setGettingGps(false);
  };

  const handleCambiarCantidad = (index, valor) => {
    const num = Math.max(0, parseFloat(valor) || 0);
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, cantidadEntregada: num } : item))
    );
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
      Alert.alert('Cantidad Inválida', 'La cantidad entregada debe ser mayor a 0 bultos.');
      return;
    }

    // Regla 2: Doble firma digital táctil obligatoria (Chofer y Cliente receptor)
    if (!firmaChofer) {
      Alert.alert('Firma del Chofer Requerida', 'El chofer debe estampar su firma digital táctil obligatoria.');
      return;
    }

    if (!firmaCliente) {
      Alert.alert('Firma del Cliente Requerida', 'El cliente o receptor en tienda debe estampar su firma digital táctil de conformidad.');
      return;
    }

    setLoading(true);

    const payloadEntrega = {
      id_pedido: pedido?.id || pedido?.IdPedido || parada?.IdPedido,
      latitud: location?.latitude || -19.0483,
      longitud: location?.longitude || -65.2598,
      tipo_entrega: tipoEntrega,
      recibido_por: receptorNombre.trim(),
      ci_receptor: receptorCi.trim(),
      observaciones: observaciones.trim(),
      firma_chofer: firmaChofer,
      firma_cliente: firmaCliente,
      items_entregados: items.map((i) => ({
        presentacion_id: i.presentacion_id,
        producto_nombre: i.producto_nombre || i.NombreProducto || 'Producto Blanquita',
        cantidad: i.cantidadEntregada,
        precio_unitario: i.precio_unitario,
        subtotal: i.cantidadEntregada * i.precio_unitario,
      })),
      monto_total: calcularTotalEntregado(),
    };

    const resultado = await registrarEntrega(parada.id || parada.IdPuntoVenta, payloadEntrega);
    setLoading(false);

    if (resultado.success || resultado.exito) {
      if (resultado.alertaRevalorizacion) {
        Alert.alert('Aviso de Tarifa', resultado.alertaRevalorizacion);
      }
    } else {
      Alert.alert('Error', resultado.error || resultado.message || 'No se pudo registrar la entrega.');
    }
  };

  const handleCerrarComprobanteYVolver = () => {
    cerrarComprobante();
    navigation.popToTop();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Registrar Entrega"
        subtitle={parada?.cliente?.razon_social || parada?.NombreCliente || 'Punto de Venta'}
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Ubicación GPS */}
        <Card title="Ubicación GPS" icon={MapPin} style={styles.gpsCard}>
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
              <RotateCw size={18} color={Colors.primaryDark} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Modalidad de Entrega */}
        <Card title="Tipo de Entrega" icon={Truck} style={styles.cardSection}>
          <View style={styles.tipoRow}>
            <TouchableOpacity
              style={[styles.tipoBtn, tipoEntrega === 'TOTAL' && styles.tipoBtnActive]}
              onPress={() => setTipoEntrega('TOTAL')}
            >
              <Text style={[styles.tipoBtnText, tipoEntrega === 'TOTAL' && styles.tipoBtnTextActive]}>
                Entrega Total
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tipoBtn, tipoEntrega === 'PARCIAL' && styles.tipoBtnActive]}
              onPress={() => setTipoEntrega('PARCIAL')}
            >
              <Text style={[styles.tipoBtnText, tipoEntrega === 'PARCIAL' && styles.tipoBtnTextActive]}>
                Entrega Parcial
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Verificación de Productos y Bandeo */}
        <Card title="Productos a Entregar" icon={PackageCheck} style={styles.cardSection}>
          {items.map((item, index) => {
            const stockCamionItem = inventarioCamion.find(
              (s) => s.presentacion_id === item.presentacion_id
            );
            const saldoCamion = stockCamionItem ? stockCamionItem.cantidad_remanente : null;

            return (
              <View key={index} style={styles.itemBox}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>
                    {item.producto_nombre || item.NombreProducto || 'Paquete Papel Blanquita'}
                  </Text>
                  <Text style={styles.itemPrice}>
                    Bs. {item.precio_unitario.toFixed(2)} c/u
                  </Text>
                </View>

                {/* Saldo en camión */}
                {saldoCamion !== null && (
                  <View style={styles.saldoRow}>
                    <Truck size={14} color={Colors.textSecondary} />
                    <Text style={styles.saldoText}>
                      Saldo en tu camión: <Text style={styles.saldoNum}>{saldoCamion} bultos</Text>
                    </Text>
                  </View>
                )}

                {/* Bandeo de cortesía */}
                {(item.es_bandeo || item.valor_bandeo > 0) && (
                  <View style={styles.bandeoBadge}>
                    <Gift size={14} color={Colors.accent} />
                    <Text style={styles.bandeoText}>
                      Promoción Bandeo: Incluye {item.valor_bandeo || 2} servilleta(s) de cortesía (Costo Bs. 0.00)
                    </Text>
                  </View>
                )}

                {/* Control de cantidad */}
                <View style={styles.cantidadRow}>
                  <Text style={styles.cantidadLabel}>Cantidad a entregar:</Text>
                  <NumericInput
                    value={item.cantidadEntregada}
                    onChange={(val) => handleCambiarCantidad(index, val)}
                    min={0}
                    max={item.cantidadOriginal}
                    style={styles.numericInput}
                  />
                </View>
              </View>
            );
          })}

          <View style={styles.totalBox}>
            <Text style={styles.totalBoxLabel}>Total a Entregar / Cobrar:</Text>
            <Text style={styles.totalBoxAmount}>
              Bs. {calcularTotalEntregado().toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Receptor de Mercadería */}
        <Card title="Receptor de Mercadería" icon={UserCheck} style={styles.cardSection}>
          <Input
            label="Nombre de quien recibe *"
            placeholder="Ej: Doña Carmen / Encargado"
            value={receptorNombre}
            onChangeText={setReceptorNombre}
          />
          <Input
            label="Cédula de Identidad (Opcional)"
            placeholder="Ej: 5849301 PT"
            value={receptorCi}
            onChangeText={setReceptorCi}
          />
          <Input
            label="Observaciones"
            placeholder="Ej: Entregado conforme en trastienda"
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Doble Firma Táctil Obligatoria: Chofer y Cliente (Regla 2) */}
        <Card title="1. Firma Táctil del Chofer *" icon={FileCheck2} style={styles.cardSection}>
          <Text style={styles.firmaDesc}>
            El chofer debe estampar su firma digital táctil obligatoria para certificar la salida y entrega de la carga.
          </Text>
          <SignaturePad
            onSign={(firmaSvg) => setFirmaChofer(firmaSvg)}
            title="Firmar Entrega (Chofer)"
            height={140}
          />
          {firmaChofer && (
            <View style={styles.firmaOkRow}>
              <Text style={styles.firmaOkText}>✓ Firma del chofer registrada</Text>
            </View>
          )}
        </Card>

        <Card title="2. Firma Táctil del Cliente Receptor *" icon={FileCheck2} style={styles.cardSection}>
          <Text style={styles.firmaDesc}>
            El cliente o receptor debe estampar su firma digital táctil en señal de conformidad de los bultos recibidos.
          </Text>
          <SignaturePad
            onSign={(firmaSvg) => setFirmaCliente(firmaSvg)}
            title="Firmar Recepción (Cliente)"
            height={140}
          />
          {firmaCliente && (
            <View style={styles.firmaOkRow}>
              <Text style={styles.firmaOkText}>✓ Firma del cliente receptor registrada</Text>
            </View>
          )}
        </Card>

        {/* Botón de Confirmación */}
        <View style={styles.submitContainer}>
          <Button
            title="Confirmar y Registrar Entrega"
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
        visible={Boolean(comprobanteActual)}
        comprobante={comprobanteActual}
        onClose={handleCerrarComprobanteYVolver}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  gpsCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryDark,
    borderRadius: 4,
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
    fontWeight: '600',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  gpsSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  refreshGpsBtn: {
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#64748B',
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSection: {
    marginBottom: 16,
    borderRadius: 4,
  },
  tipoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 4,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  tipoBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  tipoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  tipoBtnTextActive: {
    color: '#FFFFFF',
  },
  itemBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  saldoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  saldoText: {
    fontSize: 12,
    color: '#475569',
  },
  saldoNum: {
    fontWeight: '700',
    color: Colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  bandeoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 6,
    gap: 6,
  },
  bandeoText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  cantidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cantidadLabel: {
    fontSize: 13,
    color: '#334155',
  },
  numericInput: {
    width: 140,
  },
  totalBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#0F172A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBoxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  totalBoxAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  firmaDesc: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  firmaOkRow: {
    marginTop: 6,
  },
  firmaOkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
});

export default RegistrarEntregaScreen;
