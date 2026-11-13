import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useRuta } from "../../context/RutaContext";
import { useLocation } from "../../context/LocationContext";
import { Header } from "../../components/common/Header";
import { Card } from "../../components/common/Card";
import { Input } from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import { NumericInput } from "../../components/common/NumericInput";
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
} from "lucide-react-native";

const TIPOS_NEGOCIO = [
  "TIENDA_BARRIO",
  "DISTRIBUIDORA_MAYORISTA",
  "SUPERMERCADO",
  "FARMACIA",
  "INSTITUCION_EDUCATIVA",
  "OTRO",
];

const DIAS_SEMANA = [
  { id: "LUNES", label: "Lunes" },
  { id: "MARTES", label: "Martes" },
  { id: "MIERCOLES", label: "Miércoles" },
  { id: "JUEVES", label: "Jueves" },
  { id: "VIERNES", label: "Viernes" },
  { id: "SABADO", label: "Sábado" },
];

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

  // 1. Datos básicos del cliente
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [nombrePropietario, setNombrePropietario] = useState("");
  const [nitCi, setNitCi] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("Sucre");
  const [tipoNegocio, setTipoNegocio] = useState("TIENDA_BARRIO");
  const [observaciones, setObservaciones] = useState("");

  // 2. Tres modalidades según requerimiento
  // 'SOLO_REGISTRO' | 'PROGRAMAR_ENTREGA' | 'ENTREGA_INMEDIATA'
  const [modalidad, setModalidad] = useState("ENTREGA_INMEDIATA");

  // 3. Campos específicos para PROGRAMAR_ENTREGA
  const [diaSemana, setDiaSemana] = useState("LUNES");
  const [catalogoProductos, setCatalogoProductos] = useState(CATALOGO_DEFAULT);
  const [cantidadesProgramadas, setCantidadesProgramadas] = useState({});

  // 4. Parada actual / última atendida para ENTREGA_INMEDIATA
  const [paradaActualOrden, setParadaActualOrden] = useState(0);

  // Estados de interfaz y GPS
  const [loading, setLoading] = useState(false);
  const [refreshingGps, setRefreshingGps] = useState(false);
  const [gpsManualActivado, setGpsManualActivado] = useState(false);
  const [mostrarFallbackGps, setMostrarFallbackGps] = useState(false);

  const fallbackTimerRef = useRef(null);

  // Cargar catálogo de productos y calcular última parada atendida
  useEffect(() => {
    let activo = true;

    async function cargarDatosIniciales() {
      // 1. Catálogo de productos
      try {
        const productosDb = await LocalDB.obtenerProductos();
        if (activo && Array.isArray(productosDb) && productosDb.length > 0) {
          setCatalogoProductos(productosDb);
        } else {
          const invCamion = await LocalDB.obtenerInventarioCamion();
          if (activo && invCamion?.items?.length > 0) {
            setCatalogoProductos(
              invCamion.items.map((i) => ({
                id: i.presentacion_id || i.id,
                presentacion_id: i.presentacion_id || i.id,
                nombre: i.nombre_producto || i.nombre || `Producto #${i.presentacion_id}`,
                precio: Number(i.precio_unitario || i.precio || 25),
              }))
            );
          }
        }
      } catch (_e) {}

      // 2. Determinar última parada atendida de la hoja de ruta
      try {
        const ruta = (await LocalDB.obtenerRutaActiva()) || asignacionActiva;
        if (ruta && Array.isArray(ruta.paradas)) {
          let maxOrdenAtendida = 0;
          ruta.paradas.forEach((p) => {
            const estado = String(p.estado || p.Estado || "").toUpperCase();
            const atendida = estado === "ENTREGADO" || estado === "NO_ENTREGADO" || Boolean(p.cobro);
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

  // Manejo de cantidades en productos para PROGRAMAR_ENTREGA
  const handleModificarCantidadProgramada = (presentacionId, delta) => {
    setCantidadesProgramadas((prev) => {
      const actual = prev[presentacionId] || 0;
      const nueva = Math.max(0, actual + delta);
      if (nueva === 0) {
        const copia = { ...prev };
        delete copia[presentacionId];
        return copia;
      }
      return { ...prev, [presentacionId]: nueva };
    });
  };

  const totalBultosProgramados = useMemo(() => {
    return Object.values(cantidadesProgramadas).reduce((sum, c) => sum + Number(c || 0), 0);
  }, [cantidadesProgramadas]);

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

    // -------------------------------------------------------------
    // MODALIDAD 1: SOLO REGISTRAR CLIENTE
    // -------------------------------------------------------------
    if (modalidad === "SOLO_REGISTRO") {
      setLoading(true);
      const payloadSoloRegistro = {
        datos_cliente: datosClienteBase,
        modalidad: "SOLO_REGISTRO",
        dia_semana_programado: null,
        items_programados: null,
        parada_actual_orden: null,
        entrega_con_cobro: null,
      };

      try {
        const idempotencyKey = SyncQueue.generarUuidV4();
        const res = await ClientesApi.registrarClienteEnRuta(payloadSoloRegistro, idempotencyKey);

        if (!res.success) {
          // Si falla conexión, encolar en cola offline de cliente
          await SyncQueue.encolarOperacion(
            "CLIENTE_EN_RUTA",
            payloadSoloRegistro,
            { latitud: lat, longitud: lng },
            idempotencyKey
          );
        }

        // Guardar cliente en LocalDB para que esté disponible en búsquedas
        await LocalDB.agregarClienteLocal({
          IdPuntoVenta: `cli_${Date.now()}`,
          NombreCliente: datosClienteBase.razon_social,
          NombrePuntoVenta: datosClienteBase.nombre_comercial,
          Telefono: datosClienteBase.telefono,
          Direccion: datosClienteBase.direccion,
          Latitud: lat,
          Longitud: lng,
          EsNuevoEnCampo: true,
          fechaRegistro: new Date().toISOString(),
        });

        setLoading(false);
        Alert.alert(
          "Cliente Registrado",
          "El cliente ha sido incorporado al padrón de la empresa sin generar pedido ni entrega.",
          [{ text: "Aceptar", onPress: () => navigation.goBack() }]
        );
      } catch (err) {
        setLoading(false);
        Alert.alert("Error", err.message || "Fallo inesperado al registrar cliente.");
      }
      return;
    }

    // -------------------------------------------------------------
    // MODALIDAD 2: REGISTRAR + PROGRAMAR ENTREGA FUTURA
    // -------------------------------------------------------------
    if (modalidad === "PROGRAMAR_ENTREGA") {
      if (totalBultosProgramados <= 0) {
        Alert.alert(
          "Seleccione Productos",
          "Debe agregar al menos un bulto de producto para programar la entrega futura."
        );
        return;
      }

      setLoading(true);
      const itemsProgramados = Object.entries(cantidadesProgramadas).map(([presId, cant]) => {
        const prod = catalogoProductos.find(
          (p) => String(p.presentacion_id || p.id) === String(presId)
        );
        return {
          presentacion_id: parseInt(presId, 10),
          producto_nombre: prod?.nombre || `Producto #${presId}`,
          cantidad: Number(cant),
          precio_estimado: prod?.precio || 0,
        };
      });

      const payloadProgramado = {
        datos_cliente: datosClienteBase,
        modalidad: "PROGRAMAR_ENTREGA",
        dia_semana_programado: diaSemana,
        items_programados: itemsProgramados,
        parada_actual_orden: null,
        entrega_con_cobro: null,
      };

      try {
        const idempotencyKey = SyncQueue.generarUuidV4();
        const res = await ClientesApi.registrarClienteEnRuta(payloadProgramado, idempotencyKey);

        if (!res.success) {
          await SyncQueue.encolarOperacion(
            "CLIENTE_EN_RUTA",
            payloadProgramado,
            { latitud: lat, longitud: lng },
            idempotencyKey
          );
        }

        await LocalDB.agregarClienteLocal({
          IdPuntoVenta: `cli_${Date.now()}`,
          NombreCliente: datosClienteBase.razon_social,
          NombrePuntoVenta: datosClienteBase.nombre_comercial,
          Direccion: datosClienteBase.direccion,
          EsNuevoEnCampo: true,
          pedidoProgramado: {
            dia: diaSemana,
            items: itemsProgramados,
          },
          fechaRegistro: new Date().toISOString(),
        });

        setLoading(false);
        Alert.alert(
          "Entrega Programada",
          `Cliente guardado y entrega programada para el día ${diaSemana}. El cálculo nocturno lo asignará a la ruta correspondiente.`,
          [{ text: "Aceptar", onPress: () => navigation.goBack() }]
        );
      } catch (err) {
        setLoading(false);
        Alert.alert("Error", err.message || "Fallo inesperado al programar entrega.");
      }
      return;
    }

    // -------------------------------------------------------------
    // MODALIDAD 3: REGISTRAR + ENTREGA INMEDIATA AHORA MISMO
    // -------------------------------------------------------------
    if (modalidad === "ENTREGA_INMEDIATA") {
      setLoading(true);

      const nuevoOrdenCalculado = Number(paradaActualOrden || 0) + 1;
      const tempId = `temp_cli_${Date.now()}`;

      // Crear objeto parada para la hoja de ruta
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
          telefono: datosClienteBase.telefono,
          direccion: datosClienteBase.direccion,
          latitud: lat,
          longitud: lng,
          saldo_pendiente: 0,
        },
        pedido: {
          id: `ped_${tempId}`,
          monto_total: 0,
          items: [],
        },
      };

      try {
        // Insertar en la secuencia local desplazando las siguientes paradas pendientes
        await insertarNuevoClienteEnSecuencia(nuevaParadaEnRuta, paradaActualOrden);
        setLoading(false);

        // Disparar o abrir el flujo de Entrega con Cobro para este cliente de inmediato
        navigation.navigate("RegistrarEntrega", {
          parada: nuevaParadaEnRuta,
          pedido: nuevaParadaEnRuta.pedido,
          esNuevoClienteEnRuta: true,
          nuevoClientePayload: {
            datos_cliente: datosClienteBase,
            modalidad: "ENTREGA_INMEDIATA",
            dia_semana_programado: null,
            items_programados: null,
            parada_actual_orden: paradaActualOrden,
          },
        });
      } catch (err) {
        setLoading(false);
        Alert.alert("Error", err.message || "No se pudo insertar el cliente en la ruta.");
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
        {/* Selector de Modalidades de Atención */}
        <Card title="Modalidad de Atención" icon={Store} style={styles.cardSection}>
          <Text style={styles.modalidadSub}>
            Seleccione cómo se atenderá a este cliente durante la jornada:
          </Text>

          <View style={styles.modalidadesContainer}>
            {/* Opción 1: Solo Registro */}
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
                  1. Solo Registrar Cliente
                </Text>
                <Text style={styles.modalidadDesc}>
                  Padrón comercial en sistema sin generar pedido ni entrega hoy.
                </Text>
              </View>
              {modalidad === "SOLO_REGISTRO" && <Check size={18} color={Colors.primary} />}
            </TouchableOpacity>

            {/* Opción 2: Programar Entrega Futura */}
            <TouchableOpacity
              style={[
                styles.modalidadCard,
                modalidad === "PROGRAMAR_ENTREGA" && styles.modalidadCardActive,
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
                  2. Programar Entrega Futura
                </Text>
                <Text style={styles.modalidadDesc}>
                  Selecciona día y pedido para que el cálculo nocturno lo asigne.
                </Text>
              </View>
              {modalidad === "PROGRAMAR_ENTREGA" && <Check size={18} color="#D97706" />}
            </TouchableOpacity>

            {/* Opción 3: Entrega Inmediata Ahora Mismo */}
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
                <Text
                  style={[
                    styles.modalidadTitulo,
                    modalidad === "ENTREGA_INMEDIATA" && { color: Colors.success },
                  ]}
                >
                  3. Entrega Inmediata al Paso
                </Text>
                <Text style={styles.modalidadDesc}>
                  Compra en el acto: se inserta en ruta y se descarga stock del camión.
                </Text>
              </View>
              {modalidad === "ENTREGA_INMEDIATA" && <Check size={18} color={Colors.success} />}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Panel informativo para Opción 3 (Entrega Inmediata) */}
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
                    ? `Última parada atendida: #${paradaActualOrden}. Las paradas pendientes posteriores se desplazarán en +1.`
                    : "No hay paradas atendidas aún. El cliente se ubicará como primera parada de entrega."}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Panel específico para Opción 2 (Programar Entrega Futura) */}
        {modalidad === "PROGRAMAR_ENTREGA" && (
          <Card title="Programación de Entrega Futura" icon={Calendar} style={styles.cardSection}>
            <Text style={styles.selectorLabel}>Día de Entrega Solicitado *</Text>
            <View style={styles.diasGrid}>
              {DIAS_SEMANA.map((dia) => (
                <TouchableOpacity
                  key={dia.id}
                  style={[
                    styles.diaChip,
                    diaSemana === dia.id && styles.diaChipActive,
                  ]}
                  onPress={() => setDiaSemana(dia.id)}
                >
                  <Text
                    style={[
                      styles.diaChipText,
                      diaSemana === dia.id && styles.diaChipTextActive,
                    ]}
                  >
                    {dia.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.selectorLabel, { marginTop: 14 }]}>
              Productos Solicitados ({totalBultosProgramados} bultos totales)
            </Text>

            {catalogoProductos.map((item) => {
              const presId = item.presentacion_id || item.id;
              const cantidad = cantidadesProgramadas[presId] || 0;
              return (
                <View key={presId} style={styles.productoRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.productoNombre}>{item.nombre}</Text>
                    <Text style={styles.productoPrecio}>
                      Ref: Bs. {Number(item.precio || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.contadorRow}>
                    <TouchableOpacity
                      style={styles.btnContador}
                      onPress={() => handleModificarCantidadProgramada(presId, -1)}
                      disabled={cantidad <= 0}
                    >
                      <Minus size={14} color={cantidad > 0 ? Colors.text : Colors.textMuted} />
                    </TouchableOpacity>
                    <Text style={styles.contadorNum}>{cantidad}</Text>
                    <TouchableOpacity
                      style={styles.btnContador}
                      onPress={() => handleModificarCantidadProgramada(presId, 1)}
                    >
                      <Plus size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Captura de Coordenadas GPS */}
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

          {/* Tipo de Negocio */}
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

        {/* Botón de Guardado o Continuar */}
        <View style={styles.submitContainer}>
          <Button
            title={
              modalidad === "ENTREGA_INMEDIATA"
                ? "Continuar con Entrega y Cobro"
                : modalidad === "PROGRAMAR_ENTREGA"
                ? "Guardar y Programar Entrega"
                : "Guardar Cliente en Padrón"
            }
            icon={modalidad === "ENTREGA_INMEDIATA" ? ArrowRight : UserPlus}
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
  modalidadIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
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
  diasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  diaChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 40,
    justifyContent: "center",
  },
  diaChipActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#D97706",
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
  productoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  productoNombre: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  productoPrecio: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contadorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnContador: {
    width: 34,
    height: 34,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  contadorNum: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    minWidth: 24,
    textAlign: "center",
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
    borderRadius: 4,
    backgroundColor: Colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fallbackContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 4,
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
    borderRadius: 4,
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
    borderRadius: 4,
    borderWidth: 1,
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
