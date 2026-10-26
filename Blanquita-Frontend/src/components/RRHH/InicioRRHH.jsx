import { useState, useEffect } from "react";
import { ObtenerResumenRRHH } from "@/services/RRHH/RRHHService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  Clock, 
  Fingerprint, 
  FileText, 
  Settings, 
  ArrowRight, 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  Briefcase,
  Layers,
  ChevronRight
} from "lucide-react";

export default function InicioRRHH({ usuario }) {
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await ObtenerResumenRRHH();
        setResumen(data);
      } catch (err) {
        // Carga silenciosa
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  const modulos = [
    {
      titulo: "Personal",
      descripcion: "Colaboradores, áreas y sueldos básicos.",
      icono: Users,
      color: "bg-blue-600",
      href: "/admin/rrhh/empleados",
      badge: `${resumen?.TotalEmpleadosActivos || 0} activos`
    },
    {
      titulo: "Turnos",
      descripcion: "Cronograma y asignación de cuadrillas.",
      icono: Calendar,
      color: "bg-emerald-600",
      href: "/admin/rrhh/turnos",
      badge: "Semanal"
    },
    {
      titulo: "Asistencia",
      descripcion: "Control de marcaciones, atrasos y horas extras.",
      icono: Fingerprint,
      color: "bg-indigo-600",
      href: "/admin/rrhh/asistencia",
      badge: `${resumen?.AsistenciasHoy || 0} hoy`
    },
    {
      titulo: "Planillas",
      descripcion: "Cálculo mensual de haberes y boletas.",
      icono: FileText,
      color: "bg-teal-600",
      href: "/admin/rrhh/planillas",
      badge: "Nómina"
    },
    {
      titulo: "Configuración",
      descripcion: "Tolerancia de atrasos y aportes de ley.",
      icono: Settings,
      color: "bg-slate-700",
      href: "/admin/rrhh/configuracion",
      badge: "Parámetros"
    }
  ];

  return (
    <div className="space-y-6">
      {/* BANNER RECURSOS HUMANOS */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#20A7DB] via-[#1687b3] to-[#0f6080] p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Recursos Humanos</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Administración de Personal
          </h1>
          <p className="text-sky-100 text-xs sm:text-sm leading-relaxed">
            Personal, asistencia, turnos y nómina de planta.
          </p>
        </div>
        <div className="absolute -right-10 -bottom-10 h-52 w-52 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* METRICAS CLAVE / KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Personal Activo</span>
              <Users className="h-4 w-4 text-[#20A7DB]" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {resumen?.TotalEmpleadosActivos || 0}
            </div>
            <p className="text-[10px] text-slate-400">Colaboradores</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Turnos Planta</span>
              <Clock className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {resumen?.TotalTurnosConfigurados || 4}
            </div>
            <p className="text-[10px] text-slate-400">Horarios activos</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Presentes Hoy</span>
              <CheckCircle2 className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-700 font-mono">
              {resumen?.AsistenciasHoy || 0}
            </div>
            <p className="text-[10px] text-slate-400">Marcaciones efectivas</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Faltas Hoy</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono">
              {resumen?.FaltasHoy || 0}
            </div>
            <p className="text-[10px] text-slate-400">Sin registro</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Masa Salarial</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-lg font-black text-emerald-700 font-mono truncate">
              Bs. {Number(resumen?.MasaSalarialMensual || 0).toLocaleString("es-BO", { minimumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-slate-400">Presupuesto mensual</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-2xs bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Biométrico</span>
              <Fingerprint className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-700 font-mono">
              NG-ECO
            </div>
            <p className="text-[10px] text-emerald-600 font-semibold">En Línea / USB</p>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN MÓDULOS OPERATIVOS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-[#20A7DB]" />
            <span>Módulos de Gestión de Recursos Humanos</span>
          </h2>
          <span className="text-xs text-slate-400">Selecciona un área para comenzar</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modulos.map((item) => {
            const Icono = item.icono;
            return (
              <Card
                key={item.titulo}
                onClick={() => (window.location.href = item.href)}
                className="border-slate-200 shadow-2xs hover:shadow-md transition-all hover:border-[#20A7DB] group cursor-pointer bg-white"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`p-3 rounded-xl ${item.color} text-white shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}>
                      <Icono className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                      {item.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <h3 className="font-bold text-slate-900 group-hover:text-[#20A7DB] transition-colors text-sm sm:text-base flex items-center justify-between">
                      <span>{item.titulo}</span>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[#20A7DB] group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.descripcion}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#20A7DB]">
                    <span>Ingresar al módulo</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
