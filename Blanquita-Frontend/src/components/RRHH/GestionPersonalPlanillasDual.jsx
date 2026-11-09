import React, { useState, useEffect } from "react";
import {
  Users,
  FileSpreadsheet,
  Calculator,
  UploadCloud,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Calendar,
  Building2,
  Download,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ListarEmpleadosDual,
  GenerarPlanillaDual,
  CalcularFiniquito,
  ListarFiniquitos,
  RegistrarNoVenta,
  ListarNoVenta,
  ImportarExcelOsvaldo,
  ObtenerPeriodosNomina,
  ObtenerPlanilla,
  ObtenerBoletaPagoDoble
} from "@/services/RRHH/RRHHService";

export default function GestionPersonalPlanillasDual() {
  const [pestañaActiva, setPestañaActiva] = useState("personal"); // personal | planillas | excel | finiquitos | noventa
  
  // ==========================================
  // ESTADOS - PERSONAL DUAL
  // ==========================================
  const [subPestañaPersonal, setSubPestañaPersonal] = useState("asegurados"); // asegurados | externos
  const [empleados, setEmpleados] = useState([]);
  const [cargandoPersonal, setCargandoPersonal] = useState(false);
  const [busquedaPersonal, setBusquedaPersonal] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");

  // ==========================================
  // ESTADOS - PLANILLAS DUALES
  // ==========================================
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("");
  const [tipoPlanilla, setTipoPlanilla] = useState("INTERNA"); // OFICIAL | INTERNA
  const [planillaActual, setPlanillaActual] = useState(null);
  const [cargandoPlanilla, setCargandoPlanilla] = useState(false);
  const [generandoPlanilla, setGenerandoPlanilla] = useState(false);

  // Modal Boleta Doble
  const [modalBoletaOpen, setModalBoletaOpen] = useState(false);
  const [boletaDobleData, setBoletaDobleData] = useState(null);
  const [cargandoBoleta, setCargandoBoleta] = useState(false);

  // ==========================================
  // ESTADOS - IMPORTADOR EXCEL DON OSVALDO
  // ==========================================
  const [archivoExcel, setArchivoExcel] = useState(null);
  const [subiendoExcel, setSubiendoExcel] = useState(false);
  const [resultadoExcel, setResultadoExcel] = useState(null);

  // ==========================================
  // ESTADOS - FINIQUITOS (ART. 13 LGT)
  // ==========================================
  const [finiquitosList, setFiniquitosList] = useState([]);
  const [cargandoFiniquitos, setCargandoFiniquitos] = useState(false);
  const [modalNuevoFiniquito, setModalNuevoFiniquito] = useState(false);
  const [formFiniquito, setFormFiniquito] = useState({
    id_usuario: "",
    fecha_ingreso: "",
    fecha_retiro: "",
    motivo: "DESPIDO_INJUSTIFICADO",
    sueldo_mes_1: "",
    sueldo_mes_2: "",
    sueldo_mes_3: "",
    dias_vacacion_pendientes: "0",
    otros_beneficios: "0",
    deducciones: "0",
  });
  const [resultadoCalculoFiniquito, setResultadoCalculoFiniquito] = useState(null);
  const [calculandoFiniquito, setCalculandoFiniquito] = useState(false);

  // ==========================================
  // ESTADOS - NO VENTA PRORRATEADA
  // ==========================================
  const [deudasNoVenta, setDeudasNoVenta] = useState([]);
  const [modalNuevaNoVenta, setModalNuevaNoVenta] = useState(false);
  const [formNoVenta, setFormNoVenta] = useState({
    monto_total: "",
    concepto: "",
    mes_aplicacion: new Date().getMonth() + 1,
    anio_aplicacion: new Date().getFullYear(),
    empleados_seleccionados: []
  });
  const [guardandoNoVenta, setGuardandoNoVenta] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    cargarPersonal();
    cargarPeriodos();
    cargarFiniquitos();
    cargarNoVenta();
  }, []);

  useEffect(() => {
    cargarPersonal();
  }, [subPestañaPersonal, filtroSucursal]);

  const cargarPersonal = async () => {
    try {
      setCargandoPersonal(true);
      const asegurado = subPestañaPersonal === "asegurados";
      const data = await ListarEmpleadosDual({
        asegurado: asegurado,
        idSucursal: filtroSucursal || null,
        busqueda: busquedaPersonal
      });
      setEmpleados(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      toast.error("Error al cargar personal: " + err.message);
    } finally {
      setCargandoPersonal(false);
    }
  };

  const cargarPeriodos = async () => {
    try {
      const data = await ObtenerPeriodosNomina();
      const items = Array.isArray(data) ? data : (data.items || []);
      setPeriodos(items);
      if (items.length > 0 && !periodoSeleccionado) {
        setPeriodoSeleccionado(items[0].IdPeriodoNomina || items[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cargarPlanilla = async (idPer = periodoSeleccionado, tipo = tipoPlanilla) => {
    if (!idPer) return;
    try {
      setCargandoPlanilla(true);
      const data = await ObtenerPlanilla(idPer);
      setPlanillaActual(data);
    } catch (err) {
      setPlanillaActual(null);
    } finally {
      setCargandoPlanilla(false);
    }
  };

  const handleGenerarPlanilla = async () => {
    if (!periodoSeleccionado) {
      toast.error("Seleccione un periodo de nómina");
      return;
    }
    try {
      setGenerandoPlanilla(true);
      await GenerarPlanillaDual({
        idPeriodo: periodoSeleccionado,
        tipoPlanilla: tipoPlanilla,
        idSucursal: filtroSucursal || null
      });
      toast.success(`¡Planilla ${tipoPlanilla} generada exitosamente!`);
      await cargarPlanilla(periodoSeleccionado, tipoPlanilla);
    } catch (err) {
      toast.error(err.message || "Error al generar la planilla");
    } finally {
      setGenerandoPlanilla(false);
    }
  };

  const handleVerBoletaDoble = async (idDetalle) => {
    try {
      setCargandoBoleta(true);
      setModalBoletaOpen(true);
      const data = await ObtenerBoletaPagoDoble(idDetalle);
      setBoletaDobleData(data);
    } catch (err) {
      toast.error("Error al cargar boleta doble: " + err.message);
      setModalBoletaOpen(false);
    } finally {
      setCargandoBoleta(false);
    }
  };

  // Subir Excel de Don Osvaldo
  const handleSubirExcel = async (e) => {
    e.preventDefault();
    if (!archivoExcel) {
      toast.error("Seleccione un archivo de Excel (.xlsx / .xls)");
      return;
    }
    const formData = new FormData();
    formData.append("archivo", archivoExcel);
    if (periodoSeleccionado) formData.append("id_periodo", periodoSeleccionado);

    try {
      setSubiendoExcel(true);
      const resp = await ImportarExcelOsvaldo(formData);
      setResultadoExcel(resp);
      toast.success(`Excel procesado: ${resp.empleados_procesados || 0} empleados actualizados`);
    } catch (err) {
      toast.error(err.message || "Error al procesar el archivo Excel");
    } finally {
      setSubiendoExcel(false);
    }
  };

  // Finiquitos
  const cargarFiniquitos = async () => {
    try {
      setCargandoFiniquitos(true);
      const data = await ListarFiniquitos();
      setFiniquitosList(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoFiniquitos(false);
    }
  };

  const handleCalcularFiniquito = async (e) => {
    e.preventDefault();
    if (!formFiniquito.id_usuario || !formFiniquito.fecha_ingreso || !formFiniquito.fecha_retiro) {
      toast.error("Complete los datos requeridos");
      return;
    }

    try {
      setCalculandoFiniquito(true);
      const payload = {
        id_usuario: parseInt(formFiniquito.id_usuario),
        fecha_ingreso: formFiniquito.fecha_ingreso,
        fecha_retiro: formFiniquito.fecha_retiro,
        motivo: formFiniquito.motivo,
        sueldo_mes_1: parseFloat(formFiniquito.sueldo_mes_1) || 0,
        sueldo_mes_2: parseFloat(formFiniquito.sueldo_mes_2) || 0,
        sueldo_mes_3: parseFloat(formFiniquito.sueldo_mes_3) || 0,
        dias_vacacion_pendientes: parseInt(formFiniquito.dias_vacacion_pendientes) || 0,
        otros_beneficios: parseFloat(formFiniquito.otros_beneficios) || 0,
        deducciones: parseFloat(formFiniquito.deducciones) || 0
      };
      const res = await CalcularFiniquito(payload);
      setResultadoCalculoFiniquito(res);
      toast.success("Cálculo ministerial completado");
      await cargarFiniquitos();
    } catch (err) {
      toast.error(err.message || "Error al calcular finiquito");
    } finally {
      setCalculandoFiniquito(false);
    }
  };

  // No Venta
  const cargarNoVenta = async () => {
    try {
      const data = await ListarNoVenta();
      setDeudasNoVenta(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCrearNoVenta = async (e) => {
    e.preventDefault();
    const monto = parseFloat(formNoVenta.monto_total);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto válido mayor a 0");
      return;
    }
    if (formNoVenta.empleados_seleccionados.length === 0) {
      toast.error("Seleccione al menos un empleado para prorratear");
      return;
    }

    try {
      setGuardandoNoVenta(true);
      await RegistrarNoVenta({
        monto_total: monto,
        concepto: formNoVenta.concepto || "Descuento por mercadería no rendida / No Venta",
        mes_aplicacion: parseInt(formNoVenta.mes_aplicacion),
        anio_aplicacion: parseInt(formNoVenta.anio_aplicacion),
        id_empleados: formNoVenta.empleados_seleccionados
      });
      toast.success("¡Cuotas de No Venta prorrateadas exitosamente!");
      setModalNuevaNoVenta(false);
      setFormNoVenta({
        monto_total: "",
        concepto: "",
        mes_aplicacion: new Date().getMonth() + 1,
        anio_aplicacion: new Date().getFullYear(),
        empleados_seleccionados: []
      });
      await cargarNoVenta();
    } catch (err) {
      toast.error(err.message || "Error al registrar No Venta");
    } finally {
      setGuardandoNoVenta(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Users className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                Gestión de Personal y Planillas
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Planilla Oficial vs Interna, Control de Asistencia, Deducción No Venta y Finiquitos
              </p>
            </div>
          </div>
        </div>

        {/* Pestañas Principales */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setPestañaActiva("personal")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              pestañaActiva === "personal"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            1. Nómina de Personal
          </button>
          <button
            onClick={() => setPestañaActiva("planillas")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              pestañaActiva === "planillas"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            2. Planillas de Sueldos
          </button>
          <button
            onClick={() => setPestañaActiva("excel")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              pestañaActiva === "excel"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            3. Importar Asistencia
          </button>
          <button
            onClick={() => setPestañaActiva("finiquitos")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              pestañaActiva === "finiquitos"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            4. Finiquitos (LGT)
          </button>
          <button
            onClick={() => setPestañaActiva("noventa")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              pestañaActiva === "noventa"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
            }`}
          >
            5. No Venta Prorrateada
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN PERSONAL DUAL */}
      {/* ========================================================================= */}
      {pestañaActiva === "personal" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            {/* Sub-pestañas: Asegurado vs Externo */}
            <div className="flex gap-2">
              <Button
                variant={subPestañaPersonal === "asegurados" ? "default" : "outline"}
                size="sm"
                onClick={() => setSubPestañaPersonal("asegurados")}
                className={`text-xs font-semibold gap-1.5 ${
                  subPestañaPersonal === "asegurados" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Asegurados (Gestora 12.71%)
              </Button>
              <Button
                variant={subPestañaPersonal === "externos" ? "default" : "outline"}
                size="sm"
                onClick={() => setSubPestañaPersonal("externos")}
                className={`text-xs font-semibold gap-1.5 ${
                  subPestañaPersonal === "externos" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                Externos / Eventuales (Sin AFP)
              </Button>
            </div>

            {/* Filtros de Sucursal y Búsqueda */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filtroSucursal}
                onChange={(e) => setFiltroSucursal(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Todas las Sucursales</option>
                <option value="1">Sucursal Sucre</option>
                <option value="2">Sucursal Potosí</option>
              </select>

              <div className="relative flex-1 sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre o CI..."
                  value={busquedaPersonal}
                  onChange={(e) => setBusquedaPersonal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && cargarPersonal()}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Empleados */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Empleado</th>
                    <th className="p-3">Cédula</th>
                    <th className="p-3">Cargo / Área</th>
                    <th className="p-3">Sucursal</th>
                    <th className="p-3">Sueldo Base</th>
                    <th className="p-3">Régimen</th>
                    <th className="p-3">Fecha Ingreso</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cargandoPersonal ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        Cargando personal...
                      </td>
                    </tr>
                  ) : empleados.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        No se encontraron empleados para este filtro.
                      </td>
                    </tr>
                  ) : (
                    empleados.map((emp) => (
                      <tr key={emp.IdUsuario || emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                          {emp.NombreCompleto || `${emp.Nombres || ""} ${emp.Apellidos || ""}`}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{emp.CI || "-"}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {emp.Cargo || "Operador"} ({emp.Area || "Planta"})
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {emp.NombreSucursal || (emp.IdSucursal === 2 ? "Potosí" : "Sucre")}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400">
                          Bs. {Number(emp.SueldoBase || 0).toFixed(2)}
                        </td>
                        <td className="p-3">
                          {emp.EsAsegurado ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              Asegurado (Oficial)
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                              Externo (Interno)
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-slate-500">{emp.FechaIngreso || "-"}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-block w-2 h-2 rounded-full ${emp.Activo !== false ? "bg-emerald-500" : "bg-red-500"}`} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECCIÓN PLANILLAS DUALES */}
      {/* ========================================================================= */}
      {pestañaActiva === "planillas" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Periodo de Nómina:
                </label>
                <select
                  value={periodoSeleccionado}
                  onChange={(e) => {
                    setPeriodoSeleccionado(e.target.value);
                    cargarPlanilla(e.target.value, tipoPlanilla);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                >
                  {periodos.map((p) => (
                    <option key={p.IdPeriodoNomina || p.id} value={p.IdPeriodoNomina || p.id}>
                      {p.NombrePeriodo || `${p.Mes}/${p.Anio}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Planilla Dual */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                  Tipo de Planilla:
                </label>
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => {
                      setTipoPlanilla("OFICIAL");
                      cargarPlanilla(periodoSeleccionado, "OFICIAL");
                    }}
                    className={`text-xs px-3 py-1 rounded-md font-semibold transition-all ${
                      tipoPlanilla === "OFICIAL"
                        ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Oficial (Gestora / Min. Trabajo)
                  </button>
                  <button
                    onClick={() => {
                      setTipoPlanilla("INTERNA");
                      cargarPlanilla(periodoSeleccionado, "INTERNA");
                    }}
                    className={`text-xs px-3 py-1 rounded-md font-semibold transition-all ${
                      tipoPlanilla === "INTERNA"
                        ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Interna de Planta (Real)
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerarPlanilla}
              disabled={generandoPlanilla || !periodoSeleccionado}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 h-9 gap-1.5"
            >
              <Calculator className="h-4 w-4" />
              {generandoPlanilla ? "Calculando..." : `Generar Planilla ${tipoPlanilla}`}
            </Button>
          </div>

          {/* Tabla de la Planilla */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[11px] border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Empleado</th>
                    <th className="p-3 text-right">Sueldo Base</th>
                    {tipoPlanilla === "INTERNA" ? (
                      <>
                        <th className="p-3 text-right">Horas Extras</th>
                        <th className="p-3 text-right text-red-600">Dcto. Faltas (30d)</th>
                        <th className="p-3 text-right text-red-600">Dcto. No Venta</th>
                        <th className="p-3 text-right text-red-600">Anticipos</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3 text-right text-red-600">Aporte AFP (12.71%)</th>
                        <th className="p-3 text-right text-red-600">RC-IVA</th>
                      </>
                    )}
                    <th className="p-3 text-right font-bold text-slate-900 dark:text-white">
                      Líquido Pagable
                    </th>
                    <th className="p-3 text-center">Boleta 2 Copias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cargandoPlanilla ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        Cargando planilla...
                      </td>
                    </tr>
                  ) : !planillaActual || !planillaActual.Detalles || planillaActual.Detalles.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-400">
                        No hay planilla calculada para este periodo. Presione "Generar Planilla".
                      </td>
                    </tr>
                  ) : (
                    planillaActual.Detalles.map((det) => (
                      <tr key={det.IdDetallePlanilla} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                          {det.NombreCompleto || det.Empleado?.NombreCompleto || `Empleado #${det.IdUsuario}`}
                        </td>
                        <td className="p-3 text-right">Bs. {Number(det.SueldoBase || 0).toFixed(2)}</td>
                        {tipoPlanilla === "INTERNA" ? (
                          <>
                            <td className="p-3 text-right text-emerald-600">
                              +Bs. {Number(det.MontoHorasExtras || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-red-600">
                              -Bs. {Number(det.DescuentoFaltas || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-red-600">
                              -Bs. {Number(det.DescuentoNoVenta || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-red-600">
                              -Bs. {Number(det.Anticipos || 0).toFixed(2)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-right text-red-600">
                              -Bs. {Number(det.AporteAFP || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-red-600">
                              -Bs. {Number(det.RCIVA || 0).toFixed(2)}
                            </td>
                          </>
                        )}
                        <td className="p-3 text-right font-extrabold text-blue-600 dark:text-blue-400">
                          Bs. {Number(det.LiquidoPagable || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerBoletaDoble(det.IdDetallePlanilla)}
                            className="h-7 text-xs font-semibold text-indigo-600 hover:text-indigo-800 gap-1"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            2 Copias
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECCIÓN EXCEL DON OSVALDO */}
      {/* ========================================================================= */}
      {pestañaActiva === "excel" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-green-50 dark:bg-green-950/50 text-green-600 rounded-lg">
                <FileSpreadsheet className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">
                  Importador de Asistencia Mensual
                </h3>
                <p className="text-xs text-slate-500">
                  Procesamiento de horas trabajadas y cálculo automático de deducciones por faltas
                </p>
              </div>
            </div>

            <form onSubmit={handleSubirExcel} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Seleccionar archivo Excel (.xlsx / .xls):
                </label>
                <Input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setArchivoExcel(e.target.files[0])}
                  className="text-xs cursor-pointer"
                />
              </div>

              <Button
                type="submit"
                disabled={subiendoExcel || !archivoExcel}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-2"
              >
                <UploadCloud className="h-4 w-4" />
                {subiendoExcel ? "Procesando Asistencia..." : "Importar y Aplicar Faltas"}
              </Button>
            </form>

            {resultadoExcel && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 rounded-lg text-xs space-y-1">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  Procesamiento Exitoso:
                </p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  • Empleados identificados y procesados: {resultadoExcel.empleados_procesados || 0}
                </p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  • Total de horas efectivas leídas: {resultadoExcel.total_horas_leidas || 0} hrs
                </p>
                <p className="text-emerald-700 dark:text-emerald-400">
                  • Faltas (valores negativos) registradas: {resultadoExcel.total_faltas_registradas || 0}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECCIÓN FINIQUITOS (ART. 13 LGT) */}
      {/* ========================================================================= */}
      {pestañaActiva === "finiquitos" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                Liquidaciones y Finiquitos Laborales (Ley General del Trabajo)
              </h3>
              <p className="text-xs text-slate-500">
                Cálculo exacto por diferencia de fechas calendario. Requiere antigüedad mínima de 3 meses (≥ 90 días).
              </p>
            </div>
            <Button
              onClick={() => setModalNuevoFiniquito(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5"
            >
              <Calculator className="h-4 w-4" />
              Nuevo Cálculo Ministerial
            </Button>
          </div>

          {/* Listado de Finiquitos */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 uppercase text-[11px] border-b">
                <tr>
                  <th className="p-3">Trabajador</th>
                  <th className="p-3">Periodo Laboral</th>
                  <th className="p-3">Antigüedad Calendario</th>
                  <th className="p-3">Sueldo Promedio</th>
                  <th className="p-3">Indemnización (Art. 13)</th>
                  <th className="p-3 text-right">Líquido Finiquito</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cargandoFiniquitos ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      Cargando finiquitos...
                    </td>
                  </tr>
                ) : finiquitosList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400">
                      No hay registros de finiquitos procesados.
                    </td>
                  </tr>
                ) : (
                  finiquitosList.map((f) => (
                    <tr key={f.IdFiniquito || f.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                        {f.NombreEmpleado || `Empleado #${f.IdUsuario}`}
                      </td>
                      <td className="p-3 text-slate-600">
                        {f.FechaIngreso} al {f.FechaRetiro}
                      </td>
                      <td className="p-3 font-medium text-slate-700">
                        {f.AniosServicio}a {f.MesesServicio}m {f.DiasServicio}d
                      </td>
                      <td className="p-3">Bs. {Number(f.SueldoPromedio || 0).toFixed(2)}</td>
                      <td className="p-3 font-semibold text-emerald-600">
                        Bs. {Number(f.IndemnizacionLegal || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-extrabold text-blue-600">
                        Bs. {Number(f.LiquidoPagable || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge className="bg-emerald-100 text-emerald-800">
                          {f.Estado || "CALCULADO"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SECCIÓN NO VENTA PRORRATEADA */}
      {/* ========================================================================= */}
      {pestañaActiva === "noventa" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                Deducción Compartida de "No Venta"
              </h3>
              <p className="text-xs text-slate-500">
                Prorrateo en partes iguales entre los trabajadores involucrados para descontar en la planilla interna
              </p>
            </div>
            <Button
              onClick={() => setModalNuevaNoVenta(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5"
            >
              <DollarSign className="h-4 w-4" />
              Registrar Deuda Compartida
            </Button>
          </div>

          {/* Listado de No Venta */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 uppercase text-[11px] border-b">
                <tr>
                  <th className="p-3">Concepto</th>
                  <th className="p-3">Periodo Aplicación</th>
                  <th className="p-3">Monto Global</th>
                  <th className="p-3">Trabajadores</th>
                  <th className="p-3">Cuota Individual</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {deudasNoVenta.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      No hay registros de "No Venta" pendientes de deducción.
                    </td>
                  </tr>
                ) : (
                  deudasNoVenta.map((nv) => (
                    <tr key={nv.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                        {nv.concepto}
                      </td>
                      <td className="p-3 text-slate-600">
                        {nv.mes_aplicacion}/{nv.anio_aplicacion}
                      </td>
                      <td className="p-3 font-bold text-red-600">
                        Bs. {Number(nv.monto_total || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-slate-600">{nv.cantidad_empleados || 0} personas</td>
                      <td className="p-3 font-semibold text-amber-600">
                        Bs. {Number(nv.cuota_individual || 0).toFixed(2)} / persona
                      </td>
                      <td className="p-3 text-center">
                        <Badge className="bg-amber-100 text-amber-800">
                          {nv.estado || "PENDIENTE"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL BOLETA DOBLE (2 COPIAS POR HOJA: COPIA TRABAJADOR Y COPIA EMPRESA) */}
      {/* ========================================================================= */}
      <Dialog open={modalBoletaOpen} onOpenChange={setModalBoletaOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 border shadow-xl rounded-xl">
          <DialogHeader className="border-b pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Printer className="h-5 w-5 text-indigo-600" />
              Papeleta de Pago - 2 Copias por Hoja
            </DialogTitle>
            <Button
              onClick={() => window.print()}
              disabled={cargandoBoleta || !boletaDobleData}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold gap-1.5 h-8"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Duplicado Oficial
            </Button>
          </DialogHeader>

          {cargandoBoleta ? (
            <div className="py-12 text-center text-slate-400">Cargando boleta en formato dual...</div>
          ) : !boletaDobleData ? (
            <div className="py-12 text-center text-slate-400">No se encontraron datos.</div>
          ) : (
            <div className="space-y-6 print:m-0 print:p-0">
              {/* COPIA 1: TRABAJADOR */}
              <div className="p-5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs space-y-3 bg-white dark:bg-slate-950">
                <div className="flex justify-between items-start border-b pb-2">
                  <div>
                    <h4 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">
                      PAPELERA BLANQUITA (SHEMA ASOCIADOS S.R.L.)
                    </h4>
                    <p className="text-[10px] text-slate-500">NIT: 1028475024 | Sucre - Bolivia</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 uppercase font-bold text-[10px]">
                    COPIA 1: TRABAJADOR
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Trabajador:</span>
                    <span className="font-bold">{boletaDobleData.Empleado?.NombreCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">CI:</span>
                    <span className="font-semibold">{boletaDobleData.Empleado?.CI}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Líquido Pagable:</span>
                    <span className="font-extrabold text-blue-600">
                      Bs. {Number(boletaDobleData.LiquidoPagable || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                  <div>
                    <span className="font-semibold text-emerald-700 block mb-1">Total Haberes:</span>
                    <p>Bs. {Number(boletaDobleData.TotalGanado || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-red-700 block mb-1">Total Descuentos:</span>
                    <p>Bs. {Number(boletaDobleData.TotalDescuentos || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px]">
                  <div className="border-t border-slate-400 pt-1">Firma Empleador</div>
                  <div className="border-t border-slate-400 pt-1">Firma Trabajador</div>
                </div>
              </div>

              {/* LÍNEA DE CORTE */}
              <div className="border-t-2 border-dashed border-slate-400 my-2 text-center relative">
                <span className="bg-white dark:bg-slate-900 px-3 text-[10px] text-slate-400 -top-2.5 relative font-mono">
                  - - - - - - CORTAR AQUÍ (COPIA EMPRESA / TRABAJADOR) - - - - - -
                </span>
              </div>

              {/* COPIA 2: EMPRESA */}
              <div className="p-5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs space-y-3 bg-white dark:bg-slate-950">
                <div className="flex justify-between items-start border-b pb-2">
                  <div>
                    <h4 className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">
                      PAPELERA BLANQUITA (SHEMA ASOCIADOS S.R.L.)
                    </h4>
                    <p className="text-[10px] text-slate-500">NIT: 1028475024 | Sucre - Bolivia</p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200 uppercase font-bold text-[10px]">
                    COPIA 2: EMPRESA (ARCHIVO RRHH)
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Trabajador:</span>
                    <span className="font-bold">{boletaDobleData.Empleado?.NombreCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">CI:</span>
                    <span className="font-semibold">{boletaDobleData.Empleado?.CI}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Líquido Pagable:</span>
                    <span className="font-extrabold text-blue-600">
                      Bs. {Number(boletaDobleData.LiquidoPagable || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                  <div>
                    <span className="font-semibold text-emerald-700 block mb-1">Total Haberes:</span>
                    <p>Bs. {Number(boletaDobleData.TotalGanado || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-red-700 block mb-1">Total Descuentos:</span>
                    <p>Bs. {Number(boletaDobleData.TotalDescuentos || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px]">
                  <div className="border-t border-slate-400 pt-1">Firma Empleador</div>
                  <div className="border-t border-slate-400 pt-1">Firma Trabajador (Recibí Conforme)</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL NUEVO FINIQUITO (MINISTERIAL ART. 13 LGT) */}
      {/* ========================================================================= */}
      <Dialog open={modalNuevoFiniquito} onOpenChange={setModalNuevoFiniquito}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-indigo-600" />
              Cálculo de Finiquito según Art. 13 LGT
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCalcularFiniquito} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Empleado:
                </label>
                <select
                  value={formFiniquito.id_usuario}
                  onChange={(e) => {
                    const emp = empleados.find((x) => (x.IdUsuario || x.id) == e.target.value);
                    setFormFiniquito({
                      ...formFiniquito,
                      id_usuario: e.target.value,
                      fecha_ingreso: emp?.FechaIngreso || "",
                      sueldo_mes_1: emp?.SueldoBase || "",
                      sueldo_mes_2: emp?.SueldoBase || "",
                      sueldo_mes_3: emp?.SueldoBase || ""
                    });
                  }}
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">Seleccione un empleado...</option>
                  {empleados.map((emp) => (
                    <option key={emp.IdUsuario || emp.id} value={emp.IdUsuario || emp.id}>
                      {emp.NombreCompleto || `${emp.Nombres} ${emp.Apellidos}`} (CI: {emp.CI})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Motivo de Retiro:
                </label>
                <select
                  value={formFiniquito.motivo}
                  onChange={(e) => setFormFiniquito({ ...formFiniquito, motivo: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="DESPIDO_INJUSTIFICADO">Despido Intempestivo / Injustificado</option>
                  <option value="RETIRO_VOLUNTARIO">Retiro Voluntario</option>
                  <option value="CONCLUSION_CONTRATO">Conclusión de Contrato</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Fecha de Ingreso:
                </label>
                <Input
                  type="date"
                  value={formFiniquito.fecha_ingreso}
                  onChange={(e) => setFormFiniquito({ ...formFiniquito, fecha_ingreso: e.target.value })}
                  required
                  className="text-xs h-8"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Fecha de Retiro:
                </label>
                <Input
                  type="date"
                  value={formFiniquito.fecha_retiro}
                  onChange={(e) => setFormFiniquito({ ...formFiniquito, fecha_retiro: e.target.value })}
                  required
                  className="text-xs h-8"
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Últimos 3 Sueldos Percibidos (Base Promedio):
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">Mes 1 (Bs):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formFiniquito.sueldo_mes_1}
                    onChange={(e) => setFormFiniquito({ ...formFiniquito, sueldo_mes_1: e.target.value })}
                    required
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Mes 2 (Bs):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formFiniquito.sueldo_mes_2}
                    onChange={(e) => setFormFiniquito({ ...formFiniquito, sueldo_mes_2: e.target.value })}
                    required
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Mes 3 (Bs):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formFiniquito.sueldo_mes_3}
                    onChange={(e) => setFormFiniquito({ ...formFiniquito, sueldo_mes_3: e.target.value })}
                    required
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={calculandoFiniquito}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9"
            >
              {calculandoFiniquito ? "Calculando..." : "Calcular Beneficios Sociales"}
            </Button>
          </form>

          {resultadoCalculoFiniquito && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-2 mt-2">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Antigüedad Calculada:
                </span>
                <span className="font-bold text-indigo-600">
                  {resultadoCalculoFiniquito.AniosServicio} años, {resultadoCalculoFiniquito.MesesServicio} meses, {resultadoCalculoFiniquito.DiasServicio} días
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div>• Sueldo Promedio: Bs. {Number(resultadoCalculoFiniquito.SueldoPromedio || 0).toFixed(2)}</div>
                <div>• Indemnización: Bs. {Number(resultadoCalculoFiniquito.IndemnizacionLegal || 0).toFixed(2)}</div>
                <div>• Aguinaldo Duodécimas: Bs. {Number(resultadoCalculoFiniquito.AguinaldoDuodecimas || 0).toFixed(2)}</div>
                <div>• Vacación Pendiente: Bs. {Number(resultadoCalculoFiniquito.VacacionCompensable || 0).toFixed(2)}</div>
              </div>
              <div className="border-t pt-2 flex justify-between items-center text-sm font-extrabold text-blue-600">
                <span>TOTAL A LIQUIDAR:</span>
                <span>Bs. {Number(resultadoCalculoFiniquito.LiquidoPagable || 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL NUEVA NO VENTA COMPARTIDA */}
      {/* ========================================================================= */}
      <Dialog open={modalNuevaNoVenta} onOpenChange={setModalNuevaNoVenta}>
        <DialogContent className="w-full sm:max-w-md p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-600" />
              Prorrateo de "No Venta" Compartida
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearNoVenta} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Monto Total a Descontar (Bs):
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ej. 1200"
                value={formNoVenta.monto_total}
                onChange={(e) => setFormNoVenta({ ...formNoVenta, monto_total: e.target.value })}
                required
                className="text-xs h-8"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Concepto / Justificación:
              </label>
              <Input
                placeholder="Faltante de fardo o mercadería no entregada"
                value={formNoVenta.concepto}
                onChange={(e) => setFormNoVenta({ ...formNoVenta, concepto: e.target.value })}
                required
                className="text-xs h-8"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Seleccionar Trabajadores Responsables:
              </label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1.5 text-xs">
                {empleados.map((emp) => {
                  const idEmp = emp.IdUsuario || emp.id;
                  const seleccionado = formNoVenta.empleados_seleccionados.includes(idEmp);
                  return (
                    <label key={idEmp} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={(e) => {
                          const nuevo = e.target.checked
                            ? [...formNoVenta.empleados_seleccionados, idEmp]
                            : formNoVenta.empleados_seleccionados.filter((x) => x !== idEmp);
                          setFormNoVenta({ ...formNoVenta, empleados_seleccionados: nuevo });
                        }}
                      />
                      <span>{emp.NombreCompleto || `${emp.Nombres} ${emp.Apellidos}`}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {formNoVenta.monto_total && formNoVenta.empleados_seleccionados.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800">
                Cuota por trabajador: Bs.{" "}
                {(
                  parseFloat(formNoVenta.monto_total) /
                  formNoVenta.empleados_seleccionados.length
                ).toFixed(2)}{" "}
                ({formNoVenta.empleados_seleccionados.length} empleados)
              </div>
            )}

            <Button
              type="submit"
              disabled={guardandoNoVenta}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9"
            >
              {guardandoNoVenta ? "Guardando..." : "Asignar Deducciones"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
