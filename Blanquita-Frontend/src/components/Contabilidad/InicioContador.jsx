import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import {
  Wallet,
  Landmark,
  HandCoins,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Receipt,
  Truck,
  Building2,
  Calendar,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { invalidarCache } from "@/lib/api-cache";

import {
  ObtenerDashboardKPIs,
  ObtenerCajaActual,
  ObtenerMovimientosCaja,
  ObtenerCuentasBancarias,
} from "@/services/Contabilidad/tesoreriaService";
import { ObtenerCarteraResumen } from "@/services/Contabilidad/cuentasCobrarService";
import { ObtenerKpisCxP } from "@/services/Contabilidad/cuentasPagarService";

export default function InicioContador({ usuario }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [cajaActual, setCajaActual] = useState(null);
  const [bancos, setBancos] = useState([]);
  const [movimientosRecientes, setMovimientosRecientes] = useState([]);
  const [cartera, setCartera] = useState(null);
  const [cxp, setCxp] = useState(null);
  const [fechaActual, setFechaActual] = useState("");

  const cargarDashboard = useCallback(async (forzar = false) => {
    if (forzar) {
      setRefrescando(true);
      invalidarCache("/api/tesoreria");
      invalidarCache("/api/cxc");
      invalidarCache("/api/cxp");
    } else {
      setCargando(true);
    }

    try {
      const sidFiltro = sucursal === "todas" ? null : sucursal;
      const sidCaja = sucursal && sucursal !== "todas" ? sucursal : "1";

      const [kpisRes, cajaRes, bancosRes, movsRes, carteraRes, cxpRes] = await Promise.all([
        ObtenerDashboardKPIs(sidFiltro).catch(() => null),
        ObtenerCajaActual(sidCaja).catch(() => null),
        ObtenerCuentasBancarias(true).catch(() => []),
        ObtenerMovimientosCaja({ limit: 7, idSucursal: sidFiltro }).catch(() => []),
        ObtenerCarteraResumen(sidFiltro).catch(() => null),
        ObtenerKpisCxP().catch(() => null),
      ]);

      setKpis(kpisRes);
      setCajaActual(cajaRes);
      setBancos(Array.isArray(bancosRes) ? bancosRes : (bancosRes?.items || []));
      setMovimientosRecientes(Array.isArray(movsRes) ? movsRes : (movsRes?.items || []));
      setCartera(carteraRes);
      setCxp(cxpRes);
    } catch (err) {
      console.error("Error al cargar dashboard contable:", err);
      toast.error("Error al sincronizar datos contables.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [sucursal]);

  useEffect(() => {
    const f = new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    setFechaActual(f.charAt(0).toUpperCase() + f.slice(1));
  }, []);

  useEffect(() => {
    if (!cargandoAlcance) {
      cargarDashboard();
    }
  }, [sucursal, cargandoAlcance, cargarDashboard]);

  const totalBancosBOB = bancos
    .filter((b) => b.TipoMoneda === "BOB")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  const totalBancosUSD = bancos
    .filter((b) => b.TipoMoneda === "USD")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  const totalCaja = parseFloat(cajaActual?.SaldoActual || cajaActual?.TotalEfectivoActual || 0);
  const totalCartera = parseFloat(cartera?.TotalPorCobrar || cartera?.SaldoPendienteTotal || 0);
  const totalPagar = parseFloat(cxp?.TotalSaldoPendiente || cxp?.TotalPorPagar || 0);

  return (
    <div className="space-y-4">
      {/* 1. ENCABEZADO INDUSTRIAL CONTABLE */}
      <PageHeader
        title="Posición Financiera"
        subtitle={`${fechaActual} · Control de liquidez bancaria, arqueos de caja, cartera y compromisos por pagar.`}
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
          onClick={() => cargarDashboard(true)}
          disabled={refrescando || cargando}
          className="text-xs border-slate-300 hover:bg-slate-50 h-8 px-2.5 rounded font-medium text-slate-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${refrescando ? "animate-spin" : ""}`} />
          {refrescando ? "Sincronizando..." : "Actualizar"}
        </Button>
        <a href="/contador/caja">
          <Button size="sm" className="text-xs bg-[#1C96C5] hover:bg-[#157A9E] text-white h-8 px-3 rounded font-medium border-0 shadow-none">
            <Wallet className="h-3.5 w-3.5 mr-1.5" />
            Libro de Caja
          </Button>
        </a>
      </PageHeader>

      {/* 2. MATRIZ DE KPIS DE TESORERÍA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Bancos */}
        <div className="border border-slate-200 rounded bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Disponibilidad Bancaria
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              <Landmark className="h-4 w-4 text-[#1C96C5]" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `Bs. ${totalBancosBOB.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>{bancos.length} cuentas activas</span>
              {totalBancosUSD > 0 && (
                <span className="tabular-nums font-mono text-[#15803D] font-semibold">
                  ${totalBancosUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Fondos en cuenta corriente</span>
            <a href="/contador/bancos" className="text-[11px] font-medium text-slate-700 hover:text-[#1C96C5] flex items-center">
              Bancos <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Caja Física del Día */}
        <div className="border border-slate-200 rounded bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Caja Física Operativa
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              <Wallet className="h-4 w-4 text-[#1C96C5]" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `Bs. ${totalCaja.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>Fondo: Bs. {parseFloat(cajaActual?.MontoApertura || 0).toFixed(2)}</span>
              <span className={`font-mono font-medium ${cajaActual?.Cerrado ? "text-[#B45309]" : "text-[#15803D]"}`}>
                {cajaActual?.Cerrado ? "Cerrada" : "Abierta"}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Efectivo en bóveda</span>
            <a href="/contador/caja" className="text-[11px] font-medium text-slate-700 hover:text-[#1C96C5] flex items-center">
              Movimientos <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Cartera por Cobrar */}
        <div className="border border-slate-200 rounded bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Cartera por Cobrar
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              <HandCoins className="h-4 w-4 text-[#1C96C5]" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `Bs. ${totalCartera.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>{cartera?.TotalClientesConDeuda || 0} clientes deudores</span>
              <span className="text-[#B45309] font-medium font-mono">
                {cartera?.FacturasVencidas || 0} en mora
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Notas de venta pendientes</span>
            <a href="/contador/cuentas-cobrar" className="text-[11px] font-medium text-slate-700 hover:text-[#1C96C5] flex items-center">
              Cobranzas <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Cuentas por Pagar */}
        <div className="border border-slate-200 rounded bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Cuentas por Pagar
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              <Layers className="h-4 w-4 text-[#1C96C5]" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
              {cargando ? "---" : `Bs. ${totalPagar.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
              <span>{cxp?.TotalFacturasPendientes || 0} facturas pendientes</span>
              <span className="text-[#B91C1C] font-medium font-mono">
                {cxp?.FacturasVencidas || 0} vencidas
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Proveedores e insumos</span>
            <a href="/contador/cuentas-pagar" className="text-[11px] font-medium text-slate-700 hover:text-[#1C96C5] flex items-center">
              Proveedores <ChevronRight className="h-3 w-3 ml-0.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. DETALLE DE BANCOS Y MOVIMIENTOS RECIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Posición de Cuentas Bancarias */}
        <div className="border border-slate-200 rounded bg-white">
          <div className="p-3 sm:px-4 border-b border-slate-200 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-[#1C96C5]" />
              Cuentas Bancarias Registradas
            </div>
            <a href="/contador/bancos">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 hover:text-slate-900 rounded">
                Conciliación
              </Button>
            </a>
          </div>
          <div>
            {bancos.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                {cargando ? "Consultando saldos bancarios..." : "No se tienen cuentas bancarias registradas."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bancos.map((b) => (
                  <div key={b.IdCuentaBancaria || b.NumeroCuenta} className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                        <span>{b.NombreBanco}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-mono">
                          {b.TipoMoneda}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {b.TipoCuenta || "Cuenta Operativa"} · {b.NumeroCuenta}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900">
                        {b.TipoMoneda === "USD" ? "$us " : "Bs. "}
                        {parseFloat(b.SaldoActual || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {b.Titular || "Papelera Blanquita"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Movimientos Recientes de Caja */}
        <div className="border border-slate-200 rounded bg-white">
          <div className="p-3 sm:px-4 border-b border-slate-200 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#1C96C5]" />
              Flujo de Caja en Tiempo Real
            </div>
            <a href="/contador/caja">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 hover:text-slate-900 rounded">
                Libro diario
              </Button>
            </a>
          </div>
          <div>
            {movimientosRecientes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                {cargando ? "Consultando movimientos..." : "No hay movimientos registrados en la sesión actual."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {movimientosRecientes.map((m) => {
                  const esIngreso = m.TipoMovimiento === "Ingreso";
                  return (
                    <div key={m.IdMovimientoCaja || Math.random()} className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 min-w-0 pr-3">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {m.Descripcion || m.Glosa || "Movimiento de tesorería"}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 font-mono">
                          <span>{m.Categoria || "Operativo"}</span>
                          <span>·</span>
                          <span>{m.Solicitante || "Administración"}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${esIngreso ? "text-[#15803D]" : "text-[#B91C1C]"}`}>
                          {esIngreso ? "+ Bs. " : "- Bs. "}
                          {parseFloat(m.Monto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {m.FechaMovimiento ? new Date(m.FechaMovimiento).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "Hoy"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. ATRIBUTOS Y ACCESOS RÁPIDOS CONTABLES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <a
          href="/contador/caja-chica"
          className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-900 group-hover:text-[#1C96C5] transition-colors">Caja Chica</div>
            <div className="text-[11px] text-slate-500">Gastos menores y rendiciones</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </a>

        <a
          href="/contador/notas-venta"
          className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-900 group-hover:text-[#1C96C5] transition-colors">Notas de Venta</div>
            <div className="text-[11px] text-slate-500">Facturación y despachos</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </a>

        <a
          href="/contador/importacion"
          className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-900 group-hover:text-[#1C96C5] transition-colors">Importación Extractos</div>
            <div className="text-[11px] text-slate-500">Conciliación Excel / CSV</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </a>

        <a
          href="/contador/reportes"
          className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-900 group-hover:text-[#1C96C5] transition-colors">Reportes Financieros</div>
            <div className="text-[11px] text-slate-500">Flujo, antigüedad de saldos</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        </a>
      </div>
    </div>
  );
}

