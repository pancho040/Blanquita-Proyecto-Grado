import { useState, useEffect, useMemo } from "react";
import { 
  ObtenerPeriodosNomina, 
  CrearPeriodoNomina, 
  ObtenerPlanilla, 
  GenerarPlanilla, 
  GenerarPlanillaDual,
  AprobarPlanilla,
  ObtenerResumenBancos,
  ObtenerTodasLasBoletas
} from "@/services/RRHH/RRHHService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import StatusBadge from "@/components/common/StatusBadge";
import { 
  DollarSign, 
  Calendar, 
  FileSpreadsheet, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Printer, 
  FileText, 
  Download, 
  ShieldCheck,
  TrendingDown,
  Users,
  Search,
  Building2,
  Landmark,
  Layers,
  ChevronDown
} from "lucide-react";
import ModalEditarDetallePlanilla from "./ModalEditarDetallePlanilla";
import BoletaPagoModal from "./BoletaPagoModal";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";

export default function GestionPlanillas({ sucursal = null, sucursalesPermitidas = [] }) {
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [planillaData, setPlanillaData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRegimen, setFiltroRegimen] = useState("TODOS"); // "TODOS" | "ASEGURADO" | "EXTERNO" | "RESUMEN"
  const [resumenBancos, setResumenBancos] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  // Modales
  const [modalNuevoPeriodo, setModalNuevoPeriodo] = useState(false);
  const [nuevoPeriodoForm, setNuevoPeriodoForm] = useState({
    Anio: new Date().getFullYear(),
    Mes: new Date().getMonth() + 1,
    FechaInicio: "",
    FechaFin: ""
  });

  const [detalleEditar, setDetalleEditar] = useState(null);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);

  const [idBoletaSeleccionada, setIdBoletaSeleccionada] = useState(null);
  const [modalBoletaAbierto, setModalBoletaAbierto] = useState(false);
  const [modalBoletasMasivasAbierto, setModalBoletasMasivasAbierto] = useState(false);

  // Inicializar fechas al abrir modal nuevo periodo
  useEffect(() => {
    const anio = nuevoPeriodoForm.Anio;
    const mes = String(nuevoPeriodoForm.Mes).padStart(2, "0");
    const primerDia = `${anio}-${mes}-01`;
    const ultimoDia = new Date(anio, nuevoPeriodoForm.Mes, 0).toISOString().split("T")[0];
    setNuevoPeriodoForm(prev => ({
      ...prev,
      FechaInicio: primerDia,
      FechaFin: ultimoDia
    }));
  }, [nuevoPeriodoForm.Anio, nuevoPeriodoForm.Mes]);

  // Cargar lista de periodos
  const cargarPeriodos = async () => {
    try {
      setCargando(true);
      const data = await ObtenerPeriodosNomina();
      const lista = Array.isArray(data) ? data : [];
      setPeriodos(lista);
      if (lista.length > 0 && !periodoSeleccionado) {
        setPeriodoSeleccionado(lista[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar periodos de nómina");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPeriodos();
  }, []);

  // Cargar planilla cuando cambia el periodo seleccionado
  const cargarPlanillaPeriodo = async (idPeriodo) => {
    if (!idPeriodo) return;
    try {
      setCargando(true);
      const data = await ObtenerPlanilla(idPeriodo);
      setPlanillaData(data);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar planilla del periodo");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (periodoSeleccionado?.IdPeriodoNomina) {
      cargarPlanillaPeriodo(periodoSeleccionado.IdPeriodoNomina);
    } else {
      setPlanillaData(null);
    }
  }, [periodoSeleccionado]);

  // Cargar resumen de bancos si la pestaña está activa
  const cargarResumenBancos = async (idPlanilla) => {
    if (!idPlanilla) return;
    try {
      setCargandoResumen(true);
      const data = await ObtenerResumenBancos(idPlanilla);
      setResumenBancos(data);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar el resumen bancario");
    } finally {
      setCargandoResumen(false);
    }
  };

  useEffect(() => {
    if (filtroRegimen === "RESUMEN" && planillaData?.Planilla?.IdPlanilla) {
      cargarResumenBancos(planillaData.Planilla.IdPlanilla);
    }
  }, [filtroRegimen, planillaData]);

  // Generar o Recalcular la Planilla (permite régimen específico o completo)
  const handleGenerarPlanilla = async (tipo = "INTERNA") => {
    if (!periodoSeleccionado) return;
    try {
      setGenerando(true);
      const sid = (sucursal && sucursal !== "todas") ? Number(sucursal) : 1;
      const res = await GenerarPlanillaDual({ 
        idPeriodo: periodoSeleccionado.IdPeriodoNomina, 
        tipoPlanilla: tipo,
        idSucursal: sid
      });
      if (res && (res.Planilla || res.Detalles)) {
        setPlanillaData(res);
      }
      toast.success(res?.mensaje || `Planilla (${tipo}) calculada con éxito`);
      await cargarPlanillaPeriodo(periodoSeleccionado.IdPeriodoNomina);
      if (filtroRegimen === "RESUMEN" && (res?.Planilla?.IdPlanilla || planillaData?.Planilla?.IdPlanilla)) {
        await cargarResumenBancos(res?.Planilla?.IdPlanilla || planillaData?.Planilla?.IdPlanilla);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al generar la planilla");
    } finally {
      setGenerando(false);
    }
  };

  // Aprobar Planilla
  const handleAprobar = async () => {
    if (!planillaData?.Planilla?.IdPlanilla) return;
    if (!confirm("¿Está seguro de aprobar formalmente esta planilla? Se considerará nómina final del periodo.")) {
      return;
    }

    try {
      setCargando(true);
      await AprobarPlanilla(planillaData.Planilla.IdPlanilla, "Aprobada por Administrador General");
      toast.success("Planilla aprobada formalmente");
      await cargarPlanillaPeriodo(periodoSeleccionado.IdPeriodoNomina);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al aprobar la planilla");
    } finally {
      setCargando(false);
    }
  };

  // Crear Nuevo Periodo
  const handleCrearPeriodo = async (e) => {
    e.preventDefault();
    try {
      setCargando(true);
      const res = await CrearPeriodoNomina(nuevoPeriodoForm);
      toast.success("Periodo mensual creado correctamente");
      setModalNuevoPeriodo(false);
      await cargarPeriodos();
      setPeriodoSeleccionado(res);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al crear el periodo");
    } finally {
      setCargando(false);
    }
  };

  // Conteos de personal por régimen
  const conteosRegimen = useMemo(() => {
    const todos = planillaData?.Detalles || [];
    const asegurados = todos.filter(d => Boolean(d.EsAsegurado)).length;
    const externos = todos.filter(d => !Boolean(d.EsAsegurado)).length;
    return { todos: todos.length, asegurados, externos };
  }, [planillaData]);

  // Filtro de búsqueda y régimen en la tabla de nómina
  const detallesFiltrados = useMemo(() => {
    if (!planillaData?.Detalles) return [];
    let lista = planillaData.Detalles;

    if (filtroRegimen === "ASEGURADO") {
      lista = lista.filter(d => Boolean(d.EsAsegurado));
    } else if (filtroRegimen === "EXTERNO") {
      lista = lista.filter(d => !Boolean(d.EsAsegurado));
    }

    if (!busqueda.trim()) return lista;

    const q = busqueda.toLowerCase();
    return lista.filter(d => {
      const nom = `${d.PrimerNombre || ""} ${d.ApellidoPaterno || ""} ${d.ApellidoMaterno || ""}`.toLowerCase();
      const ci = String(d.CI || d.Ci || "").toLowerCase();
      const cargo = String(d.Cargo || "").toLowerCase();
      const banco = String(d.Banco || "").toLowerCase();
      return nom.includes(q) || ci.includes(q) || cargo.includes(q) || banco.includes(q);
    });
  }, [planillaData, busqueda, filtroRegimen]);

  // Paginación optimizada de la nómina
  const paginacion = usePaginacion(detallesFiltrados, 10);

  // Exportar Nómina a CSV
  const handleExportarCSV = () => {
    if (!planillaData?.Detalles || planillaData.Detalles.length === 0) {
      toast.info("No hay datos de planilla para exportar");
      return;
    }

    const encabezados = [
      "CI", "Empleado", "Cargo", "Area", "Regimen", "Dias", 
      "Haber Basico", "Bono Antiguedad", "Horas Extras Bs", "Total Ganado",
      "AFP 12.71%", "Atrasos Bs", "Faltas Bs", "Anticipos", "Total Descuentos", "Liquido Pagable", "Banco", "Cuenta"
    ];

    const filas = planillaData.Detalles.map(d => [
      d.CI || d.Ci || "",
      `"${d.PrimerNombre || ""} ${d.ApellidoPaterno || ""}"`,
      `"${d.Cargo || ""}"`,
      `"${d.Area || ""}"`,
      d.EsAsegurado ? "Asegurado" : "Externo",
      d.DiasTrabajados ?? 30,
      Number(d.HaberBasico || 0).toFixed(2),
      Number(d.BonoAntiguedad || 0).toFixed(2),
      Number(d.HorasExtrasMonto || 0).toFixed(2),
      Number(d.TotalGanado || 0).toFixed(2),
      Number(d.DescuentoAFP || 0).toFixed(2),
      Number(d.DescuentoAtrasos || 0).toFixed(2),
      Number(d.DescuentoFaltas || 0).toFixed(2),
      Number(d.Anticipos || 0).toFixed(2),
      Number(d.TotalDescuentos || 0).toFixed(2),
      Number(d.LiquidoPagable || 0).toFixed(2),
      `"${d.Banco || "Banco Unión"}"`,
      `"${d.CuentaBancaria || d.NroCuenta || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [encabezados.join(","), ...filas.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `planilla_${periodoSeleccionado?.Mes}_${periodoSeleccionado?.Anio}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Resumen de Bancos a CSV
  const handleExportarResumenBancosCSV = () => {
    if (!resumenBancos?.Detalles?.length) {
      toast.info("No hay datos de resumen bancario");
      return;
    }

    const encabezados = ["N°", "Empleado", "CI", "Cargo", "Banco", "Cuenta Bancaria", "Regimen", "Liquido Pagable Bs."];
    const filas = resumenBancos.Detalles.map((d, idx) => [
      idx + 1,
      `"${d.NombreEmpleado}"`,
      d.CI || "",
      `"${d.Cargo}"`,
      `"${d.Banco}"`,
      `"${d.CuentaBancaria}"`,
      d.TipoPersonal,
      Number(d.LiquidoPagable || 0).toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [encabezados.join(","), ...filas.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `resumen_bancos_${periodoSeleccionado?.Mes}_${periodoSeleccionado?.Anio}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mesesNombres = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <div className="space-y-6">
      {/* SECCIÓN INTERACTIVA WEB (Oculta en impresión) */}
      <div className="space-y-6 print:hidden">
      {/* Cabecera y Acciones Globales */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-100 text-slate-700 rounded border border-slate-200">
              <DollarSign className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Planillas
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Cálculo de haberes, aportes de ley y boletas de pago.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalNuevoPeriodo(true)}
            className="text-xs font-medium text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nuevo Periodo
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCSV}
            disabled={!planillaData?.Detalles?.length}
            className="text-xs font-medium text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Exportar CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalBoletasMasivasAbierto(true)}
            disabled={!planillaData?.Detalles?.length}
            className="text-xs font-semibold text-blue-700 border-blue-300 hover:bg-blue-50 flex items-center gap-1.5 shadow-xs"
            title="Generar e imprimir todas las boletas oficiales del mes"
          >
            <Printer className="h-3.5 w-3.5 text-blue-600" />
            Imprimir Boletas Masivas
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={!planillaData?.Detalles?.length}
            className="text-xs font-medium text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5 mr-1 text-[#1C96C5]" />
            Imprimir Planilla
          </Button>

          {/* Generador con selector de régimen salarial */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            <Button
              size="sm"
              onClick={() => handleGenerarPlanilla("INTERNA")}
              disabled={generando || !periodoSeleccionado}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`h-3 w-3 ${generando ? "animate-spin" : ""}`} />
              {planillaData?.Planilla ? "Recalcular Completa" : "Generar Planilla"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleGenerarPlanilla("ASEGURADO")}
              disabled={generando || !periodoSeleccionado}
              className="text-[11px] h-7 px-2 text-slate-700 hover:bg-white"
              title="Calcular solo personal en planilla legal (12.71% AFP)"
            >
              Solo Asegurados
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleGenerarPlanilla("EXTERNO")}
              disabled={generando || !periodoSeleccionado}
              className="text-[11px] h-7 px-2 text-slate-700 hover:bg-white"
              title="Calcular solo personal externo (0% AFP)"
            >
              Solo Externos
            </Button>
          </div>
        </div>
      </div>

      {/* Selector de Periodo y Estado de Planilla */}
      <div className="bg-white p-3.5 sm:p-4 rounded border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
          <div className="w-full sm:w-72">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Periodo de Pago:
            </label>
            <select
              value={periodoSeleccionado?.IdPeriodoNomina || ""}
              onChange={(e) => {
                const encontrado = periodos.find(p => p.IdPeriodoNomina === Number(e.target.value));
                setPeriodoSeleccionado(encontrado || null);
              }}
              className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {periodos.length === 0 && <option value="">No hay periodos creados</option>}
              {periodos.map(p => (
                <option key={p.IdPeriodoNomina} value={p.IdPeriodoNomina}>
                  {mesesNombres[p.Mes]} {p.Anio} ({p.FechaInicio} al {p.FechaFin})
                </option>
              ))}
            </select>
          </div>
        </div>

        {planillaData?.Planilla && (
          <div className="flex items-center gap-3 self-end md:self-center">
            <StatusBadge estado={planillaData.Planilla.Estado} />

            {planillaData.Planilla.Estado === "BORRADOR" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAprobar}
                className="h-8 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Aprobar Nómina
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tarjetas KPI Financieras */}
      {planillaData?.Planilla && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-3.5 rounded border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Ganado Bruto</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100 ">
              Bs. {Number(planillaData.Planilla.TotalPlanilla || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400">Haberes + Bonos + Extras</span>
          </div>

          <div className="bg-white p-3.5 rounded border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Aportes Gestora / AFP</span>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400 ">
              Bs. {Number(planillaData.Planilla.TotalDescuentos || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400">12.71% de ley + deducciones</span>
          </div>

          <div className="bg-white p-3.5 rounded border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Líquido Pagable Neto</span>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400 ">
              Bs. {Number(planillaData.Planilla.TotalLiquido || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-400">Desembolso final a trabajadores</span>
          </div>

          <div className="bg-white p-3.5 rounded border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Personal en Nómina</span>
              <Users className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
              {planillaData.Detalles?.length || 0}
            </div>
            <span className="text-[11px] text-slate-400">Empleados procesados</span>
          </div>
        </div>
      )}

      {/* Pestañas de Vista y Régimen Salarial */}
      {planillaData?.Planilla && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFiltroRegimen("TODOS")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                filtroRegimen === "TODOS"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Todos los Empleados ({conteosRegimen.todos})
            </button>

            <button
              type="button"
              onClick={() => setFiltroRegimen("ASEGURADO")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                filtroRegimen === "ASEGURADO"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              P. Asegurado ({conteosRegimen.asegurados})
            </button>

            <button
              type="button"
              onClick={() => setFiltroRegimen("EXTERNO")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                filtroRegimen === "EXTERNO"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              P. Externo ({conteosRegimen.externos})
            </button>

            <button
              type="button"
              onClick={() => setFiltroRegimen("RESUMEN")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                filtroRegimen === "RESUMEN"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              Resumen Bancario (RESUMEN)
            </button>
          </div>

          {filtroRegimen === "RESUMEN" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportarResumenBancosCSV}
              className="text-xs text-slate-700 border-slate-300"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Descargar Resumen Bancos CSV
            </Button>
          )}
        </div>
      )}

      {/* Vista de Resumen Bancario o Vista de Planilla Detallada */}
      {filtroRegimen === "RESUMEN" ? (
        <div className="space-y-4">
          {cargandoResumen ? (
            <div className="bg-white rounded border border-slate-200 p-12 text-center text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
              <span className="text-xs font-medium">Consolidando transferencias y cuentas bancarias...</span>
            </div>
          ) : (
            <>
              {/* Tarjetas de Totales por Banco */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(resumenBancos?.TotalesPorBanco || {}).map(([banco, total]) => (
                  <div key={banco} className="bg-white p-3 rounded border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {banco}
                    </span>
                    <span className="text-lg font-bold font-mono tabular-nums text-slate-900 block mt-1">
                      Bs. {Number(total).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bloque de Conciliación General */}
              <div className="bg-emerald-50 p-4 rounded border border-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                    Conciliación Matemática de Desembolso de Haberes
                  </h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Total Asegurados: Bs. {Number(resumenBancos?.TotalAsegurados || 0).toFixed(2)} &nbsp;|&nbsp; 
                    Total Externos: Bs. {Number(resumenBancos?.TotalExternos || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-800 font-semibold block uppercase">
                    Total General a Desembolsar:
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-950">
                    Bs. {Number(resumenBancos?.TotalGeneral || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Tabla de Cuentas y Desembolsos */}
              <div className="bg-white rounded border border-slate-200 overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">
                    Nómina de Transferencias Bancarias ({resumenBancos?.Detalles?.length || 0} personas)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] font-semibold uppercase">
                        <th className="py-2.5 px-3">N°</th>
                        <th className="py-2.5 px-3">Empleado</th>
                        <th className="py-2.5 px-3">CI</th>
                        <th className="py-2.5 px-3">Cargo</th>
                        <th className="py-2.5 px-3">Banco</th>
                        <th className="py-2.5 px-3">N° Cuenta Bancaria</th>
                        <th className="py-2.5 px-3 text-center">Régimen</th>
                        <th className="py-2.5 px-3 text-right">Líquido Pagable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resumenBancos?.Detalles?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{it.NombreEmpleado}</td>
                          <td className="py-2 px-3 text-slate-600 font-mono">{it.CI}</td>
                          <td className="py-2 px-3 text-slate-600">{it.Cargo}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{it.Banco}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{it.CuentaBancaria}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              it.EsAsegurado ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {it.TipoPersonal}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold font-mono text-slate-900">
                            Bs. {Number(it.LiquidoPagable || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {(!resumenBancos?.Detalles || resumenBancos.Detalles.length === 0) && (
                        <tr>
                          <td colSpan="8" className="py-6 text-center text-slate-400 italic">
                            No hay datos para mostrar en este periodo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : !planillaData?.Planilla ? (
        <div className="bg-white rounded border border-slate-200 p-10 text-center space-y-3">
          <FileSpreadsheet className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
            No se ha generado la planilla para este periodo
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Haz clic en el botón inferior para procesar de forma automática los sueldos básicos, turnos, atrasos registrados por el biométrico y deducciones de ley.
          </p>
          <Button
            onClick={() => handleGenerarPlanilla("INTERNA")}
            disabled={generando || !periodoSeleccionado}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-5 mt-2"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generando ? "animate-spin" : ""}`} />
            Generar Planilla de Haberes Ahora
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          {/* Barra superior de la tabla */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Detalle Individual de Sueldos y Retenciones {filtroRegimen !== "TODOS" && `(${filtroRegimen === "ASEGURADO" ? "Personal Asegurado" : "Personal Externo"})`}
              </h2>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filtrar por nombre, CI o banco..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="sticky top-0 bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3 font-semibold">CI</th>
                  <th className="py-3 px-3 font-semibold">Empleado</th>
                  <th className="py-3 px-3 font-semibold">Área & Cargo</th>
                  <th className="py-3 px-3 font-semibold text-center">Régimen</th>
                  <th className="py-3 px-3 font-semibold text-center">Días</th>
                  <th className="py-3 px-3 font-semibold text-right">Básico (Bs.)</th>
                  <th className="py-3 px-3 font-semibold text-right">Antigüedad</th>
                  <th className="py-3 px-3 font-semibold text-right">H. Extras</th>
                  <th className="py-3 px-3 font-semibold text-right text-emerald-600 dark:text-emerald-400">Total Ganado</th>
                  <th className="py-3 px-3 font-semibold text-right text-rose-600 dark:text-rose-400">Gestora (12.71%)</th>
                  <th className="py-3 px-3 font-semibold text-right text-rose-600 dark:text-rose-400">Atrasos/Faltas</th>
                  <th className="py-3 px-3 font-semibold text-right text-rose-600 dark:text-rose-400">Anticipos</th>
                  <th className="py-3 px-3 font-semibold text-right font-bold text-blue-600 dark:text-blue-400">Líquido Pagable</th>
                  <th className="py-3 px-3 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 ">
                {paginacion.itemsPaginados.map((d) => (
                  <tr 
                    key={d.IdDetallePlanilla}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-300">
                      {d.CI || d.Ci}
                    </td>

                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 dark:text-slate-100">
                      {d.PrimerNombre} {d.ApellidoPaterno}
                    </td>

                    <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300">
                      <span className="block">{d.Area}</span>
                      <span className="text-[10px] text-slate-400">{d.Cargo}</span>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        d.EsAsegurado ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {d.EsAsegurado ? "Asegurado" : "Externo"}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                      {d.DiasTrabajados ?? 30}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                      {Number(d.HaberBasico || 0).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-mono tabular-nums text-slate-600">
                      {Number(d.BonoAntiguedad || 0).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-mono tabular-nums text-slate-600">
                      {Number(d.HorasExtrasMonto || 0).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-mono tabular-nums font-bold text-emerald-700">
                      {Number(d.TotalGanado || 0).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-mono tabular-nums text-red-700">
                      {d.EsAsegurado ? Number(d.DescuentoAFP || 0).toFixed(2) : <span className="text-slate-400 text-[10px]">0.00 (Exento)</span>}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-mono tabular-nums text-red-700">
                      {(Number(d.DescuentoAtrasos || 0) + Number(d.DescuentoFaltas || 0)).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-mono tabular-nums text-red-700">
                      {Number(d.Anticipos || 0).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 font-mono tabular-nums font-bold text-slate-900">
                      Bs. {Number(d.LiquidoPagable || 0).toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono tabular-nums font-sans">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDetalleEditar(d);
                            setModalEditarAbierto(true);
                          }}
                          className="h-7 px-2 text-[11px] text-slate-600 hover:text-blue-600"
                          title="Editar importes"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          Editar
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIdBoletaSeleccionada(d.IdDetallePlanilla);
                            setModalBoletaAbierto(true);
                          }}
                          className="h-7 px-2 text-[11px] text-blue-600 hover:text-blue-800"
                          title="Ver Boleta de Pago"
                        >
                          <Printer className="h-3 w-3 mr-1" />
                          Boleta
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación de nómina salarial */}
          <PaginacionTabla {...paginacion} />
        </div>
      )}

      </div>

      {/* DOCUMENTO FORMAL IMPRESO - PLANILLA DE SUELDOS (Visible solo al imprimir) */}
      <div className="hidden print:block p-4 bg-white text-black font-sans text-[10px] leading-tight">
        {/* Membrete Oficial */}
        <div className="border-b-2 border-black pb-2 mb-3 flex justify-between items-start">
          <div>
            <h1 className="text-base font-black uppercase tracking-wider">
              EMPRESA DE PAPEL BLANQUITA (SHEMA ASOCIADOS S.R.L.)
            </h1>
            <p className="text-[10px] font-semibold text-gray-700">
              Calle Regimiento Charcas (16 de Infantería) N° 37 • Sucre, Bolivia • NIT: 1028495024
            </p>
            <p className="text-[10px] font-semibold text-gray-700">
              Rubro: Fabricación y Distribución de Productos de Papel
            </p>
          </div>
          <div className="text-right">
            <span className="font-extrabold text-xs uppercase px-2 py-0.5 border border-black inline-block">
              PLANILLA DE SUELDOS Y SALARIOS
            </span>
            <p className="text-[10px] font-bold mt-1">
              Periodo: {periodoSeleccionado ? `${periodoSeleccionado.NombrePeriodo || ''} (${periodoSeleccionado.Mes}/${periodoSeleccionado.Anio})` : ''}
            </p>
            <p className="text-[9px] text-gray-600">
              Expresado en Bolivianos (BOB)
            </p>
          </div>
        </div>

        {/* Tabla Formal de Planilla */}
        <table className="w-full border-collapse border border-black text-[9px] mb-4">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="border border-black p-1">N°</th>
              <th className="border border-black p-1 text-left">Empleado / Cargo</th>
              <th className="border border-black p-1">CI</th>
              <th className="border border-black p-1 text-right">Haber Básico</th>
              <th className="border border-black p-1 text-right">Hrs Extra</th>
              <th className="border border-black p-1 text-right">Comisiones</th>
              <th className="border border-black p-1 text-right bg-gray-200">Total Ganado</th>
              <th className="border border-black p-1 text-right">AFP (12.71%)</th>
              <th className="border border-black p-1 text-right">Atrasos/Faltas</th>
              <th className="border border-black p-1 text-right">Anticipos</th>
              <th className="border border-black p-1 text-right bg-gray-200">Total Desc.</th>
              <th className="border border-black p-1 text-right bg-emerald-50 font-black">Líquido Pagable</th>
              <th className="border border-black p-1 w-20">Firma</th>
            </tr>
          </thead>
          <tbody>
            {planillaData?.Detalles?.map((det, index) => {
              const atrasosFaltas = Number(det.DescuentoAtrasos || 0) + Number(det.DescuentoFaltas || 0);
              return (
                <tr key={det.IdDetallePlanilla} className="border border-black">
                  <td className="border border-black p-1 text-center font-semibold">{index + 1}</td>
                  <td className="border border-black p-1 text-left font-bold">
                    {det.NombreCompleto || `${det.PrimerNombre || ''} ${det.ApellidoPaterno || ''}`}
                    <span className="block text-[8px] font-normal text-gray-600">{det.NombreCargo || 'Operativo'}</span>
                  </td>
                  <td className="border border-black p-1 text-center">{det.Ci || '-'}</td>
                  <td className="border border-black p-1 text-right">{Number(det.SueldoBasico || 0).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{Number(det.MontoHorasExtra || 0).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{Number(det.MontoComisiones || 0).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold bg-gray-50">{Number(det.TotalGanado || 0).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{Number(det.AporteAFP || 0).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{atrasosFaltas.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right">{Number(det.OtrasDeducciones || 0).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-bold bg-gray-50">{Number(det.TotalDescuento || 0).toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-black bg-emerald-50 text-[10px]">{Number(det.LiquidoPagable || 0).toFixed(2)}</td>
                  <td className="border border-black p-1"></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 font-extrabold text-[9px] border-t-2 border-black">
              <td colSpan={3} className="border border-black p-1 text-center uppercase">TOTALES CONSOLIDADOS:</td>
              <td className="border border-black p-1 text-right">
                {planillaData?.Detalles?.reduce((acc, d) => acc + Number(d.SueldoBasico || 0), 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right">
                {planillaData?.Detalles?.reduce((acc, d) => acc + Number(d.MontoHorasExtra || 0), 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right">
                {planillaData?.Detalles?.reduce((acc, d) => acc + Number(d.MontoComisiones || 0), 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right bg-gray-300">
                {Number(planillaData?.Planilla?.TotalSueldoBruto || 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right">
                {planillaData?.Detalles?.reduce((acc, d) => acc + Number(d.AporteAFP || 0), 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right">
                {planillaData?.Detalles?.reduce((acc, d) => acc + Number(d.DescuentoAtrasos || 0) + Number(d.DescuentoFaltas || 0), 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right">
                {planillaData?.Detalles?.reduce((acc, d) => acc + Number(d.OtrasDeducciones || 0), 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right bg-gray-300">
                {Number(planillaData?.Planilla?.TotalDeducciones || 0).toFixed(2)}
              </td>
              <td className="border border-black p-1 text-right font-black bg-emerald-100 text-[10px]">
                {Number(planillaData?.Planilla?.TotalLiquido || 0).toFixed(2)}
              </td>
              <td className="border border-black p-1"></td>
            </tr>
          </tfoot>
        </table>

        {/* Firmas Formales Legales */}
        <div className="pt-12 grid grid-cols-2 gap-12 text-center text-[10px]">
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Contabilidad General
            </div>
            <span className="text-[9px] text-gray-600">Elaborado y Revisado Conforme</span>
          </div>
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Gerencia General
            </div>
            <span className="text-[9px] text-gray-600">Shema Asociados S.R.L. - Aprobado</span>
          </div>
        </div>
      </div>

      {/* Modal Nuevo Periodo */}
      {modalNuevoPeriodo && (
      <Dialog open={modalNuevoPeriodo} onOpenChange={setModalNuevoPeriodo}>
        <DialogContent className="w-full sm:max-w-2xl p-5 sm:p-6 bg-white border border-slate-300 shadow-md rounded">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
              Crear Nuevo Periodo Mensual de Nómina
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearPeriodo} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Año</Label>
                <Input
                  type="number"
                  value={nuevoPeriodoForm.Anio}
                  onChange={(e) => setNuevoPeriodoForm(p => ({ ...p, Anio: Number(e.target.value) }))}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Mes</Label>
                <select
                  value={nuevoPeriodoForm.Mes}
                  onChange={(e) => setNuevoPeriodoForm(p => ({ ...p, Mes: Number(e.target.value) }))}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                >
                  {mesesNombres.slice(1).map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Fecha Inicio</Label>
                <Input
                  type="date"
                  value={nuevoPeriodoForm.FechaInicio}
                  onChange={(e) => setNuevoPeriodoForm(p => ({ ...p, FechaInicio: e.target.value }))}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Fecha Fin</Label>
                <Input
                  type="date"
                  value={nuevoPeriodoForm.FechaFin}
                  onChange={(e) => setNuevoPeriodoForm(p => ({ ...p, FechaFin: e.target.value }))}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNuevoPeriodo(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Crear Periodo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* Modal Editar Línea Planilla */}
      {modalEditarAbierto && (
        <ModalEditarDetallePlanilla
          detalle={detalleEditar}
          abierto={modalEditarAbierto}
          onCerrar={() => {
            setModalEditarAbierto(false);
            setDetalleEditar(null);
          }}
          onGuardado={() => {
            if (periodoSeleccionado) cargarPlanillaPeriodo(periodoSeleccionado.IdPeriodoNomina);
          }}
        />
      )}

      {/* Modal Boleta de Pago Individual */}
      {modalBoletaAbierto && (
        <BoletaPagoModal
          idDetallePlanilla={idBoletaSeleccionada}
          abierto={modalBoletaAbierto}
          onCerrar={() => {
            setModalBoletaAbierto(false);
            setIdBoletaSeleccionada(null);
          }}
        />
      )}

      {/* Modal Boletas de Pago Masivas (Todas las del periodo) */}
      {modalBoletasMasivasAbierto && (
        <BoletaPagoModal
          idPlanilla={planillaData?.Planilla?.IdPlanilla}
          modoBatch={true}
          abierto={modalBoletasMasivasAbierto}
          onCerrar={() => setModalBoletasMasivasAbierto(false)}
        />
      )}
    </div>
  );
}
