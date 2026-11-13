import { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import { 
  ObtenerAsignaciones, 
  CrearAsignacion, 
  ActualizarAsignacion, 
  ObtenerRutas, 
  ObtenerRepartidores, 
  ObtenerRutaDetalle 
} from "@/services/Logistica/RutaService";
import { ObtenerTodosPuntosVenta } from "@/services/Logistica/ClienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Truck, 
  Plus, 
  Calendar, 
  Loader2, 
  UserCheck, 
  Map as MapIcon, 
  Gauge, 
  PlayCircle, 
  CheckCircle, 
  Clock, 
  Navigation, 
  Search, 
  RotateCcw,
  Sparkles,
  Route,
  Users,
  FileText,
  Printer,
  Radio,
  Receipt,
  Boxes,
  History,
  ShieldCheck
} from "lucide-react";
import MapaRuta from "../Rutas/MapaRuta";
import BuscadorSelect from "../Common/BuscadorSelect";
import KpiCard from "../Common/KpiCard";
import GestionChoferesModal from "./GestionChoferesModal";
import HojaDeRutaModal from "./HojaDeRutaModal";
import EntregaChoferMovil from "../Reparto/EntregaChoferMovil";
import CierreTurnoChoferComponent from "../Reparto/CierreTurnoChofer";
import InventarioCamionTab from "../Reparto/InventarioCamionTab";
import HistorialRepartoTab from "../Reparto/HistorialRepartoTab";
import EditorParadasDinamicoModal from "../Rutas/EditorParadasDinamicoModal";
import ModalReasignarParadas from "../Rutas/ModalReasignarParadas";
import BandejaSolicitudCargaModal from "../Reparto/BandejaSolicitudCargaModal";
import AlertaSolicitudesCargaBanner from "../Reparto/AlertaSolicitudesCargaBanner";
import ExpedienteChoferModal from "../Reparto/ExpedienteChoferModal";
import { logisticaSocket } from "@/services/Logistica/LogisticaWebSocket";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { SkeletonTable } from "@/components/common/LoadingStates";
import { cache } from "@/lib/cacheService";

const FLOTA_VEHICULOS = [
  { value: "Camión #1 (4821-KLE)", label: "Camión #1 (4821-KLE)" },
  { value: "Camión #2 (3190-PTX)", label: "Camión #2 (3190-PTX)" },
  { value: "Camioneta #3 (5022-LBN)", label: "Camioneta #3 (5022-LBN)" },
  { value: "Moto #4 (1298-XYZ)", label: "Moto #4 (1298-XYZ)" }
];

