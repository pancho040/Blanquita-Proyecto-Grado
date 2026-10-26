import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { useLocation } from '../../context/LocationContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  DollarSign,
  QrCode,
  Banknote,
  Receipt,
  MapPin,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';

export const RegistrarCobroScreen = ({ route, navigation }) => {
  const { parada, cliente, pedido } = route.params;
  const { registrarCobro } = useRuta();
  const { location } = useLocation();

  const totalPedido = Number(pedido?.monto_total || 0);
  const saldoPendiente = Number(cliente?.saldo_pendiente || 0);

  const [monto, setMonto] = useState(
    totalPedido > 0 ? totalPedido.toFixed(2) : ''
  );
  const [metodoPago, setMetodoPago] = useState('EFECTIVO'); // 'EFECTIVO' | 'TRANSFERENCIA_QR'
  const [tipoCobro, setTipoCobro] = useState('CONTADO'); // 'CONTADO' | 'ABONO'
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSeleccionarMontoSugerido = (val) => {
    setMonto(val.toFixed(2));
  };

  const handleConfirmarCobro = async () => {
    const numMonto = parseFloat(monto);
    if (isNaN(numMonto) || numMonto <= 0) {
      Alert.alert('Monto Inválido', 'Ingrese un importe válido mayor a 0 Bs.');
      return;
    }

    if (metodoPago === 'TRANSFERENCIA_QR' && !referencia.trim()) {
      Alert.alert(
        'Falta Referencia',
        'Por favor ingrese el número de comprobante o referencia de la transferencia QR.'
      );
      return;
    }

    setLoading(true);

    const datosCobro = {
      cliente_id: cliente?.id || parada?.cliente_id,
      pedido_id: pedido?.id || null,
      monto: numMonto,
      metodo_pago: metodoPago,
      tipo_cobro: tipoCobro,
      referencia_bancaria: referencia.trim() || null,
      observaciones: observaciones.trim() || null,
    };

    const resultado = await registrarCobro(parada.id, datosCobro);
    setLoading(false);

    if (resultado.success) {
      Alert.alert(
        'Cobro Registrado',
        `Se registró el cobro de Bs. ${numMonto.toFixed(2)} (${
          metodoPago === 'EFECTIVO' ? 'Efectivo en mano' : 'Transferencia QR'
        }).`,
        [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', resultado.message || 'No se pudo guardar el cobro.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Registrar Cobro"
        subtitle={cliente?.razon_social || cliente?.nombre_comercial}
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Resumen de Montos Pendientes */}
        <Card title="Montos del Cliente" icon={DollarSign} style={styles.cardSection}>
          <View style={styles.montosRow}>
            <TouchableOpacity
              style={styles.montoChip}
              onPress={() => handleSeleccionarMontoSugerido(totalPedido)}
            >
              <Text style={styles.chipLabel}>Monto de este Pedido</Text>
              <Text style={styles.chipVal}>Bs. {totalPedido.toFixed(2)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.montoChip}
              onPress={() => handleSeleccionarMontoSugerido(saldoPendiente)}
            >
              <Text style={styles.chipLabel}>Saldo Anterior</Text>
              <Text
                style={[
                  styles.chipVal,
                  saldoPendiente > 0 && { color: Colors.danger },
                ]}
              >
                Bs. {saldoPendiente.toFixed(2)}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Método de Pago (Efectivo vs QR) */}
        <Card title="Método de Pago" icon={Receipt} style={styles.cardSection}>
          <View style={styles.selectorGrid}>
            <TouchableOpacity
              style={[
                styles.selectorBtn,
                metodoPago === 'EFECTIVO' && styles.selectorBtnActive,
              ]}
              onPress={() => setMetodoPago('EFECTIVO')}
            >
              <Banknote
                size={24}
                color={metodoPago === 'EFECTIVO' ? Colors.primary : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.selectorBtnText,
                  metodoPago === 'EFECTIVO' && styles.selectorBtnTextActive,
                ]}
              >
                Efectivo
              </Text>
              <Text style={styles.selectorBtnSub}>Dinero en Mano</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorBtn,
                metodoPago === 'TRANSFERENCIA_QR' && styles.selectorBtnActive,
              ]}
              onPress={() => setMetodoPago('TRANSFERENCIA_QR')}
            >
              <QrCode
                size={24}
                color={metodoPago === 'TRANSFERENCIA_QR' ? Colors.primary : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.selectorBtnText,
                  metodoPago === 'TRANSFERENCIA_QR' && styles.selectorBtnTextActive,
                ]}
              >
                QR / Transferencia
              </Text>
              <Text style={styles.selectorBtnSub}>Banca Móvil</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Tipo de Cobro (Contado vs Abono) */}
        <Card title="Tipo de Cobro" icon={Receipt} style={styles.cardSection}>
          <View style={styles.selectorGrid}>
            <TouchableOpacity
              style={[
                styles.selectorBtn,
                tipoCobro === 'CONTADO' && styles.selectorBtnActive,
              ]}
              onPress={() => setTipoCobro('CONTADO')}
            >
              <Text
                style={[
                  styles.selectorBtnText,
                  tipoCobro === 'CONTADO' && styles.selectorBtnTextActive,
                ]}
              >
                Pago Contado
              </Text>
              <Text style={styles.selectorBtnSub}>Cancela pedido completo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.selectorBtn,
                tipoCobro === 'ABONO' && styles.selectorBtnActive,
              ]}
              onPress={() => setTipoCobro('ABONO')}
            >
              <Text
                style={[
                  styles.selectorBtnText,
                  tipoCobro === 'ABONO' && styles.selectorBtnTextActive,
                ]}
              >
                Abono a Cuenta
              </Text>
              <Text style={styles.selectorBtnSub}>Pago parcial de deuda</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Formulario de Importe y Referencia */}
        <Card title="Detalles del Pago" icon={DollarSign} style={styles.cardSection}>
          <Input
            label="Importe Cobrado (Bs.) *"
            placeholder="0.00"
            value={monto}
            onChangeText={setMonto}
            keyboardType="decimal-pad"
            icon={DollarSign}
          />

          {metodoPago === 'TRANSFERENCIA_QR' ? (
            <Input
              label="Nº de Comprobante / Referencia Bancaria *"
              placeholder="Ej: OP-984021 o últimos 4 dígitos"
              value={referencia}
              onChangeText={setReferencia}
            />
          ) : null}

          <Input
            label="Observaciones"
            placeholder="Ej: Pagó con billete de 200, cambio devuelto"
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={2}
          />

          <View style={styles.gpsIndicatorRow}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.gpsIndicatorText}>
              {location
                ? `GPS Registrado: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                : 'GPS listo para captura automática'}
            </Text>
          </View>
        </Card>

        {/* Botón de Confirmación */}
        <View style={styles.submitContainer}>
          <Button
            title={`Confirmar Cobro Bs. ${parseFloat(monto || 0).toFixed(2)}`}
            icon={CheckCircle2}
            variant="secondary"
            size="large"
            loading={loading}
            onPress={handleConfirmarCobro}
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
  montosRow: {
    flexDirection: 'row',
    gap: 12,
  },
  montoChip: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  chipVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  selectorGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  selectorBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  selectorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 6,
  },
  selectorBtnTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  selectorBtnSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  gpsIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  gpsIndicatorText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  submitContainer: {
    marginTop: 8,
  },
});

export default RegistrarCobroScreen;
