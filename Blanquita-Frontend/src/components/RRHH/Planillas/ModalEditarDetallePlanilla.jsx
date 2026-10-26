import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { EditarDetallePlanilla } from "@/services/RRHH/RRHHService";
import { 
  DollarSign, 
  User, 
  CheckCircle2, 
  Loader2, 
  Calculator,
  ArrowRight
} from "lucide-react";

export default function ModalEditarDetallePlanilla({ detalle, abierto, onCerrar, onGuardado }) {
  if (!abierto || !detalle) return null;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    DiasTrabajados: 30,
    HaberBasico: 0,
    BonoAntiguedad: 0,
    HorasExtrasMonto: 0,
    OtrosBonos: 0,
    DescuentoAFP: 0,
    DescuentoAtrasos: 0,
    DescuentoFaltas: 0,
    Anticipos: 0,
    OtrosDescuentos: 0,
    Observaciones: ""
  });

  useEffect(() => {
    if (detalle) {
      setFormData({
        DiasTrabajados: detalle.DiasTrabajados ?? 30,
        HaberBasico: Number(detalle.HaberBasico) || 0,
        BonoAntiguedad: Number(detalle.BonoAntiguedad) || 0,
        HorasExtrasMonto: Number(detalle.HorasExtrasMonto) || 0,
        OtrosBonos: Number(detalle.OtrosBonos) || 0,
        DescuentoAFP: Number(detalle.DescuentoAFP) || 0,
        DescuentoAtrasos: Number(detalle.DescuentoAtrasos) || 0,
        DescuentoFaltas: Number(detalle.DescuentoFaltas) || 0,
        Anticipos: Number(detalle.Anticipos) || 0,
        OtrosDescuentos: Number(detalle.OtrosDescuentos) || 0,
        Observaciones: detalle.Observaciones || ""
      });
    }
  }, [detalle]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "Observaciones" ? value : Number(value)
    }));
  };

  // Cálculo en tiempo real de subtotales
  const totalGanado = Number(formData.HaberBasico || 0) + 
                      Number(formData.BonoAntiguedad || 0) + 
                      Number(formData.HorasExtrasMonto || 0) + 
                      Number(formData.OtrosBonos || 0);

  const totalDescuentos = Number(formData.DescuentoAFP || 0) + 
                          Number(formData.DescuentoAtrasos || 0) + 
                          Number(formData.DescuentoFaltas || 0) + 
                          Number(formData.Anticipos || 0) + 
                          Number(formData.OtrosDescuentos || 0);

  const liquidoPagable = totalGanado - totalDescuentos;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!detalle?.IdDetallePlanilla) return;

    try {
      setLoading(true);
      await EditarDetallePlanilla(detalle.IdDetallePlanilla, {
        ...formData,
        DiasTrabajados: Number(formData.DiasTrabajados),
        HaberBasico: Number(formData.HaberBasico),
        BonoAntiguedad: Number(formData.BonoAntiguedad),
        HorasExtrasMonto: Number(formData.HorasExtrasMonto),
        OtrosBonos: Number(formData.OtrosBonos),
        DescuentoAFP: Number(formData.DescuentoAFP),
        DescuentoAtrasos: Number(formData.DescuentoAtrasos),
        DescuentoFaltas: Number(formData.DescuentoFaltas),
        Anticipos: Number(formData.Anticipos),
        OtrosDescuentos: Number(formData.OtrosDescuentos),
        TotalGanado: totalGanado,
        TotalDescuentos: totalDescuentos,
        LiquidoPagable: liquidoPagable
      });

      toast.success("Línea de planilla actualizada correctamente");
      if (onGuardado) onGuardado();
      onCerrar();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al actualizar la planilla");
    } finally {
      setLoading(false);
    }
  };

  if (!detalle) return null;

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Edición de Haberes y Descuentos
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {detalle.PrimerNombre} {detalle.ApellidoPaterno} — CI: {detalle.CI} ({detalle.Cargo})
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Días trabajados */}
          <div className="w-1/2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Días Trabajados en el Mes
            </Label>
            <Input
              type="number"
              min="0"
              max="31"
              name="DiasTrabajados"
              value={formData.DiasTrabajados}
              onChange={handleChange}
              className="mt-1 h-9 text-xs font-mono"
            />
          </div>

          {/* Dos columnas: Haberes vs Descuentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna Ingresos */}
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
              <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center justify-between">
                <span>Ingresos / Haberes</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  Bs. {totalGanado.toFixed(2)}
                </span>
              </h3>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Haber Básico (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="HaberBasico"
                  value={formData.HaberBasico}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Bono Antigüedad (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="BonoAntiguedad"
                  value={formData.BonoAntiguedad}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Horas Extras Monto (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="HorasExtrasMonto"
                  value={formData.HorasExtrasMonto}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Otros Bonos / Recargos (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="OtrosBonos"
                  value={formData.OtrosBonos}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Columna Descuentos */}
            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-800 space-y-3">
              <h3 className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center justify-between">
                <span>Descuentos y Deducciones</span>
                <span className="font-mono text-rose-700 dark:text-rose-400">
                  Bs. {totalDescuentos.toFixed(2)}
                </span>
              </h3>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Aporte Gestora / AFP (12.71% Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="DescuentoAFP"
                  value={formData.DescuentoAFP}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Descuento Atrasos (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="DescuentoAtrasos"
                  value={formData.DescuentoAtrasos}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Descuento Faltas (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="DescuentoFaltas"
                  value={formData.DescuentoFaltas}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Anticipos / Préstamos (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="Anticipos"
                  value={formData.Anticipos}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Otros Descuentos (Bs.)</Label>
                <Input
                  type="number"
                  step="0.01"
                  name="OtrosDescuentos"
                  value={formData.OtrosDescuentos}
                  onChange={handleChange}
                  className="mt-1 h-8 text-xs font-mono bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Resultado Líquido Pagable */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                Líquido Pagable Calculado:
              </span>
              <span className="text-[11px] text-slate-500">
                Total Ganado ({totalGanado.toFixed(2)}) - Total Descuentos ({totalDescuentos.toFixed(2)})
              </span>
            </div>
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              Bs. {liquidoPagable.toFixed(2)}
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Observaciones / Justificación de Ajuste
            </Label>
            <Input
              name="Observaciones"
              value={formData.Observaciones}
              onChange={handleChange}
              placeholder="Ej. Ajuste manual autorizado por gerencia general..."
              className="mt-1 h-9 text-xs"
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
                  Guardar Ajustes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
