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
  GuardarPuntosVentaRuta 
} from "@/services/Logistica/RutaService";
import { ObtenerTodosPuntosVenta } from "@/services/Logistica/ClienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ShieldCheck
} from "lucide-react";
import MapaRuta from "./MapaRuta";
import BuscadorSelect from "../Common/BuscadorSelect";
import MapaSelectorUbicacion from "../Common/MapaSelectorUbicacion";
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
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [zonas, setZonas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);

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
      setPuntosRuta(detalle.PuntosVenta || []);
    } catch {
      setPuntosRuta([]);
    }
  }, []);

  const cargarDatos = useCallback(async (silencioso = false, forzar = false) => {
    try {
      const sid = sucursal === "todas" ? null : sucursal;
      const cacheKey = `logistica:${sid || "todas"}`;

      if (!silencioso && !forzar) {
        const cZonas = cache.get(`${cacheKey}:zonas`);
        const cRutas = cache.get(`${cacheKey}:rutas`);
        const cPv = cache.get(`${cacheKey}:todosPuntosVenta`);
        if (cZonas && cRutas && cPv) {
          setZonas(cZonas);
          setRutas(cRutas);
          setTodosPuntosVenta(cPv);
          setLoading(false);
          if (cRutas.length > 0 && !rutaSeleccionadaRef.current) {
            seleccionarRuta(cRutas[0]);
          }
          return;
        }
      }

      if (!silencioso) setLoading(true);
      const [resZ, resR, resPv] = await Promise.allSettled([
        ObtenerZonas(sid),
        ObtenerRutas(null, sid),
        ObtenerTodosPuntosVenta(sid)
      ]);
      const z = resZ.status === "fulfilled" && Array.isArray(resZ.value) ? resZ.value : [];
      const r = resR.status === "fulfilled" && Array.isArray(resR.value) ? resR.value : [];
      const pv = resPv.status === "fulfilled" && Array.isArray(resPv.value) ? resPv.value : [];

      setZonas(z);
      setRutas(r);
      setTodosPuntosVenta(pv);
      cache.set(`${cacheKey}:zonas`, z, 300);
      cache.set(`${cacheKey}:rutas`, r, 300);
      cache.set(`${cacheKey}:todosPuntosVenta`, pv, 300);

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
  }, [sucursal, seleccionarRuta]);

  const [wsConectado, setWsConectado] = useState(false);

  // Carga reactiva al cambiar sucursal
  useEffect(() => {
    if (!cargandoAlcance) {
      cargarDatos(false, true);
    }
  }, [sucursal, cargandoAlcance, cargarDatos]);

  // WebSocket en tiempo real: Cero Polling innecesario para optimización en plan gratuito
  useEffect(() => {
    logisticaSocket.conectar();
    const unsubEstado = logisticaSocket.onEstadoConexion(setWsConectado);

    const unsubReorden = logisticaSocket.suscribir("ruta_reordenada", () => {
      cargarDatos(true);
    });

    const unsubCarga = logisticaSocket.suscribir("solicitud_carga_recibida", () => {
      cargarDatos(true);
    });

    const handleFocus = () => cargarDatos(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubEstado();
      unsubReorden();
      unsubCarga();
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

  return (
    <div className="space-y-4">
      {/* 1. Header con botones de creación */}
      <PageHeader
        title="Rutas y Zonas de Distribución"
        subtitle="Configuración vial, paradas secuenciales y georreferenciación de itinerarios de distribución."
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

        <a
          href="/supervisor/rutas/rastreo"
          className="inline-flex items-center h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold gap-1.5 transition-colors shadow-none"
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Rastreo GPS</span>
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
                  return (
                    <div
                      key={r.IdRutaDistribucion}
                      onClick={() => seleccionarRuta(r)}
                      className={`p-3 rounded border transition-colors cursor-pointer ${
                        seleccionada
                          ? "border-[#1C96C5] bg-sky-50 text-slate-900"
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
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-600 pt-1.5 border-t border-slate-100">
                        <span className="font-mono">{r.TotalPuntosVenta || 0} paradas</span>
                        <span className={`text-[11px] font-semibold ${seleccionada ? "text-[#1C96C5]" : "text-slate-500"}`}>
                          {seleccionada ? "Activa" : "Ver"}
                        </span>
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
                <Button
                  onClick={guardarItinerario}
                  disabled={guardandoItinerario}
                  className="bg-[#1C96C5] hover:bg-[#157A9E] text-white font-semibold px-3.5 h-8 text-xs rounded"
                >
                  {guardandoItinerario && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Guardar Itinerario
                </Button>
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
                  </div>

                  {/* TAB 1: MAPA */}
                  {subTabRuta === "mapa" && (
                    <div className="space-y-3">
                      <MapaRuta
                        puntosRuta={puntosRuta}
                        todosPuntosVenta={todosPuntosVenta}
                        rutaSeleccionada={rutaSeleccionada}
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
                                  <p className="font-bold text-xs text-slate-900">{p.NombreCliente}</p>
                                  <p className="text-xs text-slate-700">{p.Direccion || "Sin dirección"}</p>
                                  <span className="text-[11px] text-slate-500">
                                    Punto: {p.NombrePuntoVenta}
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
    </div>
  );
}
