import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  MapPin, 
  Route, 
  Plus, 
  Loader2, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Map as MapIcon, 
  ListOrdered, 
  Navigation,
  Search,
  Store,
  Layers,
  Radio
} from "lucide-react";
import MapaRuta from "./MapaRuta";
import BuscadorSelect from "../Common/BuscadorSelect";
import MapaSelectorUbicacion from "../Common/MapaSelectorUbicacion";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";

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

export default function GestorRutas() {
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
      if (!silencioso && !forzar) {
        const cZonas = cache.get("logistica:zonas");
        const cRutas = cache.get("logistica:rutas");
        const cPv = cache.get("logistica:todosPuntosVenta");
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
        ObtenerZonas(),
        ObtenerRutas(),
        ObtenerTodosPuntosVenta()
      ]);
      const z = resZ.status === "fulfilled" && Array.isArray(resZ.value) ? resZ.value : [];
      const r = resR.status === "fulfilled" && Array.isArray(resR.value) ? resR.value : [];
      const pv = resPv.status === "fulfilled" && Array.isArray(resPv.value) ? resPv.value : [];

      setZonas(z);
      setRutas(r);
      setTodosPuntosVenta(pv);
      cache.set("logistica:zonas", z, 300);
      cache.set("logistica:rutas", r, 300);
      cache.set("logistica:todosPuntosVenta", pv, 300);

      if (r.length > 0 && !rutaSeleccionadaRef.current) {
        seleccionarRuta(r[0]);
      }
    } catch (err) {
      if (!silencioso) toast.error(err.message || "Error al cargar rutas y zonas");
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [seleccionarRuta]);

  // Carga inicial y auto-actualización silenciosa
  useEffect(() => {
    cargarDatos();

    // Auto-polling cada 45 segundos
    const intervalo = setInterval(() => {
      cargarDatos(true);
    }, 45000);

    const handleFocus = () => cargarDatos(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalo);
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

  // Agregar punto de venta seleccionado con BuscadorSelect
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
      toast.success("¡Itinerario de ruta guardado con éxito!");
      cargarDatos(true);
    } catch (err) {
      toast.error(err.message || "Error al guardar paradas");
    } finally {
      setGuardandoItinerario(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con botones de creación */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Rutas y Zonas
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <a
            href="/supervisor/rutas/rastreo"
            className="inline-flex items-center h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold gap-1.5 shadow-2xs transition-colors"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Rastreo</span>
          </a>

          <Button 
            variant="outline" 
            onClick={() => setModalZona(true)} 
            className="h-9 text-slate-700 border-slate-300 gap-1.5 font-medium shadow-2xs text-xs"
          >
            <Plus className="h-3.5 w-3.5 text-[#20A7DB]" />
            <span>Nueva Zona</span>
          </Button>
          <Button 
            onClick={() => {
              setNuevaRuta({
                IdZonaDistribucion: zonas.length > 0 ? String(zonas[0].IdZonaDistribucion) : "",
                NombreRuta: "",
                DiaSemana: 1,
                Descripcion: ""
              });
              setModalRuta(true);
            }} 
            className="h-10 bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 shadow-xs font-semibold px-4"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Ruta</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PANEL IZQUIERDO: Filtros y Lista de Rutas */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Route className="h-4 w-4 text-[#20A7DB]" />
                  <span>Rutas</span>
                </CardTitle>
                <Badge variant="outline" className="font-semibold text-sky-700 bg-sky-50 border-sky-200">
                  {rutasFiltradas.length} de {rutas.length}
                </Badge>
              </div>

              {/* Buscador de rutas */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre o zona..."
                  value={busquedaRuta}
                  onChange={(e) => setBusquedaRuta(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                />
              </div>

              {/* Filtros de Zona y Día */}
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filtroZona}
                  onChange={(e) => setFiltroZona(e.target.value)}
                  className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2 text-slate-700 font-medium"
                >
                  <option value="TODAS">Todas las Zonas</option>
                  {zonas.map((z) => (
                    <option key={z.IdZonaDistribucion} value={z.IdZonaDistribucion}>{z.NombreZona}</option>
                  ))}
                </select>

                <select
                  value={filtroDia}
                  onChange={(e) => setFiltroDia(e.target.value)}
                  className="h-8 text-xs rounded-md border border-slate-200 bg-white px-2 text-slate-700 font-medium"
                >
                  <option value="TODOS">Todos los Días</option>
                  {Object.entries(DIAS_SEMANA).map(([num, nom]) => (
                    <option key={num} value={num}>{nom}</option>
                  ))}
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-3 space-y-2 max-h-[640px] overflow-y-auto">
              {loading ? (
                <div className="py-12 flex flex-col justify-center items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[#20A7DB]" />
                  <p className="text-xs text-slate-400">Cargando rutas...</p>
                </div>
              ) : rutasFiltradas.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No se encontraron rutas con los filtros aplicados.
                </div>
              ) : (
                paginacionRutas.itemsPaginados.map((r) => {
                  const seleccionada = rutaSeleccionada?.IdRutaDistribucion === r.IdRutaDistribucion;
                  return (
                    <div
                      key={r.IdRutaDistribucion}
                      onClick={() => seleccionarRuta(r)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        seleccionada
                          ? "border-[#20A7DB] bg-sky-50/70 shadow-xs ring-1 ring-[#20A7DB]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.NombreRuta}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-[#20A7DB]" />
                            <span>{r.NombreZona}</span>
                          </p>
                        </div>
                        <Badge className="bg-sky-100 text-[#20A7DB] hover:bg-sky-200 border-none font-semibold text-[11px] shrink-0">
                          {DIAS_SEMANA[r.DiaSemana] || "Flexible"}
                        </Badge>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>{r.TotalPuntosVenta || 0} paradas</span>
                        <span className="text-[#20A7DB] font-semibold">
                          {seleccionada ? "Ruta seleccionada" : "Seleccionar"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
            {rutasFiltradas.length > 0 && (
              <PaginacionTabla {...paginacionRutas} opcionesPageSize={[6, 12, 24]} />
            )}
          </Card>
        </div>

        {/* PANEL DERECHO: Mapa y Edición de Paradas */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-[#20A7DB]" />
                  <span>Itinerario: {rutaSeleccionada ? rutaSeleccionada.NombreRuta : "Selecciona una ruta"}</span>
                </CardTitle>
                {rutaSeleccionada && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Zona: <span className="font-semibold text-slate-800">{rutaSeleccionada.NombreZona}</span> • Día habitual: <span className="font-semibold text-slate-800">{DIAS_SEMANA[rutaSeleccionada.DiaSemana]}</span> • <strong className="text-[#20A7DB]">{puntosRuta.length} paradas configuradas</strong>
                  </p>
                )}
              </div>
              {rutaSeleccionada && (
                <Button
                  onClick={guardarItinerario}
                  disabled={guardandoItinerario}
                  className="bg-[#20A7DB] hover:bg-[#188cba] text-white shadow-xs font-semibold px-4 h-9"
                >
                  {guardandoItinerario && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Itinerario
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-4">
              {rutaSeleccionada ? (
                <Tabs defaultValue="mapa" className="space-y-4">
                  <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="mapa" className="gap-1.5 text-xs">
                      <MapIcon className="h-3.5 w-3.5" />
                      <span>Mapa Satelital Vial (OSRM)</span>
                    </TabsTrigger>
                    <TabsTrigger value="paradas" className="gap-1.5 text-xs">
                      <ListOrdered className="h-3.5 w-3.5" />
                      <span>Secuencia & Puntos ({puntosRuta.length})</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* TAB 1: MAPA */}
                  <TabsContent value="mapa" className="space-y-3 focus:outline-none">
                    <MapaRuta
                      puntosRuta={puntosRuta}
                      todosPuntosVenta={todosPuntosVenta}
                      rutaSeleccionada={rutaSeleccionada}
                      altura="h-[520px]"
                    />
                  </TabsContent>

                  {/* TAB 2: GESTIÓN DE PARADAS CON BUSCADORSELECT */}
                  <TabsContent value="paradas" className="space-y-4 focus:outline-none">
                    {/* Selector de clientes para agregar a la ruta */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Store className="h-4 w-4 text-[#20A7DB]" />
                          <span>Buscar y Agregar Comercio a la Ruta</span>
                        </Label>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {opcionesPuntosVentaDisponibles.length} comercios disponibles en Sucre
                        </span>
                      </div>

                      {/* COMBOBOX CON BUSCADOR PREDICTIVO REUTILIZABLE */}
                      <BuscadorSelect
                        options={opcionesPuntosVentaDisponibles}
                        value={puntoSeleccionadoParaAgregar}
                        onChange={(val) => {
                          setPuntoSeleccionadoParaAgregar(val);
                          agregarPuntoDesdeSelector(val);
                        }}
                        placeholder="Escribe el nombre del cliente o tienda para agregar a la parada..."
                        searchPlaceholder="Buscar por cliente, sucursal o dirección..."
                      />
                    </div>

                    {/* Lista de paradas ordenadas */}
                    <div className="space-y-2">
                      {puntosRuta.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                          <Navigation className="h-8 w-8 text-slate-300 mx-auto mb-1" />
                          <p className="text-xs text-slate-600 font-medium">Esta ruta no tiene paradas agregadas</p>
                          <p className="text-[11px] text-slate-400">Usa el buscador superior para agregar clientes a la secuencia.</p>
                        </div>
                      ) : (
                        puntosRuta.map((p, idx) => (
                          <div
                            key={p.IdPuntoVenta}
                            className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs hover:border-sky-200 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 text-[#20A7DB] font-extrabold text-xs font-mono shrink-0">
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-sm text-slate-900">{p.NombreCliente}</p>
                                <p className="text-xs text-slate-600">{p.Direccion || "Sin dirección"}</p>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  Punto: {p.NombrePuntoVenta}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={idx === 0}
                                onClick={() => moverParada(idx, -1)}
                                className="h-8 w-8 p-0 hover:bg-slate-100"
                                title="Subir parada"
                              >
                                <ArrowUp className="h-4 w-4 text-slate-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={idx === puntosRuta.length - 1}
                                onClick={() => moverParada(idx, 1)}
                                className="h-8 w-8 p-0 hover:bg-slate-100"
                                title="Bajar parada"
                              >
                                <ArrowDown className="h-4 w-4 text-slate-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => eliminarParada(idx)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                title="Quitar parada"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  Selecciona una ruta en el panel izquierdo para ver su mapa y editar paradas.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: NUEVA ZONA (CON MAPA INTERACTIVO DE SUCRE)           */}
      {/* ============================================================== */}
      {modalZona && (
      <Dialog open={modalZona} onOpenChange={setModalZona}>
        <DialogContent className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-xl font-bold text-[#20A7DB] flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#20A7DB]" />
              <span>Nueva Zona de Distribución en Sucre</span>
            </DialogTitle>
          </DialogHeader>

          {/* MAPA INTERACTIVO PARA VISUALIZAR EL SECTOR */}
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

          <form onSubmit={handleCrearZona} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Nombre de la Zona *</Label>
              <Input
                value={nuevaZona.NombreZona}
                onChange={(e) => setNuevaZona({ ...nuevaZona, NombreZona: e.target.value })}
                placeholder="Ej. Mercado Campesino y Alrededores"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Descripción o Delimitación Geográfica</Label>
              <Input
                value={nuevaZona.Descripcion}
                onChange={(e) => setNuevaZona({ ...nuevaZona, Descripcion: e.target.value })}
                placeholder="Ej. Entre Av. Ostria Gutiérrez y Av. Marcelo Quiroga"
                className="mt-1"
              />
            </div>
            <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setModalZona(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-6 font-semibold">
                Crear Zona
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: NUEVA RUTA (CON BUSCADORSELECT DE ZONAS)               */}
      {/* ============================================================== */}
      {modalRuta && (
      <Dialog open={modalRuta} onOpenChange={setModalRuta}>
        <DialogContent className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-xl font-bold text-[#20A7DB] flex items-center gap-2">
              <Route className="h-5 w-5 text-[#20A7DB]" />
              <span>Nueva Ruta de Distribución Vial</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearRuta} className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">Zona de Cobertura *</Label>
                <BuscadorSelect
                  options={opcionesZonas}
                  value={nuevaRuta.IdZonaDistribucion}
                  onChange={(val) => setNuevaRuta({ ...nuevaRuta, IdZonaDistribucion: val })}
                  placeholder="Buscar zona de Sucre..."
                  searchPlaceholder="Escribe el nombre de la zona..."
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-1">Día Habitual de Reparto</Label>
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
              <Label className="text-xs font-semibold text-slate-700">Nombre de la Ruta *</Label>
              <Input
                value={nuevaRuta.NombreRuta}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, NombreRuta: e.target.value })}
                placeholder="Ej. Ruta A - Tiendas Minoristas y Abarrotes"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Descripción u Horario Estimado</Label>
              <Input
                value={nuevaRuta.Descripcion}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, Descripcion: e.target.value })}
                placeholder="Ej. Salida 08:00 AM, atiende tiendas de barrio y minimarkets"
                className="mt-1"
              />
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setModalRuta(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-6 font-semibold">
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