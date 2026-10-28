import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  DollarSign,
  Users,
  Printer,
  Download,
  RotateCw,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ReporteKpisGrid, { formatCurrency, formatNumber } from "@/components/common/Reportes/ReporteKpisGrid";
import ReporteHeaderFormal from "@/components/common/Reportes/ReporteHeaderFormal";
import { exportarAExcelCSV } from "@/components/common/Reportes/exportarCsv";
import {
  getReporteAsistenciaPuntualidad,
  getReporteNominaHistorica,
} from "@/services/Reportes/reportesService";

const TABS = [
  { id: "asistencia", label: "Asistencia y Puntualidad", icon: Clock },
  { id: "nomina", label: "Nómina Histórica y Haberes", icon: FileSpreadsheet },
];

const MESES = [
  { val: 1, label: "Enero" },
  { val: 2, label: "Febrero" },
  { val: 3, label: "Marzo" },
  { val: 4, label: "Abril" },
  { val: 5, label: "Mayo" },
  { val: 6, label: "Junio" },
  { val: 7, label: "Julio" },
  { val: 8, label: "Agosto" },
  { val: 9, label: "Septiembre" },
  { val: 10, label: "Octubre" },
  { val: 11, label: "Noviembre" },
  { val: 12, label: "Diciembre" },
];

