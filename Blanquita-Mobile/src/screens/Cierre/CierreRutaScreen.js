import { useState, useEffect, useMemo } from 'react';
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
  Truck,
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

  // Sobrante en camión y revalorización
  const [sobranteEnCamion, setSobranteEnCamion] = useState(true);
  const [valorSobranteReval, setValorSobranteReval] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Cuadre financiero interactivo en vivo
  const totalIngresado = useMemo(() => {
    const ef = parseFloat(efectivoEntregado) || 0;
    const qr = parseFloat(qrReportado) || 0;
    const tr = parseFloat(transfReportada) || 0;
    const cr = parseFloat(creditoReportado) || 0;
    return ef + qr + tr + cr;
  }, [efectivoEntregado, qrReportado, transfReportada, creditoReportado]);

  const totalEsperado = useMemo(() => {
    return Number(metricas?.total_recaudado || 0) + (parseFloat(creditoReportado) || 0);
  }, [metricas, creditoReportado]);

  const descuadre = totalIngresado - totalEsperado;

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
        setValorSobranteReval(Number(inv?.valor_total_revalorizado_bs || inv?.valor_total_camion_bs || 0));
        const devMap = {};
        const merMap = {};
        const motMap = {};
        inv.items.forEach((it) => {
          // Si el sobrante permanece en camión, devolución a almacén es 0 por defecto
          devMap[it.presentacion_id] = '0';
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
      sobrante_permanece_en_camion: sobranteEnCamion,
      valor_sobrante_revalorizado: valorSobranteReval,
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

      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.content}
      >
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

          {/* Badge Interactivo de Cuadre en Vivo */}
          <View style={styles.arqueoResumenBox}>
            <View style={styles.arqueoTotalesRow}>
              <Text style={styles.arqueoTotalesLabel}>Total Declarado:</Text>
              <Text style={styles.arqueoTotalesValor}>Bs. {totalIngresado.toFixed(2)}</Text>
            </View>

            {Math.abs(descuadre) < 0.05 ? (
              <View style={styles.badgeCuadreOk}>
                <CheckCircle2 size={16} color="#16A34A" />
                <Text style={styles.badgeCuadreOkText}>
                  Arqueo Cuadrado con Ventas (Bs. {totalEsperado.toFixed(2)})
                </Text>
              </View>
            ) : descuadre < -0.05 ? (
              <View style={styles.badgeCuadreFalta}>
                <AlertTriangle size={16} color="#DC2626" />
                <Text style={styles.badgeCuadreFaltaText}>
                  Faltan Bs. {Math.abs(descuadre).toFixed(2)} (Esperado: Bs. {totalEsperado.toFixed(2)})
                </Text>
              </View>
            ) : (
              <View style={styles.badgeCuadreSobra}>
                <CheckCircle2 size={16} color="#0284C7" />
                <Text style={styles.badgeCuadreSobraText}>
                  Sobran Bs. {descuadre.toFixed(2)} (Esperado: Bs. {totalEsperado.toFixed(2)})
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* 2. Cuadre Físico de Inventario */}
        <Card title="2. Cuadre Físico de Camión" icon={Package} style={styles.cardSection}>
          {/* Toggle Interactivo: Sobrante queda en camión */}
          <TouchableOpacity
            style={[styles.toggleSobranteBox, sobranteEnCamion && styles.toggleSobranteBoxActivo]}
            onPress={() => setSobranteEnCamion(!sobranteEnCamion)}
            activeOpacity={0.8}
          >
            <View style={styles.toggleRow}>
              <Truck size={20} color={sobranteEnCamion ? '#0284C7' : '#64748B'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitulo}>
                  Sobrante permanece en el camión para mañana
                </Text>
                <Text style={styles.toggleSub}>
                  {sobranteEnCamion
                    ? `Activo (Recomendado): El remanente pasa a la jornada siguiente valorizado a precio vigente (Bs. ${valorSobranteReval.toFixed(2)}) sin descarga forzosa al almacén.`
                    : 'Desactivado: Deberás devolver físicamente la mercadería al almacén central.'}
                </Text>
              </View>
              <View style={[styles.switchTrack, sobranteEnCamion && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, sobranteEnCamion && styles.switchThumbOn]} />
              </View>
            </View>
          </TouchableOpacity>

          <Text style={[styles.desc, { marginTop: 10 }]}>
            {sobranteEnCamion
              ? 'El sobrante queda en el camión. Si hubo roturas o mermas en el camino, declárelas a continuación:'
              : 'Declare los bultos devueltos al almacén y las mermas o roturas justificadas:'}
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
            onDrawingChange={(drawing) => setScrollEnabled(!drawing)}
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
  arqueoResumenBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  arqueoTotalesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arqueoTotalesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  arqueoTotalesValor: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeCuadreOk: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  badgeCuadreOkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  badgeCuadreFalta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  badgeCuadreFaltaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
    flex: 1,
  },
  badgeCuadreSobra: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  badgeCuadreSobraText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
    flex: 1,
  },
  toggleSobranteBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  toggleSobranteBoxActivo: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.05)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  switchTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: '#0284C7',
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
});

export default CierreRutaScreen;
