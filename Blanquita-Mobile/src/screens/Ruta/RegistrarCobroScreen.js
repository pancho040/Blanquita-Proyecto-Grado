import { useState, useMemo } from 'react';
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
import { PaymentSelector } from '../../components/common/PaymentSelector';
import { PhotoCapture } from '../../components/common/PhotoCapture';
import {
  DollarSign,
  Receipt,
  Clock,
  Layers,
} from 'lucide-react-native';

export const RegistrarCobroScreen = ({ route, navigation }) => {
  const { parada, cliente, pedido } = route.params || {};
  const { registrarCobro } = useRuta();
  const { location } = useLocation();

  const totalPedido = Number(pedido?.monto_total || pedido?.MontoTotal || 0);
  const saldoPendiente = Number(cliente?.saldo_pendiente || 0);

  // Modalidad de pago: SIMPLE o MIXTO
  const [esMixto, setEsMixto] = useState(false);

  // Cobro Simple
  const [metodoSimple, setMetodoSimple] = useState('EFECTIVO');
  const [montoSimple, setMontoSimple] = useState(totalPedido > 0 ? totalPedido.toFixed(2) : '');
  const [referenciaSimple, setReferenciaSimple] = useState('');
  const [fotoSimpleUri, setFotoSimpleUri] = useState(null);

  // Cobro Mixto (Desglose)
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoQr, setMontoQr] = useState('');
  const [referenciaQr, setReferenciaQr] = useState('');
  const [fotoQrUri, setFotoQrUri] = useState(null);

  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [referenciaTransf, setReferenciaTransf] = useState('');
  const [fotoTransfUri, setFotoTransfUri] = useState(null);

  const [montoCredito, setMontoCredito] = useState('');
  const [diasCredito, setDiasCredito] = useState('15');

  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSeleccionarMontoSugerido = (val) => {
    if (!esMixto) {
      setMontoSimple(val.toFixed(2));
    } else {
      setMontoEfectivo(val.toFixed(2));
    }
  };

  const calcularTotalMixto = () => {
    const ef = parseFloat(montoEfectivo) || 0;
    const qr = parseFloat(montoQr) || 0;
    const tr = parseFloat(montoTransferencia) || 0;
    const cr = parseFloat(montoCredito) || 0;
    return ef + qr + tr + cr;
  };

  const fotoRequeridaFalta = useMemo(() => {
    if (!esMixto) {
      if ((metodoSimple === 'QR' || metodoSimple === 'TRANSFERENCIA') && !fotoSimpleUri) {
        return true;
      }
    } else {
      const qr = parseFloat(montoQr) || 0;
      const tr = parseFloat(montoTransferencia) || 0;
      if (qr > 0 && !fotoQrUri) return true;
      if (tr > 0 && !fotoTransfUri) return true;
    }
    return false;
  }, [esMixto, metodoSimple, fotoSimpleUri, montoQr, fotoQrUri, montoTransferencia, fotoTransfUri]);

  const handleConfirmarCobro = async () => {
    let payload = {};

    if (!esMixto) {
      const numMonto = parseFloat(montoSimple);
      if (isNaN(numMonto) || numMonto <= 0) {
        Alert.alert('Monto Inválido', 'Ingrese un importe válido mayor a Bs. 0.');
        return;
      }

      // Regla 3: QR y Transferencia exigen comprobante fotográfico obligatorio
      if ((metodoSimple === 'QR' || metodoSimple === 'TRANSFERENCIA') && !fotoSimpleUri) {
        Alert.alert(
          'Comprobante Obligatorio',
          `El cobro mediante ${metodoSimple} exige obligatoriamente fotografía del comprobante de transferencia bancaria.`
        );
        return;
      }

      payload = {
        id_pedido: pedido?.id || pedido?.IdPedido || parada?.IdPedido,
        monto_total: numMonto,
        latitud: location?.latitude || -19.0483,
        longitud: location?.longitude || -65.2598,
        pagos: [
          {
            metodo: metodoSimple,
            monto: numMonto,
            numero_referencia: referenciaSimple.trim() || null,
            foto_uri: fotoSimpleUri || null,
          },
        ],
        observaciones: observaciones.trim() || null,
      };
    } else {
      // Cobro Mixto
      const ef = parseFloat(montoEfectivo) || 0;
      const qr = parseFloat(montoQr) || 0;
      const tr = parseFloat(montoTransferencia) || 0;
      const cr = parseFloat(montoCredito) || 0;
      const total = ef + qr + tr + cr;

      if (total <= 0) {
        Alert.alert('Monto Inválido', 'La suma de los tramos debe ser mayor a Bs. 0.');
        return;
      }

      if (qr > 0 && !fotoQrUri) {
        Alert.alert('Comprobante QR Requerido', 'Debe tomar o adjuntar la foto del comprobante QR.');
        return;
      }

      if (tr > 0 && !fotoTransfUri) {
        Alert.alert('Comprobante Transferencia Requerido', 'Debe tomar la foto del comprobante de transferencia.');
        return;
      }

      const pagos = [];
      if (ef > 0) pagos.push({ metodo: 'EFECTIVO', monto: ef });
      if (qr > 0) {
        pagos.push({
          metodo: 'QR',
          monto: qr,
          numero_referencia: referenciaQr.trim() || null,
          foto_uri: fotoQrUri || null,
        });
      }
      if (tr > 0) {
        pagos.push({
          metodo: 'TRANSFERENCIA',
          monto: tr,
          numero_referencia: referenciaTransf.trim() || null,
          foto_uri: fotoTransfUri || null,
        });
      }
      if (cr > 0) {
        pagos.push({
          metodo: 'CREDITO',
          monto: cr,
          plazo_dias: parseInt(diasCredito, 10) || 15,
        });
      }

      payload = {
        id_pedido: pedido?.id || pedido?.IdPedido || parada?.IdPedido,
        monto_total: total,
        latitud: location?.latitude || -19.0483,
        longitud: location?.longitude || -65.2598,
        pagos,
        observaciones: observaciones.trim() || null,
      };
    }

    setLoading(true);
    const resultado = await registrarCobro(parada?.id || parada?.IdPuntoVenta, payload);
    setLoading(false);

    if (resultado.success || resultado.exito) {
      const tieneDigital = !esMixto
        ? metodoSimple === 'QR' || metodoSimple === 'TRANSFERENCIA'
        : (parseFloat(montoQr) || 0) > 0 || (parseFloat(montoTransferencia) || 0) > 0;

      const mensajeAviso = tieneDigital
        ? 'Cobro registrado. El tramo QR/Transferencia quedó como PENDIENTE_APROBACION para validación de tesorería.'
        : 'Cobro en efectivo confirmado correctamente.';

      Alert.alert('Cobro Procesado', mensajeAviso, [
        { text: 'Aceptar', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Error', resultado.error || resultado.message || 'No se pudo guardar el cobro.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Registrar Cobro"
        subtitle={cliente?.razon_social || parada?.NombreCliente || 'Cliente'}
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Resumen de Montos */}
        <Card title="Montos del Pedido" icon={DollarSign} style={styles.cardSection}>
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

        {/* Modalidad: Cobro Simple vs Cobro Mixto */}
        <Card title="Modalidad de Cobro" icon={Layers} style={styles.cardSection}>
          <View style={styles.modalidadRow}>
            <TouchableOpacity
              style={[styles.modalidadBtn, !esMixto && styles.modalidadBtnActive]}
              onPress={() => setEsMixto(false)}
            >
              <Text style={[styles.modalidadText, !esMixto && styles.modalidadTextActive]}>
                Cobro Simple (1 Método)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalidadBtn, esMixto && styles.modalidadBtnActive]}
              onPress={() => setEsMixto(true)}
            >
              <Text style={[styles.modalidadText, esMixto && styles.modalidadTextActive]}>
                Cobro Mixto (Varios Métodos)
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {!esMixto ? (
          /* FORMULARIO SIMPLE */
          <Card title="Datos del Pago" icon={Receipt} style={styles.cardSection}>
            <PaymentSelector
              selectedMethod={metodoSimple}
              onSelectMethod={(m) => setMetodoSimple(m)}
              allowMultiple={false}
              showQrBadge={true}
            />

            <View style={{ marginTop: 12 }}>
              <Input
                label="Importe Cobrado (Bs.) *"
                placeholder="0.00"
                value={montoSimple}
                onChangeText={setMontoSimple}
                keyboardType="numeric"
              />
            </View>

            {(metodoSimple === 'QR' || metodoSimple === 'TRANSFERENCIA') && (
              <View style={styles.qrSection}>
                <View style={styles.avisoPendienteBox}>
                  <Clock size={16} color={Colors.warning} />
                  <Text style={styles.avisoPendienteText}>
                    El pago por {metodoSimple} nacerá en estado PENDIENTE_APROBACION y será conciliado por Kevin en tesorería.
                  </Text>
                </View>

                <Input
                  label="Número de Referencia Bancaria (Opcional)"
                  placeholder="Ej: BNB-QR-992812"
                  value={referenciaSimple}
                  onChangeText={setReferenciaSimple}
                />

                <PhotoCapture
                  photoUri={fotoSimpleUri}
                  onPhotoTaken={(uri) => setFotoSimpleUri(uri)}
                  onPhotoRemoved={() => setFotoSimpleUri(null)}
                  label="Foto del Comprobante Digital *"
                  required={true}
                />
              </View>
            )}
          </Card>
        ) : (
          /* FORMULARIO MIXTO */
          <Card title="Desglose de Pago Mixto" icon={Receipt} style={styles.cardSection}>
            <Text style={styles.subtext}>
              Ingrese los importes correspondientes a cada método aplicado:
            </Text>

            {/* Tramo Efectivo */}
            <View style={styles.tramoBox}>
              <Text style={styles.tramoTitulo}>1. Tramo en Efectivo</Text>
              <Input
                label="Monto Efectivo (Bs.)"
                placeholder="0.00"
                value={montoEfectivo}
                onChangeText={setMontoEfectivo}
                keyboardType="numeric"
              />
            </View>

            {/* Tramo QR */}
            <View style={styles.tramoBox}>
              <Text style={styles.tramoTitulo}>2. Tramo QR (Banca Móvil)</Text>
              <Input
                label="Monto QR (Bs.)"
                placeholder="0.00"
                value={montoQr}
                onChangeText={setMontoQr}
                keyboardType="numeric"
              />
              {parseFloat(montoQr) > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Input
                    label="Referencia QR"
                    placeholder="Ej: QR-48291"
                    value={referenciaQr}
                    onChangeText={setReferenciaQr}
                  />
                  <PhotoCapture
                    photoUri={fotoQrUri}
                    onPhotoTaken={(uri) => setFotoQrUri(uri)}
                    onPhotoRemoved={() => setFotoQrUri(null)}
                    label="Foto Comprobante QR *"
                    required={true}
                  />
                </View>
              )}
            </View>

            {/* Tramo Transferencia */}
            <View style={styles.tramoBox}>
              <Text style={styles.tramoTitulo}>3. Tramo Transferencia Bancaria</Text>
              <Input
                label="Monto Transferencia (Bs.)"
                placeholder="0.00"
                value={montoTransferencia}
                onChangeText={setMontoTransferencia}
                keyboardType="numeric"
              />
              {parseFloat(montoTransferencia) > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Input
                    label="Referencia Transferencia"
                    placeholder="Ej: TRANSF-8812"
                    value={referenciaTransf}
                    onChangeText={setReferenciaTransf}
                  />
                  <PhotoCapture
                    photoUri={fotoTransfUri}
                    onPhotoTaken={(uri) => setFotoTransfUri(uri)}
                    onPhotoRemoved={() => setFotoTransfUri(null)}
                    label="Foto Comprobante Transferencia *"
                    required={true}
                  />
                </View>
              )}
            </View>

            {/* Tramo Crédito */}
            <View style={styles.tramoBox}>
              <Text style={styles.tramoTitulo}>4. Tramo a Crédito / Saldo Deudor</Text>
              <Input
                label="Monto a Crédito (Bs.)"
                placeholder="0.00"
                value={montoCredito}
                onChangeText={setMontoCredito}
                keyboardType="numeric"
              />
              {parseFloat(montoCredito) > 0 && (
                <Input
                  label="Plazo en días"
                  placeholder="15"
                  value={diasCredito}
                  onChangeText={setDiasCredito}
                  keyboardType="numeric"
                />
              )}
            </View>

            <View style={styles.totalMixtoBox}>
              <Text style={styles.totalMixtoLabel}>Total Cobro Mixto:</Text>
              <Text style={styles.totalMixtoMonto}>
                Bs. {calcularTotalMixto().toFixed(2)}
              </Text>
            </View>
          </Card>
        )}

        <Card title="Observaciones" style={styles.cardSection}>
          <Input
            placeholder="Ej: Pago parcial, saldo el viernes"
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Botón de Confirmación */}
        <View style={styles.submitContainer}>
          <Button
            title="Confirmar y Guardar Cobro"
            icon={DollarSign}
            variant="primary"
            size="large"
            loading={loading}
            disabled={loading || fotoRequeridaFalta}
            onPress={handleConfirmarCobro}
          />
          {fotoRequeridaFalta && (
            <Text style={styles.avisoFotoFaltante}>
              ⚠️ Debe capturar o adjuntar el comprobante fotográfico del pago QR/Transferencia para habilitar la confirmación.
            </Text>
          )}
        </View>
      </ScrollView>
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
  cardSection: {
    marginBottom: 16,
    borderRadius: 4,
  },
  montosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  montoChip: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 2,
  },
  chipVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  modalidadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalidadBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 4,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  modalidadBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  modalidadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  modalidadTextActive: {
    color: '#FFFFFF',
  },
  qrSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  avisoPendienteBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 4,
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avisoPendienteText: {
    fontSize: 11,
    color: Colors.warning,
    flex: 1,
    lineHeight: 16,
  },
  subtext: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 12,
  },
  tramoBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  tramoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  totalMixtoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#0F172A',
    marginTop: 8,
  },
  totalMixtoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  totalMixtoMonto: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
  avisoFotoFaltante: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
});

export default RegistrarCobroScreen;
