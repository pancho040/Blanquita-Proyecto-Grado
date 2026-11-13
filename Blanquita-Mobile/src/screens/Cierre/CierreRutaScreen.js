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
  ShieldCheck,
  Lock,
  Info,
} from 'lucide-react-native';

export const CierreRutaScreen = ({ navigation }) => {
  const { metricas, asignacionActiva, estadoRuta } = useRuta();
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

  const handleCerrarTurno = () => {
    // Prohibición de Cerrar/Liquidar Ruta en Móvil (Subagente B)
    Alert.alert(
      'Cierre a cargo de Administración',
      'El cierre de ruta lo realiza Administración una vez revisadas tus entregas y cobros.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Cierre de Turno" subtitle="Arqueo y Cuadre de Camión" />

      <ScrollView
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.content}
      >
        {/* AVISO DESTACADO DE GOBERNANZA: CIERRE EXCLUSIVO POR ADMINISTRACIÓN (Subagente B) */}
        <View style={styles.avisoAdminBox}>
          <View style={styles.avisoAdminIconCircle}>
            <ShieldCheck size={26} color="#0284C7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.avisoAdminTitulo}>Cierre y Liquidación Centralizada</Text>
            <Text style={styles.avisoAdminTexto}>
              El cierre de ruta lo realiza Administración una vez revisadas tus entregas y cobros.
            </Text>
            <Text style={styles.avisoAdminSubtexto}>
              Esta pantalla es tu arqueo de control para conciliar valores en ventanilla y verificar que no existan discrepancias antes de entregar caja.
            </Text>
          </View>
        </View>

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

        {/* Tarjeta de Control: Cierre Reservado a Administración (Subagente B) */}
        <View style={styles.cierreAdminCard}>
          <View style={styles.cierreAdminHeader}>
            <Lock size={20} color="#0284C7" />
            <Text style={styles.cierreAdminTitulo}>Cierre Exclusivo por Administración</Text>
          </View>
          <Text style={styles.cierreAdminDesc}>
            El cierre de ruta lo realiza Administración una vez revisadas tus entregas y cobros. Entrega tus valores y comprobantes en ventanilla de tesorería para que el encargado finalice formalmente tu turno en Web.
          </Text>
          <Button
            title="Cierre a cargo de Administración"
            icon={Lock}
            variant="outline"
            size="large"
            disabled
            onPress={handleCerrarTurno}
            style={styles.btnCierreDeshabilitado}
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
  avisoAdminBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  avisoAdminIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoAdminTitulo: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0369A1',
  },
  avisoAdminTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 3,
    lineHeight: 17,
  },
  avisoAdminSubtexto: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  cierreAdminCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 8,
    marginBottom: 32,
    gap: 10,
  },
  cierreAdminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cierreAdminTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cierreAdminDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  btnCierreDeshabilitado: {
    marginTop: 4,
    opacity: 0.7,
  },
});

export default CierreRutaScreen;
