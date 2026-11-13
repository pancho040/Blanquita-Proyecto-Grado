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
} from "react-native";
import { Colors } from "../../constants/Colors";
import { Header } from "../../components/common/Header";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { ClientesApi } from "../../api/clientesApi";
import { SyncQueue } from "../../database/syncQueue";
import { LocalDB } from "../../database/localDb";
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
} from "lucide-react-native";

export const HistorialRutaScreen = ({ navigation }) => {
  const { isOnline } = useNetwork();
  const [cargando, setCargando] = useState(false);
  const [operaciones, setOperaciones] = useState([]);
  const [filtroSeleccionado, setFiltroSeleccionado] = useState("TODOS"); // 'TODOS' | 'APROBADO' | 'PENDIENTE' | 'OBSERVADO'

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

      // 2. Operaciones consultadas desde el Servidor Central (GET /resumen-sincronizacion)
      if (isOnline) {
        try {
          const res = await ClientesApi.obtenerHistorialOperacionesHoy();
          if (res.success && Array.isArray(res.historial)) {
            res.historial.forEach((opServidor) => {
              const idServidor = String(opServidor.id_operacion || opServidor.id || Math.random());
              if (!clavesVistas.has(idServidor)) {
                clavesVistas.add(idServidor);
                listaUnificada.push({
                  id: `server_${idServidor}`,
                  id_operacion: opServidor.id_operacion || opServidor.id,
                  tipo: String(opServidor.tipo || "ENTREGA").toUpperCase(),
                  cliente: opServidor.cliente || opServidor.nombre_cliente || "Cliente",
                  monto: Number(opServidor.monto || opServidor.monto_total || 0),
                  estado_revision_web: String(
                    opServidor.estado_revision_web || opServidor.estado_revision || "PENDIENTE"
                  ).toUpperCase(),
                  observacion_revision: opServidor.observacion_revision || opServidor.observacion || null,
                  fecha: opServidor.fecha || opServidor.fecha_creacion || new Date().toISOString(),
                  esOffline: false,
                  metodoPago: opServidor.metodo_pago || "EFECTIVO",
                  numeroNota: opServidor.numero_nota || opServidor.numero_recibo || null,
                });
              }
            });
          }
        } catch (_errServidor) {
          console.log("[HistorialRutaScreen] Fallo consultando historial en backend:", _errServidor.message);
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
    cargarHistorial();
  }, [cargarHistorial]);

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

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Historial de Ruta"
        subtitle="Entregas y cobros con estado de revisión web"
        showBackButton
      />

      {/* Panel de Resumen Superior */}
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

      {/* Lista de Operaciones */}
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
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  metricaTotalMonto: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primaryDark,
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
    color: Colors.textSecondary,
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
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
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
    color: Colors.text,
  },
  horaTexto: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  badgeBase: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    gap: 4,
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
    color: Colors.text,
  },
  metodoTexto: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  montoNumero: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
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
});

export default HistorialRutaScreen;
