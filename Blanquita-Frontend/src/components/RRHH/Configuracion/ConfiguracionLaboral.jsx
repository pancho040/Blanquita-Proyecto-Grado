import { useState, useEffect } from "react";
import { 
  ObtenerConfiguracionLaboral, 
  ActualizarConfiguracionLaboral 
} from "@/services/RRHH/RRHHService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Settings2, 
  Clock, 
  DollarSign, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert,
  Save,
  Scale
} from "lucide-react";

export default function ConfiguracionLaboral() {
  const [configId, setConfigId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState({
    ToleranciaAtrasoMinutos: 10,
    FactorRecargoHorasExtras: 2.0,
    PorcentajeGestoraAFP: 12.71,
    HorasMesLaboral: 240,
    SueldoMinimoNacional: 2500,
    NombreEmpresa: "SHEMA ASOCIADOS S.R.L.",
    NIT: "1028475024",
    DireccionPlanta: "Parque Industrial de Sucre"
  });

  const cargarConfiguracion = async () => {
    try {
      setCargando(true);
      const data = await ObtenerConfiguracionLaboral();
      if (data) {
        setConfigId(data.IdConfiguracionLaboral || 1);
        setFormData({
          ToleranciaAtrasoMinutos: Number(data.ToleranciaAtrasoMinutos) ?? 10,
          FactorRecargoHorasExtras: Number(data.FactorRecargoHorasExtras) ?? 2.0,
          PorcentajeGestoraAFP: Number(data.PorcentajeGestoraAFP) ?? 12.71,
          HorasMesLaboral: Number(data.HorasMesLaboral) ?? 240,
          SueldoMinimoNacional: Number(data.SueldoMinimoNacional) ?? 2500,
          NombreEmpresa: data.NombreEmpresa || "EMPRESA DE PAPEL BLANQUITA (SHEMA ASOCIADOS S.R.L.)",
          NIT: data.NIT || "1028475024",
          DireccionPlanta: data.DireccionPlanta || "Planta Industrial El Alto, Calle 4 N° 200"
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar la configuración laboral");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ["NombreEmpresa", "NIT", "DireccionPlanta"].includes(name) ? value : Number(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      await ActualizarConfiguracionLaboral(configId || 1, {
        ToleranciaAtrasoMinutos: Number(formData.ToleranciaAtrasoMinutos),
        FactorRecargoHorasExtras: Number(formData.FactorRecargoHorasExtras),
        PorcentajeGestoraAFP: Number(formData.PorcentajeGestoraAFP),
        HorasMesLaboral: Number(formData.HorasMesLaboral),
        SueldoMinimoNacional: Number(formData.SueldoMinimoNacional),
        NombreEmpresa: formData.NombreEmpresa,
        NIT: formData.NIT,
        DireccionPlanta: formData.DireccionPlanta
      });
      toast.success("Parámetros laborales y normativos actualizados");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al guardar la configuración");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
        Cargando parámetros laborales...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Cabecera */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
              <Settings2 className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Configuración Laboral
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tolerancia biométrica, horas extras y aportes de ley.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Parámetros de Biométrico y Turnos */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Tolerancia y Jornadas Laborales
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tolerancia de Atraso al Ingreso (Minutos)
              </Label>
              <Input
                type="number"
                min="0"
                name="ToleranciaAtrasoMinutos"
                value={formData.ToleranciaAtrasoMinutos}
                onChange={handleChange}
                className="mt-1 h-9 text-xs "
              />
              <span className="text-[11px] text-slate-400">
                Marcaciones dentro de este margen no computan como atraso.
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Horas Estándar del Mes Laboral
              </Label>
              <Input
                type="number"
                min="1"
                name="HorasMesLaboral"
                value={formData.HorasMesLaboral}
                onChange={handleChange}
                className="mt-1 h-9 text-xs "
              />
              <span className="text-[11px] text-slate-400">
                Estándar legal boliviano: 240 horas mensuales (8 hrs/día).
              </span>
            </div>
          </div>
        </div>

        {/* Parámetros de Ley y Nómina */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Scale className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Legislación Laboral Boliviana y Aportes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Factor Recargo Horas Extras
              </Label>
              <Input
                type="number"
                step="0.1"
                min="1.0"
                name="FactorRecargoHorasExtras"
                value={formData.FactorRecargoHorasExtras}
                onChange={handleChange}
                className="mt-1 h-9 text-xs "
              />
              <span className="text-[11px] text-slate-400">
                2.0 equivale al 100% de recargo según la LGT.
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Aporte Gestora Pública / AFP (%)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                name="PorcentajeGestoraAFP"
                value={formData.PorcentajeGestoraAFP}
                onChange={handleChange}
                className="mt-1 h-9 text-xs "
              />
              <span className="text-[11px] text-slate-400">
                Porcentaje obligatorio de ley (12.71%).
              </span>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sueldo Mínimo Nacional (Bs.)
              </Label>
              <Input
                type="number"
                step="10"
                min="0"
                name="SueldoMinimoNacional"
                value={formData.SueldoMinimoNacional}
                onChange={handleChange}
                className="mt-1 h-9 text-xs "
              />
              <span className="text-[11px] text-slate-400">
                Base de cálculo para bonos de antigüedad.
              </span>
            </div>
          </div>
        </div>

        {/* Membrete Oficial para Boletas de Pago */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Building2 className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Datos Institucionales para Papeletas de Pago
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Razón Social de la Empresa
              </Label>
              <Input
                name="NombreEmpresa"
                value={formData.NombreEmpresa}
                onChange={handleChange}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                NIT Empresarial
              </Label>
              <Input
                name="NIT"
                value={formData.NIT}
                onChange={handleChange}
                className="mt-1 h-9 text-xs "
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dirección de Planta Industrial
              </Label>
              <Input
                name="DireccionPlanta"
                value={formData.DireccionPlanta}
                onChange={handleChange}
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={guardando}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-6 flex items-center gap-2 shadow-xs"
          >
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando Parámetros...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
