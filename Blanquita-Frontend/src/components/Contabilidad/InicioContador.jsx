import React, { useState, useEffect } from "react";
import {
  Wallet,
  Landmark,
  HandCoins,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  CheckCircle2,
  Lock,
  PlusCircle,
  FileSpreadsheet,
  Receipt,
  Truck,
  TrendingUp,
  CreditCard,
  Building2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ObtenerDashboardKPIs,
  ObtenerCajaActual,
  ObtenerMovimientosCaja,
  ObtenerCuentasBancarias,
} from "@/services/Contabilidad/tesoreriaService";
import { ObtenerCarteraResumen } from "@/services/Contabilidad/cuentasCobrarService";

export default function InicioContador({ usuario }) {
  const [kpis, setKpis] = useState(null);
  const [cajaActual, setCajaActual] = useState(null);
  const [bancos, setBancos] = useState([]);
  const [movimientosRecientes, setMovimientosRecientes] = useState([]);
  const [cartera, setCartera] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    try {
      setCargando(true);
      const [kpisRes, cajaRes, bancosRes, movsRes, carteraRes] = await Promise.all([
        ObtenerDashboardKPIs().catch(() => null),
        ObtenerCajaActual().catch(() => null),
        ObtenerCuentasBancarias(true).catch(() => []),
        ObtenerMovimientosCaja({ limit: 8 }).catch(() => []),
        ObtenerCarteraResumen().catch(() => null),
      ]);

      setKpis(kpisRes);
      setCajaActual(cajaRes);
      setBancos(Array.isArray(bancosRes) ? bancosRes : (bancosRes?.items || []));
      setMovimientosRecientes(Array.isArray(movsRes) ? movsRes : (movsRes?.items || []));
      setCartera(carteraRes);
    } catch (err) {
      toast.error("Error al cargar dashboard contable: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const totalBancosBOB = bancos
    .filter((b) => b.TipoMoneda === "BOB")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  const totalBancosUSD = bancos
    .filter((b) => b.TipoMoneda === "USD")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Saludo y Encabezado Ejecutivo */}
      <div className="bg-gradient-to-r from-[#20A7DB] via-[#35b1e0] to-[#62C1E5] text-white p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold tracking-wider uppercase text-white/80 bg-white/20 px-3 py-1 rounded-full">
            Contabilidad
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-3">
            {usuario?.NombreCompleto || "Contador General"}
          </h1>
          <p className="text-sm text-white/90 mt-1 max-w-xl">
            Resumen de liquidez en bancos, cartera, cuentas por pagar y flujo de caja.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <a href="/contador/caja">
              <Button className="bg-white text-[#20A7DB] hover:bg-slate-100 font-bold text-xs shadow-xs">
                <Wallet className="h-4 w-4 mr-1.5" /> Flujo de Caja
              </Button>
            </a>
            <a href="/contador/cuentas-cobrar">
              <Button className="bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/30">
                <HandCoins className="h-4 w-4 mr-1.5" /> Cuentas por Cobrar
              </Button>
            </a>
            <a href="/contador/cuentas-pagar">
              <Button className="bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/30">
                <Layers className="h-4 w-4 mr-1.5" /> Cuentas por Pagar
              </Button>
            </a>
            <a href="/contador/importacion">
              <Button className="bg-white/20 hover:bg-white/30 text-white font-semibold text-xs border border-white/30">
                <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Importar Archivos
              </Button>
            </a>
          </div>
        </div>

        {/* Círculos decorativos de fondo */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Tarjetas Principales de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Saldo Bancario Consolidado */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Disponibilidad Bancaria
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-800">
              Bs. {totalBancosBOB.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            {totalBancosUSD > 0 && (
              <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                + $us. {totalBancosUSD.toLocaleString("es-BO", { minimumFractionDigits: 2 })} (Cta USD)
              </div>
            )}
            <span className="text-xs text-slate-400 mt-1 block">Banco Unión, BNB, BMSC</span>
          </div>
        </div>

        {/* 2. Caja Chica del Día */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Caja Diaria Efectivo
            </span>
            {cajaActual ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs">
                Abierta
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-600 border-slate-300 font-bold text-xs">
                Cerrada
              </Badge>
            )}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-800">
              Bs. {(cajaActual?.SaldoFinalTeorico ?? cajaActual?.SaldoInicial ?? 0).toLocaleString("es-BO", {
                minimumFractionDigits: 2,
              })}
            </div>
            <div className="flex items-center gap-3 text-xs mt-1">
              <span className="text-emerald-600 font-medium">
                +{cajaActual?.TotalIngresos || 0} Bs.
              </span>
              <span className="text-rose-600 font-medium">
                -{cajaActual?.TotalEgresos || 0} Bs.
              </span>
            </div>
          </div>
        </div>

        {/* 3. Cuentas por Cobrar Clientes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cartera x Cobrar
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <HandCoins className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-800">
              Bs. {(cartera?.TotalPorCobrar || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs mt-0.5">
              {Number(cartera?.CarteraVencida || 0) > 0 ? (
                <span className="text-rose-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Bs. {Number(cartera.CarteraVencida || 0).toFixed(2)} en mora
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold">Toda la cartera al día</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Cuentas por Pagar Proveedores */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Deuda Proveedores (Insumos)
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-800">
              Bs. {(kpis?.TotalCuentasPagar || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">Vinto, Derqui, Multiflex, Colmaflex</span>
          </div>
        </div>
      </div>

      {/* Grid de 2 Columnas: Cuentas Bancarias y Últimos Movimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Cuentas Bancarias */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-[#20A7DB]" />
              <h2 className="font-bold text-slate-800 text-sm">Cuentas Bancarias Empresa</h2>
            </div>
            <a href="/contador/bancos" className="text-xs font-semibold text-[#20A7DB] hover:underline">
              Ver todas &rarr;
            </a>
          </div>

          <div className="space-y-3">
            {bancos.slice(0, 4).map((b) => (
              <div
                key={b.IdCuentaBancaria}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-xs text-slate-800">{b.NombreBanco}</div>
                  <div className="text-[11px] text-slate-400">{b.NumeroCuenta}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-800">
                    {b.TipoMoneda === "USD" ? "$us. " : "Bs. "}
                    {Number(b.SaldoActual || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                  <Badge className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0">
                    {b.TipoMoneda}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Derecha: Últimos Movimientos de Caja (Libro Diario) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#20A7DB]" />
              <h2 className="font-bold text-slate-800 text-sm">Últimos Movimientos del Libro Diario</h2>
            </div>
            <a href="/contador/caja" className="text-xs font-semibold text-[#20A7DB] hover:underline">
              Ver Libro Completo &rarr;
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Beneficiario / Glosa</th>
                  <th className="py-2.5 px-3 text-center">Tipo</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movimientosRecientes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-slate-400">
                      No hay movimientos recientes registrados.
                    </td>
                  </tr>
                ) : (
                  movimientosRecientes.map((m) => (
                    <tr key={m.IdMovimiento} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {m.FechaMovimiento ? new Date(m.FechaMovimiento).toLocaleDateString("es-BO") : "-"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {m.NombreCategoria || "General"}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate" title={m.Glosa}>
                        {m.Beneficiario ? <strong className="text-slate-800">{m.Beneficiario} - </strong> : null}
                        {m.Glosa}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          className={
                            m.Tipo === "Ingreso"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]"
                              : "bg-rose-50 text-rose-700 border-rose-200 text-[11px]"
                          }
                        >
                          {m.Tipo}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                        <span className={m.Tipo === "Ingreso" ? "text-emerald-700" : "text-rose-700"}>
                          Bs. {Number(m.Monto || 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
