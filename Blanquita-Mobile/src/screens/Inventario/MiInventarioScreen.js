import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Package,
  Boxes,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  RotateCw,
  AlertCircle,
  Gift,
  DollarSign,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { Header } from '../../components/common/Header';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { logisticaApi } from '../../api/logisticaApi';
import { LocalDB } from '../../database/localDb';
import { useAuth } from '../../context/AuthContext';
import { useRuta } from '../../context/RutaContext';
import { Button } from '../../components/common/Button';
import { SolicitarCargaModal } from './SolicitarCargaModal';

export const MiInventarioScreen = () => {
  const { user } = useAuth();
  const rutaCtx = useRuta?.() || {};
  const {
    asignacionActiva,
    estadoRuta,
    estadoOperativo: estadoOpCtx,
    selloCarga,
    cargarRutaDelDia,
  } = rutaCtx;
  const estadoOperativo = estadoOpCtx || estadoRuta;
  const esCargaSolicitada = estadoOperativo === 'CARGA_SOLICITADA';

  const [inventario, setInventario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);
  const [esCache, setEsCache] = useState(false);
  const [modalCargaVisible, setModalCargaVisible] = useState(false);

  const cargarDatos = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefrescando(true);
    } else {
      setCargando(true);
    }
    setError(null);

    try {
      const data = await logisticaApi.obtenerMiInventarioCamion();
      if (data && data.items) {
        setInventario(data);
        setEsCache(false);
        await LocalDB.guardarInventarioCamion(data);
      } else {
        // Fallback a caché local persistida
        const cache = await LocalDB.obtenerInventarioCamion();
        if (cache && cache.items) {
          setInventario(cache);
          setEsCache(true);
          setError('Servidor no disponible. Mostrando datos de la última sincronización.');
        } else {
          setInventario({
            chofer_id: user?.IdUsuario,
            sucursal_id: user?.IdSucursal || 1,
            total_bultos_cargados: 0,
            total_bultos_entregados: 0,
            total_saldo_camion: 0,
            valor_total_camion_bs: 0,
            valor_total_revalorizado_bs: 0,
            ajuste_revalorizacion_total_bs: 0,
            items: [],
          });
          setEsCache(false);
          setError('No se pudo obtener el inventario del camión.');
        }
      }
    } catch (_err) {
      const cache = await LocalDB.obtenerInventarioCamion();
      if (cache && cache.items) {
        setInventario(cache);
        setEsCache(true);
        setError('Sin respuesta del servidor. Mostrando datos de la última sincronización.');
      } else {
        setError('No se pudo sincronizar el inventario del camión.');
      }
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [user]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const items = useMemo(() => inventario?.items || [], [inventario?.items]);
  const ajusteReval = Number(inventario?.ajuste_revalorizacion_total_bs || 0);
  const valorReval = Number(inventario?.valor_total_revalorizado_bs || 0);
  const valorBase = Number(inventario?.valor_total_camion_bs || 0);

  // Total Único a Rendir: Ventas en ruta (a precio de salida) + Sobrante en camión (a precio vigente de sucursal)
  const totalVentasSalida = useMemo(() => {
    return items.reduce((sum, it) => {
      const vendida = Number(it.cantidad_vendida || 0);
      const precioSalida = Number(it.precio_vigente_carga || 0);
      return sum + vendida * precioSalida;
    }, 0);
  }, [items]);

  const totalUnicoRendir = totalVentasSalida + valorReval;

  const renderItem = ({ item }) => {
    const cargado = Number(item.cantidad_cargada || 0);
    const entregado = Number(item.cantidad_vendida || 0);
    const remanente = Number(item.cantidad_remanente || 0);
    const precioCarga = Number(item.precio_vigente_carga || 0);
    const precioActual = Number(item.precio_vigente_actual || precioCarga);
    const valorRem = Number(item.valor_remanente || 0);
    const valorRemReval = Number(item.valor_remanente_revalorizado || valorRem);
    const difUnit = precioActual - precioCarga;

    return (
      <View style={styles.cardItem}>
        {/* Cabecera del Producto */}
        <View style={styles.cardHeader}>
          <View style={styles.iconProducto}>
            <Package size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nombreProducto} numberOfLines={2}>
              {item.nombre_producto}
            </Text>
            <Text style={styles.subProducto}>
              {item.codigo_presentacion} • {item.tipo_contenedor || 'Paquete'}
            </Text>
          </View>
          <View style={styles.badgeSaldo}>
            <Text style={styles.badgeSaldoNumero}>{remanente}</Text>
            <Text style={styles.badgeSaldoLabel}>En camión</Text>
          </View>
        </View>

        {/* Desglose de Cantidades */}
        <View style={styles.metricasRow}>
          <View style={styles.metricaMini}>
            <Text style={styles.metricaMiniLabel}>Cargados</Text>
            <Text style={styles.metricaMiniValor}>{cargado}</Text>
          </View>
          <View style={styles.metricaMini}>
            <Text style={styles.metricaMiniLabel}>Entregados</Text>
            <Text style={styles.metricaMiniValor}>{entregado}</Text>
          </View>
          <View style={styles.metricaMini}>
            <Text style={styles.metricaMiniLabel}>P. Salida</Text>
            <Text style={styles.metricaMiniValor}>Bs. {precioCarga.toFixed(2)}</Text>
          </View>
          <View style={styles.metricaMini}>
            <Text style={styles.metricaMiniLabel}>P. Vigente</Text>
            <Text style={[styles.metricaMiniValor, difUnit !== 0 && { color: difUnit > 0 ? Colors.success : Colors.error }]}>
              Bs. {precioActual.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Banner de Bandeo (Cortesía costo 0) */}
        {item.es_bandeo && item.valor_bandeo > 0 && (
          <View style={styles.bandeoBanner}>
            <Gift size={14} color="#16A34A" />
            <Text style={styles.bandeoTexto}>
              Bandeo: {item.valor_bandeo} servilleta(s) de cortesía (Costo Bs. 0.00)
            </Text>
          </View>
        )}

        {/* Valorización del Remanente */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerLabel}>Valor a rendir remanente:</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footerMonto}>Bs. {valorRemReval.toFixed(2)}</Text>
            {difUnit !== 0 && (
              <Text style={styles.footerDif}>
                {difUnit > 0 ? '+' : ''}{(difUnit * remanente).toFixed(2)} Bs. por revalorización
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (cargando) return null;
    return (
      <View style={styles.emptyContainer}>
        <Boxes size={44} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Sin inventario en el camión</Text>
        <Text style={styles.emptySubtitle}>
          No tienes productos asignados para esta jornada o ya fueron liquidados.
        </Text>
        <TouchableOpacity style={styles.btnActualizar} onPress={() => cargarDatos(true)}>
          <RotateCw size={16} color="#FFFFFF" />
          <Text style={styles.btnActualizarText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Mi Inventario"
        subtitle={`Camión • ${user?.NombreCompleto || user?.nombre || 'Chofer'}`}
        showSyncButton
      />
      <OfflineBanner />
      {error && (
        <View style={styles.errorAvisoBanner}>
          <AlertCircle size={16} color={Colors.warning} />
          <Text style={styles.errorAvisoTexto}>
            {error} {esCache ? "(Datos respaldados en local)" : ""}
          </Text>
        </View>
      )}

      {cargando && !refrescando ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loaderText}>Consultando stock en camión...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, idx) => `${it.presentacion_id || idx}`}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargarDatos(true)}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            inventario ? (
              <View style={styles.headerKpis}>
                {/* TARJETA TOTAL ÚNICO A RENDIR CON DESGLOSE */}
                <View style={styles.kpiTotalRendirCard}>
                  <View style={styles.kpiTotalRendirHeader}>
                    <DollarSign size={18} color="#38BDF8" />
                    <Text style={styles.kpiTotalRendirTitulo}>TOTAL ÚNICO A RENDIR</Text>
                  </View>
                  <Text style={styles.kpiTotalRendirMonto}>
                    Bs. {totalUnicoRendir.toFixed(2)}
                  </Text>
                  <View style={styles.desgloseRendirBox}>
                    <View style={styles.desgloseRendirRow}>
                      <Text style={styles.desgloseRendirLabel}>• Ventas en ruta (a precio de salida):</Text>
                      <Text style={styles.desgloseRendirValor}>Bs. {totalVentasSalida.toFixed(2)}</Text>
                    </View>
                    <View style={styles.desgloseRendirRow}>
                      <Text style={styles.desgloseRendirLabel}>• Sobrante en camión (a precio vigente):</Text>
                      <Text style={styles.desgloseRendirValor}>Bs. {valorReval.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>

                {/* Panel Superior de Cantidades */}
                <View style={styles.kpiCard}>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCol}>
                      <Text style={styles.kpiSub}>Cargados</Text>
                      <Text style={styles.kpiValor}>
                        {Number(inventario.total_bultos_cargados || 0).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.kpiDivider} />
                    <View style={styles.kpiCol}>
                      <Text style={styles.kpiSub}>Entregados</Text>
                      <Text style={styles.kpiValor}>
                        {Number(inventario.total_bultos_entregados || 0).toFixed(0)}
                      </Text>
                    </View>
                    <View style={styles.kpiDivider} />
                    <View style={styles.kpiCol}>
                      <Text style={styles.kpiSub}>Saldo Físico</Text>
                      <Text style={[styles.kpiValor, { color: Colors.primary }]}>
                        {Number(inventario.total_saldo_camion || 0).toFixed(0)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.kpiTotalRow}>
                    <Text style={styles.kpiTotalLabel}>Total a Rendir (Salida):</Text>
                    <Text style={styles.kpiTotalValor}>Bs. {valorBase.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Tarjeta de Revalorización en Vivo */}
                <View
                  style={[
                    styles.revalCard,
                    ajusteReval > 0
                      ? styles.revalCardUp
                      : ajusteReval < 0
                      ? styles.revalCardDown
                      : styles.revalCardNeutral,
                  ]}
                >
                  <View style={styles.revalIconWrapper}>
                    {ajusteReval > 0 ? (
                      <TrendingUp size={22} color="#16A34A" />
                    ) : ajusteReval < 0 ? (
                      <TrendingDown size={22} color="#DC2626" />
                    ) : (
                      <ShieldCheck size={22} color="#0284C7" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.revalTitle}>
                      {ajusteReval > 0
                        ? 'Sobrante Revalorizado (+)'
                        : ajusteReval < 0
                        ? 'Ajuste de Precios (-)'
                        : 'Precios Vigentes Estables'}
                    </Text>
                    <Text style={styles.revalDesc}>
                      {ajusteReval !== 0
                        ? `Al cierre de jornada o traspaso, tu sobrante rinde Bs. ${valorReval.toFixed(2)} (${ajusteReval > 0 ? '+' : ''}${ajusteReval.toFixed(2)} Bs. de ajuste)`
                        : `El sobrante en camión mantiene su precio de salida (Total: Bs. ${valorBase.toFixed(2)})`}
                    </Text>
                  </View>
                </View>

                {/* Estado Operativo de Carga / Botón */}
                {esCargaSolicitada ? (
                  <View style={styles.bannerSolicitudEnviadaInv}>
                    <View style={styles.badgeSolicitudEnviadaInv}>
                      <CheckCircle2 size={16} color="#059669" />
                      <Text style={styles.badgeSolicitudTextoInv}>
                        ✓ Solicitud enviada — Esperando aprobación en Web
                      </Text>
                    </View>

                    <View style={styles.solicitudInfoFilaInv}>
                      <Clock size={13} color="#94A3B8" />
                      <Text style={styles.solicitudSubInv}>
                        Hora de envío: {
                          selloCarga?.fecha_solicitud
                            ? new Date(selloCarga.fecha_solicitud).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'Reciente'
                        }
                      </Text>
                    </View>

                    {/* Resumen de productos solicitados */}
                    <View style={styles.resumenItemsInv}>
                      <Text style={styles.resumenItemsTituloInv}>Stock solicitado:</Text>
                      {selloCarga?.usar_remanente && (
                        <Text style={styles.resumenItemTextoInv}>
                          • Salida con stock remanente en camión confirmada
                        </Text>
                      )}
                      {selloCarga?.items_solicitados && selloCarga.items_solicitados.length > 0 ? (
                        selloCarga.items_solicitados.map((it, idx) => (
                          <Text key={it.presentacion_id || idx} style={styles.resumenItemTextoInv}>
                            • {it.nombre_producto || `Item #${it.presentacion_id}`}:{' '}
                            <Text style={{ fontWeight: '800', color: '#F8FAFC' }}>
                              {it.cantidad_solicitada || it.cantidad || 0} bultos
                            </Text>
                          </Text>
                        ))
                      ) : !selloCarga?.usar_remanente ? (
                        <Text style={styles.resumenItemTextoInv}>
                          • Carga estándar programada para el camión
                        </Text>
                      ) : null}
                      {selloCarga?.observacion ? (
                        <Text style={[styles.resumenItemTextoInv, { fontStyle: 'italic', color: '#94A3B8', marginTop: 2 }]}>
                          Nota: "{selloCarga.observacion}"
                        </Text>
                      ) : null}
                    </View>

                    {/* Botón secundario pequeño "Actualizar estado" */}
                    <TouchableOpacity
                      style={styles.btnActualizarEstadoPequeno}
                      onPress={() => {
                        cargarDatos(true);
                        if (cargarRutaDelDia) cargarRutaDelDia(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <RotateCw size={13} color="#38BDF8" />
                      <Text style={styles.btnActualizarEstadoTexto}>Actualizar estado</Text>
                    </TouchableOpacity>
                  </View>
                ) : estadoOperativo === 'APROBADA_EN_RUTA' ? (
                  <View style={styles.bannerRutaAprobadaInv}>
                    <ShieldCheck size={16} color="#16A34A" />
                    <Text style={styles.bannerRutaAprobadaTexto}>
                      ✓ Inventario habilitado para repartos y cobranzas
                    </Text>
                  </View>
                ) : (
                  <Button
                    title="Solicitar Carga / Stock a Almacén"
                    icon={Package}
                    variant="outline"
                    size="md"
                    onPress={() => setModalCargaVisible(true)}
                    style={{ marginTop: 4 }}
                  />
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* Modal de Solicitud de Carga */}
      <SolicitarCargaModal
        visible={modalCargaVisible}
        onClose={() => setModalCargaVisible(false)}
        idAsignacion={asignacionActiva?.IdAsignacion || asignacionActiva?.IdAsignacionRuta || 1}
        inventarioRemanente={items}
        onSolicitudExitosa={() => {
          cargarDatos(true);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  listContent: {
    padding: 14,
    paddingBottom: 32,
  },
  headerKpis: {
    marginBottom: 14,
    gap: 10,
  },
  kpiTotalRendirCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  kpiTotalRendirHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  kpiTotalRendirTitulo: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiTotalRendirMonto: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  desgloseRendirBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 4,
  },
  desgloseRendirRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  desgloseRendirLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  desgloseRendirValor: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kpiCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  kpiCol: {
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#334155',
  },
  kpiSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValor: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  kpiTotalLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  kpiTotalValor: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '800',
  },
  revalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    gap: 12,
  },
  revalCardUp: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  revalCardDown: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  revalCardNeutral: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderColor: 'rgba(2, 132, 199, 0.3)',
  },
  revalIconWrapper: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  revalTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  revalDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  cardItem: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconProducto: {
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 8,
  },
  nombreProducto: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  subProducto: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  badgeSaldo: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  badgeSaldoNumero: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '800',
  },
  badgeSaldoLabel: {
    color: '#7DD3FC',
    fontSize: 9,
    fontWeight: '600',
  },
  metricasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
  },
  metricaMini: {
    alignItems: 'center',
    flex: 1,
  },
  metricaMiniLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  metricaMiniValor: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  bandeoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  bandeoTexto: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  footerLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  footerMonto: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
  },
  footerDif: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  btnActualizar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 18,
    gap: 8,
  },
  btnActualizarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorAvisoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    gap: 8,
  },
  errorAvisoTexto: {
    color: '#F8FAFC',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  bannerSolicitudEnviadaInv: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#059669',
    padding: 14,
    marginTop: 4,
    gap: 8,
  },
  badgeSolicitudEnviadaInv: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  badgeSolicitudTextoInv: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  solicitudInfoFilaInv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  solicitudSubInv: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  resumenItemsInv: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  resumenItemsTituloInv: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 2,
  },
  resumenItemTextoInv: {
    fontSize: 11.5,
    color: '#CBD5E1',
  },
  btnActualizarEstadoPequeno: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginTop: 4,
    gap: 6,
  },
  btnActualizarEstadoTexto: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerRutaAprobadaInv: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderWidth: 1,
    borderColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
    gap: 8,
  },
  bannerRutaAprobadaTexto: {
    color: '#4ADE80',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
});
