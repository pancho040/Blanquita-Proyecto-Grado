import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CrearTurno, ActualizarTurno } from "@/services/RRHH/RRHHService";
import { Clock, Loader2, Palette } from "lucide-react";

const COLORES_TURNO = [
  "#20A7DB", // Azul Blanquita
  "#0284c7", // Sky
  "#059669", // Esmeralda
  "#d97706", // Ámbar
  "#7c3aed", // Púrpura
  "#dc2626", // Rojo
  "#475569"  // Slate
];

const AREAS_TURNO = ["General", "Rebobinado", "Servilletas", "Rodela", "Empaque", "Logística"];

export default function ModalTurno({ turno, abierto, onCerrar, onGuardado }) {
  if (!abierto) return null;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    NombreTurno: "",
    HoraInicio: "06:00:00",
    HoraFin: "15:00:00",
    Area: "General",
    Color: "#20A7DB",
    DescripcionTurno: ""
  });

  useEffect(() => {
    if (turno) {
      setFormData({
        NombreTurno: turno.NombreTurno || "",
        HoraInicio: turno.HoraInicio || "06:00:00",
        HoraFin: turno.HoraFin || "15:00:00",
        Area: turno.Area || "General",
        Color: turno.Color || "#20A7DB",
        DescripcionTurno: turno.DescripcionTurno || ""
      });
    } else {
      setFormData({
        NombreTurno: "",
        HoraInicio: "06:00:00",
        HoraFin: "15:00:00",
        Area: "General",
        Color: "#20A7DB",
        DescripcionTurno: ""
      });
    }
  }, [turno]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.NombreTurno.trim()) {
      toast.error("El nombre del turno es obligatorio");
      return;
    }

    try {
      setLoading(true);
      if (turno) {
        await ActualizarTurno(turno.IdTurno, formData);
        toast.success("Turno actualizado correctamente");
      } else {
        await CrearTurno(formData);
        toast.success("Nuevo turno creado con éxito");
      }
      if (onGuardado) onGuardado();
      onCerrar();
    } catch (err) {
      toast.error(err.message || "Error al guardar turno");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-lg font-bold text-[#20A7DB] flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#20A7DB]" />
            <span>{turno ? "Editar Horario de Turno" : "Configurar Nuevo Turno"}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Nombre del Turno *</Label>
            <Input
              value={formData.NombreTurno}
              onChange={(e) => setFormData({ ...formData, NombreTurno: e.target.value })}
              placeholder="Ej. Rebobinado Mañana (06:00 - 15:00)"
              required
              className="mt-1 bg-white border-slate-300 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Hora de Entrada *</Label>
              <Input
                type="time"
                step="1"
                value={formData.HoraInicio}
                onChange={(e) => setFormData({ ...formData, HoraInicio: e.target.value })}
                required
                className="mt-1 bg-white border-slate-300 text-sm "
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Hora de Salida *</Label>
              <Input
                type="time"
                step="1"
                value={formData.HoraFin}
                onChange={(e) => setFormData({ ...formData, HoraFin: e.target.value })}
                required
                className="mt-1 bg-white border-slate-300 text-sm "
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Área Destino</Label>
              <select
                value={formData.Area}
                onChange={(e) => setFormData({ ...formData, Area: e.target.value })}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
              >
                {AREAS_TURNO.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Color Identificador</Label>
              <div className="flex items-center gap-1.5 mt-2">
                {COLORES_TURNO.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, Color: c })}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      formData.Color === c ? "scale-125 border-slate-900" : "border-white hover:scale-110"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Descripción u Observación</Label>
            <Input
              value={formData.DescripcionTurno}
              onChange={(e) => setFormData({ ...formData, DescripcionTurno: e.target.value })}
              placeholder="Ej. Jornada completa de 8 horas con refrigerio"
              className="mt-1 bg-white border-slate-300 text-sm"
            />
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-6 font-semibold">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Turno
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
