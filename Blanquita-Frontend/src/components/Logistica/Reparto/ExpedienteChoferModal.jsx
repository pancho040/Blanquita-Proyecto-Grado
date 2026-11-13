import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  ListOrdered
} from "lucide-react";
import { ObtenerInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import { ObtenerNotasVenta, ObtenerNotaVentaDetalle } from "@/services/Contabilidad/cuentasCobrarService";
import {
  ObtenerRutaDetalle,
  ResolverSolicitudCarga,
  RevisarOperacionRuta,
  FinalizarRutaAdmin,
  ObtenerAsignaciones,
  ListarSolicitudesCarga
} from "@/services/Logistica/RutaService";

export default function ExpedienteChoferModal({
  abierto,
  onOpenChange,
  chofer = null,
  asignacion = null,
  fecha = null,
  usuario = null,
  alActualizar = null,
  onAbrirEditorParadas = null
}) {
  const hoyStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const fechaEfectiva = fecha || hoyStr;

  // Pestañas integradas del Expediente
  // 1: Carga e Inventario | 2: Paradas y Pedidos | 3: Aprobación 1 a 1 | 4: Cierre y Liquidación
  const [tabActivo, setTabActivo] = useState("carga");

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

  // Estados Tab 1: Carga e Inventario
  const [inventarioCamion, setInventarioCamion] = useState([]);
  const [cargandoInventario, setCargandoInventario] = useState(false);
  const [solicitudCarga, setSolicitudCarga] = useState(null);
  const [itemsCargaAprobar, setItemsCargaAprobar] = useState([]);
  const [resolviendoCarga, setResolviendoCarga] = useState(false);
  const [modoAccionCarga, setModoAccionCarga] = useState(null); // 'OBSERVAR' | 'RECHAZAR' | null
  const [motivoAccionCarga, setMotivoAccionCarga] = useState("");
  const [obsCarga, setObsCarga] = useState("Verificado conforme por Supervisor");

  // Estados Tab 2: Paradas y Pedidos Programados
  const [paradasRuta, setParadasRuta] = useState([]);
  const [cargandoParadas, setCargandoParadas] = useState(false);

  // Estados Tab 3: Entregas y Cobros (Aprobación 1 a 1)
  const [operaciones, setOperaciones] = useState([]);
  const [cargandoOperaciones, setCargandoOperaciones] = useState(false);
  const [modalObsOp, setModalObsOp] = useState(false);
  const [opSeleccionada, setOpSeleccionada] = useState(null);
  const [textoObsOp, setTextoObsOp] = useState("");
  const [modalRechazarOp, setModalRechazarOp] = useState(false);
  const [textoRechazarOp, setTextoRechazarOp] = useState("");

  // Estados Tab 4: Cierre y Liquidación
  const [finalizandoRuta, setFinalizandoRuta] = useState(false);
  const [obsCierre, setObsCierre] = useState("");
  const [rutaFinalizadaExitosa, setRutaFinalizadaExitosa] = useState(false);

  // -------------------------------------------------------------------------
  // 1. Cargar Datos del Chofer al abrir o cambiar de pestaña
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

      // Buscar si este chofer tiene solicitud pendiente
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

      // Obtener configuración de pedidos programados y frecuencias desde localStorage
      let paradasConfig = {};
      try {
        const guardado = localStorage.getItem("blanquita_paradas_config");
        if (guardado) paradasConfig = JSON.parse(guardado);
      } catch {}

      // Mapear con estados de visita reales
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
    if (!idChofer) return;
    try {
      setCargandoOperaciones(true);
      const notas = await ObtenerNotasVenta({ fecha: fechaEfectiva }).catch(() => []);
      const lista = Array.isArray(notas) ? notas : [];
      // Filtrar por este chofer
      const delChofer = lista.filter((n) => {
        const cId = n.IdChofer || n.id_chofer || n.IdUsuarioRepartidor;
        if (Number(cId) === Number(idChofer)) return true;
        const nombreN = (n.Chofer || n.NombreRepartidor || "").toLowerCase();
        return nombreN && nombreChofer && nombreN.includes(nombreChofer.toLowerCase());
      });
      setOperaciones(delChofer);
    } catch {
      // Sincronización silenciosa
    } finally {
      setCargandoOperaciones(false);
    }
  }, [idChofer, fechaEfectiva, nombreChofer]);

  useEffect(() => {
    if (!abierto) return;
    cargarInventarioYCarga();
    cargarParadasYPedidos();
    cargarOperacionesChofer();
  }, [abierto, cargarInventarioYCarga, cargarParadasYPedidos, cargarOperacionesChofer]);

  // -------------------------------------------------------------------------
  // Métricas y Contadores Clave
  // -------------------------------------------------------------------------
  const operacionesPendientes = useMemo(() => {
    return operaciones.filter((op) => {
      const rev = (op.EstadoRevision || op.estado_revision || op.estado_revision_web || "PENDIENTE").toUpperCase();
      return rev === "PENDIENTE";
    });
  }, [operaciones]);

  const operacionesPendientesCount = operacionesPendientes.length;

  const arqueo = useMemo(() => {
    let ef = 0;
    let qr = 0;
    let cr = 0;
    let total = 0;
    for (const op of operaciones) {
      const monto = Number(op.TotalNeto ?? op.ImporteNeto ?? op.TotalVentaBruto ?? 0);
      const efVal = Number(op.MontoEfectivo || 0);
      const qrVal = Number(op.MontoQR || 0);
      const crVal = Number(op.MontoCredito ?? op.SaldoPendiente ?? 0);

      total += monto;
      ef += efVal;
      qr += qrVal;
      cr += crVal;

      if (efVal === 0 && qrVal === 0 && crVal === 0 && monto > 0) {
        const m = (op.MetodoPago || "").toLowerCase();
        if (m.includes("efectivo")) ef += monto;
        else if (m.includes("qr") || m.includes("transferencia")) qr += monto;
        else if (m.includes("credito") || m.includes("crédito")) cr += monto;
      }
    }
    return { total, ef, qr, cr };
  }, [operaciones]);

  // -------------------------------------------------------------------------
  // Handlers Tab 1: Carga e Inventario
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

      window.dispatchEvent(new CustomEvent("blanquita:ws-event", {
        detail: { tipo: "carga_camion_aprobada", idAsignacion: asigId }
      }));
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

      window.dispatchEvent(new CustomEvent("blanquita:ws-event", {
        detail: { tipo: tipoAccion === "OBSERVADA" ? "carga_camion_observada" : "carga_camion_rechazada", idAsignacion: asigId }
      }));
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
  // Handlers Tab 3: Aprobación 1 a 1 de Operaciones
  // -------------------------------------------------------------------------
  const handleAprobarOp = async (op) => {
    const id = op.IdNotaVenta || op.id_nota_venta || op.id || op.IdOperacion;
    try {
      await RevisarOperacionRuta(id, "APROBADO", "Aprobado por supervisor en Expediente de Ruta");
      toast.success(`Operación ${op.NumeroNota || id} aprobada`);
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al aprobar operación");
    }
  };

  const confirmarObservarOp = async () => {
    if (!opSeleccionada || !textoObsOp.trim()) {
      toast.error("Ingresa el motivo de la observación");
      return;
    }
    const id = opSeleccionada.IdNotaVenta || opSeleccionada.id_nota_venta || opSeleccionada.id;
    try {
      await RevisarOperacionRuta(id, "OBSERVADO", textoObsOp.trim());
      toast.info(`Operación ${opSeleccionada.NumeroNota || id} marcada como OBSERVADA`);
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
    const id = opSeleccionada.IdNotaVenta || opSeleccionada.id_nota_venta || opSeleccionada.id;
    try {
      await RevisarOperacionRuta(id, "RECHAZADO", textoRechazarOp.trim());
      toast.error(`Operación ${opSeleccionada.NumeroNota || id} RECHAZADA`);
      setModalRechazarOp(false);
      setTextoRechazarOp("");
      await cargarOperacionesChofer();
      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al rechazar operación");
    }
  };

  // -------------------------------------------------------------------------
  // Handlers Tab 4: Finalizar Ruta del Chofer
  // -------------------------------------------------------------------------
  const handleFinalizarRutaChofer = async () => {
    if (operacionesPendientesCount > 0) {
      toast.error(`Prohibido finalizar: quedan ${operacionesPendientesCount} operaciones pendientes de auditoría en la pestaña 3`);
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
      toast.success(`¡Ruta del chofer ${nombreChofer} finalizada con éxito!`);
      setRutaFinalizadaExitosa(true);

      window.dispatchEvent(new CustomEvent("blanquita:ws-event", {
        detail: { tipo: "ruta_finalizada_admin", idAsignacion }
      }));

      if (alActualizar) alActualizar();
    } catch (err) {
      toast.error(err.message || "Error al finalizar la ruta");
    } finally {
      setFinalizandoRuta(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-4xl w-full max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl">
        {/* Cabecera Impecable del Expediente */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 bg-[#1C96C5] rounded-xl text-white shrink-0 mt-0.5">
              <Truck className="h-6 w-6 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-bold leading-tight text-white">
                  Expediente de Ruta & Control del Chofer
                </DialogTitle>
                <Badge className="bg-[#1C96C5]/20 text-sky-300 border border-sky-400/40 text-[11px] px-2 py-0.5 font-mono">
                  {nombreChofer}
                </Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-300 mt-1">
                <span className="font-semibold text-white">{nombreRuta}</span>
                <span>•</span>
                <span className="font-mono text-slate-300 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-sky-400" />
                  {fechaEfectiva}
                </span>
                <span>•</span>
                <span>Estado: <strong className={asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa ? "text-emerald-400" : "text-amber-300"}>
                  {rutaFinalizadaExitosa ? "Finalizada" : asignacion?.Estado || "En Reparto"}
                </strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {operacionesPendientesCount > 0 ? (
              <Badge variant="outline" className="border-amber-400 text-amber-300 bg-amber-950/40 text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 animate-pulse text-amber-400" />
                <span>{operacionesPendientesCount} op. por auditar</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-400 text-emerald-300 bg-emerald-950/40 text-xs px-2.5 py-1 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Auditoría al día (0 pend.)</span>
              </Badge>
            )}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5 shrink-0" />
            </button>
          </div>
        </div>

        {/* Barra de 4 Pestañas Principales */}
        <div className="shrink-0 flex items-center border-b border-slate-200 bg-slate-50 px-6 py-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTabActivo("carga")}
            className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              tabActivo === "carga"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>1. Carga e Inventario</span>
            {solicitudCarga && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("paradas")}
            className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              tabActivo === "paradas"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Route className="h-4 w-4" />
            <span>2. Paradas 1..N & Pedidos</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${tabActivo === "paradas" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
              {paradasRuta.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("aprobaciones")}
            className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              tabActivo === "aprobaciones"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>3. Entregas y Cobros (1 a 1)</span>
            {operacionesPendientesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-white">
                {operacionesPendientesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabActivo("cierre")}
            className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
              tabActivo === "cierre"
                ? "bg-[#1C96C5] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>4. Cierre y Liquidación</span>
            {asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa ? (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-600 text-white">
                Cerrada
              </span>
            ) : null}
          </button>
        </div>

        {/* Cuerpo del Modal con Contenido de la Pestaña Activa */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {/* ========================================================================= */}
          {/* PESTAÑA 1: CARGA E INVENTARIO EN SU CAMIÓN */}
          {/* ========================================================================= */}
          {tabActivo === "carga" && (
            <div className="space-y-4">
              {/* Sección de Solicitud de Carga Pendiente si existe */}
              {solicitudCarga ? (
                <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                      <PackageCheck className="h-5 w-5 text-amber-600" />
                      <span>Solicitud de Carga Pendiente para Reparto</span>
                    </div>
                    <Badge className="bg-amber-500 text-white text-xs">
                      Requiere Resolución
                    </Badge>
                  </div>

                  <p className="text-xs text-amber-800">
                    El chofer solicita cargar los siguientes paquetes para la ruta de hoy. El campo <strong>Cant. a Aprobar</strong> está prellenado con lo solicitado; puedes editarlo antes de aprobar:
                  </p>

                  <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-amber-100/60 text-amber-900 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Producto</th>
                          <th className="py-2 px-3 text-right">Solicitado</th>
                          <th className="py-2 px-3 text-center w-36">Cant. a Aprobar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 text-slate-800">
                        {itemsCargaAprobar.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-medium">{item.nombre_producto}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {item.cantidad_solicitada} {item.unidad}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Input
                                type="number"
                                min="0"
                                value={item.cantidad_aprobada}
                                onChange={(e) => {
                                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                                  setItemsCargaAprobar((prev) => {
                                    const c = [...prev];
                                    c[idx] = { ...c[idx], cantidad_aprobada: val };
                                    return c;
                                  });
                                }}
                                className="h-7 w-20 mx-auto text-center font-bold text-xs bg-white border-amber-300 text-[#1C96C5]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {modoAccionCarga && (
                    <div className="p-3 bg-white border border-amber-300 rounded-lg space-y-2">
                      <label className="text-xs font-bold text-slate-700">
                        {modoAccionCarga === "OBSERVAR" ? "Motivo de Observación para el Chofer:" : "Motivo de Rechazo de Carga:"}
                      </label>
                      <Input
                        type="text"
                        autoFocus
                        value={motivoAccionCarga}
                        onChange={(e) => setMotivoAccionCarga(e.target.value)}
                        placeholder="Escribe el detalle aquí..."
                        className="h-8 text-xs bg-white"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setModoAccionCarga(null)}
                          className="h-7 text-xs"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          disabled={resolviendoCarga}
                          onClick={() => handleAccionCarga(modoAccionCarga)}
                          className={`h-7 text-xs text-white ${modoAccionCarga === "OBSERVAR" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"}`}
                        >
                          Confirmar {modoAccionCarga === "OBSERVAR" ? "Observación" : "Rechazo"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!modoAccionCarga && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setModoAccionCarga("RECHAZAR")}
                          className="h-8 px-3 text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                        >
                          Rechazar Carga
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setModoAccionCarga("OBSERVAR")}
                          className="h-8 px-3 text-xs text-amber-800 border-amber-300 hover:bg-amber-50"
                        >
                          Observar Carga
                        </Button>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={resolviendoCarga}
                        onClick={handleAprobarCarga}
                        className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-none"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Aprobar Carga de Camión</span>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-emerald-900 font-medium">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Sin solicitudes de carga pendientes. Carga del camión autorizada y al día.</span>
                  </div>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-white text-[11px]">
                    Activo en Ruta
                  </Badge>
                </div>
              )}

              {/* Inventario Físico Real a Bordo del Camión */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                    <Truck className="h-4 w-4 text-[#1C96C5]" />
                    <span>Inventario Físico a Bordo del Camión (Stock Actual)</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cargarInventarioYCarga}
                    className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Refrescar
                  </Button>
                </div>

                {cargandoInventario ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Cargando stock en camión...
                  </div>
                ) : inventarioCamion.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No se registran existencias cargadas en el camión de este chofer.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
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
          {/* PESTAÑA 2: PARADAS DE LA RUTA 1..N Y PEDIDOS PROGRAMADOS */}
          {/* ========================================================================= */}
          {tabActivo === "paradas" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ListOrdered className="h-4 w-4 text-[#1C96C5]" />
                    <span>Secuencia Vial de Reparto (1..{paradasRuta.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Lista de comercios programados para visitar hoy con sus pedidos habituales y estado de entrega.
                  </p>
                </div>

                {onAbrirEditorParadas && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAbrirEditorParadas(asignacion)}
                    className="h-8 text-xs border-sky-300 text-sky-800 hover:bg-sky-50 gap-1.5"
                  >
                    <Route className="h-3.5 w-3.5 text-[#1C96C5]" />
                    <span>Abrir Editor Completo 1..N</span>
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
                        : parada.estadoVisita === "Pidio Más"
                        ? "bg-sky-50 text-sky-700 border-sky-300"
                        : parada.estadoVisita === "Pidio Menos"
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : parada.estadoVisita === "Atrasado" || parada.estadoVisita === "No Estaba"
                        ? "bg-purple-50 text-purple-700 border-purple-300"
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
                                <span className="text-[11px] text-slate-500 truncate">
                                  • {parada.NombrePuntoVenta}
                                </span>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-600 bg-slate-50">
                                Frec: {parada.frecuencia}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{parada.Direccion || "Sin dirección exacta"}</span>
                            </div>
                            <div className="text-[11px] text-[#1C96C5] font-medium pt-0.5">
                              Pedido Programado: <span className="text-slate-700">{parada.productosHabituales}</span>
                            </div>
                          </div>
                        </div>

                        {/* Selector de Estado de Visita */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <span className="text-[11px] text-slate-500 font-medium">Estado:</span>
                          <select
                            value={parada.estadoVisita}
                            onChange={(e) => cambiarEstadoParada(idx, e.target.value)}
                            className={`h-7 text-xs font-semibold rounded border px-2 focus:outline-none ${badgeColor}`}
                          >
                            <option value="Pendiente">Pendiente</option>
                            <option value="Entregado">Entregado</option>
                            <option value="Pidio Más">Pidió Más</option>
                            <option value="Pidio Menos">Pidió Menos</option>
                            <option value="Atrasado">Atrasado</option>
                            <option value="No Estaba">No Estaba</option>
                            <option value="Rechazado">Rechazado</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* PESTAÑA 3: ENTREGAS Y COBROS REALIZADOS HOY (APROBACIÓN 1 A 1) */}
          {/* ========================================================================= */}
          {tabActivo === "aprobaciones" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="h-4 w-4 text-[#1C96C5]" />
                    <span>Auditoría de Entregas y Notas de Venta Emitidas Hoy (1 a 1)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Inspecciona y aprueba individualmente cada entrega, cobranza o comprobante QR antes de cerrar la jornada.
                  </p>
                </div>
                <Badge variant="outline" className="border-sky-300 text-sky-800 bg-sky-50 text-xs font-semibold px-2.5 py-1">
                  {operaciones.length} operaciones registradas
                </Badge>
              </div>

              {cargandoOperaciones ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Cargando operaciones del chofer...
                </div>
              ) : operaciones.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                  El chofer aún no ha emitido Notas de Venta ni cobros en esta jornada.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {operaciones.map((op, idx) => {
                    const rev = (op.EstadoRevision || op.estado_revision || op.estado_revision_web || "PENDIENTE").toUpperCase();
                    const monto = Number(op.TotalNeto ?? op.ImporteNeto ?? op.TotalVentaBruto ?? 0);
                    const metodo = op.MetodoPago || "Efectivo";

                    return (
                      <div
                        key={idx}
                        className={`bg-white border rounded-xl p-3.5 transition-all shadow-2xs ${
                          rev === "PENDIENTE"
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
                              <span className="font-bold text-xs text-slate-900">
                                {op.NumeroNota || op.NumeroNotaVenta || `Nota #${op.IdNotaVenta || idx + 1}`}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-700 bg-white">
                                {metodo}
                              </Badge>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {op.FechaHoraEmision ? new Date(op.FechaHoraEmision).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Hoy"}
                              </span>
                            </div>

                            <div className="text-xs text-slate-700 font-medium truncate">
                              Cliente: <strong className="text-slate-900">{op.Cliente || op.RazonSocial || "Cliente Final"}</strong>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              <span>Monto: <strong className="text-emerald-700 font-mono text-xs">{monto.toFixed(2)} Bs</strong></span>
                              {op.FirmaDigitalUrl && (
                                <span className="text-sky-600 flex items-center gap-0.5">
                                  <CheckCircle2 className="h-3 w-3" /> Con firma
                                </span>
                              )}
                              {op.UrlComprobante && (
                                <span className="text-purple-600 flex items-center gap-0.5">
                                  <QrCode className="h-3 w-3" /> Con foto QR
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Estado y Botones de Aprobación 1 a 1 */}
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            {rev === "PENDIENTE" ? (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleAprobarOp(op)}
                                  className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-none"
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
                                  className="h-7 px-2.5 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 rounded"
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
                                  className="h-7 px-2.5 text-xs text-rose-700 border-rose-300 hover:bg-rose-50 rounded"
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
                                {/* Permitir rectificar si fuera necesario */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAprobarOp(op)}
                                  className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-slate-800"
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
          {/* PESTAÑA 4: CIERRE Y LIQUIDACIÓN DE RUTA */}
          {/* ========================================================================= */}
          {tabActivo === "cierre" && (
            <div className="space-y-4">
              {/* Tarjetas de Arqueo y Conciliación Financiera */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Ventas</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                    {arqueo.total.toFixed(2)} Bs
                  </span>
                  <span className="text-[10px] text-slate-400">{operaciones.length} comprobantes</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Cobro Efectivo</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono mt-0.5 block">
                    {arqueo.ef.toFixed(2)} Bs
                  </span>
                  <span className="text-[10px] text-slate-400">A entregar en caja</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                  <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider block">Cobro QR / Transf.</span>
                  <span className="text-base font-extrabold text-sky-700 font-mono mt-0.5 block">
                    {arqueo.qr.toFixed(2)} Bs
                  </span>
                  <span className="text-[10px] text-slate-400">En cuenta bancaria</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
                  <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Ventas a Crédito</span>
                  <span className="text-base font-extrabold text-amber-700 font-mono mt-0.5 block">
                    {arqueo.cr.toFixed(2)} Bs
                  </span>
                  <span className="text-[10px] text-slate-400">Registrado en CxC</span>
                </div>
              </div>

              {/* Verificación de Integridad de Auditoría Pre-Cierre */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#1C96C5]" />
                  <span>Control de Auditoría para Finiquito y Cierre de Jornada</span>
                </h4>

                {operacionesPendientesCount > 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Atención: Prohibido finalizar con operaciones pendientes</span>
                    </div>
                    <p>
                      Existen <strong>{operacionesPendientesCount} entregas/cobros</strong> en estado PENDIENTE de revisión en la Pestaña 3. Debes aprobar, observar o rechazar cada una antes de liquidar la ruta.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setTabActivo("aprobaciones")}
                      className="mt-2 h-7 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    >
                      Ir a Revisar Operaciones
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      Auditoría 1 a 1 concluida con éxito (0 pendientes). La ruta está lista para liquidación y cierre final.
                    </span>
                  </div>
                )}

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Observaciones Generales de Liquidación y Cierre:
                  </label>
                  <Input
                    type="text"
                    value={obsCierre}
                    onChange={(e) => setObsCierre(e.target.value)}
                    placeholder="Ej: Rendición conforme, efectivo entregado en caja fuerte y odómetro verificado..."
                    className="h-9 text-xs bg-white text-slate-800"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    {asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa
                      ? "Esta ruta ya se encuentra FINALIZADA en el sistema."
                      : "Al finalizar, se congela el itinerario del día y se habilita la rendición contable."}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      operacionesPendientesCount > 0 ||
                      finalizandoRuta ||
                      asignacion?.Estado === "Finalizada" ||
                      rutaFinalizadaExitosa
                    }
                    onClick={handleFinalizarRutaChofer}
                    className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {finalizandoRuta
                        ? "Finalizando..."
                        : asignacion?.Estado === "Finalizada" || rutaFinalizadaExitosa
                        ? "Ruta Finalizada"
                        : "Finalizar Ruta del Chofer"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Impecable */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Papelera Blanquita • Centro de Mando Logístico Dual
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs text-slate-600 hover:text-slate-900 border-slate-300"
          >
            Cerrar Expediente
          </Button>
        </div>
      </DialogContent>

      {/* Sub-Modal Observar Operación */}
      {modalObsOp && (
        <Dialog open={modalObsOp} onOpenChange={setModalObsOp}>
          <DialogContent className="max-w-md p-5 space-y-3">
            <DialogTitle className="text-sm font-bold text-slate-800">
              Observar Operación {opSeleccionada?.NumeroNota}
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Ingresa el motivo específico por el cual se observa esta entrega o cobro:
            </p>
            <Input
              type="text"
              autoFocus
              value={textoObsOp}
              onChange={(e) => setTextoObsOp(e.target.value)}
              placeholder="Ej: Comprobante QR ilegible, monto no coincide..."
              className="h-9 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setModalObsOp(false)} className="text-xs">
                Cancelar
              </Button>
              <Button size="sm" onClick={confirmarObservarOp} className="text-xs bg-amber-600 hover:bg-amber-700 text-white">
                Confirmar Observación
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Sub-Modal Rechazar Operación */}
      {modalRechazarOp && (
        <Dialog open={modalRechazarOp} onOpenChange={setModalRechazarOp}>
          <DialogContent className="max-w-md p-5 space-y-3">
            <DialogTitle className="text-sm font-bold text-rose-800">
              Rechazar Operación {opSeleccionada?.NumeroNota}
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Indica la causa por la cual esta nota no puede ser admitida en la rendición:
            </p>
            <Input
              type="text"
              autoFocus
              value={textoRechazarOp}
              onChange={(e) => setTextoRechazarOp(e.target.value)}
              placeholder="Ej: Entrega no autorizada, cliente desconoce pedido..."
              className="h-9 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setModalRechazarOp(false)} className="text-xs">
                Cancelar
              </Button>
              <Button size="sm" onClick={confirmarRechazarOp} className="text-xs bg-rose-600 hover:bg-rose-700 text-white">
                Confirmar Rechazo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
