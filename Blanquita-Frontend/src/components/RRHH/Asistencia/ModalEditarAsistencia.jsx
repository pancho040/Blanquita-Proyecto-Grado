import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ActualizarAsistencia } from "@/services/RRHH/RRHHService";
import { 
  Clock, 
  Calendar, 
  User, 
  AlertTriangle, 
  CheckCircle2, 
  FileText,
  Loader2,
  Award
} from "lucide-react";

const ESTADOS_ASISTENCIA = [
  { valor: "PRESENTE", etiqueta: "Presente (Puntual)", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
  { valor: "ATRASO", etiqueta: "Atraso", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
  { valor: "FALTA", etiqueta: "Falta Injustificada", color: "text-rose-600 bg-rose-50 dark:bg-rose-950/50" },
  { valor: "PERMISO", etiqueta: "Permiso Autorizado", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50" },
  { valor: "VACACION", etiqueta: "Vacación Legal", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50" },
  { valor: "LICENCIA", etiqueta: "Baja Médica / Licencia", color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50" },
  { valor: "DESCANSO", etiqueta: "Día de Descanso", color: "text-slate-600 bg-slate-50 dark:bg-slate-800" },
];

export default function ModalEditarAsistencia({ asistencia, abierto, onCerrar, onGuardado }) {
  if (!abierto || !asistencia) return null;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    HoraEntrada: "",
    HoraSalida: "",
    MinutosAtraso: 0,
    HorasExtras: 0,
    Estado: "PRESENTE",
    Justificacion: ""
  });

  useEffect(() => {
    if (asistencia) {
      setFormData({
        HoraEntrada: asistencia.HoraEntrada ? String(asistencia.HoraEntrada).substring(0, 8) : "",
        HoraSalida: asistencia.HoraSalida ? String(asistencia.HoraSalida).substring(0, 8) : "",
        MinutosAtraso: Number(asistencia.MinutosAtraso) || 0,
        HorasExtras: Number(asistencia.HorasExtras) || 0,
        Estado: asistencia.Estado || "PRESENTE",
        Justificacion: asistencia.Justificacion || ""
      });
    }
  }, [asistencia]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "MinutosAtraso" || name === "HorasExtras" ? Number(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!asistencia?.IdAsistenciaDiaria) return;

    try {
      setLoading(true);
      await ActualizarAsistencia(asistencia.IdAsistenciaDiaria, {
        HoraEntrada: formData.HoraEntrada || null,
        HoraSalida: formData.HoraSalida || null,
        MinutosAtraso: Number(formData.MinutosAtraso) || 0,
        HorasExtras: Number(formData.HorasExtras) || 0,
        Estado: formData.Estado,
        Justificacion: formData.Justificacion || null
      });

      toast.success("Registro de asistencia actualizado correctamente");
      if (onGuardado) onGuardado();
      onCerrar();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al actualizar la asistencia");
    } finally {
      setLoading(false);
    }
  };

  if (!asistencia) return null;

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Ajuste y Justificación de Asistencia
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {asistencia.PrimerNombre} {asistencia.ApellidoPaterno} — {asistencia.Fecha}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Ficha rápida de turno */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block">Área & Cargo:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {asistencia.Area || "General"} — {asistencia.Cargo || "Operario"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Turno Programado:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {asistencia.NombreTurno || "Sin turno asignado"}
              </span>
            </div>
          </div>

          {/* Horas de Entrada y Salida */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hora de Entrada (HH:MM:SS)
              </Label>
              <Input
                name="HoraEntrada"
                value={formData.HoraEntrada}
                onChange={handleChange}
                placeholder="06:00:00"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hora de Salida (HH:MM:SS)
              </Label>
              <Input
                name="HoraSalida"
                value={formData.HoraSalida}
                onChange={handleChange}
                placeholder="15:00:00"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Atraso y Horas Extras */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Minutos de Atraso
              </Label>
              <Input
                type="number"
                min="0"
                name="MinutosAtraso"
                value={formData.MinutosAtraso}
                onChange={handleChange}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-blue-500" />
                Horas Extras (decimal)
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                name="HorasExtras"
                value={formData.HorasExtras}
                onChange={handleChange}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Estado de Asistencia */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Estado de la Jornada
            </Label>
            <select
              name="Estado"
              value={formData.Estado}
              onChange={handleChange}
              className="mt-1 w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ESTADOS_ASISTENCIA.map(e => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta}
                </option>
              ))}
            </select>
          </div>

          {/* Justificación y Observaciones */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              Justificación / Motivo del cambio
            </Label>
            <textarea
              name="Justificacion"
              value={formData.Justificacion}
              onChange={handleChange}
              rows={3}
              placeholder="Ej. Marcación no registrada por huella dañada, confirmado por supervisor de planta..."
              className="mt-1 w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={loading}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
