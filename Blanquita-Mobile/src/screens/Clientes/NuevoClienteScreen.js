import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useRuta } from "../../context/RutaContext";
import { useLocation } from "../../context/LocationContext";
import { Header } from "../../components/common/Header";
import { Card } from "../../components/common/Card";
import { Input } from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import { LocalDB } from "../../database/localDb";
import { SyncQueue } from "../../database/syncQueue";
import { ClientesApi } from "../../api/clientesApi";
import { insertarNuevoClienteEnSecuencia } from "../../services/syncService";
import {
  UserPlus,
  Store,
  MapPin,
  Phone,
  RotateCw,
  Navigation,
  AlertCircle,
  Calendar,
  Zap,
  UserCheck,
  Check,
  ArrowRight,
  Plus,
  Minus,
  Clock,
  Package,
} from "lucide-react-native";

const TIPOS_NEGOCIO = [
  "TIENDA_BARRIO",
  "DISTRIBUIDORA_MAYORISTA",
  "SUPERMERCADO",
  "FARMACIA",
  "INSTITUCION_EDUCATIVA",
  "OTRO",
];

const FRECUENCIAS_VISITA = [
  { id: "DIARIO", label: "Diario", desc: "Todos los días laborales (Lun-Sáb)" },
  { id: "CADA_2_DIAS", label: "Cada 2 Días", desc: "Visita en días alternos" },
  { id: "SEMANAL", label: "Semanal", desc: "Días específicos de la semana" },
  { id: "FECHA_ESPECIFICA", label: "Fecha Puntual", desc: "Visita en fecha específica" },
];

const DIAS_SEMANA = [
  { id: "LUNES", label: "Lunes", num: 1 },
  { id: "MARTES", label: "Martes", num: 2 },
  { id: "MIERCOLES", label: "Miércoles", num: 3 },
  { id: "JUEVES", label: "Jueves", num: 4 },
  { id: "VIERNES", label: "Viernes", num: 5 },
  { id: "SABADO", label: "Sábado", num: 6 },
];

const MAPA_DIAS_NUMERO = {
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
  DOMINGO: 7,
};

