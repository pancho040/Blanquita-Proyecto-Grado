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
  AlertTriangle,
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
    selloCarga,
    motivoObservacionCarga,
    motivoRechazoCarga,
  } = useRuta();

  const [vista, setVista] = useState('mapa'); // 'mapa' | 'lista'
  const [refreshing, setRefreshing] = useState(false);
  const [modalCargaVisible, setModalCargaVisible] = useState(false);
  const [inventarioRemanente, setInventarioRemanente] = useState([]);
  const [totalRemanenteBultos, setTotalRemanenteBultos] = useState(0);

  // Determinar estado efectivo del gatekeeper con protección de ruta aprobada
  const estadoActual = useMemo(() => {
    if (estadoRuta) return estadoRuta;
    if (asignacionActiva?.estado_flujo) return asignacionActiva.estado_flujo;
    if (hojaRuta?.paradas && hojaRuta.paradas.length > 0) {
      return ESTADOS_RUTA?.APROBADA_EN_RUTA || 'APROBADA_EN_RUTA';
    }
    return ESTADOS_RUTA?.SIN_RUTA || 'SIN_RUTA';
  }, [estadoRuta, asignacionActiva, hojaRuta]);

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

  // Mapeo defensivo de paradas: jamás ocultarlas si la ruta está activa/aprobada
  const paradasList = useMemo(() => {
    if (hojaRuta?.paradas && hojaRuta.paradas.length > 0) {
      return hojaRuta.paradas;
    }
    return asignacionActiva?.paradas || asignacionActiva?.Paradas || [];
  }, [hojaRuta, asignacionActiva]);

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
        <View style={styles.stateContainerPadding}>
          <View style={styles.solicitudEnviadaCard}>
            <View style={styles.badgeSolicitudEnviada}>
              <CheckCircle2 size={18} color="#059669" />
              <Text style={styles.badgeSolicitudTexto}>
                Solicitud enviada — Esperando aprobación en Web
              </Text>
            </View>

            <View style={styles.solicitudEnviadaHeader}>
              <View style={styles.solicitudIconBox}>
                <Clock size={22} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.solicitudEnviadaTitulo}>
                  {asignacionActiva?.NombreRuta || hojaRuta?.nombre_ruta || 'Ruta del Día'}
                </Text>
                <Text style={styles.solicitudEnviadaSub}>
                  Placa {asignacionActiva?.Vehiculo?.Placa || '2458-BLQ'} • Enviado a las {
                    selloCarga?.fecha_solicitud
                      ? new Date(selloCarga.fecha_solicitud).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Reciente'
                  }
                </Text>
              </View>
            </View>

            {/* Resumen de carga solicitada */}
            <View style={styles.resumenSolicitudBox}>
              <View style={styles.resumenSolicitudHeaderRow}>
                <Package size={15} color="#0284C7" />
                <Text style={styles.resumenSolicitudHeaderLabel}>Resumen de stock solicitado:</Text>
              </View>

              {selloCarga?.usar_remanente && (
                <View style={styles.resumenItemFila}>
                  <Text style={styles.resumenItemBullet}>•</Text>
                  <Text style={styles.resumenItemTexto}>
                    Salida con stock remanente en camión confirmada
                  </Text>
                </View>
              )}

              {selloCarga?.items_solicitados && selloCarga.items_solicitados.length > 0 ? (
                selloCarga.items_solicitados.map((it, idx) => (
                  <View key={it.presentacion_id || idx} style={styles.resumenItemFila}>
                    <Text style={styles.resumenItemBullet}>•</Text>
                    <Text style={styles.resumenItemTexto} numberOfLines={1}>
                      {it.nombre_producto || `Presentación #${it.presentacion_id}`}:{' '}
                      <Text style={styles.resumenItemCant}>
                        {it.cantidad_solicitada || it.cantidad || 0} bultos
                      </Text>
                    </Text>
                  </View>
                ))
              ) : !selloCarga?.usar_remanente ? (
                <Text style={styles.resumenItemTexto}>
                  • Carga estándar programada para el camión
                </Text>
              ) : null}

              {selloCarga?.observacion ? (
                <Text style={styles.resumenItemObs}>
                  Nota chofer: "{selloCarga.observacion}"
                </Text>
              ) : null}
            </View>

            <Text style={styles.solicitudEnviadaNota}>
              El encargado de almacén debe autorizar tu salida desde el panel Web. Las paradas se desbloquearán de forma automática.
            </Text>

            {/* Botón secundario pequeño "Actualizar estado" */}
            <View style={styles.btnActualizarContainer}>
              <Button
                title="Actualizar estado"
                icon={RotateCw}
                variant="outline"
                size="sm"
                onPress={onRefresh}
                loading={refreshing}
                style={styles.btnActualizarPequeno}
              />
            </View>
          </View>
        </View>
      )}

      {/* CASO: ESTADO CARGA_OBSERVADA */}
      {estadoActual === (ESTADOS_RUTA?.CARGA_OBSERVADA || 'CARGA_OBSERVADA') && (
        <View style={styles.stateContainerPadding}>
          <View style={styles.observadaCard}>
            <View style={styles.badgeObservada}>
              <AlertTriangle size={18} color="#92400E" />
              <Text style={styles.badgeObservadaTexto}>
                Solicitud Observada por Almacén
              </Text>
            </View>

            <View style={styles.motivoObservadaBox}>
              <Text style={styles.motivoObservadaTitulo}>Observación del Supervisor:</Text>
              <Text style={styles.motivoObservadaTexto}>
                "{motivoObservacionCarga || asignacionActiva?.motivo_observacion || 'La solicitud presenta observaciones en las cantidades.'}"
              </Text>
            </View>

            <Text style={styles.observadaExplicacion}>
              Tu solicitud requiere corrección antes de ser aprobada. Presiona el botón para ajustar las cantidades y reenviarla.
            </Text>

            <Button
              title="Corregir y Reenviar Solicitud de Carga"
              icon={Package}
              variant="primary"
              size="lg"
              onPress={() => setModalCargaVisible(true)}
              style={{ marginTop: 14 }}
            />

            <View style={styles.btnActualizarContainer}>
              <Button
                title="Actualizar estado"
                icon={RotateCw}
                variant="outline"
                size="sm"
                onPress={onRefresh}
                loading={refreshing}
                style={[styles.btnActualizarPequeno, { marginTop: 10 }]}
              />
            </View>
          </View>
        </View>
      )}

      {/* CASO: ESTADO CARGA_RECHAZADA */}
      {estadoActual === (ESTADOS_RUTA?.CARGA_RECHAZADA || 'CARGA_RECHAZADA') && (
        <View style={styles.stateContainerPadding}>
          <View style={styles.rechazadaCard}>
            <View style={styles.badgeRechazada}>
              <AlertCircle size={18} color="#991B1B" />
              <Text style={styles.badgeRechazadaTexto}>
                Solicitud de Carga Rechazada
              </Text>
            </View>

            <View style={styles.motivoRechazadaBox}>
              <Text style={styles.motivoRechazadaTitulo}>Motivo del Rechazo:</Text>
              <Text style={styles.motivoRechazadaTexto}>
                "{motivoRechazoCarga || asignacionActiva?.motivo_rechazo || 'La solicitud fue rechazada por el supervisor de almacén.'}"
              </Text>
            </View>

            <Text style={styles.rechazadaExplicacion}>
              El supervisor de almacén rechazó tu solicitud anterior. Debes generar una nueva solicitud de carga para iniciar la ruta.
            </Text>

            <Button
              title="Nueva Solicitud de Carga"
              icon={Package}
              variant="primary"
              size="lg"
              onPress={() => setModalCargaVisible(true)}
              style={{ marginTop: 14 }}
            />

            <View style={styles.btnActualizarContainer}>
              <Button
                title="Actualizar estado"
                icon={RotateCw}
                variant="outline"
                size="sm"
                onPress={onRefresh}
                loading={refreshing}
                style={[styles.btnActualizarPequeno, { marginTop: 10 }]}
              />
            </View>
          </View>
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
        motivoObservacion={motivoObservacionCarga || asignacionActiva?.motivo_observacion}
        motivoRechazo={motivoRechazoCarga || asignacionActiva?.motivo_rechazo}
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
  solicitudEnviadaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeSolicitudEnviada: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 14,
  },
  badgeSolicitudTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    flex: 1,
  },
  solicitudEnviadaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  solicitudIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  solicitudEnviadaTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  solicitudEnviadaSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  resumenSolicitudBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginVertical: 8,
    gap: 6,
  },
  resumenSolicitudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  resumenSolicitudHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  resumenItemFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  resumenItemBullet: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: '700',
  },
  resumenItemTexto: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  resumenItemCant: {
    fontWeight: '800',
    color: '#0F172A',
  },
  resumenItemObs: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#64748B',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  solicitudEnviadaNota: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  btnActualizarContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  btnActualizarPequeno: {
    minWidth: 150,
  },
  // Estilos de Solicitud Observada
  observadaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeObservada: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  badgeObservadaTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
    flex: 1,
  },
  motivoObservadaBox: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  motivoObservadaTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  motivoObservadaTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
    fontStyle: 'italic',
  },
  observadaExplicacion: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  // Estilos de Solicitud Rechazada
  rechazadaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeRechazada: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  badgeRechazadaTexto: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
    flex: 1,
  },
  motivoRechazadaBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  motivoRechazadaTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 2,
  },
  motivoRechazadaTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7F1D1D',
    fontStyle: 'italic',
  },
  rechazadaExplicacion: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
});

export default HojaRutaScreen;
