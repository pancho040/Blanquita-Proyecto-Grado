import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  HandCoins,
  Layers,
  Truck,
  Printer,
  Download,
  RotateCw,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ReporteKpisGrid, { formatCurrency, formatNumber } from "@/components/common/Reportes/ReporteKpisGrid";
import ReporteHeaderFormal from "@/components/common/Reportes/ReporteHeaderFormal";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { exportarAExcelCSV } from "@/components/common/Reportes/exportarCsv";
import PageHeader from "@/components/common/PageHeader";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import BranchFilter from "@/components/common/BranchFilter";
import {
  getReporteFlujoCaja,
  getReporteCuentasCobrar,
  getReporteCuentasPagar,
  getReporteNotasVenta,
} from "@/services/Reportes/reportesService";

const TABS = [
  { id: "flujo_caja", label: "Flujo de Caja", icon: Wallet },
  { id: "cuentas_cobrar", label: "Cuentas por Cobrar", icon: HandCoins },
  { id: "cuentas_pagar", label: "Cuentas por Pagar", icon: Layers },
  { id: "notas_venta", label: "Notas de Venta", icon: Truck },
];

export default function CentroReportesContabilidad({ usuario }) {
  const {
    sucursal,
    setSucursal,
    sucursales,
    cargando: cargandoSucursal,
    esMultisede,
  } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [tabActiva, setTabActiva] = useState("flujo_caja");
  const [loading, setLoading] = useState(false);
  const [reporteData, setReporteData] = useState({ metricas: {}, data: [] });
  const paginacion = usePaginacion(reporteData.data || [], 15);

  // Filtros Comunes
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // Filtros Específicos
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroUrgencia, setFiltroUrgencia] = useState("TODOS");
  const [filtroCondicion, setFiltroCondicion] = useState("TODOS");

  const cargarReporte = useCallback(async () => {
    setLoading(true);
    try {
      let res = { metricas: {}, data: [] };
      const baseParams = {
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        busqueda: busqueda || undefined,
        id_sucursal: sucursal === "todas" ? undefined : sucursal,
      };

      if (tabActiva === "flujo_caja") {
        res = await getReporteFlujoCaja({
          ...baseParams,
          tipo: filtroTipo !== "TODOS" ? filtroTipo : undefined,
        });
      } else if (tabActiva === "cuentas_cobrar") {
        res = await getReporteCuentasCobrar({
          ...baseParams,
          estado: filtroEstado !== "TODOS" ? filtroEstado : undefined,
        });
      } else if (tabActiva === "cuentas_pagar") {
        res = await getReporteCuentasPagar({
          ...baseParams,
          urgencia: filtroUrgencia !== "TODOS" ? filtroUrgencia : undefined,
        });
      } else if (tabActiva === "notas_venta") {
        res = await getReporteNotasVenta({
          ...baseParams,
          condicion: filtroCondicion !== "TODOS" ? filtroCondicion : undefined,
        });
      }
      setReporteData(res);
    } catch (err) {
      toast.error(err.message || "Error al cargar reporte contable");
      setReporteData({ metricas: {}, data: [] });
    } finally {
      setLoading(false);
    }
  }, [tabActiva, fechaInicio, fechaFin, busqueda, filtroTipo, filtroEstado, filtroUrgencia, filtroCondicion, sucursal]);

  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setBusqueda("");
    setFiltroTipo("TODOS");
    setFiltroEstado("TODOS");
    setFiltroUrgencia("TODOS");
    setFiltroCondicion("TODOS");
  };

  const exportarCSVActual = () => {
    if (!reporteData.data || !reporteData.data.length) {
      toast.warning("No hay datos para exportar");
      return;
    }

    if (tabActiva === "flujo_caja") {
      exportarAExcelCSV(
        "Reporte_Flujo_Caja_Blanquita",
        {
          id: "ID",
          fecha_hora: "Fecha y Hora",
          tipo: "Tipo",
          categoria: "Categoría",
          glosa: "Glosa / Concepto",
          beneficiario: "Beneficiario / Solicitante",
          referencia: "Nro. Comprobante / Ref",
          metodo_pago: "Método de Pago",
          monto: "Monto (Bs.)",
        },
        reporteData.data
      );
    } else if (tabActiva === "cuentas_cobrar") {
      exportarAExcelCSV(
        "Reporte_Cuentas_Cobrar_Blanquita",
        {
          nro_nota: "Nro. Nota",
          cliente_nombre: "Cliente",
          cliente_nit: "NIT/CI",
          ciudad: "Ciudad",
          fecha_emision: "Fecha Emisión",
          fecha_vencimiento: "Fecha Vencimiento",
          dias_mora: "Días Mora",
          urgencia: "Estado Urgencia",
          monto_total: "Monto Despacho (Bs.)",
          total_abonado: "Total Abonado (Bs.)",
          saldo_pendiente: "Saldo Deudor (Bs.)",
        },
        reporteData.data
      );
    } else if (tabActiva === "cuentas_pagar") {
      exportarAExcelCSV(
        "Reporte_Cuentas_Pagar_Blanquita",
        {
          proveedor_nombre: "Proveedor",
          proveedor_nit: "NIT Proveedor",
          nro_factura_o_nota: "Nro. Factura / Nota",
          fecha_recepcion: "Fecha Recepción",
          fecha_vencimiento: "Fecha Vencimiento",
          dias_para_vencimiento: "Días para Vencimiento",
          urgencia: "Urgencia",
          monto_total: "Monto Total (Bs.)",
          saldo_pendiente_bs: "Saldo Pendiente (Bs.)",
        },
        reporteData.data
      );
    } else if (tabActiva === "notas_venta") {
      exportarAExcelCSV(
        "Reporte_Notas_Venta_Blanquita",
        {
          nro_nota: "Nro. Nota Venta",
          nro_entrega: "Nro. Despacho",
          fecha_venta: "Fecha Venta",
          cliente_nombre: "Cliente",
          ciudad_destino: "Destino",
          chofer: "Chofer",
          placa: "Placa",
          condicion_venta: "Condición",
          total_bruto: "Total Bruto (Bs.)",
          descuento: "Bonificación (Bs.)",
          importe_neto: "Total Neto (Bs.)",
          total_cancelado: "Total Cancelado (Bs.)",
          saldo_pendiente: "Saldo Pendiente (Bs.)",
        },
        reporteData.data
      );
    }
    toast.success("Reporte exportado exitosamente a CSV/Excel");
  };

  const handlePrint = () => {
    window.print();
  };

  // KPIs dinámicos según pestaña
  const getKpis = () => {
    const m = reporteData.metricas || {};
    if (tabActiva === "flujo_caja") {
      return [
        { titulo: "Total Ingresos", valor: m.total_ingresos_bs, esMoneda: true, icono: ArrowDownLeft, colorText: "text-emerald-600", colorBg: "bg-emerald-50 dark:bg-emerald-950/40" },
        { titulo: "Total Egresos", valor: m.total_egresos_bs, esMoneda: true, icono: ArrowUpRight, colorText: "text-rose-600", colorBg: "bg-rose-50 dark:bg-rose-950/40" },
        { titulo: "Saldo Neto de Caja", valor: m.saldo_neto_bs, esMoneda: true, destacado: true, icono: Wallet, colorText: "text-blue-600", colorBg: "bg-blue-50 dark:bg-blue-950/40" },
        { titulo: "Total Transacciones", valor: m.total_movimientos, esMoneda: false, icono: Clock, colorText: "text-slate-600", colorBg: "bg-slate-100 dark:bg-slate-800" },
      ];
    } else if (tabActiva === "cuentas_cobrar") {
      return [
        { titulo: "Cartera Total Despachada", valor: m.total_cartera_bs, esMoneda: true, icono: HandCoins, colorText: "text-blue-600", colorBg: "bg-blue-50 dark:bg-blue-950/40" },
        { titulo: "Total Cobrado / Recuperado", valor: m.total_abonado_bs, esMoneda: true, icono: CheckCircle2, colorText: "text-emerald-600", colorBg: "bg-emerald-50 dark:bg-emerald-950/40" },
        { titulo: "Saldo Deudor Pendiente", valor: m.total_pendiente_bs, esMoneda: true, destacado: true, icono: AlertTriangle, colorText: "text-amber-600", colorBg: "bg-amber-50 dark:bg-amber-950/40" },
        { titulo: "Mora > 15 Días", valor: m.deuda_vencida_15_dias_bs, esMoneda: true, icono: AlertTriangle, colorText: "text-rose-600", colorBg: "bg-rose-50 dark:bg-rose-950/40", subtitulo: `${m.clientes_en_riesgo || 0} clientes bloqueados` },
      ];
    } else if (tabActiva === "cuentas_pagar") {
      return [
        { titulo: "Deuda Total Proveedores", valor: m.deuda_total_acumulada_bs, esMoneda: true, destacado: true, icono: Layers, colorText: "text-blue-600", colorBg: "bg-blue-50 dark:bg-blue-950/40" },
        { titulo: "Deuda Vencida", valor: m.deuda_vencida_bs, esMoneda: true, icono: AlertTriangle, colorText: "text-rose-600", colorBg: "bg-rose-50 dark:bg-rose-950/40" },
        { titulo: "Vencimiento < 7 Días", valor: m.deuda_critica_7_dias_bs, esMoneda: true, icono: Clock, colorText: "text-amber-600", colorBg: "bg-amber-50 dark:bg-amber-950/40" },
        { titulo: "Deuda Regular Programada", valor: m.deuda_regular_bs, esMoneda: true, icono: CheckCircle2, colorText: "text-emerald-600", colorBg: "bg-emerald-50 dark:bg-emerald-950/40" },
      ];
    } else {
      return [
        { titulo: "Total Venta Bruta", valor: m.total_bruto_bs, esMoneda: true, icono: Truck, colorText: "text-blue-600", colorBg: "bg-blue-50 dark:bg-blue-950/40" },
        { titulo: "Bonificaciones Otorgadas", valor: m.total_descuentos_bs, esMoneda: true, icono: AlertTriangle, colorText: "text-slate-600", colorBg: "bg-slate-100 dark:bg-slate-800" },
        { titulo: "Importe Neto Liquidado", valor: m.total_neto_bs, esMoneda: true, destacado: true, icono: CheckCircle2, colorText: "text-emerald-600", colorBg: "bg-emerald-50 dark:bg-emerald-950/40" },
        { titulo: "Total Saldo por Cobrar", valor: m.total_saldo_pendiente_bs, esMoneda: true, icono: HandCoins, colorText: "text-amber-600", colorBg: "bg-amber-50 dark:bg-amber-950/40" },
      ];
    }
  };

  const getTituloReporte = () => {
    switch (tabActiva) {
      case "flujo_caja":
        return "Reporte Detallado de Flujo de Caja y Tesorería";
      case "cuentas_cobrar":
        return "Reporte de Cartera y Cuentas por Cobrar a Clientes";
      case "cuentas_pagar":
        return "Reporte de Cuentas por Pagar a Proveedores";
      case "notas_venta":
        return "Reporte de Despachos y Notas de Venta Valorizadas";
      default:
        return "Reporte Contable";
    }
  };

  return (
    <div className="space-y-6">
      {/* Membrete formal para impresión */}
      <ReporteHeaderFormal
        titulo={getTituloReporte()}
        subtitulo="Módulo de Contabilidad General, Tesorería y Finanzas"
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
      <div className="no-print">
        <PageHeader
          titulo="Centro de Reportes de Contabilidad y Finanzas"
          subtitulo="Consolidación de flujo de caja, cartera de clientes, cuentas por pagar y notas de venta con filtros y exportación formal."
          icono={Wallet}
          permiteTodas={true}
          sucursal={sucursal}
          setSucursal={setSucursal}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={cargarReporte}
                disabled={loading}
                className="h-8 rounded gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#1C96C5]" : ""}`} />
                Actualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 rounded gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                Imprimir
              </Button>
              <Button
                size="sm"
                onClick={exportarCSVActual}
                className="h-8 rounded gap-1.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </Button>
            </div>
          }
        />
      </div>

      <div className="no-print bg-white rounded border border-slate-200 p-4">
        {/* Pestañas de Navegación */}
        <div className="flex border-b border-slate-200 mt-4 gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const activa = tabActiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activa
                    ? "border-[#1C96C5] text-[#1C96C5] bg-[#F0F9FF] rounded-t-sm"
                    : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${activa ? "text-[#1C96C5]" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards de Métricas Superiores */}
      <ReporteKpisGrid items={getKpis()} loading={loading} />

      {/* Barra de Filtros */}
      <div className="no-print bg-white rounded border border-slate-200 p-3.5">
        <div className="flex items-center gap-2 mb-2.5 text-slate-800 font-semibold text-xs">
          <Filter className="w-3.5 h-3.5 text-[#1C96C5]" />
          Filtros de Búsqueda y Parámetros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-[11px] text-slate-500 font-medium mb-1 block">
              Búsqueda Libre
            </Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por cliente, proveedor, glosa, ref..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 text-xs h-8 rounded border-slate-300"
              />
            </div>
          </div>

          <div>
            <Label className="text-[11px] text-slate-500 font-medium mb-1 block">
              Desde Fecha
            </Label>
            <Input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="text-xs h-8 rounded border-slate-300 font-mono"
            />
          </div>

          <div>
            <Label className="text-[11px] text-slate-500 font-medium mb-1 block">
              Hasta Fecha
            </Label>
            <Input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="text-xs h-8 rounded border-slate-300 font-mono"
            />
          </div>

          {/* Filtros específicos por pestaña */}
          {tabActiva === "flujo_caja" && (
            <div>
              <Label className="text-[11px] text-slate-500 font-medium mb-1 block">
                Tipo Movimiento
              </Label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-[#1C96C5]"
              >
                <option value="TODOS">Todos los tipos</option>
                <option value="Ingreso">Ingreso</option>
                <option value="Egreso">Egreso</option>
              </select>
            </div>
          )}

          {tabActiva === "cuentas_cobrar" && (
            <div>
              <Label className="text-[11px] text-slate-500 font-medium mb-1 block">
                Estado de Mora
              </Label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-[#1C96C5]"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="VIGENTE">Vigente (Al día)</option>
                <option value="VENCIDO_15">Mora &gt; 15 Días</option>
                <option value="CANCELADO">Cancelados</option>
              </select>
            </div>
          )}

          {tabActiva === "cuentas_pagar" && (
            <div>
              <Label className="text-[11px] text-slate-500 font-medium mb-1 block">
                Nivel Urgencia
              </Label>
              <select
                value={filtroUrgencia}
                onChange={(e) => setFiltroUrgencia(e.target.value)}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-[#1C96C5]"
              >
                <option value="TODOS">Todas las urgencias</option>
                <option value="VENCIDO">Vencido</option>
                <option value="CRÍTICO">Crítico (&lt; 7 días)</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>
          )}

          {tabActiva === "notas_venta" && (
            <div>
              <Label className="text-[11px] text-slate-500 font-medium mb-1 block">
                Condición Venta
              </Label>
              <select
                value={filtroCondicion}
                onChange={(e) => setFiltroCondicion(e.target.value)}
                className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:border-[#1C96C5]"
              >
                <option value="TODOS">Todas las condiciones</option>
                <option value="CONTADO">Al Contado</option>
                <option value="CREDITO">A Crédito</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={limpiarFiltros}
            className="text-xs h-8 px-2.5 border-slate-300 text-slate-600 hover:text-slate-800 rounded"
          >
            Limpiar Filtros
          </Button>
          <Button
            size="sm"
            onClick={cargarReporte}
            disabled={loading}
            className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs h-8 px-3 gap-1.5 rounded font-medium"
          >
            <RotateCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Aplicar Filtros
          </Button>
        </div>
      </div>

      {/* DOCUMENTO FORMAL IMPRESO & TABLA WEB */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden p-4 print:p-0 print:border-none">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RotateCw className="h-6 w-6 animate-spin text-[#1C96C5]" />
            <p className="text-xs font-medium">Generando datos del reporte...</p>
          </div>
        ) : !reporteData.data || !reporteData.data.length ? (
          <div className="py-16 text-center text-slate-400 font-medium text-xs">
            No se encontraron registros contables para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* 1. Tabla Flujo de Caja */}
            {tabActiva === "flujo_caja" && (
              <table className="w-full border-collapse text-xs print:text-[9px]">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] text-left print:bg-gray-100 print:text-black">
                    <th className="py-2.5 px-3 print:border print:border-black text-center w-10">#</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Fecha / Hora</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Tipo</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Categoría</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Glosa / Concepto</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Beneficiario</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Nro. Ref</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Método</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right font-bold">Monto (Bs.)</th>
                  </tr>
                </thead>
                {/* Cuerpo pantalla con paginación */}
                <tbody className="divide-y divide-slate-100 text-slate-700 print:hidden">
                  {paginacion.itemsPaginados.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-mono font-medium text-slate-400">
                        {paginacion.indiceInicio + idx}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono">
                        {new Date(item.fecha_hora).toLocaleDateString("es-BO")} {new Date(item.fecha_hora).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${
                            item.tipo === "Ingreso"
                              ? "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                              : "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
                          }`}
                        >
                          {item.tipo}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-medium">{item.categoria}</td>
                      <td className="py-2 px-3 max-w-xs truncate" title={item.glosa}>{item.glosa}</td>
                      <td className="py-2 px-3">{item.beneficiario}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{item.referencia}</td>
                      <td className="py-2 px-3">{item.metodo_pago}</td>
                      <td
                        className={`py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          item.tipo === "Ingreso" ? "text-[#15803D]" : "text-[#B91C1C]"
                        }`}
                      >
                        {formatCurrency(item.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Cuerpo impresión en papel con datos completos */}
                <tbody className="hidden print:table-row-group text-black">
                  {(reporteData.data || []).map((item, idx) => (
                    <tr key={`print-${item.id || idx}`} className="border-b border-gray-300">
                      <td className="text-center font-mono">{idx + 1}</td>
                      <td className="whitespace-nowrap font-mono">
                        {new Date(item.fecha_hora).toLocaleDateString("es-BO")} {new Date(item.fecha_hora).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>{item.tipo}</td>
                      <td className="font-semibold">{item.categoria}</td>
                      <td>{item.glosa}</td>
                      <td>{item.beneficiario}</td>
                      <td className="font-mono">{item.referencia}</td>
                      <td>{item.metodo_pago}</td>
                      <td className="text-right font-mono tabular-nums font-bold whitespace-nowrap">{formatCurrency(item.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-300 print:bg-gray-200 print:text-black print:border-black">
                    <td colSpan={8} className="py-2.5 px-3 text-right uppercase print:border print:border-black text-[11px]">
                      SALDO NETO DEL REPORTE:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-sm text-[#1C96C5] print:text-black print:border print:border-black">
                      {formatCurrency(reporteData.metricas?.saldo_neto_bs)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 2. Tabla Cuentas por Cobrar */}
            {tabActiva === "cuentas_cobrar" && (
              <table className="w-full border-collapse text-xs print:text-[9px]">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] text-left print:bg-gray-100 print:text-black">
                    <th className="py-2.5 px-3 print:border print:border-black text-center w-10">#</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Nro. Nota</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Cliente</th>
                    <th className="py-2.5 px-3 print:border print:border-black">NIT / CI</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Ciudad</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Emisión</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Vencimiento</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-center">Días Mora</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-center">Urgencia</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right">Monto Total</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right">Abonado</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right font-bold">Saldo Deudor</th>
                  </tr>
                </thead>
                {/* Cuerpo pantalla con paginación */}
                <tbody className="divide-y divide-slate-100 text-slate-700 print:hidden">
                  {paginacion.itemsPaginados.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-mono font-medium text-slate-400">{paginacion.indiceInicio + idx}</td>
                      <td className="py-2 px-3 font-mono font-medium text-[#1C96C5]">{item.nro_nota}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{item.cliente_nombre}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{item.cliente_nit}</td>
                      <td className="py-2 px-3">{item.ciudad}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono">{item.fecha_emision}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono">{item.fecha_vencimiento || "-"}</td>
                      <td className="py-2 px-3 text-center font-mono">
                        {item.dias_mora > 0 ? (
                          <span className={item.dias_mora > 15 ? "text-[#B91C1C] font-bold" : "text-[#B45309]"}>
                            {item.dias_mora} d
                          </span>
                        ) : (
                          <span className="text-[#15803D]">0 d</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${
                            item.urgencia === "VENCIDO"
                              ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
                              : item.urgencia === "CRÍTICO"
                              ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                              : item.urgencia === "CANCELADO"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                          }`}
                        >
                          {item.urgencia}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrency(item.monto_total)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-[#15803D]">{formatCurrency(item.total_abonado)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#B91C1C]">{formatCurrency(item.saldo_pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Cuerpo impresión en papel con datos completos */}
                <tbody className="hidden print:table-row-group text-black">
                  {(reporteData.data || []).map((item, idx) => (
                    <tr key={`print-${item.id || idx}`} className="border-b border-gray-300">
                      <td className="text-center font-mono">{idx + 1}</td>
                      <td className="font-mono">{item.nro_nota}</td>
                      <td className="font-semibold">{item.cliente_nombre}</td>
                      <td className="font-mono">{item.cliente_nit}</td>
                      <td>{item.ciudad}</td>
                      <td className="whitespace-nowrap font-mono">{item.fecha_emision}</td>
                      <td className="whitespace-nowrap font-mono">{item.fecha_vencimiento || "-"}</td>
                      <td className="text-center font-mono font-bold">{item.dias_mora || 0} d</td>
                      <td className="text-center">{item.urgencia}</td>
                      <td className="text-right font-mono tabular-nums">{formatCurrency(item.monto_total)}</td>
                      <td className="text-right font-mono tabular-nums">{formatCurrency(item.total_abonado)}</td>
                      <td className="text-right font-mono tabular-nums font-bold">{formatCurrency(item.saldo_pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-300 print:bg-gray-200 print:text-black print:border-black">
                    <td colSpan={9} className="py-2.5 px-3 text-right uppercase print:border print:border-black text-[11px]">
                      TOTAL CARTERA POR COBRAR:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums print:border print:border-black">{formatCurrency(reporteData.metricas?.total_cartera_bs)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#15803D] print:text-black print:border print:border-black">{formatCurrency(reporteData.metricas?.total_abonado_bs)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#B91C1C] print:text-black print:border print:border-black">{formatCurrency(reporteData.metricas?.total_pendiente_bs)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 3. Tabla Cuentas por Pagar */}
            {tabActiva === "cuentas_pagar" && (
              <table className="w-full border-collapse text-xs print:text-[9px]">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] text-left print:bg-gray-100 print:text-black">
                    <th className="py-2.5 px-3 print:border print:border-black text-center w-10">#</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Proveedor</th>
                    <th className="py-2.5 px-3 print:border print:border-black">NIT</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Nro. Factura / Nota</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Concepto</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Recepción</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Vencimiento</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-center">Días Restantes</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-center">Urgencia</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right font-bold">Saldo Pendiente</th>
                  </tr>
                </thead>
                {/* Cuerpo pantalla con paginación */}
                <tbody className="divide-y divide-slate-100 text-slate-700 print:hidden">
                  {paginacion.itemsPaginados.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-mono font-medium text-slate-400">{paginacion.indiceInicio + idx}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{item.proveedor_nombre}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{item.proveedor_nit}</td>
                      <td className="py-2 px-3 font-mono text-[#1C96C5]">{item.nro_factura_o_nota}</td>
                      <td className="py-2 px-3 max-w-xs truncate" title={item.concepto}>{item.concepto}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono">{item.fecha_recepcion}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono">{item.fecha_vencimiento || "-"}</td>
                      <td className="py-2 px-3 text-center font-mono">{item.dias_para_vencimiento} d</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${
                            item.urgencia === "VENCIDO"
                              ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
                              : item.urgencia === "CRÍTICO"
                              ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
                              : "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                          }`}
                        >
                          {item.urgencia}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#B91C1C]">
                        {formatCurrency(item.saldo_pendiente_bs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Cuerpo impresión en papel con datos completos */}
                <tbody className="hidden print:table-row-group text-black">
                  {(reporteData.data || []).map((item, idx) => (
                    <tr key={`print-${item.id || idx}`} className="border-b border-gray-300">
                      <td className="text-center font-mono">{idx + 1}</td>
                      <td className="font-semibold">{item.proveedor_nombre}</td>
                      <td className="font-mono">{item.proveedor_nit}</td>
                      <td className="font-mono">{item.nro_factura_o_nota}</td>
                      <td>{item.concepto}</td>
                      <td className="whitespace-nowrap font-mono">{item.fecha_recepcion}</td>
                      <td className="whitespace-nowrap font-mono">{item.fecha_vencimiento || "-"}</td>
                      <td className="text-center font-mono font-bold">{item.dias_para_vencimiento} d</td>
                      <td className="text-center">{item.urgencia}</td>
                      <td className="text-right font-mono tabular-nums font-bold">{formatCurrency(item.saldo_pendiente_bs)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-300 print:bg-gray-200 print:text-black print:border-black">
                    <td colSpan={9} className="py-2.5 px-3 text-right uppercase print:border print:border-black text-[11px]">
                      TOTAL DEUDA PROVEEDORES:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#B91C1C] print:text-black print:border print:border-black">
                      {formatCurrency(reporteData.metricas?.deuda_total_acumulada_bs)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 4. Tabla Notas de Venta */}
            {tabActiva === "notas_venta" && (
              <table className="w-full border-collapse text-xs print:text-[9px]">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] text-left print:bg-gray-100 print:text-black">
                    <th className="py-2.5 px-3 print:border print:border-black text-center w-10">#</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Nro. Nota</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Fecha</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Cliente</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Ciudad</th>
                    <th className="py-2.5 px-3 print:border print:border-black">Chofer / Placa</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-center">Condición</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right">Total Bruto</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right">Bonificación</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right font-bold">Importe Neto</th>
                    <th className="py-2.5 px-3 print:border print:border-black text-right font-bold">Saldo</th>
                  </tr>
                </thead>
                {/* Cuerpo pantalla con paginación */}
                <tbody className="divide-y divide-slate-100 text-slate-700 print:hidden">
                  {paginacion.itemsPaginados.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center font-mono font-medium text-slate-400">{paginacion.indiceInicio + idx}</td>
                      <td className="py-2 px-3 font-mono font-medium text-[#1C96C5]">{item.nro_nota}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-mono">{item.fecha_venta}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{item.cliente_nombre}</td>
                      <td className="py-2 px-3">{item.ciudad_destino}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">{item.chofer} ({item.placa})</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${item.condicion_venta === "Contado" ? "border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]" : "border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]"}`}>
                          {item.condicion_venta}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{formatCurrency(item.total_bruto)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">{formatCurrency(item.descuento)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">{formatCurrency(item.importe_neto)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#B91C1C]">{formatCurrency(item.saldo_pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Cuerpo impresión en papel con datos completos */}
                <tbody className="hidden print:table-row-group text-black">
                  {(reporteData.data || []).map((item, idx) => (
                    <tr key={`print-${item.id || idx}`} className="border-b border-gray-300">
                      <td className="text-center font-mono">{idx + 1}</td>
                      <td className="font-mono">{item.nro_nota}</td>
                      <td className="whitespace-nowrap font-mono">{item.fecha_venta}</td>
                      <td className="font-semibold">{item.cliente_nombre}</td>
                      <td>{item.ciudad_destino}</td>
                      <td className="font-mono">{item.chofer} ({item.placa})</td>
                      <td>{item.condicion_venta}</td>
                      <td className="text-right font-mono tabular-nums">{formatCurrency(item.total_bruto)}</td>
                      <td className="text-right font-mono tabular-nums">{formatCurrency(item.descuento)}</td>
                      <td className="text-right font-mono tabular-nums font-bold">{formatCurrency(item.importe_neto)}</td>
                      <td className="text-right font-mono tabular-nums font-bold">{formatCurrency(item.saldo_pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-300 print:bg-gray-200 print:text-black print:border-black">
                    <td colSpan={7} className="py-2.5 px-3 text-right uppercase print:border print:border-black text-[11px]">TOTALES VENTAS:</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums print:border print:border-black">{formatCurrency(reporteData.metricas?.total_bruto_bs)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 print:border print:border-black">{formatCurrency(reporteData.metricas?.total_descuentos_bs)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 print:border print:border-black">{formatCurrency(reporteData.metricas?.total_neto_bs)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#B91C1C] print:text-black print:border print:border-black">{formatCurrency(reporteData.metricas?.total_saldo_pendiente_bs)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            <PaginacionTabla {...paginacion} />
          </div>
        )}

        {/* Firmas de Respaldo al Imprimir */}
        <div className="hidden print:grid grid-cols-2 gap-12 text-center text-[10px] pt-14 pb-4">
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Contador General
            </div>
            <span className="text-[9px] text-gray-600">Revisado y Conciliado Conforme</span>
          </div>
          <div>
            <div className="border-t border-black pt-1 w-2/3 mx-auto font-bold uppercase">
              Gerente General
            </div>
            <span className="text-[9px] text-gray-600">Shema Asociados S.R.L. - Aprobado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
