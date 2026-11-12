import { useState, useEffect, useCallback } from 'react';
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
  Truck,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { Header } from '../../components/common/Header';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { logisticaApi } from '../../api/logisticaApi';
import { useAuth } from '../../context/AuthContext';

export const MiInventarioScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [inventario, setInventario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const cargarDatos = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefrescando(true);
    } else {
      setCargando(true);
    }
    setError(null);

    try {
      const data = await logisticaApi.obtenerMiInventarioCamion();
      if (data) {
        setInventario(data);
      } else {
        // Fallback estructura vacía
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
      }
    } catch (err) {
      setError('No se pudo sincronizar el inventario del camión.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [user]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const items = inventario?.items || [];
  const ajusteReval = Number(inventario?.ajuste_revalorizacion_total_bs || 0);
  const valorReval = Number(inventario?.valor_total_revalorizado_bs || 0);
  const valorBase = Number(inventario?.valor_total_camion_bs || 0);

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
                {/* Panel Superior de Totales */}
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
              </View>
            ) : null
          }
        />
      )}
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
});
