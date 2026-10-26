import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import {
  MapPin,
  Phone,
  PackageCheck,
  CreditCard,
  Navigation,
  FileCheck,
  Package,
} from 'lucide-react-native';

export const DetalleParadaScreen = ({ route, navigation }) => {
  const { paradaId, parada: initialParada } = route.params;
  const { hojaRuta } = useRuta();

  const parada =
    hojaRuta?.paradas?.find((p) => p.id === paradaId) || initialParada;

  if (!parada) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Detalle de Entrega" showBackButton />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró la parada.</Text>
          <Button title="Volver" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const pedido = parada.pedido || {};
  const items =
    pedido.items ||
    parada.PedidosPendientes ||
    [];
  const yaEntregado = (parada.Estado || parada.estado) === 'ENTREGADO';

  const handleLlamar = () => {
    const tel = parada.cliente?.telefono || parada.Telefono;
    if (tel) {
      Linking.openURL(`tel:${tel}`);
    } else {
      Alert.alert('Sin Teléfono', 'Este cliente no tiene teléfono registrado.');
    }
  };

  const handleAbrirNavegadorGPS = () => {
    const lat = parada.cliente?.latitud || parada.Latitud;
    const lng = parada.cliente?.longitud || parada.Longitud;
    if (lat && lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Sin Coordenadas', 'No hay coordenadas GPS para esta parada.');
    }
  };

  const totalMonto =
    Number(pedido.monto_total || parada.MontoPedido || 0) ||
    items.reduce(
      (sum, it) =>
        sum +
        Number(it.cantidad || it.Cantidad || 0) *
          Number(it.precio_unitario || it.PrecioUnitario || 0),
      0
    );

  const totalFardos = items.reduce(
    (sum, it) => sum + Number(it.cantidad || it.Cantidad || 0),
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Parada #${parada.secuencia || parada.OrdenVisita || '1'}`}
        subtitle={
          parada.cliente?.nombre_comercial ||
          parada.NombrePuntoVenta ||
          parada.cliente?.razon_social ||
          parada.NombreCliente
        }
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Tarjeta del Cliente y Botones Rápidos de Chofer */}
        <View style={styles.clienteCard}>
          <Text style={styles.clienteNombre}>
            {parada.cliente?.nombre_comercial ||
              parada.NombrePuntoVenta ||
              parada.cliente?.razon_social ||
              parada.NombreCliente}
          </Text>

          <View style={styles.direccionFila}>
            <MapPin size={16} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.direccionTexto}>
              {parada.cliente?.direccion || parada.Direccion || 'Sucre, Bolivia'}
            </Text>
          </View>

          {/* Botones Grandes de Acción de Ruta */}
          <View style={styles.accionesFila}>
            <TouchableOpacity
              style={styles.btnGps}
              onPress={handleAbrirNavegadorGPS}
              activeOpacity={0.85}
            >
              <Navigation size={18} color="#FFFFFF" />
              <Text style={styles.btnGpsTexto}>GPS MAPS</Text>
            </TouchableOpacity>

            {(parada.cliente?.telefono || parada.Telefono) && (
              <TouchableOpacity
                style={styles.btnLlamar}
                onPress={handleLlamar}
                activeOpacity={0.85}
              >
                <Phone size={18} color="#FFFFFF" />
                <Text style={styles.btnLlamarTexto}>LLAMAR</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Detalle de Productos a Entregar */}
        <View style={styles.productosCard}>
          <View style={styles.productosHeader}>
            <Package size={18} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.productosTitulo}>
              Productos ({totalFardos} fardos)
            </Text>
          </View>

          {items.map((item, index) => {
            const cant = item.cantidad || item.Cantidad || 1;
            const precio = Number(item.precio_unitario || item.PrecioUnitario || 0);
            const nom =
              item.producto_nombre ||
              item.Nombre ||
              item.producto?.nombre ||
              'Fardo de Papel';

            return (
              <View key={index} style={styles.productoItem}>
                <View style={styles.itemBullet}>
                  <Text style={styles.itemBulletText}>{index + 1}</Text>
                </View>
                <View style={styles.itemDetalle}>
                  <Text style={styles.itemNombre}>{nom}</Text>
                  <Text style={styles.itemCant}>
                    {cant} fardos × Bs. {precio.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  Bs. {(cant * precio).toFixed(2)}
                </Text>
              </View>
            );
          })}

          <View style={styles.totalCaja}>
            <Text style={styles.totalEtiqueta}>TOTAL PEDIDO:</Text>
            <Text style={styles.totalImporte}>
              Bs. {totalMonto.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Botones Grandes de Operación */}
        <View style={styles.footerBotones}>
          {!yaEntregado ? (
            <Button
              title="REGISTRAR ENTREGA"
              icon={PackageCheck}
              variant="primary"
              size="large"
              onPress={() =>
                navigation.navigate('RegistrarEntrega', {
                  parada,
                  pedido,
                })
              }
              style={{ marginBottom: 10 }}
            />
          ) : (
            <View style={styles.bannerEntregado}>
              <FileCheck size={22} color={Colors.success} />
              <Text style={styles.bannerEntregadoTexto}>
                Mercadería entregada con firma y GPS.
              </Text>
            </View>
          )}

          <Button
            title="REGISTRAR COBRO"
            icon={CreditCard}
            variant="outline"
            size="large"
            onPress={() =>
              navigation.navigate('RegistrarCobro', {
                parada,
                cliente: parada.cliente,
                pedido,
              })
            }
          />
        </View>
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
    padding: 14,
    paddingBottom: 30,
  },
  clienteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  clienteNombre: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 4,
  },
  direccionFila: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  direccionTexto: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  accionesFila: {
    flexDirection: 'row',
    gap: 10,
  },
  btnGps: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  btnGpsTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  btnLlamar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  btnLlamarTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  productosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  productosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  productosTitulo: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  productoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  itemBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemBulletText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  itemDetalle: {
    flex: 1,
  },
  itemNombre: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
  },
  itemCant: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  itemTotal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.text,
  },
  totalCaja: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: Colors.border,
  },
  totalEtiqueta: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  totalImporte: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.success,
  },
  footerBotones: {
    marginTop: 4,
  },
  bannerEntregado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.success,
    marginBottom: 10,
    gap: 10,
  },
  bannerEntregadoTexto: {
    flex: 1,
    fontSize: 13,
    color: Colors.success,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    marginBottom: 16,
  },
});

export default DetalleParadaScreen;
