import { useState, useEffect, useMemo, useCallback } from "react";
import { ObtenerEmpleados } from "@/services/RRHH/RRHHService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Users, 
  Search, 
  Edit2, 
  Loader2, 
  Filter, 
  DollarSign, 
  Building2, 
  Briefcase, 
  CheckCircle2, 
  XCircle,
  Landmark,
  Layers,
  ArrowLeft
} from "lucide-react";
import ModalEmpleado from "./ModalEmpleado";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";

const CACHE_KEY_EMPLEADOS = "rrhh:empleados";

const AREAS_FILTRO = [
  "TODAS",
  "Rebobinado",
  "Servilletas",
  "Rodela",
  "Empaque",
  "Logística",
  "Contabilidad",
  "Administración"
];

export default function GestionEmpleados() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroArea, setFiltroArea] = useState("TODAS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Modal edición empleado (Lazy DOM)
  const [empleadoEditar, setEmpleadoEditar] = useState(null);

  const cargarDatos = useCallback(async (forzar = false) => {
    try {
      if (!forzar) {
        const enCache = cache.get(CACHE_KEY_EMPLEADOS);
        if (enCache) {
          setEmpleados(enCache);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const data = await ObtenerEmpleados();
      const lista = data || [];
      setEmpleados(lista);
      cache.set(CACHE_KEY_EMPLEADOS, lista, 300);
    } catch (err) {
      toast.error("Error al cargar la lista de personal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Filtrado 100% en memoria para respuesta instantánea (0 ms)
  const empleadosFiltrados = useMemo(() => {
    return empleados.filter((e) => {
      if (filtroArea !== "TODAS" && e.Area !== filtroArea) return false;
      if (filtroEstado === "ACTIVOS" && !e.Activo) return false;
      if (filtroEstado === "INACTIVOS" && e.Activo) return false;

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const enNom = e.NombreCompleto?.toLowerCase().includes(q);
        const enCi = e.Ci?.toLowerCase().includes(q);
        const enCargo = e.Cargo?.toLowerCase().includes(q);
        const enArea = e.Area?.toLowerCase().includes(q);
        if (!enNom && !enCi && !enCargo && !enArea) return false;
      }
      return true;
    });
  }, [empleados, filtroArea, filtroEstado, busqueda]);

  // Paginación optimizada (estándar front-focus)
  const paginacion = usePaginacion(empleadosFiltrados, 10);

  // Métricas rápidas
  const totalActivos = useMemo(() => empleados.filter(e => e.Activo).length, [empleados]);
  const masaSalarial = useMemo(() => {
    return empleados.filter(e => e.Activo).reduce((sum, e) => sum + Number(e.SueldoBasico || 0), 0);
  }, [empleados]);

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-[#20A7DB]" />
            <span>Personal</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Colaboradores, sueldos y áreas asignadas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-right">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Masa Salarial</span>
            <strong className="text-base font-bold text-emerald-700 font-mono">
              Bs. {masaSalarial.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Buscador */}
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nombre, CI, cargo o área..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        {/* Filtro por Área */}
        <div className="md:col-span-4">
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#20A7DB] focus:bg-white"
          >
            {AREAS_FILTRO.map((area) => (
              <option key={area} value={area}>
                {area === "TODAS" ? "Todas las Áreas de Planta" : `Área: ${area}`}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Estado */}
        <div className="md:col-span-3">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#20A7DB] focus:bg-white"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ACTIVOS">Solo Colaboradores Activos</option>
            <option value="INACTIVOS">Solo Personal Inactivo</option>
          </select>
        </div>
      </div>

      {/* 3. TABLA DE EMPLEADOS CON PAGINACIÓN */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            <p className="text-xs text-slate-500 font-medium">Cargando nómina de colaboradores...</p>
          </div>
        ) : empleadosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold">No se encontraron empleados</p>
            <p className="text-xs text-slate-400">Pruebe ajustando los filtros de búsqueda o área.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Área Asignada</th>
                    <th className="px-4 py-3">Cargo Operativo</th>
                    <th className="px-4 py-3 text-right">Sueldo Base</th>
                    <th className="px-4 py-3">Abono Banco</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginacion.itemsPaginados.map((emp, idx) => (
                    <tr 
                      key={emp.IdEmpleado || emp.IdUsuario || emp.Ci || `emp-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Empleado */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 text-[#20A7DB] font-bold text-xs shrink-0">
                            {emp.PrimerNombre?.[0]}{emp.ApellidoPaterno?.[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{emp.NombreCompleto}</p>
                            <span className="text-[11px] text-slate-400 font-mono">
                              CI: {emp.Ci} {emp.Celular ? `• Cel: ${emp.Celular}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Área */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          emp.Area === "Rebobinado"
                            ? "bg-sky-50 text-sky-800 border-sky-200"
                            : emp.Area === "Servilletas"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : emp.Area === "Logística"
                            ? "bg-purple-50 text-purple-800 border-purple-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {emp.Area || "General"}
                        </span>
                      </td>

                      {/* Cargo */}
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {emp.Cargo || "Operador de Planta"}
                      </td>

                      {/* Sueldo Básico */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                        Bs. {Number(emp.SueldoBasico || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Cuenta Bancaria */}
                      <td className="px-4 py-3.5">
                        <div className="text-slate-700">
                          <p className="font-medium text-xs">{emp.Banco || "Banco Unión"}</p>
                          <span className="text-[11px] font-mono text-slate-400">
                            {emp.CuentaBancaria || "Sin registrar"}
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5 text-center">
                        {emp.Activo ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Activo</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-300 font-medium gap-1 text-[10px]">
                            <XCircle className="h-3 w-3" />
                            <span>Inactivo</span>
                          </Badge>
                        )}
                      </td>

                      {/* Acción */}
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEmpleadoEditar(emp)}
                          className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:text-[#20A7DB] hover:border-sky-300 shadow-2xs gap-1 font-semibold cursor-pointer"
                          title="Editar condiciones laborales y sueldo"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* BARRA DE PAGINACIÓN */}
            <PaginacionTabla {...paginacion} />
          </div>
        )}
      </div>

      {/* 4. MODAL DE EDICIÓN LAZY */}
      {empleadoEditar && (
        <ModalEmpleado
          empleado={empleadoEditar}
          abierto={Boolean(empleadoEditar)}
          onCerrar={() => setEmpleadoEditar(null)}
          onGuardado={() => {
            cache.invalidateRRHH();
            cargarDatos(true);
          }}
        />
      )}
    </div>
  );
}
