import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  Users,
  MapPin,
  Printer,
  Download,
  RotateCw,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  Navigation,
  DollarSign,
  QrCode,
  Banknote,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ReporteKpisGrid, { formatCurrency, formatNumber } from "@/components/common/Reportes/ReporteKpisGrid";
import ReporteHeaderFormal from "@/components/common/Reportes/ReporteHeaderFormal";
import { exportarAExcelCSV } from "@/components/common/Reportes/exportarCsv";
import {
  getReporteDesempenoRutas,
  getReporteCoberturaClientes,
} from "@/services/Reportes/reportesService";

const TABS = [
  { id: "desempeno_rutas", label: "Desempeño de Rutas y Choferes", icon: Truck },
  { id: "cobertura_clientes", label: "Cobertura y Cartera de Clientes", icon: Users },
];

export default function CentroReportesLogistica() {
  const [tabActiva, setTabActiva] = useState("desempeno_rutas");
  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState({ metricas: {}, data: [] });

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
  }, [tabActiva, fechaInicio, fechaFin, busqueda, filtroEstado, filtroGps]);

  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);

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
              subtitulo: `${m.total_paradas_entregadas || 0} de ${m.total_paradas_programadas || 0} paradas logradas`,
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
              subtitulo: `${conGps} clientes con coordenadas válidas`,
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
              subtitulo: "Clientes con línea financiera activa",
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
    <div className="space-y-6">
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

      {/* Header en pantalla / Pestañas y Acciones */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Truck className="w-7 h-7 text-sky-600" />
              Centro de Reportes de Logística y Distribución
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Análisis operativo de rutas, cumplimiento de entregas por chofer y georreferenciación GPS de clientes.
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
          {/* Rango de Fechas (para Desempeño de Rutas) */}
          {tabActiva === "desempeno_rutas" && (
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
              <div>
                <Label className="text-xs text-slate-500 font-medium mb-1 block">Estado de Ruta</Label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
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
              <Label className="text-xs text-slate-500 font-medium mb-1 block">Georreferenciación (GPS)</Label>
              <select
                value={filtroGps}
                onChange={(e) => setFiltroGps(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="TODOS">Todos los Clientes</option>
                <option value="CON_GPS">Con Coordenadas GPS</option>
                <option value="SIN_GPS">Sin Coordenadas GPS</option>
              </select>
            </div>
          )}

          {/* Búsqueda por texto */}
          <div>
            <Label className="text-xs text-slate-500 font-medium mb-1 block">Búsqueda rápida</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder={
                  tabActiva === "desempeno_rutas"
                    ? "Buscar chofer, ruta, código..."
                    : "Buscar cliente, NIT, ciudad..."
                }
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
            <p className="text-sm font-medium">Cargando datos del reporte logístico...</p>
          </div>
        ) : reporteData.data && reporteData.data.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Truck className="w-10 h-10 stroke-[1.5]" />
            <p className="text-base font-semibold text-slate-600">No se encontraron registros</p>
            <p className="text-sm text-slate-400">Intente modificando el rango de fechas o los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {tabActiva === "desempeno_rutas" && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider">
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3">Ruta / Zona</th>
                    <th className="py-3 px-3">Fecha</th>
                    <th className="py-3 px-3">Chofer Asignado</th>
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-3 text-center">Paradas (Entr / Tot)</th>
                    <th className="py-3 px-3 text-right">Efectividad</th>
                    <th className="py-3 px-3 text-right">Recaudación (Bs.)</th>
                    <th className="py-3 px-3 text-right">Distancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reporteData.data.map((item, idx) => {
                    const efectividad = Number(item.porcentaje_efectividad || 0);
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-semibold text-sky-700 ">
                          {`DSP-${item.id}`}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">{item.ruta_nombre}</td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">{item.fecha}</td>
                        <td className="py-3 px-3 font-medium text-slate-800">{item.chofer_nombre || "Sin Chofer"}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              item.estado_asignacion === "COMPLETADA"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : item.estado_asignacion === "EN_RUTA"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : item.estado_asignacion === "CANCELADA"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {item.estado_asignacion}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center ">
                          <span className="font-semibold text-emerald-700">{item.paradas_entregadas || 0}</span> /{" "}
                          <span>{item.paradas_totales || 0}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-semibold ${
                              efectividad >= 90
                                ? "text-emerald-600"
                                : efectividad >= 70
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {efectividad.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-900">
                          {formatCurrency(item.total_recaudado || 0)}
                          <div className="text-[10px] text-slate-400 font-normal">
                            Ef: {formatCurrency(item.recaudacion_efectivo || 0)} | QR:{" "}
                            {formatCurrency(item.recaudacion_qr || 0)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 ">
                          {Number(item.km_recorridos || 0).toFixed(1)} km
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-semibold text-slate-800 border-t-2 border-slate-300">
                    <td colSpan={5} className="py-3 px-3 text-right">
                      Totales del Período:
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-800">
                      {reporteData.metricas?.total_paradas_entregadas || 0} / {reporteData.metricas?.total_paradas_programadas || 0}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sky-700">
                      {Number(reporteData.metricas?.efectividad_promedio || 0).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">
                      {formatCurrency(reporteData.metricas?.total_recaudado_global_bs || 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {Number(reporteData.metricas?.km_totales_recorridos || 0).toFixed(1)} km
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {tabActiva === "cobertura_clientes" && (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider">
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3">Cliente / Razón Social</th>
                    <th className="py-3 px-3">Nombre Comercial</th>
                    <th className="py-3 px-3">Ciudad</th>
                    <th className="py-3 px-3">Teléfono</th>
                    <th className="py-3 px-3">Dirección</th>
                    <th className="py-3 px-3 text-center">GPS</th>
                    <th className="py-3 px-3 text-center">Puntos Venta</th>
                    <th className="py-3 px-3 text-right">Límite Crédito (Bs.)</th>
                    <th className="py-3 px-3 text-right">Compras Históricas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reporteData.data.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-semibold text-sky-700 ">
                        {`CLI-${item.id}`}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">{item.razon_social}</td>
                      <td className="py-3 px-3 text-slate-600">{item.nombre_comercial || "-"}</td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{item.ciudad || "Sucre"}</td>
                      <td className="py-3 px-3 text-slate-500">{item.telefono || "N/A"}</td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={item.direccion}>
                        {item.direccion || "Sin dirección"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {item.latitud && item.longitud ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-semibold">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            GPS OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            Sin GPS
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-sky-700">
                        {item.puntos_venta_count || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {formatCurrency(item.limite_credito_bs || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {item.total_compras_historicas || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-semibold text-slate-800 border-t-2 border-slate-300">
                    <td colSpan={7} className="py-3 px-3 text-right">
                      Totales de Cartera ({reporteData.metricas?.total_clientes || 0} clientes):
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-sky-800">
                      {reporteData.metricas?.total_puntos_venta || 0} puntos
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-right font-bold text-slate-700">
                      {reporteData.metricas?.clientes_habilitados_credito || 0} con línea de crédito
                    </td>
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
