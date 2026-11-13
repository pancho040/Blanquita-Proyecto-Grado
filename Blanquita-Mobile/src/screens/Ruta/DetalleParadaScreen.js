import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import {
  MapPin,
  Phone,
  PackageCheck,
  CreditCard,
  Navigation,
  FileCheck,
  Package,
  XCircle,
  X,
} from 'lucide-react-native';

// Catálogo cerrado de motivos de no entrega
const MOTIVOS_NO_ENTREGA = [
  { clave: 'LOCAL_CERRADO', etiqueta: 'Local Cerrado', detalle: 'Cortina metálica abajo o sin atención' },
  { clave: 'CLIENTE_AUSENTE', etiqueta: 'Cliente Ausente', detalle: 'No responde llamadas ni se encuentra en sitio' },
  { clave: 'RECHAZO_PRECIO', etiqueta: 'Rechazo por Precio', detalle: 'Disconformidad con importe o cotización' },
  { clave: 'SIN_FONDOS', etiqueta: 'Sin Fondos', detalle: 'No dispone de efectivo ni método de pago' },
];

export const DetalleParadaScreen = ({ route, navigation }) => {
  const { paradaId, parada: initialParada } = route.params;
  const { hojaRuta, registrarNoEntrega } = useRuta();
  const [modalNoEntregaVisible, setModalNoEntregaVisible] = useState(false);
  const [guardandoNoEntrega, setGuardandoNoEntrega] = useState(false);

  const totalParadas = hojaRuta?.paradas?.length || 0;

  // Búsqueda robusta por id o IdPuntoVenta en la hoja de ruta reordenada
  const parada =
    hojaRuta?.paradas?.find(
      (p) =>
        String(p.id ?? p.IdPuntoVenta ?? "") ===
        String(paradaId ?? initialParada?.id ?? initialParada?.IdPuntoVenta ?? "")
    ) || initialParada;

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

  // Número de orden actualizado post-reordenamiento o inserción de clientes
  const numeroOrden =
    parada.secuencia ??
    parada.orden ??
    parada.OrdenVisita ??
    1;

  const pedido = parada.pedido || {};
  const items =
    pedido.items ||
    parada.PedidosPendientes ||
    [];
  const estadoParada = String(parada.Estado || parada.estado || "PENDIENTE").toUpperCase();
  const yaEntregado = estadoParada === 'ENTREGADO';
  const esNoEntregado = estadoParada === 'NO_ENTREGADO';

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

  const handleReportarNoEntrega = () => {
    setModalNoEntregaVisible(true);
  };

  const confirmarNoEntrega = async (motivo) => {
    setGuardandoNoEntrega(true);
    try {
      const res = await registrarNoEntrega(parada.id || parada.IdPuntoVenta, motivo);
      setModalNoEntregaVisible(false);
      if (res?.exito || res?.success) {
        Alert.alert('No Entrega Registrada', `Motivo: ${motivo}. El pedido fue marcado como no entregado.`, [
          { text: 'Aceptar', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo registrar la no entrega');
    } finally {
      setGuardandoNoEntrega(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={`Parada #${numeroOrden}${totalParadas > 0 ? ` de ${totalParadas}` : ''}`}
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
          <View style={styles.cardTopRow}>
            <View style={styles.badgeOrdenVisual}>
              <Text style={styles.badgeOrdenVisualText}>#{numeroOrden}</Text>
            </View>

            <View style={styles.badgesEstadoRow}>
              {Boolean(parada.EsNuevoEnCampo) && (
                <View style={styles.badgeNuevoCampo}>
                  <Text style={styles.badgeNuevoCampoText}>NUEVO EN RUTA</Text>
                </View>
              )}
              <View
                style={[
                  styles.badgeEstadoBase,
                  yaEntregado && styles.badgeEstadoEntregado,
                  esNoEntregado && styles.badgeEstadoNoEntregado,
                  !yaEntregado && !esNoEntregado && styles.badgeEstadoPendiente,
                ]}
              >
                <Text
                  style={[
                    styles.badgeEstadoTexto,
                    yaEntregado && { color: '#15803D' },
                    esNoEntregado && { color: '#B91C1C' },
                    !yaEntregado && !esNoEntregado && { color: '#0369A1' },
                  ]}
                >
                  {estadoParada}
                </Text>
              </View>
            </View>
          </View>

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

        {/* Botones Grandes de Operación (Sincronización Compuesta) */}
        <View style={styles.footerBotones}>
          {!yaEntregado ? (
            <Button
              title="REGISTRAR ENTREGA Y COBRO"
              icon={PackageCheck}
              variant="primary"
              size="large"
              onPress={() =>
                navigation.navigate('RegistrarEntrega', {
                  parada: {
                    ...parada,
                    orden: numeroOrden,
                    secuencia: numeroOrden,
                    OrdenVisita: numeroOrden,
                  },
                  pedido,
                  esNuevoClienteEnRuta: Boolean(parada?.EsNuevoEnCampo),
                })
              }
              style={{ marginBottom: 10 }}
            />
          ) : (
            <View style={styles.bannerEntregado}>
              <FileCheck size={22} color={Colors.success} />
              <Text style={styles.bannerEntregadoTexto}>
                Mercadería entregada con firma, GPS y comprobante.
              </Text>
            </View>
          )}

          <Button
            title={yaEntregado ? "REGISTRAR OTRO COBRO" : "REGISTRAR SOLO COBRO"}
            icon={CreditCard}
            variant="outline"
            size="large"
            onPress={() =>
              navigation.navigate('RegistrarCobro', {
                parada: {
                  ...parada,
                  orden: numeroOrden,
                  secuencia: numeroOrden,
                  OrdenVisita: numeroOrden,
                },
                cliente: parada.cliente,
                pedido,
              })
            }
            style={{ marginBottom: 10 }}
          />

          {!yaEntregado && !esNoEntregado && (
            <Button
              title="REPORTAR NO-ENTREGA"
              icon={XCircle}
              variant="outline"
              size="medium"
              onPress={handleReportarNoEntrega}
              style={{ borderColor: Colors.danger }}
              textStyle={{ color: Colors.danger }}
            />
          )}
        </View>
      </ScrollView>

      {/* Modal Propio de Catálogo Cerrado para No Entrega (DESIGN.md - Touch Target >= 48px, Bordes Rectos) */}
      <Modal
        visible={modalNoEntregaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !guardandoNoEntrega && setModalNoEntregaVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <XCircle size={20} color={Colors.danger} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitulo} numberOfLines={1}>Reportar No-Entrega</Text>
              </View>
              <TouchableOpacity
                onPress={() => !guardandoNoEntrega && setModalNoEntregaVisible(false)}
                style={styles.modalBotonCerrarX}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Cerrar modal"
                accessibilityRole="button"
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.modalSubtitulo}>
                Seleccione el motivo del catálogo cerrado para registrar la visita no concretada:
              </Text>

              <View style={styles.modalListaMotivos}>
                {MOTIVOS_NO_ENTREGA.map((m) => (
                  <TouchableOpacity
                    key={m.clave}
                    style={styles.modalOpcionMotivo}
                    onPress={() => confirmarNoEntrega(m.clave)}
                    disabled={guardandoNoEntrega}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalOpcionTextoCol}>
                      <Text style={styles.modalOpcionTitulo}>{m.etiqueta}</Text>
                      <Text style={styles.modalOpcionSub}>{m.detalle}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalBotonCancelar}
                onPress={() => setModalNoEntregaVisible(false)}
                disabled={guardandoNoEntrega}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBotonCancelarTexto}>Cancelar y Volver</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeOrdenVisual: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  badgeOrdenVisualText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
  },
  badgesEstadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeNuevoCampo: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgeNuevoCampoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  badgeEstadoBase: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeEstadoEntregado: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  badgeEstadoNoEntregado: {
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
  },
  badgeEstadoPendiente: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  badgeEstadoTexto: {
    fontSize: 10,
    fontWeight: '800',
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
  // Estilos del Modal de No Entrega (DESIGN.md - Touch Targets >= 48px, Bordes Rectos)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  modalTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  modalBotonCerrarX: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    padding: 16,
  },
  modalSubtitulo: {
    fontSize: 12.5,
    color: '#334155',
    marginBottom: 14,
    lineHeight: 18,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  modalListaMotivos: {
    gap: 8,
    marginBottom: 16,
  },
  modalOpcionMotivo: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    justifyContent: 'center',
  },
  modalOpcionTextoCol: {
    flexDirection: 'column',
  },
  modalOpcionTitulo: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  modalOpcionSub: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  modalBotonCancelar: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalBotonCancelarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
});

export default DetalleParadaScreen;
