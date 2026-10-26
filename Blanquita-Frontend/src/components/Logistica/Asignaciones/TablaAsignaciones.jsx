import { useState, useEffect, useMemo, useCallback } from "react";
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
  Radio
} from "lucide-react";
import MapaRuta from "../Rutas/MapaRuta";
import BuscadorSelect from "../Common/BuscadorSelect";
import KpiCard from "../Common/KpiCard";
import GestionChoferesModal from "./GestionChoferesModal";
import HojaDeRutaModal from "./HojaDeRutaModal";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";

const FLOTA_VEHICULOS = [
  { value: "Camión #1 (4821-KLE)", label: "Camión #1 (4821-KLE)" },
  { value: "Camión #2 (3190-PTX)", label: "Camión #2 (3190-PTX)" },
  { value: "Camioneta #3 (5022-LBN)", label: "Camioneta #3 (5022-LBN)" },
  { value: "Moto #4 (1298-XYZ)", label: "Moto #4 (1298-XYZ)" }
];

export default function TablaAsignaciones() {
  const hoyStr = new Date().toISOString().split("T")[0];
  const [fecha, setFecha] = useState(hoyStr);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Cargar asignaciones (memorizada para auto-polling)
  const cargarAsignaciones = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      const data = await ObtenerAsignaciones(fecha);
      setAsignaciones(data);
    } catch (err) {
      if (!silencioso) toast.error(err.message || "Error al cargar despachos");
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [fecha]);

  // Precargar catálogos en segundo plano
  const precargarCatalogos = useCallback(async () => {
    try {
      const [r, rep, pv] = await Promise.all([
        ObtenerRutas(),
        ObtenerRepartidores(),
        ObtenerTodosPuntosVenta()
      ]);
      setRutas(r);
      setRepartidores(rep);
      setTodosPV(pv);
      setCatalogosCargados(true);
    } catch {
      // Sincronización silenciosa
    }
  }, []);

  // Carga inicial y auto-actualización sin botones manuales
  useEffect(() => {
    cargarAsignaciones();
    precargarCatalogos();

    // Auto-polling silencioso cada 30 segundos
    const intervalo = setInterval(() => {
      cargarAsignaciones(true);
    }, 30000);

    // Auto-refresco cuando el usuario vuelve a enfocar la ventana
    const handleFocus = () => cargarAsignaciones(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener("focus", handleFocus);
    };
  }, [cargarAsignaciones, precargarCatalogos]);

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

  const badgeEstado = (estado) => {
    switch (estado) {
      case "Finalizada":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium">Finalizada</Badge>;
      case "En Ruta":
        return <Badge className="bg-sky-500 hover:bg-sky-600 text-white font-medium animate-pulse">En Ruta</Badge>;
      case "Cancelada":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 font-medium">Pendiente</Badge>;
    }
  };

  const kmRecorridos = (kmFinal && asignacionGestionar?.KilometrajeInicial)
    ? Math.max(0, Number(kmFinal) - Number(asignacionGestionar.KilometrajeInicial)).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      {/* 1. Header con botón principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Despachos
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
            type="button"
            onClick={() => setModalChoferesAbierto(true)} 
            variant="outline"
            className="h-9 text-slate-700 border-slate-300 hover:bg-slate-50 gap-1.5 shadow-2xs px-3.5 font-medium text-xs"
          >
            <Users className="h-3.5 w-3.5 text-[#20A7DB]" />
            <span>Choferes</span>
          </Button>

          <Button 
            onClick={abrirModalProgramar} 
            className="h-9 bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 shadow-xs transition-all px-4 font-semibold text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nuevo Despacho</span>
          </Button>
        </div>
      </div>

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
                <Calendar className="h-4 w-4 text-[#20A7DB]" />
                <span>Fecha:</span>
              </span>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-auto h-9 bg-white border-slate-300 font-semibold text-slate-800 text-sm"
              />
              <div className="inline-flex rounded-lg shadow-2xs border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => ajustarFechaRapida(0)}
                  className={`px-3 py-1 rounded font-medium transition-colors ${
                    fecha === hoyStr ? "bg-white text-[#20A7DB] shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
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
                className="w-full h-9 text-xs rounded-lg border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
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
                className="w-full h-9 text-xs rounded-lg border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
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
                className="w-full h-9 text-xs rounded-lg border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
              >
                <option value="TODAS">Todas las Zonas de Sucre</option>
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
            <div className="flex flex-col justify-center items-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
              <p className="text-xs text-slate-500 font-medium">Cargando itinerarios y despachos...</p>
            </div>
          ) : asignacionesFiltradas.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Truck className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-700 font-semibold text-base">No se encontraron despachos con los filtros actuales</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Puedes ajustar los filtros o programar una nueva salida con el botón superior.
              </p>
              <Button onClick={abrirModalProgramar} size="sm" className="bg-[#20A7DB] text-white gap-2">
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
                            <span className="inline-block w-2 h-2 rounded-full bg-[#20A7DB]" />
                            <span>{a.NombreZona}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            <UserCheck className="h-4 w-4 text-[#20A7DB]" />
                            <span>{a.NombreRepartidor}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {badgeEstado(a.Estado)}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-700">
                          {a.KilometrajeInicial ? `${a.KilometrajeInicial} km` : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-700">
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
                            {/* Botón rápido cambiar a En Ruta si está pendiente */}
                            {a.Estado === "Pendiente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cambiarEstadoRapido(a, "En Ruta")}
                                className="h-8 px-2 text-xs text-sky-600 hover:bg-sky-50"
                                title="Marcar como En Ruta"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setHojaRutaAsignacion(a)}
                              className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-100 shadow-2xs gap-1"
                              title="Imprimir Hoja de Ruta Oficial para el Chofer"
                            >
                              <FileText className="h-3.5 w-3.5 text-slate-500" />
                              <span>Planilla</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verRutaEnMapa(a)}
                              className="h-8 px-2.5 text-xs text-[#20A7DB] border-sky-200 hover:bg-sky-50 shadow-2xs gap-1"
                              title="Ver paradas de la ruta en mapa satelital OSRM"
                            >
                              <MapIcon className="h-3.5 w-3.5" />
                              <span>Mapa</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirGestionarEstado(a)}
                              className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-100 shadow-2xs gap-1"
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

      {/* ============================================================== */}
      {/* MODAL 1: PROGRAMAR DESPACHO (AMPLIO, CON BUSCADORSELECT)       */}
      {/* ============================================================== */}
      {modalAbierto && (
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#20A7DB]" />
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
                  className="bg-white border-slate-300 h-9 text-xs font-mono"
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
                className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-5 font-semibold"
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
              <Gauge className="h-5 w-5 text-[#20A7DB]" />
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
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-2xs font-medium"
              >
                <option value="Pendiente">Pendiente (En espera de salida)</option>
                <option value="En Ruta">En Ruta (Vehículo en tránsito)</option>
                <option value="Finalizada">Finalizada (Ruta y entregas concluidas)</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-col justify-center">
                <span className="text-[11px] text-slate-500 block font-medium">Km Inicial:</span>
                <span className="font-mono text-base font-bold text-slate-800 mt-1">
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
                  className="mt-1 h-9 text-sm font-mono bg-white font-bold text-emerald-700"
                />
              </div>
              <div className="flex flex-col justify-center bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block font-medium">Distancia Recorrida:</span>
                <span className={`font-mono text-base font-bold mt-1 ${kmRecorridos ? "text-emerald-600" : "text-slate-400"}`}>
                  {kmRecorridos ? `${kmRecorridos} km` : "Pendiente"}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setModalEstadoAbierto(false)}>
                Cerrar
              </Button>
              <Button type="submit" className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-6 font-semibold" disabled={guardandoEstado}>
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
            <DialogTitle className="text-xl font-bold text-[#20A7DB] flex items-center gap-2">
              <MapIcon className="h-6 w-6 text-[#20A7DB]" />
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
              <Loader2 className="h-10 w-10 animate-spin text-[#20A7DB]" />
              <p className="text-sm font-medium text-slate-600">Calculando trazado vial por calles de Sucre (OSRM)...</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <MapaRuta
                puntosRuta={puntosMapa}
                todosPuntosVenta={todosPV}
                rutaSeleccionada={rutaMapa}
                altura="h-[620px]"
              />

              {/* Paradas ordenadas */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Itinerario de Visitas en Sucre ({puntosMapa.length} paradas):
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
                        <span className="font-extrabold text-[#20A7DB]">#{p.OrdenVisita}</span>
                        <span className="font-medium">{p.NombreCliente}</span>
                        <span className="text-[11px] text-slate-400 font-mono">({p.NombrePuntoVenta})</span>
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
    </div>
  );
}