function calcularFechaOffset(diasOffset = 1) {
  const d = new Date();
  d.setDate(d.getDate() + diasOffset);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const CATALOGO_DEFAULT = [
  { id: 1, presentacion_id: 1, nombre: "Papel Higiénico Clásico (Fardo)", precio: 24.5 },
  { id: 2, presentacion_id: 2, nombre: "Papel Higiénico Familiar 12r (Fardo)", precio: 45.0 },
  { id: 3, presentacion_id: 3, nombre: "Servilletas Blanquita Mesa 200u", precio: 12.0 },
  { id: 4, presentacion_id: 4, nombre: "Toalla Interdoblada 150u", precio: 18.5 },
  { id: 5, presentacion_id: 5, nombre: "Bobina Industrial 500m", precio: 120.0 },
];

export const NuevoClienteScreen = ({ navigation }) => {
  const { asignacionActiva } = useRuta();
  const { location, getCurrentCoords } = useLocation();

  // 1. Datos comerciales y de contacto
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [nombrePropietario, setNombrePropietario] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("Sucre");
  const [tipoNegocio, setTipoNegocio] = useState("TIENDA_BARRIO");
  const [observaciones, setObservaciones] = useState("");

  // 2. Tres modalidades operativas de atención en campo
  // 'ENTREGA_INMEDIATA' (Opción A) | 'PROGRAMAR_ENTREGA' (Opción B) | 'SOLO_REGISTRO'
  const [modalidad, setModalidad] = useState("ENTREGA_INMEDIATA");

  // 3. Programación de Frecuencia de Visita
  // 'DIARIO' | 'CADA_2_DIAS' | 'SEMANAL' | 'FECHA_ESPECIFICA'
  const [frecuenciaVisita, setFrecuenciaVisita] = useState("SEMANAL");
  const [diasSemanaSeleccionados, setDiasSemanaSeleccionados] = useState(["LUNES"]);
  const [fechaEspecifica, setFechaEspecifica] = useState(() => calcularFechaOffset(1));

  // 4. Catálogo y Pedido Habitual / Programado
  const [catalogoProductos, setCatalogoProductos] = useState(CATALOGO_DEFAULT);
  const [cantidadesProgramadas, setCantidadesProgramadas] = useState({});
  const [stockPorProducto, setStockPorProducto] = useState({});

  // 5. Parada actual y stock del camión
  const [paradaActualOrden, setParadaActualOrden] = useState(0);
  const [stockCamionTotal, setStockCamionTotal] = useState(0);

  // 6. Estados de interfaz y GPS
  const [loading, setLoading] = useState(false);
  const [refreshingGps, setRefreshingGps] = useState(false);
  const [gpsManualActivado, setGpsManualActivado] = useState(false);
  const [mostrarFallbackGps, setMostrarFallbackGps] = useState(false);

  const fallbackTimerRef = useRef(null);

  // Cargar inventario del camión, catálogo y última parada atendida
  useEffect(() => {
    let activo = true;

    async function cargarDatosIniciales() {
      // 1. Inventario en camión y catálogo de productos
      try {
        const invCamion = await LocalDB.obtenerInventarioCamion();
        if (activo && invCamion?.items?.length > 0) {
          const mapaStock = {};
          let totalDisp = 0;
          invCamion.items.forEach((it) => {
            const pId = it.presentacion_id || it.id;
            const cant = Number(
              it.saldo_actual ??
                it.cantidad_disponible ??
                it.saldo_camion ??
                it.cantidad ??
                0
            );
            mapaStock[pId] = cant;
            totalDisp += cant;
          });
          setStockPorProducto(mapaStock);
          setStockCamionTotal(totalDisp);
        }

        const productosDb = await LocalDB.obtenerProductos();
        if (activo && Array.isArray(productosDb) && productosDb.length > 0) {
          setCatalogoProductos(productosDb);
        } else if (activo && invCamion?.items?.length > 0) {
          setCatalogoProductos(
            invCamion.items.map((i) => ({
              id: i.presentacion_id || i.id,
              presentacion_id: i.presentacion_id || i.id,
              nombre: i.nombre_producto || i.nombre || `Producto #${i.presentacion_id}`,
              precio: Number(i.precio_unitario || i.precio || 25),
            }))
          );
        }
      } catch (_e) {}

      // 2. Determinar última parada atendida de la hoja de ruta activa
      try {
        const ruta = (await LocalDB.obtenerRutaActiva()) || asignacionActiva;
        if (ruta && Array.isArray(ruta.paradas)) {
          let maxOrdenAtendida = 0;
          ruta.paradas.forEach((p) => {
            const estado = String(p.estado || p.Estado || "").toUpperCase();
            const atendida =
              estado === "ENTREGADO" || estado === "NO_ENTREGADO" || Boolean(p.cobro);
            const ord = Number(p.orden ?? p.secuencia ?? p.OrdenVisita ?? 0);
            if (atendida && ord > maxOrdenAtendida) {
              maxOrdenAtendida = ord;
            }
          });
          if (activo) {
            setParadaActualOrden(maxOrdenAtendida);
          }
        }
      } catch (_e) {}
    }

    cargarDatosIniciales();
    return () => {
      activo = false;
    };
  }, [asignacionActiva]);

  useEffect(() => {
    fallbackTimerRef.current = setTimeout(() => {
      if (!location) {
        setMostrarFallbackGps(true);
      }
    }, 4000);

    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, [location]);

  const handleRefrescarGps = async () => {
    setRefreshingGps(true);
    setGpsManualActivado(false);
    await getCurrentCoords();
    setRefreshingGps(false);
  };

  const handleActivarFallbackGps = () => {
    setGpsManualActivado(true);
    setMostrarFallbackGps(false);
  };

  const coordenadasEfectivas =
    location ||
    (gpsManualActivado ? { latitude: -19.0431, longitude: -65.2592, accuracy: 50 } : null);

  // Manejo de multiselección de días de la semana
  const handleToggleDiaSemana = (diaId) => {
    setDiasSemanaSeleccionados((prev) => {
      if (prev.includes(diaId)) {
        if (prev.length <= 1) {
          Alert.alert("Día Requerido", "Debe mantener al menos un día seleccionado.");
          return prev;
        }
        return prev.filter((d) => d !== diaId);
      }
      return [...prev, diaId];
    });
  };

  // Modificación de cantidades en el pedido mediante [-] y [+]
  const handleModificarCantidad = (presentacionId, delta) => {
    setCantidadesProgramadas((prev) => {
      const actual = Number(prev[presentacionId] || 0);
      const nueva = Math.max(0, actual + delta);
      if (nueva === 0) {
        const copia = { ...prev };
        delete copia[presentacionId];
        return copia;
      }
      return { ...prev, [presentacionId]: nueva };
    });
  };

  // Edición numérica directa en el campo de texto
  const handleCambiarCantidadDirecta = (presentacionId, texto) => {
    const limpio = texto.replace(/[^0-9]/g, "");
    if (!limpio || limpio === "0") {
      setCantidadesProgramadas((prev) => {
        const copia = { ...prev };
        delete copia[presentacionId];
        return copia;
      });
      return;
    }
    const valor = parseInt(limpio, 10);
    setCantidadesProgramadas((prev) => ({
      ...prev,
      [presentacionId]: valor,
    }));
  };

  // Lista de items con cantidades mayores a 0
  const itemsSeleccionados = useMemo(() => {
    return Object.entries(cantidadesProgramadas)
      .filter(([_, cant]) => Number(cant) > 0)
      .map(([presId, cant]) => {
        const prod = catalogoProductos.find(
          (p) => String(p.presentacion_id || p.id) === String(presId)
        );
        const cantidad = Number(cant);
        const precioUnitario = Number(prod?.precio || prod?.precio_unitario || 0);
        return {
          id: parseInt(presId, 10),
          presentacion_id: parseInt(presId, 10),
          nombre: prod?.nombre || prod?.nombre_producto || `Producto #${presId}`,
          nombre_producto: prod?.nombre || prod?.nombre_producto || `Producto #${presId}`,
          cantidad,
          precio_unitario: precioUnitario,
          precio: precioUnitario,
          precio_estimado: precioUnitario,
          subtotal: Number((cantidad * precioUnitario).toFixed(2)),
        };
      });
  }, [cantidadesProgramadas, catalogoProductos]);

  const totalBultosProgramados = useMemo(() => {
    return itemsSeleccionados.reduce((sum, it) => sum + it.cantidad, 0);
  }, [itemsSeleccionados]);

  const totalMontoEstimado = useMemo(() => {
    return itemsSeleccionados.reduce((sum, it) => sum + it.subtotal, 0);
  }, [itemsSeleccionados]);

  // Guardar según la modalidad seleccionada
  const handleGuardarOContinuar = async () => {
    if (!razonSocial.trim()) {
      Alert.alert("Falta Información", "Ingrese el nombre o razón social del cliente.");
      return;
    }
    if (!direccion.trim()) {
      Alert.alert("Falta Dirección", "Ingrese la dirección o calle del negocio.");
      return;
    }

    const lat = coordenadasEfectivas?.latitude || -19.0431;
    const lng = coordenadasEfectivas?.longitude || -65.2592;

    const datosClienteBase = {
      razon_social: razonSocial.trim(),
      nombre_comercial: nombreComercial.trim() || razonSocial.trim(),
      nombre_propietario: nombrePropietario.trim() || null,
      ci_nit: nitCi.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim(),
      zona: zona.trim(),
      tipo_negocio: tipoNegocio,
      observaciones: observaciones.trim() || null,
      latitud: lat,
      longitud: lng,
    };

    // -----------------------------------------------------------------
    // OPCIÓN A: ENTREGAR HOY MISMO (ENTREGA INMEDIATA AL PASO)
    // -----------------------------------------------------------------
    if (modalidad === "ENTREGA_INMEDIATA") {
      if (stockCamionTotal <= 0) {
        Alert.alert(
          "Sin Stock en Camión",
          "No dispone de mercadería disponible en el camión para realizar entregas inmediatas en este momento. Puede registrar al cliente en el padrón o dejarle programada una visita futura."
        );
        return;
      }

      if (itemsSeleccionados.length === 0) {
        Alert.alert(
          "Seleccione Productos",
          "Indique qué productos y cuántas unidades entregará hoy al cliente en la sección de productos."
        );
        return;
      }

      setLoading(true);

      const nuevoOrdenCalculado = Number(paradaActualOrden || 0) + 1;
      const tempId = `temp_cli_${Date.now()}`;

      // Crear objeto de parada para la hoja de ruta
      const nuevaParadaEnRuta = {
        id: tempId,
        IdPuntoVenta: tempId,
        orden: nuevoOrdenCalculado,
        secuencia: nuevoOrdenCalculado,
        OrdenVisita: nuevoOrdenCalculado,
        estado: "PENDIENTE",
        Estado: "PENDIENTE",
        EsNuevoEnCampo: true,
        cliente: {
          id: tempId,
          razon_social: datosClienteBase.razon_social,
          nombre_comercial: datosClienteBase.nombre_comercial,
          nombre_propietario: datosClienteBase.nombre_propietario,
          ci_nit: datosClienteBase.ci_nit,
          telefono: datosClienteBase.telefono,
          direccion: datosClienteBase.direccion,
          latitud: lat,
          longitud: lng,
          saldo_pendiente: 0,
        },
        pedido: {
          id: `ped_${tempId}`,
          monto_total: totalMontoEstimado,
          items: itemsSeleccionados,
        },
      };

      try {
        // Insertar en la secuencia local desplazando paradas pendientes posteriores
        await insertarNuevoClienteEnSecuencia(nuevaParadaEnRuta, paradaActualOrden);
        setLoading(false);

        // Redirigir a RegistrarEntregaScreen con productos y cantidades precargadas
        navigation.navigate("RegistrarEntrega", {
          parada: nuevaParadaEnRuta,
          pedido: nuevaParadaEnRuta.pedido,
          esNuevoClienteEnRuta: true,
          nuevoClientePayload: {
            datos_cliente: {
              ...datosClienteBase,
              frecuencia_visita: frecuenciaVisita,
              dias_semana: diasSemanaSeleccionados,
              pedido_habitual: itemsSeleccionados,
              fecha_primera_entrega:
                frecuenciaVisita === "FECHA_ESPECIFICA" ? fechaEspecifica : null,
            },
            modalidad: "ENTREGA_INMEDIATA",
            frecuencia_visita: frecuenciaVisita,
            dias_semana: diasSemanaSeleccionados,
            pedido_habitual: itemsSeleccionados,
            fecha_primera_entrega:
              frecuenciaVisita === "FECHA_ESPECIFICA" ? fechaEspecifica : null,
            dia_semana_programado:
              MAPA_DIAS_NUMERO[diasSemanaSeleccionados[0] || "LUNES"] || 1,
            items_programados: itemsSeleccionados.map((i) => ({
              presentacion_id: i.presentacion_id,
              cantidad: i.cantidad,
            })),
            parada_actual_orden: paradaActualOrden,
          },
        });
      } catch (err) {
        setLoading(false);
        Alert.alert("Error", err.message || "No se pudo insertar el cliente en la ruta.");
      }
      return;
    }

    // -----------------------------------------------------------------
    // OPCIÓN B: PROGRAMAR PARA PRÓXIMA VISITA / RUTA FUTURA
    // -----------------------------------------------------------------
    if (modalidad === "PROGRAMAR_ENTREGA") {
      if (itemsSeleccionados.length === 0) {
        Alert.alert(
          "Pedido Habitual Requerido",
          "Indique las cantidades habituales de los productos que recibirá el cliente para programar sus visitas."
        );
        return;
      }

      if (frecuenciaVisita === "SEMANAL" && diasSemanaSeleccionados.length === 0) {
        Alert.alert(
          "Seleccione Días de Visita",
          "Seleccione al menos un día de la semana para la visita comercial."
        );
        return;
      }

      if (frecuenciaVisita === "FECHA_ESPECIFICA" && !fechaEspecifica.trim()) {
        Alert.alert("Fecha Requerida", "Indique la fecha puntual para la primera entrega.");
        return;
      }

      setLoading(true);

      const primerDia = diasSemanaSeleccionados[0] || "LUNES";
      const diaSemanaNum = MAPA_DIAS_NUMERO[primerDia] || 1;

      const payloadProgramado = {
        datos_cliente: {
          ...datosClienteBase,
          frecuencia_visita: frecuenciaVisita,
          dias_semana: diasSemanaSeleccionados,
          pedido_habitual: itemsSeleccionados,
          fecha_primera_entrega:
            frecuenciaVisita === "FECHA_ESPECIFICA" ? fechaEspecifica : null,
        },
        modalidad: "PROGRAMAR_ENTREGA",
        frecuencia_visita: frecuenciaVisita,
        dias_semana: diasSemanaSeleccionados,
        pedido_habitual: itemsSeleccionados,
        fecha_primera_entrega:
          frecuenciaVisita === "FECHA_ESPECIFICA" ? fechaEspecifica : null,
        dia_semana_programado: diaSemanaNum,
        items_programados: itemsSeleccionados.map((i) => ({
          presentacion_id: i.presentacion_id,
          cantidad: i.cantidad,
        })),
        parada_actual_orden: null,
        entrega_con_cobro: null,
      };

      try {
        const idempotencyKey = SyncQueue.generarUuidV4();
        let res = null;
        try {
          res = await ClientesApi.registrarClienteEnRuta(payloadProgramado, idempotencyKey);
        } catch (_netErr) {
          res = { success: false, error: _netErr.message };
        }

        if (!res || !res.success) {
          await SyncQueue.encolarOperacion(
            "CLIENTE_EN_RUTA",
            payloadProgramado,
            { latitud: lat, longitud: lng },
            null
          );
        }

        await LocalDB.agregarClienteLocal({
          IdPuntoVenta: `cli_${Date.now()}`,
          NombreCliente: datosClienteBase.razon_social,
          NombrePuntoVenta: datosClienteBase.nombre_comercial,
          Telefono: datosClienteBase.telefono,
          Direccion: datosClienteBase.direccion,
          Latitud: lat,
          Longitud: lng,
          EsNuevoEnCampo: true,
          frecuencia_visita: frecuenciaVisita,
          dias_semana: diasSemanaSeleccionados,
          pedidoProgramado: {
            frecuencia: frecuenciaVisita,
            dias: diasSemanaSeleccionados,
            fecha: frecuenciaVisita === "FECHA_ESPECIFICA" ? fechaEspecifica : null,
            items: itemsSeleccionados,
            totalBultos: totalBultosProgramados,
            montoEstimado: totalMontoEstimado,
          },
          fechaRegistro: new Date().toISOString(),
        });

        setLoading(false);
        const descFreq =
          frecuenciaVisita === "DIARIO"
            ? "visitas diarias"
            : frecuenciaVisita === "CADA_2_DIAS"
            ? "visitas cada 2 días"
            : frecuenciaVisita === "SEMANAL"
            ? `visitas los ${diasSemanaSeleccionados.join(", ")}`
            : `entrega el ${fechaEspecifica}`;

        Alert.alert(
          res?.success ? "Visita Programada" : "Programación Guardada (Modo Local)",
          res?.success
            ? `Cliente registrado con ${descFreq}. El cálculo nocturno de la empresa lo incorporará a las rutas correspondientes.`
            : `Programación registrada en el teléfono con ${descFreq}. Se sincronizará automáticamente al conectar a internet.`,
          [{ text: "Aceptar", onPress: () => navigation.goBack() }]
        );
      } catch (err) {
        setLoading(false);
        Alert.alert("Error", err.message || "Fallo inesperado al programar visita.");
      }
      return;
    }

    // -----------------------------------------------------------------
    // OPCIÓN C: SOLO REGISTRAR EN PADRÓN (Sin venta ni entrega hoy)
    // -----------------------------------------------------------------
    if (modalidad === "SOLO_REGISTRO") {
      setLoading(true);
      const payloadSoloRegistro = {
        datos_cliente: {
          ...datosClienteBase,
          frecuencia_visita: frecuenciaVisita,
          dias_semana: diasSemanaSeleccionados,
          pedido_habitual: itemsSeleccionados,
          fecha_primera_entrega:
            frecuenciaVisita === "FECHA_ESPECIFICA" ? fechaEspecifica : null,
        },
        modalidad: "SOLO_REGISTRO",
        frecuencia_visita: frecuenciaVisita,
        dias_semana: diasSemanaSeleccionados,
        pedido_habitual: itemsSeleccionados,
        fecha_primera_entrega:
          frecuenciaVisita === "FECHA_ESPECIFICA" ? fechaEspecifica : null,
        dia_semana_programado: null,
        items_programados: null,
        parada_actual_orden: null,
        entrega_con_cobro: null,
      };

      try {
        const idempotencyKey = SyncQueue.generarUuidV4();
        let res = null;
        try {
          res = await ClientesApi.registrarClienteEnRuta(payloadSoloRegistro, idempotencyKey);
        } catch (_netErr) {
          res = { success: false, error: _netErr.message };
        }

        if (!res || !res.success) {
          await SyncQueue.encolarOperacion(
            "CLIENTE_EN_RUTA",
            payloadSoloRegistro,
            { latitud: lat, longitud: lng },
            null
          );
        }

        await LocalDB.agregarClienteLocal({
          IdPuntoVenta: `cli_${Date.now()}`,
          NombreCliente: datosClienteBase.razon_social,
          NombrePuntoVenta: datosClienteBase.nombre_comercial,
          Telefono: datosClienteBase.telefono,
          Direccion: datosClienteBase.direccion,
          Latitud: lat,
          Longitud: lng,
          EsNuevoEnCampo: true,
          frecuencia_visita: frecuenciaVisita,
          dias_semana: diasSemanaSeleccionados,
          pedidoProgramado: {
            frecuencia: frecuenciaVisita,
            items: itemsSeleccionados,
          },
          fechaRegistro: new Date().toISOString(),
        });

        setLoading(false);
        Alert.alert(
          res?.success ? "Cliente Registrado" : "Cliente Guardado (Modo Local)",
          res?.success
            ? "El cliente ha sido incorporado al padrón comercial de la empresa."
            : "El cliente ha sido guardado en el teléfono y se sincronizará automáticamente con el servidor.",
          [{ text: "Aceptar", onPress: () => navigation.goBack() }]
        );
      } catch (err) {
        setLoading(false);
        Alert.alert("Error", err.message || "Fallo inesperado al registrar cliente.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Nuevo Cliente"
        subtitle="Registro y atención de clientes en ruta"
        showBackButton
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Selector de Modalidades Operativas */}
        <Card title="Modalidad de Atención" icon={Store} style={styles.cardSection}>
          <Text style={styles.modalidadSub}>
            Seleccione la acción operativa a realizar con este cliente:
          </Text>

          <View style={styles.modalidadesContainer}>
            {/* Opción A: Entregar hoy mismo */}
            <TouchableOpacity
              style={[
                styles.modalidadCard,
                modalidad === "ENTREGA_INMEDIATA" && styles.modalidadCardActiveVerde,
              ]}
              onPress={() => setModalidad("ENTREGA_INMEDIATA")}
              activeOpacity={0.8}
            >
              <View style={styles.modalidadIconWrap}>
                <Zap
                  size={20}
                  color={modalidad === "ENTREGA_INMEDIATA" ? Colors.success : Colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.modalidadHeaderRow}>
                  <Text
                    style={[
                      styles.modalidadTitulo,
                      modalidad === "ENTREGA_INMEDIATA" && { color: Colors.success },
                    ]}
                  >
                    Opción A - Entregar Hoy Mismo
                  </Text>
                  {stockCamionTotal > 0 ? (
                    <View style={styles.badgeStockCamion}>
                      <Text style={styles.badgeStockCamionText}>
                        {stockCamionTotal} bultos en camión
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.badgeSinStock}>
                      <Text style={styles.badgeSinStockText}>Sin stock</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalidadDesc}>
                  Venta en el acto: se inserta en ruta tras parada actual y se entrega de inmediato con cobro.
                </Text>
              </View>
              {modalidad === "ENTREGA_INMEDIATA" && <Check size={18} color={Colors.success} />}
            </TouchableOpacity>

            {/* Opción B: Programar para próxima visita */}
            <TouchableOpacity
              style={[
                styles.modalidadCard,
                modalidad === "PROGRAMAR_ENTREGA" && styles.modalidadCardActiveAmbar,
              ]}
              onPress={() => setModalidad("PROGRAMAR_ENTREGA")}
              activeOpacity={0.8}
            >
              <View style={styles.modalidadIconWrap}>
                <Calendar
                  size={20}
                  color={modalidad === "PROGRAMAR_ENTREGA" ? "#D97706" : Colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.modalidadTitulo,
                    modalidad === "PROGRAMAR_ENTREGA" && { color: "#D97706" },
                  ]}
                >
                  Opción B - Programar Próxima Visita / Ruta Futura
                </Text>
                <Text style={styles.modalidadDesc}>
                  Configura frecuencia y pedido habitual para que el cálculo nocturno lo incorpore a la ruta correspondiente.
                </Text>
              </View>
              {modalidad === "PROGRAMAR_ENTREGA" && <Check size={18} color="#D97706" />}
            </TouchableOpacity>

            {/* Opción C: Solo Registrar Cliente */}
            <TouchableOpacity
              style={[
                styles.modalidadCard,
                modalidad === "SOLO_REGISTRO" && styles.modalidadCardActive,
              ]}
              onPress={() => setModalidad("SOLO_REGISTRO")}
              activeOpacity={0.8}
            >
              <View style={styles.modalidadIconWrap}>
                <UserCheck
                  size={20}
                  color={modalidad === "SOLO_REGISTRO" ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.modalidadTitulo,
                    modalidad === "SOLO_REGISTRO" && styles.modalidadTituloActive,
                  ]}
                >
                  Opción C - Solo Registrar en Padrón
                </Text>
                <Text style={styles.modalidadDesc}>
                  Alta comercial en sistema para visitas o pedidos posteriores sin entrega hoy.
                </Text>
              </View>
              {modalidad === "SOLO_REGISTRO" && <Check size={18} color={Colors.primary} />}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Panel de Secuencia en Hoja de Ruta para Opción A */}
        {modalidad === "ENTREGA_INMEDIATA" && (
          <Card title="Secuencia en Hoja de Ruta" icon={Navigation} style={styles.cardSection}>
            <View style={styles.posicionInfoBox}>
              <View style={styles.posicionBadge}>
                <Text style={styles.posicionBadgeText}>Parada #{paradaActualOrden + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.posicionTitulo}>
                  Se insertará inmediatamente después de la Parada #{paradaActualOrden}
                </Text>
                <Text style={styles.posicionDesc}>
                  {paradaActualOrden > 0
                    ? `Última parada atendida: #${paradaActualOrden}. Las paradas pendientes posteriores se desplazarán en +1 automáticamente.`
                    : "No hay paradas atendidas aún en la jornada. El cliente se ubicará como primera parada de entrega."}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Programación de Frecuencia de Visita */}
        <Card title="Frecuencia de Visita Comercial" icon={Clock} style={styles.cardSection}>
          <Text style={styles.selectorLabel}>Frecuencia de Atención *</Text>
          <View style={styles.frecuenciasContainer}>
            {FRECUENCIAS_VISITA.map((freq) => {
              const activa = frecuenciaVisita === freq.id;
              return (
                <TouchableOpacity
                  key={freq.id}
                  style={[styles.freqChip, activa && styles.freqChipActive]}
                  onPress={() => setFrecuenciaVisita(freq.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.freqChipLabel, activa && styles.freqChipLabelActive]}>
                    {freq.label}
                  </Text>
                  <Text style={[styles.freqChipDesc, activa && styles.freqChipDescActive]}>
                    {freq.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Días específicos si la frecuencia es SEMANAL */}
          {frecuenciaVisita === "SEMANAL" && (
            <View style={styles.subSeccionProgramacion}>
              <Text style={styles.selectorLabel}>
                Días de Visita Semanal ({diasSemanaSeleccionados.length} seleccionados) *
              </Text>
              <View style={styles.diasGrid}>
                {DIAS_SEMANA.map((dia) => {
                  const sel = diasSemanaSeleccionados.includes(dia.id);
                  return (
                    <TouchableOpacity
                      key={dia.id}
                      style={[styles.diaChip, sel && styles.diaChipActive]}
                      onPress={() => handleToggleDiaSemana(dia.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.diaChipContent}>
                        {sel && <Check size={14} color="#B45309" style={{ marginRight: 4 }} />}
                        <Text style={[styles.diaChipText, sel && styles.diaChipTextActive]}>
                          {dia.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.ayudaTexto}>
                Toque los días en que el camión visitará habitualmente a este cliente.
              </Text>
            </View>
          )}

          {/* Selector de fecha si la frecuencia es FECHA_ESPECIFICA */}
          {frecuenciaVisita === "FECHA_ESPECIFICA" && (
            <View style={styles.subSeccionProgramacion}>
              <Text style={styles.selectorLabel}>Fecha Puntual de Entrega (AAAA-MM-DD) *</Text>
              <View style={styles.fechaRapidaRow}>
                <TouchableOpacity
                  style={[
                    styles.btnFechaRapida,
                    fechaEspecifica === calcularFechaOffset(1) && styles.btnFechaRapidaActive,
                  ]}
                  onPress={() => setFechaEspecifica(calcularFechaOffset(1))}
                >
                  <Text
                    style={[
                      styles.btnFechaRapidaText,
                      fechaEspecifica === calcularFechaOffset(1) && styles.btnFechaRapidaTextActive,
                    ]}
                  >
                    Mañana
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnFechaRapida,
                    fechaEspecifica === calcularFechaOffset(2) && styles.btnFechaRapidaActive,
                  ]}
                  onPress={() => setFechaEspecifica(calcularFechaOffset(2))}
                >
                  <Text
                    style={[
                      styles.btnFechaRapidaText,
                      fechaEspecifica === calcularFechaOffset(2) && styles.btnFechaRapidaTextActive,
                    ]}
                  >
                    En 2 días
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.btnFechaRapida,
                    fechaEspecifica === calcularFechaOffset(7) && styles.btnFechaRapidaActive,
                  ]}
                  onPress={() => setFechaEspecifica(calcularFechaOffset(7))}
                >
                  <Text
                    style={[
                      styles.btnFechaRapidaText,
                      fechaEspecifica === calcularFechaOffset(7) && styles.btnFechaRapidaTextActive,
                    ]}
                  >
                    En 1 semana
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.inputFecha}
                value={fechaEspecifica}
                onChangeText={setFechaEspecifica}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={Colors.textMuted}
                maxLength={10}
              />
            </View>
          )}
        </Card>

        {/* Catálogo de Productos y Pedido Habitual / Programado */}
        <Card
          title={
            modalidad === "ENTREGA_INMEDIATA"
              ? "Productos a Entregar Hoy Mismo"
              : modalidad === "PROGRAMAR_ENTREGA"
              ? "Pedido Habitual / Programado"
              : "Pedido Habitual Estimado (Opcional)"
          }
          icon={Package}
          style={styles.cardSection}
        >
          <Text style={styles.modalidadSub}>
            {modalidad === "ENTREGA_INMEDIATA"
              ? "Indique las unidades que descargará y cobrará hoy mismo de su camión:"
              : "Defina qué presentaciones y cuántas unidades recibe habitualmente el cliente:"}
          </Text>

          {catalogoProductos.map((item) => {
            const presId = item.presentacion_id || item.id;
            const cantidad = Number(cantidadesProgramadas[presId] || 0);
            const stockDisponible = stockPorProducto[presId] || 0;
            const precioRef = Number(item.precio || item.precio_unitario || 0);

            return (
              <View key={presId} style={styles.productoRow}>
                <View style={styles.productoInfoCol}>
                  <Text style={styles.productoNombre}>{item.nombre}</Text>
                  <View style={styles.productoMetaRow}>
                    <Text style={styles.productoPrecio}>
                      Ref: Bs. {precioRef.toFixed(2)}
                    </Text>
                    {stockDisponible > 0 ? (
                      <View style={styles.badgeStockItem}>
                        <Text style={styles.badgeStockItemText}>
                          Camión: {stockDisponible} u
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.badgeSinStockItem}>
                        <Text style={styles.badgeSinStockItemText}>0 en camión</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Controles numéricos industriales con touch targets >= 48px */}
                <View style={styles.contadorContainer}>
                  <TouchableOpacity
                    style={[styles.btnContador, cantidad <= 0 && styles.btnContadorDisabled]}
                    onPress={() => handleModificarCantidad(presId, -1)}
                    disabled={cantidad <= 0}
                    accessibilityLabel={`Disminuir cantidad de ${item.nombre}`}
                  >
                    <Minus size={18} color={cantidad > 0 ? Colors.text : Colors.textMuted} />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.inputContadorDirecto}
                    value={cantidad > 0 ? String(cantidad) : ""}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleCambiarCantidadDirecta(presId, txt)}
                    accessibilityLabel={`Cantidad para ${item.nombre}`}
                  />

                  <TouchableOpacity
                    style={styles.btnContador}
                    onPress={() => handleModificarCantidad(presId, 1)}
                    accessibilityLabel={`Aumentar cantidad de ${item.nombre}`}
                  >
                    <Plus size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Resumen del Pedido Programado */}
          <View style={styles.resumenPedidoBox}>
            <View style={styles.resumenCol}>
              <Text style={styles.resumenLabel}>Total Bultos:</Text>
              <Text style={styles.resumenValorBultos}>{totalBultosProgramados} bultos</Text>
            </View>
            <View style={styles.resumenCol}>
              <Text style={styles.resumenLabel}>Monto Estimado:</Text>
              <Text style={styles.resumenValorBs}>Bs. {totalMontoEstimado.toFixed(2)}</Text>
            </View>
          </View>
        </Card>

        {/* Punto GPS del Negocio */}
        <Card title="Punto GPS del Negocio" icon={MapPin} style={styles.cardSection}>
          <View style={styles.gpsRow}>
            <View style={styles.gpsInfo}>
              <Text style={styles.gpsCoords}>
                {coordenadasEfectivas
                  ? `Lat: ${coordenadasEfectivas.latitude.toFixed(6)}, Lng: ${coordenadasEfectivas.longitude.toFixed(6)}`
                  : "Buscando señal satelital..."}
              </Text>
              <Text style={styles.gpsSub}>
                {coordenadasEfectivas
                  ? gpsManualActivado
                    ? "Coordenada de referencia local (modo interiores/sótano)"
                    : `Precisión satelital: ±${Math.round(coordenadasEfectivas.accuracy || 10)}m`
                  : "Acérquese a la puerta del negocio para fijar el punto"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshGpsBtn}
              onPress={handleRefrescarGps}
              disabled={refreshingGps}
              accessibilityLabel="Refrescar señal GPS"
            >
              <RotateCw size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {(!coordenadasEfectivas || mostrarFallbackGps) && !gpsManualActivado && (
            <View style={styles.fallbackContainer}>
              <View style={styles.fallbackHeader}>
                <AlertCircle size={16} color={Colors.warning} />
                <Text style={styles.fallbackTitle}>Baja señal de satélite en interiores</Text>
              </View>
              <Text style={styles.fallbackText}>
                Si está dentro de una galería, sótano o mercado cubierto sin visibilidad al cielo, puede continuar con la coordenada aproximada de la zona.
              </Text>
              <TouchableOpacity
                style={styles.fallbackButton}
                onPress={handleActivarFallbackGps}
                activeOpacity={0.8}
              >
                <Text style={styles.fallbackButtonText}>Continuar sin señal GPS precisa</Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* Datos Comerciales */}
        <Card title="Datos Comerciales" icon={Store} style={styles.cardSection}>
          <Input
            label="Razón Social *"
            placeholder="Ej: Comercial Los Andes S.R.L. o Flores Rosa"
            value={razonSocial}
            onChangeText={setRazonSocial}
          />

          <Input
            label="Nombre Comercial del Negocio"
            placeholder="Ej: Abarrotes La Esquina"
            value={nombreComercial}
            onChangeText={setNombreComercial}
          />

          <Input
            label="Nombre del Propietario / Encargado"
            placeholder="Ej: Doña Rosa Flores"
            value={nombrePropietario}
            onChangeText={setNombrePropietario}
          />

          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="NIT o CI"
                placeholder="Ej: 4930120"
                value={nitCi}
                onChangeText={setNitCi}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Teléfono / Celular"
                placeholder="Ej: 71234567"
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
                icon={Phone}
              />
            </View>
          </View>

          {/* Tipo de Establecimiento */}
          <Text style={styles.selectorLabel}>Tipo de Establecimiento</Text>
          <View style={styles.tipoGrid}>
            {TIPOS_NEGOCIO.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.tipoChip,
                  tipoNegocio === t && styles.tipoChipActive,
                ]}
                onPress={() => setTipoNegocio(t)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tipoChipText,
                    tipoNegocio === t && styles.tipoChipTextActive,
                  ]}
                >
                  {t.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Ubicación y Referencias */}
        <Card title="Ubicación y Referencia" icon={Navigation} style={styles.cardSection}>
          <Input
            label="Dirección / Calle *"
            placeholder="Ej: Calle Junín #340 casi esq. Estudiantes"
            value={direccion}
            onChangeText={setDireccion}
          />

          <Input
            label="Zona / Barrio (Sucre)"
            placeholder="Ej: Mercado Campesino / San Roque"
            value={zona}
            onChangeText={setZona}
          />

          <Input
            label="Observaciones adicionales"
            placeholder="Ej: Frente al kiosco azul, atiende por las tardes"
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* Botón de Acción Principal */}
        <View style={styles.submitContainer}>
          <Button
            title={
              modalidad === "ENTREGA_INMEDIATA"
                ? "Continuar con Entrega y Cobro"
                : modalidad === "PROGRAMAR_ENTREGA"
                ? "Guardar y Programar Visita"
                : "Guardar Cliente en Padrón"
            }
            icon={
              modalidad === "ENTREGA_INMEDIATA"
                ? ArrowRight
                : modalidad === "PROGRAMAR_ENTREGA"
                ? Calendar
                : UserPlus
            }
            variant={modalidad === "ENTREGA_INMEDIATA" ? "success" : "primary"}
            size="large"
            loading={loading}
            onPress={handleGuardarOContinuar}
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
    padding: 16,
    paddingBottom: 40,
  },
  cardSection: {
    marginBottom: 16,
  },
  modalidadSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  modalidadesContainer: {
    gap: 8,
  },
  modalidadCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 10,
    minHeight: 64,
  },
  modalidadCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  modalidadCardActiveVerde: {
    borderColor: Colors.success,
    backgroundColor: "#ECFDF5",
  },
  modalidadCardActiveAmbar: {
    borderColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  modalidadIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  modalidadHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  modalidadTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  modalidadTituloActive: {
    color: Colors.primary,
  },
  modalidadDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  badgeStockCamion: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeStockCamionText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  badgeSinStock: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSinStockText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B91C1C",
  },
  posicionInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 10,
  },
  posicionBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  posicionBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  posicionTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  posicionDesc: {
    fontSize: 11,
    color: "#15803D",
    marginTop: 2,
  },
  frecuenciasContainer: {
    gap: 6,
    marginBottom: 10,
  },
  freqChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 48,
    justifyContent: "center",
  },
  freqChipActive: {
    borderColor: "#D97706",
    backgroundColor: "#FEF3C7",
  },
  freqChipLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  freqChipLabelActive: {
    color: "#B45309",
  },
  freqChipDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  freqChipDescActive: {
    color: "#92400E",
  },
  subSeccionProgramacion: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  diasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  diaChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 48,
    minWidth: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  diaChipActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#D97706",
  },
  diaChipContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  diaChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  diaChipTextActive: {
    color: "#B45309",
    fontWeight: "800",
  },
  ayudaTexto: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  fechaRapidaRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  btnFechaRapida: {
    flex: 1,
    minHeight: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  btnFechaRapidaActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#D97706",
  },
  btnFechaRapidaText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  btnFechaRapidaTextActive: {
    color: "#B45309",
    fontWeight: "800",
  },
  inputFecha: {
    minHeight: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  productoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  productoInfoCol: {
    flex: 1,
    paddingRight: 6,
  },
  productoNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  productoMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  productoPrecio: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  badgeStockItem: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeStockItemText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803D",
  },
  badgeSinStockItem: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeSinStockItemText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  contadorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  btnContador: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnContadorDisabled: {
    opacity: 0.4,
  },
  inputContadorDirecto: {
    width: 54,
    height: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
  resumenPedidoBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resumenCol: {
    flex: 1,
  },
  resumenLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  resumenValorBultos: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  resumenValorBs: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.success,
    marginTop: 2,
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gpsInfo: {
    flex: 1,
  },
  gpsCoords: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    fontVariant: ["tabular-nums"],
  },
  gpsSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshGpsBtn: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: Colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  fallbackContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
  fallbackText: {
    fontSize: 11,
    color: "#92400E",
    lineHeight: 16,
    marginBottom: 8,
  },
  fallbackButton: {
    minHeight: 48,
    backgroundColor: "#F59E0B",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  fallbackButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  formRow: {
    flexDirection: "row",
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  tipoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tipoChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 48,
    justifyContent: "center",
  },
  tipoChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  tipoChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tipoChipTextActive: {
    color: Colors.primary,
    fontWeight: "800",
  },
  submitContainer: {
    marginTop: 8,
  },
});

export default NuevoClienteScreen;
