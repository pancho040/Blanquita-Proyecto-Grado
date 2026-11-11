import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ActualizarEmpleado } from "@/services/RRHH/RRHHService";
import { 
  Users, 
  DollarSign, 
  Briefcase, 
  Building2, 
  CreditCard, 
  Calendar, 
  Loader2, 
  CheckCircle2,
  Landmark
} from "lucide-react";

const AREAS_PLANTA = [
  "Rebobinado",
  "Servilletas",
  "Rodela",
  "Empaque",
  "Logística",
  "Contabilidad",
  "Administración",
  "General"
];

const PRESETS_SUELDO = [2500, 2600, 2650, 2800, 3000, 3800, 4200, 4500];

export default function ModalEmpleado({
  empleado,
  abierto,
  onCerrar,
  onGuardado,
  sucursalActiva = "todas",
  sucursalesPermitidas = []
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    PrimerNombre: "",
    SegundoNombre: "",
    ApellidoPaterno: "",
    ApellidoMaterno: "",
    Celular: "",
    Cargo: "Operador de Planta",
    Area: "Rebobinado",
    IdSucursal: sucursalActiva && sucursalActiva !== "todas" ? Number(sucursalActiva) : "",
    SueldoBasico: 2500,
    FechaIngreso: new Date().toISOString().split("T")[0],
    CuentaBancaria: "",
    Banco: "Banco Unión",
    Activo: true
  });

  useEffect(() => {
    if (empleado) {
      setFormData({
        PrimerNombre: empleado.PrimerNombre || "",
        SegundoNombre: empleado.SegundoNombre || "",
        ApellidoPaterno: empleado.ApellidoPaterno || "",
        ApellidoMaterno: empleado.ApellidoMaterno || "",
        Celular: empleado.Celular || "",
        Cargo: empleado.Cargo || "Operador de Planta",
        Area: empleado.Area || "Rebobinado",
        IdSucursal: empleado.IdSucursal
          ? Number(empleado.IdSucursal)
          : (sucursalActiva && sucursalActiva !== "todas" ? Number(sucursalActiva) : ""),
        SueldoBasico: Number(empleado.SueldoBasico) || 2500,
        FechaIngreso: empleado.FechaIngreso || new Date().toISOString().split("T")[0],
        CuentaBancaria: empleado.CuentaBancaria || "",
        Banco: empleado.Banco || "Banco Unión",
        Activo: empleado.Activo ?? true
      });
    }
  }, [empleado, sucursalActiva]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handlePresetSueldo = (monto) => {
    setFormData(prev => ({ ...prev, SueldoBasico: monto }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.PrimerNombre.trim() || !formData.ApellidoPaterno.trim()) {
      toast.error("Nombres y Apellido Paterno son obligatorios");
      return;
    }
    if (!formData.IdSucursal) {
      toast.error("Debe seleccionar obligatoriamente una sucursal para el colaborador");
      return;
    }
    if (Number(formData.SueldoBasico) <= 0) {
      toast.error("El sueldo básico debe ser mayor a 0");
      return;
    }

    try {
      setLoading(true);
      await ActualizarEmpleado(empleado.IdUsuario, {
        ...formData,
        SueldoBasico: Number(formData.SueldoBasico)
      });
      toast.success(`Datos de ${formData.PrimerNombre} ${formData.ApellidoPaterno} actualizados`);
      if (onGuardado) onGuardado();
      onCerrar();
    } catch (err) {
      toast.error(err.message || "Error al actualizar empleado");
    } finally {
      setLoading(false);
    }
  };

  if (!abierto || !empleado) return null;

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 bg-white border border-slate-300 shadow-md rounded">
        <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#1C96C5]" />
              <span>Editar Ficha Laboral del Empleado</span>
            </DialogTitle>
            <p className="text-xs text-slate-600 mt-0.5">
              CI: <strong className="text-slate-900 font-mono tabular-nums">{empleado.Ci}</strong> • Rol Sistema: <span className="text-slate-800 font-medium">{empleado.NombreRol}</span>
            </p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* SECCIÓN 1: DATOS PERSONALES */}
          <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <Users className="h-3.5 w-3.5 text-[#1C96C5]" />
              <span>Datos Personales & Identificación</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Primer Nombre *</Label>
                <Input
                  name="PrimerNombre"
                  value={formData.PrimerNombre}
                  onChange={handleChange}
                  required
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded focus:border-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Segundo Nombre</Label>
                <Input
                  name="SegundoNombre"
                  value={formData.SegundoNombre}
                  onChange={handleChange}
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded focus:border-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Apellido Paterno *</Label>
                <Input
                  name="ApellidoPaterno"
                  value={formData.ApellidoPaterno}
                  onChange={handleChange}
                  required
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded focus:border-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Apellido Materno</Label>
                <Input
                  name="ApellidoMaterno"
                  value={formData.ApellidoMaterno}
                  onChange={handleChange}
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded focus:border-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Teléfono Celular / WhatsApp</Label>
                <Input
                  name="Celular"
                  value={formData.Celular}
                  onChange={handleChange}
                  placeholder="Ej. 71234567"
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded font-mono tabular-nums focus:border-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Fecha de Ingreso a la Empresa</Label>
                <Input
                  type="date"
                  name="FechaIngreso"
                  value={formData.FechaIngreso}
                  onChange={handleChange}
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded font-mono tabular-nums focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: CARGO, ÁREA & CONDICIONES LABORALES */}
          <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <Briefcase className="h-3.5 w-3.5 text-[#1C96C5]" />
              <span>Cargo, Área de Planta & Remuneración</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Área Operativa / Sección *</Label>
                <select
                  name="Area"
                  value={formData.Area}
                  onChange={handleChange}
                  className="mt-1 w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {AREAS_PLANTA.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Cargo Específico *</Label>
                <Input
                  name="Cargo"
                  value={formData.Cargo}
                  onChange={handleChange}
                  placeholder="Ej. Operador de Rebobinado"
                  required
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded font-medium focus:border-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Sucursal Territorial Asignada *</Label>
                <select
                  name="IdSucursal"
                  value={formData.IdSucursal}
                  onChange={handleChange}
                  required
                  className="mt-1 w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="" disabled>-- Seleccione sucursal obligatoria --</option>
                  {(sucursalesPermitidas && sucursalesPermitidas.length > 0 ? sucursalesPermitidas : [
                    { id: 1, nombre: "Sucursal Central Sucre" },
                    { id: 2, nombre: "Sucursal Potosí" }
                  ]).map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* SUELDO BÁSICO CON PRESETS */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Sueldo Básico Mensual (Bs.) *
                </Label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Base LGT Sucre
                </span>
              </div>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  name="SueldoBasico"
                  value={formData.SueldoBasico}
                  onChange={handleChange}
                  required
                  className="pl-8 bg-white border-slate-300 font-bold font-mono tabular-nums text-sm text-slate-900 h-8 rounded text-right focus:border-slate-900"
                />
              </div>

              {/* Botones de Presets de Sueldos */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] font-medium text-slate-600 mr-1">Escalas frecuentes:</span>
                {PRESETS_SUELDO.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetSueldo(p)}
                    className={`text-xs px-2 py-0.5 rounded font-mono tabular-nums transition-colors border ${
                      Number(formData.SueldoBasico) === p
                        ? "bg-slate-900 text-white border-slate-900 font-semibold"
                        : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    Bs. {p}
                  </button>
                ))}
              </div>
            </div>

            {/* CUENTA BANCARIA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Entidad Bancaria</Label>
                <Input
                  name="Banco"
                  value={formData.Banco}
                  onChange={handleChange}
                  placeholder="Ej. Banco Unión, BCP, Mercantil Santa Cruz"
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded focus:border-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Número de Cuenta Bancaria</Label>
                <Input
                  name="CuentaBancaria"
                  value={formData.CuentaBancaria}
                  onChange={handleChange}
                  placeholder="Ej. 100000458921"
                  className="mt-1 bg-white border-slate-300 text-xs h-8 rounded font-mono tabular-nums focus:border-slate-900"
                />
              </div>
            </div>

            {/* ESTADO ACTIVO */}
            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="checkActivo"
                name="Activo"
                checked={formData.Activo}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <Label htmlFor="checkActivo" className="text-xs font-medium text-slate-800 cursor-pointer">
                Colaborador Activo en Planilla y Cronograma de Planta
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onCerrar} className="h-8 rounded text-xs border-slate-300">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 font-medium text-xs h-8 rounded"
            >
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
