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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { invalidarCache } from "@/lib/api-cache";

import {
  ObtenerResumenRRHH,
  ObtenerEmpleados,
  ObtenerAsistencia,
  ObtenerTurnos
} from "@/services/RRHH/RRHHService";

export default function InicioRRHH({ usuario }) {
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
    cargarDatos();
  }, []);

  const cargarDatos = async (forzar = false) => {
    if (forzar) {
      setRefrescando(true);
      invalidarCache("/api/rrhh");
    } else {
      setCargando(true);
    }

    try {
      const hoyStr = new Date().toISOString().split("T")[0];

      const [resumenData, empData, asisData, turnosData] = await Promise.all([
        ObtenerResumenRRHH().catch(() => null),
        ObtenerEmpleados("", "TODAS", true).catch(() => []),
        ObtenerAsistencia({ FechaInicio: hoyStr, FechaFin: hoyStr }).catch(() => []),
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
      {/* 1. ENCABEZADO MINIMALISTA RRHH */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Users className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                Recursos Humanos & Personal
              </span>
              <span className="text-xs text-slate-400 tabular-nums">Control de Cuadrillas & Nómina</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Dashboard de Personal
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {fechaActual} · Cobertura operativa de turnos, puntualidad y administración salarial.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cargarDatos(true)}
              disabled={refrescando || cargando}
              className="text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-9 font-medium"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-slate-500 ${refrescando ? "animate-spin" : ""}`} />
              {refrescando ? "Sincronizando..." : "Actualizar"}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. KPIS CLAVE DE RRHH */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Colaboradores Activos */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Plantilla Activa</span>
              <Users className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {cargando ? "---" : totalActivos}
            </div>
            <p className="text-[11px] text-slate-400">Colaboradores dados de alta</p>
          </CardContent>
        </Card>

        {/* Presentes Hoy */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Presentes Hoy</span>
              <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {cargando ? "---" : totalMarcaciones}
            </div>
            <p className="text-[11px] text-slate-400">Marcaciones efectivas</p>
          </CardContent>
        </Card>

        {/* Atrasos */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Atrasos de Hoy</span>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {cargando ? "---" : atrasosHoy}
            </div>
            <p className="text-[11px] text-slate-400">Superaron tolerancia</p>
          </CardContent>
        </Card>

        {/* Faltas */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Ausencias</span>
              <UserX className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {cargando ? "---" : (resumen?.FaltasHoy || 0)}
            </div>
            <p className="text-[11px] text-slate-400">Faltas registradas</p>
          </CardContent>
        </Card>

        {/* Turnos Activos */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Turnos Planta</span>
              <Layers className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {cargando ? "---" : (turnos.length || 4)}
            </div>
            <p className="text-[11px] text-slate-400">Horarios en uso</p>
          </CardContent>
        </Card>

        {/* Presupuesto Salarial */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Masa Salarial</span>
              <FileCheck2 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {cargando ? "---" : `Bs. ${parseFloat(resumen?.MasaSalarialMensual || 0).toLocaleString("es-BO", { maximumFractionDigits: 0 })}`}
            </div>
            <p className="text-[11px] text-slate-400">Sueldo básico total</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. DOS COLUMNAS DE ANÁLISIS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA 1: DISTRIBUCIÓN POR ÁREA Y COBERTURA (1 COL) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Distribución por Áreas */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Personal por Área</span>
                <span className="text-xs tabular-nums font-normal text-slate-400">{totalActivos} colaboradores</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {Object.entries(desgloseArea).map(([area, cantidad]) => {
                const pct = totalActivos > 0 ? Math.round((cantidad / totalActivos) * 100) : 0;
                return (
                  <div key={area} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{area}</span>
                      <span className="tabular-nums text-slate-500">{cantidad} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-slate-800 dark:bg-slate-200 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">Tasa de Asistencia Hoy</span>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{tasaAsistencia}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Turnos de Fábrica y Planta */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                  Turnos Configurados
                </CardTitle>
                <a href="/admin/rrhh/turnos">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">
                    Cronograma
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {turnos.slice(0, 4).map((t) => (
                  <div key={t.IdTurno} className="p-3.5 px-5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">{t.NombreTurno}</div>
                      <div className="text-[11px] text-slate-400">{t.Area || "General"}</div>
                    </div>
                    <div className="tabular-nums text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
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
          <Card className="border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900/60">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-slate-500" />
                    Marcaciones de Asistencia de la Jornada
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Registro de ingresos y control de puntualidad en tiempo real
                  </p>
                </div>
                <a href="/admin/rrhh/asistencia">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200 dark:border-slate-700">
                    Control completo
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {asistenciaHoy.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-800 w-fit mx-auto text-slate-400">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-slate-500">No hay marcaciones para el día en curso aún.</div>
                  <a href="/admin/rrhh/asistencia">
                    <Button variant="link" size="sm" className="text-xs text-blue-600">
                      Ver historial de asistencia del mes
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Colaborador</th>
                        <th className="py-2.5 px-4 font-semibold">Turno / Horario</th>
                        <th className="py-2.5 px-4 font-semibold">Hora Entrada</th>
                        <th className="py-2.5 px-4 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {asistenciaHoy.slice(0, 7).map((asis, idx) => {
                        const esAtraso = asis.Estado === "ATRASO" || (asis.MinutosAtraso && asis.MinutosAtraso > 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {asis.PrimerNombre ? `${asis.PrimerNombre} ${asis.ApellidoPaterno || ""}` : asis.NombreCompleto || "Empleado"}
                              </div>
                              <div className="text-[11px] text-slate-400">CI: {asis.CI || asis.Ci || "---"}</div>
                            </td>
                            <td className="py-3 px-4 tabular-nums text-slate-600 dark:text-slate-300">
                              {asis.NombreTurno || (asis.TurnoHoraEntrada ? `${asis.TurnoHoraEntrada?.slice(0, 5)} - ${asis.TurnoHoraSalida?.slice(0, 5)}` : "Horario Regular")}
                            </td>
                            <td className="py-3 px-4 tabular-nums font-semibold text-slate-900 dark:text-white">
                              {asis.HoraEntrada ? asis.HoraEntrada.slice(0, 5) : "---"}
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-normal ${
                                  esAtraso
                                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                }`}
                              >
                                {esAtraso ? `Atraso (${asis.MinutosAtraso || 0}m)` : "Puntual"}
                              </Badge>
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
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Personal & Sueldos</div>
                <div className="text-[10px] text-slate-400">Directorio de colaboradores</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/admin/rrhh/turnos"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Cronograma</div>
                <div className="text-[10px] text-slate-400">Asignación de turnos</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/admin/rrhh/planillas"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Planilla Mensual</div>
                <div className="text-[10px] text-slate-400">Cálculo de haberes</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>

            <a
              href="/admin/rrhh/configuracion"
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Configuración</div>
                <div className="text-[10px] text-slate-400">Tolerancias y AFP</div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

