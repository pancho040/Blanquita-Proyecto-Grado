import React, { useState, useEffect } from "react";
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
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [cajaActual, setCajaActual] = useState(null);
  const [bancos, setBancos] = useState([]);
  const [movimientosRecientes, setMovimientosRecientes] = useState([]);
  const [cartera, setCartera] = useState(null);
  const [cxp, setCxp] = useState(null);
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    const f = new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    setFechaActual(f.charAt(0).toUpperCase() + f.slice(1));
    cargarDashboard();
  }, []);

  const cargarDashboard = async (forzar = false) => {
    if (forzar) {
      setRefrescando(true);
      invalidarCache("/api/tesoreria");
      invalidarCache("/api/cxc");
      invalidarCache("/api/cxp");
    } else {
      setCargando(true);
    }

    try {
      const [kpisRes, cajaRes, bancosRes, movsRes, carteraRes, cxpRes] = await Promise.all([
        ObtenerDashboardKPIs().catch(() => null),
        ObtenerCajaActual().catch(() => null),
        ObtenerCuentasBancarias(true).catch(() => []),
        ObtenerMovimientosCaja({ limit: 7 }).catch(() => []),
        ObtenerCarteraResumen().catch(() => null),
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
  };

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
    <div className="space-y-6">
      {/* 1. ENCABEZADO MINIMALISTA CONTABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Wallet className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                Tesorería & Contabilidad
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                {cajaActual?.Cerrado ? "Caja Diaria: Cerrada" : "Caja Diaria: Aperturada"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Posición Financiera
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {fechaActual} · Control de liquidez bancaria, arqueos de caja, cartera y compromisos por pagar.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cargarDashboard(true)}
              disabled={refrescando || cargando}
              className="text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-9 font-medium"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${refrescando ? "animate-spin" : ""}`} />
              {refrescando ? "Sincronizando..." : "Actualizar"}
            </Button>
            <a href="/contador/caja">
              <Button size="sm" className="text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 h-9 font-medium">
                <Wallet className="h-3.5 w-3.5 mr-1.5" />
                Libro de Caja
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* 2. MATRIZ DE KPIS DE TESORERÍA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bancos */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Disponibilidad Bancaria
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `Bs. ${totalBancosBOB.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{bancos.length} cuentas activas</span>
                {totalBancosUSD > 0 && (
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                    ${totalBancosUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Fondos en cuenta corriente</span>
              <a href="/contador/bancos" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Bancos <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Caja Física del Día */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Caja Física Operativa
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `Bs. ${totalCaja.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Fondo Inicial: Bs. {parseFloat(cajaActual?.MontoApertura || 0).toFixed(2)}</span>
                <span className={cajaActual?.Cerrado ? "text-amber-500 font-medium" : "text-emerald-600 font-medium"}>
                  {cajaActual?.Cerrado ? "Cerrada" : "Abierta"}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Efectivo en bóveda de planta</span>
              <a href="/contador/caja" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Movimientos <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Cartera por Cobrar */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cartera por Cobrar
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <HandCoins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `Bs. ${totalCartera.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{cartera?.TotalClientesConDeuda || 0} clientes deudores</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {cartera?.FacturasVencidas || 0} en mora
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Notas de venta pendientes</span>
              <a href="/contador/cuentas-cobrar" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Cobranzas <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Cuentas por Pagar */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cuentas por Pagar
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `Bs. ${totalPagar.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{cxp?.TotalFacturasPendientes || 0} facturas por pagar</span>
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  {cxp?.FacturasVencidas || 0} vencidas
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Proveedores e insumos</span>
              <a href="/contador/cuentas-pagar" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Proveedores <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. DETALLE DE BANCOS Y MOVIMIENTOS RECIENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posición de Cuentas Bancarias */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Landmark className="h-4 w-4 text-slate-500" />
                Cuentas Bancarias Registradas
              </CardTitle>
              <a href="/contador/bancos">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 dark:text-slate-400">
                  Conciliación
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {bancos.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {cargando ? "Consultando saldos bancarios..." : "No se tienen cuentas bancarias registradas."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {bancos.map((b) => (
                  <div key={b.IdCuentaBancaria || b.NumeroCuenta} className="p-4 sm:px-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{b.NombreBanco}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded tabular-nums">
                          {b.TipoMoneda}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {b.TipoCuenta || "Cuenta Operativa"} · {b.NumeroCuenta}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {b.TipoMoneda === "USD" ? "$us " : "Bs. "}
                        {parseFloat(b.SaldoActual || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {b.Titular || "Papelera Blanquita"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Movimientos Recientes de Caja */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Flujo de Caja en Tiempo Real
              </CardTitle>
              <a href="/contador/caja">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 dark:text-slate-400">
                  Libro diario
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {movimientosRecientes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {cargando ? "Consultando movimientos..." : "No hay movimientos registrados en la sesión actual."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {movimientosRecientes.map((m) => {
                  const esIngreso = m.TipoMovimiento === "Ingreso";
                  return (
                    <div key={m.IdMovimientoCaja || Math.random()} className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-0.5 min-w-0 pr-3">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {m.Descripcion || m.Glosa || "Movimiento de tesorería"}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 tabular-nums">
                          <span>{m.Categoria || "Operativo"}</span>
                          <span>·</span>
                          <span>{m.Solicitante || "Administración"}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs sm:text-sm font-bold tabular-nums ${esIngreso ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {esIngreso ? "+ Bs. " : "- Bs. "}
                          {parseFloat(m.Monto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {m.FechaMovimiento ? new Date(m.FechaMovimiento).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "Hoy"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. ATRIBUTOS Y ACCESOS RÁPIDOS CONTABLES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <a
          href="/contador/caja-chica"
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Caja Chica</div>
            <div className="text-[10px] text-slate-400">Gastos menores y rendiciones</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </a>

        <a
          href="/contador/notas-venta"
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Notas de Venta</div>
            <div className="text-[10px] text-slate-400">Facturación y despachos</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </a>

        <a
          href="/contador/importacion"
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Importación Extractos</div>
            <div className="text-[10px] text-slate-400">Conciliación Excel / CSV</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </a>

        <a
          href="/contador/reportes"
          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Reportes Financieros</div>
            <div className="text-[10px] text-slate-400">Flujo, antigüedad de saldos</div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </a>
      </div>
    </div>
  );
}

