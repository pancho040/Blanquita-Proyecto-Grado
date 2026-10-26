import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useNetwork } from '../../context/NetworkContext';
import { useRuta } from '../../context/RutaContext';
import { useAuth } from '../../context/AuthContext';
import { SyncQueue } from '../../database/syncQueue';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  Wifi,
  WifiOff,
  RotateCw,
  Database,
  CloudCheck,
  CloudAlert,
  Server,
  FileText,
  CheckCircle2,
  Trash2,
} from 'lucide-react-native';

export const SincronizacionScreen = () => {
  const { isOnline, connectionType, forzarSincronizacion, syncInProgress } = useNetwork();
  const { syncPendientes, cargarRutaDelDia } = useRuta();
  const { token } = useAuth();

  const [itemsCola, setItemsCola] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const cargarCola = async () => {
    setLoadingItems(true);
    const items = await SyncQueue.obtenerPendientes();
    setItemsCola(items || []);
    setLoadingItems(false);
  };

  useEffect(() => {
    cargarCola();
  }, [syncPendientes, syncInProgress]);

  const handleSincronizar = async () => {
    if (!isOnline) {
      Alert.alert(
        'Sin Conexión',
        'No puedes sincronizar ahora porque tu teléfono no tiene conexión a internet. Los datos están resguardados localmente.'
      );
      return;
    }

    const resultado = await forzarSincronizacion(token);
    await cargarCola();

    if (resultado.exitosos > 0) {
      Alert.alert(
        'Sincronización Completada',
        `Se enviaron con éxito ${resultado.exitosos} transacciones al servidor central.`
      );
    } else if (resultado.fallidos > 0) {
      Alert.alert(
        'Advertencia',
        `${resultado.fallidos} transacciones tuvieron errores y se reintentarán más tarde.`
      );
    } else {
      Alert.alert('Todo al Día', 'No hay transacciones pendientes por enviar.');
    }
  };

  const formatearTipoOperacion = (tipo) => {
    switch (tipo) {
      case 'ENTREGA_PEDIDO':
        return 'Entrega de Mercadería';
      case 'REGISTRO_COBRO':
        return 'Cobro de Cliente';
      case 'NUEVO_CLIENTE':
        return 'Alta de Cliente y GPS';
      case 'TELEMETRIA_PING':
        return 'Ping de Ubicación GPS';
      case 'CIERRE_RUTA':
        return 'Liquidación de Jornada';
      default:
        return tipo;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Sincronización"
        subtitle="Estado de Conexión y Enlace"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Estado de Conectividad */}
        <Card title="Estado del Enlace de Datos" icon={Server} style={styles.cardSection}>
          <View style={styles.statusRow}>
            <View style={styles.statusIconBox}>
              {isOnline ? (
                <Wifi size={24} color={Colors.secondary} />
              ) : (
                <WifiOff size={24} color={Colors.danger} />
              )}
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isOnline ? 'Conexión Establecida' : 'Dispositivo Fuera de Línea'}
              </Text>
              <Text style={styles.statusSub}>
                {isOnline
                  ? `Red: ${connectionType?.toUpperCase() || 'DATOS MÓVILES'} • Listo para transmitir`
                  : 'Guardando datos en memoria interna cifrada'}
              </Text>
            </View>
            <Badge
              text={isOnline ? 'ONLINE' : 'OFFLINE'}
              variant={isOnline ? 'success' : 'danger'}
            />
          </View>
        </Card>

        {/* Resumen de Cola */}
        <Card title="Cola de Espera Local" icon={Database} style={styles.cardSection}>
          <View style={styles.colaSummaryRow}>
            <View style={styles.colaItem}>
              <Text style={styles.colaLabel}>Pendientes de Envío</Text>
              <Text
                style={[
                  styles.colaValue,
                  itemsCola.length > 0 && { color: Colors.accent },
                ]}
              >
                {itemsCola.length}
              </Text>
            </View>

            <View style={styles.colaDivider} />

            <View style={styles.colaItem}>
              <Text style={styles.colaLabel}>Estado del Almacén</Text>
              <Text style={[styles.colaValue, { color: Colors.secondary }]}>Seguro</Text>
            </View>
          </View>

          <Button
            title={syncInProgress ? 'Sincronizando...' : 'Sincronizar Cola Ahora'}
            icon={RotateCw}
            variant="primary"
            loading={syncInProgress}
            disabled={!isOnline || itemsCola.length === 0}
            onPress={handleSincronizar}
            style={{ marginTop: 16 }}
          />
        </Card>

        {/* Detalle de Elementos en Cola */}
        <Card
          title={`Transacciones en Cola (${itemsCola.length})`}
          icon={FileText}
          style={styles.cardSection}
        >
          {itemsCola.length === 0 ? (
            <View style={styles.emptyQueue}>
              <CheckCircle2 size={36} color={Colors.secondary} />
              <Text style={styles.emptyQueueTitle}>Bandeja de Salida Vacía</Text>
              <Text style={styles.emptyQueueSub}>
                Todas las entregas, cobros y clientes ya fueron sincronizados con el servidor.
              </Text>
            </View>
          ) : (
            itemsCola.map((item) => (
              <View key={item.id} style={styles.queueItemRow}>
                <View style={styles.queueItemLeft}>
                  <Text style={styles.queueItemTitle}>
                    {formatearTipoOperacion(item.tipo)}
                  </Text>
                  <Text style={styles.queueItemTime}>
                    Hora: {new Date(item.timestamp).toLocaleTimeString()} • Reintentos:{' '}
                    {item.reintentos}
                  </Text>
                  {item.ultimoError ? (
                    <Text style={styles.queueItemError}>
                      Error: {item.ultimoError}
                    </Text>
                  ) : null}
                </View>
                <Badge
                  text={item.reintentos > 0 ? 'Reintentando' : 'En Espera'}
                  variant={item.reintentos > 0 ? 'warning' : 'neutral'}
                />
              </View>
            ))
          )}
        </Card>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  statusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  colaSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colaItem: {
    flex: 1,
    alignItems: 'center',
  },
  colaDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  colaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  colaValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  emptyQueue: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyQueueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  emptyQueueSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  queueItemLeft: {
    flex: 1,
    marginRight: 10,
  },
  queueItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  queueItemTime: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  queueItemError: {
    fontSize: 11,
    color: Colors.danger,
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
});

export default SincronizacionScreen;
