import { useState, useEffect, useMemo } from "react";
import { 
  ObtenerAsistencias, 
  ObtenerTurnos 
} from "@/services/RRHH/RRHHService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Fingerprint, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Download, 
  RefreshCw, 
  TrendingUp,
  FileSpreadsheet,
  Users
} from "lucide-react";
import ModalImportarBiometrico from "./ModalImportarBiometrico";
import ModalEditarAsistencia from "./ModalEditarAsistencia";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";

const AREAS_PLANTA = [
  "TODAS",
  "Rebobinado",
  "Servilletas",
  "Rodela",
  "Empaque",
  "Logística",
  "Contabilidad",
  "Administración"
];

const ESTADOS = [
  "TODOS",
  "PRESENTE",
  "ATRASO",
  "FALTA",
  "PERMISO",
  "VACACION",
  "LICENCIA",
  "DESCANSO"
];

export default function ControlAsistencia() {
  // Rango de fechas por defecto: últimos 7 días
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split("T")[0]);

  const [areaFiltro, setAreaFiltro] = useState("TODAS");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [asistencias, setAsistencias] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Modales
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const [asistenciaSeleccionada, setAsistenciaSeleccionada] = useState(null);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);

  const cargarDatos = async (forzar = false) => {
    const cacheKey = `rrhh:asistencias:${fechaInicio}:${fechaFin}:${areaFiltro}`;
    try {
      if (!forzar) {
        const enCache = cache.get(cacheKey);
        if (enCache) {
          setAsistencias(enCache);
          return;
        }
      }
      setCargando(true);
      const data = await ObtenerAsistencias(fechaInicio, fechaFin, null, areaFiltro);
      const lista = Array.isArray(data) ? data : [];
      setAsistencias(lista);
      cache.set(cacheKey, lista, 180);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar asistencias");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [fechaInicio, fechaFin, areaFiltro]);

  // Filtrado reactivo en memoria
  const asistenciasFiltradas = useMemo(() => {
    return asistencias.filter(item => {
      // Filtro de estado
      if (estadoFiltro !== "TODOS" && item.Estado !== estadoFiltro) {
        return false;
      }
      // Filtro de búsqueda (nombre, CI, cargo)
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const nombreCompleto = `${item.PrimerNombre || ""} ${item.ApellidoPaterno || ""} ${item.ApellidoMaterno || ""}`.toLowerCase();
        const ci = String(item.CI || "").toLowerCase();
        const cargo = String(item.Cargo || "").toLowerCase();
        if (!nombreCompleto.includes(q) && !ci.includes(q) && !cargo.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [asistencias, estadoFiltro, busqueda]);

  // Paginación optimizada
  const paginacion = usePaginacion(asistenciasFiltradas, 15);

  // Cálculos de métricas rápidas
  const metricas = useMemo(() => {
    let totalAtrasosMin = 0;
    let totalHorasExtras = 0;
    let totalFaltas = 0;
    let totalPresentes = 0;

    for (const a of asistenciasFiltradas) {
      totalAtrasosMin += Number(a.MinutosAtraso) || 0;
      totalHorasExtras += Number(a.HorasExtras) || 0;
      if (a.Estado === "FALTA") totalFaltas++;
      if (a.Estado === "PRESENTE" || a.Estado === "ATRASO") totalPresentes++;
    }

    return {
      totalRegistros: asistenciasFiltradas.length,
      totalAtrasosMin,
      totalAtrasosHoras: (totalAtrasosMin / 60).toFixed(1),
      totalHorasExtras: totalHorasExtras.toFixed(1),
      totalFaltas,
      totalPresentes
    };
  }, [asistenciasFiltradas]);

  const handleEditar = (asist) => {
    setAsistenciaSeleccionada(asist);
    setModalEditarAbierto(true);
  };

  // Exportar a CSV localmente
  const handleExportarCSV = () => {
    if (asistenciasFiltradas.length === 0) {
      toast.info("No hay datos para exportar");
      return;
    }

    const encabezados = ["Fecha", "CI", "Empleado", "Area", "Cargo", "Turno", "Entrada", "Salida", "Minutos Atraso", "Horas Extras", "Estado", "Justificacion"];
    const filas = asistenciasFiltradas.map(a => [
      a.Fecha,
      a.CI || "",
      `"${a.PrimerNombre || ""} ${a.ApellidoPaterno || ""}"`,
      `"${a.Area || ""}"`,
      `"${a.Cargo || ""}"`,
      `"${a.NombreTurno || ""}"`,
      a.HoraEntrada || "--:--",
      a.HoraSalida || "--:--",
      a.MinutosAtraso || 0,
      a.HorasExtras || 0,
      a.Estado || "",
      `"${a.Justificacion || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [encabezados.join(","), ...filas.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `asistencias_blanquita_${fechaInicio}_a_${fechaFin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y Botón de Importar Biométrico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <Fingerprint className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Asistencia
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Marcaciones, atrasos y horas extras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCSV}
            className="text-xs font-medium text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </Button>

          <Button
            size="sm"
            onClick={() => setModalImportarAbierto(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 flex items-center gap-2 shadow-xs"
          >
            <Fingerprint className="h-4 w-4" />
            Importar Biométrico
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Jornadas Registradas</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
            {metricas.totalRegistros}
          </div>
          <span className="text-[11px] text-slate-400">Total en el rango de fechas</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Atrasos Acumulados</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metricas.totalAtrasosMin} <span className="text-xs font-normal text-slate-500">min ({metricas.totalAtrasosHoras} hrs)</span>
          </div>
          <span className="text-[11px] text-slate-400">Afecta planilla mensual</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Horas Extras Totales</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {metricas.totalHorasExtras} <span className="text-xs font-normal text-slate-500">horas</span>
          </div>
          <span className="text-[11px] text-slate-400">Recargo de ley 100%</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Faltas Registradas</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {metricas.totalFaltas}
          </div>
          <span className="text-[11px] text-slate-400">Sin justificar</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Fecha Inicio */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Fecha Desde
            </label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Fecha Hasta
            </label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Filtro Área */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Área de Planta
            </label>
            <select
              value={areaFiltro}
              onChange={(e) => setAreaFiltro(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {AREAS_PLANTA.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Estado Asistencia
            </label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ESTADOS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Buscador */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Buscar Empleado
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Nombre o CI..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Asistencias */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Registros de Jornada y Marcaciones
            </h2>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
              {asistenciasFiltradas.length} filas
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={cargarDatos}
            disabled={cargando}
            className="h-8 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${cargando ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Fecha</th>
                <th className="py-3 px-4 font-semibold">Empleado</th>
                <th className="py-3 px-4 font-semibold">Área & Cargo</th>
                <th className="py-3 px-4 font-semibold">Turno Horario</th>
                <th className="py-3 px-4 font-semibold">Entrada</th>
                <th className="py-3 px-4 font-semibold">Salida</th>
                <th className="py-3 px-4 font-semibold text-center">Atraso</th>
                <th className="py-3 px-4 font-semibold text-center">H. Extras</th>
                <th className="py-3 px-4 font-semibold text-center">Estado</th>
                <th className="py-3 px-4 font-semibold">Justificación</th>
                <th className="py-3 px-4 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cargando ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Cargando registros de asistencia...
                  </td>
                </tr>
              ) : asistenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No se encontraron registros de asistencia para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                paginacion.itemsPaginados.map((a) => {
                  const tieneAtraso = Number(a.MinutosAtraso) > 0;
                  const tieneHE = Number(a.HorasExtras) > 0;

                  return (
                    <tr 
                      key={a.IdAsistenciaDiaria}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {a.Fecha}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {a.PrimerNombre} {a.ApellidoPaterno}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          CI: {a.CI || a.IdUsuario}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {a.Area || "General"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {a.Cargo || "Operario"}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {a.NombreTurno ? (
                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {a.NombreTurno}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-mono">
                              {a.TurnoHoraEntrada ? String(a.TurnoHoraEntrada).substring(0, 5) : "--:--"} - {a.TurnoHoraSalida ? String(a.TurnoHoraSalida).substring(0, 5) : "--:--"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin asignar</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {a.HoraEntrada ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            tieneAtraso ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"
                          }`}>
                            {String(a.HoraEntrada).substring(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-400">--:--:--</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {a.HoraSalida ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            tieneHE ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "text-slate-700 dark:text-slate-300"
                          }`}>
                            {String(a.HoraSalida).substring(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-400">--:--:--</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        {tieneAtraso ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            +{a.MinutosAtraso} min
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        {tieneHE ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            +{Number(a.HorasExtras).toFixed(1)} h
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          a.Estado === "PRESENTE" 
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : a.Estado === "ATRASO"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : a.Estado === "FALTA"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : a.Estado === "PERMISO"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : a.Estado === "VACACION"
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {a.Estado}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-500 dark:text-slate-400" title={a.Justificacion || ""}>
                        {a.Justificacion || <span className="text-slate-300 dark:text-slate-600 italic">Sin observaciones</span>}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditar(a)}
                          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación de asistencias */}
        <PaginacionTabla {...paginacion} />
      </div>

      {/* Modal de Importar Biométrico */}
      {modalImportarAbierto && (
        <ModalImportarBiometrico
          abierto={modalImportarAbierto}
          onCerrar={() => setModalImportarAbierto(false)}
          onImportado={() => {
            cache.invalidateRRHH();
            cargarDatos(true);
          }}
        />
      )}

      {/* Modal de Edición Individual de Asistencia */}
      {modalEditarAbierto && (
        <ModalEditarAsistencia
          asistencia={asistenciaSeleccionada}
          abierto={modalEditarAbierto}
          onCerrar={() => {
            setModalEditarAbierto(false);
            setAsistenciaSeleccionada(null);
          }}
          onGuardado={() => {
            cache.invalidateRRHH();
            cargarDatos(true);
          }}
        />
      )}
    </div>
  );
}
