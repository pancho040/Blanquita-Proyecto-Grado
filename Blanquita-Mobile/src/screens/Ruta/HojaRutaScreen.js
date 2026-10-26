import React, { useState, useMemo } from 'react';
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
import { useRuta } from '../../context/RutaContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { ParadaCard } from '../../components/ruta/ParadaCard';
import { MapaRutaSvg } from '../../components/ruta/MapaRutaSvg';
import { Button } from '../../components/common/Button';
import {
  RotateCw,
  AlertCircle,
  List,
  Map as MapIcon,
  CheckCircle2,
  Wallet,
} from 'lucide-react-native';

export const HojaRutaScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { hojaRuta, metricas, cargarRutaDelDia } = useRuta();

  const [vista, setVista] = useState('mapa'); // 'mapa' | 'lista'
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarRutaDelDia(true);
    setRefreshing(false);
  };

  const paradasList = useMemo(() => {
    return hojaRuta?.paradas || [];
  }, [hojaRuta]);

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
            Bs. {Number(metricas?.total_recaudado || 0).toFixed(2)}
          </Text>
        </View>

        {/* Selector de Pestaña Mapa / Lista */}
        <View style={styles.tabToggle}>
          <TouchableOpacity
            style={[styles.tabBtn, vista === 'mapa' && styles.tabBtnActive]}
            onPress={() => setVista('mapa')}
            activeOpacity={0.8}
          >
            <MapIcon
              size={15}
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
              size={15}
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
      </View>

      {/* Contenido Principal: Mapa Deslizable (100% Táctil) vs Lista */}
      {vista === 'mapa' ? (
        <View style={styles.mapContainer}>
          <MapaRutaSvg
            paradas={paradasList}
            onSeleccionarParada={(p) => {}}
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
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
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
});

export default HojaRutaScreen;
