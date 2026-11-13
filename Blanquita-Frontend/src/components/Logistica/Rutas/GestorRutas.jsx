import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import { 
  ObtenerZonas, 
  CrearZona, 
  ObtenerRutas, 
  CrearRuta, 
  ObtenerRutaDetalle, 
  GuardarPuntosVentaRuta,
  ObtenerRepartidores,
  ObtenerAsignaciones,
  CrearAsignacion,
  SolicitarUbicacionActualChoferes
} from "@/services/Logistica/RutaService";
import { ObtenerTodosPuntosVenta } from "@/services/Logistica/ClienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  MapPin, 
  Route, 
  Plus, 
  Loader2, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Map as MapIcon, 
  ListOrdered, 
  Navigation,
  Search,
  Store,
  Radio,
  Lock,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Truck,
  UserCheck,
  Clock,
  Boxes,
  FileText,
  CheckCircle2,
  ArrowRightLeft
} from "lucide-react";
import MapaRuta from "./MapaRuta";
import BuscadorSelect from "../Common/BuscadorSelect";
import MapaSelectorUbicacion from "../Common/MapaSelectorUbicacion";
import AlertaSolicitudesCargaBanner from "../Reparto/AlertaSolicitudesCargaBanner";
import EditorParadasDinamicoModal from "./EditorParadasDinamicoModal";
import ModalReasignarParadas from "./ModalReasignarParadas";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";
import { logisticaSocket } from "@/services/Logistica/LogisticaWebSocket";

const DIAS_SEMANA = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo"
};

const OPCIONES_DIAS = Object.entries(DIAS_SEMANA).map(([num, nom]) => ({
  value: num,
  label: nom,
  sublabel: `Día de reparto semanal`
}));

