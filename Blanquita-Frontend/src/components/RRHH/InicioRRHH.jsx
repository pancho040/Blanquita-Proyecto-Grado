import React, { useState, useEffect } from "react";
import {
  Users,
  Calendar,
  Clock,
  Fingerprint,
  FileText,
  Settings2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Briefcase,
  ChevronRight,
  UserCheck,
  UserX,
  TrendingUp,
  FileCheck2,
  Layers
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/common/StatusBadge";
import { toast } from "sonner";
import { invalidarCache } from "@/lib/api-cache";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/stores/branchStore";

import {
  ObtenerResumenRRHH,
  ObtenerEmpleados,
  ObtenerAsistencia,
  ObtenerTurnos
} from "@/services/RRHH/RRHHService";

export default function InicioRRHH({ usuario = null }) {
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
  const [resumen, setResumen] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [asistenciaHoy, setAsistenciaHoy] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    const f = new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    setFechaActual(f.charAt(0).toUpperCase() + f.slice(1));
  }, []);

  const cargarDatos = async (forzar = false) => {
    if (!listoParaConsultar) return;
    if (forzar) {
      setRefrescando(true);
      invalidarCache("/api/rrhh");
    } else {
      setCargando(true);
    }

    try {
      const hoyStr = new Date().toISOString().split("T")[0];
      const sid = sucursal === "todas" ? null : Number(sucursal);

      const [resumenData, empData, asisData, turnosData] = await Promise.all([
        ObtenerResumenRRHH(sid).catch(() => null),
        ObtenerEmpleados("", "TODAS", true, sid).catch(() => []),
        ObtenerAsistencia({ FechaInicio: hoyStr, FechaFin: hoyStr, id_sucursal: sid }).catch(() => []),
        ObtenerTurnos().catch(() => [])
      ]);

      setResumen(resumenData);
      setEmpleados(Array.isArray(empData) ? empData : (empData?.items || []));
      setAsistenciaHoy(Array.isArray(asisData) ? asisData : (asisData?.items || []));
      setTurnos(Array.isArray(turnosData) ? turnosData : (turnosData?.items || []));
    } catch (err) {
      console.error("Error al cargar dashboard de RRHH:", err);
      toast.error("No se pudieron cargar todos los indicadores de RRHH.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useEffect(() => {
    if (listoParaConsultar) {
      cargarDatos();
    }
  }, [sucursal, listoParaConsultar]);

  // Cálculos estadísticos por área
  const totalActivos = resumen?.TotalEmpleadosActivos || empleados.length || 0;
  
  const desgloseArea = empleados.reduce((acc, emp) => {
    const area = emp.Area || "General";
    acc[area] = (acc[area] || 0) + 1;
    return acc;
  }, {});

  const totalMarcaciones = resumen?.AsistenciasHoy || asistenciaHoy.length || 0;
  const tasaAsistencia = totalActivos > 0 ? Math.round((totalMarcaciones / totalActivos) * 100) : 0;
  const atrasosHoy = asistenciaHoy.filter((a) => a.Estado === "ATRASO" || (a.MinutosAtraso && a.MinutosAtraso > 0)).length;

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO INDUSTRIAL RRHH CON PAGEHEADER Y BRANCHFILTER */}
      <PageHeader
        title="Dashboard de Personal"
        subtitle={`${fechaActual} · Cobertura operativa de turnos, puntualidad y administración salarial.`}
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
          onClick={() => cargarDatos(true)}
          disabled={refrescando || cargando}
          className="text-xs border-slate-300 hover:bg-slate-50 h-8 font-medium rounded"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${refrescando ? "animate-spin" : ""}`} />
          {refrescando ? "Sincronizando..." : "Actualizar"}
        </Button>
      </PageHeader>

      {/* 2. KPIS CLAVE DE RRHH */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Colaboradores Activos */}
        <Card className="border-slate-200 bg-white rounded">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Plantilla Activa</span>
              <Users className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums font-mono text-slate-900">
              {cargando ? "---" : totalActivos}
            </div>
            <p className="text-[11px] text-slate-500">Colaboradores dados de alta</p>
          </CardContent>
        </Card>

        {/* Presentes Hoy */}
        <Card className="border-slate-200 bg-white rounded">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Presentes Hoy</span>
              <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
            </div>
            <div className="text-2xl font-bold tabular-nums font-mono text-emerald-700">
              {cargando ? "---" : totalMarcaciones}
            </div>
            <p className="text-[11px] text-slate-500">Marcaciones efectivas</p>
          </CardContent>
        </Card>

        {/* Atrasos */}
        <Card className="border-slate-200 bg-white rounded">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Atrasos de Hoy</span>
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums font-mono text-amber-700">
              {cargando ? "---" : atrasosHoy}
            </div>
            <p className="text-[11px] text-slate-500">Superaron tolerancia</p>
          </CardContent>
        </Card>

        {/* Faltas */}
        <Card className="border-slate-200 bg-white rounded">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Ausencias</span>
              <UserX className="h-3.5 w-3.5 text-red-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums font-mono text-red-700">
              {cargando ? "---" : (resumen?.FaltasHoy || 0)}
            </div>
            <p className="text-[11px] text-slate-500">Faltas registradas</p>
          </CardContent>
        </Card>

        {/* Turnos Activos */}
        <Card className="border-slate-200 bg-white rounded">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Turnos Planta</span>
              <Layers className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums font-mono text-slate-900">
              {cargando ? "---" : (turnos.length || 4)}
            </div>
            <p className="text-[11px] text-slate-500">Horarios en uso</p>
          </CardContent>
        </Card>

        {/* Presupuesto Salarial */}
        <Card className="border-slate-200 bg-white rounded">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Masa Salarial</span>
              <FileCheck2 className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <div className="text-xl font-bold tabular-nums font-mono text-slate-900">
              {cargando ? "---" : `Bs. ${parseFloat(resumen?.MasaSalarialMensual || 0).toLocaleString("es-BO", { maximumFractionDigits: 0 })}`}
            </div>
            <p className="text-[11px] text-slate-500">Sueldo básico total</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. DOS COLUMNAS DE ANÁLISIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA 1: DISTRIBUCIÓN POR ÁREA Y COBERTURA (1 COL) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Distribución por Áreas */}
          <Card className="border-slate-200 bg-white rounded">
            <CardHeader className="p-4 border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center justify-between">
                <span>Personal por Área</span>
                <span className="text-xs tabular-nums font-mono font-normal text-slate-500">{totalActivos} colaboradores</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {Object.entries(desgloseArea).map(([area, cantidad]) => {
                const pct = totalActivos > 0 ? Math.round((cantidad / totalActivos) * 100) : 0;
                return (
                  <div key={area} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{area}</span>
                      <span className="tabular-nums font-mono text-slate-600">{cantidad} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-sm h-1.5 overflow-hidden">
                      <div
                        className="bg-slate-800 h-1.5 rounded-sm transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600">Tasa de Asistencia Hoy</span>
                <span className="font-bold tabular-nums font-mono text-emerald-700">{tasaAsistencia}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Turnos de Fábrica y Planta */}
          <Card className="border-slate-200 bg-white rounded">
            <CardHeader className="p-4 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Turnos Configurados
                </CardTitle>
                <a href="/admin/rrhh/turnos">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-600 hover:text-slate-900 rounded">
                    Cronograma
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {turnos.slice(0, 4).map((t) => (
                  <div key={t.IdTurno} className="p-3 px-4 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-900">{t.NombreTurno}</div>
                      <div className="text-[11px] text-slate-500">{t.Area || "General"}</div>
                    </div>
                    <div className="tabular-nums font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {t.HoraEntrada?.slice(0, 5)} - {t.HoraSalida?.slice(0, 5)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA 2: REGISTRO DE ASISTENCIA Y CONTROL DE LA JORNADA (2 COLS) */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 bg-white rounded">
            <CardHeader className="p-4 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-slate-600" />
                    Marcaciones de Asistencia de la Jornada
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registro de ingresos y control de puntualidad en tiempo real
                  </p>
                </div>
                <a href="/admin/rrhh/asistencia">
                  <Button variant="outline" size="sm" className="h-8 text-xs border-slate-300 hover:bg-slate-50 rounded">
                    Control completo
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {asistenciaHoy.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200 w-fit mx-auto text-slate-500">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-slate-500">No hay marcaciones para el día en curso aún.</div>
                  <a href="/admin/rrhh/asistencia">
                    <Button variant="link" size="sm" className="text-xs text-sky-700">
                      Ver historial de asistencia del mes
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Colaborador</th>
                        <th className="py-2.5 px-3">Turno / Horario</th>
                        <th className="py-2.5 px-3">Hora Entrada</th>
                        <th className="py-2.5 px-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {asistenciaHoy.slice(0, 7).map((asis, idx) => {
                        const esAtraso = asis.Estado === "ATRASO" || (asis.MinutosAtraso && asis.MinutosAtraso > 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">
                                {asis.PrimerNombre ? `${asis.PrimerNombre} ${asis.ApellidoPaterno || ""}` : asis.NombreCompleto || "Empleado"}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">CI: {asis.CI || asis.Ci || "---"}</div>
                            </td>
                            <td className="py-2.5 px-3 tabular-nums font-mono text-slate-700">
                              {asis.NombreTurno || (asis.TurnoHoraEntrada ? `${asis.TurnoHoraEntrada?.slice(0, 5)} - ${asis.TurnoHoraSalida?.slice(0, 5)}` : "Horario Regular")}
                            </td>
                            <td className="py-2.5 px-3 tabular-nums font-mono font-medium text-slate-900">
                              {asis.HoraEntrada ? asis.HoraEntrada.slice(0, 5) : "---"}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge
                                estado={esAtraso ? "OBSERVADO" : "APROBADO"}
                                label={esAtraso ? `Atraso (${asis.MinutosAtraso || 0}m)` : "Puntual"}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Accesos Rápidos del Módulo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <a
              href="/admin/rrhh/empleados"
              className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">Personal & Sueldos</div>
                <div className="text-[10px] text-slate-500">Directorio de colaboradores</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/admin/rrhh/turnos"
              className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">Cronograma</div>
                <div className="text-[10px] text-slate-500">Asignación de turnos</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/admin/rrhh/planillas"
              className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">Planilla Mensual</div>
                <div className="text-[10px] text-slate-500">Cálculo de haberes</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/admin/rrhh/configuracion"
              className="p-3 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-900">Configuración</div>
                <div className="text-[10px] text-slate-500">Tolerancias y AFP</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

