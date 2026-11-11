import { useState, useEffect, useMemo, useCallback } from "react";
import { ObtenerEmpleados } from "@/services/RRHH/RRHHService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/common/StatusBadge";
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
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/stores/branchStore";

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

export default function GestionEmpleados({ usuario = null }) {
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

  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroArea, setFiltroArea] = useState("TODAS");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  // Modal edición empleado (Lazy DOM)
  const [empleadoEditar, setEmpleadoEditar] = useState(null);

  const cargarDatos = useCallback(async (forzar = false) => {
    if (!listoParaConsultar) return;
    try {
      const cacheKey = `${CACHE_KEY_EMPLEADOS}:${sucursal}`;
      if (!forzar) {
        const enCache = cache.get(cacheKey);
        if (enCache) {
          setEmpleados(enCache);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const sid = sucursal === "todas" ? null : Number(sucursal);
      const data = await ObtenerEmpleados("", "TODAS", null, sid);
      const lista = data || [];
      setEmpleados(lista);
      cache.set(cacheKey, lista, 120);
    } catch (err) {
      toast.error("Error al cargar la lista de personal");
    } finally {
      setLoading(false);
    }
  }, [sucursal, listoParaConsultar]);

  useEffect(() => {
    if (listoParaConsultar) {
      cargarDatos();
    }
  }, [cargarDatos, listoParaConsultar]);

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

  // Paginación de lista de empleados
  const paginacion = usePaginacion(empleadosFiltrados, 10);

  // Métricas rápidas
  const totalActivos = useMemo(() => empleados.filter(e => e.Activo).length, [empleados]);
  const masaSalarial = useMemo(() => {
    return empleados.filter(e => e.Activo).reduce((sum, e) => sum + Number(e.SueldoBasico || 0), 0);
  }, [empleados]);

  return (
    <div className="space-y-6">
      {/* 1. HEADER INDUSTRIAL CON PAGEHEADER Y BRANCHFILTER */}
      <PageHeader
        title="Personal"
        subtitle="Colaboradores, sueldos y áreas asignadas."
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
        <div className="px-3 py-1 rounded bg-slate-50 border border-slate-200 text-right">
          <span className="text-[10px] text-slate-500 block font-semibold uppercase">Masa Salarial</span>
          <strong className="text-sm font-bold text-slate-900 font-mono tabular-nums">
            Bs. {masaSalarial.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
          </strong>
        </div>
      </PageHeader>

      {/* 2. BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 bg-white rounded border border-slate-200">
        {/* Buscador */}
        <div className="md:col-span-5 relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Buscar por nombre, CI, cargo o área..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 h-8 text-xs bg-white border-slate-300 rounded focus:border-slate-900"
          />
        </div>

        {/* Filtro por Área */}
        <div className="md:col-span-4">
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-slate-900"
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
            className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ACTIVOS">Solo Colaboradores Activos</option>
            <option value="INACTIVOS">Solo Personal Inactivo</option>
          </select>
        </div>
      </div>

      {/* 3. TABLA DE EMPLEADOS CON PAGINACIÓN */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#1C96C5]" />
            <p className="text-xs text-slate-500 font-medium">Cargando nómina de colaboradores...</p>
          </div>
        ) : empleadosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="h-8 w-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron empleados</p>
            <p className="text-xs text-slate-500">Pruebe ajustando los filtros de búsqueda o área.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-3 py-2.5">Colaborador</th>
                    <th className="px-3 py-2.5">Área Asignada</th>
                    <th className="px-3 py-2.5">Cargo Operativo</th>
                    <th className="px-3 py-2.5 text-right">Sueldo Base</th>
                    <th className="px-3 py-2.5">Abono Banco</th>
                    <th className="px-3 py-2.5 text-center">Estado</th>
                    <th className="px-3 py-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginacion.itemsPaginados.map((emp, idx) => (
                    <tr 
                      key={emp.IdEmpleado || emp.IdUsuario || emp.Ci || `emp-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Empleado */}
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="font-semibold text-slate-900 text-xs">{emp.NombreCompleto}</p>
                          <span className="text-[11px] text-slate-500 font-mono">
                            CI: {emp.Ci} {emp.Celular ? `• Cel: ${emp.Celular}` : ""}
                          </span>
                        </div>
                      </td>

                      {/* Área */}
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 bg-slate-100 text-slate-700">
                          {emp.Area || "General"}
                        </span>
                      </td>

                      {/* Cargo */}
                      <td className="px-3 py-2.5 font-medium text-slate-700">
                        {emp.Cargo || "Operador de Planta"}
                      </td>

                      {/* Sueldo Básico */}
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                        Bs. {Number(emp.SueldoBasico || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Cuenta Bancaria */}
                      <td className="px-3 py-2.5">
                        <div className="text-slate-700">
                          <p className="font-medium text-xs">{emp.Banco || "Banco Unión"}</p>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {emp.CuentaBancaria || "Sin registrar"}
                          </span>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge estado={emp.Activo ? "ACTIVO" : "INACTIVO"} />
                      </td>

                      {/* Acción */}
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEmpleadoEditar(emp)}
                          className="h-7 px-2 text-xs text-slate-700 border-slate-300 hover:bg-slate-50 gap-1 font-medium rounded cursor-pointer"
                          title="Editar condiciones laborales y sueldo"
                        >
                          <Edit2 className="h-3 w-3" />
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
          sucursalActiva={sucursal}
          sucursalesPermitidas={sucursalesPermitidas}
          onGuardado={() => {
            cache.invalidateRRHH();
            cargarDatos(true);
          }}
        />
      )}
    </div>
  );
}
