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
import StatusBadge from "@/components/common/StatusBadge";
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
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/stores/branchStore";

export default function GestionPersonalPlanillasDual({ usuario = null }) {
  const {
    sucursal,
    setSucursal,
    esMultisede,
    listoParaConsultar,
    sucursalesPermitidas
  } = usePaginaSucursal({
    permiteTodas: true,
    usuario
  });

  const [pestañaActiva, setPestañaActiva] = useState("personal"); // personal | planillas | excel | finiquitos | noventa
  
  // ==========================================
  // ESTADOS - PERSONAL DUAL
  // ==========================================
  const [subPestañaPersonal, setSubPestañaPersonal] = useState("asegurados"); // asegurados | externos
  const [empleados, setEmpleados] = useState([]);
  const [cargandoPersonal, setCargandoPersonal] = useState(false);
  const [busquedaPersonal, setBusquedaPersonal] = useState("");

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

  // Paginación
  const paginacionPersonal = usePaginacion(empleados, 10);
  const paginacionPlanilla = usePaginacion(planillaActual?.Detalles || [], 15);

  // Cargar datos iniciales
  useEffect(() => {
    if (listoParaConsultar) {
      cargarPersonal();
      cargarPeriodos();
      cargarFiniquitos();
      cargarNoVenta();
    }
  }, [listoParaConsultar]);

  useEffect(() => {
    if (listoParaConsultar) {
      cargarPersonal();
    }
  }, [subPestañaPersonal, sucursal, listoParaConsultar]);

  const cargarPersonal = async () => {
    if (!listoParaConsultar) return;
    try {
      setCargandoPersonal(true);
      const asegurado = subPestañaPersonal === "asegurados";
      const sid = sucursal === "todas" ? null : Number(sucursal);
      const data = await ListarEmpleadosDual({
        asegurado: asegurado,
        idSucursal: sid,
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
      const unicos = [];
      const vistos = new Set();
      for (const it of items) {
        const id = it.IdPeriodoNomina || it.id;
        if (!vistos.has(id)) {
          vistos.add(id);
          unicos.push(it);
        }
      }
      setPeriodos(unicos);
      if (unicos.length > 0 && !periodoSeleccionado) {
        setPeriodoSeleccionado(unicos[0].IdPeriodoNomina || unicos[0].id);
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
    if (sucursal === "todas") {
      toast.error("Seleccione Sucre o Potosí para generar la nómina. No es posible generar nóminas consolidadas para ambas sedes.");
      return;
    }
    if (!periodoSeleccionado) {
      toast.error("Seleccione un periodo de nómina");
      return;
    }
    try {
      setGenerandoPlanilla(true);
      await GenerarPlanillaDual({
        idPeriodo: periodoSeleccionado,
        tipoPlanilla: tipoPlanilla,
        idSucursal: Number(sucursal)
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
      {/* Encabezado con PageHeader y BranchFilter Unificado */}
      <PageHeader
        title="Gestión de Personal y Planillas"
        subtitle="Planilla Oficial vs Interna, Control de Asistencia, Deducción No Venta y Finiquitos"
        branchFilter={
          <BranchFilter
            sucursal={sucursal}
            onChange={setSucursal}
            sucursales={sucursalesPermitidas}
            esMultisede={esMultisede}
            permiteTodas={true}
          />
        }
      />

      {/* Pestañas Principales Compartidas */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded border border-slate-200 text-xs font-medium">
        <button
          onClick={() => setPestañaActiva("personal")}
          className={`px-3 py-1.5 rounded transition-colors ${
            pestañaActiva === "personal"
              ? "bg-white text-slate-900 border border-slate-200 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          1. Nómina de Personal
        </button>
        <button
          onClick={() => setPestañaActiva("planillas")}
          className={`px-3 py-1.5 rounded transition-colors ${
            pestañaActiva === "planillas"
              ? "bg-white text-slate-900 border border-slate-200 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          2. Planillas de Sueldos
        </button>
        <button
          onClick={() => setPestañaActiva("excel")}
          className={`px-3 py-1.5 rounded transition-colors ${
            pestañaActiva === "excel"
              ? "bg-white text-slate-900 border border-slate-200 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          3. Importar Asistencia
        </button>
        <button
          onClick={() => setPestañaActiva("finiquitos")}
          className={`px-3 py-1.5 rounded transition-colors ${
            pestañaActiva === "finiquitos"
              ? "bg-white text-slate-900 border border-slate-200 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          4. Finiquitos (LGT)
        </button>
        <button
          onClick={() => setPestañaActiva("noventa")}
          className={`px-3 py-1.5 rounded transition-colors ${
            pestañaActiva === "noventa"
              ? "bg-white text-slate-900 border border-slate-200 font-semibold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          5. No Venta Prorrateada
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN PERSONAL DUAL */}
      {/* ========================================================================= */}
      {pestañaActiva === "personal" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3.5 rounded border border-slate-200">
            {/* Sub-pestañas: Asegurado vs Externo */}
            <div className="flex gap-2">
              <Button
                variant={subPestañaPersonal === "asegurados" ? "default" : "outline"}
                size="sm"
                onClick={() => setSubPestañaPersonal("asegurados")}
                className={`text-xs font-medium gap-1.5 h-8 rounded ${
                  subPestañaPersonal === "asegurados" ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Asegurados (Gestora 12.71%)
              </Button>
              <Button
                variant={subPestañaPersonal === "externos" ? "default" : "outline"}
                size="sm"
                onClick={() => setSubPestañaPersonal("externos")}
                className={`text-xs font-medium gap-1.5 h-8 rounded ${
                  subPestañaPersonal === "externos" ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300"
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                Externos / Eventuales (Sin AFP)
              </Button>
            </div>

            {/* Búsqueda de Personal */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre o CI..."
                  value={busquedaPersonal}
                  onChange={(e) => setBusquedaPersonal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && cargarPersonal()}
                  className="pl-8 text-xs h-8 rounded border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Empleados */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Empleado</th>
                    <th className="py-2.5 px-3">Cédula</th>
                    <th className="py-2.5 px-3">Cargo / Área</th>
                    <th className="py-2.5 px-3">Sucursal</th>
                    <th className="py-2.5 px-3 text-right">Sueldo Base</th>
                    <th className="py-2.5 px-3">Régimen</th>
                    <th className="py-2.5 px-3">Fecha Ingreso</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargandoPersonal ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500">
                        Cargando personal...
                      </td>
                    </tr>
                  ) : empleados.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500">
                        No se encontraron empleados para este filtro.
                      </td>
                    </tr>
                  ) : (
                    paginacionPersonal.itemsPaginados.map((emp, idx) => (
                      <tr key={`emp-${emp.IdUsuario || emp.id || idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {emp.NombreCompleto || `${emp.Nombres || ""} ${emp.Apellidos || ""}`}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">{emp.CI || "-"}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {emp.Cargo || "Operador"} ({emp.Area || "Planta"})
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {emp.NombreSucursal || (emp.IdSucursal === 2 ? "Potosí" : "Sucre")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          Bs. {Number(emp.SueldoBase || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge
                            estado={emp.EsAsegurado ? "APROBADO" : "OBSERVADO"}
                            label={emp.EsAsegurado ? "Asegurado (Oficial)" : "Externo (Interno)"}
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">{emp.FechaIngreso || "-"}</td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge estado={emp.Activo !== false ? "ACTIVO" : "INACTIVO"} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {empleados.length > 0 && <PaginacionTabla {...paginacionPersonal} />}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECCIÓN PLANILLAS DUALES */}
      {/* ========================================================================= */}
      {pestañaActiva === "planillas" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3.5 rounded border border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                  Periodo de Nómina:
                </label>
                <select
                  value={periodoSeleccionado}
                  onChange={(e) => {
                    setPeriodoSeleccionado(e.target.value);
                    cargarPlanilla(e.target.value, tipoPlanilla);
                  }}
                  className="text-xs px-2.5 h-8 rounded border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {periodos.map((p, idx) => {
                    const val = p.IdPeriodoNomina || p.id;
                    return (
                      <option key={`periodo-${val}-${idx}`} value={val}>
                        {p.NombrePeriodo || `${p.Mes}/${p.Anio}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Selector de Planilla Dual */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                  Tipo de Planilla:
                </label>
                <div className="flex gap-1 bg-slate-100 p-1 rounded border border-slate-200">
                  <button
                    onClick={() => {
                      setTipoPlanilla("OFICIAL");
                      cargarPlanilla(periodoSeleccionado, "OFICIAL");
                    }}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${
                      tipoPlanilla === "OFICIAL"
                        ? "bg-white text-slate-900 border border-slate-200 font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Oficial (Gestora / Min. Trabajo)
                  </button>
                  <button
                    onClick={() => {
                      setTipoPlanilla("INTERNA");
                      cargarPlanilla(periodoSeleccionado, "INTERNA");
                    }}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${
                      tipoPlanilla === "INTERNA"
                        ? "bg-white text-slate-900 border border-slate-200 font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Interna de Planta (Real)
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerarPlanilla}
              disabled={generandoPlanilla || !periodoSeleccionado || sucursal === "todas"}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium px-3 h-8 gap-1.5 rounded cursor-pointer"
            >
              <Calculator className="h-3.5 w-3.5" />
              {generandoPlanilla ? "Calculando..." : `Generar Planilla ${tipoPlanilla}`}
            </Button>
          </div>

          {/* Aviso preventivo cuando el filtro está en 'Todas' */}
          {sucursal === "todas" && (
            <div className="flex items-center gap-2.5 p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Seleccione Sucre o Potosí para generar la nómina. No es posible generar nóminas consolidadas para ambas sedes simultáneamente.</span>
            </div>
          )}

          {/* Tabla de la Planilla */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Empleado</th>
                    <th className="py-2.5 px-3 text-right">Sueldo Base</th>
                    {tipoPlanilla === "INTERNA" ? (
                      <>
                        <th className="py-2.5 px-3 text-right text-emerald-700">Horas Extras</th>
                        <th className="py-2.5 px-3 text-right text-red-700">Dcto. Faltas (30d)</th>
                        <th className="py-2.5 px-3 text-right text-red-700">Dcto. No Venta</th>
                        <th className="py-2.5 px-3 text-right text-red-700">Anticipos</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-3 text-right text-red-700">Aporte AFP (12.71%)</th>
                        <th className="py-2.5 px-3 text-right text-red-700">RC-IVA</th>
                      </>
                    )}
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">
                      Líquido Pagable
                    </th>
                    <th className="py-2.5 px-3 text-center">Boleta 2 Copias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cargandoPlanilla ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500">
                        Cargando planilla...
                      </td>
                    </tr>
                  ) : !planillaActual || !planillaActual.Detalles || planillaActual.Detalles.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500">
                        No hay planilla calculada para este periodo. Presione "Generar Planilla".
                      </td>
                    </tr>
                  ) : (
                    paginacionPlanilla.itemsPaginados.map((det, idx) => (
                      <tr key={`det-${det.IdDetallePlanilla || idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {det.NombreCompleto || det.Empleado?.NombreCompleto || `Empleado #${det.IdUsuario}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          Bs. {Number(det.SueldoBase || 0).toFixed(2)}
                        </td>
                        {tipoPlanilla === "INTERNA" ? (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                              +Bs. {Number(det.MontoHorasExtras || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-700">
                              -Bs. {Number(det.DescuentoFaltas || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-700">
                              -Bs. {Number(det.DescuentoNoVenta || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-700">
                              -Bs. {Number(det.Anticipos || 0).toFixed(2)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-700">
                              -Bs. {Number(det.AporteAFP || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-700">
                              -Bs. {Number(det.RCIVA || 0).toFixed(2)}
                            </td>
                          </>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          Bs. {Number(det.LiquidoPagable || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerBoletaDoble(det.IdDetallePlanilla)}
                            className="h-7 text-xs font-medium text-slate-700 hover:bg-slate-50 border-slate-300 gap-1 rounded"
                          >
                            <Printer className="h-3 w-3" />
                            2 Copias
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {planillaActual?.Detalles?.length > 0 && <PaginacionTabla {...paginacionPlanilla} />}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECCIÓN EXCEL DON OSVALDO */}
      {/* ========================================================================= */}
      {pestañaActiva === "excel" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Importador de Asistencia Mensual
                </h3>
                <p className="text-xs text-slate-600">
                  Procesamiento de horas trabajadas y cálculo automático de deducciones por faltas
                </p>
              </div>
            </div>

            <form onSubmit={handleSubirExcel} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Seleccionar archivo Excel (.xlsx / .xls):
                </label>
                <Input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setArchivoExcel(e.target.files[0])}
                  className="text-xs cursor-pointer h-9 rounded border-slate-300"
                />
              </div>

              <Button
                type="submit"
                disabled={subiendoExcel || !archivoExcel}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs h-8 gap-2 rounded"
              >
                <UploadCloud className="h-4 w-4" />
                {subiendoExcel ? "Procesando Asistencia..." : "Importar y Aplicar Faltas"}
              </Button>
            </form>

            {resultadoExcel && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <p className="font-bold text-slate-900">
                  Procesamiento Exitoso:
                </p>
                <p className="text-slate-700 font-mono tabular-nums">
                  • Empleados identificados y procesados: {resultadoExcel.empleados_procesados || 0}
                </p>
                <p className="text-slate-700 font-mono tabular-nums">
                  • Total de horas efectivas leídas: {resultadoExcel.total_horas_leidas || 0} hrs
                </p>
                <p className="text-slate-700 font-mono tabular-nums">
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
          <div className="flex justify-between items-center bg-white p-3.5 sm:p-4 rounded border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Liquidaciones y Finiquitos Laborales (Ley General del Trabajo)
              </h3>
              <p className="text-xs text-slate-600">
                Cálculo exacto por diferencia de fechas calendario. Requiere antigüedad mínima de 3 meses (≥ 90 días).
              </p>
            </div>
            <Button
              onClick={() => setModalNuevoFiniquito(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium gap-1.5 h-8 rounded"
            >
              <Calculator className="h-3.5 w-3.5" />
              Nuevo Cálculo Ministerial
            </Button>
          </div>

          {/* Listado de Finiquitos */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Trabajador</th>
                  <th className="py-2.5 px-3">Periodo Laboral</th>
                  <th className="py-2.5 px-3">Antigüedad Calendario</th>
                  <th className="py-2.5 px-3 text-right">Sueldo Promedio</th>
                  <th className="py-2.5 px-3 text-right">Indemnización (Art. 13)</th>
                  <th className="py-2.5 px-3 text-right">Líquido Finiquito</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargandoFiniquitos ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      Cargando finiquitos...
                    </td>
                  </tr>
                ) : finiquitosList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      No hay registros de finiquitos procesados.
                    </td>
                  </tr>
                ) : (
                  finiquitosList.map((f, idx) => (
                    <tr key={`fin-${f.IdFiniquito || f.id || idx}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {f.NombreEmpleado || `Empleado #${f.IdUsuario}`}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                        {f.FechaIngreso} al {f.FechaRetiro}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                        {f.AniosServicio}a {f.MesesServicio}m {f.DiasServicio}d
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        Bs. {Number(f.SueldoPromedio || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        Bs. {Number(f.IndemnizacionLegal || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        Bs. {Number(f.LiquidoPagable || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge estado={f.Estado || "CALCULADO"} />
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
          <div className="flex justify-between items-center bg-white p-3.5 sm:p-4 rounded border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Deducción Compartida de "No Venta"
              </h3>
              <p className="text-xs text-slate-600">
                Prorrateo en partes iguales entre los trabajadores involucrados para descontar en la planilla interna
              </p>
            </div>
            <Button
              onClick={() => setModalNuevaNoVenta(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium gap-1.5 h-8 rounded"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Registrar Deuda Compartida
            </Button>
          </div>

          {/* Listado de No Venta */}
          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-700 uppercase text-[11px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Concepto</th>
                  <th className="py-2.5 px-3">Periodo Aplicación</th>
                  <th className="py-2.5 px-3 text-right">Monto Global</th>
                  <th className="py-2.5 px-3">Trabajadores</th>
                  <th className="py-2.5 px-3 text-right">Cuota Individual</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deudasNoVenta.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-500">
                      No hay registros de "No Venta" pendientes de deducción.
                    </td>
                  </tr>
                ) : (
                  deudasNoVenta.map((nv, idx) => (
                    <tr key={`nv-${nv.id || idx}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {nv.concepto}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                        {nv.mes_aplicacion}/{nv.anio_aplicacion}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-red-700 font-medium">
                        Bs. {Number(nv.monto_total || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">{nv.cantidad_empleados || 0} personas</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        Bs. {Number(nv.cuota_individual || 0).toFixed(2)} / pers.
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge estado={nv.estado || "PENDIENTE"} />
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
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 bg-white border border-slate-300 shadow-md rounded">
          <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Printer className="h-4 w-4 text-slate-700" />
              Papeleta de Pago - 2 Copias por Hoja
            </DialogTitle>
            <Button
              onClick={() => window.print()}
              disabled={cargandoBoleta || !boletaDobleData}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium gap-1.5 h-8 rounded"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir Duplicado Oficial
            </Button>
          </DialogHeader>

          {cargandoBoleta ? (
            <div className="py-12 text-center text-slate-500">Cargando boleta en formato dual...</div>
          ) : !boletaDobleData ? (
            <div className="py-12 text-center text-slate-500">No se encontraron datos.</div>
          ) : (
            <div className="space-y-6 print:m-0 print:p-0">
              {/* COPIA 1: TRABAJADOR */}
              <div className="p-4 border border-slate-300 rounded text-xs space-y-3 bg-white print:border-black">
                <div className="flex justify-between items-start border-b border-slate-200 pb-2 print:border-black">
                  <div>
                    <h4 className="font-bold text-sm uppercase text-slate-900 print:text-black">
                      PAPELERA BLANQUITA (SHEMA ASOCIADOS S.R.L.)
                    </h4>
                    <p className="text-[10px] text-slate-600 font-mono print:text-black">NIT: 1028475024 | Sucre - Bolivia</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border border-slate-300 bg-slate-50 text-slate-700 print:border-black print:text-black">
                    COPIA 1: TRABAJADOR
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] print:bg-transparent print:border-black">
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">Trabajador:</span>
                    <span className="font-bold text-slate-900">{boletaDobleData.Empleado?.NombreCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">CI:</span>
                    <span className="font-mono tabular-nums text-slate-800">{boletaDobleData.Empleado?.CI}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">Líquido Pagable:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      Bs. {Number(boletaDobleData.LiquidoPagable || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                  <div>
                    <span className="font-semibold text-emerald-800 block mb-1">Total Haberes:</span>
                    <p className="font-mono tabular-nums text-slate-900">Bs. {Number(boletaDobleData.TotalGanado || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-red-800 block mb-1">Total Descuentos:</span>
                    <p className="font-mono tabular-nums text-slate-900">Bs. {Number(boletaDobleData.TotalDescuentos || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px]">
                  <div className="border-t border-slate-400 pt-1 font-medium text-slate-700 print:border-black print:text-black">Firma Empleador</div>
                  <div className="border-t border-slate-400 pt-1 font-medium text-slate-700 print:border-black print:text-black">Firma Trabajador</div>
                </div>
              </div>

              {/* LÍNEA DE CORTE */}
              <div className="border-t-2 border-dashed border-slate-400 my-2 text-center relative print:border-black">
                <span className="bg-white px-3 text-[10px] text-slate-500 -top-2.5 relative font-mono print:text-black">
                  - - - - - - CORTAR AQUÍ (COPIA EMPRESA / TRABAJADOR) - - - - - -
                </span>
              </div>

              {/* COPIA 2: EMPRESA */}
              <div className="p-4 border border-slate-300 rounded text-xs space-y-3 bg-white print:border-black">
                <div className="flex justify-between items-start border-b border-slate-200 pb-2 print:border-black">
                  <div>
                    <h4 className="font-bold text-sm uppercase text-slate-900 print:text-black">
                      PAPELERA BLANQUITA (SHEMA ASOCIADOS S.R.L.)
                    </h4>
                    <p className="text-[10px] text-slate-600 font-mono print:text-black">NIT: 1028475024 | Sucre - Bolivia</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border border-slate-300 bg-slate-50 text-slate-700 print:border-black print:text-black">
                    COPIA 2: EMPRESA (ARCHIVO RRHH)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] print:bg-transparent print:border-black">
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">Trabajador:</span>
                    <span className="font-bold text-slate-900">{boletaDobleData.Empleado?.NombreCompleto}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">CI:</span>
                    <span className="font-mono tabular-nums text-slate-800">{boletaDobleData.Empleado?.CI}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-semibold">Líquido Pagable:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      Bs. {Number(boletaDobleData.LiquidoPagable || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                  <div>
                    <span className="font-semibold text-emerald-800 block mb-1">Total Haberes:</span>
                    <p className="font-mono tabular-nums text-slate-900">Bs. {Number(boletaDobleData.TotalGanado || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-red-800 block mb-1">Total Descuentos:</span>
                    <p className="font-mono tabular-nums text-slate-900">Bs. {Number(boletaDobleData.TotalDescuentos || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px]">
                  <div className="border-t border-slate-400 pt-1 font-medium text-slate-700 print:border-black print:text-black">Firma Empleador</div>
                  <div className="border-t border-slate-400 pt-1 font-medium text-slate-700 print:border-black print:text-black">Firma Trabajador (Recibí Conforme)</div>
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
        <DialogContent className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 bg-white border border-slate-300 shadow-md rounded">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-slate-700" />
              Cálculo de Finiquito según Art. 13 LGT
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCalcularFiniquito} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
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
                  className="w-full px-2.5 h-8 rounded border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">Seleccione un empleado...</option>
                  {empleados.map((emp, idx) => (
                    <option key={`opt-fin-emp-${emp.IdUsuario || emp.id || idx}-${idx}`} value={emp.IdUsuario || emp.id}>
                      {emp.NombreCompleto || `${emp.Nombres} ${emp.Apellidos}`} (CI: {emp.CI})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motivo de Retiro:
                </label>
                <select
                  value={formFiniquito.motivo}
                  onChange={(e) => setFormFiniquito({ ...formFiniquito, motivo: e.target.value })}
                  className="w-full px-2.5 h-8 rounded border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="DESPIDO_INJUSTIFICADO">Despido Intempestivo / Injustificado</option>
                  <option value="RETIRO_VOLUNTARIO">Retiro Voluntario</option>
                  <option value="CONCLUSION_CONTRATO">Conclusión de Contrato</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Fecha de Ingreso:
                </label>
                <Input
                  type="date"
                  value={formFiniquito.fecha_ingreso}
                  onChange={(e) => setFormFiniquito({ ...formFiniquito, fecha_ingreso: e.target.value })}
                  required
                  className="text-xs h-8 rounded border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Fecha de Retiro:
                </label>
                <Input
                  type="date"
                  value={formFiniquito.fecha_retiro}
                  onChange={(e) => setFormFiniquito({ ...formFiniquito, fecha_retiro: e.target.value })}
                  required
                  className="text-xs h-8 rounded border-slate-300"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Últimos 3 Sueldos Percibidos (Base Promedio):
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 block mb-0.5">Mes 1 (Bs):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formFiniquito.sueldo_mes_1}
                    onChange={(e) => setFormFiniquito({ ...formFiniquito, sueldo_mes_1: e.target.value })}
                    required
                    className="text-xs h-8 rounded border-slate-300 font-mono tabular-nums text-right"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block mb-0.5">Mes 2 (Bs):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formFiniquito.sueldo_mes_2}
                    onChange={(e) => setFormFiniquito({ ...formFiniquito, sueldo_mes_2: e.target.value })}
                    required
                    className="text-xs h-8 rounded border-slate-300 font-mono tabular-nums text-right"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block mb-0.5">Mes 3 (Bs):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formFiniquito.sueldo_mes_3}
                    onChange={(e) => setFormFiniquito({ ...formFiniquito, sueldo_mes_3: e.target.value })}
                    required
                    className="text-xs h-8 rounded border-slate-300 font-mono tabular-nums text-right"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={calculandoFiniquito}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs h-8 rounded"
            >
              {calculandoFiniquito ? "Calculando..." : "Calcular Beneficios Sociales"}
            </Button>
          </form>

          {resultadoCalculoFiniquito && (
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-2 mt-2">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900">
                  Antigüedad Calculada:
                </span>
                <span className="font-bold font-mono tabular-nums text-slate-900">
                  {resultadoCalculoFiniquito.AniosServicio} años, {resultadoCalculoFiniquito.MesesServicio} meses, {resultadoCalculoFiniquito.DiasServicio} días
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono tabular-nums">
                <div>• Sueldo Promedio: Bs. {Number(resultadoCalculoFiniquito.SueldoPromedio || 0).toFixed(2)}</div>
                <div>• Indemnización: Bs. {Number(resultadoCalculoFiniquito.IndemnizacionLegal || 0).toFixed(2)}</div>
                <div>• Aguinaldo Duodécimas: Bs. {Number(resultadoCalculoFiniquito.AguinaldoDuodecimas || 0).toFixed(2)}</div>
                <div>• Vacación Pendiente: Bs. {Number(resultadoCalculoFiniquito.VacacionCompensable || 0).toFixed(2)}</div>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>TOTAL A LIQUIDAR:</span>
                <span className="font-mono tabular-nums">Bs. {Number(resultadoCalculoFiniquito.LiquidoPagable || 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL NUEVA NO VENTA COMPARTIDA */}
      {/* ========================================================================= */}
      <Dialog open={modalNuevaNoVenta} onOpenChange={setModalNuevaNoVenta}>
        <DialogContent className="w-full sm:max-w-md p-5 sm:p-6 bg-white border border-slate-300 shadow-md rounded">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-slate-700" />
              Prorrateo de "No Venta" Compartida
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearNoVenta} className="space-y-4 pt-2">
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
                className="text-xs h-8 rounded border-slate-300 font-mono tabular-nums text-right"
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
                className="text-xs h-8 rounded border-slate-300"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Seleccionar Trabajadores Responsables:
              </label>
              <div className="max-h-40 overflow-y-auto border border-slate-300 rounded p-2 space-y-1.5 text-xs">
                {empleados.map((emp, idx) => {
                  const idEmp = emp.IdUsuario || emp.id;
                  const seleccionado = formNoVenta.empleados_seleccionados.includes(idEmp);
                  return (
                    <label key={`lbl-nv-emp-${idEmp}-${idx}`} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
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
                      <span className="text-slate-800">{emp.NombreCompleto || `${emp.Nombres} ${emp.Apellidos}`}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {formNoVenta.monto_total && formNoVenta.empleados_seleccionados.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs font-semibold text-amber-800 font-mono tabular-nums">
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
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs h-8 rounded"
            >
              {guardandoNoVenta ? "Guardando..." : "Asignar Deducciones"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
