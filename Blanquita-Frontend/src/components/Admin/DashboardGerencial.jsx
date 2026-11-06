import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Wallet,
  Landmark,
  Truck,
  Users,
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  FileSpreadsheet,
  ChevronRight,
  Layers,
  HandCoins,
  MapPin,
  FileText
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { invalidarCache } from "@/lib/api-cache";

// Servicios
import {
  ObtenerDashboardKPIs,
  ObtenerCuentasBancarias,
  ObtenerCajaActual,
  ObtenerMovimientosCaja
} from "@/services/Contabilidad/tesoreriaService";
import { ObtenerCarteraResumen } from "@/services/Contabilidad/cuentasCobrarService";
import { ObtenerKpisCxP } from "@/services/Contabilidad/cuentasPagarService";
import { ObtenerResumenRRHH } from "@/services/RRHH/RRHHService";
import { ObtenerAsignaciones, ObtenerRepartidores } from "@/services/Logistica/RutaService";
import { ObtenerLogsAuditoria } from "@/services/Admin/AuditService";

export default function DashboardGerencial() {
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [fechaActual, setFechaActual] = useState("");

  // Estados de datos
  const [kpisTesoreria, setKpisTesoreria] = useState(null);
  const [bancos, setBancos] = useState([]);
  const [caja, setCaja] = useState(null);
  const [cartera, setCartera] = useState(null);
  const [kpisCxP, setKpisCxP] = useState(null);
  const [rrhh, setRrhh] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [auditorias, setAuditorias] = useState([]);

  useEffect(() => {
    const f = new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    setFechaActual(f.charAt(0).toUpperCase() + f.slice(1));
    cargarDatosGenerales();
  }, []);

  const cargarDatosGenerales = async (forzar = false) => {
    if (forzar) {
      setRefrescando(true);
      invalidarCache();
    } else {
      setCargando(true);
    }

    try {
      const hoyStr = new Date().toISOString().split("T")[0];

      const [
        kpisRes,
        bancosRes,
        cajaRes,
        carteraRes,
        cxpRes,
        rrhhRes,
        asigRes,
        repartRes,
        auditRes
      ] = await Promise.all([
        ObtenerDashboardKPIs().catch(() => null),
        ObtenerCuentasBancarias(true).catch(() => []),
        ObtenerCajaActual().catch(() => null),
        ObtenerCarteraResumen().catch(() => null),
        ObtenerKpisCxP().catch(() => null),
        ObtenerResumenRRHH().catch(() => null),
        ObtenerAsignaciones(hoyStr).catch(() => []),
        ObtenerRepartidores().catch(() => []),
        ObtenerLogsAuditoria({ limit: 6 }).catch(() => ({ logs: [] }))
      ]);

      setKpisTesoreria(kpisRes);
      setBancos(Array.isArray(bancosRes) ? bancosRes : (bancosRes?.items || []));
      setCaja(cajaRes);
      setCartera(carteraRes);
      setKpisCxP(cxpRes);
      setRrhh(rrhhRes);
      setAsignaciones(Array.isArray(asigRes) ? asigRes : (asigRes?.items || []));
      setRepartidores(Array.isArray(repartRes) ? repartRes : (repartRes?.items || []));
      setAuditorias(Array.isArray(auditRes?.logs) ? auditRes.logs : (Array.isArray(auditRes) ? auditRes : []));
    } catch (err) {
      console.error("Error al consolidar métricas gerenciales:", err);
      toast.error("Hubo un inconveniente al cargar algunas métricas generales.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  // Cálculos consolidados
  const totalBancosBOB = bancos
    .filter((b) => b.TipoMoneda === "BOB")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  const totalBancosUSD = bancos
    .filter((b) => b.TipoMoneda === "USD")
    .reduce((acc, b) => acc + (parseFloat(b.SaldoActual) || 0), 0);

  const totalCajaFisica = parseFloat(caja?.SaldoActual || caja?.TotalEfectivoActual || 0);
  const liquidezTotalBOB = totalBancosBOB + totalCajaFisica;

  const totalCarteraPendiente = parseFloat(cartera?.TotalPorCobrar || cartera?.SaldoPendienteTotal || 0);
  const totalCxPPendiente = parseFloat(kpisCxP?.TotalSaldoPendiente || kpisCxP?.TotalPorPagar || 0);

  const repartidoresEnCalle = repartidores.filter((r) => r.Estado === "EN_RUTA" || r.IdEstadoRepartidor === 2).length;
  const asignacionesHoy = asignaciones.length;
  const entregadasHoy = asignaciones.filter((a) => a.Estado === "ENTREGADO" || a.Completado).length;

  return (
    <div className="space-y-6">
      {/* 1. HEADER GERENCIAL MINIMALISTA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Consolidado Ejecutivo
              </span>
              <span className="text-xs text-slate-400 tabular-nums">Shema Asociados S.R.L.</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Panel Gerencial
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {fechaActual} · Visión integral de tesorería, distribución logística, personal y seguridad.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cargarDatosGenerales(true)}
              disabled={refrescando || cargando}
              className="text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-9 font-medium"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${refrescando ? "animate-spin" : ""}`} />
              {refrescando ? "Sincronizando..." : "Actualizar datos"}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. MATRIZ DE KPIS PRINCIPALES (4 PILARES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: LIQUIDEZ CONSOLIDADA */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Liquidez Inmediata
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `Bs. ${liquidezTotalBOB.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>En Bancos: Bs. {totalBancosBOB.toLocaleString("es-BO", { maximumFractionDigits: 0 })}</span>
                {totalBancosUSD > 0 && (
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                    ${totalBancosUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Caja {caja?.Cerrado ? "Cerrada" : "Abierta"}: Bs. {totalCajaFisica.toFixed(2)}
              </span>
              <a href="/contador/inicio" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Tesorería <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: CARTERA Y COBRANZAS */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cuentas por Cobrar
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <HandCoins className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `Bs. ${totalCarteraPendiente.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{cartera?.TotalClientesConDeuda || 0} clientes en cartera</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {cartera?.FacturasVencidas || 0} vencidas
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                CxP Exigible: Bs. {totalCxPPendiente.toLocaleString("es-BO", { maximumFractionDigits: 0 })}
              </span>
              <a href="/contador/cuentas-cobrar" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Detalle <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: OPERATIVA LOGÍSTICA */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Distribución Hoy
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `${asignacionesHoy} despachos`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{repartidoresEnCalle} repartidores en ruta</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {entregadasHoy} concluidos
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {repartidores.length} choferes de flota
              </span>
              <a href="/supervisor/inicio" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Logística <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: RECURSOS HUMANOS */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Fuerza Laboral
              </span>
              <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {cargando ? "---" : `${rrhh?.TotalEmpleadosActivos || 0} activos`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>{rrhh?.AsistenciasHoy || 0} marcaciones hoy</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {rrhh?.FaltasHoy || 0} ausencias
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {rrhh?.TotalTurnosConfigurados || 4} turnos de planta
              </span>
              <a href="/admin/rrhh/inicio" className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center">
                Personal <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. BLOQUE CENTRAL EN 2 COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMNA IZQUIERDA: TESORERÍA & LOGÍSTICA */}
        <div className="space-y-6">
          {/* Posición Bancaria Detallada */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-slate-500" />
                    Posición Bancaria en Tiempo Real
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Cuentas operativas de la empresa
                  </p>
                </div>
                <a href="/contador/bancos">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 dark:text-slate-400">
                    Ver todos
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bancos.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {cargando ? "Cargando cuentas..." : "No hay cuentas bancarias registradas."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bancos.slice(0, 4).map((b) => (
                    <div key={b.IdCuentaBancaria || b.NumeroCuenta} className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {b.NombreBanco}
                        </div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {b.TipoCuenta || "Cta. Corriente"} · N° {b.NumeroCuenta}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                          {b.TipoMoneda === "USD" ? "$us " : "Bs. "}
                          {parseFloat(b.SaldoActual || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          {b.TipoMoneda}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Despachos y Flota en Ruta */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="h-4 w-4 text-slate-500" />
                    Monitoreo de Rutas & Despachos
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Actividad de distribución del día
                  </p>
                </div>
                <a href="/supervisor/asignaciones">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 dark:text-slate-400">
                    Ver despachos
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {asignaciones.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {cargando ? "Consultando despachos..." : "No se han programado despachos para la fecha."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {asignaciones.slice(0, 4).map((a) => (
                    <div key={a.IdAsignacionRuta || Math.random()} className="p-3.5 sm:px-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span>{a.Repartidor || a.NombreRepartidor || "Repartidor Asignado"}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded tabular-nums">
                            {a.Placa || a.Vehiculo || "Vehículo"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{a.NombreRuta || a.Zona || "Ruta de distribución"}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-normal ${
                            a.Estado === "ENTREGADO" || a.Completado
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                          }`}
                        >
                          {a.Estado || "EN RUTA"}
                        </Badge>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {a.TotalParadas ? `${a.ParadasCompletadas || 0}/${a.TotalParadas} paradas` : "En tránsito"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: RECURSOS HUMANOS & AUDITORÍA */}
        <div className="space-y-6">
          {/* Estado de Recursos Humanos & Planta */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    Capital Humano & Jornada Laboral
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Resumen del personal operativo y administrativo
                  </p>
                </div>
                <a href="/admin/rrhh/inicio">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 dark:text-slate-400">
                    Panel RRHH
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Asistencia del Día
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    {rrhh?.AsistenciasHoy || 0} marcaciones
                  </div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {rrhh?.TotalEmpleadosActivos
                      ? `${Math.round(((rrhh.AsistenciasHoy || 0) / rrhh.TotalEmpleadosActivos) * 100)}% de cobertura hoy`
                      : "Jornada en curso"}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                    Masa Salarial Mensual
                  </span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                    Bs. {parseFloat(rrhh?.MasaSalarialMensual || 0).toLocaleString("es-BO", { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Presupuesto base mensual
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>Turnos de Producción Configurados</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  {rrhh?.TotalTurnosConfigurados || 4} horarios
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Registro de Auditoría y Seguridad Reciente */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    Auditoría de Operaciones Críticas
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Modificaciones sensibles registradas en el sistema
                  </p>
                </div>
                <a href="/admin/auditoria">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 dark:text-slate-400">
                    Bitácora completa
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {auditorias.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  {cargando ? "Consultando bitácora..." : "No hay registros de auditoría recientes."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditorias.slice(0, 5).map((log) => (
                    <div key={log.IdAuditLog || log.Id || Math.random()} className="p-3 sm:px-5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {log.Detalle || log.Descripcion || `${log.Accion} en ${log.TablaAfectada}`}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 tabular-nums">
                          <span>{log.Usuario || log.NombreUsuario || "Usuario"}</span>
                          <span>·</span>
                          <span>{log.TablaAfectada || "Sistema"}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {log.FechaHora ? new Date(log.FechaHora).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "Hoy"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. ATRIBUTOS Y ACCESOS RÁPIDOS A MÓDULOS DE GESTIÓN */}
      <div className="pt-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Módulos del Ecosistema Papelera Blanquita
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a
            href="/contador/inicio"
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Contabilidad</div>
                <div className="text-[10px] text-slate-400">Bancos, Caja & Facturas</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href="/supervisor/inicio"
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Logística</div>
                <div className="text-[10px] text-slate-400">Rutas, Choferes & Ventas</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href="/admin/rrhh/inicio"
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Recursos Humanos</div>
                <div className="text-[10px] text-slate-400">Nómina, Asistencia & Turnos</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href="/admin/auditoria"
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Auditoría & Roles</div>
                <div className="text-[10px] text-slate-400">Control de Accesos & Logs</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </div>
  );
}

