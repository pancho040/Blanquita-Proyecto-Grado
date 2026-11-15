import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Users, AlertTriangle, ArrowRight, Truck, X } from "lucide-react";
import { ReasignarRuta } from "@/services/Logistica/RutaService";

export default function ModalReasignarRuta({
  abierto,
  onOpenChange,
  asignacion,
  repartidores = [],
  alReasignar = null
}) {
  const [nuevoChoferId, setNuevoChoferId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [transferirStock, setTransferirStock] = useState(true);
  const [guardando, setGuardando] = useState(false);

  if (!asignacion) return null;

  const choferActualId = asignacion.IdUsuarioRepartidor;
  const choferesDisponibles = (repartidores || []).filter(
    (r) => Number(r.IdUsuario) !== Number(choferActualId)
  );

  const tieneEntregas = Number(asignacion.entregas_completadas || asignacion.total_entregadas || 0) > 0;

  const handleConfirmar = async (e) => {
    e.preventDefault();
    if (!nuevoChoferId) {
      toast.error("Seleccione el nuevo chofer para la ruta");
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 5) {
      toast.error("El motivo de reasignación es obligatorio (mínimo 5 caracteres)");
      return;
    }

    try {
      setGuardando(true);
      await ReasignarRuta(asignacion.IdAsignacionRuta, {
        nuevo_id_chofer: Number(nuevoChoferId),
        motivo: motivo.trim(),
        transferir_stock: transferirStock
      });

      toast.success("Ruta reasignada exitosamente");
      if (alReasignar) alReasignar(asignacion.IdAsignacionRuta);
      onOpenChange(false);
      setMotivo("");
      setNuevoChoferId("");
    } catch (err) {
      toast.error(err.message || "Error al reasignar la ruta");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md w-full p-0 overflow-hidden">
        <div className="shrink-0 flex items-start justify-between border-b border-slate-200 px-5 py-3.5 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-800">
                Reasignar ruta de reparto
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {asignacion.NombreRuta}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleConfirmar} className="p-5 space-y-4 text-xs bg-slate-50/50">
          {/* Chofer Actual */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Chofer actual</span>
              <strong className="text-xs text-slate-800">{asignacion.NombreRepartidor}</strong>
            </div>
            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
              {asignacion.Estado}
            </Badge>
          </div>

          {/* Advertencia si hay entregas previas */}
          {tieneEntregas && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Atención:</strong> Esta ruta ya cuenta con entregas completadas hoy. Las notas de venta emitidas se mantendrán registradas a nombre del chofer actual, y las entregas pendientes pasarán al nuevo chofer.
              </div>
            </div>
          )}

          {/* Selector de nuevo chofer */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Nuevo chofer asignado *
            </label>
            <select
              value={nuevoChoferId}
              onChange={(e) => setNuevoChoferId(e.target.value)}
              className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-800"
              required
            >
              <option value="">-- Seleccionar nuevo chofer --</option>
              {choferesDisponibles.map((rep) => (
                <option key={rep.IdUsuario} value={rep.IdUsuario}>
                  {rep.NombreCompleto || `${rep.PrimerNombre || ""} ${rep.ApellidoPaterno || ""}`.trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Checkbox transferir stock */}
          <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg">
            <input
              type="checkbox"
              id="transferirStock"
              checked={transferirStock}
              onChange={(e) => setTransferirStock(e.target.checked)}
              className="rounded text-[#1C96C5] focus:ring-[#1C96C5]"
            />
            <label htmlFor="transferirStock" className="text-xs text-slate-700 font-medium cursor-pointer">
              Transferir stock físico a bordo del camión al nuevo chofer
            </label>
          </div>

          {/* Motivo obligatorio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Motivo de la reasignación * (mínimo 5 caracteres)
            </label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Avería mecánica del camión, indisposición de salud del chofer, etc."
              rows={3}
              className="text-xs bg-white text-slate-800"
              required
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-slate-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={guardando || !nuevoChoferId || motivo.trim().length < 5}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>{guardando ? "Reasignando..." : "Confirmar reasignación"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
