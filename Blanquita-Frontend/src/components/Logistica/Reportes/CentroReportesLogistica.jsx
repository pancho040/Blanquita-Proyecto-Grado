import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import {
  Truck,
  Users,
  MapPin,
  Printer,
  Download,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  Navigation,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/common/StatusBadge";
import { toast } from "sonner";
import ReporteKpisGrid, { formatCurrency, formatNumber } from "@/components/common/Reportes/ReporteKpisGrid";
import ReporteHeaderFormal from "@/components/common/Reportes/ReporteHeaderFormal";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { exportarAExcelCSV } from "@/components/common/Reportes/exportarCsv";
import {
  getReporteDesempenoRutas,
  getReporteCoberturaClientes,
} from "@/services/Reportes/reportesService";

const TABS = [
  { id: "desempeno_rutas", label: "Desempeño de Rutas y Choferes", icon: Truck },
  { id: "cobertura_clientes", label: "Cobertura y Cartera de Clientes", icon: Users },
];

export default function CentroReportesLogistica({ usuario = null }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [tabActiva, setTabActiva] = useState("desempeno_rutas");
  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState({ metricas: {}, data: [] });
  const paginacion = usePaginacion(reporteData.data || [], 15);

  // Filtros Comunes
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Filtros Específicos
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroGps, setFiltroGps] = useState("TODOS");

  const cargarReporte = useCallback(async () => {
    setLoading(true);
    try {
      let res = { metricas: {}, data: [] };
      const baseParams = {
        busqueda: busqueda || undefined,
        id_sucursal: sucursal === "todas" ? undefined : Number(sucursal),
      };

      if (tabActiva === "desempeno_rutas") {
        res = await getReporteDesempenoRutas({
          ...baseParams,
          fecha_inicio: fechaInicio || undefined,
          fecha_fin: fechaFin || undefined,
          estado: filtroEstado !== "TODOS" ? filtroEstado : undefined,
        });
      } else if (tabActiva === "cobertura_clientes") {
        res = await getReporteCoberturaClientes({
          ...baseParams,
          con_gps: filtroGps === "CON_GPS" ? true : filtroGps === "SIN_GPS" ? false : undefined,
        });
      }
      setReporteData(res);
    } catch (err) {
      toast.error(err.message || "Error al cargar reporte de logística");
      setReporteData({ metricas: {}, data: [] });
    } finally {
      setLoading(false);
    }
  }, [tabActiva, fechaInicio, fechaFin, busqueda, filtroEstado, filtroGps, sucursal]);

  useEffect(() => {
    if (!cargandoAlcance) {
      cargarReporte();
    }
  }, [cargarReporte, cargandoAlcance]);

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setBusqueda("");
    setFiltroEstado("TODOS");
    setFiltroGps("TODOS");
  };

  // Exportar según la pestaña activa
  const exportarCSVActual = () => {
    if (!reporteData.data || reporteData.data.length === 0) {
      toast.warning("No hay registros para exportar en este período");
      return;
    }

    if (tabActiva === "desempeno_rutas") {
      const columnas = {
        id: "ID Despacho",
        fecha: "Fecha",
        ruta_nombre: "Ruta / Zona",
        chofer_nombre: "Chofer Asignado",
        estado_asignacion: "Estado",
        paradas_totales: "Paradas Programadas",
        paradas_entregadas: "Paradas Entregadas",
        porcentaje_efectividad: "% Efectividad",
        recaudacion_efectivo: "Recaudación Efectivo (Bs.)",
        recaudacion_qr: "Recaudación QR (Bs.)",
        total_recaudado: "Total Cobrado (Bs.)",
        km_recorridos: "Distancia Recorrida (Km)",
      };
      exportarAExcelCSV("Reporte_Desempeno_Rutas_Logistica", columnas, reporteData.data);
    } else if (tabActiva === "cobertura_clientes") {
      const columnas = {
        id: "ID Cliente",
        razon_social: "Razón Social / Nombre",
        nombre_comercial: "Nombre Comercial",
        nit_ci: "NIT / C.I.",
        ciudad: "Ciudad",
        telefono: "Teléfono",
        direccion: "Dirección",
        latitud: "Latitud GPS",
        longitud: "Longitud GPS",
        puntos_venta_count: "Cant. Puntos Venta",
        limite_credito_bs: "Límite Crédito (Bs.)",
        dias_credito: "Días de Crédito",
        total_compras_historicas: "Notas de Venta Históricas",
      };
      exportarAExcelCSV("Reporte_Cobertura_Clientes_GPS", columnas, reporteData.data);
    }
    toast.success("Reporte exportado exitosamente a CSV/Excel");
  };

  const handlePrint = () => {
    window.print();
  };

  // KPIs dinámicos
  const renderKpis = () => {
    const m = reporteData.metricas || {};
    if (tabActiva === "desempeno_rutas") {
      return (
        <ReporteKpisGrid
          kpis={[
            {
              titulo: "Total Rutas Ejecutadas",
              valor: m.total_rutas_ejecutadas || m.total_rutas || 0,
              subtitulo: "Planificaciones procesadas",
              icono: Truck,
              colorScheme: "blue",
              formato: "numero",
            },
            {
              titulo: "Tasa de Efectividad",
              valor: `${Number(m.efectividad_promedio || m.tasa_efectividad || 0).toFixed(1)}%`,
              subtitulo: `${m.total_paradas_entregadas || 0} de ${m.total_paradas_programadas || 0} logradas`,
              icono: CheckCircle2,
              colorScheme: "emerald",
            },
            {
              titulo: "Recaudación Total Rutas",
              valor: m.total_recaudado_global_bs || m.recaudacion_total || 0,
              subtitulo: `Efectivo: ${formatCurrency(m.total_recaudado_efectivo_bs || 0)} | QR: ${formatCurrency(m.total_recaudado_qr_bs || 0)}`,
              icono: DollarSign,
              colorScheme: "indigo",
              formato: "moneda",
            },
            {
              titulo: "Kilómetros Recorridos",
              valor: `${Number(m.km_totales_recorridos || m.total_km || 0).toFixed(1)} km`,
              subtitulo: "Distancia logística en ruta",
              icono: Navigation,
              colorScheme: "amber",
            },
          ]}
        />
      );
    } else if (tabActiva === "cobertura_clientes") {
      const totalCli = m.total_clientes || 0;
      const conGps = m.clientes_con_gps || 0;
      const pctGps = totalCli > 0 ? (conGps / totalCli) * 100 : 0;
      return (
        <ReporteKpisGrid
          kpis={[
            {
              titulo: "Total Clientes Cartera",
              valor: totalCli,
              subtitulo: "Clientes registrados",
              icono: Users,
              colorScheme: "blue",
              formato: "numero",
            },
            {
              titulo: "Georreferenciados (GPS)",
              valor: `${pctGps.toFixed(1)}%`,
              subtitulo: `${conGps} clientes con coordenadas`,
              icono: MapPin,
              colorScheme: "emerald",
            },
            {
              titulo: "Puntos de Venta Activos",
              valor: m.total_puntos_venta || 0,
              subtitulo: "Sucursales y tiendas vinculadas",
              icono: Navigation,
              colorScheme: "indigo",
              formato: "numero",
            },
            {
              titulo: "Habilitados con Crédito",
              valor: m.clientes_habilitados_credito || 0,
              subtitulo: "Línea financiera activa",
              icono: CheckCircle2,
              colorScheme: "amber",
              formato: "numero",
            },
          ]}
        />
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Membrete formal para impresión */}
      <ReporteHeaderFormal
        titulo={
          tabActiva === "desempeno_rutas"
            ? "Reporte de Desempeño y Efectividad de Rutas de Entrega"
            : "Reporte de Cobertura Geográfica y Cartera de Clientes"
        }
        subtitulo="Módulo de Logística, Distribución y Rastreo Georreferenciado"
        rangoFechas={
          fechaInicio && fechaFin
            ? `${fechaInicio} al ${fechaFin}`
            : fechaInicio
            ? `Desde ${fechaInicio}`
            : fechaFin
            ? `Hasta ${fechaFin}`
            : "Período Completo / Histórico"
        }
      />

      {/* Header en pantalla con PageHeader y BranchFilter */}
      <div className="no-print">
        <PageHeader
          title="Centro de Reportes de Logística y Distribución"
          subtitle="Análisis operativo de rutas, cumplimiento de entregas por chofer y georreferenciación GPS de clientes."
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
          <Button
            variant="outline"
            size="sm"
            onClick={cargarReporte}
            disabled={loading}
            className="gap-1.5 text-slate-700 hover:text-slate-900 border-slate-300 rounded h-8 text-xs font-medium"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#1C96C5]" : ""}`} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-slate-700 hover:text-slate-900 border-slate-300 rounded h-8 text-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Imprimir
          </Button>
          <Button
            size="sm"
            onClick={exportarCSVActual}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded h-8 text-xs font-semibold shadow-none"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
        </PageHeader>
      </div>

        {/* Pestañas de Navegación */}
        <div className="flex border-b border-slate-200 mt-4 gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const activa = tabActiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  activa
                    ? "border-[#1C96C5] text-[#1C96C5]"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${activa ? "text-[#1C96C5]" : "text-slate-500"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

      {/* KPIs superiores */}
      {renderKpis()}

      {/* Barra de Filtros */}
      <div className="no-print bg-white rounded border border-slate-200 p-3.5">
        <div className="flex items-center gap-1.5 mb-2.5 text-slate-800 font-semibold text-xs">
          <Filter className="w-3.5 h-3.5 text-[#1C96C5]" />
          <span>Filtros de Búsqueda y Parámetros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Rango de Fechas (para Desempeño de Rutas) */}
          {tabActiva === "desempeno_rutas" && (
            <>
              <div>
                <Label className="text-xs text-slate-600 font-medium mb-1 block">Desde Fecha</Label>
                <Input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="text-xs h-8 rounded border-slate-300"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 font-medium mb-1 block">Hasta Fecha</Label>
                <Input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="text-xs h-8 rounded border-slate-300"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-600 font-medium mb-1 block">Estado de Ruta</Label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1C96C5]"
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="COMPLETADA">Completada</option>
                  <option value="EN_RUTA">En Ruta / Despachada</option>
                  <option value="PENDIENTE">Pendiente / Planificada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>
            </>
          )}

          {/* Filtros para Cobertura de Clientes */}
          {tabActiva === "cobertura_clientes" && (
            <div>
              <Label className="text-xs text-slate-600 font-medium mb-1 block">Georreferenciación (GPS)</Label>
              <select
                value={filtroGps}
                onChange={(e) => setFiltroGps(e.target.value)}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#1C96C5]"
              >
                <option value="TODOS">Todos los Clientes</option>
                <option value="CON_GPS">Con Coordenadas GPS</option>
                <option value="SIN_GPS">Sin Coordenadas GPS</option>
              </select>
            </div>
          )}

          {/* Búsqueda por texto */}
          <div>
            <Label className="text-xs text-slate-600 font-medium mb-1 block">Búsqueda rápida</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <Input
                placeholder={
                  tabActiva === "desempeno_rutas"
                    ? "Buscar chofer, ruta, código..."
                    : "Buscar cliente, NIT, ciudad..."
                }
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 text-xs h-8 rounded border-slate-300"
              />
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={limpiarFiltros}
            className="text-xs text-slate-600 hover:text-slate-900 h-7 rounded"
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* Tablas de Datos */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-600">
            <RotateCw className="w-7 h-7 animate-spin text-[#1C96C5]" />
            <p className="text-xs font-medium">Cargando datos del reporte logístico...</p>
          </div>
        ) : reporteData.data && reporteData.data.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Truck className="w-8 h-8 stroke-[1.5]" />
            <p className="text-sm font-semibold text-slate-800">No se encontraron registros</p>
            <p className="text-xs text-slate-600">Intente modificando el rango de fechas o los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {tabActiva === "desempeno_rutas" && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Ruta / Zona</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Chofer Asignado</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Paradas (Entr / Tot)</th>
                    <th className="py-2.5 px-3 text-right">Efectividad</th>
                    <th className="py-2.5 px-3 text-right">Recaudación (Bs.)</th>
                    <th className="py-2.5 px-3 text-right">Distancia</th>
                  </tr>
                </thead>
                {/* Cuerpo pantalla con paginación */}
                <tbody className="divide-y divide-slate-100 text-slate-700 print:hidden">
                  {paginacion.itemsPaginados.map((item, idx) => {
                    const efectividad = Number(item.porcentaje_efectividad || 0);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold font-mono text-[#1C96C5]">
                          {`DSP-${item.id}`}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.ruta_nombre}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono whitespace-nowrap">{item.fecha}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.chofer_nombre || "Sin Chofer"}</td>
                        <td className="py-2.5 px-3 text-center">
                          <StatusBadge estado={item.estado_asignacion} />
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                          <span className="font-semibold text-emerald-700">{item.paradas_entregadas || 0}</span> /{" "}
                          <span>{item.paradas_totales || 0}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          <span
                            className={`font-semibold ${
                              efectividad >= 90
                                ? "text-emerald-700"
                                : efectividad >= 70
                                ? "text-amber-700"
                                : "text-rose-700"
                            }`}
                          >
                            {efectividad.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatCurrency(item.total_recaudado || 0)}
                          <div className="text-[11px] text-slate-500 font-normal">
                            Ef: {formatCurrency(item.recaudacion_efectivo || 0)} | QR:{" "}
                            {formatCurrency(item.recaudacion_qr || 0)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {Number(item.km_recorridos || 0).toFixed(1)} km
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Cuerpo impresión en papel */}
                <tbody className="hidden print:table-row-group text-black">
                  {(reporteData.data || []).map((item, idx) => (
                    <tr key={`print-${item.id || idx}`}>
                      <td className="font-semibold font-mono">{`DSP-${item.id}`}</td>
                      <td className="font-medium">{item.ruta_nombre}</td>
                      <td className="whitespace-nowrap font-mono">{item.fecha}</td>
                      <td>{item.chofer_nombre || "Sin Chofer"}</td>
                      <td className="text-center font-bold">{item.estado_asignacion}</td>
                      <td className="text-center font-mono font-bold">{item.paradas_entregadas || 0} / {item.paradas_totales || 0}</td>
                      <td className="text-right font-mono font-bold">{Number(item.porcentaje_efectividad || 0).toFixed(1)}%</td>
                      <td className="text-right font-mono font-bold">{formatCurrency(item.total_recaudado || 0)}</td>
                      <td className="text-right font-mono">{Number(item.km_recorridos || 0).toFixed(1)} km</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-slate-900 border-t border-slate-300">
                    <td colSpan={5} className="py-2.5 px-3 text-right">
                      Totales del Período:
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold text-emerald-800">
                      {reporteData.metricas?.total_paradas_entregadas || 0} / {reporteData.metricas?.total_paradas_programadas || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#1C96C5]">
                      {Number(reporteData.metricas?.efectividad_promedio || 0).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-800">
                      {formatCurrency(reporteData.metricas?.total_recaudado_global_bs || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {Number(reporteData.metricas?.km_totales_recorridos || 0).toFixed(1)} km
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {tabActiva === "cobertura_clientes" && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Cliente / Razón Social</th>
                    <th className="py-2.5 px-3">Nombre Comercial</th>
                    <th className="py-2.5 px-3">Ciudad</th>
                    <th className="py-2.5 px-3">Teléfono</th>
                    <th className="py-2.5 px-3">Dirección</th>
                    <th className="py-2.5 px-3 text-center">GPS</th>
                    <th className="py-2.5 px-3 text-center">Puntos Venta</th>
                    <th className="py-2.5 px-3 text-right">Límite Crédito (Bs.)</th>
                    <th className="py-2.5 px-3 text-right">Compras Históricas</th>
                  </tr>
                </thead>
                {/* Cuerpo pantalla con paginación */}
                <tbody className="divide-y divide-slate-100 text-slate-700 print:hidden">
                  {paginacion.itemsPaginados.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold font-mono text-[#1C96C5]">
                        {`CLI-${item.id}`}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{item.razon_social}</td>
                      <td className="py-2.5 px-3 text-slate-700">{item.nombre_comercial || "-"}</td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">{item.ciudad || "Sucre"}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.telefono || "N/A"}</td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate" title={item.direccion}>
                        {item.direccion || "Sin dirección"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.latitud && item.longitud ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-medium">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            GPS OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            Sin GPS
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#1C96C5]">
                        {item.puntos_venta_count || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-800">
                        {formatCurrency(item.limite_credito_bs || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {item.total_compras_historicas || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Cuerpo impresión en papel */}
                <tbody className="hidden print:table-row-group text-black">
                  {(reporteData.data || []).map((item, idx) => (
                    <tr key={`print-${item.id || idx}`}>
                      <td className="font-semibold font-mono">{`CLI-${item.id}`}</td>
                      <td className="font-bold">{item.razon_social}</td>
                      <td>{item.nombre_comercial || "-"}</td>
                      <td>{item.ciudad || "Sucre"}</td>
                      <td>{item.telefono || "N/A"}</td>
                      <td className="truncate max-w-xs">{item.direccion || "Sin dirección"}</td>
                      <td className="text-center font-bold">{item.latitud && item.longitud ? "GPS OK" : "Sin GPS"}</td>
                      <td className="text-center font-mono font-bold">{item.puntos_venta_count || 0}</td>
                      <td className="text-right font-mono">{formatCurrency(item.limite_credito_bs || 0)}</td>
                      <td className="text-right font-mono font-bold">{item.total_compras_historicas || 0}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-slate-900 border-t border-slate-300">
                    <td colSpan={7} className="py-2.5 px-3 text-right">
                      Totales de Cartera ({reporteData.metricas?.total_clientes || 0} clientes):
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#1C96C5]">
                      {reporteData.metricas?.total_puntos_venta || 0} puntos
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-right font-bold text-slate-800">
                      {reporteData.metricas?.clientes_habilitados_credito || 0} con línea de crédito
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            <PaginacionTabla {...paginacion} />
          </div>
        )}

        {/* Firmas de Respaldo al Imprimir */}
        <div className="hidden print:grid grid-cols-2 gap-12 text-center text-[11px] pt-14 pb-4">
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Jefe de Logística y Despacho
            </div>
            <span className="text-[11px] text-gray-700">Control Operativo de Distribución</span>
          </div>
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Gerente General
            </div>
            <span className="text-[11px] text-gray-700">Papelera Blanquita S.R.L. - Aprobado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
