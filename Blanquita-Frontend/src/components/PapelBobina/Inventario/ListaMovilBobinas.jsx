import { SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dateFormatter } from "@/utils/dates";
import { CasillaSeleccion, BadgeReingresada } from "@/components/Inventario/comunes";
import { fmt } from "./constantes";
import { MiniStat } from "./MiniStat";

export function ListaMovilBobinas({ bobinas, tipoSel, marcadas, onToggle, onEditar }) {
  return (
    <div className="flex flex-col gap-2.5 p-3.5">
      {bobinas.map((b) => {
        const on = marcadas.includes(b.CodigoBobina);
        return (
          <div
            key={b.IdBobinaPapel}
            onClick={onToggle && (() => onToggle(b.CodigoBobina))}
            className={cn(
              "flex flex-col gap-2.5 rounded-2xl border-2 p-3.5",
              on ? tipoSel.soft : "border-slate-200 bg-white",
              on && tipoSel.border,
            )}
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className={cn("font-mono text-[15px] font-extrabold", tipoSel.text)}>
                  {b.CodigoBobina}
                </div>
                {b.Reingresada && <BadgeReingresada fecha={b.FechaUltimoReingreso} />}
              </div>
              {onToggle && <CasillaSeleccion marcada={on} acento={tipoSel} grande />}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-slate-600">
              <span>
                <strong className="text-slate-900">{b.CodigoLote}</strong> ·{" "}
                {dateFormatter(b.FechaRecepcion)}
              </span>
              <span>{b.NombreProveedor}</span>
              {b.Reingresada && b.FechaUltimoReingreso && (
                <span className="font-semibold text-amber-700">
                  Reingreso: {dateFormatter(b.FechaUltimoReingreso)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <MiniStat label="Bruto" value={`${fmt(b.PesoBrutoKg)} kg`} />
              <MiniStat label="Neto" value={`${fmt(b.PesoNetoKg)} kg`} />
              <MiniStat label="Gramaje" value={`${fmt(b.Gramaje)} g/m²`} />
            </div>
            {onEditar && (
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditar(b);
                }}
                className="h-10 gap-1.5 self-end font-bold text-c3"
              >
                <SquarePen size={15} strokeWidth={2.5} />
                Editar
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}