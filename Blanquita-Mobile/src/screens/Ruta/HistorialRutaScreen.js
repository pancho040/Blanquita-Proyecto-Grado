import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { Header } from "../../components/common/Header";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { ClientesApi } from "../../api/clientesApi";
import { SyncQueue } from "../../database/syncQueue";
import { LocalDB } from "../../database/localDb";
import { syncService } from "../../services/syncService";
import { useNetwork } from "../../context/NetworkContext";
import {
  PackageCheck,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  WifiOff,
  Building,
  CreditCard,
  FileText,
  XCircle,
  Calendar,
  ChevronRight,
  X,
  MapPin,
} from "lucide-react-native";

export const HistorialRutaScreen = ({ navigation }) => {
  const { isOnline } = useNetwork();
  const [cargando, setCargando] = useState(false);
  const [operaciones, setOperaciones] = useState([]);
  const [filtroSeleccionado, setFiltroSeleccionado] = useState("TODOS"); // 'TODOS' | 'APROBADO' | 'PENDIENTE' | 'OBSERVADO'
  const [seccionActiva, setSeccionActiva] = useState("HOY"); // 'HOY' | 'JORNADAS'
  const [jornadas, setJornadas] = useState([]);
  const [cargandoJornadas, setCargandoJornadas] = useState(false);
  const [jornadaSeleccionada, setJornadaSeleccionada] = useState(null);
  const [detalleJornada, setDetalleJornada] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);

  const cargarJornadas = useCallback(async () => {
    setCargandoJornadas(true);
    try {
      const res = await ClientesApi.obtenerHistorialJornadas();
      if (res.success && Array.isArray(res.jornadas)) {
        setJornadas(res.jornadas);
      }
    } catch (_err) {
      console.log("[HistorialRutaScreen] Error cargando jornadas:", _err.message);
    } finally {
      setCargandoJornadas(false);
    }
  }, []);

  const verDetalleJornada = async (jornada) => {
    setJornadaSeleccionada(jornada);
    setModalDetalleVisible(true);
    setCargandoDetalle(true);
    try {
      const res = await ClientesApi.obtenerDetalleJornadaHistorial(jornada.fecha);
      if (res.success && res.detalle) {
        setDetalleJornada(res.detalle);
      } else {
        setDetalleJornada(null);
      }
    } catch (_e) {
      setDetalleJornada(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  /**
   * Cargar y unificar operaciones de hoy:
   * 1. Cola local offline (PENDIENTE DE ENVIAR)
   * 2. Backend GET /api/movil/v1/chofer/resumen-sincronizacion (historial_operaciones_hoy)
   * 3. Paradas entregadas en hoja de ruta local
   * NOTA: Los registros de nuevos clientes sin venta NO aparecen en este historial.
   */
  const cargarHistorial = useCallback(async () => {
    setCargando(true);
    try {
      const listaUnificada = [];
      const clavesVistas = new Set();

      // 1. Operaciones en cola offline (aún en el celular)
      const colaOffline = await SyncQueue.obtenerCola();
      colaOffline.forEach((item) => {
        // Excluir altas de cliente sin venta/entrega
        if (item.tipo === "ALTA_CLIENTE" || item.tipo === "NUEVO_CLIENTE") {
          return;
        }
        if (item.tipo === "CLIENTE_EN_RUTA") {
          // Solo incluir si tiene venta inmediata
          if (item.payload?.modalidad !== "ENTREGA_INMEDIATA" || !item.payload?.entrega_con_cobro) {
            return;
          }
        }
        if (item.tipo === "PING_GPS" || item.tipo === "CIERRE_RUTA") {
          return;
        }

        const monto = Number(
          item.payload?.cobro?.monto_total ||
          item.payload?.entrega_con_cobro?.cobro?.monto_total ||
          item.payload?.monto_total ||
          item.payload?.monto ||
          0
        );

        const clienteNombre =
          item.payload?.datos_cliente?.razon_social ||
          item.payload?.recibido_por ||
          item.payload?.cliente ||
          item.payload?.nombreCliente ||
          "Cliente en Ruta";

        const tipoOp =
          item.tipo === "COBRO" ? "COBRO" : "ENTREGA";

        const metodo =
          item.payload?.cobro?.pagos?.[0]?.metodo ||
          item.payload?.entrega_con_cobro?.cobro?.pagos?.[0]?.metodo ||
          item.payload?.metodoPago ||
          "EFECTIVO";

        const idOp = `offline_${item.id || item.idempotencyKey}`;
        clavesVistas.add(String(item.idempotencyKey || item.id));

        listaUnificada.push({
          id: idOp,
          id_operacion: item.id,
          tipo: tipoOp,
          cliente: clienteNombre,
          monto: isNaN(monto) ? 0 : monto,
          estado_revision_web: "PENDIENTE_ENVIAR",
          observacion_revision: item.esErrorPermanente ? item.ultimoError : null,
          fecha: item.fechaCreacion || item.fecha || new Date().toISOString(),
          esOffline: true,
          metodoPago: metodo,
          numeroNota: item.payload?.numeroNota || item.payload?.numeroRecibo || null,
        });
      });

      // 2. Operaciones consultadas desde el Servidor Central (GET /api/movil/v1/chofer/resumen-sincronizacion)
      if (isOnline) {
        try {
          const res = await ClientesApi.obtenerResumenSincronizacion();
          if (res.success && res.data) {
            // Refrescar inventario del camión y paradas en local
            try {
              await syncService.procesarResumenSincronizacion(res.data);
            } catch (_eSync) {}

            const listaServidor =
              res.data.historial_operaciones_hoy || res.data.historial || [];

            if (Array.isArray(listaServidor)) {
              listaServidor.forEach((opServidor) => {
                const idServidor = String(
                  opServidor.id || opServidor.id_operacion || Math.random()
                );
                if (!clavesVistas.has(idServidor)) {
                  clavesVistas.add(idServidor);

                  const estRaw = String(
                    opServidor.estado_revision_web ||
                      opServidor.estado_revision ||
                      "PENDIENTE"
                  ).toUpperCase();

                  let estadoFinal = "PENDIENTE_REVISION_WEB";
                  if (estRaw === "APROBADO") estadoFinal = "APROBADO";
                  else if (estRaw === "OBSERVADO") estadoFinal = "OBSERVADO";
                  else if (estRaw === "RECHAZADO") estadoFinal = "RECHAZADO";

                  listaUnificada.push({
                    id: `server_${idServidor}`,
                    id_operacion: opServidor.id || opServidor.id_operacion,
                    tipo: String(opServidor.tipo || "ENTREGA").toUpperCase(),
                    cliente:
                      opServidor.cliente ||
                      opServidor.nombre_cliente ||
                      "Cliente en Ruta",
                    monto: Number(opServidor.monto || opServidor.monto_total || 0),
                    estado_revision_web: estadoFinal,
                    observacion_revision:
                      opServidor.observacion_revision ||
                      opServidor.observacion ||
                      null,
                    fecha:
                      opServidor.fecha_hora ||
                      opServidor.fecha ||
                      opServidor.fecha_creacion ||
                      new Date().toISOString(),
                    esOffline: false,
                    metodoPago: opServidor.metodo_pago || "EFECTIVO",
                    numeroNota:
                      opServidor.referencia ||
                      opServidor.numero_nota ||
                      opServidor.numero_recibo ||
                      (opServidor.id ? `#${opServidor.id}` : null),
                  });
                }
              });
            }
          }
        } catch (_errServidor) {
          console.log(
            "[HistorialRutaScreen] Fallo consultando historial en backend:",
            _errServidor.message
          );
        }
      }

      // 3. Paradas entregadas en hoja de ruta local (fallback si no están en servidor ni en cola)
      try {
        const ruta = await LocalDB.obtenerRutaActiva();
        if (ruta && Array.isArray(ruta.paradas)) {
          ruta.paradas.forEach((p) => {
            const estado = String(p.estado || p.Estado || "").toUpperCase();
            if (estado === "ENTREGADO" || Boolean(p.cobro)) {
              const idParada = String(p.id || p.IdPuntoVenta || "");
              if (idParada && !clavesVistas.has(idParada)) {
                clavesVistas.add(idParada);
                const monto = Number(
                  p.datosOperacion?.monto_total ||
                  p.datosOperacion?.cobro?.monto_total ||
                  p.cobro?.monto ||
                  p.pedido?.monto_total ||
                  0
                );
                listaUnificada.push({
                  id: `local_${idParada}`,
                  id_operacion: idParada,
                  tipo: p.cobro ? "COBRO" : "ENTREGA",
                  cliente: p.cliente?.razon_social || p.NombreCliente || "Cliente Ruta",
                  monto: isNaN(monto) ? 0 : monto,
                  estado_revision_web: "PENDIENTE_REVISION_WEB",
                  observacion_revision: null,
                  fecha: p.datosOperacion?.fechaHora || p.fechaAtencion || new Date().toISOString(),
                  esOffline: false,
                  metodoPago: p.cobro?.metodoPago || "EFECTIVO",
                  numeroNota: p.datosOperacion?.numeroNota || p.cobro?.numeroRecibo || null,
                });
              }
            }
          });
        }
      } catch (_errLocal) {}

      // Ordenar por fecha descendente (más recientes primero)
      listaUnificada.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setOperaciones(listaUnificada);
    } finally {
      setCargando(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (seccionActiva === "HOY") {
      cargarHistorial();
    } else {
      cargarJornadas();
    }
  }, [seccionActiva, cargarHistorial, cargarJornadas]);

  // Totales y estadísticas del día
  const metricas = useMemo(() => {
    let recaudado = 0;
    let aprobadas = 0;
    let pendientesWeb = 0;
    let pendientesEnviar = 0;
    let observadas = 0;

    operaciones.forEach((op) => {
      recaudado += Number(op.monto || 0);
      const est = op.estado_revision_web;
      if (est === "APROBADO") aprobadas++;
      else if (est === "OBSERVADO" || est === "RECHAZADO") observadas++;
      else if (est === "PENDIENTE_ENVIAR") pendientesEnviar++;
      else pendientesWeb++;
    });

    return {
      totalOperaciones: operaciones.length,
      totalRecaudado: recaudado,
      aprobadas,
      pendientesWeb,
      pendientesEnviar,
      observadas,
    };
  }, [operaciones]);

  // Filtrado de operaciones
  const operacionesFiltradas = useMemo(() => {
    if (filtroSeleccionado === "TODOS") return operaciones;
    if (filtroSeleccionado === "APROBADO") {
      return operaciones.filter((o) => o.estado_revision_web === "APROBADO");
    }
    if (filtroSeleccionado === "PENDIENTE") {
      return operaciones.filter(
        (o) =>
          o.estado_revision_web === "PENDIENTE" ||
          o.estado_revision_web === "PENDIENTE_REVISION_WEB" ||
          o.estado_revision_web === "PENDIENTE_ENVIAR"
      );
    }
    if (filtroSeleccionado === "OBSERVADO") {
      return operaciones.filter(
        (o) => o.estado_revision_web === "OBSERVADO" || o.estado_revision_web === "RECHAZADO"
      );
    }
    return operaciones;
  }, [operaciones, filtroSeleccionado]);

  const renderBadgeEstado = (estado) => {
    switch (estado) {
      case "PENDIENTE_ENVIAR":
        return (
          <View style={[styles.badgeBase, styles.badgePendienteEnviar]}>
            <WifiOff size={11} color="#B45309" />
            <Text style={[styles.badgeText, { color: "#B45309" }]}>PENDIENTE DE ENVIAR</Text>
          </View>
        );

      case "PENDIENTE":
      case "PENDIENTE_REVISION_WEB":
        return (
          <View style={[styles.badgeBase, styles.badgePendienteRevision]}>
            <Clock size={11} color="#0369A1" />
            <Text style={[styles.badgeText, { color: "#0369A1" }]}>PENDIENTE REVISIÓN WEB</Text>
          </View>
        );

      case "APROBADO":
        return (
          <View style={[styles.badgeBase, styles.badgeAprobado]}>
            <CheckCircle2 size={11} color="#15803D" />
            <Text style={[styles.badgeText, { color: "#15803D" }]}>APROBADO</Text>
          </View>
        );

      case "OBSERVADO":
        return (
          <View style={[styles.badgeBase, styles.badgeObservado]}>
            <AlertTriangle size={11} color="#B45309" />
            <Text style={[styles.badgeText, { color: "#B45309" }]}>OBSERVADO</Text>
          </View>
        );

      case "RECHAZADO":
        return (
          <View style={[styles.badgeBase, styles.badgeRechazado]}>
            <XCircle size={11} color="#B91C1C" />
            <Text style={[styles.badgeText, { color: "#B91C1C" }]}>RECHAZADO</Text>
          </View>
        );

      default:
        return (
          <View style={[styles.badgeBase, styles.badgePendienteRevision]}>
            <Clock size={11} color="#0369A1" />
            <Text style={[styles.badgeText, { color: "#0369A1" }]}>EN REVISIÓN</Text>
          </View>
        );
    }
  };

  const renderItem = ({ item }) => {
    const esObservadoORechazado =
      item.estado_revision_web === "OBSERVADO" || item.estado_revision_web === "RECHAZADO";

    const horaFormateada = item.fecha
      ? new Date(item.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    return (
      <View style={[styles.cardItem, esObservadoORechazado && styles.cardItemObservado]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.tipoIconRow}>
            <View
              style={[
                styles.iconWrap,
                item.tipo === "COBRO" ? styles.iconCobro : styles.iconEntrega,
              ]}
            >
              {item.tipo === "COBRO" ? (
                <DollarSign size={16} color={Colors.success} />
              ) : (
                <PackageCheck size={16} color={Colors.primary} />
              )}
            </View>
            <View>
              <Text style={styles.tipoTexto}>
                {item.tipo === "COBRO" ? "Cobro Recibido" : "Entrega de Producto"}
              </Text>
              <Text style={styles.horaTexto}>
                {horaFormateada}
                {item.numeroNota ? ` • ${item.numeroNota}` : ""}
              </Text>
            </View>
          </View>

          {renderBadgeEstado(item.estado_revision_web)}
        </View>

        {/* Cliente y Monto */}
        <View style={styles.clienteMontoRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.clienteNombre} numberOfLines={1}>
              {item.cliente}
            </Text>
            <Text style={styles.metodoTexto}>
              Método: {item.metodoPago || "EFECTIVO"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.montoNumero}>Bs. {Number(item.monto || 0).toFixed(2)}</Text>
          </View>
        </View>

        {/* RECUADRO DE OBSERVACIÓN ESCRITA POR EL ENCARGADO EN WEB */}
        {esObservadoORechazado && (
          <View style={styles.observacionBox}>
            <View style={styles.observacionHeader}>
              <AlertTriangle size={13} color="#B91C1C" />
              <Text style={styles.observacionTitulo}>Observación del Encargado en Web:</Text>
            </View>
            <Text style={styles.observacionTexto}>
              "{item.observacion_revision || "Operación observada por supervisor. Contactar a administración."}"
            </Text>
          </View>
        )}

        {/* Explicación de Pendiente en Cola */}
        {item.estado_revision_web === "PENDIENTE_ENVIAR" && (
          <Text style={styles.colaAviso}>
            Guardado seguro en memoria local. Se enviará en cuanto haya conexión a internet.
          </Text>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <FileText size={42} color={Colors.textMuted} />
      <Text style={styles.emptyTitulo}>Sin operaciones registradas hoy</Text>
      <Text style={styles.emptySub}>
        Las entregas y cobros confirmados aparecerán aquí con su estado de validación web.
      </Text>
      <TouchableOpacity style={styles.btnActualizarVacio} onPress={cargarHistorial}>
        <RotateCw size={14} color={Colors.primary} />
        <Text style={styles.btnActualizarVacioTexto}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderJornadaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.jornadaCard}
      onPress={() => verDetalleJornada(item)}
      activeOpacity={0.7}
    >
      <View style={styles.jornadaHeader}>
        <View style={styles.jornadaIconBox}>
          <Calendar size={18} color="#0284C7" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.jornadaFecha}>{item.fecha}</Text>
          <Text style={styles.jornadaRuta} numberOfLines={1}>
            {item.nombre_ruta || item.ruta || "Ruta del Día"}
          </Text>
        </View>
        <ChevronRight size={18} color="#94A3B8" />
      </View>

      <View style={styles.jornadaDetallesRow}>
        <View style={styles.jornadaStatCol}>
          <Text style={styles.jornadaStatLabel}>Paradas Atendidas</Text>
          <Text style={styles.jornadaStatVal}>
            {item.paradas_atendidas ?? item.entregadas ?? 0}/{item.total_paradas ?? item.paradas ?? 0}
          </Text>
        </View>

        <View style={styles.jornadaStatDivider} />

        <View style={styles.jornadaStatCol}>
          <Text style={styles.jornadaStatLabel}>Total Cobrado</Text>
          <Text style={[styles.jornadaStatVal, { color: "#166534" }]}>
            Bs. {Number(item.total_cobrado || item.cobrado || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyJornadas = () => (
    <View style={styles.emptyContainer}>
      <Calendar size={42} color={Colors.textMuted} />
      <Text style={styles.emptyTitulo}>Sin jornadas anteriores registradas</Text>
      <Text style={styles.emptySub}>
        Los cierres y hojas de ruta de días previos aparecerán aquí organizados por fecha.
      </Text>
      <TouchableOpacity style={styles.btnActualizarVacio} onPress={cargarJornadas}>
        <RotateCw size={14} color={Colors.primary} />
        <Text style={styles.btnActualizarVacioTexto}>Actualizar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Historial de Ruta"
        subtitle={seccionActiva === "HOY" ? "Entregas y cobros con estado de revisión web" : "Jornadas anteriores por fecha (Solo Lectura)"}
        showBackButton
      />

      {/* Selector Superior: Operaciones de Hoy vs Jornadas Anteriores */}
      <View style={styles.tabSelectorContainer}>
        <TouchableOpacity
          style={[styles.tabSelectorBtn, seccionActiva === "HOY" && styles.tabSelectorBtnActivo]}
          onPress={() => setSeccionActiva("HOY")}
          activeOpacity={0.8}
        >
          <Clock size={14} color={seccionActiva === "HOY" ? "#FFFFFF" : "#64748B"} />
          <Text style={[styles.tabSelectorText, seccionActiva === "HOY" && styles.tabSelectorTextActivo]}>
            Operaciones de Hoy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabSelectorBtn, seccionActiva === "JORNADAS" && styles.tabSelectorBtnActivo]}
          onPress={() => setSeccionActiva("JORNADAS")}
          activeOpacity={0.8}
        >
          <Calendar size={14} color={seccionActiva === "JORNADAS" ? "#FFFFFF" : "#64748B"} />
          <Text style={[styles.tabSelectorText, seccionActiva === "JORNADAS" && styles.tabSelectorTextActivo]}>
            Jornadas Anteriores
          </Text>
        </TouchableOpacity>
      </View>

      {seccionActiva === "HOY" ? (
        <>
          {/* Panel de Resumen Superior Hoy */}
          <View style={styles.metricasPanel}>
            <View style={styles.metricaTotalRow}>
              <View>
                <Text style={styles.metricaTotalLabel}>Total Registrado Hoy</Text>
                <Text style={styles.metricaTotalMonto}>
                  Bs. {metricas.totalRecaudado.toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={cargarHistorial}
                disabled={cargando}
                activeOpacity={0.7}
              >
                <RotateCw size={16} color={Colors.primary} />
                <Text style={styles.refreshBtnText}>Actualizar</Text>
              </TouchableOpacity>
            </View>

            {/* Chips de Conteo por Estado */}
            <View style={styles.chipsRow}>
              <View style={[styles.statChip, { backgroundColor: "#DCFCE7" }]}>
                <Text style={[styles.statChipNum, { color: "#15803D" }]}>{metricas.aprobadas}</Text>
                <Text style={[styles.statChipLabel, { color: "#166534" }]}>Aprobadas</Text>
              </View>

              <View style={[styles.statChip, { backgroundColor: "#E0F2FE" }]}>
                <Text style={[styles.statChipNum, { color: "#0369A1" }]}>{metricas.pendientesWeb}</Text>
                <Text style={[styles.statChipLabel, { color: "#075985" }]}>En Revisión</Text>
              </View>

              <View style={[styles.statChip, { backgroundColor: "#FEF3C7" }]}>
                <Text style={[styles.statChipNum, { color: "#B45309" }]}>{metricas.pendientesEnviar}</Text>
                <Text style={[styles.statChipLabel, { color: "#92400E" }]}>En Cola</Text>
              </View>

              <View style={[styles.statChip, { backgroundColor: "#FEE2E2" }]}>
                <Text style={[styles.statChipNum, { color: "#B91C1C" }]}>{metricas.observadas}</Text>
                <Text style={[styles.statChipLabel, { color: "#991B1B" }]}>Observadas</Text>
              </View>
            </View>

            {/* Filtros Rápidos */}
            <View style={styles.filtrosRow}>
              {[
                { id: "TODOS", label: "Todas" },
                { id: "APROBADO", label: "Aprobadas" },
                { id: "PENDIENTE", label: "Pendientes" },
                { id: "OBSERVADO", label: "Observadas" },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.filtroBtn,
                    filtroSeleccionado === f.id && styles.filtroBtnActivo,
                  ]}
                  onPress={() => setFiltroSeleccionado(f.id)}
                >
                  <Text
                    style={[
                      styles.filtroBtnText,
                      filtroSeleccionado === f.id && styles.filtroBtnTextActivo,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Lista de Operaciones Hoy */}
          <FlatList
            data={operacionesFiltradas}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={cargando}
                onRefresh={cargarHistorial}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
          />
        </>
      ) : (
        /* Lista de Jornadas Anteriores */
        <FlatList
          data={jornadas}
          keyExtractor={(item) => String(item.fecha || item.id || Math.random())}
          renderItem={renderJornadaItem}
          ListEmptyComponent={renderEmptyJornadas}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={cargandoJornadas}
              onRefresh={cargarJornadas}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}

      {/* Modal Detalle de Jornada Histórica */}
      <Modal
        visible={modalDetalleVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalDetalleVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitulo}>
                  Jornada: {jornadaSeleccionada?.fecha}
                </Text>
                <Text style={styles.modalSubtitulo} numberOfLines={1}>
                  {detalleJornada?.nombre_ruta || jornadaSeleccionada?.nombre_ruta || "Ruta"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalDetalleVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {cargandoDetalle ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.modalLoadingText}>Cargando detalle de la jornada...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody}>
                {/* Resumen de la Jornada */}
                <View style={styles.modalResumenBox}>
                  <View style={styles.modalResumenItem}>
                    <Text style={styles.modalResumenLabel}>Paradas Totales</Text>
                    <Text style={styles.modalResumenVal}>
                      {detalleJornada?.paradas?.length || jornadaSeleccionada?.total_paradas || 0}
                    </Text>
                  </View>
                  <View style={styles.modalResumenItem}>
                    <Text style={styles.modalResumenLabel}>Total Cobrado</Text>
                    <Text style={[styles.modalResumenVal, { color: "#166534" }]}>
                      Bs. {Number(detalleJornada?.total_cobrado || jornadaSeleccionada?.total_cobrado || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Paradas de la jornada */}
                <Text style={styles.modalSeccionTitulo}>Detalle de Paradas:</Text>
                {(!detalleJornada?.paradas || detalleJornada.paradas.length === 0) ? (
                  <Text style={styles.modalEmptyParadas}>
                    No hay detalle de paradas registrado para esta fecha.
                  </Text>
                ) : (
                  detalleJornada.paradas.map((p, idx) => (
                    <View key={p.id || idx} style={styles.modalParadaItem}>
                      <View style={styles.modalParadaHeader}>
                        <Text style={styles.modalParadaOrden}>#{p.orden || idx + 1}</Text>
                        <Text style={styles.modalParadaCliente} numberOfLines={1}>
                          {p.cliente?.razon_social || p.NombreCliente || p.cliente || "Cliente"}
                        </Text>
                        <View style={[
                          styles.modalParadaEstadoBadge,
                          (p.estado === "ENTREGADO" || p.Estado === "ENTREGADO") ? styles.badgeAprobado : styles.badgePendienteRevision
                        ]}>
                          <Text style={[
                            styles.badgeText,
                            (p.estado === "ENTREGADO" || p.Estado === "ENTREGADO") ? { color: "#15803D" } : { color: "#0369A1" }
                          ]}>
                            {p.estado || p.Estado || "PENDIENTE"}
                          </Text>
                        </View>
                      </View>
                      {p.pedido && (
                        <Text style={styles.modalParadaSub}>
                          Pedido: #{p.pedido.id || p.pedido.IdPedido} • Monto: Bs. {Number(p.pedido.monto_total || 0).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalBtnCerrar}
                onPress={() => setModalDetalleVisible(false)}
              >
                <Text style={styles.modalBtnCerrarText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
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
  metricasPanel: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metricaTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metricaTotalLabel: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "600",
  },
  metricaTotalMonto: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primaryDark || "#0369A1",
    fontVariant: ["tabular-nums"],
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  statChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  statChipNum: {
    fontSize: 14,
    fontWeight: "800",
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },
  filtrosRow: {
    flexDirection: "row",
    gap: 6,
  },
  filtroBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  filtroBtnActivo: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filtroBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  filtroBtnTextActivo: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },
  cardItem: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  cardItemObservado: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFDFD",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tipoIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexShrink: 1,
    paddingRight: 6,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconEntrega: {
    backgroundColor: Colors.primaryMuted,
  },
  iconCobro: {
    backgroundColor: "#DCFCE7",
  },
  tipoTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    flexShrink: 1,
  },
  horaTexto: {
    fontSize: 10,
    color: "#334155",
    marginTop: 1,
    flexShrink: 1,
  },
  badgeBase: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  badgePendienteEnviar: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  badgePendienteRevision: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  badgeAprobado: {
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  badgeObservado: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  badgeRechazado: {
    backgroundColor: "#FEE2E2",
    borderColor: "#F87171",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  clienteMontoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  clienteNombre: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flexShrink: 1,
  },
  metodoTexto: {
    fontSize: 11,
    color: "#334155",
    marginTop: 2,
    flexShrink: 1,
  },
  montoNumero: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    fontVariant: ["tabular-nums"],
  },
  observacionBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  observacionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  observacionTitulo: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B91C1C",
  },
  observacionTexto: {
    fontSize: 11,
    color: "#7F1D1D",
    lineHeight: 15,
    fontStyle: "italic",
  },
  colaAviso: {
    fontSize: 10,
    color: "#92400E",
    marginTop: 6,
    fontStyle: "italic",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitulo: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  btnActualizarVacio: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    gap: 6,
  },
  btnActualizarVacioTexto: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  // Estilos de Selector Superior
  tabSelectorContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    padding: 4,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 8,
    gap: 4,
  },
  tabSelectorBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
  },
  tabSelectorBtnActivo: {
    backgroundColor: "#0284C7",
  },
  tabSelectorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  tabSelectorTextActivo: {
    color: "#FFFFFF",
  },
  // Estilos de Tarjeta de Jornada
  jornadaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 10,
  },
  jornadaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  jornadaIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  jornadaFecha: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  jornadaRuta: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  jornadaDetallesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  jornadaStatCol: {
    flex: 1,
    alignItems: "center",
  },
  jornadaStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#CBD5E1",
  },
  jornadaStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 2,
  },
  jornadaStatVal: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  // Estilos Modal Detalle Jornada
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "85%",
    minHeight: "50%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitulo: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitulo: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalLoading: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 12,
    color: "#64748B",
  },
  modalBody: {
    padding: 16,
  },
  modalResumenBox: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  modalResumenItem: {
    flex: 1,
    alignItems: "center",
  },
  modalResumenLabel: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "600",
  },
  modalResumenVal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  modalSeccionTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalEmptyParadas: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 20,
    fontStyle: "italic",
  },
  modalParadaItem: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  modalParadaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalParadaOrden: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0284C7",
  },
  modalParadaCliente: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalParadaEstadoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  modalParadaSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    paddingLeft: 18,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  modalBtnCerrar: {
    backgroundColor: "#0F172A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalBtnCerrarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default HistorialRutaScreen;
