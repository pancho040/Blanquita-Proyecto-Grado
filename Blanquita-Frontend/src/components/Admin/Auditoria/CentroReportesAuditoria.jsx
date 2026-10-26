import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Layers,
  Printer,
  Download,
  RotateCw,
  Search,
  Filter,
  Calendar,
  Lock,
  FileText,
  Activity,
  CheckCircle2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ReporteKpisGrid, { formatNumber } from "@/components/common/Reportes/ReporteKpisGrid";
import ReporteHeaderFormal from "@/components/common/Reportes/ReporteHeaderFormal";
import { exportarAExcelCSV } from "@/components/common/Reportes/exportarCsv";
import { getReporteAuditoriaSeguridad } from "@/services/Reportes/reportesService";

export default function CentroReportesAuditoria() {
  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState({ metricas: {}, data: [] });

  // Filtros
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");

  const cargarReporte = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReporteAuditoriaSeguridad({
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        tabla: filtroTabla || undefined,
        accion: filtroAccion !== "TODAS" ? filtroAccion : undefined,
        busqueda: busqueda || undefined,
      });
      setReporteData(res);
    } catch (err) {
      toast.error(err.message || "Error al cargar reporte de auditoría");
      setReporteData({ metricas: {}, data: [] });
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, filtroTabla, filtroAccion, busqueda]);

  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setFiltroTabla("");
    setFiltroAccion("TODAS");
    setBusqueda("");
  };

  const exportarCSV = () => {
    if (!reporteData.data || reporteData.data.length === 0) {
      toast.warning("No hay registros para exportar en este período");
      return;
    }

    const columnas = {
      id: "ID Log",
      fecha_hora: "Fecha y Hora",
      usuario_nombre: "Usuario Responsable",
      rol: "Rol Administrativo",
      modulo_tabla: "Módulo / Tabla Afectada",
      accion: "Acción Ejecutada",
      id_registro: "ID Registro Afectado",
      direccion_ip: "Dirección IP",
      detalle: "Glosa Técnica / Detalle",
    };
    exportarAExcelCSV("Reporte_Trazabilidad_Auditoria_Seguridad", columnas, reporteData.data);
    toast.success("Reporte exportado exitosamente a CSV/Excel");
  };

  const handlePrint = () => {
    window.print();
  };

  const m = reporteData.metricas || {};

  return (
    <div className="space-y-6">
      {/* Membrete formal para impresión */}
      <ReporteHeaderFormal
        titulo="Reporte de Trazabilidad, Auditoría y Seguridad de Operaciones"
        subtitulo="Supervisión de Acceso, Transacciones Financieras y Registros de Modificación"
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

      {/* Header en pantalla / Acciones */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-sky-600" />
              Centro de Reportes de Auditoría y Seguridad
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Trazabilidad integral de eventos del sistema, modificaciones de datos contables, nóminas y despachos.
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
              onClick={exportarCSV}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs superiores */}
      <ReporteKpisGrid
        kpis={[
          {
            titulo: "Total Eventos Auditados",
            valor: m.total_eventos_auditados || 0,
            subtitulo: "Operaciones procesadas en el log",
            icono: Activity,
            colorScheme: "blue",
            formato: "numero",
          },
          {
            titulo: "Transacciones Críticas",
            valor: m.eventos_criticos_financieros || 0,
            subtitulo: "Cierres, nómina y cambios de precio",
            icono: AlertTriangle,
            colorScheme: "rose",
            formato: "numero",
          },
          {
            titulo: "Modificaciones Transaccionales",
            valor: m.modificaciones_transaccionales || 0,
            subtitulo: "Updates y ajustes de registros",
            icono: Layers,
            colorScheme: "indigo",
            formato: "numero",
          },
          {
            titulo: "Usuarios Responsables",
            valor: m.usuarios_activos || 0,
            subtitulo: "Personal con actividad detectada",
            icono: Users,
            colorScheme: "emerald",
            formato: "numero",
          },
        ]}
      />

      {/* Barra de Filtros */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
          <Filter className="w-4 h-4 text-sky-600" />
          Filtros de Búsqueda y Parámetros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <Label className="text-xs text-slate-500 font-medium mb-1 block">Tabla / Entidad</Label>
            <Input
              placeholder="Ej. MovimientoCaja, Pedido..."
              value={filtroTabla}
              onChange={(e) => setFiltroTabla(e.target.value)}
              className="text-sm h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500 font-medium mb-1 block">Tipo de Acción</Label>
            <select
              value={filtroAccion}
              onChange={(e) => setFiltroAccion(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="TODAS">Todas las Acciones</option>
              <option value="CREACION">Creación</option>
              <option value="MODIFICACION">Modificación</option>
              <option value="ELIMINACION">Eliminación</option>
              <option value="CIERRE_CAJA">Cierre de Caja</option>
              <option value="APROBACION_NOMINA">Aprobación de Nómina</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 font-medium mb-1 block">Búsqueda rápida</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Usuario, glosa o IP..."
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

      {/* Tabla de Registros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RotateCw className="w-8 h-8 animate-spin text-sky-600" />
            <p className="text-sm font-medium">Cargando registros de auditoría y seguridad...</p>
          </div>
        ) : reporteData.data && reporteData.data.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
            <ShieldCheck className="w-10 h-10 stroke-[1.5]" />
            <p className="text-base font-semibold text-slate-600">No se encontraron eventos</p>
            <p className="text-sm text-slate-400">Intente modificando el rango de fechas o los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold tracking-wider">
                  <th className="py-3 px-3">Fecha y Hora</th>
                  <th className="py-3 px-3">Usuario Responsable</th>
                  <th className="py-3 px-3">Rol</th>
                  <th className="py-3 px-3">Módulo / Tabla</th>
                  <th className="py-3 px-3">Acción</th>
                  <th className="py-3 px-3">ID Registro</th>
                  <th className="py-3 px-3">Detalle de Operación</th>
                  <th className="py-3 px-3">IP Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reporteData.data.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {item.fecha_hora ? new Date(item.fecha_hora).toLocaleDateString("es-BO") : "-"}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.fecha_hora ? new Date(item.fecha_hora).toLocaleTimeString("es-BO") : ""}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.usuario_nombre}</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {item.rol}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 font-mono">{item.modulo_tabla}</td>
                    <td className="py-3 px-3 font-semibold text-sky-700">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.accion === "CREACION"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.accion === "MODIFICACION"
                            ? "bg-blue-100 text-blue-800"
                            : item.accion === "ELIMINACION"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.accion}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{item.id_registro}</td>
                    <td className="py-3 px-3 text-slate-700 max-w-sm truncate" title={item.detalle}>
                      {item.detalle}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">{item.direccion_ip || "127.0.0.1"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/80 font-semibold text-slate-800 border-t-2 border-slate-300">
                  <td colSpan={6} className="py-3 px-3 text-right">
                    Total Eventos Auditados en el Período:
                  </td>
                  <td colSpan={2} className="py-3 px-3 font-bold font-mono text-slate-900">
                    {formatNumber(reporteData.metricas?.total_eventos_auditados || 0)} eventos
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
