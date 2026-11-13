import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { useLocation } from '../../context/LocationContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { NumericInput } from '../../components/common/NumericInput';
import { SignaturePad } from '../../components/common/SignaturePad';
import { PhotoCapture } from '../../components/common/PhotoCapture';
import { ComprobanteModal } from '../../components/ruta/ComprobanteModal';
import { LogisticaApi } from '../../api/logisticaApi';
import { ClientesApi } from '../../api/clientesApi';
import { LocalDB } from '../../database/localDb';
import { SyncQueue } from '../../database/syncQueue';
import {
  PackageCheck,
  UserCheck,
  MapPin,
  RotateCw,
  Gift,
  Truck,
  FileCheck2,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Building,
} from 'lucide-react-native';

export const RegistrarEntregaScreen = ({ route, navigation }) => {
  const { parada, pedido } = route.params || {};
  const { registrarEntrega, comprobanteActual, cerrarComprobante } = useRuta();
  const { location, getCurrentCoords } = useLocation();

  // Stock en camión cargado por el chofer (con fallback a local)
  const [inventarioCamion, setInventarioCamion] = useState([]);
  const [tipoEntrega, setTipoEntrega] = useState('TOTAL'); // 'TOTAL' | 'PARCIAL'

  // 1. Productos a entregar: pedida, ya entregada, pendiente, y campo editable "A entregar"
  const [items, setItems] = useState(() => {
    const baseItems = pedido?.items || parada?.PedidosPendientes || [];
    return baseItems.map((i, idx) => {
      const pedida = Number(i.cantidad ?? i.Cantidad ?? 1);
      const yaEntregada = Number(i.cantidad_entregada_previa ?? i.ya_entregada ?? 0);
      const pendiente = Math.max(0, pedida - yaEntregada);
      return {
        id: i.id || idx,
        presentacion_id: i.presentacion_id || i.IdPresentacion || i.id || idx + 1,
        producto_nombre: i.producto_nombre || i.NombreProducto || i.nombre || `Producto #${idx + 1}`,
        cantidadPedida: pedida,
        cantidadYaEntregada: yaEntregada,
        cantidadPendiente: pendiente,
        cantidadAEntregar: pendiente, // Precargado con lo pendiente
        precio_unitario: Number(i.precio_unitario || i.PrecioUnitarioAplicado || i.precio || 0),
        es_bandeo: Boolean(i.es_bandeo || i.EsBandeo || i.es_cortesia_bandeo),
        valor_bandeo: Number(i.valor_bandeo || i.ValorBandeo || 0),
      };
    });
  });

  // 2. Sección "Pago de esta entrega" en el mismo ciclo
  // 'COMPLETO' (todo hoy) | 'PARCIAL' (pago hoy + crédito) | 'CREDITO' (sin pago hoy)
  const [condicionPago, setCondicionPago] = useState('COMPLETO');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO'); // 'EFECTIVO' | 'QR' | 'TRANSFERENCIA' | 'MIXTO'

  // Pagos en tramos
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoQr, setMontoQr] = useState('');
  const [refQr, setRefQr] = useState('');
  const [fotoQrUri, setFotoQrUri] = useState(null);

  const [montoTransf, setMontoTransf] = useState('');
  const [refTransf, setRefTransf] = useState('');
  const [fotoTransfUri, setFotoTransfUri] = useState(null);

  // Crédito
  const [plazoDias, setPlazoDias] = useState('15');
  const [cuotasCredito, setCuotasCredito] = useState('1');

  // Datos de entrega y firmas
  const [receptorNombre, setReceptorNombre] = useState(
    parada?.cliente?.razon_social || parada?.NombreCliente || ''
  );
  const [receptorCi, setReceptorCi] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [firmaChofer, setFirmaChofer] = useState(null);
  const [firmaCliente, setFirmaCliente] = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);

  const esNuevoClienteEnRuta = Boolean(
    route.params?.esNuevoClienteEnRuta ||
    route.params?.nuevoClientePayload ||
    parada?.EsNuevoEnCampo
  );
  const [comprobanteLocal, setComprobanteLocal] = useState(null);

  // Cargar inventario del camión para verificar saldo
  useEffect(() => {
    let activo = true;
    async function cargarStock() {
      let itemsCamion = [];
      try {
        const datos = await LogisticaApi.obtenerMiInventarioCamion();
        if (activo && datos?.items) {
          itemsCamion = datos.items;
        }
      } catch (_e) {}

      // Fallback a LocalDB
      if (itemsCamion.length === 0) {
        const localInv = await LocalDB.obtenerInventarioCamion();
        if (activo && localInv?.items) {
          itemsCamion = localInv.items;
        }
      }

      if (activo && itemsCamion.length > 0) {
        setInventarioCamion(itemsCamion);

        // Si es un cliente nuevo en ruta, precargar productos del stock en camión con cantidad a entregar en 0
        setItems((prevItems) => {
          if (esNuevoClienteEnRuta || prevItems.length === 0) {
            return itemsCamion.map((c, idx) => {
              const saldo = Number(c.saldo_camion ?? c.cantidad_disponible ?? c.cantidad ?? 0);
              const precio = Number(c.precio_unitario || c.precio || 25);
              return {
                id: idx,
                presentacion_id: c.presentacion_id || c.IdPresentacion || c.id || idx + 1,
                producto_nombre: c.nombre_producto || c.nombre || `Producto #${idx + 1}`,
                cantidadPedida: saldo,
                cantidadYaEntregada: 0,
                cantidadPendiente: saldo,
                cantidadAEntregar: 0,
                precio_unitario: precio,
                es_bandeo: false,
                valor_bandeo: 0,
              };
            });
          }
          return prevItems;
        });
      }
    }
    cargarStock();
    return () => {
      activo = false;
    };
  }, [esNuevoClienteEnRuta]);

  const handleRefrescarGps = async () => {
    setGettingGps(true);
    await getCurrentCoords();
    setGettingGps(false);
  };

  const handleCambiarCantidadAEntregar = (index, valor) => {
    const num = Math.max(0, parseFloat(valor) || 0);
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, cantidadAEntregar: num } : item))
    );
  };

  // Cálculo de totales
  const totalBultosAEntregar = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.cantidadAEntregar || 0), 0);
  }, [items]);

  const totalMontoEntrega = useMemo(() => {
    return items.reduce((acc, item) => {
      const costo = item.es_bandeo ? 0 : (item.cantidadAEntregar || 0) * (item.precio_unitario || 0);
      return acc + costo;
    }, 0);
  }, [items]);

  // Si cambia el total a entregar y es pago completo con un solo método, ajustar monto sugerido
  useEffect(() => {
    if (condicionPago === 'COMPLETO') {
      if (metodoPago === 'EFECTIVO') {
        setMontoEfectivo(totalMontoEntrega.toFixed(2));
        setMontoQr('');
        setMontoTransf('');
      } else if (metodoPago === 'QR') {
        setMontoQr(totalMontoEntrega.toFixed(2));
        setMontoEfectivo('');
        setMontoTransf('');
      } else if (metodoPago === 'TRANSFERENCIA') {
        setMontoTransf(totalMontoEntrega.toFixed(2));
        setMontoEfectivo('');
        setMontoQr('');
      }
    } else if (condicionPago === 'CREDITO') {
      setMontoEfectivo('');
      setMontoQr('');
      setMontoTransf('');
    }
  }, [condicionPago, metodoPago, totalMontoEntrega]);

  // Cálculos de montos de pago
  const efNum = parseFloat(montoEfectivo) || 0;
  const qrNum = parseFloat(montoQr) || 0;
  const trNum = parseFloat(montoTransf) || 0;
  const totalPagadoAhora = efNum + qrNum + trNum;

  const saldoCreditoCalculado = useMemo(() => {
    if (condicionPago === 'COMPLETO') return 0;
    if (condicionPago === 'CREDITO') return totalMontoEntrega;
    return Math.max(0, totalMontoEntrega - totalPagadoAhora);
  }, [condicionPago, totalMontoEntrega, totalPagadoAhora]);

  // Validación de fotos obligatorias para QR y Transferencia
  const faltaFotoQr = qrNum > 0 && !fotoQrUri;
  const faltaFotoTransf = trNum > 0 && !fotoTransfUri;
  const faltaFotoObligatoria = faltaFotoQr || faltaFotoTransf;

  // Validación de suma de pagos vs total entrega
  const balanceCorrecto = useMemo(() => {
    if (totalMontoEntrega === 0) return true;
    if (condicionPago === 'COMPLETO') {
      return Math.abs(totalPagadoAhora - totalMontoEntrega) < 0.05;
    }
    if (condicionPago === 'PARCIAL') {
      return totalPagadoAhora > 0 && totalPagadoAhora < totalMontoEntrega;
    }
    if (condicionPago === 'CREDITO') {
      return totalPagadoAhora === 0;
    }
    return false;
  }, [condicionPago, totalMontoEntrega, totalPagadoAhora]);

  const handleConfirmarEntregaYCobro = async () => {
    if (!receptorNombre.trim()) {
      Alert.alert('Faltan Datos', 'Ingrese el nombre de la persona que recibe la mercadería.');
      return;
    }

    if (totalBultosAEntregar <= 0) {
      Alert.alert('Cantidad Inválida', 'La cantidad a entregar debe ser mayor a 0 bultos.');
      return;
    }

    // Validar cantidades no mayores a lo pendiente ni al saldo en camión
    for (const item of items) {
      if (item.cantidadAEntregar > item.cantidadPendiente) {
        Alert.alert(
          'Cantidad Excedida',
          `No puede entregar más de lo pendiente para "${item.producto_nombre}" (${item.cantidadPendiente} bultos).`
        );
        return;
      }
      const itemCamion = inventarioCamion.find(
        (c) => (c.presentacion_id || c.IdPresentacion || c.id) === item.presentacion_id
      );
      const stockDisponible = Number(itemCamion?.saldo_camion ?? itemCamion?.cantidad_disponible ?? 9999);
      if (item.cantidadAEntregar > stockDisponible) {
        Alert.alert(
          'Stock Insuficiente en Camión',
          `Solo tienes ${stockDisponible} bultos disponibles en tu camión para "${item.producto_nombre}".`
        );
        return;
      }
    }

    // Validación de condición de pago y balance
    if (!condicionPago) {
      Alert.alert('Condición de Pago', 'Debe seleccionar la condición de pago de esta entrega.');
      return;
    }

    if (!balanceCorrecto) {
      if (condicionPago === 'COMPLETO') {
        Alert.alert(
          'Monto Incompleto',
          `El total de la entrega es Bs. ${totalMontoEntrega.toFixed(2)} pero la suma de pagos es Bs. ${totalPagadoAhora.toFixed(2)}.`
        );
      } else if (condicionPago === 'PARCIAL') {
        Alert.alert(
          'Pago Parcial Inválido',
          `En pago parcial el importe pagado ahora (Bs. ${totalPagadoAhora.toFixed(2)}) debe ser mayor a 0 y menor al total (Bs. ${totalMontoEntrega.toFixed(2)}).`
        );
      } else {
        Alert.alert('Cobro Inválido', 'Verifique los importes ingresados.');
      }
      return;
    }

    // Comprobante fotográfico obligatorio para QR o Transferencia
    if (faltaFotoObligatoria) {
      Alert.alert(
        'Comprobante Obligatorio',
        'Debe tomar o adjuntar la fotografía del comprobante de depósito para pagos mediante QR o Transferencia bancaria.'
      );
      return;
    }

    // Doble firma digital táctil obligatoria
    if (!firmaChofer) {
      Alert.alert('Firma del Chofer Requerida', 'El chofer debe estampar su firma digital táctil obligatoria.');
      return;
    }

    if (!firmaCliente) {
      Alert.alert('Firma del Cliente Requerida', 'El cliente o receptor debe estampar su firma digital táctil.');
      return;
    }

    setLoading(true);

    // Construcción del bloque cobro unificado según contrato con Chat 2
    const listaPagos = [];
    if (efNum > 0) {
      listaPagos.push({
        metodo: 'EFECTIVO',
        monto: efNum,
        numero_referencia: null,
        id_comprobante_archivo: null,
      });
    }
    if (qrNum > 0) {
      listaPagos.push({
        metodo: 'QR',
        monto: qrNum,
        numero_referencia: refQr.trim() || `QR-${Date.now().toString().slice(-6)}`,
        id_comprobante_archivo: null,
        foto_uri: fotoQrUri,
      });
    }
    if (trNum > 0) {
      listaPagos.push({
        metodo: 'TRANSFERENCIA',
        monto: trNum,
        numero_referencia: refTransf.trim() || `TR-${Date.now().toString().slice(-6)}`,
        id_comprobante_archivo: null,
        foto_uri: fotoTransfUri,
      });
    }

    // Fecha de vencimiento crédito
    const dias = parseInt(plazoDias, 10) || 15;
    const fechaVenc = new Date();
    fechaVenc.setDate(fechaVenc.getDate() + dias);
    const fechaVencStr = fechaVenc.toISOString().split('T')[0];

    const bloqueCobro = {
      monto_total: totalMontoEntrega,
      pagos: listaPagos,
      credito:
        saldoCreditoCalculado > 0
          ? {
              saldo: saldoCreditoCalculado,
              plazo_dias: dias,
              cuotas: parseInt(cuotasCredito, 10) || 1,
              fecha_vencimiento: fechaVencStr,
            }
          : null,
    };

    const payloadEntregaCompuesta = {
      id_pedido: pedido?.id || pedido?.IdPedido || parada?.IdPedido,
      latitud: location?.latitude || -19.0435,
      longitud: location?.longitude || -65.2580,
      tipo_entrega: tipoEntrega,
      recibido_por: receptorNombre.trim(),
      ci_receptor: receptorCi.trim(),
      observaciones: observaciones.trim(),
      firma_chofer: firmaChofer,
      firma_cliente: firmaCliente,
      items_entregados: items
        .filter((i) => i.cantidadAEntregar > 0)
        .map((i) => ({
          presentacion_id: i.presentacion_id,
          producto_nombre: i.producto_nombre,
          cantidad: i.cantidadAEntregar,
          precio_unitario: i.precio_unitario,
          es_cortesia_bandeo: i.es_bandeo,
          subtotal: i.es_bandeo ? 0 : i.cantidadAEntregar * i.precio_unitario,
        })),
      monto_total: totalMontoEntrega,
      cobro: bloqueCobro,
    };

    if (esNuevoClienteEnRuta) {
      const payloadClienteRuta = {
        ...(route.params?.nuevoClientePayload || {
          datos_cliente: {
            razon_social: receptorNombre.trim(),
            nombre_comercial: parada?.cliente?.nombre_comercial || receptorNombre.trim(),
            direccion: parada?.cliente?.direccion || parada?.Direccion || 'En ruta',
            latitud: location?.latitude || -19.0435,
            longitud: location?.longitude || -65.2580,
          },
          modalidad: 'ENTREGA_INMEDIATA',
          dia_semana_programado: null,
          items_programados: null,
          parada_actual_orden: parada?.orden ? parada.orden - 1 : 0,
        }),
        entrega_con_cobro: {
          latitud: location?.latitude || -19.0435,
          longitud: location?.longitude || -65.2580,
          tipo_entrega: tipoEntrega,
          recibido_por: receptorNombre.trim(),
          ci_receptor: receptorCi.trim(),
          observacion: observaciones.trim(),
          firma_chofer: firmaChofer,
          firma_cliente: firmaCliente,
          items_entregados: items
            .filter((i) => i.cantidadAEntregar > 0)
            .map((i) => ({
              presentacion_id: i.presentacion_id,
              producto_nombre: i.producto_nombre,
              cantidad: i.cantidadAEntregar,
              precio_unitario: i.precio_unitario,
              es_cortesia_bandeo: i.es_bandeo,
              subtotal: i.es_bandeo ? 0 : i.cantidadAEntregar * i.precio_unitario,
            })),
          cobro: bloqueCobro,
        },
      };

      const idempotencyKey = SyncQueue.generarUuidV4();
      const numeroNota = `NE-${Date.now().toString().slice(-6)}`;
      const numeroRecibo = `REC-${Date.now().toString().slice(-6)}`;

      try {
        const res = await ClientesApi.registrarClienteEnRuta(payloadClienteRuta, idempotencyKey);
        if (!res.success) {
          // Encolar en la cola offline con X-Idempotency-Key
          await SyncQueue.encolarOperacion(
            'CLIENTE_EN_RUTA',
            payloadClienteRuta,
            { latitud: location?.latitude || -19.0435, longitud: location?.longitude || -65.2580 },
            idempotencyKey
          );
        }

        // Actualizar parada a ENTREGADO en base local
        await LocalDB.actualizarEstadoParada(parada.id || parada.IdPuntoVenta, 'ENTREGADO', {
          numeroNota,
          numeroRecibo,
          items: payloadClienteRuta.entrega_con_cobro.items_entregados,
          cobro: bloqueCobro,
        });

        // Descontar inventario en camión local
        await LocalDB.descontarInventarioCamion(payloadClienteRuta.entrega_con_cobro.items_entregados);

        setLoading(false);

        // Emitir comprobante digital
        const compEmitido = {
          numeroNota,
          numeroRecibo,
          fechaHora: new Date().toISOString(),
          cliente: receptorNombre.trim(),
          direccion: parada?.cliente?.direccion || parada?.Direccion || 'En ruta',
          items: payloadClienteRuta.entrega_con_cobro.items_entregados.map((i) => ({
            nombre: i.producto_nombre,
            cantidad: i.cantidad,
            subtotal: i.subtotal,
          })),
          totalCobrado: totalPagadoAhora,
          saldoPendiente: saldoCreditoCalculado,
          metodoPago,
        };
        setComprobanteLocal(compEmitido);
      } catch (err) {
        setLoading(false);
        Alert.alert('Error', err.message || 'No se pudo guardar la entrega del nuevo cliente.');
      }
      return;
    }

    const resultado = await registrarEntrega(parada.id || parada.IdPuntoVenta, payloadEntregaCompuesta);
    setLoading(false);

    if (resultado.success || resultado.exito) {
      if (resultado.alertaRevalorizacion) {
        Alert.alert('Aviso de Tarifa', resultado.alertaRevalorizacion);
      }
    } else {
      Alert.alert('Error', resultado.error || resultado.message || 'No se pudo guardar la operación.');
    }
  };

  const handleCerrarComprobanteYVolver = () => {
    setComprobanteLocal(null);
    cerrarComprobante();
    navigation.popToTop();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Entrega y Cobro"
        subtitle={parada?.cliente?.razon_social || parada?.NombreCliente || 'Punto de Venta'}
        showBackButton
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          scrollEnabled={scrollEnabled}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Encabezado del Cliente */}
          <Card title="Datos de la Parada" icon={Building} style={styles.cardSection}>
            <Text style={styles.clienteNombre}>
              {parada?.cliente?.razon_social || parada?.NombreCliente || 'Cliente Blanquita'}
            </Text>
            <Text style={styles.clientePunto}>
              {parada?.cliente?.nombre_comercial || parada?.NombrePuntoVenta || 'Tienda / Almacén'}
            </Text>
            <Text style={styles.clienteDireccion}>
              {parada?.cliente?.direccion || parada?.Direccion || 'Sucre, Bolivia'}
            </Text>
            <View style={styles.saldoPrevioRow}>
              <Text style={styles.saldoPrevioLabel}>Deuda anterior:</Text>
              <Text style={styles.saldoPrevioNum}>
                Bs. {Number(parada?.cliente?.saldo_pendiente || parada?.SaldoDeudor || 0).toFixed(2)}
              </Text>
            </View>
          </Card>

          {/* Ubicación GPS */}
          <Card title="Ubicación GPS" icon={MapPin} style={styles.gpsCard}>
            <View style={styles.gpsRow}>
              <View style={styles.gpsInfo}>
                <Text style={styles.gpsCoords}>
                  {location
                    ? `Lat: ${location.latitude.toFixed(5)}, Lng: ${location.longitude.toFixed(5)}`
                    : 'Obteniendo señal satelital...'}
                </Text>
                <Text style={styles.gpsSub}>
                  {location
                    ? `Precisión: ±${Math.round(location.accuracy || 10)}m`
                    : 'Asegúrese de tener encendida la ubicación del teléfono'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.refreshGpsBtn}
                onPress={handleRefrescarGps}
                disabled={gettingGps}
              >
                <RotateCw size={18} color={Colors.primaryDark} />
              </TouchableOpacity>
            </View>
          </Card>

          {/* Modalidad de Entrega */}
          <Card title="Modalidad de Entrega" icon={Truck} style={styles.cardSection}>
            <View style={styles.tipoRow}>
              <TouchableOpacity
                style={[styles.tipoBtn, tipoEntrega === 'TOTAL' && styles.tipoBtnActive]}
                onPress={() => setTipoEntrega('TOTAL')}
              >
                <Text style={[styles.tipoBtnText, tipoEntrega === 'TOTAL' && styles.tipoBtnTextActive]}>
                  Entrega Total
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipoBtn, tipoEntrega === 'PARCIAL' && styles.tipoBtnActive]}
                onPress={() => setTipoEntrega('PARCIAL')}
              >
                <Text style={[styles.tipoBtnText, tipoEntrega === 'PARCIAL' && styles.tipoBtnTextActive]}>
                  Entrega Parcial
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* 2. Productos: pedida, ya entregada, pendiente, y campo "A entregar" */}
          <Card title="Productos del Pedido" icon={PackageCheck} style={styles.cardSection}>
            {items.map((item, index) => {
              const itemCamion = inventarioCamion.find(
                (s) => (s.presentacion_id || s.IdPresentacion || s.id) === item.presentacion_id
              );
              const saldoCamion = Number(itemCamion?.saldo_camion ?? itemCamion?.cantidad_disponible ?? 0);
              const subtotalItem = item.es_bandeo ? 0 : item.cantidadAEntregar * item.precio_unitario;

              return (
                <View key={item.id} style={styles.itemBox}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.producto_nombre}</Text>
                    <Text style={styles.itemPrice}>
                      Bs. {item.precio_unitario.toFixed(2)} c/u
                    </Text>
                  </View>

                  {/* Detalle de cantidades: Pedida, Ya entregada, Pendiente */}
                  <View style={styles.cantidadesDetalleRow}>
                    <Text style={styles.cantPill}>Pedida: {item.cantidadPedida}</Text>
                    <Text style={styles.cantPill}>Entregada: {item.cantidadYaEntregada}</Text>
                    <Text style={[styles.cantPill, styles.cantPillPendiente]}>
                      Pendiente: {item.cantidadPendiente}
                    </Text>
                  </View>

                  {/* Saldo en camión */}
                  <View style={styles.saldoRow}>
                    <Truck size={13} color={Colors.textSecondary} />
                    <Text style={styles.saldoText}>
                      En camión: <Text style={styles.saldoNum}>{saldoCamion} bultos</Text>
                    </Text>
                  </View>

                  {/* Bandeo de cortesía */}
                  {(item.es_bandeo || item.valor_bandeo > 0) && (
                    <View style={styles.bandeoBadge}>
                      <Gift size={13} color={Colors.accent} />
                      <Text style={styles.bandeoText}>
                        Promo Bandeo: Cortesía a costo Bs. 0.00
                      </Text>
                    </View>
                  )}

                  {/* Campo "A entregar" editable */}
                  <View style={styles.cantidadRow}>
                    <Text style={styles.cantidadLabel}>A entregar ahora:</Text>
                    <NumericInput
                      value={item.cantidadAEntregar}
                      onChange={(val) => handleCambiarCantidadAEntregar(index, val)}
                      min={0}
                      max={item.cantidadPendiente}
                      style={styles.numericInput}
                    />
                  </View>

                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Subtotal salida:</Text>
                    <Text style={styles.subtotalNum}>Bs. {subtotalItem.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })}

            {/* 3. Totales */}
            <View style={styles.totalBox}>
              <View>
                <Text style={styles.totalBoxLabel}>Bultos a entregar:</Text>
                <Text style={styles.totalBoxBultos}>{totalBultosAEntregar} paquetes</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.totalBoxLabel}>Total de esta entrega:</Text>
                <Text style={styles.totalBoxAmount}>Bs. {totalMontoEntrega.toFixed(2)}</Text>
              </View>
            </View>
          </Card>

          {/* 4. Sección "Pago de esta entrega" en el MISMO flujo */}
          <Card title="Condición de Pago" icon={DollarSign} style={styles.cardSection}>
            <View style={styles.condicionGrid}>
              <TouchableOpacity
                style={[
                  styles.condicionBtn,
                  condicionPago === 'COMPLETO' && styles.condicionBtnActivo,
                ]}
                onPress={() => setCondicionPago('COMPLETO')}
              >
                <Text
                  style={[
                    styles.condicionBtnTexto,
                    condicionPago === 'COMPLETO' && styles.condicionBtnTextoActivo,
                  ]}
                >
                  Pago Completo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.condicionBtn,
                  condicionPago === 'PARCIAL' && styles.condicionBtnActivo,
                ]}
                onPress={() => setCondicionPago('PARCIAL')}
              >
                <Text
                  style={[
                    styles.condicionBtnTexto,
                    condicionPago === 'PARCIAL' && styles.condicionBtnTextoActivo,
                  ]}
                >
                  Pago Parcial
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.condicionBtn,
                  condicionPago === 'CREDITO' && styles.condicionBtnActivo,
                ]}
                onPress={() => setCondicionPago('CREDITO')}
              >
                <Text
                  style={[
                    styles.condicionBtnTexto,
                    condicionPago === 'CREDITO' && styles.condicionBtnTextoActivo,
                  ]}
                >
                  A Crédito
                </Text>
              </TouchableOpacity>
            </View>

            {/* Métodos de Pago si hay abono ahora */}
            {condicionPago !== 'CREDITO' && (
              <View style={styles.metodosContainer}>
                <Text style={styles.subseccionTitulo}>Método para el pago de hoy:</Text>
                <View style={styles.metodosGrid}>
                  {[
                    { id: 'EFECTIVO', label: 'Efectivo' },
                    { id: 'QR', label: 'QR Bancario' },
                    { id: 'TRANSFERENCIA', label: 'Transferencia' },
                    { id: 'MIXTO', label: 'Mixto' },
                  ].map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.metodoBtn,
                        metodoPago === m.id && styles.metodoBtnActivo,
                      ]}
                      onPress={() => setMetodoPago(m.id)}
                    >
                      <Text
                        style={[
                          styles.metodoBtnTexto,
                          metodoPago === m.id && styles.metodoBtnTextoActivo,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Desglose de importes */}
                {(metodoPago === 'EFECTIVO' || metodoPago === 'MIXTO') && (
                  <Input
                    label="Monto en Efectivo (Bs.)"
                    keyboardType="numeric"
                    value={montoEfectivo}
                    onChangeText={setMontoEfectivo}
                    placeholder="0.00"
                  />
                )}

                {(metodoPago === 'QR' || metodoPago === 'MIXTO') && (
                  <View style={styles.bloquePagoElectronico}>
                    <Input
                      label="Monto mediante QR (Bs.) *"
                      keyboardType="numeric"
                      value={montoQr}
                      onChangeText={setMontoQr}
                      placeholder="0.00"
                    />
                    <Input
                      label="N° de Referencia QR (Opcional)"
                      value={refQr}
                      onChangeText={setRefQr}
                      placeholder="Ej: BNB-QR-892341"
                    />
                    {/* Comprobante Fotográfico Obligatorio */}
                    <PhotoCapture
                      titulo="Foto del Comprobante QR *"
                      obligatorio={qrNum > 0}
                      fotoUri={fotoQrUri}
                      onFotoCapturada={setFotoQrUri}
                      onPhotoRemoved={() => setFotoQrUri(null)}
                    />
                    {faltaFotoQr && (
                      <View style={styles.alertaFotoRequerida}>
                        <AlertTriangle size={14} color={Colors.danger} />
                        <Text style={styles.alertaFotoTexto}>
                          Foto de comprobante requerida para confirmar pago con QR.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {(metodoPago === 'TRANSFERENCIA' || metodoPago === 'MIXTO') && (
                  <View style={styles.bloquePagoElectronico}>
                    <Input
                      label="Monto Transferencia (Bs.) *"
                      keyboardType="numeric"
                      value={montoTransf}
                      onChangeText={setMontoTransf}
                      placeholder="0.00"
                    />
                    <Input
                      label="N° de Referencia Transferencia"
                      value={refTransf}
                      onChangeText={setRefTransf}
                      placeholder="Ej: BAN-TRANSF-10294"
                    />
                    {/* Comprobante Fotográfico Obligatorio */}
                    <PhotoCapture
                      titulo="Foto del Comprobante de Transferencia *"
                      obligatorio={trNum > 0}
                      fotoUri={fotoTransfUri}
                      onFotoCapturada={setFotoTransfUri}
                      onPhotoRemoved={() => setFotoTransfUri(null)}
                    />
                    {faltaFotoTransf && (
                      <View style={styles.alertaFotoRequerida}>
                        <AlertTriangle size={14} color={Colors.danger} />
                        <Text style={styles.alertaFotoTexto}>
                          Foto de comprobante requerida para transferencia bancaria.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Configuración de Crédito si aplica */}
            {(condicionPago === 'PARCIAL' || condicionPago === 'CREDITO') && (
              <View style={styles.bloqueCredito}>
                <View style={styles.creditoHeader}>
                  <CreditCard size={16} color={Colors.primaryDark} />
                  <Text style={styles.creditoTitulo}>
                    Saldo a Crédito: Bs. {saldoCreditoCalculado.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.creditoInputsRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input
                      label="Plazo (Días)"
                      keyboardType="numeric"
                      value={plazoDias}
                      onChangeText={setPlazoDias}
                      placeholder="15"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Cuotas"
                      keyboardType="numeric"
                      value={cuotasCredito}
                      onChangeText={setCuotasCredito}
                      placeholder="1"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Resumen Balance */}
            <View style={styles.balanceResumen}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Pagado ahora:</Text>
                <Text style={styles.balanceValor}>Bs. {totalPagadoAhora.toFixed(2)}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Saldo a crédito:</Text>
                <Text style={styles.balanceValor}>Bs. {saldoCreditoCalculado.toFixed(2)}</Text>
              </View>
              <View style={[styles.balanceRow, styles.balanceTotalRow]}>
                <Text style={styles.balanceTotalLabel}>Total entrega:</Text>
                <Text style={styles.balanceTotalValor}>Bs. {totalMontoEntrega.toFixed(2)}</Text>
              </View>
            </View>
          </Card>

          {/* Receptor de Mercadería */}
          <Card title="Receptor de Mercadería" icon={UserCheck} style={styles.cardSection}>
            <Input
              label="Nombre de quien recibe *"
              placeholder="Ej: Doña Carmen / Encargado"
              value={receptorNombre}
              onChangeText={setReceptorNombre}
            />
            <Input
              label="Cédula de Identidad (Opcional)"
              placeholder="Ej: 5849301 PT"
              value={receptorCi}
              onChangeText={setReceptorCi}
            />
            <Input
              label="Observaciones"
              placeholder="Ej: Entregado conforme en tienda central"
              value={observaciones}
              onChangeText={setObservaciones}
              multiline
              numberOfLines={2}
            />
          </Card>

          {/* 5. Doble Firma Táctil Obligatoria */}
          <Card title="1. Firma Táctil del Chofer *" icon={FileCheck2} style={styles.cardSection}>
            <Text style={styles.firmaDesc}>
              Certificación de salida y entrega de mercadería por parte del chofer.
            </Text>
            <SignaturePad
              onSign={(firmaSvg) => setFirmaChofer(firmaSvg)}
              onDrawingChange={(drawing) => setScrollEnabled(!drawing)}
              title="Firmar Entrega (Chofer)"
              height={140}
            />
            {firmaChofer && (
              <View style={styles.firmaOkRow}>
                <Text style={styles.firmaOkText}>✓ Firma del chofer registrada</Text>
              </View>
            )}
          </Card>

          <Card title="2. Firma Táctil del Cliente Receptor *" icon={FileCheck2} style={styles.cardSection}>
            <Text style={styles.firmaDesc}>
              Conformidad de los bultos y condición de pago acordada por el cliente.
            </Text>
            <SignaturePad
              onSign={(firmaSvg) => setFirmaCliente(firmaSvg)}
              onDrawingChange={(drawing) => setScrollEnabled(!drawing)}
              title="Firmar Recepción (Cliente)"
              height={140}
            />
            {firmaCliente && (
              <View style={styles.firmaOkRow}>
                <Text style={styles.firmaOkText}>✓ Firma del cliente receptor registrada</Text>
              </View>
            )}
          </Card>

          {/* 6. Botón de Confirmación Fijo Abajo */}
          <View style={styles.submitContainer}>
            <Button
              title="Confirmar Entrega y Cobro"
              icon={PackageCheck}
              variant="primary"
              size="large"
              loading={loading}
              disabled={loading || faltaFotoObligatoria || !balanceCorrecto}
              onPress={handleConfirmarEntregaYCobro}
            />
            <Text style={styles.offlineFirstAviso}>
              Guardado en el teléfono, pendiente de enviar
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Comprobante Digital */}
      <ComprobanteModal
        visible={Boolean(comprobanteActual || comprobanteLocal)}
        comprobante={comprobanteActual || comprobanteLocal}
        onClose={handleCerrarComprobanteYVolver}
      />
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
  cardSection: {
    marginBottom: 16,
    borderRadius: 4,
  },
  clienteNombre: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  clientePunto: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clienteDireccion: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  saldoPrevioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  saldoPrevioLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  saldoPrevioNum: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
    fontVariant: ['tabular-nums'],
  },
  gpsCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryDark,
    borderRadius: 4,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpsInfo: {
    flex: 1,
  },
  gpsCoords: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  gpsSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  refreshGpsBtn: {
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#64748B',
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tipoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 4,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  tipoBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  tipoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  tipoBtnTextActive: {
    color: '#FFFFFF',
  },
  itemBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  cantidadesDetalleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  cantPill: {
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  cantPillPendiente: {
    fontWeight: '700',
    color: Colors.primaryDark,
    backgroundColor: '#E0F2FE',
  },
  saldoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  saldoText: {
    fontSize: 11,
    color: '#475569',
  },
  saldoNum: {
    fontWeight: '700',
    color: Colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  bandeoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 6,
    gap: 6,
  },
  bandeoText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  cantidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cantidadLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  numericInput: {
    width: 140,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  subtotalLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  subtotalNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#0F172A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBoxLabel: {
    fontSize: 12,
    color: '#475569',
  },
  totalBoxBultos: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalBoxAmount: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  condicionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  condicionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  condicionBtnActivo: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  condicionBtnTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  condicionBtnTextoActivo: {
    color: '#FFFFFF',
  },
  subseccionTitulo: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  metodosGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  metodoBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  metodoBtnActivo: {
    borderColor: Colors.primaryDark,
    backgroundColor: '#F0F9FF',
  },
  metodoBtnTexto: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  metodoBtnTextoActivo: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  bloquePagoElectronico: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertaFotoRequerida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  alertaFotoTexto: {
    fontSize: 11,
    color: Colors.danger,
    flex: 1,
  },
  bloqueCredito: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  creditoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  creditoTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  creditoInputsRow: {
    flexDirection: 'row',
  },
  balanceResumen: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  balanceLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  balanceValor: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  balanceTotalRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  balanceTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  balanceTotalValor: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  firmaDesc: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  firmaOkRow: {
    marginTop: 6,
  },
  firmaOkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },
  submitContainer: {
    marginTop: 10,
    marginBottom: 36,
  },
  offlineFirstAviso: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },
});

export default RegistrarEntregaScreen;
