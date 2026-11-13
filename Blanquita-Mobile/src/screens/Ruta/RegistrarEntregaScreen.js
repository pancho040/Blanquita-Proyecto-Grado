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
  Modal,
  TextInput,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useRuta } from '../../context/RutaContext';
import { useLocation } from '../../context/LocationContext';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
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
  Plus,
  Minus,
  PlusCircle,
  X,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react-native';

export const RegistrarEntregaScreen = ({ route, navigation }) => {
  const { parada, pedido } = route.params || {};
  const { registrarEntrega, comprobanteActual, cerrarComprobante } = useRuta();
  const { location, getCurrentCoords } = useLocation();

  // Stock en camión cargado por el chofer (con fallback a local)
  const [inventarioCamion, setInventarioCamion] = useState([]);

  // Estado/Incidencia flexible de la visita (Paso 2)
  // 'NORMAL' | 'PIDIO_MAS' | 'PIDIO_MENOS' | 'ATRASO' | 'REPROGRAMAR'
  const [situacionVisita, setSituacionVisita] = useState('NORMAL');
  const [situacionForzadaManual, setSituacionForzadaManual] = useState(false);

  // Modal para agregar productos desde el inventario del camión
  const [modalAgregarCamionVisible, setModalAgregarCamionVisible] = useState(false);

  // 1. Productos a entregar: cantidades 100% editables
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
        es_agregado_camion: false,
      };
    });
  });

  // 2. Sección "Pago de esta entrega"
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
                es_agregado_camion: false,
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

  // Helper para auto-sugerir situación si no fue forzada a mano
  const autoSugerirSituacion = (listaItems) => {
    if (situacionForzadaManual) return;
    const hayPidioMas = listaItems.some(
      (it) => it.es_agregado_camion || it.cantidadAEntregar > it.cantidadPedida
    );
    const hayPidioMenos = listaItems.some(
      (it) => !it.es_agregado_camion && it.cantidadAEntregar < it.cantidadPedida
    );

    if (hayPidioMas) {
      setSituacionVisita('PIDIO_MAS');
    } else if (hayPidioMenos) {
      setSituacionVisita('PIDIO_MENOS');
    } else {
      setSituacionVisita('NORMAL');
    }
  };

  // Manejo de edición directa de cantidad (Control 100% editable)
  const handleCambiarCantidadAEntregar = (index, valorTexto) => {
    const rawNum = parseFloat(valorTexto);
    const num = isNaN(rawNum) ? 0 : Math.max(0, rawNum);

    const itemActual = items[index];
    if (!itemActual) return;

    const itemCamion = inventarioCamion.find(
      (s) => (s.presentacion_id || s.IdPresentacion || s.id) === itemActual.presentacion_id
    );
    const saldoCamion = Number(
      itemCamion?.saldo_camion ?? itemCamion?.cantidad_disponible ?? itemCamion?.cantidad ?? 9999
    );

    const cantidadFinal = Math.min(num, saldoCamion);

    if (num > saldoCamion) {
      Alert.alert(
        'Límite de Stock en Camión',
        `Solo dispones de ${saldoCamion} bultos en tu camión para "${itemActual.producto_nombre}". Se fijó al stock máximo disponible.`
      );
    }

    setItems((prev) => {
      const actualizados = prev.map((item, i) =>
        i === index ? { ...item, cantidadAEntregar: cantidadFinal } : item
      );
      autoSugerirSituacion(actualizados);
      return actualizados;
    });
  };

  // Incrementar en 1 (botón grande [+])
  const handleIncrementarCantidad = (index) => {
    const itemActual = items[index];
    if (!itemActual) return;

    const itemCamion = inventarioCamion.find(
      (s) => (s.presentacion_id || s.IdPresentacion || s.id) === itemActual.presentacion_id
    );
    const saldoCamion = Number(
      itemCamion?.saldo_camion ?? itemCamion?.cantidad_disponible ?? itemCamion?.cantidad ?? 9999
    );

    const actual = itemActual.cantidadAEntregar || 0;
    if (actual >= saldoCamion) {
      Alert.alert(
        'Stock Máximo Alcanzado',
        `Solo dispones de ${saldoCamion} bultos en tu camión para "${itemActual.producto_nombre}".`
      );
      return;
    }

    setItems((prev) => {
      const actualizados = prev.map((item, i) =>
        i === index ? { ...item, cantidadAEntregar: actual + 1 } : item
      );
      autoSugerirSituacion(actualizados);
      return actualizados;
    });
  };

  // Decrementar en 1 (botón grande [-])
  const handleDecrementarCantidad = (index) => {
    const itemActual = items[index];
    if (!itemActual) return;

    const actual = itemActual.cantidadAEntregar || 0;
    if (actual <= 0) return;

    setItems((prev) => {
      const actualizados = prev.map((item, i) =>
        i === index ? { ...item, cantidadAEntregar: Math.max(0, actual - 1) } : item
      );
      autoSugerirSituacion(actualizados);
      return actualizados;
    });
  };

  // Agregar producto desde el inventario del camión
  const handleAgregarProductoDelCamion = (prodCamion) => {
    const presId = prodCamion.presentacion_id || prodCamion.IdPresentacion || prodCamion.id;
    const nombreProd = prodCamion.nombre_producto || prodCamion.nombre || `Producto #${presId}`;
    const precioProd = Number(prodCamion.precio_unitario || prodCamion.precio || 25);
    const saldo = Number(
      prodCamion.saldo_camion ?? prodCamion.cantidad_disponible ?? prodCamion.cantidad ?? 0
    );

    if (saldo <= 0) {
      Alert.alert('Sin Stock', `No queda stock disponible en el camión para "${nombreProd}".`);
      return;
    }

    setItems((prev) => {
      const indexExistente = prev.findIndex(
        (it) => (it.presentacion_id || it.IdPresentacion || it.id) === presId
      );

      if (indexExistente >= 0) {
        const itemExistente = prev[indexExistente];
        if (itemExistente.cantidadAEntregar >= saldo) {
          Alert.alert(
            'Límite de Stock',
            `Ya tienes todos los ${saldo} bultos disponibles de "${nombreProd}" agregados a la entrega.`
          );
          return prev;
        }
        const actualizados = prev.map((it, idx) =>
          idx === indexExistente ? { ...it, cantidadAEntregar: it.cantidadAEntregar + 1 } : it
        );
        autoSugerirSituacion(actualizados);
        return actualizados;
      }

      // No estaba en la lista: insertarlo con cantidad a entregar = 1
      const nuevoItem = {
        id: `camion-${presId}-${Date.now()}`,
        presentacion_id: presId,
        producto_nombre: nombreProd,
        cantidadPedida: 0,
        cantidadYaEntregada: 0,
        cantidadPendiente: 0,
        cantidadAEntregar: 1,
        precio_unitario: precioProd,
        es_bandeo: false,
        valor_bandeo: 0,
        es_agregado_camion: true,
      };

      const actualizados = [...prev, nuevoItem];
      autoSugerirSituacion(actualizados);
      return actualizados;
    });

    setModalAgregarCamionVisible(false);
  };

  // Selección manual de situación de visita
  const handleSeleccionarSituacion = (clave) => {
    if (clave === 'REPROGRAMAR') {
      Alert.alert(
        'Reprogramar o Reportar Incidencia',
        '¿Desea registrar esta visita como no concretada / no entregada?',
        [
          { text: 'Seguir editando entrega', style: 'cancel' },
          {
            text: 'Ir a Reportar Incidencia',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }
    setSituacionForzadaManual(true);
    setSituacionVisita(clave);
  };

  // Cálculo de totales financieros
  const totalBultosAEntregar = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.cantidadAEntregar || 0), 0);
  }, [items]);

  const totalMontoEntrega = useMemo(() => {
    return items.reduce((acc, item) => {
      const costo = item.es_bandeo ? 0 : (item.cantidadAEntregar || 0) * (item.precio_unitario || 0);
      return acc + costo;
    }, 0);
  }, [items]);

  // Si cambia el total y es pago completo con un solo método, ajustar monto sugerido
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

  // Cálculos de importes de pago
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

  // Validación de balance
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

  // Confirmar entrega y cobro
  const handleConfirmarEntregaYCobro = async () => {
    if (!receptorNombre.trim()) {
      Alert.alert('Faltan Datos', 'Ingrese el nombre de la persona que recibe la mercadería.');
      return;
    }

    if (totalBultosAEntregar <= 0) {
      Alert.alert('Cantidad Inválida', 'La cantidad a entregar debe ser mayor a 0 bultos.');
      return;
    }

    // Validar stock disponible en camión
    for (const item of items) {
      if (item.cantidadAEntregar <= 0) continue;
      const itemCamion = inventarioCamion.find(
        (c) => (c.presentacion_id || c.IdPresentacion || c.id) === item.presentacion_id
      );
      const stockDisponible = Number(
        itemCamion?.saldo_camion ?? itemCamion?.cantidad_disponible ?? itemCamion?.cantidad ?? 9999
      );
      if (item.cantidadAEntregar > stockDisponible) {
        Alert.alert(
          'Stock Insuficiente en Camión',
          `Solo dispones de ${stockDisponible} bultos en tu camión para "${item.producto_nombre}". Ingresaste ${item.cantidadAEntregar}.`
        );
        return;
      }
    }

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

    if (faltaFotoObligatoria) {
      Alert.alert(
        'Comprobante Obligatorio',
        'Debe tomar o adjuntar la fotografía del comprobante de depósito para pagos mediante QR o Transferencia bancaria.'
      );
      return;
    }

    if (!firmaChofer) {
      Alert.alert('Firma del Chofer Requerida', 'El chofer debe estampar su firma digital táctil obligatoria.');
      return;
    }

    if (!firmaCliente) {
      Alert.alert('Firma del Cliente Requerida', 'El cliente o receptor debe estampar su firma digital táctil.');
      return;
    }

    setLoading(true);

    // Determinar si tipo_entrega es TOTAL o PARCIAL
    const cantidadesModificadas = items.some(
      (it) => it.es_agregado_camion || it.cantidadAEntregar !== it.cantidadPedida
    );
    const tipoEntregaFinal =
      situacionVisita === 'NORMAL' && !cantidadesModificadas ? 'TOTAL' : 'PARCIAL';

    // Construcción del bloque cobro unificado
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

    let obsCompuesta = observaciones.trim();
    if (situacionVisita && !obsCompuesta.includes(`[${situacionVisita}]`)) {
      obsCompuesta = `[${situacionVisita}] ${obsCompuesta}`.trim();
    }

    const payloadEntregaCompuesta = {
      id_pedido: pedido?.id || pedido?.IdPedido || parada?.IdPedido,
      latitud: location?.latitude || -19.0435,
      longitud: location?.longitude || -65.2580,
      tipo_entrega: tipoEntregaFinal,
      incidencia: situacionVisita,
      recibido_por: receptorNombre.trim(),
      ci_receptor: receptorCi.trim(),
      observaciones: obsCompuesta,
      observacion: obsCompuesta,
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
          tipo_entrega: tipoEntregaFinal,
          incidencia: situacionVisita,
          recibido_por: receptorNombre.trim(),
          ci_receptor: receptorCi.trim(),
          observacion: obsCompuesta,
          firma_chofer: firmaChofer,
          firma_cliente: firmaCliente,
          items_entregados: payloadEntregaCompuesta.items_entregados,
          cobro: bloqueCobro,
        },
      };

      const idempotencyKey = SyncQueue.generarUuidV4();
      const numeroNota = `NE-${Date.now().toString().slice(-6)}`;
      const numeroRecibo = `REC-${Date.now().toString().slice(-6)}`;

      try {
        const res = await ClientesApi.registrarClienteEnRuta(payloadClienteRuta, idempotencyKey);
        if (!res.success) {
          await SyncQueue.encolarOperacion(
            'CLIENTE_EN_RUTA',
            payloadClienteRuta,
            { latitud: location?.latitude || -19.0435, longitud: location?.longitude || -65.2580 },
            idempotencyKey
          );
        }

        await LocalDB.actualizarEstadoParada(parada.id || parada.IdPuntoVenta, 'ENTREGADO', {
          numeroNota,
          numeroRecibo,
          items: payloadClienteRuta.entrega_con_cobro.items_entregados,
          cobro: bloqueCobro,
        });

        await LocalDB.descontarInventarioCamion(payloadClienteRuta.entrega_con_cobro.items_entregados);

        setLoading(false);

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

  // Opciones de Situación de Visita para el Paso 2
  const OPCIONES_SITUACION = [
    { clave: 'NORMAL', etiqueta: 'Entrega normal', icono: CheckCircle2 },
    { clave: 'PIDIO_MAS', etiqueta: 'Pidió más producto', icono: PlusCircle },
    { clave: 'PIDIO_MENOS', etiqueta: 'Pidió menos producto', icono: Minus },
    { clave: 'ATRASO', etiqueta: 'Entrega con atraso', icono: Clock },
    { clave: 'REPROGRAMAR', etiqueta: 'No estaba / Local cerrado / Reprogramar', icono: AlertTriangle },
  ];

  // Productos disponibles en el camión con stock > 0
  const productosDisponiblesCamion = useMemo(() => {
    return inventarioCamion.filter((c) => {
      const saldo = Number(c.saldo_camion ?? c.cantidad_disponible ?? c.cantidad ?? 0);
      return saldo > 0;
    });
  }, [inventarioCamion]);

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
          {/* 1. Encabezado del Cliente y Ubicación */}
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

          {/* PASO 1 — Productos y Cantidades 100% Editables */}
          <Card title="Productos a Entregar" icon={PackageCheck} style={styles.cardSection}>
            <Text style={styles.seccionSubtitulo}>
              Ajuste las cantidades entregadas en el acto. Puede escribir el número directamente o usar los botones.
            </Text>

            {items.map((item, index) => {
              const itemCamion = inventarioCamion.find(
                (s) => (s.presentacion_id || s.IdPresentacion || s.id) === item.presentacion_id
              );
              const saldoCamion = Number(
                itemCamion?.saldo_camion ?? itemCamion?.cantidad_disponible ?? itemCamion?.cantidad ?? 0
              );
              const subtotalItem = item.es_bandeo ? 0 : item.cantidadAEntregar * item.precio_unitario;

              // Etiquetas automáticas por producto
              const esCompleta =
                !item.es_agregado_camion &&
                item.cantidadAEntregar === item.cantidadPedida &&
                item.cantidadAEntregar > 0;
              const esPidioMas =
                !item.es_agregado_camion && item.cantidadAEntregar > item.cantidadPedida;
              const esPidioMenos =
                !item.es_agregado_camion && item.cantidadAEntregar < item.cantidadPedida;

              return (
                <View key={item.id} style={styles.itemBox}>
                  {/* Encabezado del producto */}
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.producto_nombre}</Text>
                    <Text style={styles.itemPrice}>
                      Bs. {item.precio_unitario.toFixed(2)} c/u
                    </Text>
                  </View>

                  {/* Badges de Estado Automático del Producto */}
                  <View style={styles.badgesProductoRow}>
                    {item.es_agregado_camion && (
                      <View style={styles.badgeAgregadoCamion}>
                        <Layers size={12} color="#7E22CE" style={{ marginRight: 4 }} />
                        <Text style={styles.badgeAgregadoCamionText}>Agregado del camión</Text>
                      </View>
                    )}
                    {esCompleta && (
                      <View style={styles.badgeEntregaCompleta}>
                        <CheckCircle2 size={12} color="#15803D" style={{ marginRight: 4 }} />
                        <Text style={styles.badgeEntregaCompletaText}>Entrega completa</Text>
                      </View>
                    )}
                    {esPidioMas && (
                      <View style={styles.badgePidioMas}>
                        <PlusCircle size={12} color="#0369A1" style={{ marginRight: 4 }} />
                        <Text style={styles.badgePidioMasText}>Pidió más</Text>
                      </View>
                    )}
                    {esPidioMenos && (
                      <View style={styles.badgePidioMenos}>
                        <AlertTriangle size={12} color="#B45309" style={{ marginRight: 4 }} />
                        <Text style={styles.badgePidioMenosText}>Entrega parcial / Pidió menos</Text>
                      </View>
                    )}
                  </View>

                  {/* Detalle de cantidades: Pedida y Stock en camión */}
                  <View style={styles.cantidadesInfoRow}>
                    {!item.es_agregado_camion && (
                      <View style={styles.infoPill}>
                        <Text style={styles.infoPillLabel}>Pedido:</Text>
                        <Text style={styles.infoPillValor}>{item.cantidadPedida} paq.</Text>
                      </View>
                    )}
                    <View style={styles.infoPillStock}>
                      <Truck size={13} color="#0F172A" style={{ marginRight: 4 }} />
                      <Text style={styles.infoPillLabelStock}>Stock camión:</Text>
                      <Text style={styles.infoPillValorStock}>{saldoCamion} disp.</Text>
                    </View>
                  </View>

                  {/* Bandeo de cortesía si aplica */}
                  {(item.es_bandeo || item.valor_bandeo > 0) && (
                    <View style={styles.bandeoBadge}>
                      <Gift size={13} color={Colors.accent} />
                      <Text style={styles.bandeoText}>
                        Promo Bandeo: Cortesía a costo Bs. 0.00
                      </Text>
                    </View>
                  )}

                  {/* CONTROL DE CANTIDAD 100% EDITABLE: Botones grandes [-] y [+] + TextInput directo */}
                  <View style={styles.controlCantidadContenedor}>
                    <Text style={styles.controlCantidadLabel}>A entregar ahora:</Text>

                    <View style={styles.stepperDirectoRow}>
                      {/* Botón Grande Decrementar [-] >= 48px */}
                      <TouchableOpacity
                        style={styles.stepperBotonMenos}
                        onPress={() => handleDecrementarCantidad(index)}
                        disabled={item.cantidadAEntregar <= 0}
                        activeOpacity={0.7}
                        accessibilityLabel="Disminuir cantidad"
                      >
                        <Minus size={22} color={item.cantidadAEntregar <= 0 ? '#94A3B8' : '#0F172A'} />
                      </TouchableOpacity>

                      {/* TextInput Directo Editable para tipear cualquier número */}
                      <TextInput
                        style={styles.stepperInputNumerico}
                        value={String(item.cantidadAEntregar)}
                        onChangeText={(val) => handleCambiarCantidadAEntregar(index, val)}
                        keyboardType="numeric"
                        selectTextOnFocus
                        accessibilityLabel={`Cantidad a entregar de ${item.producto_nombre}`}
                      />

                      {/* Botón Grande Incrementar [+] >= 48px */}
                      <TouchableOpacity
                        style={styles.stepperBotonMas}
                        onPress={() => handleIncrementarCantidad(index)}
                        disabled={item.cantidadAEntregar >= saldoCamion}
                        activeOpacity={0.7}
                        accessibilityLabel="Aumentar cantidad"
                      >
                        <Plus size={22} color={item.cantidadAEntregar >= saldoCamion ? '#94A3B8' : '#0F172A'} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Subtotal del item */}
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Subtotal producto:</Text>
                    <Text style={styles.subtotalNum}>Bs. {subtotalItem.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })}

            {/* BOTÓN DESTACADO: "+ Agregar otro producto del camión" */}
            <TouchableOpacity
              style={styles.btnAgregarProductoCamion}
              onPress={() => setModalAgregarCamionVisible(true)}
              activeOpacity={0.8}
            >
              <PlusCircle size={20} color="#0F172A" style={{ marginRight: 8 }} />
              <Text style={styles.btnAgregarProductoCamionTexto}>
                + Agregar otro producto del camión
              </Text>
            </TouchableOpacity>

            {/* Totales del lote de entrega */}
            <View style={styles.totalBox}>
              <View>
                <Text style={styles.totalBoxLabel}>Bultos a entregar:</Text>
                <Text style={styles.totalBoxBultos}>{totalBultosAEntregar} paquetes</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.totalBoxLabel}>Subtotal de salida:</Text>
                <Text style={styles.totalBoxAmount}>Bs. {totalMontoEntrega.toFixed(2)}</Text>
              </View>
            </View>
          </Card>

          {/* PASO 2 — Estado / Incidencia Flexible de la Visita */}
          <Card title="Situación de la Visita" icon={AlertTriangle} style={styles.cardSection}>
            <Text style={styles.seccionSubtitulo}>
              Indique cómo se desarrolló la parada o reporte una contingencia:
            </Text>

            <View style={styles.chipsSituacionGrid}>
              {OPCIONES_SITUACION.map((opc) => {
                const IconoOpc = opc.icono;
                const activo = situacionVisita === opc.clave;
                const esAlertaReprogramar = opc.clave === 'REPROGRAMAR';

                return (
                  <TouchableOpacity
                    key={opc.clave}
                    style={[
                      styles.chipSituacion,
                      activo && styles.chipSituacionActivo,
                      esAlertaReprogramar && styles.chipSituacionReprogramar,
                    ]}
                    onPress={() => handleSeleccionarSituacion(opc.clave)}
                    activeOpacity={0.75}
                  >
                    <IconoOpc
                      size={18}
                      color={
                        activo
                          ? '#FFFFFF'
                          : esAlertaReprogramar
                          ? '#DC2626'
                          : '#334155'
                      }
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.chipSituacionTexto,
                        activo && styles.chipSituacionTextoActivo,
                        !activo && esAlertaReprogramar && { color: '#DC2626', fontWeight: '800' },
                      ]}
                    >
                      {opc.etiqueta}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* PASO 3 — Condición de Pago Clara y Totales Monoespaciados */}
          <Card title="Condición y Método de Pago" icon={DollarSign} style={styles.cardSection}>
            <View style={styles.condicionGrid}>
              <TouchableOpacity
                style={[
                  styles.condicionBtn,
                  condicionPago === 'COMPLETO' && styles.condicionBtnActivo,
                ]}
                onPress={() => setCondicionPago('COMPLETO')}
                activeOpacity={0.8}
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
                activeOpacity={0.8}
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
                activeOpacity={0.8}
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

            {/* Métodos de Pago si hay pago hoy */}
            {condicionPago !== 'CREDITO' && (
              <View style={styles.metodosContainer}>
                <Text style={styles.subseccionTitulo}>Método para el cobro de hoy:</Text>
                <View style={styles.metodosGrid}>
                  {[
                    { id: 'EFECTIVO', label: 'Efectivo contado' },
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
                      activeOpacity={0.8}
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

                {/* Desglose de importes según método */}
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
                      placeholder="Ej: QR-BNB-892341"
                    />
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
                          Foto de comprobante requerida para confirmar cobro con QR.
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
                  <CreditCard size={18} color={Colors.primaryDark} />
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

            {/* RESUMEN FINANCIERO EN FUENTE MONOESPACIADA / TABULAR (DESIGN.md) */}
            <View style={styles.resumenFinancieroCaja}>
              <View style={styles.resumenFinancieroFila}>
                <Text style={styles.resumenFinancieroEtiqueta}>Subtotal Entrega:</Text>
                <Text style={styles.resumenFinancieroMonto}>
                  Bs. {totalMontoEntrega.toFixed(2)}
                </Text>
              </View>

              <View style={styles.resumenFinancieroFila}>
                <Text style={styles.resumenFinancieroEtiqueta}>Monto Pagado Ahora:</Text>
                <Text style={[styles.resumenFinancieroMonto, { color: '#15803D' }]}>
                  Bs. {totalPagadoAhora.toFixed(2)}
                </Text>
              </View>

              <View style={[styles.resumenFinancieroFila, styles.resumenFinancieroFilaFinal]}>
                <Text style={styles.resumenFinancieroEtiquetaTotal}>Saldo Pendiente / Crédito:</Text>
                <Text
                  style={[
                    styles.resumenFinancieroMontoTotal,
                    saldoCreditoCalculado > 0 && { color: '#B45309' },
                  ]}
                >
                  Bs. {saldoCreditoCalculado.toFixed(2)}
                </Text>
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

          {/* PASO 4 — Lienzos de Firma Digital con bloqueo de scroll */}
          <Card title="1. Firma Digital Táctil del Chofer *" icon={FileCheck2} style={styles.cardSection}>
            <Text style={styles.firmaDesc}>
              Certificación obligatoria de entrega de bultos por parte del chofer.
            </Text>
            <SignaturePad
              onSign={(firmaSvg) => setFirmaChofer(firmaSvg)}
              onDrawingChange={(drawing) => setScrollEnabled(!drawing)}
              title="Firmar Entrega (Chofer)"
              height={140}
            />
            {firmaChofer && (
              <View style={styles.firmaOkRow}>
                <CheckCircle2 size={16} color={Colors.success} style={{ marginRight: 6 }} />
                <Text style={styles.firmaOkText}>Firma del chofer registrada</Text>
              </View>
            )}
          </Card>

          <Card title="2. Firma Digital Táctil del Cliente Receptor *" icon={FileCheck2} style={styles.cardSection}>
            <Text style={styles.firmaDesc}>
              Conformidad física de los bultos y condición de cobro por parte del cliente.
            </Text>
            <SignaturePad
              onSign={(firmaSvg) => setFirmaCliente(firmaSvg)}
              onDrawingChange={(drawing) => setScrollEnabled(!drawing)}
              title="Firmar Recepción (Cliente)"
              height={140}
            />
            {firmaCliente && (
              <View style={styles.firmaOkRow}>
                <CheckCircle2 size={16} color={Colors.success} style={{ marginRight: 6 }} />
                <Text style={styles.firmaOkText}>Firma del cliente receptor registrada</Text>
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTÓN FIJO INFERIOR SEGURO (DESIGN.md - Touch target >= 48px, Radio 4px) */}
      <View style={styles.bottomFixedBar}>
        <Button
          title={loading ? "Procesando Entrega..." : "Confirmar Entrega y Cobro"}
          icon={PackageCheck}
          variant="primary"
          size="large"
          loading={loading}
          disabled={loading || faltaFotoObligatoria || !balanceCorrecto}
          onPress={handleConfirmarEntregaYCobro}
          style={styles.btnConfirmarFijo}
        />
        <Text style={styles.offlineFirstAviso}>
          Guardado en el teléfono, pendiente de enviar
        </Text>
      </View>

      {/* MODAL: Selector para "+ Agregar otro producto del camión" */}
      <Modal
        visible={modalAgregarCamionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAgregarCamionVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Truck size={20} color={Colors.primaryDark} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitulo} numberOfLines={1}>
                  Productos Disponibles en Camión
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalAgregarCamionVisible(false)}
                style={styles.modalBotonCerrarX}
                accessibilityLabel="Cerrar selector de productos"
                accessibilityRole="button"
                activeOpacity={0.7}
              >
                <X size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalSubtitulo}>
                Seleccione un producto disponible en el camión para sumarlo a la entrega de este cliente:
              </Text>

              {productosDisponiblesCamion.length === 0 ? (
                <View style={styles.modalSinStockCaja}>
                  <Text style={styles.modalSinStockTexto}>
                    No hay otros productos con stock disponible en el camión.
                  </Text>
                </View>
              ) : (
                productosDisponiblesCamion.map((prod) => {
                  const presId = prod.presentacion_id || prod.IdPresentacion || prod.id;
                  const nombre = prod.nombre_producto || prod.nombre || `Presentación #${presId}`;
                  const saldo = Number(prod.saldo_camion ?? prod.cantidad_disponible ?? prod.cantidad ?? 0);
                  const precio = Number(prod.precio_unitario || prod.precio || 25);
                  const yaEnLista = items.some(
                    (it) => (it.presentacion_id || it.IdPresentacion || it.id) === presId
                  );

                  return (
                    <View key={presId} style={styles.modalProductoFila}>
                      <View style={styles.modalProductoInfo}>
                        <Text style={styles.modalProductoNombre}>{nombre}</Text>
                        <Text style={styles.modalProductoMeta}>
                          Stock: <Text style={styles.modalProductoMetaBold}>{saldo} bultos</Text> | Bs. {precio.toFixed(2)} c/u
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.modalBtnSumar,
                          yaEnLista && styles.modalBtnSumarExistente,
                        ]}
                        onPress={() => handleAgregarProductoDelCamion(prod)}
                        activeOpacity={0.8}
                      >
                        <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.modalBtnSumarTexto}>
                          {yaEnLista ? '+1 Sumar' : '+ Agregar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={styles.modalBtnCerrar}
                onPress={() => setModalAgregarCamionVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnCerrarTexto}>Cerrar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    paddingBottom: 110, // Espacio suficiente para no solapar la barra fija inferior
  },
  cardSection: {
    marginBottom: 16,
    borderRadius: 4,
  },
  seccionSubtitulo: {
    fontSize: 12.5,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 18,
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
  itemBox: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    paddingRight: 8,
  },
  itemPrice: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  badgesProductoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badgeAgregadoCamion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeAgregadoCamionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E22CE',
  },
  badgeEntregaCompleta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeEntregaCompletaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  badgePidioMas: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgePidioMasText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  badgePidioMenos: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgePidioMenosText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  cantidadesInfoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoPillLabel: {
    fontSize: 11.5,
    color: '#475569',
    marginRight: 4,
  },
  infoPillValor: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  infoPillStock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  infoPillLabelStock: {
    fontSize: 11.5,
    color: '#475569',
    marginRight: 4,
  },
  infoPillValorStock: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
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
  controlCantidadContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  controlCantidadLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepperDirectoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBotonMenos: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputNumerico: {
    minWidth: 72,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 6,
  },
  stepperBotonMas: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  subtotalLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  subtotalNum: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  btnAgregarProductoCamion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    marginTop: 14,
    paddingHorizontal: 16,
  },
  btnAgregarProductoCamionTexto: {
    fontSize: 13.5,
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
    fontVariant: ['tabular-nums'],
  },
  totalBoxAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  chipsSituacionGrid: {
    gap: 8,
  },
  chipSituacion: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
  },
  chipSituacionActivo: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  chipSituacionReprogramar: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  chipSituacionTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  chipSituacionTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  condicionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  condicionBtn: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  condicionBtnActivo: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  condicionBtnTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  condicionBtnTextoActivo: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 2,
  },
  metodoBtnActivo: {
    borderColor: Colors.primaryDark,
    backgroundColor: '#F0F9FF',
  },
  metodoBtnTexto: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
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
  resumenFinancieroCaja: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  resumenFinancieroFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  resumenFinancieroFilaFinal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
  },
  resumenFinancieroEtiqueta: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
  },
  resumenFinancieroEtiquetaTotal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  resumenFinancieroMonto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  resumenFinancieroMontoTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  firmaDesc: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
  },
  firmaOkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  firmaOkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  bottomFixedBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  btnConfirmarFijo: {
    minHeight: 48,
    borderRadius: 4,
  },
  offlineFirstAviso: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
  },
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
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: 4,
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
    paddingRight: 8,
  },
  modalTitulo: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  modalBotonCerrarX: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    padding: 16,
  },
  modalSubtitulo: {
    fontSize: 12.5,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 18,
  },
  modalSinStockCaja: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSinStockTexto: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  modalProductoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  modalProductoInfo: {
    flex: 1,
  },
  modalProductoNombre: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalProductoMeta: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  modalProductoMetaBold: {
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  modalBtnSumar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 90,
    backgroundColor: Colors.primaryDark,
    borderRadius: 4,
    paddingHorizontal: 10,
  },
  modalBtnSumarExistente: {
    backgroundColor: '#0F172A',
  },
  modalBtnSumarTexto: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalBtnCerrar: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 16,
  },
  modalBtnCerrarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
});

export default RegistrarEntregaScreen;
