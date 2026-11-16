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
  AprobarTodasOperacionesAsignacion
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
  const [cargandoOperaciones, setCargandoOperaciones] = useState(false);
  const [aprobandoTodo, setAprobandoTodo] = useState(false);
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
      return;
    }
    try {
      setCargandoOperaciones(true);
      const res = await ObtenerOperacionesAsignacion(idAsignacion).catch(() => null);
      if (res && Array.isArray(res.operaciones)) {
        setOperaciones(res.operaciones);
      } else {
        setOperaciones([]);
      }
    } catch {
      setOperaciones([]);
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
  const operacionesPendientes = useMemo(() => {
    return operaciones.filter((op) => {
      const rev = (op.estado_revision_web || op.EstadoRevision || "PENDIENTE").toUpperCase();
      return rev === "PENDIENTE";
    });
  }, [operaciones]);

  const operacionesPendientesCount = operacionesPendientes.length;

  const arqueo = useMemo(() => {
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
  }, [operaciones]);

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
  const handleAprobarOp = async (op) => {
    const id = op.id_operacion || op.IdPagoPedido || op.IdPedido;
    const tipo = String(op.tipo_operacion || "entrega").toLowerCase();
    try {
      await RevisarOperacionRuta(id, "APROBADO", "Aprobado por supervisor en Detalle de Ruta", tipo);
      toast.success(`Operación ${op.numero_pedido || id} aprobada exitosamente`);
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al aprobar operación");
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
    const id = opSeleccionada.id_operacion || opSeleccionada.IdPagoPedido || opSeleccionada.IdPedido;
    const tipo = String(opSeleccionada.tipo_operacion || "entrega").toLowerCase();
    try {
      await RevisarOperacionRuta(id, "OBSERVADO", textoObsOp.trim(), tipo);
      toast.info(`Operación ${opSeleccionada.numero_pedido || id} marcada como OBSERVADA`);
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
    const id = opSeleccionada.id_operacion || opSeleccionada.IdPagoPedido || opSeleccionada.IdPedido;
    const tipo = String(opSeleccionada.tipo_operacion || "entrega").toLowerCase();
    try {
      await RevisarOperacionRuta(id, "RECHAZADO", textoRechazarOp.trim(), tipo);
      toast.error(`Operación ${opSeleccionada.numero_pedido || id} RECHAZADA`);
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
      <DialogContent showCloseButton={false} className="max-w-5xl w-[92vw] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl border border-slate-200">
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
        <div className="shrink-0 flex items-center border-b border-slate-200 bg-slate-50/70 px-6 py-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTabActivo("carga")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "carga"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Carga y stock</span>
            {solicitudCarga && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("paradas")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "paradas"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Route className="h-4 w-4" />
            <span>Paradas</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${tabActivo === "paradas" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
              {paradasRuta.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("aprobaciones")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "aprobaciones"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Entregas y cobros</span>
            {operacionesPendientesCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-white shadow-2xs">
                {operacionesPendientesCount} por aprobar
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Al día
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("cierre")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              tabActivo === "cierre"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Cierre de jornada</span>
            {(asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa) && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
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
                    <span>Auditoría de Entregas y Cobros en Ruta</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Inspecciona y aprueba individual o masivamente cada cobro y entrega registrada por el chofer.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-sky-300 text-sky-800 bg-sky-50 text-xs font-semibold px-2.5 py-1">
                    {operaciones.length} registradas
                  </Badge>

                  {operacionesPendientesCount > 0 && (
                    <Button
                      size="sm"
                      onClick={handleAprobarTodo}
                      disabled={aprobandoTodo}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 gap-1.5 shadow-xs cursor-pointer"
                    >
                      <CheckCheck className="h-4 w-4" />
                      <span>Aprobar todo ({operacionesPendientesCount})</span>
                    </Button>
                  )}
                </div>
              </div>

              {cargandoOperaciones ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Cargando entregas y cobros de la asignación...
                </div>
              ) : operaciones.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                  No hay operaciones registradas para esta asignación en la jornada seleccionada.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {operaciones.map((op, idx) => {
                    const rev = (op.estado_revision_web || op.EstadoRevision || "PENDIENTE").toUpperCase();
                    const monto = Number(op.monto ?? op.TotalNeto ?? 0);
                    const metodo = op.metodo_pago || op.MetodoPago || (op.tipo_operacion === "COBRO" ? "Efectivo" : "Entrega");
                    const cliente = op.cliente || op.Cliente || "Cliente Final";
                    const esFoco = focoId && (
                      String(op.id_operacion) === String(focoId) ||
                      String(op.id_pago) === String(focoId) ||
                      String(op.id_pedido) === String(focoId)
                    );
                    const esCobro = String(op.tipo_operacion).toUpperCase() === "COBRO";

                    return (
                      <div
                        key={idx}
                        id={`operacion-${op.id_pago || op.id_operacion}`}
                        data-foco={esFoco ? "true" : undefined}
                        ref={esFoco ? focoElementRef : null}
                        className={`bg-white border rounded-xl p-3.5 transition-all shadow-2xs ${
                          esFoco
                            ? "ring-2 ring-[#20A7DB] border-[#20A7DB] bg-sky-50/50 shadow-md"
                            : rev === "PENDIENTE"
                            ? "border-amber-300 bg-amber-50/20"
                            : rev === "APROBADO"
                            ? "border-emerald-200"
                            : rev === "OBSERVADO"
                            ? "border-purple-200"
                            : "border-rose-200"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-extrabold px-1.5 py-0 border ${
                                  esCobro
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    : "bg-sky-50 text-sky-800 border-sky-300"
                                }`}
                              >
                                {esCobro ? "COBRO" : "ENTREGA"}
                              </Badge>

                              <span className="font-bold text-xs text-slate-900">
                                {op.numero_pedido || `Operación #${op.id_operacion || idx + 1}`}
                              </span>

                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-700 bg-white">
                                {metodo}
                              </Badge>

                              <span className="text-[11px] text-slate-500 font-mono">
                                {op.fecha_hora ? new Date(op.fecha_hora).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Hoy"}
                              </span>

                              {esFoco && (
                                <Badge className="bg-[#20A7DB] text-white text-[9px] font-bold">
                                  Notificación
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-slate-700 font-medium truncate">
                              Cliente: <strong className="text-slate-900">{cliente}</strong>
                              {op.punto_venta && (
                                <span className="text-slate-500 ml-1">({op.punto_venta})</span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              <span>Monto: <strong className="text-emerald-700 font-mono text-xs">Bs. {monto.toFixed(2)}</strong></span>
                              {op.numero_referencia && (
                                <span className="text-slate-400 font-mono text-[10px]">
                                  Ref: {op.numero_referencia}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Botones de Aprobación Individual */}
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            {rev === "PENDIENTE" ? (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleAprobarOp(op)}
                                  className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-none cursor-pointer"
                                >
                                  Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setOpSeleccionada(op);
                                    setModalObsOp(true);
                                  }}
                                  className="h-7 px-2.5 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 rounded cursor-pointer"
                                >
                                  Observar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setOpSeleccionada(op);
                                    setModalRechazarOp(true);
                                  }}
                                  className="h-7 px-2.5 text-xs text-rose-700 border-rose-300 hover:bg-rose-50 rounded cursor-pointer"
                                >
                                  Rechazar
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={`text-xs px-2.5 py-0.5 font-semibold ${
                                    rev === "APROBADO"
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : rev === "OBSERVADO"
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-rose-100 text-rose-800 border-rose-300"
                                  }`}
                                >
                                  {rev}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAprobarOp(op)}
                                  className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer"
                                  title="Re-aprobar operación"
                                >
                                  Rectificar
                                </Button>
                              </div>
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
