import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Wallet,
  Landmark,
  Truck,
  Users,
  ShieldCheck,
  RefreshCw,
  Clock,
  ChevronRight,
  HandCoins,
  MapPin
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { invalidarCache } from "@/lib/api-cache";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/stores/branchStore";

// Servicios
import {
  ObtenerDashboardKPIs,
  ObtenerCuentasBancarias,
  ObtenerCajaActual
} from "@/services/Contabilidad/tesoreriaService";
import { ObtenerCarteraResumen } from "@/services/Contabilidad/cuentasCobrarService";
import { ObtenerKpisCxP } from "@/services/Contabilidad/cuentasPagarService";
import { ObtenerResumenRRHH } from "@/services/RRHH/RRHHService";
import { ObtenerAsignaciones, ObtenerRepartidores } from "@/services/Logistica/RutaService";
import { ObtenerLogsAuditoria } from "@/services/Admin/AuditService";

export default function DashboardGerencial({ usuario = null }) {
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
  }, []);

  const cargarDatosGenerales = async (forzar = false) => {
    if (!listoParaConsultar) return;
    if (forzar) {
      setRefrescando(true);
      invalidarCache();
    } else {
      setCargando(true);
    }

    try {
      const hoyStr = new Date().toISOString().split("T")[0];
      const sid = sucursal === "todas" ? null : Number(sucursal);

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
        ObtenerDashboardKPIs(sid).catch(() => null),
        ObtenerCuentasBancarias(true).catch(() => []),
        ObtenerCajaActual(sid).catch(() => null),
        ObtenerCarteraResumen(sid).catch(() => null),
        ObtenerKpisCxP().catch(() => null),
        ObtenerResumenRRHH(sid).catch(() => null),
        ObtenerAsignaciones(hoyStr, sid).catch(() => []),
        ObtenerRepartidores().catch(() => []),
        ObtenerLogsAuditoria({ limit: 6, id_sucursal: sid }).catch(() => ({ logs: [] }))
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

  useEffect(() => {
    if (listoParaConsultar) {
      cargarDatosGenerales();
    }
  }, [sucursal, listoParaConsultar]);

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
    <div className="space-y-4">
      {/* 1. HEADER GERENCIAL CON PAGEHEADER Y BRANCHFILTER */}
      <PageHeader
        title="Panel Gerencial"
        subtitle={`${fechaActual} · Visión integral de tesorería, distribución logística, personal y seguridad.`}
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
          onClick={() => cargarDatosGenerales(true)}
          disabled={refrescando || cargando}
          className="h-8 text-xs border-slate-300 hover:bg-slate-50 font-medium rounded"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-600 ${refrescando ? "animate-spin text-[#1C96C5]" : ""}`} />
          {refrescando ? "Sincronizando..." : "Actualizar datos"}
        </Button>
      </PageHeader>

      {/* 2. MATRIZ DE KPIS PRINCIPALES (4 PILARES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: LIQUIDEZ CONSOLIDADA */}
        <Card className="border border-slate-200 rounded bg-white shadow-none">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Liquidez Inmediata
              </span>
              <div className="p-1.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {cargando ? "---" : `Bs. ${liquidezTotalBOB.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 mt-1 font-mono tabular-nums">
                <span>En Bancos: Bs. {totalBancosBOB.toLocaleString("es-BO", { maximumFractionDigits: 0 })}</span>
                {totalBancosUSD > 0 && (
                  <span className="text-[#15803D] font-semibold">
                    ${totalBancosUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                  </span>
                )}
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Caja {caja?.Cerrado ? "Cerrada" : "Abierta"}: Bs. {totalCajaFisica.toFixed(2)}
              </span>
              <a href="/contador/inicio" className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center">
                Tesorería <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: CARTERA Y COBRANZAS */}
        <Card className="border border-slate-200 rounded bg-white shadow-none">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Cuentas por Cobrar
              </span>
              <div className="p-1.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <HandCoins className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {cargando ? "---" : `Bs. ${totalCarteraPendiente.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 mt-1 font-mono tabular-nums">
                <span>{cartera?.TotalClientesConDeuda || 0} clientes</span>
                <span className="text-[#B45309] font-medium">
                  {cartera?.FacturasVencidas || 0} vencidas
                </span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                CxP: Bs. {totalCxPPendiente.toLocaleString("es-BO", { maximumFractionDigits: 0 })}
              </span>
              <a href="/contador/cuentas-cobrar" className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center">
                Detalle <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: OPERATIVA LOGÍSTICA */}
        <Card className="border border-slate-200 rounded bg-white shadow-none">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Distribución Hoy
              </span>
              <div className="p-1.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {cargando ? "---" : `${asignacionesHoy} despachos`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 mt-1 font-mono tabular-nums">
                <span>{repartidoresEnCalle} repartidores en ruta</span>
                <span className="text-[#15803D] font-medium">
                  {entregadasHoy} concluidos
                </span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {repartidores.length} choferes de flota
              </span>
              <a href="/supervisor/inicio" className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center">
                Logística <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: RECURSOS HUMANOS */}
        <Card className="border border-slate-200 rounded bg-white shadow-none">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Fuerza Laboral
              </span>
              <div className="p-1.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {cargando ? "---" : `${rrhh?.TotalEmpleadosActivos || 0} activos`}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 mt-1 font-mono tabular-nums">
                <span>{rrhh?.AsistenciasHoy || 0} marcaciones</span>
                <span className="text-slate-600">
                  {rrhh?.FaltasHoy || 0} ausencias
                </span>
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {rrhh?.TotalTurnosConfigurados || 4} turnos fábrica
              </span>
              <a href="/admin/rrhh/inicio" className="text-xs font-medium text-slate-700 hover:text-slate-900 flex items-center">
                Personal <ChevronRight className="h-3 w-3 ml-0.5" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. BLOQUE CENTRAL EN 2 COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* COLUMNA IZQUIERDA: TESORERÍA & LOGÍSTICA */}
        <div className="space-y-4">
          {/* Posición Bancaria Detallada */}
          <Card className="border border-slate-200 rounded bg-white shadow-none">
            <CardHeader className="p-3.5 sm:px-4 border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                    <Landmark className="h-4 w-4 text-slate-600" />
                    Posición Bancaria en Tiempo Real
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Cuentas operativas de la empresa
                  </p>
                </div>
                <a href="/contador/bancos">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-700 rounded">
                    Ver todos
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {bancos.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  {cargando ? "Cargando cuentas..." : "No hay cuentas bancarias registradas."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {bancos.slice(0, 4).map((b) => (
                    <div key={b.IdCuentaBancaria || b.NumeroCuenta} className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-900">
                          {b.NombreBanco}
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
                          {b.TipoCuenta || "Cta. Corriente"} · N° {b.NumeroCuenta}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900">
                          {b.TipoMoneda === "USD" ? "$us " : "Bs. "}
                          {parseFloat(b.SaldoActual || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
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
          <Card className="border border-slate-200 rounded bg-white shadow-none">
            <CardHeader className="p-3.5 sm:px-4 border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                    <Truck className="h-4 w-4 text-slate-600" />
                    Monitoreo de Rutas &amp; Despachos
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Actividad de distribución del día
                  </p>
                </div>
                <a href="/supervisor/asignaciones">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-700 rounded">
                    Ver despachos
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {asignaciones.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  {cargando ? "Consultando despachos..." : "No se han programado despachos para la fecha."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {asignaciones.slice(0, 4).map((a) => (
                    <div key={a.IdAsignacionRuta || Math.random()} className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                          <span>{a.Repartidor || a.NombreRepartidor || "Repartidor Asignado"}</span>
                          <Badge variant="outline" className="rounded text-xs font-mono tabular-nums">
                            {a.Placa || a.Vehiculo || "Vehículo"}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{a.NombreRuta || a.Zona || "Ruta de distribución"}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge
                          variant={a.Estado === "ENTREGADO" || a.Completado ? "success" : "info"}
                          className="rounded text-xs font-medium"
                        >
                          {a.Estado || "EN RUTA"}
                        </Badge>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">
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
        <div className="space-y-4">
          {/* Estado de Recursos Humanos & Planta */}
          <Card className="border border-slate-200 rounded bg-white shadow-none">
            <CardHeader className="p-3.5 sm:px-4 border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                    <Users className="h-4 w-4 text-slate-600" />
                    Capital Humano &amp; Jornada Laboral
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Resumen del personal operativo y administrativo
                  </p>
                </div>
                <a href="/admin/rrhh/inicio">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-700 rounded">
                    Panel RRHH
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border border-slate-200 bg-slate-50 space-y-1">
                  <span className="text-xs uppercase font-semibold text-slate-600 tracking-wider block">
                    Asistencia del Día
                  </span>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    {rrhh?.AsistenciasHoy || 0} marcaciones
                  </div>
                  <p className="text-xs text-[#15803D] font-mono tabular-nums font-medium">
                    {rrhh?.TotalEmpleadosActivos
                      ? `${Math.round(((rrhh.AsistenciasHoy || 0) / rrhh.TotalEmpleadosActivos) * 100)}% de cobertura hoy`
                      : "Jornada en curso"}
                  </p>
                </div>

                <div className="p-3 rounded border border-slate-200 bg-slate-50 space-y-1">
                  <span className="text-xs uppercase font-semibold text-slate-600 tracking-wider block">
                    Masa Salarial Mensual
                  </span>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                    Bs. {parseFloat(rrhh?.MasaSalarialMensual || 0).toLocaleString("es-BO", { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Presupuesto base mensual
                  </p>
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span>Turnos de Producción Configurados</span>
                </div>
                <span className="font-semibold font-mono tabular-nums text-slate-900">
                  {rrhh?.TotalTurnosConfigurados || 4} horarios
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Registro de Auditoría y Seguridad Reciente */}
          <Card className="border border-slate-200 rounded bg-white shadow-none">
            <CardHeader className="p-3.5 sm:px-4 border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                    <ShieldCheck className="h-4 w-4 text-slate-600" />
                    Auditoría de Operaciones Críticas
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Modificaciones sensibles registradas en el sistema
                  </p>
                </div>
                <a href="/admin/auditoria">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-700 rounded">
                    Bitácora completa
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {auditorias.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 font-mono">
                  {cargando ? "Consultando bitácora..." : "No hay registros de auditoría recientes."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditorias.slice(0, 5).map((log) => (
                    <div key={log.IdAuditLog || log.Id || Math.random()} className="p-2.5 sm:px-4 flex items-start justify-between gap-3 text-xs hover:bg-slate-50 transition-colors">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {log.Detalle || log.Descripcion || `${log.Accion} en ${log.TablaAfectada}`}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-mono tabular-nums">
                          <span>{log.Usuario || log.NombreUsuario || "Usuario"}</span>
                          <span>·</span>
                          <span>{log.TablaAfectada || "Sistema"}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-slate-500 font-mono tabular-nums">
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
        <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
          Módulos del Ecosistema Papelera Blanquita
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a
            href="/contador/inicio"
            className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Contabilidad</div>
                <div className="text-xs text-slate-500">Bancos, Caja &amp; Facturas</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href="/supervisor/inicio"
            className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Logística</div>
                <div className="text-xs text-slate-500">Rutas, Choferes &amp; Ventas</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href="/admin/rrhh/inicio"
            className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Recursos Humanos</div>
                <div className="text-xs text-slate-500">Nómina &amp; Turnos</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>

          <a
            href="/admin/auditoria"
            className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-slate-100 border border-slate-200 text-slate-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-900">Auditoría &amp; Roles</div>
                <div className="text-xs text-slate-500">Control de Accesos &amp; Logs</div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </div>
  );
}