export default function CentroReportesRRHH() {
  const [tabActiva, setTabActiva] = useState("asistencia");
  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState({ metricas: {}, data: [] });

  // Filtros Comunes
  const [busqueda, setBusqueda] = useState("");
  const [filtroArea, setFiltroArea] = useState("TODOS");

  // Filtros Asistencia
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Filtros Nómina
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [gestion, setGestion] = useState(hoy.getFullYear());

  const cargarReporte = useCallback(async () => {
    setLoading(true);
    try {
      let res = { metricas: {}, data: [] };
      const baseParams = {
        busqueda: busqueda || undefined,
        area: filtroArea !== "TODOS" ? filtroArea : undefined,
      };

      if (tabActiva === "asistencia") {
        res = await getReporteAsistenciaPuntualidad({
          ...baseParams,
          fecha_inicio: fechaInicio || undefined,
          fecha_fin: fechaFin || undefined,
        });
      } else if (tabActiva === "nomina") {
        res = await getReporteNominaHistorica({
          ...baseParams,
          mes: mes || undefined,
          anio: gestion || undefined,
        });
      }
      setReporteData(res);
    } catch (err) {
      toast.error(err.message || "Error al cargar reporte de RRHH");
      setReporteData({ metricas: {}, data: [] });
    } finally {
      setLoading(false);
    }
  }, [tabActiva, fechaInicio, fechaFin, mes, gestion, busqueda, filtroArea]);

  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setBusqueda("");
    setFiltroArea("TODOS");
    setMes(hoy.getMonth() + 1);
    setGestion(hoy.getFullYear());
  };

  const exportarCSVActual = () => {
    if (!reporteData.data || reporteData.data.length === 0) {
      toast.warning("No hay registros para exportar en este período");
      return;
    }

    if (tabActiva === "asistencia") {
      const columnas = {
        fecha: "Fecha",
        empleado_nombre: "Empleado",
        ci: "C.I.",
        cargo: "Cargo",
        area: "Área",
        turno: "Turno Asignado",
        hora_real_entrada: "Hora Entrada",
        hora_real_salida: "Hora Salida",
        minutos_atraso: "Atraso (Minutos)",
        horas_extra: "Horas Extra",
        estado_asistencia: "Estado Asistencia",
      };
      exportarAExcelCSV("Reporte_Asistencia_Puntualidad_RRHH", columnas, reporteData.data);
    } else if (tabActiva === "nomina") {
      const columnas = {
        periodo: "Período (Mes/Año)",
        empleado_nombre: "Empleado",
        ci: "C.I.",
        cargo: "Cargo",
        sueldo_basico: "Haber Básico (Bs.)",
        horas_extra_bs: "Horas Extra (Bs.)",
        comisiones_bs: "Comisiones Chofer (Bs.)",
        bonos_bs: "Otros Bonos (Bs.)",
        total_ganado: "Total Ganado Bruto (Bs.)",
        afp_bs: "Aporte AFP Ley (Bs.)",
        anticipos_bs: "Anticipos y Deducciones (Bs.)",
        total_descuento: "Total Descuentos (Bs.)",
        liquido_pagable: "Líquido Pagable Neto (Bs.)",
        aprobada: "Planilla Aprobada",
      };
      exportarAExcelCSV(`Reporte_Nomina_Salarial_${mes}_${gestion}`, columnas, reporteData.data);
    }
    toast.success("Reporte exportado exitosamente a CSV/Excel");
  };

  const handlePrint = () => {
    window.print();
  };

  const renderKpis = () => {
    const m = reporteData.metricas || {};
    if (tabActiva === "asistencia") {
      const totalReg = m.total_registros || 0;
      const puntual = m.total_puntuales || 0;
      const pctPuntual = totalReg > 0 ? (puntual / totalReg) * 100 : 0;
      return (
        <ReporteKpisGrid
          kpis={[
            {
              titulo: "Total Marcaciones",
              valor: totalReg,
              subtitulo: "Jornadas computadas",
              icono: Clock,
              colorScheme: "blue",
              formato: "numero",
            },
            {
              titulo: "Índice de Puntualidad",
              valor: `${pctPuntual.toFixed(1)}%`,
              subtitulo: `${puntual} marcaciones dentro de tolerancia`,
              icono: CheckCircle2,
              colorScheme: "emerald",
            },
            {
              titulo: "Minutos de Atraso Acumulados",
              valor: `${m.total_minutos_atraso || 0} min`,
              subtitulo: `Demoras registradas en el período`,
              icono: AlertTriangle,
              colorScheme: "amber",
            },
            {
              titulo: "Horas Extra Acumuladas",
              valor: `${Number(m.total_horas_extra || 0).toFixed(1)} hrs`,
              subtitulo: `${m.total_faltas || 0} faltas registradas`,
              icono: TrendingUp,
              colorScheme: "indigo",
            },
          ]}
        />
      );
    } else if (tabActiva === "nomina") {
      return (
        <ReporteKpisGrid
          kpis={[
            {
              titulo: "Boletas Liquidadas",
              valor: m.cantidad_boletas || 0,
              subtitulo: "Personal con planilla generada",
              icono: Users,
              colorScheme: "blue",
              formato: "numero",
            },
            {
              titulo: "Masa Salarial Bruta",
              valor: m.total_bruto_acumulado_bs || 0,
              subtitulo: `Comisiones Chofer: ${formatCurrency(m.total_comisiones_reparto_bs || 0)}`,
              icono: Award,
              colorScheme: "amber",
              formato: "moneda",
            },
            {
              titulo: "Retenciones y Deducciones",
              valor: m.total_deducciones_bs || 0,
              subtitulo: `AFPs: ${formatCurrency(m.total_afp_ley_bs || 0)} | Anticipos: ${formatCurrency(m.total_anticipos_deducidos_bs || 0)}`,
              icono: TrendingDown,
              colorScheme: "rose",
              formato: "moneda",
            },
            {
              titulo: "Líquido Pagable Total",
              valor: m.total_liquido_pagable_bs || 0,
              subtitulo: "Desembolso neto para haberes",
              icono: DollarSign,
              colorScheme: "emerald",
              formato: "moneda",
            },
          ]}
        />
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Membrete formal para impresión */}
      <ReporteHeaderFormal
        titulo={
          tabActiva === "asistencia"
            ? "Reporte de Asistencia, Puntualidad y Horas Laborales"
            : `Reporte de Planilla Salarial y Nómina Histórica - ${MESES.find((m) => m.val === Number(mes))?.label || mes} ${gestion}`
        }
        subtitulo="Módulo de Recursos Humanos y Gestión del Talento"
        rangoFechas={
          tabActiva === "asistencia"
            ? fechaInicio && fechaFin
              ? `${fechaInicio} al ${fechaFin}`
              : fechaInicio
              ? `Desde ${fechaInicio}`
              : fechaFin
              ? `Hasta ${fechaFin}`
              : "Período Completo / Histórico"
            : `Período Liquidado: ${mes}/${gestion}`
        }
      />

      {/* Header en pantalla / Pestañas y Acciones */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Users className="w-7 h-7 text-sky-600" />
              Centro de Reportes de Recursos Humanos
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Control biométrico de puntualidad, atrasos, horas extraordinarias y consolidado de planillas salariales.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={cargarReporte}
              disabled={loading}
              className="gap-1.5 text-slate-700 hover:text-slate-900 border-slate-300"
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-600" : ""}`} />
              Actualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-slate-700 hover:text-slate-900 border-slate-300"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Imprimir
            </Button>
            <Button
              size="sm"
              onClick={exportarCSVActual}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex border-b border-slate-200 mt-6 gap-2 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const activa = tabActiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activa
                    ? "border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-lg"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-4 h-4 ${activa ? "text-sky-600" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs superiores */}
      {renderKpis()}

      {/* Barra de Filtros */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
          <Filter className="w-4 h-4 text-sky-600" />
          Filtros de Búsqueda y Parámetros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tabActiva === "asistencia" ? (
            <>
              <div>
                <Label className="text-xs text-slate-500 font-medium mb-1 block">Desde Fecha</Label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 font-medium mb-1 block">Hasta Fecha</Label>
                <Input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs text-slate-500 font-medium mb-1 block">Mes de Planilla</Label>
                <select
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {MESES.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 font-medium mb-1 block">Gestión / Año</Label>
                <Input
                  type="number"
                  value={gestion}
                  onChange={(e) => setGestion(Number(e.target.value))}
                  className="text-sm h-9 "
                  placeholder="2026"
                />
              </div>
            </>
          )}

          {/* Filtro por Área */}
          <div>
            <Label className="text-xs text-slate-500 font-medium mb-1 block">Área de Trabajo</Label>
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="TODOS">Todas las Áreas</option>
              <option value="Administracion">Administración</option>
              <option value="Logistica">Logística / Choferes</option>
              <option value="Ventas">Ventas / Comercial</option>
              <option value="Planta">Operaciones de Planta</option>
            </select>
          </div>

          {/* Búsqueda por Empleado */}
          <div>
            <Label className="text-xs text-slate-500 font-medium mb-1 block">Búsqueda rápida</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Nombre, apellido, C.I., cargo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 text-sm h-9"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={limpiarFiltros}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* Tablas de Datos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RotateCw className="w-8 h-8 animate-spin text-sky-600" />
            <p className="text-sm font-medium">Cargando datos del reporte de recursos humanos...</p>
          </div>
        ) : reporteData.data && reporteData.data.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Users className="w-10 h-10 stroke-[1.5]" />
            <p className="text-base font-semibold text-slate-600">No se encontraron registros</p>
            <p className="text-sm text-slate-400">Intente modificando el rango de fechas, mes o filtros de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {tabActiva === "asistencia" && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider">
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Empleado</th>
                    <th className="py-3 px-3">C.I.</th>
                    <th className="py-3 px-3">Cargo</th>
                    <th className="py-3 px-3">Turno</th>
                    <th className="py-3 px-3 text-center">Entrada</th>
                    <th className="py-3 px-3 text-center">Salida</th>
                    <th className="py-3 px-3 text-center">Atraso</th>
                    <th className="py-3 px-3 text-center">Horas Extra</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reporteData.data.map((item, idx) => {
                    const atraso = Number(item.minutos_atraso || 0);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-medium">{item.fecha}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{item.empleado_nombre}</td>
                        <td className="py-3 px-3 text-slate-500">{item.ci}</td>
                        <td className="py-3 px-3 font-medium text-slate-800">{item.cargo}</td>
                        <td className="py-3 px-3 text-slate-600">{item.turno}</td>
                        <td className="py-3 px-3 text-center text-slate-700">
                          {item.hora_real_entrada ? String(item.hora_real_entrada).slice(0, 5) : "--:--"}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-700">
                          {item.hora_real_salida ? String(item.hora_real_salida).slice(0, 5) : "--:--"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {atraso > 0 ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              {atraso} min
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">0 min</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-medium">
                          {Number(item.horas_extra || 0) > 0 ? (
                            <span className="text-indigo-600 font-semibold">
                              +{Number(item.horas_extra).toFixed(1)} hrs
                            </span>
                          ) : (
                            <span className="text-slate-400">0.0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              item.estado_asistencia === "PUNTUAL"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.estado_asistencia === "ATRASADO"
                                ? "bg-amber-100 text-amber-800"
                                : item.estado_asistencia === "FALTA"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-sky-100 text-sky-800"
                            }`}
                          >
                            {item.estado_asistencia}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-semibold text-slate-800 border-t-2 border-slate-300">
                    <td colSpan={7} className="py-3 px-3 text-right">
                      Totales del Período ({reporteData.metricas?.total_registros || 0} registros):
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-amber-700">
                      {reporteData.metricas?.total_minutos_atraso || 0} min
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-indigo-700">
                      {Number(reporteData.metricas?.total_horas_extra || 0).toFixed(1)} hrs
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">
                      {reporteData.metricas?.total_puntuales || 0} Puntuales
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {tabActiva === "nomina" && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider">
                    <th className="py-3 px-3">Empleado</th>
                    <th className="py-3 px-3">C.I.</th>
                    <th className="py-3 px-3">Cargo</th>
                    <th className="py-3 px-3 text-right">Haber Básico</th>
                    <th className="py-3 px-3 text-right">Horas Extra</th>
                    <th className="py-3 px-3 text-right">Comisiones</th>
                    <th className="py-3 px-3 text-right">Total Ganado</th>
                    <th className="py-3 px-3 text-right">AFP Ley</th>
                    <th className="py-3 px-3 text-right">Anticipos</th>
                    <th className="py-3 px-3 text-right">Total Desc.</th>
                    <th className="py-3 px-3 text-right">Líquido Pagable</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reporteData.data.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.empleado_nombre}</td>
                      <td className="py-3 px-3 text-slate-500">{item.ci}</td>
                      <td className="py-3 px-3 font-medium text-slate-800">{item.cargo}</td>
                      <td className="py-3 px-3 text-right ">{formatCurrency(item.sueldo_basico || 0)}</td>
                      <td className="py-3 px-3 text-right text-emerald-600">
                        {formatCurrency(item.horas_extra_bs || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600">
                        {formatCurrency(item.comisiones_bs || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900 bg-slate-50/50">
                        {formatCurrency(item.total_ganado || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600">
                        {formatCurrency(item.afp_bs || 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600">
                        {formatCurrency(item.anticipos_bs || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-rose-700 bg-rose-50/30">
                        {formatCurrency(item.total_descuento || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 bg-emerald-50/40">
                        {formatCurrency(item.liquido_pagable || 0)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.aprobada
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.aprobada ? "Aprobada" : "En Borrador"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-semibold text-slate-800 border-t-2 border-slate-300">
                    <td colSpan={3} className="py-3 px-3 text-right">
                      Totales Nómina ({reporteData.metricas?.cantidad_boletas || 0} boletas):
                    </td>
                    <td colSpan={3} className="py-3 px-3 text-right text-emerald-700">
                      Comisiones: {formatCurrency(reporteData.metricas?.total_comisiones_reparto_bs || 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(reporteData.metricas?.total_bruto_acumulado_bs || 0)}
                    </td>
                    <td colSpan={3} className="py-3 px-3 text-right font-bold text-rose-700">
                      {formatCurrency(reporteData.metricas?.total_deducciones_bs || 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-800 text-sm">
                      {formatCurrency(reporteData.metricas?.total_liquido_pagable_bs || 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
