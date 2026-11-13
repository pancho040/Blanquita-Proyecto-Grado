import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta, ESTADOS_RUTA } from '../../context/RutaContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { FrescuraIndicador } from '../../components/common/FrescuraIndicador';
import { ParadaCard } from '../../components/ruta/ParadaCard';
import { MapaRutaSvg } from '../../components/ruta/MapaRutaSvg';
import { Button } from '../../components/common/Button';
import { LogisticaApi } from '../../api/logisticaApi';
import { SolicitarCargaModal } from '../Inventario/SolicitarCargaModal';
import {
  RotateCw,
  AlertCircle,
  List,
  Map as MapIcon,
  CheckCircle2,
  Wallet,
  UserPlus,
  Clock,
  Truck,
  Package,
  Boxes,
} from 'lucide-react-native';

export const HojaRutaScreen = ({ navigation }) => {
  const { user } = useAuth();
  const {
    hojaRuta,
    metricas,
    cargarRutaDelDia,
    ultimaSincronizacion,
    estadoRuta,
    asignacionActiva,
  } = useRuta();

  const [vista, setVista] = useState('mapa'); // 'mapa' | 'lista'
  const [refreshing, setRefreshing] = useState(false);
  const [modalCargaVisible, setModalCargaVisible] = useState(false);
  const [inventarioRemanente, setInventarioRemanente] = useState([]);
  const [totalRemanenteBultos, setTotalRemanenteBultos] = useState(0);

  // Determinar estado efectivo del gatekeeper
  const estadoActual = useMemo(() => {
    if (estadoRuta) return estadoRuta;
    if (hojaRuta?.paradas && hojaRuta.paradas.length > 0) return ESTADOS_RUTA?.APROBADA_EN_RUTA || 'APROBADA_EN_RUTA';
    return ESTADOS_RUTA?.SIN_RUTA || 'SIN_RUTA';
  }, [estadoRuta, hojaRuta]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarRutaDelDia(true);
    try {
      const inv = await LogisticaApi.obtenerMiInventarioCamion();
      if (inv) {
        setInventarioRemanente(inv.items || []);
        setTotalRemanenteBultos(Number(inv.total_saldo_camion || 0));
      }
    } catch (_e) {}
    setRefreshing(false);
  };

  useEffect(() => {
    let activo = true;
    async function consultarStockCamion() {
      try {
        const inv = await LogisticaApi.obtenerMiInventarioCamion();
        if (activo && inv) {
          setInventarioRemanente(inv.items || []);
          setTotalRemanenteBultos(Number(inv.total_saldo_camion || 0));
        }
      } catch (_e) {}
    }
    consultarStockCamion();
    return () => {
      activo = false;
    };
  }, [estadoActual]);

  const paradasList = useMemo(() => {
    return hojaRuta?.paradas || [];
  }, [hojaRuta]);

  const totalFacturadoRuta = useMemo(() => {
    return paradasList.reduce((sum, p) => sum + Number(p.pedido?.monto_total || 0), 0);
  }, [paradasList]);

  const totalRecaudado = Number(metricas?.total_recaudado || 0);
  const saldoPorCobrarRuta = Math.max(0, totalFacturadoRuta - totalRecaudado);

  const irADetalle = (parada) => {
    navigation.navigate('DetalleParada', {
      paradaId: parada.id || parada.IdPuntoVenta,
      parada,
    });
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <AlertCircle size={36} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>Sin paradas asignadas para hoy</Text>
      <Button
        title="Actualizar"
        icon={RotateCw}
        variant="outline"
        size="small"
        onPress={onRefresh}
        style={{ marginTop: 12 }}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Reparto Blanquita"
        subtitle={user?.NombreCompleto || user?.nombre || 'Chofer'}
        showSyncButton
      />
      <OfflineBanner />
      <FrescuraIndicador
        ultimaSincronizacion={ultimaSincronizacion}
        onActualizar={onRefresh}
        cargando={refreshing}
      />

      {/* CASO 1: ESTADO SIN_RUTA */}
      {estadoActual === (ESTADOS_RUTA?.SIN_RUTA || 'SIN_RUTA') && (
        <View style={styles.stateCenterCard}>
          <View style={styles.iconCircleWait}>
            <Truck size={40} color={Colors.primary} />
          </View>
          <Text style={styles.stateTitle}>Esperando asignación de ruta para hoy</Text>
          <Text style={styles.stateSubtitle}>
            No tienes una ruta activa asignada por el centro de distribución en este momento. Presiona actualizar para verificar nuevamente.
          </Text>
          <Button
            title="Actualizar"
            icon={RotateCw}
            variant="primary"
            size="md"
            onPress={onRefresh}
            loading={refreshing}
            style={styles.stateBtn}
          />
        </View>
      )}

      {/* CASO 2: ESTADO PENDIENTE_CARGA */}
      {estadoActual === (ESTADOS_RUTA?.PENDIENTE_CARGA || 'PENDIENTE_CARGA') && (
        <View style={styles.stateContainerPadding}>
          <View style={styles.bannerPendienteCarga}>
            <View style={styles.bannerPendienteHeader}>
              <View style={styles.badgeCamionIcon}>
                <Truck size={24} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerPendienteTitulo}>Ruta Asignada: Carga Pendiente</Text>
                <Text style={styles.bannerPendienteSub}>
                  {asignacionActiva?.NombreRuta || hojaRuta?.nombre_ruta || 'Ruta del Día'} • Placa {asignacionActiva?.Vehiculo?.Placa || '2458-BLQ'}
                </Text>
              </View>
            </View>

            {/* Resumen de inventario remanente en el camión */}
            <View style={styles.remanenteResumenBox}>
              <View style={styles.remanenteHeaderRow}>
                <Boxes size={18} color="#0284C7" />
                <Text style={styles.remanenteResumenLabel}>Stock remanente actual a bordo:</Text>
              </View>
              <Text style={styles.remanenteResumenValor}>{totalRemanenteBultos} bultos</Text>
              <Text style={styles.remanenteResumenNota}>
                Antes de acceder a las paradas y registrar entregas, solicita la carga adicional a Almacén o confirma tu salida con el stock remanente.
              </Text>
            </View>

            <Button
              title="Solicitar Carga a Almacén/Web"
              icon={Package}
              variant="primary"
              size="lg"
              onPress={() => setModalCargaVisible(true)}
              style={{ marginTop: 14 }}
            />

            <Button
              title="Actualizar Estado"
              icon={RotateCw}
              variant="outline"
              size="sm"
              onPress={onRefresh}
              loading={refreshing}
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      )}

      {/* CASO 3: ESTADO CARGA_SOLICITADA */}
      {estadoActual === (ESTADOS_RUTA?.CARGA_SOLICITADA || 'CARGA_SOLICITADA') && (
        <View style={styles.stateCenterCard}>
          <View style={[styles.iconCircleWait, { backgroundColor: 'rgba(2, 132, 199, 0.12)' }]}>
            <Clock size={40} color="#0284C7" />
          </View>
          <Text style={styles.stateTitle}>Solicitud de stock enviada a Web</Text>
          <Text style={styles.stateSubtitle}>
            Esperando aprobación del encargado para habilitar tu ruta... Tan pronto como se apruebe tu carga en Almacén, se desbloquearán tus paradas de entrega automáticamente.
          </Text>
          <Button
            title="Actualizar"
            icon={RotateCw}
            variant="primary"
            size="md"
            onPress={onRefresh}
            loading={refreshing}
            style={styles.stateBtn}
          />
        </View>
      )}

      {/* CASO 4: ESTADO APROBADA_EN_RUTA (VISTA COMPLETA DESBLOQUEADA) */}
      {estadoActual === (ESTADOS_RUTA?.APROBADA_EN_RUTA || 'APROBADA_EN_RUTA') && (
        <>
          {/* Barra de Progreso y Selector de Vista (Limpio y Minimalista) */}
          <View style={styles.topControlPanel}>
            <View style={styles.resumenChip}>
              <CheckCircle2 size={15} color={Colors.primary} />
              <Text style={styles.statNumero}>
                {metricas?.entregados || 0}/{metricas?.total_paradas || paradasList.length}
              </Text>
              <Text style={styles.statLabel}>Entregas</Text>

              <View style={styles.dividerDot} />

              <Wallet size={15} color={Colors.success} />
              <Text style={[styles.statNumero, { color: Colors.success }]}>
                Bs. {totalRecaudado.toFixed(2)}
              </Text>

              <View style={styles.dividerDot} />

              <Clock size={14} color="#B45309" />
              <Text style={styles.statLabel}>Resta:</Text>
              <Text style={[styles.statNumero, { color: '#B45309' }]}>
                Bs. {saldoPorCobrarRuta.toFixed(2)}
              </Text>
            </View>

            {/* Fila de Acciones: Selector Mapa/Lista y Botón Nuevo Cliente */}
            <View style={styles.accionesRow}>
              {/* Selector de Pestaña Mapa / Lista */}
              <View style={styles.tabToggle}>
                <TouchableOpacity
                  style={[styles.tabBtn, vista === 'mapa' && styles.tabBtnActive]}
                  onPress={() => setVista('mapa')}
                  activeOpacity={0.8}
                >
                  <MapIcon
                    size={14}
                    color={vista === 'mapa' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      vista === 'mapa' && styles.tabTextActive,
                    ]}
                  >
                    Mapa
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, vista === 'lista' && styles.tabBtnActive]}
                  onPress={() => setVista('lista')}
                  activeOpacity={0.8}
                >
                  <List
                    size={14}
                    color={vista === 'lista' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      vista === 'lista' && styles.tabTextActive,
                    ]}
                  >
                    Lista ({paradasList.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Botón Acceso Rápido: Nuevo Cliente */}
              <TouchableOpacity
                style={styles.btnNuevoCliente}
                onPress={() => navigation.navigate('NuevoCliente')}
                activeOpacity={0.8}
              >
                <UserPlus size={14} color="#FFFFFF" />
                <Text style={styles.btnNuevoClienteText}>+ Cliente</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contenido Principal: Mapa Deslizable (100% Táctil) vs Lista */}
          {vista === 'mapa' ? (
            <View style={styles.mapContainer}>
              <MapaRutaSvg
                paradas={paradasList}
                onSeleccionarParada={() => {}}
                onIrADetalle={irADetalle}
              />
            </View>
          ) : (
            <FlatList
              data={paradasList}
              keyExtractor={(item) => String(item.id || item.IdPuntoVenta || Math.random())}
              renderItem={({ item }) => (
                <ParadaCard
                  parada={item}
                  onPress={() => irADetalle(item)}
                />
              )}
              ListEmptyComponent={renderEmpty}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={Colors.primary}
                  colors={[Colors.primary]}
                />
              }
            />
          )}
        </>
      )}

      {/* Modal de Solicitud de Carga */}
      <SolicitarCargaModal
        visible={modalCargaVisible}
        onClose={() => setModalCargaVisible(false)}
        idAsignacion={asignacionActiva?.IdAsignacion || asignacionActiva?.IdAsignacionRuta || 1}
        inventarioRemanente={inventarioRemanente}
        onSolicitudExitosa={() => {
          onRefresh();
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topControlPanel: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  resumenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  statNumero: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  accionesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  btnNuevoCliente: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  btnNuevoClienteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: '#0284C7',
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8,
  },
  // Estilos de los estados del Gatekeeper
  stateCenterCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginHorizontal: 16,
    marginVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircleWait: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(14, 110, 146, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
    maxWidth: 320,
  },
  stateBtn: {
    marginTop: 16,
    minWidth: 160,
  },
  stateContainerPadding: {
    padding: 16,
  },
  bannerPendienteCarga: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bannerPendienteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  badgeCamionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPendienteTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  bannerPendienteSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  remanenteResumenBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginVertical: 4,
  },
  remanenteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  remanenteResumenLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  remanenteResumenValor: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284C7',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  remanenteResumenNota: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
});

export default HojaRutaScreen;