export default function TablaAsignaciones({ usuario = null, vistaInicial = "despachos" }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance, nombreSucursalActual } = usePaginaSucursal({
    usuario,
    permiteTodas: false,
  });

  const esVistaChofer = vistaInicial === "entregas" || vistaInicial === "cierre" || usuario?.IdRol === 6;

  const hoyStr = new Date().toISOString().split("T")[0];
  const [fecha, setFecha] = useState(hoyStr);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vistas unificadas del hub de reparto
  const [vistaActiva, setVistaActiva] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "entregas" || tabParam === "entrega") return "entregas";
      if (tabParam === "cierre" || tabParam === "turnos") return "cierre";
      if (tabParam === "inventario" || tabParam === "camion") return "inventario";
      if (tabParam === "historial" || tabParam === "reporte") return "historial";
    }
    return vistaInicial;
  });
  const [modalEntregaAbierto, setModalEntregaAbierto] = useState(false);
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);
  const [choferAccionRapida, setChoferAccionRapida] = useState(null);

  // Catálogos precargados en memoria para apertura INSTANTÁNEA (0 ms)
  const [rutas, setRutas] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [todosPV, setTodosPV] = useState([]);
  const [catalogosCargados, setCatalogosCargados] = useState(false);

  // Filtros Avanzados
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroRepartidor, setFiltroRepartidor] = useState("TODOS");
  const [filtroZona, setFiltroZona] = useState("TODAS");
  const [busquedaTexto, setBusquedaTexto] = useState("");

  // Modal Programar Despacho
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(FLOTA_VEHICULOS[0].value);
  const [notaExtra, setNotaExtra] = useState("");

  const [formAsignacion, setFormAsignacion] = useState({
    IdRutaDistribucion: "",
    IdUsuarioRepartidor: "",
    FechaAsignacion: hoyStr,
    KilometrajeInicial: "45120",
  });

  // Modal Cambio de Estado / Odómetro Final
  const [modalEstadoAbierto, setModalEstadoAbierto] = useState(false);
  const [asignacionGestionar, setAsignacionGestionar] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState("En Ruta");
  const [kmFinal, setKmFinal] = useState("");
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  // Modal mapa de ruta
  const [modalMapa, setModalMapa] = useState(false);
  const [rutaMapa, setRutaMapa] = useState(null);
  const [puntosMapa, setPuntosMapa] = useState([]);
  const [cargandoMapa, setCargandoMapa] = useState(false);

  // Modales de Choferes y Hoja de Ruta
  const [modalChoferesAbierto, setModalChoferesAbierto] = useState(false);
  const [hojaRutaAsignacion, setHojaRutaAsignacion] = useState(null);

  // Modales para Nuevos Requerimientos (Editor 1..N, Reasignar Paradas, Solicitud de Carga)
  const [modalEditorParadas, setModalEditorParadas] = useState(false);
  const [asignacionParaEditarParadas, setAsignacionParaEditarParadas] = useState(null);
  const [modalReasignarParadas, setModalReasignarParadas] = useState(false);
  const [asignacionParaReasignar, setAsignacionParaReasignar] = useState(null);
  const [modalSolicitudCarga, setModalSolicitudCarga] = useState(false);
  const [asignacionParaCarga, setAsignacionParaCarga] = useState(null);
  const [wsConectado, setWsConectado] = useState(false);

  // Modal Centralizado por Chofer (Expediente de Ruta)
  const [modalExpedienteChofer, setModalExpedienteChofer] = useState(false);
  const [choferParaExpediente, setChoferParaExpediente] = useState(null);
  const [asignacionParaExpediente, setAsignacionParaExpediente] = useState(null);

  // Plantillas automáticas de chofer por ruta (localStorage)
  const [plantillasAutomaticas, setPlantillasAutomaticas] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const guardado = localStorage.getItem("blanquita_rutas_plantilla_auto");
        return guardado ? JSON.parse(guardado) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const toggleAsignacionAutomatica = (idRuta, idChofer) => {
    const copia = { ...plantillasAutomaticas };
    if (copia[idRuta] === idChofer) {
      delete copia[idRuta];
      toast.info("Asignación automática deshabilitada para esta ruta");
    } else {
      copia[idRuta] = idChofer;
      toast.success("Plantilla guardada: este chofer se asignará automáticamente a esta ruta");
    }
    setPlantillasAutomaticas(copia);
    if (typeof window !== "undefined") {
      localStorage.setItem("blanquita_rutas_plantilla_auto", JSON.stringify(copia));
    }
  };

  const cambiarChoferManualmente = async (asignacion, nuevoChoferId) => {
    if (!asignacion || !nuevoChoferId) return;
    try {
      await ActualizarAsignacion(asignacion.IdAsignacionRuta, {
        IdUsuarioRepartidor: Number(nuevoChoferId)
      });
      const repObj = repartidores.find((r) => Number(r.IdUsuario) === Number(nuevoChoferId));
      toast.success(`Chofer cambiado a: ${repObj?.NombreCompleto || "Nuevo repartidor"}`);
      cargarAsignaciones(true);
    } catch (err) {
      toast.error(err.message || "Error al cambiar chofer");
    }
  };

  // Cargar asignaciones (memorizada para actualización)
  const cargarAsignaciones = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      const data = await ObtenerAsignaciones(fecha, null, sucursal);
      setAsignaciones(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      if (!silencioso) toast.error(err.message || "Error al cargar despachos");
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [fecha, sucursal]);

  const recargarAsignacionesSilencioso = useCallback(() => {
    cargarAsignaciones(true);
  }, [cargarAsignaciones]);

  // Precargar catálogos en segundo plano
  const precargarCatalogos = useCallback(async () => {
    try {
      const [r, rep, pv] = await Promise.all([
        ObtenerRutas(null, sucursal),
        ObtenerRepartidores(sucursal),
        ObtenerTodosPuntosVenta(sucursal)
      ]);
      setRutas(Array.isArray(r) ? r : (r?.items || []));
      setRepartidores(Array.isArray(rep) ? rep : (rep?.items || []));
      setTodosPV(Array.isArray(pv) ? pv : []);
      setCatalogosCargados(true);
    } catch {
      // Sincronización silenciosa
    }
  }, [sucursal]);

  // Precarga de catálogos y despachos al cambiar sucursal
  useEffect(() => {
    if (!cargandoAlcance) {
      precargarCatalogos();
      cargarAsignaciones();
    }
  }, [sucursal, cargandoAlcance, precargarCatalogos, cargarAsignaciones]);

  // WebSocket en tiempo real: Cero Polling Innecesario (Plan Gratuito)
  useEffect(() => {
    logisticaSocket.conectar();
    const unsubEstado = logisticaSocket.onEstadoConexion(setWsConectado);

    const unsubCarga = logisticaSocket.suscribir("solicitud_carga_recibida", (datos) => {
      toast.info("Nueva solicitud de carga de camión recibida de chofer");
      cargarAsignaciones(true);
    });

    const unsubOp = logisticaSocket.suscribir("operacion_ruta_registrada", () => {
      cargarAsignaciones(true);
    });

    const unsubReorden = logisticaSocket.suscribir("ruta_reordenada", () => {
      cargarAsignaciones(true);
    });

    const unsubFin = logisticaSocket.suscribir("ruta_finalizada_admin", () => {
      cargarAsignaciones(true);
    });

    const handleCustomWs = (e) => {
      cargarAsignaciones(true);
    };
    window.addEventListener("blanquita:ws-event", handleCustomWs);

    return () => {
      unsubEstado();
      unsubCarga();
      unsubOp();
      unsubReorden();
      unsubFin();
      window.removeEventListener("blanquita:ws-event", handleCustomWs);
    };
  }, [cargarAsignaciones]);

  // Apertura instantánea sin esperar peticiones
  const abrirModalProgramar = () => {
    setFormAsignacion({
      IdRutaDistribucion: rutas.length > 0 ? String(rutas[0].IdRutaDistribucion) : "",
      IdUsuarioRepartidor: repartidores.length > 0 ? String(repartidores[0].IdUsuario) : "",
      FechaAsignacion: fecha,
      KilometrajeInicial: "45120",
    });
    setNotaExtra("");
    setModalAbierto(true);

    if (!catalogosCargados) {
      precargarCatalogos();
    }
  };

  const ajustarFechaRapida = (diasOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + diasOffset);
    const str = d.toISOString().split("T")[0];
    setFecha(str);
    setFormAsignacion((prev) => ({ ...prev, FechaAsignacion: str }));
  };

  const rutaActiva = rutas.find((r) => String(r.IdRutaDistribucion) === String(formAsignacion.IdRutaDistribucion));

  // Zonas únicas para el filtro
  const zonasUnicas = useMemo(() => {
    const setZ = new Set(asignaciones.map((a) => a.NombreZona).filter(Boolean));
    return Array.from(setZ);
  }, [asignaciones]);

  // Opciones para los BuscadorSelect del modal
  const opcionesRutas = useMemo(() => {
    return rutas.map((r) => ({
      value: String(r.IdRutaDistribucion),
      label: r.NombreRuta,
      sublabel: `Zona: ${r.NombreZona}`,
      badge: `${r.TotalPuntosVenta || 0} paradas`,
      icon: <Route className="h-4 w-4" />
    }));
  }, [rutas]);

  const opcionesRepartidores = useMemo(() => {
    return repartidores.map((u) => ({
      value: String(u.IdUsuario),
      label: u.NombreCompleto,
      sublabel: `CI: ${u.Ci} ${u.Celular ? `• Cel: ${u.Celular}` : ""}`,
      badge: "Activo",
      icon: <UserCheck className="h-4 w-4" />
    }));
  }, [repartidores]);

  // Filtrado reactivo en memoria
  const asignacionesFiltradas = useMemo(() => {
    return asignaciones.filter((a) => {
      if (filtroEstado !== "TODOS" && a.Estado !== filtroEstado) return false;
      if (filtroRepartidor !== "TODOS" && String(a.IdUsuarioRepartidor) !== String(filtroRepartidor)) return false;
      if (filtroZona !== "TODAS" && a.NombreZona !== filtroZona) return false;
      if (busquedaTexto.trim()) {
        const query = busquedaTexto.toLowerCase();
        const enRuta = a.NombreRuta?.toLowerCase().includes(query);
        const enRep = a.NombreRepartidor?.toLowerCase().includes(query);
        const enZona = a.NombreZona?.toLowerCase().includes(query);
        const enObs = a.Observacion?.toLowerCase().includes(query);
        if (!enRuta && !enRep && !enZona && !enObs) return false;
      }
      return true;
    });
  }, [asignaciones, filtroEstado, filtroRepartidor, filtroZona, busquedaTexto]);

  // Paginación optimizada de asignaciones
  const paginacion = usePaginacion(asignacionesFiltradas, 10);

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!formAsignacion.IdRutaDistribucion || !formAsignacion.IdUsuarioRepartidor) {
      toast.error("Selecciona la ruta y el repartidor");
      return;
    }

    const partesObservacion = [`Vehículo: ${vehiculoSeleccionado}`];
    if (notaExtra.trim()) {
      partesObservacion.push(notaExtra.trim());
    }

    try {
      setGuardando(true);
      await CrearAsignacion({
        IdRutaDistribucion: Number(formAsignacion.IdRutaDistribucion),
        IdUsuarioRepartidor: Number(formAsignacion.IdUsuarioRepartidor),
        FechaAsignacion: formAsignacion.FechaAsignacion,
        KilometrajeInicial: formAsignacion.KilometrajeInicial ? Number(formAsignacion.KilometrajeInicial) : null,
        Observacion: partesObservacion.join(" ")
      });
      toast.success("¡Despacho programado con éxito!");
      setModalAbierto(false);
      cargarAsignaciones(true); // Refresco automático
    } catch (err) {
      toast.error(err.message || "Error al programar despacho");
    } finally {
      setGuardando(false);
    }
  };

  const abrirGestionarEstado = (asig) => {
    setAsignacionGestionar(asig);
    setNuevoEstado(asig.Estado === "Pendiente" ? "En Ruta" : asig.Estado === "En Ruta" ? "Finalizada" : asig.Estado);
    setKmFinal(asig.KilometrajeFinal ? String(asig.KilometrajeFinal) : "");
    setModalEstadoAbierto(true);
  };

  const cambiarEstadoRapido = async (asig, estadoDestino) => {
    try {
      await ActualizarAsignacion(asig.IdAsignacionRuta, { Estado: estadoDestino });
      toast.success(`Ruta marcada como: ${estadoDestino}`);
      cargarAsignaciones(true); // Refresco automático
    } catch (err) {
      toast.error(err.message || "Error al actualizar estado");
    }
  };

  const handleActualizarEstado = async (e) => {
    e.preventDefault();
    if (!asignacionGestionar) return;

    try {
      setGuardandoEstado(true);
      await ActualizarAsignacion(asignacionGestionar.IdAsignacionRuta, {
        Estado: nuevoEstado,
        KilometrajeFinal: kmFinal ? Number(kmFinal) : null,
      });
      toast.success(`Estado y odómetro guardados`);
      setModalEstadoAbierto(false);
      cargarAsignaciones(true); // Refresco automático
    } catch (err) {
      toast.error(err.message || "Error al actualizar asignación");
    } finally {
      setGuardandoEstado(false);
    }
  };

  const verRutaEnMapa = async (asignacion) => {
    try {
      setRutaMapa(asignacion);
      setModalMapa(true);
      setCargandoMapa(true);
      const detalle = await ObtenerRutaDetalle(asignacion.IdRutaDistribucion);
      setPuntosMapa(detalle.PuntosVenta || []);
    } catch {
      toast.error("Error al cargar itinerario del mapa");
    } finally {
      setCargandoMapa(false);
    }
  };

  const cambiarVista = (nuevaVista, choferData = null) => {
    if (choferData) {
      setChoferAccionRapida(choferData);
    }
    setVistaActiva(nuevaVista);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nuevaVista);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const badgeEstado = (estado) => {
    switch (estado) {
      case "Finalizada":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded text-[11px] px-2 py-0.5">Finalizada</Badge>;
      case "En Ruta":
        return <Badge className="bg-[#1C96C5] hover:bg-[#157A9E] text-white font-medium rounded text-[11px] px-2 py-0.5">En Ruta</Badge>;
      case "Cancelada":
        return <Badge variant="destructive" className="rounded text-[11px] px-2 py-0.5">Cancelada</Badge>;
      default:
        return <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50 font-medium rounded text-[11px] px-2 py-0.5">Pendiente</Badge>;
    }
  };

  const kmRecorridos = (kmFinal && asignacionGestionar?.KilometrajeInicial)
    ? Math.max(0, Number(kmFinal) - Number(asignacionGestionar.KilometrajeInicial)).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      {/* BANDEJA DESTACADA DE SOLICITUDES DE CARGA */}
      <AlertaSolicitudesCargaBanner sucursal={sucursal} onAprobado={() => cargarAsignaciones(true)} />

      {/* 1. Header con botón principal y pestañas unificadas */}
      <PageHeader
        title="Centro Operativo de Reparto y Despachos"
        subtitle="Mesa integral de flota, stock físico en camión, notas de venta en ruta y liquidación de turno"
        branchFilter={
          esVistaChofer ? null : (
            <BranchFilter
              sucursal={sucursal}
              onChange={setSucursal}
              sucursales={sucursalesPermitidas}
              esMultisede={esMultisede}
              permiteTodas={false}
            />
          )
        }
      >
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-[11px] font-medium text-slate-600 border border-slate-200">
            <span className={`h-2 w-2 rounded-full ${wsConectado ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            <span>{wsConectado ? "WebSocket En Vivo" : "Sincronizado"}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cargarAsignaciones(false)}
            disabled={loading}
            className="h-8 text-slate-700 border-slate-300 hover:bg-slate-50 gap-1.5 px-3 font-medium text-xs rounded"
            title="Actualizar despachos manualmente"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#1C96C5]" : ""}`} />
            <span>Actualizar</span>
          </Button>
        </div>

        <a
          href="/supervisor/rutas/rastreo"
          className="inline-flex items-center h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold gap-1.5 transition-colors shadow-none"
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Rastreo GPS</span>
        </a>

        <Button 
          type="button"
          onClick={() => setModalChoferesAbierto(true)} 
          variant="outline"
          className="h-8 text-slate-700 border-slate-300 hover:bg-slate-50 gap-1.5 px-3 font-medium text-xs rounded"
        >
          <Users className="h-3.5 w-3.5 text-[#1C96C5]" />
          <span>Choferes</span>
        </Button>

        <Button 
          onClick={abrirModalProgramar} 
          className="h-8 bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-1.5 transition-all px-3.5 font-semibold text-xs rounded shadow-none"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Nuevo Despacho</span>
        </Button>
      </PageHeader>

      {/* Pestañas de Navegación del Hub de Reparto */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => cambiarVista("despachos")}
          className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 ${
            vistaActiva === "despachos"
              ? "bg-[#1C96C5] text-white border-[#1C96C5]"
              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          <span>Despachos y Salidas</span>
          <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono ${vistaActiva === "despachos" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
            {asignaciones.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => cambiarVista("inventario")}
          className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 ${
            vistaActiva === "inventario"
              ? "bg-[#1C96C5] text-white border-[#1C96C5]"
              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
          }`}
        >
          <Boxes className="h-3.5 w-3.5" />
          <span>Inventario en Camión (Stock)</span>
        </button>

        <button
          type="button"
          onClick={() => cambiarVista("entregas")}
          className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 ${
            vistaActiva === "entregas"
              ? "bg-[#1C96C5] text-white border-[#1C96C5]"
              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
          }`}
        >
          <Receipt className="h-3.5 w-3.5" />
          <span>Entregas en Ruta (NV-501)</span>
        </button>

        <button
          type="button"
          onClick={() => cambiarVista("cierre")}
          className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 ${
            vistaActiva === "cierre"
              ? "bg-[#1C96C5] text-white border-[#1C96C5]"
              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Cierre de Turno y Rendición</span>
        </button>

        <button
          type="button"
          onClick={() => cambiarVista("historial")}
          className={`px-3 py-1.5 text-xs font-semibold rounded border transition-all flex items-center gap-1.5 ${
            vistaActiva === "historial"
              ? "bg-[#1C96C5] text-white border-[#1C96C5]"
              : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Historial de Reparto</span>
        </button>
      </div>

      {vistaActiva === "inventario" && (
        <InventarioCamionTab
          usuario={usuario}
          choferPreseleccionado={choferAccionRapida?.idChofer}
          asignacionPreseleccionada={choferAccionRapida?.asignacion}
          alActualizar={recargarAsignacionesSilencioso}
        />
      )}

      {vistaActiva === "historial" && (
        <HistorialRepartoTab
          usuario={usuario}
          choferPreseleccionado={choferAccionRapida?.idChofer}
          fechaInicial={fecha}
          alActualizar={recargarAsignacionesSilencioso}
        />
      )}

      {vistaActiva === "entregas" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded p-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#1C96C5]" />
              <span>Registrar Entrega / Cobro en Ruta</span>
            </h3>
            <EntregaChoferMovil
              usuario={usuario}
              choferPreseleccionado={choferAccionRapida?.idChofer}
              asignacionPreseleccionada={choferAccionRapida?.asignacion}
              alCompletar={recargarAsignacionesSilencioso}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded p-4 shadow-2xs">
            <div className="border-b border-slate-200 pb-2 mb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1C96C5]" />
                <span>Historial de Entregas y Cobros de la Ruta (Auditoría 1 a 1)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Aprueba, observa o rechaza individualmente cada entrega y cobro realizado por los choferes
              </p>
            </div>
            <HistorialRepartoTab
              usuario={usuario}
              choferPreseleccionado={choferAccionRapida?.idChofer}
              fechaInicial={fecha}
              alActualizar={recargarAsignacionesSilencioso}
            />
          </div>
        </div>
      )}

      {vistaActiva === "cierre" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded p-4 shadow-2xs">
            <CierreTurnoChoferComponent
              usuario={usuario}
              choferPreseleccionado={choferAccionRapida?.idChofer}
              alCompletar={recargarAsignacionesSilencioso}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded p-4 shadow-2xs">
            <div className="border-b border-slate-200 pb-2 mb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Historial de Entregas y Cobros de la Ruta para Liquidación y Cierre</span>
              </h3>
              <p className="text-xs text-slate-500">
                Auditoría obligatoria de cierre: se verifica que 0 operaciones estén en PENDIENTE antes de finalizar la ruta
              </p>
            </div>
            <HistorialRepartoTab
              usuario={usuario}
              choferPreseleccionado={choferAccionRapida?.idChofer}
              fechaInicial={fecha}
              alActualizar={recargarAsignacionesSilencioso}
            />
          </div>
        </div>
      )}

      {vistaActiva === "despachos" && (
        <>
      {/* 2. Tarjetas KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          titulo="Total Despachos"
          valor={asignaciones.length}
          icon={<Truck />}
          variant="default"
        />
        <KpiCard
          titulo="En Ruta"
          valor={asignaciones.filter(a => a.Estado === "En Ruta").length}
          icon={<PlayCircle />}
          variant="sky"
        />
        <KpiCard
          titulo="Finalizados"
          valor={asignaciones.filter(a => a.Estado === "Finalizada").length}
          icon={<CheckCircle />}
          variant="emerald"
        />
        <KpiCard
          titulo="Pendientes"
          valor={asignaciones.filter(a => a.Estado === "Pendiente").length}
          icon={<Clock />}
          variant="amber"
        />
      </div>

      {/* 3. Filtros y Tabla */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col gap-3">
          {/* Fila 1: Selector de Fecha */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#1C96C5]" />
                <span>Fecha:</span>
              </span>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-auto h-9 bg-white border-slate-300 font-semibold text-slate-800 text-sm"
              />
              <div className="inline-flex rounded shadow-2xs border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => ajustarFechaRapida(0)}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    fecha === hoyStr ? "bg-white text-[#1C96C5] shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => ajustarFechaRapida(1)}
                  className="px-3 py-1 rounded font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Mañana
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Mostrando <strong className="text-slate-800">{asignacionesFiltradas.length}</strong> de {asignaciones.length} despachos
            </div>
          </div>

          {/* Fila 2: Filtros Reactivos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
            {/* Buscador de texto */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar ruta, conductor..."
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                className="pl-9 h-9 text-xs bg-white border-slate-200"
              />
            </div>

            {/* Filtro Estado */}
            <div>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full h-9 text-xs rounded border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="Pendiente">Solo Pendientes</option>
                <option value="En Ruta">Solo En Ruta</option>
                <option value="Finalizada">Solo Finalizadas</option>
                <option value="Cancelada">Solo Canceladas</option>
              </select>
            </div>

            {/* Filtro Repartidor */}
            <div>
              <select
                value={filtroRepartidor}
                onChange={(e) => setFiltroRepartidor(e.target.value)}
                className="w-full h-9 text-xs rounded border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
              >
                <option value="TODOS">Todos los Repartidores</option>
                {repartidores.map((r) => (
                  <option key={r.IdUsuario} value={r.IdUsuario}>{r.NombreCompleto}</option>
                ))}
              </select>
            </div>

            {/* Filtro Zona con reset */}
            <div className="flex items-center gap-1.5">
              <select
                value={filtroZona}
                onChange={(e) => setFiltroZona(e.target.value)}
                className="w-full h-9 text-xs rounded border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
              >
                <option value="TODAS">
                  {nombreSucursalActual && !nombreSucursalActual.toLowerCase().includes("todas")
                    ? `Todas las Zonas de ${nombreSucursalActual}`
                    : "Todas las Zonas"}
                </option>
                {zonasUnicas.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>

              {(filtroEstado !== "TODOS" || filtroRepartidor !== "TODOS" || filtroZona !== "TODAS" || busquedaTexto) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFiltroEstado("TODOS");
                    setFiltroRepartidor("TODOS");
                    setFiltroZona("TODAS");
                    setBusquedaTexto("");
                  }}
                  className="h-9 px-2 text-slate-500 hover:text-slate-800"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* 4. Tabla de Asignaciones */}
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4">
              <SkeletonTable
                rows={6}
                cols={7}
                headers={[
                  "Ruta & Zona",
                  "Repartidor Asignado",
                  "Estado",
                  "Km Inicial",
                  "Km Final",
                  "Flota & Observaciones",
                  "Acciones Rápidas",
                ]}
              />
            </div>
          ) : asignacionesFiltradas.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Truck className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-700 font-semibold text-base">No se encontraron despachos con los filtros actuales</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Puedes ajustar los filtros o programar una nueva salida con el botón superior.
              </p>
              <Button onClick={abrirModalProgramar} size="sm" className="bg-[#1C96C5] text-white gap-2">
                <Plus className="h-4 w-4" />
                <span>Programar Despacho</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50/90 text-xs text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Ruta & Zona</th>
                      <th className="px-4 py-3.5">Repartidor Asignado</th>
                      <th className="px-4 py-3.5 text-center">Estado</th>
                      <th className="px-4 py-3.5 text-center">Km Inicial</th>
                      <th className="px-4 py-3.5 text-center">Km Final</th>
                      <th className="px-4 py-3.5">Flota & Observaciones</th>
                      <th className="px-4 py-3.5 text-center">Acciones Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginacion.itemsPaginados.map((a) => (
                      <tr key={a.IdAsignacionRuta} className="hover:bg-sky-50/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{a.NombreRuta}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#1C96C5]" />
                            <span>{a.NombreZona}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            {/* Selector manual de chofer */}
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="h-4 w-4 text-[#1C96C5] shrink-0" />
                              <select
                                value={a.IdUsuarioRepartidor}
                                onChange={(e) => cambiarChoferManualmente(a, e.target.value)}
                                className="h-7 text-xs border border-slate-200 rounded bg-white font-medium text-slate-800 max-w-[170px] truncate"
                                title="Cambiar chofer manualmente para este despacho"
                              >
                                {repartidores.map((r) => (
                                  <option key={r.IdUsuario} value={r.IdUsuario}>
                                    {r.NombreCompleto}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Switch Asignación Automática a este chofer */}
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={plantillasAutomaticas[a.IdRutaDistribucion] === a.IdUsuarioRepartidor}
                                onChange={() => toggleAsignacionAutomatica(a.IdRutaDistribucion, a.IdUsuarioRepartidor)}
                                className="rounded text-[#1C96C5] focus:ring-0 h-3 w-3"
                              />
                              <span className="truncate">Auto-asignar a este chofer</span>
                            </label>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {badgeEstado(a.Estado)}
                        </td>
                        <td className="px-4 py-3.5 text-center text-xs text-slate-700">
                          {a.KilometrajeInicial ? `${a.KilometrajeInicial} km` : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center text-xs text-slate-700">
                          {a.KilometrajeFinal ? (
                            <span className="font-bold text-emerald-600">{a.KilometrajeFinal} km</span>
                          ) : (
                            <span className="text-slate-400 italic">Pendiente</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600 max-w-sm">
                          <div className="line-clamp-2" title={a.Observacion || ""}>
                            {a.Observacion || <span className="text-slate-400 italic">Sin observaciones</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Botón Destacado Centralizado: Gestionar Chofer / Expediente de Ruta */}
                            <Button
                              size="sm"
                              onClick={() => {
                                setChoferParaExpediente({
                                  IdUsuario: a.IdUsuarioRepartidor,
                                  NombreCompleto: a.NombreRepartidor
                                });
                                setAsignacionParaExpediente(a);
                                setModalExpedienteChofer(true);
                              }}
                              className="h-8 px-2.5 text-xs bg-[#1C96C5] hover:bg-[#157A9E] text-white font-semibold gap-1.5 rounded shadow-xs"
                              title={`Gestionar Chofer / Expediente de Ruta para ${a.NombreRepartidor}`}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span className="font-semibold">Gestionar Chofer / Expediente</span>
                            </Button>

                            {/* Botón rápido cambiar a En Ruta si está pendiente */}
                            {a.Estado === "Pendiente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cambiarEstadoRapido(a, "En Ruta")}
                                className="h-8 px-2 text-xs text-[#1C96C5] hover:bg-[#1C96C5]/10 rounded"
                                title="Marcar como En Ruta"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Bandeja de Solicitud de Carga */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAsignacionParaCarga(a);
                                setModalSolicitudCarga(true);
                              }}
                              className="h-8 px-2 text-xs text-sky-800 border-sky-300 hover:bg-sky-50 gap-1 rounded font-medium"
                              title="Revisar solicitud de carga de camión y stock remanente"
                            >
                              <Boxes className="h-3.5 w-3.5 text-[#1C96C5]" />
                              <span>Carga</span>
                            </Button>

                            {/* Reasignar paradas pendientes a otro chofer */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAsignacionParaReasignar(a);
                                setModalReasignarParadas(true);
                              }}
                              className="h-8 px-2 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 gap-1 rounded font-medium"
                              title="Reasignar paradas pendientes a otro chofer"
                            >
                              <Users className="h-3.5 w-3.5 text-amber-600" />
                              <span>Reasignar</span>
                            </Button>

                            {/* Editor dinámico de paradas 1..N */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAsignacionParaEditarParadas(a);
                                setModalEditorParadas(true);
                              }}
                              className="h-8 px-2 text-xs text-slate-800 border-slate-300 hover:bg-slate-50 gap-1 rounded font-medium"
                              title="Editar orden secuencial 1..N, agregar o mover paradas"
                            >
                              <Route className="h-3.5 w-3.5 text-slate-600" />
                              <span>Paradas 1..N</span>
                            </Button>

                            {/* Consultar Stock Físico en Camión */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                cambiarVista("inventario", {
                                  idChofer: a.IdUsuarioRepartidor,
                                  nombreChofer: a.NombreRepartidor,
                                  asignacion: a
                                });
                              }}
                              className="h-8 px-2 text-xs text-slate-800 border-slate-300 hover:bg-slate-50 gap-1 rounded font-medium"
                              title={`Consultar inventario cargado en el camión de ${a.NombreRepartidor}`}
                            >
                              <Boxes className="h-3.5 w-3.5 text-[#1C96C5]" />
                              <span>Stock</span>
                            </Button>

                            {/* Registrar Entrega / Nota de Venta */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                cambiarVista("entregas", {
                                  idChofer: a.IdUsuarioRepartidor,
                                  nombreChofer: a.NombreRepartidor,
                                  asignacion: a
                                });
                              }}
                              className="h-8 px-2 text-xs text-[#1C96C5] border-[#1C96C5]/40 hover:bg-[#1C96C5]/10 gap-1 rounded font-medium"
                              title={`Registrar entrega / Nota de Venta para ${a.NombreRepartidor}`}
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              <span>Entrega</span>
                            </Button>

                            {/* Cierre de Jornada y Rendición */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                cambiarVista("cierre", {
                                  idChofer: a.IdUsuarioRepartidor,
                                  nombreChofer: a.NombreRepartidor,
                                  asignacion: a
                                });
                              }}
                              className="h-8 px-2 text-xs text-slate-800 border-slate-300 hover:bg-slate-50 gap-1 rounded font-medium"
                              title={`Cierre de jornada y rendición para ${a.NombreRepartidor}`}
                            >
                              <Clock className="h-3.5 w-3.5 text-slate-600" />
                              <span>Cierre</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setHojaRutaAsignacion(a)}
                              className="h-8 px-2 text-xs text-slate-700 border-slate-300 hover:bg-slate-50 gap-1 rounded"
                              title="Imprimir Hoja de Ruta Oficial para el Chofer"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-500" />
                              <span>Planilla</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verRutaEnMapa(a)}
                              className="h-8 px-2 text-xs text-[#1C96C5] border-slate-300 hover:bg-[#1C96C5]/10 gap-1 rounded"
                              title="Ver paradas de la ruta en mapa satelital OSRM"
                            >
                              <MapIcon className="h-3.5 w-3.5" />
                              <span>Mapa</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirGestionarEstado(a)}
                              className="h-8 px-2 text-xs text-slate-700 border-slate-300 hover:bg-slate-50 gap-1 rounded"
                              title="Gestionar estado y registrar odómetro final"
                            >
                              <Gauge className="h-3.5 w-3.5 text-slate-500" />
                              <span>Control</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación de despachos */}
              <PaginacionTabla {...paginacion} />
            </>
          )}
        </CardContent>
      </Card>
      </>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: PROGRAMAR DESPACHO (AMPLIO, CON BUSCADORSELECT)       */}
      {/* ============================================================== */}
      {modalAbierto && (
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#1C96C5]" />
              <span>Nuevo Despacho</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrear} className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">
                  Ruta *
                </Label>
                <BuscadorSelect
                  options={opcionesRutas}
                  value={formAsignacion.IdRutaDistribucion}
                  onChange={(val) => setFormAsignacion({ ...formAsignacion, IdRutaDistribucion: val })}
                  placeholder="Seleccionar ruta..."
                  searchPlaceholder="Buscar ruta..."
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">
                  Conductor / Repartidor *
                </Label>
                <BuscadorSelect
                  options={opcionesRepartidores}
                  value={formAsignacion.IdUsuarioRepartidor}
                  onChange={(val) => setFormAsignacion({ ...formAsignacion, IdUsuarioRepartidor: val })}
                  placeholder="Seleccionar conductor..."
                  searchPlaceholder="Buscar conductor..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">
                  Vehículo (Placa)
                </Label>
                <BuscadorSelect
                  options={FLOTA_VEHICULOS}
                  value={vehiculoSeleccionado}
                  onChange={(val) => setVehiculoSeleccionado(val)}
                  placeholder="Seleccionar vehículo..."
                  searchPlaceholder="Buscar vehículo..."
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">Fecha</Label>
                <Input
                  type="date"
                  value={formAsignacion.FechaAsignacion}
                  onChange={(e) => setFormAsignacion({ ...formAsignacion, FechaAsignacion: e.target.value })}
                  required
                  className="bg-white border-slate-300 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">Odómetro Inicial (Km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={formAsignacion.KilometrajeInicial}
                  onChange={(e) => setFormAsignacion({ ...formAsignacion, KilometrajeInicial: e.target.value })}
                  className="bg-white border-slate-300 h-9 text-xs "
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-1">
                Observaciones
              </Label>
              <Input
                placeholder="Instrucciones o notas del despacho..."
                value={notaExtra}
                onChange={(e) => setNotaExtra(e.target.value)}
                className="text-xs bg-white border-slate-300 h-9"
              />
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                size="sm"
                className="bg-[#1C96C5] hover:bg-[#157A9E] text-white px-5 font-semibold"
                disabled={guardando || repartidores.length === 0}
              >
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Despacho
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: GESTIONAR ESTADO / ODÓMETRO FINAL                    */}
      {/* ============================================================== */}
      {modalEstadoAbierto && (
      <Dialog open={modalEstadoAbierto} onOpenChange={setModalEstadoAbierto}>
        <DialogContent className="w-full sm:max-w-3xl p-6 sm:p-8">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-[#1C96C5]" />
              <span>Control de Despacho y Odómetro</span>
            </DialogTitle>
            {asignacionGestionar && (
              <p className="text-xs text-slate-500 mt-1">
                Ruta: <strong className="text-slate-800">{asignacionGestionar.NombreRuta}</strong> • Conductor: <strong className="text-slate-800">{asignacionGestionar.NombreRepartidor}</strong>
              </p>
            )}
          </DialogHeader>

          <form onSubmit={handleActualizarEstado} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Estado del Despacho</Label>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                className="mt-1 w-full text-sm rounded border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-2xs font-medium"
              >
                <option value="Pendiente">Pendiente (En espera de salida)</option>
                <option value="En Ruta">En Ruta (Vehículo en tránsito)</option>
                <option value="Finalizada">Finalizada (Ruta y entregas concluidas)</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded border border-slate-200">
              <div className="flex flex-col justify-center">
                <span className="text-[11px] text-slate-500 block font-medium">Km Inicial:</span>
                <span className="text-base font-bold text-slate-800 mt-1">
                  {asignacionGestionar?.KilometrajeInicial ? `${asignacionGestionar.KilometrajeInicial} km` : "Sin dato"}
                </span>
              </div>
              <div>
                <Label className="text-[11px] text-slate-700 font-semibold block">Km Final de Llegada:</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ej. 45248.0"
                  value={kmFinal}
                  onChange={(e) => setKmFinal(e.target.value)}
                  className="mt-1 h-9 text-sm bg-white font-bold text-emerald-700"
                />
              </div>
              <div className="flex flex-col justify-center bg-white p-2.5 rounded border border-slate-200">
                <span className="text-[11px] text-slate-500 block font-medium">Distancia Recorrida:</span>
                <span className={`text-base font-bold mt-1 ${kmRecorridos ? "text-emerald-600" : "text-slate-400"}`}>
                  {kmRecorridos ? `${kmRecorridos} km` : "Pendiente"}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setModalEstadoAbierto(false)}>
                Cerrar
              </Button>
              <Button type="submit" className="bg-[#1C96C5] hover:bg-[#157A9E] text-white px-6 font-semibold" disabled={guardandoEstado}>
                {guardandoEstado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Control
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: MAPA GPS DE LA RUTA ASIGNADA (AMPLIO, OSRM VIAL)     */}
      {/* ============================================================== */}
      {modalMapa && (
      <Dialog open={modalMapa} onOpenChange={setModalMapa}>
        <DialogContent className="w-full sm:max-w-6xl max-h-[95vh] overflow-y-auto p-6 sm:p-7">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-xl font-bold text-[#1C96C5] flex items-center gap-2">
              <MapIcon className="h-6 w-6 text-[#1C96C5]" />
              <span>Mapa GPS Vial: {rutaMapa?.NombreRuta}</span>
            </DialogTitle>
            {rutaMapa && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                <span>Zona: <strong className="text-slate-800">{rutaMapa.NombreZona}</strong></span>
                <span>•</span>
                <span>Repartidor: <strong className="text-slate-800">{rutaMapa.NombreRepartidor}</strong></span>
                <span>•</span>
                <span>Estado: <strong className="text-sky-600">{rutaMapa.Estado}</strong></span>
                <span>•</span>
                <span>Fecha: <strong className="text-slate-700">{rutaMapa.FechaAsignacion}</strong></span>
              </div>
            )}
          </DialogHeader>

          {cargandoMapa ? (
            <div className="py-24 flex flex-col justify-center items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-[#1C96C5]" />
              <p className="text-sm font-medium text-slate-600">
                Calculando trazado vial por calles de {Number(sucursal) === 2 ? "Potosí" : "Sucre"} (OSRM)...
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <MapaRuta
                puntosRuta={puntosMapa}
                todosPuntosVenta={todosPV}
                rutaSeleccionada={rutaMapa}
                idSucursal={sucursal}
                altura="h-[620px]"
              />

              {/* Paradas ordenadas */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Itinerario de Visitas en {Number(sucursal) === 2 ? "Potosí" : "Sucre"} ({puntosMapa.length} paradas):
                </div>
                {puntosMapa.length === 0 ? (
                  <p className="italic text-xs text-slate-400">Esta ruta aún no tiene puntos de venta asociados.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {puntosMapa.map((p, i) => (
                      <span 
                        key={p.IdPuntoVenta} 
                        className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs text-xs text-slate-800"
                      >
                        <span className="font-extrabold text-[#1C96C5]">#{p.OrdenVisita}</span>
                        <span className="font-medium">{p.NombreCliente}</span>
                        <span className="text-[11px] text-slate-400 ">({p.NombrePuntoVenta})</span>
                        {i < puntosMapa.length - 1 && (
                          <span className="text-slate-300 font-bold ml-1">·</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL GESTIÓN DE CHOFERES */}
      {modalChoferesAbierto && (
        <GestionChoferesModal
          abierto={modalChoferesAbierto}
          onCerrar={() => setModalChoferesAbierto(false)}
          onActualizado={() => {
            precargarCatalogos();
            cargarAsignaciones(true);
          }}
        />
      )}

      {/* MODAL HOJA DE RUTA IMPRIMIBLE */}
      {hojaRutaAsignacion !== null && (
        <HojaDeRutaModal
          asignacion={hojaRutaAsignacion}
          abierto={hojaRutaAsignacion !== null}
          onCerrar={() => setHojaRutaAsignacion(null)}
        />
      )}

      {/* MODAL ENTREGA Y NOTA DE VENTA */}
      {modalEntregaAbierto && (
        <Dialog open={modalEntregaAbierto} onOpenChange={setModalEntregaAbierto}>
          <DialogContent className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto p-3 sm:p-5">
            <EntregaChoferMovil
              usuario={usuario}
              choferPreseleccionado={choferAccionRapida?.idChofer}
              asignacionPreseleccionada={choferAccionRapida?.asignacion}
              enModal={true}
              alCompletar={() => {
                setModalEntregaAbierto(false);
                cargarAsignaciones(true);
              }}
              onCerrar={() => setModalEntregaAbierto(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL CIERRE DE TURNO Y ARQUEO */}
      {modalCierreAbierto && (
        <Dialog open={modalCierreAbierto} onOpenChange={setModalCierreAbierto}>
          <DialogContent className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto p-3 sm:p-5">
            <CierreTurnoChoferComponent
              usuario={usuario}
              choferPreseleccionado={choferAccionRapida?.idChofer}
              enModal={true}
              alCompletar={() => {
                setModalCierreAbierto(false);
                cargarAsignaciones(true);
              }}
              onCerrar={() => setModalCierreAbierto(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL EDITOR DINÁMICO DE PARADAS 1..N */}
      <EditorParadasDinamicoModal
        abierto={modalEditorParadas}
        onOpenChange={setModalEditorParadas}
        asignacion={asignacionParaEditarParadas}
        todosPuntosVenta={todosPV}
        sucursal={sucursal}
        alGuardar={() => {
          cargarAsignaciones(true);
        }}
      />

      {/* MODAL REASIGNAR PARADAS PENDIENTES */}
      <ModalReasignarParadas
        abierto={modalReasignarParadas}
        onOpenChange={setModalReasignarParadas}
        asignacion={asignacionParaReasignar}
        repartidores={repartidores}
        alCompletar={() => {
          cargarAsignaciones(true);
        }}
      />

      {/* MODAL BANDEJA SOLICITUD DE CARGA DE CAMIÓN */}
      <BandejaSolicitudCargaModal
        abierto={modalSolicitudCarga}
        onOpenChange={setModalSolicitudCarga}
        asignacion={asignacionParaCarga}
        alAprobar={() => {
          cargarAsignaciones(true);
        }}
        alResolver={() => {
          cargarAsignaciones(true);
        }}
      />

      {/* MODAL CENTRALIZADO: EXPEDIENTE DE RUTA Y CONTROL DEL CHOFER */}
      {modalExpedienteChofer && (
        <ExpedienteChoferModal
          abierto={modalExpedienteChofer}
          onOpenChange={setModalExpedienteChofer}
          chofer={choferParaExpediente}
          asignacion={asignacionParaExpediente}
          fecha={fecha}
          usuario={usuario}
          alActualizar={() => {
            cargarAsignaciones(true);
          }}
          onAbrirEditorParadas={(asig) => {
            setAsignacionParaEditarParadas(asig);
            setModalEditorParadas(true);
          }}
        />
      )}
    </div>
  );
}