export default function GestorRutas({ usuario = null }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance, listoParaConsultar } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [zonas, setZonas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selector de fecha de rutas (Rutas de Hoy vs Rutas Históricas)
  const hoyStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [fechaFiltro, setFechaFiltro] = useState(hoyStr);
  const [repartidores, setRepartidores] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);

  // Plantillas automáticas de chofer por ruta (localStorage)
  const [plantillasAuto, setPlantillasAuto] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const g = localStorage.getItem("blanquita_rutas_plantilla_auto");
        return g ? JSON.parse(g) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const toggleAsignacionAutomatica = (idRuta, idChofer) => {
    const copia = { ...plantillasAuto };
    if (copia[idRuta] === idChofer) {
      delete copia[idRuta];
      toast.info("Asignación automática deshabilitada para esta ruta");
    } else {
      copia[idRuta] = idChofer;
      toast.success("Plantilla guardada: este chofer se asignará automáticamente a esta ruta");
    }
    setPlantillasAuto(copia);
    if (typeof window !== "undefined") {
      localStorage.setItem("blanquita_rutas_plantilla_auto", JSON.stringify(copia));
    }
  };

  // Modales
  const [modalEditorParadas, setModalEditorParadas] = useState(false);
  const [modalAsignarRuta, setModalAsignarRuta] = useState(false);
  const [rutaParaAsignar, setRutaParaAsignar] = useState(null);
  const [choferAsignarId, setChoferAsignarId] = useState("");
  const [kmInicialAsignar, setKmInicialAsignar] = useState("45120");
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [modalReasignar, setModalReasignar] = useState(false);
  const [asignacionParaReasignar, setAsignacionParaReasignar] = useState(null);
  const [solicitandoGps, setSolicitandoGps] = useState(false);

  const solicitarUbicacionGPS = async () => {
    try {
      setSolicitandoGps(true);
      await SolicitarUbicacionActualChoferes(sucursal);
      toast.success("Solicitud de señal GPS emitida bajo demanda a todos los choferes");
    } catch (err) {
      toast.error(err.message || "Error al solicitar telemetría");
    } finally {
      setSolicitandoGps(false);
    }
  };

  // Filtros del panel izquierdo de rutas
  const [filtroZona, setFiltroZona] = useState("TODAS");
  const [filtroDia, setFiltroDia] = useState("TODOS");
  const [busquedaRuta, setBusquedaRuta] = useState("");

  // Modal Zona
  const [modalZona, setModalZona] = useState(false);
  const [nuevaZona, setNuevaZona] = useState({ NombreZona: "", Descripcion: "" });
  const [zonaCoords, setZonaCoords] = useState({ lat: -19.0345, lng: -65.2530 });

  // Modal Ruta
  const [modalRuta, setModalRuta] = useState(false);
  const [nuevaRuta, setNuevaRuta] = useState({
    IdZonaDistribucion: "",
    NombreRuta: "",
    DiaSemana: 1,
    Descripcion: ""
  });

  // Itinerario seleccionado
  const [rutaSeleccionada, setRutaSeleccionada] = useState(null);
  const rutaSeleccionadaRef = useRef(null);
  useEffect(() => {
    rutaSeleccionadaRef.current = rutaSeleccionada;
  }, [rutaSeleccionada]);

  const [puntosRuta, setPuntosRuta] = useState([]);
  const [subTabRuta, setSubTabRuta] = useState("mapa");
  const [todosPuntosVenta, setTodosPuntosVenta] = useState([]);
  const [guardandoItinerario, setGuardandoItinerario] = useState(false);

  // Selector para agregar paradas con BuscadorSelect
  const [puntoSeleccionadoParaAgregar, setPuntoSeleccionadoParaAgregar] = useState("");

  const seleccionarRuta = useCallback(async (r) => {
    setRutaSeleccionada(r);
    try {
      const detalle = await ObtenerRutaDetalle(r.IdRutaDistribucion);
      const puntos = detalle.PuntosVenta || [];

      // Enriquecer paradas con pedidos programados y frecuencias
      let paradasConfig = {};
      if (typeof window !== "undefined") {
        try {
          const g = localStorage.getItem("blanquita_paradas_config");
          if (g) paradasConfig = JSON.parse(g);
        } catch {}
      }

      const enriquecidos = puntos.map((p, idx) => {
        const pvId = p.IdPuntoVenta || p.id_punto_venta;
        const cfg = paradasConfig[pvId] || {};
        return {
          ...p,
          frecuencia: p.frecuencia || p.Frecuencia || cfg.frecuencia || "DIARIO",
          productosHabituales: p.productosHabituales || p.ProductosHabituales || cfg.productosHabituales || "Papel Higiénico Clásico (20 paq), Servilletas (10 fardos)",
          OrdenVisita: p.OrdenVisita || idx + 1
        };
      });

      setPuntosRuta(enriquecidos);
    } catch {
      setPuntosRuta([]);
    }
  }, []);

  // Escuchar actualizaciones de configuración de paradas para refrescar reactivamente
  useEffect(() => {
    const handleConfigUpdate = () => {
      if (rutaSeleccionadaRef.current) {
        seleccionarRuta(rutaSeleccionadaRef.current);
      }
    };
    window.addEventListener("blanquita:paradas-config-updated", handleConfigUpdate);
    return () => window.removeEventListener("blanquita:paradas-config-updated", handleConfigUpdate);
  }, [seleccionarRuta]);

  const cargarDatos = useCallback(async (silencioso = false, forzar = false) => {
    try {
      const sid = (!sucursal || sucursal === "todas") ? null : sucursal;
      if (!silencioso) setLoading(true);

      const [resZ, resR, resPv, resRep, resAsig] = await Promise.allSettled([
        ObtenerZonas(sid),
        ObtenerRutas(null, sid),
        ObtenerTodosPuntosVenta(sid),
        ObtenerRepartidores(sid),
        ObtenerAsignaciones(fechaFiltro, null, sid)
      ]);
      const z = resZ.status === "fulfilled" && Array.isArray(resZ.value) ? resZ.value : [];
      const r = resR.status === "fulfilled" && Array.isArray(resR.value) ? resR.value : [];
      const pv = resPv.status === "fulfilled" && Array.isArray(resPv.value) ? resPv.value : [];
      const rep = resRep.status === "fulfilled" && Array.isArray(resRep.value) ? resRep.value : [];
      const asig = resAsig.status === "fulfilled" ? (Array.isArray(resAsig.value) ? resAsig.value : resAsig.value?.items || []) : [];

      setZonas(z);
      setRutas(r);
      setTodosPuntosVenta(pv);
      setRepartidores(rep);
      setAsignaciones(asig);

      if (r.length > 0 && (!rutaSeleccionadaRef.current || !r.some(item => item.IdRutaDistribucion === rutaSeleccionadaRef.current.IdRutaDistribucion))) {
        seleccionarRuta(r[0]);
      } else if (r.length === 0) {
        setRutaSeleccionada(null);
        setPuntosRuta([]);
      }
    } catch (err) {
      if (!silencioso) toast.error(err.message || "Error al cargar rutas y zonas");
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [sucursal, fechaFiltro, seleccionarRuta]);

  const [wsConectado, setWsConectado] = useState(false);

  // Carga reactiva al cambiar sucursal o fecha bloqueada si no está listoParaConsultar
  useEffect(() => {
    if (listoParaConsultar) {
      cargarDatos(false, true);
    }
  }, [sucursal, fechaFiltro, listoParaConsultar, cargarDatos]);

  // WebSocket en tiempo real + Escucha de 'blanquita:ws-event'
  useEffect(() => {
    logisticaSocket.conectar();
    const unsubEstado = logisticaSocket.onEstadoConexion(setWsConectado);

    const unsubReorden = logisticaSocket.suscribir("ruta_reordenada", () => {
      cargarDatos(true);
    });

    const unsubCarga = logisticaSocket.suscribir("solicitud_carga_recibida", () => {
      cargarDatos(true);
    });

    const handleCustomWs = (e) => {
      cargarDatos(true);
    };
    window.addEventListener("blanquita:ws-event", handleCustomWs);

    const handleFocus = () => cargarDatos(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubEstado();
      unsubReorden();
      unsubCarga();
      window.removeEventListener("blanquita:ws-event", handleCustomWs);
      window.removeEventListener("focus", handleFocus);
    };
  }, [cargarDatos]);

  // Opciones para BuscadorSelect de Zonas
  const opcionesZonas = useMemo(() => {
    return zonas.map((z) => ({
      value: String(z.IdZonaDistribucion),
      label: z.NombreZona,
      sublabel: z.Descripcion || "Zona urbana Sucre",
      icon: <MapPin className="h-4 w-4" />
    }));
  }, [zonas]);

  // Opciones de comercios para agregar a la ruta con selector rápido
  const opcionesPuntosVentaDisponibles = useMemo(() => {
    const idsEnRuta = new Set(puntosRuta.map((p) => p.IdPuntoVenta));
    return todosPuntosVenta
      .filter((p) => !idsEnRuta.has(p.IdPuntoVenta))
      .map((pv) => ({
        value: String(pv.IdPuntoVenta),
        label: pv.NombreCliente,
        sublabel: `${pv.NombrePuntoVenta} • ${pv.Direccion}`,
        badge: pv.Latitud && pv.Longitud ? "GPS OK" : "Sin GPS",
        icon: <Store className="h-4 w-4" />
      }));
  }, [todosPuntosVenta, puntosRuta]);

  // Filtrado de rutas en memoria
  const rutasFiltradas = useMemo(() => {
    return rutas.filter((r) => {
      if (filtroZona !== "TODAS" && String(r.IdZonaDistribucion) !== String(filtroZona)) return false;
      if (filtroDia !== "TODOS" && String(r.DiaSemana) !== String(filtroDia)) return false;
      if (busquedaRuta.trim()) {
        const q = busquedaRuta.toLowerCase();
        const enNombre = r.NombreRuta?.toLowerCase().includes(q);
        const enZona = r.NombreZona?.toLowerCase().includes(q);
        if (!enNombre && !enZona) return false;
      }
      return true;
    });
  }, [rutas, filtroZona, filtroDia, busquedaRuta]);

  const paginacionRutas = usePaginacion(rutasFiltradas, 6);

  const handleCrearZona = async (e) => {
    e.preventDefault();
    if (!nuevaZona.NombreZona.trim()) return;
    try {
      await CrearZona(nuevaZona);
      cache.invalidate("logistica:zonas");
      toast.success("Zona creada con éxito");
      setNuevaZona({ NombreZona: "", Descripcion: "" });
      setModalZona(false);
      cargarDatos(false, true);
    } catch (err) {
      toast.error(err.message || "Error al crear zona");
    }
  };

  const handleCrearRuta = async (e) => {
    e.preventDefault();
    if (!nuevaRuta.NombreRuta.trim() || !nuevaRuta.IdZonaDistribucion) {
      toast.error("Nombre de ruta y zona son obligatorios");
      return;
    }
    try {
      await CrearRuta({
        ...nuevaRuta,
        IdZonaDistribucion: Number(nuevaRuta.IdZonaDistribucion),
        DiaSemana: Number(nuevaRuta.DiaSemana)
      });
      cache.invalidate("logistica:rutas");
      toast.success("Ruta creada con éxito");
      setNuevaRuta({ IdZonaDistribucion: "", NombreRuta: "", DiaSemana: 1, Descripcion: "" });
      setModalRuta(false);
      cargarDatos(false, true);
    } catch (err) {
      toast.error(err.message || "Error al crear ruta");
    }
  };

  const agregarPuntoDesdeSelector = (idPv) => {
    if (!idPv) return;
    const pvObj = todosPuntosVenta.find((p) => String(p.IdPuntoVenta) === String(idPv));
    if (!pvObj) return;

    if (puntosRuta.some((p) => p.IdPuntoVenta === pvObj.IdPuntoVenta)) {
      toast.info("Este punto de venta ya está en la ruta");
      return;
    }

    const nuevoItem = {
      IdPuntoVenta: pvObj.IdPuntoVenta,
      NombrePuntoVenta: pvObj.NombrePuntoVenta,
      NombreCliente: pvObj.NombreCliente,
      Direccion: pvObj.Direccion,
      Latitud: pvObj.Latitud,
      Longitud: pvObj.Longitud,
      OrdenVisita: puntosRuta.length + 1
    };
    setPuntosRuta([...puntosRuta, nuevoItem]);
    setPuntoSeleccionadoParaAgregar("");
    toast.success(`Parada #${nuevoItem.OrdenVisita} agregada: ${pvObj.NombreCliente}`);
  };

  const moverParada = (index, direccion) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= puntosRuta.length) return;
    const copia = [...puntosRuta];
    const temp = copia[index];
    copia[index] = copia[nuevoIndex];
    copia[nuevoIndex] = temp;
    copia.forEach((item, idx) => {
      item.OrdenVisita = idx + 1;
    });
    setPuntosRuta(copia);
  };

  const eliminarParada = (index) => {
    const objetivo = puntosRuta[index];
    const esEjecutada = Boolean(
      objetivo.esEjecutada ||
      objetivo.Entregado ||
      objetivo.Cobrado ||
      objetivo.Estado === "Entregado" ||
      objetivo.Estado === "Cobrado"
    );
    if (esEjecutada) {
      toast.error("Parada ya ejecutada hoy: no se puede eliminar");
      return;
    }

    const filtrado = puntosRuta.filter((_, idx) => idx !== index);
    filtrado.forEach((item, idx) => {
      item.OrdenVisita = idx + 1;
    });
    setPuntosRuta(filtrado);
  };

  const guardarItinerario = async () => {
    if (!rutaSeleccionada) return;
    try {
      setGuardandoItinerario(true);
      await GuardarPuntosVentaRuta(
        rutaSeleccionada.IdRutaDistribucion,
        puntosRuta.map((p) => ({
          IdPuntoVenta: p.IdPuntoVenta,
          OrdenVisita: p.OrdenVisita
        }))
      );
      toast.success("Itinerario de ruta guardado con éxito");
      cargarDatos(true);
    } catch (err) {
      toast.error(err.message || "Error al guardar paradas");
    } finally {
      setGuardandoItinerario(false);
    }
  };

  const handleCrearAsignacionRapida = async (e) => {
    e.preventDefault();
    if (!rutaParaAsignar || !choferAsignarId) {
      toast.error("Selecciona un chofer para la asignación");
      return;
    }
    try {
      setGuardandoAsignacion(true);
      await CrearAsignacion({
        IdRutaDistribucion: Number(rutaParaAsignar.IdRutaDistribucion),
        IdUsuarioRepartidor: Number(choferAsignarId),
        FechaAsignacion: fechaFiltro,
        KilometrajeInicial: kmInicialAsignar ? Number(kmInicialAsignar) : 45120,
        Observacion: `Asignación programada desde Centro de Control (${fechaFiltro})`
      });
      toast.success(`¡Ruta asignada a chofer para el día ${fechaFiltro}!`);
      setModalAsignarRuta(false);
      cargarDatos(true);
    } catch (err) {
      toast.error(err.message || "Error al asignar ruta");
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 0. BANDEJA DESTACADA DE SOLICITUDES DE CARGA */}
      <AlertaSolicitudesCargaBanner sucursal={sucursal} onAprobado={() => cargarDatos(true)} />

      {/* 1. Header con botones de creación y GPS bajo demanda */}
      <PageHeader
        title="Rutas y Zonas de Distribución"
        subtitle="Configuración vial, paradas secuenciales 1..N y georreferenciación de itinerarios de distribución."
        branchFilter={
          <BranchFilter
            sucursal={sucursal}
            onChange={setSucursal}
            sucursales={sucursalesPermitidas}
            esMultisede={esMultisede}
            permiteTodas={true}
          />
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
            onClick={() => cargarDatos(false, true)}
            disabled={loading}
            className="h-8 text-slate-700 border-slate-300 hover:bg-slate-50 gap-1.5 px-3 font-medium text-xs rounded"
            title="Actualizar catálogo de rutas y zonas"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#1C96C5]" : ""}`} />
            <span>Actualizar</span>
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={solicitarUbicacionGPS}
          disabled={solicitandoGps}
          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold px-3 rounded text-xs shadow-none"
          title="Emitir ping de telemetría satelital a los choferes"
        >
          <Navigation className={`h-3.5 w-3.5 shrink-0 ${solicitandoGps ? "animate-spin" : ""}`} />
          <span>Solicitar Ubicación Actual de Todos los Choferes</span>
        </Button>

        <a
          href="/supervisor/rutas/rastreo"
          className="inline-flex items-center h-8 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold gap-1.5 transition-colors shadow-none"
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Ver Mapa GPS</span>
        </a>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setModalZona(true)} 
          className="h-8 text-slate-700 border-slate-300 gap-1.5 font-medium text-xs rounded"
        >
          <Plus className="h-3.5 w-3.5 text-[#1C96C5]" />
          <span>Nueva Zona</span>
        </Button>
        <Button 
          size="sm"
          onClick={() => {
            setNuevaRuta({
              IdZonaDistribucion: zonas.length > 0 ? String(zonas[0].IdZonaDistribucion) : "",
              NombreRuta: "",
              DiaSemana: 1,
              Descripcion: ""
            });
            setModalRuta(true);
          }} 
          className="h-8 bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-1.5 font-semibold px-3 rounded text-xs shadow-none"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Ruta</span>
        </Button>
      </PageHeader>

      {/* BARRA SUPERIOR DE SELECTOR DE FECHA (RUTAS DE HOY, FUTURAS Y PROGRAMADAS) */}
      <div className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[#1C96C5]" />
            <span>Itinerario y Despachos:</span>
          </span>
          <Input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            className="w-auto h-8 text-xs font-semibold bg-white border-slate-300"
          />
          <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFechaFiltro(hoyStr)}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                fechaFiltro === hoyStr
                  ? "bg-white text-[#1C96C5] font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const m = new Date();
                m.setDate(m.getDate() + 1);
                setFechaFiltro(m.toISOString().split("T")[0]);
              }}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                (() => {
                  const m = new Date();
                  m.setDate(m.getDate() + 1);
                  return fechaFiltro === m.toISOString().split("T")[0];
                })()
                  ? "bg-white text-[#1C96C5] font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mañana (+1d)
            </button>
            <button
              type="button"
              onClick={() => {
                const m = new Date();
                m.setDate(m.getDate() + 2);
                setFechaFiltro(m.toISOString().split("T")[0]);
              }}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                (() => {
                  const m = new Date();
                  m.setDate(m.getDate() + 2);
                  return fechaFiltro === m.toISOString().split("T")[0];
                })()
                  ? "bg-white text-[#1C96C5] font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pasado (+2d)
            </button>
            <button
              type="button"
              onClick={() => {
                const m = new Date();
                m.setDate(m.getDate() + 7);
                setFechaFiltro(m.toISOString().split("T")[0]);
              }}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                (() => {
                  const m = new Date();
                  m.setDate(m.getDate() + 7);
                  return fechaFiltro === m.toISOString().split("T")[0];
                })()
                  ? "bg-white text-[#1C96C5] font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Próx. Semana (+7d)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Fecha activa: <strong className="text-slate-800 font-mono">{fechaFiltro}</strong></span>
          {fechaFiltro === hoyStr ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
              Hoy (Reparto en Vivo)
            </Badge>
          ) : fechaFiltro > hoyStr ? (
            <Badge className="bg-sky-100 text-[#1C96C5] border-sky-300 text-[10px] font-semibold">
              Rutas Futuras & Pedidos Programados
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-600 bg-slate-100 border-slate-300 text-[10px]">
              Historial Pasado
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* PANEL IZQUIERDO: Filtros y Lista de Rutas */}
        <div className="lg:col-span-4 space-y-4">
          <div className="border border-slate-200 bg-white rounded overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Route className="h-4 w-4 text-[#1C96C5]" />
                  <span>Rutas de Reparto</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
                  {rutasFiltradas.length} / {rutas.length}
                </span>
              </div>

              {/* Buscador de rutas */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <Input
                  placeholder="Buscar por nombre o zona..."
                  value={busquedaRuta}
                  onChange={(e) => setBusquedaRuta(e.target.value)}
                  className="pl-8 h-8 text-xs bg-white border-slate-300 rounded"
                />
              </div>

              {/* Filtros de Zona y Día */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filtroZona}
                  onChange={(e) => setFiltroZona(e.target.value)}
                  className="h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-800 font-medium"
                >
                  <option value="TODAS">Todas las Zonas</option>
                  {zonas.map((z) => (
                    <option key={z.IdZonaDistribucion} value={z.IdZonaDistribucion}>{z.NombreZona}</option>
                  ))}
                </select>

                <select
                  value={filtroDia}
                  onChange={(e) => setFiltroDia(e.target.value)}
                  className="h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-800 font-medium"
                >
                  <option value="TODOS">Todos los Días</option>
                  {Object.entries(DIAS_SEMANA).map(([num, nom]) => (
                    <option key={num} value={num}>{nom}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="py-12 flex flex-col justify-center items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1C96C5]" />
                  <p className="text-xs text-slate-500">Cargando rutas...</p>
                </div>
              ) : rutasFiltradas.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No se encontraron rutas con los filtros aplicados.
                </div>
              ) : (
                paginacionRutas.itemsPaginados.map((r) => {
                  const seleccionada = rutaSeleccionada?.IdRutaDistribucion === r.IdRutaDistribucion;
                  const asigMatch = asignaciones.find((a) => a.IdRutaDistribucion === r.IdRutaDistribucion);
                  const choferAutoId = plantillasAuto[r.IdRutaDistribucion];
                  const choferAutoObj = repartidores.find((rep) => Number(rep.IdUsuario) === Number(choferAutoId));

                  return (
                    <div
                      key={r.IdRutaDistribucion}
                      onClick={() => seleccionarRuta(r)}
                      className={`p-3 rounded border transition-colors cursor-pointer space-y-2 ${
                        seleccionada
                          ? "border-[#1C96C5] bg-sky-50/50 text-slate-900"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{r.NombreRuta}</p>
                          <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-[#1C96C5]" />
                            <span>{r.NombreZona}</span>
                          </p>
                        </div>
                        <span className="bg-sky-100 text-sky-900 border border-sky-200 font-medium text-[11px] px-1.5 py-0.5 rounded shrink-0">
                          {DIAS_SEMANA[r.DiaSemana] || "Flexible"}
                        </span>
                      </div>

                      {/* Estado del despacho para la fecha seleccionada */}
                      <div className="text-[11px] pt-1 border-t border-slate-100">
                        {asigMatch ? (
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-slate-700 font-medium truncate flex items-center gap-1">
                              <Truck className="h-3 w-3 text-[#1C96C5]" />
                              <span className="truncate">{asigMatch.NombreRepartidor}</span>
                            </span>
                            <Badge variant="outline" className={`text-[10px] px-1 py-0 ${
                              asigMatch.Estado === "Finalizada" ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                              asigMatch.Estado === "En Ruta" ? "bg-sky-50 text-sky-700 border-sky-300" :
                              "bg-amber-50 text-amber-800 border-amber-300"
                            }`}>
                              {asigMatch.Estado}
                            </Badge>
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">
                            Sin despacho programado para {fechaFiltro === hoyStr ? "hoy" : fechaFiltro}
                          </div>
                        )}
                      </div>

                      {/* Switch: Asignación Automática Diaria */}
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]" onClick={(e) => e.stopPropagation()}>
                        <label className="flex items-center gap-1 text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(choferAutoId)}
                            onChange={() => {
                              const defaultChofer = choferAutoId || (repartidores[0]?.IdUsuario);
                              toggleAsignacionAutomatica(r.IdRutaDistribucion, defaultChofer);
                            }}
                            className="rounded text-[#1C96C5] focus:ring-0 h-3 w-3"
                          />
                          <span className="text-[10px] font-medium">Auto-asignación</span>
                        </label>

                        {choferAutoId && (
                          <select
                            value={choferAutoId}
                            onChange={(e) => {
                              toggleAsignacionAutomatica(r.IdRutaDistribucion, Number(e.target.value));
                            }}
                            className="h-6 text-[10px] border border-slate-200 rounded px-1 bg-white max-w-[120px] truncate"
                          >
                            {repartidores.map((rep) => (
                              <option key={rep.IdUsuario} value={rep.IdUsuario}>
                                {rep.NombreCompleto}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Botones de acción rápida por ruta */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <span className="font-mono text-[11px] text-slate-500">{r.TotalPuntosVenta || 0} paradas</span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRutaParaAsignar(r);
                              setModalAsignarRuta(true);
                            }}
                            className="h-6 px-1.5 text-[10px] text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded"
                            title="Asignar esta ruta a un chofer para la fecha seleccionada"
                          >
                            <Truck className="h-3 w-3 mr-0.5" />
                            <span>Asignar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRutaSeleccionada(r);
                              setModalEditorParadas(true);
                            }}
                            className="h-6 px-1.5 text-[10px] text-[#1C96C5] border-sky-300 hover:bg-sky-50 rounded font-semibold"
                            title="Editar Paradas 1..N dinámicamente"
                          >
                            <ListOrdered className="h-3 w-3 mr-0.5" />
                            <span>1..N</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {rutasFiltradas.length > 0 && (
              <PaginacionTabla {...paginacionRutas} opcionesPageSize={[6, 12, 24]} />
            )}
          </div>
        </div>

        {/* PANEL DERECHO: Mapa y Edición de Paradas */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border border-slate-200 bg-white rounded overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-[#1C96C5]" />
                  <span>Itinerario: {rutaSeleccionada ? rutaSeleccionada.NombreRuta : "Selecciona una ruta"}</span>
                </h3>
                {rutaSeleccionada && (
                  <p className="text-xs text-slate-600 mt-0.5">
                    Zona: <span className="font-semibold text-slate-800">{rutaSeleccionada.NombreZona}</span> • Día habitual: <span className="font-semibold text-slate-800">{DIAS_SEMANA[rutaSeleccionada.DiaSemana]}</span> • <strong className="text-[#1C96C5] font-mono">{puntosRuta.length} paradas</strong>
                  </p>
                )}
              </div>
              {rutaSeleccionada && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setModalEditorParadas(true)}
                    className="bg-[#1C96C5] hover:bg-[#157A9E] text-white font-bold px-3 h-8 text-xs rounded gap-1.5 shadow-none"
                    title="Editar orden 1..N, agregar o mover clientes"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                    <span>Editar Paradas / Agregar o Mover Clientes (1..N)</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setRutaParaAsignar(rutaSeleccionada);
                      setModalAsignarRuta(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 h-8 text-xs rounded gap-1.5 shadow-none"
                    title="Asignar o programar esta ruta a un chofer"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Asignar Ruta a Chofer</span>
                  </Button>
                  <Button
                    onClick={guardarItinerario}
                    disabled={guardandoItinerario}
                    variant="outline"
                    className="text-slate-700 font-semibold px-3 h-8 text-xs rounded"
                  >
                    {guardandoItinerario && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Guardar
                  </Button>
                </div>
              )}
            </div>

            <div className="p-4">
              {rutaSeleccionada ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1 p-1 rounded bg-slate-100 border border-slate-200 w-fit">
                    <button
                      type="button"
                      onClick={() => setSubTabRuta("mapa")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                        subTabRuta === "mapa"
                          ? "bg-white text-slate-900 border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      <span>Mapa Satelital Vial (OSRM)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTabRuta("paradas")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                        subTabRuta === "paradas"
                          ? "bg-white text-slate-900 border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                      <span>Secuencia & Puntos ({puntosRuta.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTabRuta("pedidos_futuros")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                        subTabRuta === "pedidos_futuros"
                          ? "bg-white text-slate-900 border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Boxes className="h-3.5 w-3.5 text-[#1C96C5]" />
                      <span>Pedidos Programados ({fechaFiltro})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTabRuta("historial")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                        subTabRuta === "historial"
                          ? "bg-white text-slate-900 border border-slate-200"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span>Historial y Despacho ({fechaFiltro})</span>
                    </button>
                  </div>

                  {/* TAB 1: MAPA */}
                  {subTabRuta === "mapa" && (
                    <div className="space-y-3">
                      <MapaRuta
                        puntosRuta={puntosRuta}
                        todosPuntosVenta={todosPuntosVenta}
                        rutaSeleccionada={rutaSeleccionada}
                        idSucursal={sucursal}
                        altura="h-[520px]"
                      />
                    </div>
                  )}

                  {/* TAB 2: GESTIÓN DE PARADAS */}
                  {subTabRuta === "paradas" && (
                    <div className="space-y-3">
                      {/* Selector de clientes para agregar a la ruta */}
                      <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                            <Store className="h-3.5 w-3.5 text-[#1C96C5]" />
                            <span>Buscar y Agregar Comercio a la Ruta</span>
                          </Label>
                          <span className="text-[11px] text-slate-600 font-mono">
                            {opcionesPuntosVentaDisponibles.length} comercios disponibles
                          </span>
                        </div>

                        <BuscadorSelect
                          options={opcionesPuntosVentaDisponibles}
                          value={puntoSeleccionadoParaAgregar}
                          onChange={(val) => {
                            setPuntoSeleccionadoParaAgregar(val);
                            agregarPuntoDesdeSelector(val);
                          }}
                          placeholder="Escribe el nombre del cliente o tienda para agregar..."
                          searchPlaceholder="Buscar por cliente, sucursal o dirección..."
                        />
                      </div>

                      {/* Lista de paradas ordenadas */}
                      <div className="space-y-2">
                        {puntosRuta.length === 0 ? (
                          <div className="text-center py-10 border border-dashed border-slate-300 rounded bg-slate-50">
                            <Navigation className="h-7 w-7 text-slate-400 mx-auto mb-1" />
                            <p className="text-xs text-slate-700 font-medium">Esta ruta no tiene paradas agregadas</p>
                            <p className="text-[11px] text-slate-500">Usa el buscador superior para agregar clientes a la secuencia.</p>
                          </div>
                        ) : (
                          puntosRuta.map((p, idx) => (
                            <div
                              key={p.IdPuntoVenta}
                              className="p-3 rounded border border-slate-200 bg-white flex items-center justify-between gap-3 hover:border-sky-300 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-7 h-7 rounded bg-sky-50 text-[#1C96C5] border border-sky-200 font-mono font-bold text-xs shrink-0">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-xs text-slate-900">{p.NombreCliente}</p>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-600 bg-slate-50">
                                      {p.frecuencia || "DIARIO"}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-slate-700">{p.Direccion || "Sin dirección"}</p>
                                  <span className="text-[11px] text-slate-500 block">
                                    Punto: {p.NombrePuntoVenta}
                                  </span>
                                  <span className="text-[11px] text-[#1C96C5] font-medium block">
                                    Pedido Programado: <strong className="text-slate-700 font-normal">{p.productosHabituales || "Papel Higiénico Clásico (20 paq)"}</strong>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {Boolean(p.esEjecutada || p.Entregado || p.Cobrado || p.Estado === "Entregado" || p.Estado === "Cobrado") ? (
                                  <div
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium"
                                    title="Parada ya ejecutada hoy: no se puede eliminar ni mover"
                                  >
                                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                                    <span>Parada ya ejecutada hoy</span>
                                  </div>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={idx === 0}
                                      onClick={() => moverParada(idx, -1)}
                                      className="h-7 w-7 p-0 hover:bg-slate-100 rounded"
                                      title="Subir parada"
                                    >
                                      <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={idx === puntosRuta.length - 1}
                                      onClick={() => moverParada(idx, 1)}
                                      className="h-7 w-7 p-0 hover:bg-slate-100 rounded"
                                      title="Bajar parada"
                                    >
                                      <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => eliminarParada(idx)}
                                      className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded"
                                      title="Quitar parada"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PEDIDOS PROGRAMADOS Y RUTAS FUTURAS */}
                  {subTabRuta === "pedidos_futuros" && (
                    <div className="space-y-4">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Boxes className="h-4 w-4 text-[#1C96C5]" />
                              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                Proyección de Pedidos Programados para el {fechaFiltro}
                              </h4>
                              <Badge className="bg-sky-100 text-[#1C96C5] border-sky-300 text-[10px]">
                                {fechaFiltro > hoyStr ? "Fecha Futura" : fechaFiltro === hoyStr ? "Fecha Actual" : "Histórico"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Listado y cubicaje estimado de mercadería que demandarán los clientes en esta ruta según su frecuencia de visita habitual.
                            </p>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => {
                              setRutaParaAsignar(rutaSeleccionada);
                              setModalAsignarRuta(true);
                            }}
                            className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded gap-1.5 shadow-none"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Programar Despacho para {fechaFiltro}</span>
                          </Button>
                        </div>

                        {/* KPIs de la ruta futura */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Clientes en Secuencia</span>
                            <span className="text-base font-extrabold text-slate-900 font-mono block mt-0.5">
                              {puntosRuta.length} comercios
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Frecuencias en Ruta</span>
                            <span className="text-xs font-medium text-slate-700 block mt-1">
                              {puntosRuta.filter((p) => p.frecuencia === "DIARIO").length} Diario • {puntosRuta.filter((p) => p.frecuencia === "CADA_2_DIAS").length} Cada 2 días • {puntosRuta.filter((p) => p.frecuencia === "SEMANAL").length} Semanal
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Estado de Despacho</span>
                            <span className="text-xs font-semibold text-slate-800 block mt-1">
                              {asignaciones.some((a) => a.IdRutaDistribucion === rutaSeleccionada?.IdRutaDistribucion)
                                ? "Salida ya programada en sistema"
                                : "Pendiente de programar para esta fecha"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lista de comercios con pedidos programados */}
                      <div className="space-y-2">
                        {puntosRuta.length === 0 ? (
                          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-white text-xs text-slate-400">
                            No hay paradas configuradas en esta ruta.
                          </div>
                        ) : (
                          puntosRuta.map((p, idx) => (
                            <div
                              key={p.IdPuntoVenta}
                              className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#1C96C5] border border-sky-200 font-bold text-xs flex items-center justify-center shrink-0">
                                  #{p.OrdenVisita || idx + 1}
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-xs text-slate-900 truncate">
                                      {p.NombreCliente}
                                    </span>
                                    {p.NombrePuntoVenta && (
                                      <span className="text-[11px] text-slate-500 truncate">
                                        • {p.NombrePuntoVenta}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sky-300 text-sky-800 bg-sky-50">
                                      {p.frecuencia === "DIARIO" ? "Diario" : p.frecuencia === "CADA_2_DIAS" ? "Cada 2 Días" : "Semanal"}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{p.Direccion || "Sin dirección exacta"}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-700 pt-0.5">
                                    <span className="font-semibold text-slate-800">Pedido Programado: </span>
                                    <span className="font-mono text-[#1C96C5] font-semibold">{p.productosHabituales || "Papel Higiénico Clásico (20 paq)"}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] py-1 px-2">
                                  <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                                  Visita Programada
                                </Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: HISTORIAL Y EJECUCIÓN DE LA RUTA */}
                  {subTabRuta === "historial" && (() => {
                    const asigRuta = asignaciones.find((a) => a.IdRutaDistribucion === rutaSeleccionada.IdRutaDistribucion);

                    return (
                      <div className="space-y-4">
                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-[#1C96C5]" />
                                <span>Ejecución del Despacho para {fechaFiltro === hoyStr ? "Hoy" : fechaFiltro}</span>
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Datos registrados por telemetría móvil y auditoría web
                              </p>
                            </div>
                            {asigRuta && (
                              <Badge className={`text-xs ${
                                asigRuta.Estado === "Finalizada" ? "bg-emerald-600 text-white" :
                                asigRuta.Estado === "En Ruta" ? "bg-[#1C96C5] text-white" :
                                "bg-amber-100 text-amber-900 border-amber-300"
                              }`}>
                                {asigRuta.Estado}
                              </Badge>
                            )}
                          </div>

                          {asigRuta ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-2.5 bg-white border border-slate-200 rounded">
                                  <span className="text-[10px] text-slate-500 font-medium block">Chofer Asignado:</span>
                                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                                    <UserCheck className="h-3.5 w-3.5 text-[#1C96C5]" />
                                    {asigRuta.NombreRepartidor}
                                  </span>
                                </div>
                                <div className="p-2.5 bg-white border border-slate-200 rounded">
                                  <span className="text-[10px] text-slate-500 font-medium block">Vehículo y Odómetro:</span>
                                  <span className="text-xs font-bold text-slate-900 font-mono mt-0.5 block">
                                    {asigRuta.KilometrajeInicial || 0} km inicial {asigRuta.KilometrajeFinal ? `→ ${asigRuta.KilometrajeFinal} km` : ""}
                                  </span>
                                </div>
                                <div className="p-2.5 bg-white border border-slate-200 rounded">
                                  <span className="text-[10px] text-slate-500 font-medium block">Total Recaudado en Ruta:</span>
                                  <span className="text-xs font-bold text-emerald-700 font-mono mt-0.5 block">
                                    Bs. {Number(asigRuta.TotalCobrado || asigRuta.MontoCobrado || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>

                              {asigRuta.Observacion && (
                                <div className="p-2.5 bg-white border border-slate-200 rounded text-xs text-slate-700">
                                  <strong className="text-slate-800">Observaciones:</strong> {asigRuta.Observacion}
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setAsignacionParaReasignar(asigRuta);
                                    setModalReasignar(true);
                                  }}
                                  className="h-8 text-xs text-amber-800 border-amber-300 hover:bg-amber-50 gap-1.5"
                                >
                                  <Users className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Reasignar Paradas Pendientes</span>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="py-6 text-center text-xs text-slate-500 space-y-2">
                              <p>No existe asignación de salida registrada para esta ruta en la fecha {fechaFiltro}.</p>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setRutaParaAsignar(rutaSeleccionada);
                                  setModalAsignarRuta(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                <span>Programar Despacho para {fechaFiltro}</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  Selecciona una ruta en el panel izquierdo para ver su mapa y editar paradas.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: NUEVA ZONA */}
      {modalZona && (
      <Dialog open={modalZona} onOpenChange={setModalZona}>
        <DialogContent className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-200">
          <DialogHeader className="border-b border-slate-200 pb-2">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#1C96C5]" />
              <span>Nueva Zona de Distribución en Sucre</span>
            </DialogTitle>
          </DialogHeader>

          <div className="pt-2">
            <MapaSelectorUbicacion
              lat={zonaCoords.lat}
              lng={zonaCoords.lng}
              onChange={({ lat, lng, referencia }) => {
                setZonaCoords({ lat, lng });
                if (referencia) {
                  setNuevaZona(prev => ({
                    ...prev,
                    Descripcion: prev.Descripcion || `Cuadrante cercano a ${referencia}`
                  }));
                }
              }}
              altura="h-56"
              label="Centra el mapa en el sector comercial de la zona:"
            />
          </div>

          <form onSubmit={handleCrearZona} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-800">Nombre de la Zona *</Label>
              <Input
                value={nuevaZona.NombreZona}
                onChange={(e) => setNuevaZona({ ...nuevaZona, NombreZona: e.target.value })}
                placeholder="Ej. Mercado Campesino y Alrededores"
                required
                className="mt-1 h-8 text-xs rounded"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-800">Descripción o Delimitación Geográfica</Label>
              <Input
                value={nuevaZona.Descripcion}
                onChange={(e) => setNuevaZona({ ...nuevaZona, Descripcion: e.target.value })}
                placeholder="Ej. Entre Av. Ostria Gutiérrez y Av. Marcelo Quiroga"
                className="mt-1 h-8 text-xs rounded"
              />
            </div>
            <DialogFooter className="gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalZona(false)} className="rounded h-8 text-xs">
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-[#1C96C5] hover:bg-[#157A9E] text-white px-5 font-semibold rounded h-8 text-xs">
                Crear Zona
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL 2: NUEVA RUTA */}
      {modalRuta && (
      <Dialog open={modalRuta} onOpenChange={setModalRuta}>
        <DialogContent className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-200">
          <DialogHeader className="border-b border-slate-200 pb-2">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Route className="h-4 w-4 text-[#1C96C5]" />
              <span>Nueva Ruta de Distribución Vial</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearRuta} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-800 block mb-1">Zona de Cobertura *</Label>
                <BuscadorSelect
                  options={opcionesZonas}
                  value={nuevaRuta.IdZonaDistribucion}
                  onChange={(val) => setNuevaRuta({ ...nuevaRuta, IdZonaDistribucion: val })}
                  placeholder="Buscar zona de Sucre..."
                  searchPlaceholder="Escribe el nombre de la zona..."
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800 block mb-1">Día Habitual de Reparto</Label>
                <BuscadorSelect
                  options={OPCIONES_DIAS}
                  value={String(nuevaRuta.DiaSemana)}
                  onChange={(val) => setNuevaRuta({ ...nuevaRuta, DiaSemana: Number(val) })}
                  placeholder="Seleccionar día..."
                  searchPlaceholder="Buscar día..."
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-800">Nombre de la Ruta *</Label>
              <Input
                value={nuevaRuta.NombreRuta}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, NombreRuta: e.target.value })}
                placeholder="Ej. Ruta A - Tiendas Minoristas y Abarrotes"
                required
                className="mt-1 h-8 text-xs rounded"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-800">Descripción u Horario Estimado</Label>
              <Input
                value={nuevaRuta.Descripcion}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, Descripcion: e.target.value })}
                placeholder="Ej. Salida 08:00 AM, atiende tiendas de barrio y minimarkets"
                className="mt-1 h-8 text-xs rounded"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalRuta(false)} className="rounded h-8 text-xs">
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-[#1C96C5] hover:bg-[#157A9E] text-white px-5 font-semibold rounded h-8 text-xs">
                Crear Ruta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL 3: EDITOR DINÁMICO DE PARADAS 1..N */}
      {modalEditorParadas && (
        <EditorParadasDinamicoModal
          abierto={modalEditorParadas}
          onOpenChange={setModalEditorParadas}
          ruta={rutaSeleccionada}
          todosPuntosVenta={todosPuntosVenta}
          sucursal={sucursal}
          alGuardar={() => {
            if (rutaSeleccionada) seleccionarRuta(rutaSeleccionada);
            cargarDatos(true);
          }}
        />
      )}

      {/* MODAL 4: ASIGNAR RUTA A CHOFER */}
      {modalAsignarRuta && (
        <Dialog open={modalAsignarRuta} onOpenChange={setModalAsignarRuta}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-600" />
                <span>Asignar Ruta a Chofer</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCrearAsignacionRapida} className="space-y-3 py-2 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] text-slate-500 font-medium">Ruta seleccionada:</span>
                <p className="font-bold text-slate-900 mt-0.5">
                  {rutaParaAsignar?.NombreRuta} ({rutaParaAsignar?.NombreZona})
                </p>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Fecha de Asignación:</Label>
                <Input
                  type="date"
                  value={fechaFiltro}
                  onChange={(e) => setFechaFiltro(e.target.value)}
                  className="h-8 text-xs font-medium mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Chofer Repartidor:</Label>
                <select
                  value={choferAsignarId}
                  onChange={(e) => setChoferAsignarId(e.target.value)}
                  className="w-full h-8 text-xs border border-slate-300 rounded px-2 mt-1 bg-white font-medium text-slate-800"
                  required
                >
                  <option value="">Seleccione un chofer...</option>
                  {repartidores.map((rep) => (
                    <option key={rep.IdUsuario} value={rep.IdUsuario}>
                      {rep.NombreCompleto} {rep.EnRuta ? "(En ruta)" : "(Disponible)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Kilometraje Inicial del Vehículo:</Label>
                <Input
                  type="number"
                  value={kmInicialAsignar}
                  onChange={(e) => setKmInicialAsignar(e.target.value)}
                  className="h-8 text-xs font-medium mt-1 font-mono"
                  placeholder="45120"
                />
              </div>

              <DialogFooter className="gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalAsignarRuta(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={guardandoAsignacion}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>{guardandoAsignacion ? "Asignando..." : "Confirmar Asignación"}</span>
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 5: REASIGNAR PARADAS PENDIENTES */}
      {modalReasignar && asignacionParaReasignar && (
        <ModalReasignarParadas
          abierto={modalReasignar}
          onOpenChange={setModalReasignar}
          asignacion={asignacionParaReasignar}
          repartidores={repartidores}
          alCompletar={() => cargarDatos(true)}
        />
      )}
    </div>
  );
}
