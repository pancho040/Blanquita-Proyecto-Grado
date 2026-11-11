import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { useNetwork } from '../../context/NetworkContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { SignaturePad } from '../../components/common/SignaturePad';
import { SyncQueue } from '../../database/syncQueue';
import { LogisticaApi } from '../../api/logisticaApi';
import {
  Banknote,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Package,
} from 'lucide-react-native';

export const CierreRutaScreen = ({ navigation }) => {
  const { metricas, asignacionActiva } = useRuta();
  const { isOnline } = useNetwork();

  // Estado de la cola offline
  const [pendientesCola, setPendientesCola] = useState(0);

  // Arqueo financiero
  const [efectivoEntregado, setEfectivoEntregado] = useState(
    Number(metricas?.total_efectivo || 0).toFixed(2)
  );
  const [qrReportado, setQrReportado] = useState(
    Number(metricas?.total_qr || 0).toFixed(2)
  );
  const [transfReportada, setTransfReportada] = useState('0.00');
  const [creditoReportado, setCreditoReportado] = useState('0.00');

  // Cuadre físico de inventario
  const [inventarioCamion, setInventarioCamion] = useState([]);
  const [devoluciones, setDevoluciones] = useState({});
  const [mermas, setMermas] = useState({});
  const [motivosMerma, setMotivosMerma] = useState({});

  // Firma y control
  const [firmaChofer, setFirmaChofer] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let activo = true;
    async function verificarColaYStock() {
      const cant = await SyncQueue.contarPendientes();
      if (activo) setPendientesCola(cant);

      const inv = await LogisticaApi.obtenerMiInventarioCamion();
      if (activo && inv?.items) {
        setInventarioCamion(inv.items);
        const devMap = {};
        const merMap = {};
        const motMap = {};
        inv.items.forEach((it) => {
          devMap[it.presentacion_id] = String(it.cantidad_remanente || 0);
          merMap[it.presentacion_id] = '0';
          motMap[it.presentacion_id] = 'Empaque roto en traslado';
        });
        setDevoluciones(devMap);
        setMermas(merMap);
        setMotivosMerma(motMap);
      }
    }
    verificarColaYStock();
    return () => {
      activo = false;
    };
  }, []);

  const handleCerrarTurno = async () => {
    // Regla 5.1: Conexión activa obligatoria
    if (!isOnline) {
      Alert.alert(
        'Sin Conexión a Red',
        'El cierre definitivo de turno exige conexión a internet para conciliar arqueo y cuadre físico de inventario.'
      );
      return;
    }

    // Regla 5.2: Cola de sincronización completamente vacía
    const pendientes = await SyncQueue.contarPendientes();
    if (pendientes > 0) {
      Alert.alert(
        'Operaciones Pendientes en Cola',
        `Tienes ${pendientes} operaciones en cola sin sincronizar. Vaya a la pantalla de Sincronización y despáchelas antes del cierre de turno.`
      );
      return;
    }

    // Regla 5.3: Firma táctil de conformidad obligatoria
    if (!firmaChofer) {
      Alert.alert(
        'Firma de Conformidad Requerida',
        'Debe estampar su firma digital táctil obligatoria para certificar la liquidación y cuadre del camión.'
      );
      return;
    }

    setLoading(true);

    const stockDevuelto = [];
    const mermasDeclaradas = [];

    inventarioCamion.forEach((it) => {
      const pid = it.presentacion_id;
      const cantDev = parseFloat(devoluciones[pid]) || 0;
      const cantMer = parseFloat(mermas[pid]) || 0;

      if (cantDev > 0) {
        stockDevuelto.push({
          presentacion_id: pid,
          cantidad_devuelta: cantDev,
        });
      }
      if (cantMer > 0) {
        mermasDeclaradas.push({
          presentacion_id: pid,
          cantidad_merma: cantMer,
          motivo: motivosMerma[pid] || 'Merma declarada por chofer',
          imputable_chofer: false,
        });
      }
    });

    const payload = {
      id_asignacion: asignacionActiva?.IdAsignacion || asignacionActiva?.IdAsignacionRuta || 1,
      monto_efectivo_entregado: parseFloat(efectivoEntregado) || 0,
      monto_qr_reportado: parseFloat(qrReportado) || 0,
      monto_transferencia_reportada: parseFloat(transfReportada) || 0,
      monto_credito_reportado: parseFloat(creditoReportado) || 0,
      stock_devuelto: stockDevuelto,
      mermas_declaradas: mermasDeclaradas,
      firma_chofer: firmaChofer,
      observaciones: observaciones.trim() || 'Cierre de turno móvil conciliado',
    };

    const res = await LogisticaApi.registrarCierreTurno(payload);
    setLoading(false);

    if (res.success) {
      Alert.alert(
        'Cierre de Turno Conciliado',
        `Turno liquidado exitosamente. Se generó la Rendición #${res.data?.id_rendicion || ''}.`,
        [
          {
            text: 'Aceptar',
            onPress: () => navigation.navigate('HojaRutaTab'),
          },
        ]
      );
    } else {
      Alert.alert('Error en Cierre', res.error || 'No se pudo registrar el cierre de turno.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Cierre de Turno" subtitle="Arqueo y Cuadre de Camión" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Validación de Condiciones de Cierre (Regla 5) */}
        {(!isOnline || pendientesCola > 0) && (
          <View style={styles.bloqueoAlertaBox}>
            <AlertTriangle size={20} color={Colors.danger} />
            <View style={styles.bloqueoInfo}>
              <Text style={styles.bloqueoTitulo}>Cierre Bloqueado</Text>
              <Text style={styles.bloqueoMensaje}>
                {!isOnline
                  ? '• Se requiere conexión activa a internet.'
                  : `• Hay ${pendientesCola} operación(es) pendiente(s) de sincronizar en cola.`}
              </Text>
            </View>
          </View>
        )}

        {/* 1. Arqueo Financiero Desglosado */}
        <Card title="1. Arqueo Financiero Desglosado" icon={Banknote} style={styles.cardSection}>
          <Input
            label="Efectivo Físico Entregado en Tesorería (Bs.) *"
            value={efectivoEntregado}
            onChangeText={setEfectivoEntregado}
            keyboardType="numeric"
          />
          <Input
            label="Cobros QR Reportados (Bs.) *"
            value={qrReportado}
            onChangeText={setQrReportado}
            keyboardType="numeric"
          />
          <Input
            label="Transferencias Bancarias Reportadas (Bs.)"
            value={transfReportada}
            onChangeText={setTransfReportada}
            keyboardType="numeric"
          />
          <Input
            label="Ventas a Crédito Reportadas (Bs.)"
            value={creditoReportado}
            onChangeText={setCreditoReportado}
            keyboardType="numeric"
          />
        </Card>

        {/* 2. Cuadre Físico de Inventario */}
        <Card title="2. Cuadre Físico de Camión" icon={Package} style={styles.cardSection}>
          <Text style={styles.desc}>
            Declare los bultos devueltos al almacén y las mermas o roturas justificadas:
          </Text>

          {inventarioCamion.map((it) => (
            <View key={it.presentacion_id} style={styles.itemCuadreBox}>
              <View style={styles.itemCuadreHeader}>
                <Text style={styles.itemCuadreNombre}>{it.nombre_producto}</Text>
                <Text style={styles.itemCuadreRem}>Remanente: {it.cantidad_remanente} bultos</Text>
              </View>

              <View style={styles.inputsRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Devueltos a Almacén"
                    value={devoluciones[it.presentacion_id] || '0'}
                    onChangeText={(val) =>
                      setDevoluciones((prev) => ({ ...prev, [it.presentacion_id]: val }))
                    }
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Mermas Declaradas"
                    value={mermas[it.presentacion_id] || '0'}
                    onChangeText={(val) =>
                      setMermas((prev) => ({ ...prev, [it.presentacion_id]: val }))
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {parseFloat(mermas[it.presentacion_id]) > 0 && (
                <Input
                  label="Motivo Justificado de Merma *"
                  value={motivosMerma[it.presentacion_id] || ''}
                  onChangeText={(val) =>
                    setMotivosMerma((prev) => ({ ...prev, [it.presentacion_id]: val }))
                  }
                  placeholder="Ej: Empaque roto en transporte"
                />
              )}
            </View>
          ))}
        </Card>

        {/* 3. Firma Digital Táctil de Conformidad */}
        <Card title="3. Firma de Conformidad (Chofer) *" icon={FileCheck2} style={styles.cardSection}>
          <Text style={styles.desc}>
            Certifico bajo juramento que el arqueo de valores y el conteo físico de bultos son correctos.
          </Text>
          <SignaturePad
            onSign={(firmaSvg) => setFirmaChofer(firmaSvg)}
            title="Firmar Liquidación de Turno"
            height={160}
          />
          {firmaChofer && (
            <Text style={styles.firmaOk}>✓ Firma digital de conformidad registrada</Text>
          )}
        </Card>

        <Card title="Observaciones Generales" style={styles.cardSection}>
          <Input
            value={observaciones}
            onChangeText={setObservaciones}
            placeholder="Ej: Cierre de jornada normal, camión guardado en garage"
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Botón de Cierre */}
        <View style={styles.submitContainer}>
          <Button
            title="Liquidación y Cierre de Turno"
            icon={CheckCircle2}
            variant="primary"
            size="large"
            loading={loading}
            disabled={!isOnline || pendientesCola > 0}
            onPress={handleCerrarTurno}
          />
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
  bloqueoAlertaBox: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    alignItems: 'flex-start',
  },
  bloqueoInfo: {
    flex: 1,
  },
  bloqueoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  bloqueoMensaje: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 2,
  },
  cardSection: {
    marginBottom: 16,
    borderRadius: 4,
  },
  desc: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 10,
  },
  itemCuadreBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
  },
  itemCuadreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemCuadreNombre: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  itemCuadreRem: {
    fontSize: 12,
    color: Colors.primaryDark,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  firmaOk: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    marginTop: 6,
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
});

export default CierreRutaScreen;
