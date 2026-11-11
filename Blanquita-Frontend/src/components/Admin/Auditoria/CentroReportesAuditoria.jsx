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
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { exportarAExcelCSV } from "@/components/common/Reportes/exportarCsv";
import { getReporteAuditoriaSeguridad } from "@/services/Reportes/reportesService";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/stores/branchStore";

export default function CentroReportesAuditoria({ usuario = null }) {
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

  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState({ metricas: {}, data: [] });
  const paginacion = usePaginacion(reporteData.data || [], 15);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("TODAS");
  const [busqueda, setBusqueda] = useState("");

  const cargarReporte = useCallback(async () => {
    if (!listoParaConsultar) return;
    setLoading(true);
    try {
      const res = await getReporteAuditoriaSeguridad({
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        tabla: filtroTabla || undefined,
        accion: filtroAccion !== "TODAS" ? filtroAccion : undefined,
        busqueda: busqueda || undefined,
        id_sucursal: sucursal === "todas" ? undefined : Number(sucursal),
      });
      setReporteData(res);
    } catch (err) {
      toast.error(err.message || "Error al cargar reporte de auditoría");
      setReporteData({ metricas: {}, data: [] });
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, filtroTabla, filtroAccion, busqueda, sucursal, listoParaConsultar]);

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
        titulo="Reporte de Acciones y Trazabilidad de Auditoría"
        subtitulo="Consolidado de eventos, modificaciones y operaciones ejecutadas por los usuarios"
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

      {/* Header en pantalla / Acciones con PageHeader y BranchFilter */}
      <div className="no-print">
        <PageHeader
          title="Centro de Reportes de Auditoría y Seguridad"
          subtitle="Trazabilidad integral de eventos del sistema, modificaciones de datos contables, nóminas y despachos."
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
            className="gap-1.5 h-8 text-xs font-semibold rounded text-slate-700 hover:bg-slate-50 border-slate-300"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#1C96C5]" : ""}`} />
            <span>Actualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 h-8 text-xs font-semibold rounded text-slate-700 hover:bg-slate-50 border-slate-300"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Imprimir</span>
          </Button>
          <Button
            size="sm"
            onClick={exportarCSV}
            className="gap-1.5 h-8 text-xs font-semibold rounded bg-[#1C96C5] hover:bg-[#157A9E] text-white border-transparent cursor-pointer shadow-none"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </PageHeader>
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
      <div className="no-print bg-white rounded border border-slate-200 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5 text-[#1C96C5]" />
          <span>Filtros de Búsqueda y Parámetros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div>
            <Label className="text-[11px] text-slate-600 font-semibold mb-1 block uppercase">Desde Fecha</Label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="text-xs h-8 rounded border-slate-300 font-mono"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 font-semibold mb-1 block uppercase">Hasta Fecha</Label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="text-xs h-8 rounded border-slate-300 font-mono"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 font-semibold mb-1 block uppercase">Tabla / Entidad</Label>
            <Input
              placeholder="Ej. MovimientoCaja, Pedido..."
              value={filtroTabla}
              onChange={(e) => setFiltroTabla(e.target.value)}
              className="text-xs h-8 rounded border-slate-300"
            />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 font-semibold mb-1 block uppercase">Tipo de Acción</Label>
            <select
              value={filtroAccion}
              onChange={(e) => setFiltroAccion(e.target.value)}
              className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
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
            <Label className="text-[11px] text-slate-600 font-semibold mb-1 block uppercase">Búsqueda rápida</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <Input
                placeholder="Usuario, módulo o detalle..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 text-xs h-8 rounded border-slate-300"
              />
            </div>
          </div>
        </div>

        <div className="pt-1 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={limpiarFiltros}
            className="text-xs h-7 text-slate-500 hover:text-slate-900 rounded"
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* Tabla de Registros */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-slate-500">
            <RotateCw className="w-6 h-6 animate-spin text-[#1C96C5]" />
            <p className="text-xs font-medium">Cargando registros de auditoría y seguridad...</p>
          </div>
        ) : reporteData.data && reporteData.data.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2">
            <ShieldCheck className="w-8 h-8 stroke-[1.5] text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron eventos</p>
            <p className="text-xs text-slate-400">Intente modificando el rango de fechas o los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px] sticky top-0">
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Usuario Responsable</th>
                  <th className="py-2.5 px-3">Rol</th>
                  <th className="py-2.5 px-3">Módulo / Tabla</th>
                  <th className="py-2.5 px-3">Acción</th>
                  <th className="py-2.5 px-3">ID Registro</th>
                  <th className="py-2.5 px-3">Detalle de Operación</th>
                </tr>
              </thead>
              {/* Cuerpo pantalla con paginación */}
              <tbody className="divide-y divide-slate-100 text-slate-700 print:hidden">
                {paginacion.itemsPaginados.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 whitespace-nowrap font-mono tabular-nums text-[11px]">
                      <div className="font-medium text-slate-800">
                        {item.fecha_hora ? new Date(item.fecha_hora).toLocaleDateString("es-BO") : "—"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.fecha_hora ? new Date(item.fecha_hora).toLocaleTimeString("es-BO") : ""}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{item.usuario_nombre}</td>
                    <td className="py-2 px-3">
                      <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {item.rol}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">{item.modulo_tabla}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                          item.accion === "CREACION"
                            ? "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                            : item.accion === "MODIFICACION"
                            ? "bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]"
                            : item.accion === "ELIMINACION"
                            ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
                            : "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                        }`}
                      >
                        {item.accion}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-mono tabular-nums text-[11px]">{item.id_registro || "—"}</td>
                    <td className="py-2 px-3 text-slate-700 max-w-sm truncate" title={item.detalle}>
                      {item.detalle || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Cuerpo impresión en papel con datos completos */}
              <tbody className="hidden print:table-row-group text-black">
                {(reporteData.data || []).map((item, idx) => (
                  <tr key={`print-${item.id || idx}`}>
                    <td className="whitespace-nowrap font-mono">
                      {item.fecha_hora ? new Date(item.fecha_hora).toLocaleDateString("es-BO") + " " + new Date(item.fecha_hora).toLocaleTimeString("es-BO") : "-"}
                    </td>
                    <td className="font-semibold">{item.usuario_nombre}</td>
                    <td>{item.rol}</td>
                    <td className="font-medium">{item.modulo_tabla}</td>
                    <td className="font-bold">{item.accion}</td>
                    <td className="font-mono">{item.id_registro}</td>
                    <td>{item.detalle}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
                  <td colSpan={5} className="py-2.5 px-3 text-right text-xs">
                    Total Eventos Auditados en el Período:
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 font-bold text-slate-900 font-mono tabular-nums text-xs">
                    {formatNumber(reporteData.metricas?.total_eventos_auditados || 0)} eventos
                  </td>
                </tr>
              </tfoot>
            </table>
            <PaginacionTabla {...paginacion} />
          </div>
        )}

        {/* Firmas de Respaldo al Imprimir */}
        <div className="hidden print:grid grid-cols-2 gap-12 text-center text-[10px] pt-14 pb-4">
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Auditor Interno de Sistemas
            </div>
            <span className="text-[9px] text-gray-600">Trazabilidad y Seguridad Informática</span>
          </div>
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Gerente General
            </div>
            <span className="text-[9px] text-gray-600">Shema Asociados S.R.L. - Supervisado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
