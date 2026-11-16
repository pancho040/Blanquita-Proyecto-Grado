import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  UserCheck,
  Truck,
  Boxes,
  Route,
  Receipt,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Plus,
  ArrowUp,
  ArrowDown,
  Lock,
  Printer,
  Calendar,
  DollarSign,
  QrCode,
  FileText,
  RotateCcw,
  Sparkles,
  MapPin,
  Store,
  X,
  PackageCheck,
  CreditCard,
  Banknote,
  Building2,
  ListOrdered,
  CheckCheck
} from "lucide-react";
import { ObtenerInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import {
  ObtenerRutaDetalle,
  ResolverSolicitudCarga,
  RevisarOperacionRuta,
  FinalizarRutaAdmin,
  ObtenerAsignaciones,
  ListarSolicitudesCarga,
  ObtenerOperacionesAsignacion,
  AprobarTodasOperacionesAsignacion,
  AprobarPedidoCompletoAsignacion
} from "@/services/Logistica/RutaService";
import { useLogisticaEventos } from "@/services/Logistica/LogisticaSSEClient";

export default function ExpedienteChoferModal({
  abierto,
  onOpenChange,
  chofer = null,
  asignacion = null,
  fecha = null,
  usuario = null,
  alActualizar = null,
  onAbrirEditorParadas = null,
  tabInicial = "carga",
  focoId = null,
}) {
  const hoyStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const fechaEfectiva = fecha || hoyStr;

  const normalizarTab = useCallback((t) => {
    if (!t) return "carga";
    const s = String(t).toLowerCase();
    if (s.includes("cobro") || s.includes("entrega") || s.includes("aprob")) return "aprobaciones";
    if (s.includes("parada")) return "paradas";
    if (s.includes("cierre") || s.includes("rendicion")) return "cierre";
    return "carga";
  }, []);

  // Pestañas integradas del Expediente: 'carga' | 'paradas' | 'aprobaciones' | 'cierre'
  const [tabActivo, setTabActivo] = useState(() => normalizarTab(tabInicial));

  useEffect(() => {
    if (abierto && tabInicial) {
      setTabActivo(normalizarTab(tabInicial));
    }
  }, [abierto, tabInicial, normalizarTab]);

  // Identificación del Chofer y Asignación
  const idChofer =
    chofer?.IdUsuario ||
    chofer?.id_chofer ||
    asignacion?.IdUsuarioRepartidor ||
    (typeof chofer === "number" || typeof chofer === "string" ? Number(chofer) : null);

  const nombreChofer =
    chofer?.NombreCompleto ||
    asignacion?.NombreRepartidor ||
    "Chofer Repartidor";

  const idAsignacion =
    asignacion?.IdAsignacionRuta ||
    asignacion?.id_asignacion ||
    asignacion?.id_asignacion_ruta;

  const nombreRuta =
    asignacion?.NombreRuta ||
    "Ruta Asignada";

  const idRuta =
    asignacion?.IdRutaDistribucion ||
    asignacion?.id_ruta;

  // Estados Tab 1: Carga y Stock
  const [inventarioCamion, setInventarioCamion] = useState([]);
  const [cargandoInventario, setCargandoInventario] = useState(false);
  const [solicitudCarga, setSolicitudCarga] = useState(null);
  const [itemsCargaAprobar, setItemsCargaAprobar] = useState([]);
  const [resolviendoCarga, setResolviendoCarga] = useState(false);
  const [modoAccionCarga, setModoAccionCarga] = useState(null); // 'OBSERVAR' | 'RECHAZAR' | null
  const [motivoAccionCarga, setMotivoAccionCarga] = useState("");
  const [obsCarga, setObsCarga] = useState("Verificado conforme por Supervisor");

  // Estados Tab 2: Paradas y Pedidos
  const [paradasRuta, setParadasRuta] = useState([]);
  const [cargandoParadas, setCargandoParadas] = useState(false);

  // Estados Tab 3: Entregas y Cobros
  const [operaciones, setOperaciones] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [resumenOperaciones, setResumenOperaciones] = useState(null);
  const [cargandoOperaciones, setCargandoOperaciones] = useState(false);
  const [aprobandoTodo, setAprobandoTodo] = useState(false);
  const [resolviendoOperacionId, setResolviendoOperacionId] = useState(null);
  const [modalObsOp, setModalObsOp] = useState(false);
  const [opSeleccionada, setOpSeleccionada] = useState(null);
  const [textoObsOp, setTextoObsOp] = useState("");
  const [modalRechazarOp, setModalRechazarOp] = useState(false);
  const [textoRechazarOp, setTextoRechazarOp] = useState("");

  const focoElementRef = useRef(null);

  // Estados Tab 4: Cierre de jornada
  const [finalizandoRuta, setFinalizandoRuta] = useState(false);
  const [obsCierre, setObsCierre] = useState("");
  const [rutaFinalizadaExitosa, setRutaFinalizadaExitosa] = useState(false);

  // -------------------------------------------------------------------------
  // 1. Cargar Datos del Chofer y Asignación
  // -------------------------------------------------------------------------
  const cargarInventarioYCarga = useCallback(async () => {
    if (!idChofer) return;
    try {
      setCargandoInventario(true);
      const [inv, solicitudes] = await Promise.all([
        ObtenerInventarioChofer(idChofer).catch(() => []),
        ListarSolicitudesCarga(null, "PENDIENTE").catch(() => [])
      ]);

      setInventarioCamion(Array.isArray(inv) ? inv : []);

      const listaSols = Array.isArray(solicitudes) ? solicitudes : solicitudes?.items || [];
      const solMatch = listaSols.find((s) => {
        const cId = s.id_chofer || s.chofer_id || s.IdUsuarioRepartidor;
        const aId = s.id_asignacion || s.id_asignacion_ruta || s.IdAsignacionRuta;
        return Number(cId) === Number(idChofer) || (idAsignacion && Number(aId) === Number(idAsignacion));
      });

      setSolicitudCarga(solMatch || null);

      if (solMatch) {
        const detalles = solMatch.detalles || solMatch.items || [];
        const itemsInit = detalles.map((d) => {
          const cantSol = Number(d.stock_adicional_solicitado ?? d.cantidad_solicitada ?? d.cantidad ?? 0);
          const cantAprobadaRaw = Number(d.stock_adicional_aprobado ?? 0);
          return {
            presentacion_id: d.id_presentacion || d.presentacion_id,
            nombre_producto: d.nombre_producto || `Presentación #${d.id_presentacion || d.presentacion_id}`,
            cantidad_solicitada: cantSol,
            cantidad_aprobada: cantAprobadaRaw > 0 ? cantAprobadaRaw : cantSol,
            unidad: d.unidad || "u"
          };
        });
        setItemsCargaAprobar(itemsInit);
      }
    } catch {
      // Sincronización silenciosa
    } finally {
      setCargandoInventario(false);
    }
  }, [idChofer, idAsignacion]);

  const cargarParadasYPedidos = useCallback(async () => {
    if (!idRuta && !asignacion?.Paradas) return;
    try {
      setCargandoParadas(true);
      let puntos = [];
      if (asignacion?.Paradas && asignacion.Paradas.length > 0) {
        puntos = asignacion.Paradas;
      } else if (idRuta) {
        const detalle = await ObtenerRutaDetalle(idRuta).catch(() => null);
        puntos = detalle?.PuntosVenta || [];
      }

      let paradasConfig = {};
      try {
        const guardado = localStorage.getItem("blanquita_paradas_config");
        if (guardado) paradasConfig = JSON.parse(guardado);
      } catch {}

      const paradasMapeadas = puntos.map((p, idx) => {
        const pvId = p.IdPuntoVenta || p.id_punto_venta;
        const cfg = paradasConfig[pvId] || {};
        return {
          IdPuntoVenta: pvId,
          NombreCliente: p.NombreCliente || p.Cliente || "Comercio",
          NombrePuntoVenta: p.NombrePuntoVenta || "",
          Direccion: p.Direccion || "",
          OrdenVisita: p.OrdenVisita || idx + 1,
          frecuencia: cfg.frecuencia || p.Frecuencia || "DIARIO",
          productosHabituales: cfg.productosHabituales || p.ProductosHabituales || "Papel Higiénico Clásico (20 paq), Servilletas (10 fardos)",
          estadoVisita: p.EstadoVisita || p.Estado || (p.Entregado ? "Entregado" : "Pendiente")
        };
      });

      setParadasRuta(paradasMapeadas);
    } catch {
      // Sincronización silenciosa
    } finally {
      setCargandoParadas(false);
    }
  }, [idRuta, asignacion]);

  const cargarOperacionesChofer = useCallback(async () => {
    if (!idAsignacion) {
      setOperaciones([]);
      setPedidos([]);
      setResumenOperaciones(null);
      return;
    }
    try {
      setCargandoOperaciones(true);
      const res = await ObtenerOperacionesAsignacion(idAsignacion).catch(() => null);
      if (res) {
        setOperaciones(Array.isArray(res.operaciones) ? res.operaciones : []);
        setPedidos(Array.isArray(res.pedidos) ? res.pedidos : []);
        setResumenOperaciones(res.resumen || null);
      } else {
        setOperaciones([]);
        setPedidos([]);
        setResumenOperaciones(null);
      }
    } catch {
      setOperaciones([]);
      setPedidos([]);
      setResumenOperaciones(null);
    } finally {
      setCargandoOperaciones(false);
    }
  }, [idAsignacion]);

  useEffect(() => {
    if (!abierto) return;
    cargarInventarioYCarga();
    cargarParadasYPedidos();
    cargarOperacionesChofer();
  }, [abierto, cargarInventarioYCarga, cargarParadasYPedidos, cargarOperacionesChofer]);

  // Suscripción SSE reactiva en tiempo real sin perder foco ni scroll
  useLogisticaEventos({
    tipos: [
      "operacion_ruta_registrada",
      "ENTREGA_REGISTRADA",
      "COBRO_REGISTRADO",
      "SOLICITUD_CARGA",
      "solicitud_carga_recibida",
      "carga_camion_aprobada",
      "CARGA_APROBADA"
    ],
    onEvento: (datos) => {
      if (!abierto) return;
      const asigEvt = datos?.id_asignacion || datos?.asignacion_id || datos?.id_asignacion_ruta;
      if (asigEvt && idAsignacion && Number(asigEvt) === Number(idAsignacion)) {
        cargarOperacionesChofer();
        cargarInventarioYCarga();
      }
    }
  });

  // Scroll automático y suave hacia el elemento de foco si se solicitó
  useEffect(() => {
    if (tabActivo === "aprobaciones" && focoId && focoElementRef.current) {
      focoElementRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [tabActivo, focoId, operaciones]);

  // -------------------------------------------------------------------------
  // Métricas y Contadores Clave
  // -------------------------------------------------------------------------
  const pedidosPendientesCount = useMemo(() => {
    if (resumenOperaciones?.pedidos_pendientes != null) {
      return resumenOperaciones.pedidos_pendientes;
    }
    return pedidos.filter((p) => p.tiene_pendientes).length;
  }, [pedidos, resumenOperaciones]);

  const entregasPendientesCount = useMemo(() => {
    if (resumenOperaciones?.entregas_pendientes != null) {
      return resumenOperaciones.entregas_pendientes;
    }
    return pedidos.filter((p) => p.entrega && p.entrega.estado_revision_web === "PENDIENTE").length;
  }, [pedidos, resumenOperaciones]);

  const cobrosPendientesCount = useMemo(() => {
    if (resumenOperaciones?.cobros_pendientes != null) {
      return resumenOperaciones.cobros_pendientes;
    }
    let count = 0;
    pedidos.forEach((p) => {
      (p.cobros || []).forEach((c) => {
        if (c.estado_revision_web === "PENDIENTE") count++;
      });
    });
    return count;
  }, [pedidos, resumenOperaciones]);

  const operacionesPendientesCount = pedidosPendientesCount;

  const arqueo = useMemo(() => {
    if (resumenOperaciones) {
      return {
        ef: Number(resumenOperaciones.total_cobrado_efectivo || 0),
        qr: Number(resumenOperaciones.total_cobrado_qr || 0),
        totalCobrado: Number(resumenOperaciones.total_cobrado || 0),
        totalEntregado: Number(resumenOperaciones.total_entregado || 0),
        saldoPendiente: Number(resumenOperaciones.saldo_pendiente || 0)
      };
    }
    let ef = 0;
    let qr = 0;
    let totalCobrado = 0;
    let totalEntregado = 0;
    for (const op of operaciones) {
      const monto = Number(op.monto ?? 0);
      const tipo = String(op.tipo_operacion || "").toUpperCase();
      if (tipo === "COBRO") {
        totalCobrado += monto;
        const met = String(op.metodo_pago || "").toLowerCase();
        if (met.includes("qr") || met.includes("transferencia")) {
          qr += monto;
        } else {
          ef += monto;
        }
      } else if (tipo === "ENTREGA") {
        totalEntregado += monto;
      }
    }
    return {
      ef,
      qr,
      totalCobrado,
      totalEntregado,
      saldoPendiente: Math.max(0, totalEntregado - totalCobrado)
    };
  }, [operaciones, resumenOperaciones]);

  const listaPedidosRender = useMemo(() => {
    if (pedidos && pedidos.length > 0) return pedidos;
    if (!operaciones || operaciones.length === 0) return [];

    const map = new Map();
    for (const op of operaciones) {
      const pId = op.id_pedido || op.IdPedido || `GEN-${op.id_operacion || Math.random()}`;
      if (!map.has(pId)) {
        map.set(pId, {
          id_pedido: pId,
          numero_pedido: op.numero_pedido || `PED-${pId}`,
          cliente: {
            nombre: op.cliente || op.Cliente || "Cliente Final",
            direccion: op.direccion || op.Direccion || "",
            punto_venta: op.punto_venta || op.PuntoVenta || ""
          },
          monto_total: 0,
          saldo_restante: 0,
          tiene_pendientes: false,
          entrega: null,
          cobros: []
        });
      }
      const item = map.get(pId);
      const tipo = String(op.tipo_operacion || "").toUpperCase();
      const rev = (op.estado_revision_web || op.EstadoRevision || "PENDIENTE").toUpperCase();
      if (rev === "PENDIENTE") item.tiene_pendientes = true;

      if (tipo === "ENTREGA") {
        item.entrega = op;
        item.monto_total = Number(op.monto || op.TotalNeto || item.monto_total);
      } else {
        item.cobros.push(op);
      }
    }
    return Array.from(map.values());
  }, [pedidos, operaciones]);

  // -------------------------------------------------------------------------
  // Handlers Tab 1: Carga y Stock
  // -------------------------------------------------------------------------
  const handleAprobarCarga = async () => {
    const asigId = idAsignacion || solicitudCarga?.id_asignacion || solicitudCarga?.id_asignacion_ruta;
    if (!asigId) {
      toast.error("No se encontró ID de asignación para la carga");
      return;
    }
    try {
      setResolviendoCarga(true);
      const payload = itemsCargaAprobar.map((it) => ({
        presentacion_id: Number(it.presentacion_id),
        cantidad_aprobada: Number(it.cantidad_aprobada)
      }));

      await ResolverSolicitudCarga(asigId, {
        decision: "APROBADA",
        items: payload,
        items_aprobados: payload,
        observacion: obsCarga || "Carga física y stock de camión verificados por supervisor",
        usar_remanente: true
      });

      toast.success("Stock de camión aprobado y ruta habilitada para reparto");
      setSolicitudCarga(null);
      await cargarInventarioYCarga();

      window.dispatchEvent(new CustomEvent("blanquita:carga-actualizada", {
        detail: { idAsignacion: asigId, decision: "APROBADA" }
      }));

      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al aprobar carga");
    } finally {
      setResolviendoCarga(false);
    }
  };

  const handleAccionCarga = async (tipoAccion) => {
    const asigId = idAsignacion || solicitudCarga?.id_asignacion || solicitudCarga?.id_asignacion_ruta;
    if (!asigId) return;
    if (!motivoAccionCarga.trim()) {
      toast.error(`Ingresa el motivo para ${tipoAccion.toLowerCase()} la carga`);
      return;
    }
    try {
      setResolviendoCarga(true);
      await ResolverSolicitudCarga(asigId, {
        decision: tipoAccion,
        motivo: motivoAccionCarga.trim(),
        observacion: motivoAccionCarga.trim()
      });

      toast[tipoAccion === "OBSERVADA" ? "info" : "error"](`Solicitud de carga ${tipoAccion.toLowerCase()}`);
      setModoAccionCarga(null);
      setMotivoAccionCarga("");
      setSolicitudCarga(null);
      await cargarInventarioYCarga();

      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al procesar solicitud");
    } finally {
      setResolviendoCarga(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers Tab 2: Cambiar Estado de Parada
  // -------------------------------------------------------------------------
  const cambiarEstadoParada = (index, nuevoEstado) => {
    setParadasRuta((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], estadoVisita: nuevoEstado };
      return copia;
    });
    toast.success(`Parada #${index + 1} marcada como: ${nuevoEstado}`);
  };

  // -------------------------------------------------------------------------
  // Handlers Tab 3: Entregas y Cobros
  // -------------------------------------------------------------------------
  const extraerIdOp = (op) => {
    if (!op) return null;
    const tipo = String(op.tipo_operacion || "entrega").toLowerCase();
    if (tipo === "cobro") {
      return op.id_pago || op.IdPagoPedido || String(op.id_operacion || "").replace(/^COB-/, "");
    }
    return op.id_pedido || op.IdPedido || String(op.id_operacion || "").replace(/^ENT-/, "");
  };

  const handleAprobarOp = async (op) => {
    const id = extraerIdOp(op);
    const tipo = String(op.tipo_operacion || "entrega").toLowerCase();
    try {
      await RevisarOperacionRuta(id, "APROBADO", "Aprobado por supervisor en Detalle de Ruta", tipo);
      toast.success(`Operación aprobada exitosamente`);
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al aprobar operación");
    }
  };

  const handleAprobarPedidoCompleto = async (idPedido) => {
    if (!idAsignacion || !idPedido) return;
    try {
      setResolviendoOperacionId(`PED-${idPedido}`);
      const res = await AprobarPedidoCompletoAsignacion(idAsignacion, idPedido);
      toast.success(res?.mensaje || `Pedido #${idPedido} aprobado completamente (entrega y cobros)`);
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || `Error al aprobar pedido #${idPedido}`);
    } finally {
      setResolviendoOperacionId(null);
    }
  };

  const handleAprobarTodo = async () => {
    if (!idAsignacion) return;
    try {
      setAprobandoTodo(true);
      const res = await AprobarTodasOperacionesAsignacion(idAsignacion);
      toast.success(res?.mensaje || "Operaciones pendientes aprobadas con éxito");
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al aprobar operaciones masivamente");
    } finally {
      setAprobandoTodo(false);
    }
  };

  const confirmarObservarOp = async () => {
    if (!opSeleccionada || !textoObsOp.trim()) {
      toast.error("Ingresa el motivo de la observación");
      return;
    }
    const id = extraerIdOp(opSeleccionada);
    const tipo = String(opSeleccionada.tipo_operacion || "entrega").toLowerCase();
    try {
      await RevisarOperacionRuta(id, "OBSERVADO", textoObsOp.trim(), tipo);
      toast.info(`Operación marcada como OBSERVADA`);
      setModalObsOp(false);
      setTextoObsOp("");
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al observar operación");
    }
  };

  const confirmarRechazarOp = async () => {
    if (!opSeleccionada || !textoRechazarOp.trim()) {
      toast.error("Ingresa el motivo del rechazo");
      return;
    }
    const id = extraerIdOp(opSeleccionada);
    const tipo = String(opSeleccionada.tipo_operacion || "entrega").toLowerCase();
    try {
      await RevisarOperacionRuta(id, "RECHAZADO", textoRechazarOp.trim(), tipo);
      toast.error(`Operación RECHAZADA`);
      setModalRechazarOp(false);
      setTextoRechazarOp("");
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al rechazar operación");
    }
  };

  // -------------------------------------------------------------------------
  // Handlers Tab 4: Cierre de jornada
  // -------------------------------------------------------------------------
  const handleFinalizarRutaChofer = async () => {
    if (operacionesPendientesCount > 0) {
      toast.error(`No es posible finalizar: quedan ${operacionesPendientesCount} operaciones pendientes por aprobar`);
      return;
    }
    if (!idAsignacion) {
      toast.error("No se localizó la asignación activa de la ruta");
      return;
    }

    try {
      setFinalizandoRuta(true);
      await FinalizarRutaAdmin(
        idAsignacion,
        obsCierre || `Ruta de ${nombreChofer} finalizada y conciliada conforme por supervisor`,
        "APROBADA"
      );
      toast.success(`Ruta de ${nombreChofer} finalizada con éxito`);
      setRutaFinalizadaExitosa(true);

      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al finalizar la ruta");
    } finally {
      setFinalizandoRuta(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-none sm:max-w-[min(1200px,96vw)] w-[min(1200px,96vw)] max-h-[min(92vh,900px)] h-[min(92vh,900px)] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl border border-slate-200">
        {/* Cabecera Limpia en Modo Claro */}
        <div className="shrink-0 border-b border-slate-200 px-6 py-4 bg-white text-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[#1C96C5] shrink-0 mt-0.5 shadow-2xs">
                <Truck className="h-6 w-6 shrink-0" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg font-bold leading-tight text-slate-900">
                    Detalle de Ruta y Despacho
                  </DialogTitle>
                  <Badge variant="outline" className="bg-sky-50 text-[#1C96C5] border-sky-300 text-xs px-2.5 py-0.5 font-bold">
                    {nombreChofer}
                  </Badge>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs px-2.5 py-0.5 font-mono">
                    {nombreRuta}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-1">
                  <span className="font-mono flex items-center gap-1 text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-[#1C96C5]" />
                    {fechaEfectiva}
                  </span>
                  <span>•</span>
                  <span>Estado: <strong className={asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa ? "text-emerald-600" : "text-amber-600 font-bold"}>
                    {rutaFinalizadaExitosa ? "Finalizada" : asignacion?.Estado || "En Reparto"}
                  </strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {operacionesPendientesCount > 0 ? (
                <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50 text-xs px-3 py-1 font-semibold flex items-center gap-1.5 shadow-2xs">
                  <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600" />
                  <span>{operacionesPendientesCount} por aprobar</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 text-xs px-3 py-1 font-semibold flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Verificación al día</span>
                </Badge>
              )}

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-2 cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5 shrink-0" />
              </button>
            </div>
          </div>

          {/* Franja Superior de Resumen de KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-slate-100">
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl px-3 py-2 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Total entregado</span>
              <span className="text-sm font-bold text-slate-900 font-mono">Bs. {arqueo.totalEntregado.toFixed(2)}</span>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl px-3 py-2 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-emerald-800">Efectivo cobrado</span>
              <span className="text-sm font-bold text-emerald-700 font-mono">Bs. {arqueo.ef.toFixed(2)}</span>
            </div>
            <div className="bg-sky-50/60 border border-sky-200/80 rounded-xl px-3 py-2 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-sky-800">QR / Transferencia</span>
              <span className="text-sm font-bold text-sky-700 font-mono">Bs. {arqueo.qr.toFixed(2)}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl px-3 py-2 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-amber-800">Diferencia vs esperado</span>
              <span className="text-sm font-bold text-amber-700 font-mono">Bs. {arqueo.saldoPendiente.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Barra de Pestañas Limpias (Sin Numeraciones ni Nombres Arcaicos) */}
        <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 border-b border-slate-200 bg-slate-50/70 p-2 gap-2">
          <button
            type="button"
            onClick={() => setTabActivo("carga")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "carga"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Boxes className="h-4 w-4 shrink-0" />
            <span className="truncate">Carga y stock</span>
            {solicitudCarga && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("paradas")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "paradas"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Route className="h-4 w-4 shrink-0" />
            <span className="truncate">Paradas</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono shrink-0 ${tabActivo === "paradas" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
              {paradasRuta.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("aprobaciones")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "aprobaciones"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Receipt className="h-4 w-4 shrink-0" />
            <span className="truncate">Entregas y cobros</span>
            {operacionesPendientesCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-white shadow-2xs shrink-0">
                {operacionesPendientesCount} por aprobar
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                Al día
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("cierre")}
            className={`w-full justify-center px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "cierre"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">Cierre de jornada</span>
            {(asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa) && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            )}
          </button>
        </div>

        {/* Cuerpo Scrollable con Contenido de las Pestañas */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {/* ========================================================================= */}
          {/* PESTAÑA 1: CARGA Y STOCK */}
          {/* ========================================================================= */}
          {tabActivo === "carga" && (
            <div className="space-y-6">
              {solicitudCarga ? (
                <div className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5">
                        <Boxes className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                          <span>Solicitud de Carga Pendiente de Aprobación</span>
                          <Badge className="bg-amber-200 text-amber-900 border-amber-400 text-[10px]">
                            {solicitudCarga.estado || "PENDIENTE"}
                          </Badge>
                        </h3>
                        <p className="text-xs text-amber-800 mt-0.5">
                          El chofer solicitó stock adicional para atender la demanda de la jornada.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto bg-white rounded-xl border border-amber-200 shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-amber-100/60 text-amber-900 font-semibold border-b border-amber-200">
                        <tr>
                          <th className="py-2.5 px-3">Producto / Presentación</th>
                          <th className="py-2.5 px-3 text-right">Solicitado</th>
                          <th className="py-2.5 px-3 text-right">Aprobar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {itemsCargaAprobar.map((it, idx) => (
                          <tr key={idx} className="hover:bg-amber-50/40">
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {it.nombre_producto}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                              {it.cantidad_solicitada} {it.unidad}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Input
                                type="number"
                                min="0"
                                value={it.cantidad_aprobada}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setItemsCargaAprobar((prev) => {
                                    const c = [...prev];
                                    c[idx].cantidad_aprobada = val;
                                    return c;
                                  });
                                }}
                                className="h-7 w-20 text-right font-mono text-xs ml-auto border-amber-300"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {modoAccionCarga && (
                    <div className="space-y-1.5 p-3 bg-white rounded-xl border border-amber-200">
                      <label className="text-xs font-semibold text-slate-700">
                        Motivo para {modoAccionCarga === "OBSERVAR" ? "observar" : "rechazar"} la carga:
                      </label>
                      <Input
                        value={motivoAccionCarga}
                        onChange={(e) => setMotivoAccionCarga(e.target.value)}
                        placeholder={`Indica el motivo de la acción...`}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleAprobarCarga}
                        disabled={resolviendoCarga}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-4 gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Aprobar Carga de Camión</span>
                      </Button>

                      {!modoAccionCarga ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setModoAccionCarga("OBSERVAR")}
                            className="border-amber-400 text-amber-800 hover:bg-amber-100 text-xs h-8 cursor-pointer"
                          >
                            Observar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setModoAccionCarga("RECHAZAR")}
                            className="border-rose-400 text-rose-800 hover:bg-rose-100 text-xs h-8 cursor-pointer"
                          >
                            Rechazar
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleAccionCarga(modoAccionCarga === "OBSERVAR" ? "OBSERVADA" : "RECHAZADA")}
                            disabled={resolviendoCarga}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 cursor-pointer"
                          >
                            Confirmar {modoAccionCarga}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setModoAccionCarga(null);
                              setMotivoAccionCarga("");
                            }}
                            className="text-xs h-8 cursor-pointer"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">
                        Carga y Stock Verificados
                      </h4>
                      <p className="text-[11px] text-emerald-700">
                        No hay solicitudes de carga pendientes para este viaje. El inventario a bordo está cuadrado.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stock a Bordo del Camión */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Boxes className="h-4 w-4 text-[#1C96C5]" />
                    <span>Stock a Bordo del Camión</span>
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cargarInventarioYCarga}
                    disabled={cargandoInventario}
                    className="h-7 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <RotateCcw className={`h-3 w-3 mr-1 ${cargandoInventario ? "animate-spin" : ""}`} />
                    Actualizar
                  </Button>
                </div>

                {inventarioCamion.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                    El chofer no tiene stock registrado a bordo del camión en este momento.
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Producto</th>
                          <th className="py-2.5 px-3 text-right">Remanente Anterior</th>
                          <th className="py-2.5 px-3 text-right">Cargado Hoy</th>
                          <th className="py-2.5 px-3 text-right">Total a Bordo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {inventarioCamion.map((stk, idx) => {
                          const rem = Number(stk.cantidad_remanente || 0);
                          const act = Number(stk.cantidad_actual ?? stk.cantidad ?? 0);
                          const tot = act > 0 ? act : rem;
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {stk.nombre_producto || stk.producto || `Presentación #${stk.presentacion_id}`}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-500">
                                {rem} {stk.unidad || "u"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-sky-700 font-semibold">
                                {Math.max(0, tot - rem)} {stk.unidad || "u"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                {tot} {stk.unidad || "u"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 2: PARADAS */}
          {/* ========================================================================= */}
          {tabActivo === "paradas" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ListOrdered className="h-4 w-4 text-[#1C96C5]" />
                    <span>Paradas Programadas de la Ruta</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Lista de comercios programados con sus pedidos habituales y estado de entrega.
                  </p>
                </div>

                {onAbrirEditorParadas && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAbrirEditorParadas(asignacion)}
                    className="h-8 text-xs border-sky-300 text-sky-800 hover:bg-sky-50 gap-1.5 cursor-pointer"
                  >
                    <Route className="h-3.5 w-3.5 text-[#1C96C5]" />
                    <span>Abrir Editor de Paradas</span>
                  </Button>
                )}
              </div>

              {cargandoParadas ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Cargando paradas de la ruta...
                </div>
              ) : paradasRuta.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                  No se encontraron paradas asignadas para esta ruta en el sistema.
                </div>
              ) : (
                <div className="space-y-2">
                  {paradasRuta.map((parada, idx) => {
                    const badgeColor =
                      parada.estadoVisita === "Entregado"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : parada.estadoVisita === "Rechazado"
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "bg-slate-100 text-slate-700 border-slate-200";

                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-sky-100 text-[#1C96C5] border border-sky-200 font-bold text-xs flex items-center justify-center shrink-0">
                            #{parada.OrdenVisita}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {parada.NombreCliente}
                              </span>
                              {parada.NombrePuntoVenta && (
                                <span className="text-[11px] text-slate-500 font-medium">
                                  ({parada.NombrePuntoVenta})
                                </span>
                              )}
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${badgeColor}`}>
                                {parada.estadoVisita}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{parada.Direccion || "Sin dirección física registrada"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cambiarEstadoParada(idx, "Entregado")}
                            className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 px-2 cursor-pointer"
                          >
                            Entregado
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cambiarEstadoParada(idx, "Rechazado")}
                            className="h-7 text-xs text-rose-700 hover:bg-rose-50 px-2 cursor-pointer"
                          >
                            Rechazado
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 3: ENTREGAS Y COBROS */}
          {/* ========================================================================= */}
          {tabActivo === "aprobaciones" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-[#1C96C5]" />
                    <span>Auditoría de Entregas y Cobros por Pedido</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Inspecciona y aprueba individualmente la entrega y cada cobro registrado, o aprueba el pedido completo.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-sky-300 text-sky-800 bg-sky-50 text-xs font-semibold px-2.5 py-1">
                    {listaPedidosRender.length} pedidos en ruta
                  </Badge>

                  {pedidosPendientesCount > 0 && (
                    <Button
                      size="sm"
                      onClick={handleAprobarTodo}
                      disabled={aprobandoTodo}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 gap-1.5 shadow-xs cursor-pointer"
                    >
                      <CheckCheck className="h-4 w-4" />
                      <span>Aprobar todo ({pedidosPendientesCount} pendientes)</span>
                    </Button>
                  )}
                </div>
              </div>

              {cargandoOperaciones ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Cargando entregas y cobros de la asignación...
                </div>
              ) : listaPedidosRender.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                  No hay operaciones registradas para esta asignación en la jornada seleccionada.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {listaPedidosRender.map((ped) => {
                    const cli = ped.cliente || {};
                    const entrega = ped.entrega;
                    const cobros = ped.cobros || [];
                    const revEntrega = (entrega?.estado_revision_web || "PENDIENTE").toUpperCase();
                    const esFoco = focoId && (
                      String(ped.id_pedido) === String(focoId) ||
                      String(ped.numero_pedido) === String(focoId) ||
                      cobros.some((c) => String(c.id_pago) === String(focoId) || String(c.id_operacion) === String(focoId)) ||
                      String(entrega?.id_operacion) === String(focoId)
                    );
                    const resolviendoEstePedido = resolviendoOperacionId === `PED-${ped.id_pedido}`;

                    return (
                      <div
                        key={ped.id_pedido}
                        id={`pedido-${ped.id_pedido}`}
                        data-foco={esFoco ? "true" : undefined}
                        ref={esFoco ? focoElementRef : null}
                        className={`bg-white border rounded-2xl overflow-hidden transition-all shadow-xs ${
                          esFoco
                            ? "ring-2 ring-[#1C96C5] border-[#1C96C5] bg-sky-50/10 shadow-md"
                            : ped.tiene_pendientes
                            ? "border-amber-300"
                            : "border-slate-200"
                        }`}
                      >
                        {/* Cabecera del Pedido con Datos del Cliente y Resumen */}
                        <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-[#1C96C5] text-white font-mono text-xs font-bold px-2 py-0.5">
                                #{ped.numero_pedido || ped.id_pedido}
                              </Badge>

                              <span className="font-bold text-xs text-slate-900 truncate">
                                {cli.nombre || "Cliente Final"}
                              </span>

                              {cli.documento && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                                  DOC: {cli.documento}
                                </span>
                              )}

                              {cli.punto_venta && (
                                <span className="text-[11px] text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md font-medium">
                                  {cli.punto_venta}
                                </span>
                              )}

                              {esFoco && (
                                <Badge className="bg-amber-500 text-white text-[9px] font-bold">
                                  Enfoque notificación
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                              {cli.direccion && (
                                <span className="flex items-center gap-1 truncate max-w-xs">
                                  <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{cli.direccion}</span>
                                </span>
                              )}
                              {cli.telefono && (
                                <span className="text-slate-600 font-mono">
                                  Tel: {cli.telefono}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                            <div className="text-right">
                              <div className="text-[10px] text-slate-400 font-semibold uppercase">Total / Saldo</div>
                              <div className="text-xs font-bold text-slate-900 font-mono">
                                Bs. {Number(ped.monto_total || 0).toFixed(2)}{" "}
                                <span className={Number(ped.saldo_restante || 0) > 0 ? "text-amber-700 font-bold" : "text-emerald-700"}>
                                  (Saldo: Bs. {Number(ped.saldo_restante || 0).toFixed(2)})
                                </span>
                              </div>
                            </div>

                            {ped.tiene_pendientes && (
                              <Button
                                size="sm"
                                onClick={() => handleAprobarPedidoCompleto(ped.id_pedido)}
                                disabled={resolviendoEstePedido || aprobandoTodo}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-3 gap-1 shadow-xs cursor-pointer"
                                title="Aprobar tanto la entrega como todos los cobros de este pedido"
                              >
                                <CheckCheck className="h-3.5 w-3.5" />
                                <span>{resolviendoEstePedido ? "Aprobando..." : "Aprobar pedido completo"}</span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Sub-tarjetas internas: Fila de Entrega + Fila de Cobros */}
                        <div className="p-4 space-y-3">
                          {/* 1. Entrega Física */}
                          <div className="bg-white border border-slate-200/90 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg text-[#1C96C5] shrink-0 mt-0.5">
                                <Truck className="h-4 w-4" />
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-800">Entrega de mercadería</span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 border ${
                                      entrega?.estado_entrega === "ENTREGADO" || entrega?.estado_entrega === "COMPLETO"
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                        : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {entrega?.estado_entrega || "PENDIENTE"}
                                  </Badge>
                                  {entrega?.fecha_entrega && (
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      {new Date(entrega.fecha_entrega).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  {entrega?.observaciones_revision || "Verificación física de entrega de productos al cliente"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                              {revEntrega === "PENDIENTE" ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAprobarOp(entrega || { id_pedido: ped.id_pedido, tipo_operacion: "entrega" })}
                                    className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-none cursor-pointer"
                                  >
                                    Aprobar entrega
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setOpSeleccionada(entrega || { id_pedido: ped.id_pedido, tipo_operacion: "entrega" });
                                      setModalObsOp(true);
                                    }}
                                    className="h-7 px-2 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 rounded cursor-pointer"
                                  >
                                    Observar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setOpSeleccionada(entrega || { id_pedido: ped.id_pedido, tipo_operacion: "entrega" });
                                      setModalRechazarOp(true);
                                    }}
                                    className="h-7 px-2 text-xs text-rose-700 border-rose-300 hover:bg-rose-50 rounded cursor-pointer"
                                  >
                                    Rechazar
                                  </Button>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={`text-xs px-2.5 py-0.5 font-semibold ${
                                      revEntrega === "APROBADO"
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : revEntrega === "OBSERVADO"
                                        ? "bg-amber-100 text-amber-800 border-amber-300"
                                        : "bg-rose-100 text-rose-800 border-rose-300"
                                    }`}
                                  >
                                    {revEntrega}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAprobarOp(entrega || { id_pedido: ped.id_pedido, tipo_operacion: "entrega" })}
                                    className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer"
                                    title="Re-aprobar entrega"
                                  >
                                    Rectificar
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 2. Cobros Registrados */}
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 px-1">
                              <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Cobros registrados para este pedido ({cobros.length}):</span>
                            </div>

                            {cobros.length === 0 ? (
                              <div className="p-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                                Sin cobros registrados en ruta para este pedido (posible venta a crédito o saldo pendiente).
                              </div>
                            ) : (
                              cobros.map((cobro, cIdx) => {
                                const revCobro = (cobro.estado_revision_web || "PENDIENTE").toUpperCase();
                                const metCobro = String(cobro.metodo_pago || "Efectivo").toUpperCase();
                                const montoCobro = Number(cobro.monto || 0);

                                return (
                                  <div
                                    key={cobro.id_pago || cIdx}
                                    id={`cobro-${cobro.id_pago}`}
                                    className="bg-slate-50/40 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
                                  >
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 shrink-0 mt-0.5">
                                        {metCobro.includes("QR") ? (
                                          <QrCode className="h-4 w-4" />
                                        ) : (
                                          <Banknote className="h-4 w-4" />
                                        )}
                                      </div>
                                      <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-bold text-slate-900">
                                            Cobro en {cobro.metodo_pago || "Efectivo"}
                                          </span>
                                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-mono text-xs font-bold px-2 py-0">
                                            Bs. {montoCobro.toFixed(2)}
                                          </Badge>
                                          {cobro.numero_referencia && (
                                            <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                              Ref: {cobro.numero_referencia}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                          <span>Registrado por chofer</span>
                                          {cobro.fecha_pago && (
                                            <span className="font-mono">
                                              • {new Date(cobro.fecha_pago).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                                      {revCobro === "PENDIENTE" ? (
                                        <>
                                          <Button
                                            size="sm"
                                            onClick={() => handleAprobarOp(cobro)}
                                            className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-none cursor-pointer"
                                          >
                                            Aprobar cobro
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setOpSeleccionada(cobro);
                                              setModalObsOp(true);
                                            }}
                                            className="h-7 px-2 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 rounded cursor-pointer"
                                          >
                                            Observar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setOpSeleccionada(cobro);
                                              setModalRechazarOp(true);
                                            }}
                                            className="h-7 px-2 text-xs text-rose-700 border-rose-300 hover:bg-rose-50 rounded cursor-pointer"
                                          >
                                            Rechazar
                                          </Button>
                                        </>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <Badge
                                            className={`text-xs px-2.5 py-0.5 font-semibold ${
                                              revCobro === "APROBADO"
                                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                                : revCobro === "OBSERVADO"
                                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                                : "bg-rose-100 text-rose-800 border-rose-300"
                                            }`}
                                          >
                                            {revCobro}
                                          </Badge>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleAprobarOp(cobro)}
                                            className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer"
                                            title="Re-aprobar cobro"
                                          >
                                            Rectificar
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 4: CIERRE DE JORNADA */}
          {/* ========================================================================= */}
          {tabActivo === "cierre" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#1C96C5]" />
                  <span>Resumen de Cierre y Conciliación del Chofer</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-slate-500">Total ventas y entregas</span>
                    <p className="text-base font-bold text-slate-900 font-mono mt-0.5">Bs. {arqueo.totalEntregado.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-emerald-800">Total cobrado rendido</span>
                    <p className="text-base font-bold text-emerald-700 font-mono mt-0.5">Bs. {arqueo.totalCobrado.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-[11px] font-semibold text-amber-800">Diferencia pendiente</span>
                    <p className="text-base font-bold text-amber-700 font-mono mt-0.5">Bs. {arqueo.saldoPendiente.toFixed(2)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Observaciones finales de cierre (opcional):
                  </label>
                  <Input
                    value={obsCierre}
                    onChange={(e) => setObsCierre(e.target.value)}
                    placeholder="Escribe comentarios sobre la jornada, rendición o novedades..."
                    className="h-9 text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {operacionesPendientesCount > 0 ? (
                      <span className="text-amber-700 font-semibold">
                        Debes aprobar las {operacionesPendientesCount} operaciones antes de cerrar la jornada.
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">
                        Todas las operaciones están aprobadas. Puedes proceder al cierre.
                      </span>
                    )}
                  </span>

                  <Button
                    size="sm"
                    onClick={handleFinalizarRutaChofer}
                    disabled={finalizandoRuta || operacionesPendientesCount > 0 || asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa}
                    className="bg-[#1C96C5] hover:bg-[#157A9E] text-white font-bold text-xs h-9 px-5 gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Finalizar y Liberar Chofer</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de Motivo de Observación */}
        {modalObsOp && (
          <Dialog open={modalObsOp} onOpenChange={setModalObsOp}>
            <DialogContent className="max-w-md bg-white p-5 rounded-2xl">
              <DialogTitle className="text-sm font-bold text-slate-900">
                Observar Operación
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                Ingresa el motivo por el cual esta operación queda observada:
              </p>
              <Input
                value={textoObsOp}
                onChange={(e) => setTextoObsOp(e.target.value)}
                placeholder="Motivo de la observación..."
                className="mt-3 text-xs"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setModalObsOp(false)} className="text-xs">
                  Cancelar
                </Button>
                <Button size="sm" onClick={confirmarObservarOp} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                  Guardar Observación
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal de Motivo de Rechazo (Obligatorio) */}
        {modalRechazarOp && (
          <Dialog open={modalRechazarOp} onOpenChange={setModalRechazarOp}>
            <DialogContent className="max-w-md bg-white p-5 rounded-2xl">
              <DialogTitle className="text-sm font-bold text-rose-900">
                Rechazar Operación
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">
                Ingresa obligatoriamente el motivo del rechazo para que el chofer sea notificado:
              </p>
              <Input
                value={textoRechazarOp}
                onChange={(e) => setTextoRechazarOp(e.target.value)}
                placeholder="Motivo del rechazo (obligatorio)..."
                className="mt-3 text-xs"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setModalRechazarOp(false)} className="text-xs">
                  Cancelar
                </Button>
                <Button size="sm" onClick={confirmarRechazarOp} className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
                  Confirmar Rechazo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
