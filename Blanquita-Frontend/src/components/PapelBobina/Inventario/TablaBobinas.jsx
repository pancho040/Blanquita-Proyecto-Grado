import { SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { dateFormatter } from "@/utils/dates";
import { CasillaSeleccion, BadgeReingresada } from "@/components/Inventario/comunes";
import { fmt } from "./constantes";

export function TablaBobinas({ bobinas, tipoSel, marcadas, onToggle, onEditar }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {onToggle && <TableHead className="w-11 pl-5" />}
            <TableHead className={cn(!onToggle && "pl-5")}>Código</TableHead>
            <TableHead>Lote</TableHead>
            <TableHead>Recepción</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead className="text-right">Peso bruto</TableHead>
            <TableHead className="text-right">Peso neto</TableHead>
            <TableHead className={cn("text-right", !onEditar && "pr-5")}>Gramaje</TableHead>
            {onEditar && <TableHead className="pr-5 text-right">Acción</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {bobinas.map((b) => {
            const on = marcadas.includes(b.CodigoBobina);
            return (
              <TableRow
                key={b.IdBobinaPapel}
                onClick={onToggle && (() => onToggle(b.CodigoBobina))}
                className={cn(onToggle && "cursor-pointer", on && tipoSel.soft)}
              >
                {onToggle && (
                  <TableCell className="pl-5">
                    <CasillaSeleccion marcada={on} acento={tipoSel} />
                  </TableCell>
                )}
                <TableCell className={cn("font-mono font-bold", tipoSel.text, !onToggle && "pl-5")}>
                  <div className="flex items-center gap-2">
                    {b.CodigoBobina}
                    {b.Reingresada && <BadgeReingresada fecha={b.FechaUltimoReingreso} />}
                  </div>
                </TableCell>
                <TableCell className="text-slate-600">{b.CodigoLote}</TableCell>
                <TableCell className="text-slate-600">
                  {dateFormatter(b.FechaRecepcion)}
                </TableCell>
                <TableCell className="text-slate-600">
                  {b.NombreProveedor}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-600">
                  {fmt(b.PesoBrutoKg)} kg
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums text-slate-900">
                  {fmt(b.PesoNetoKg)} kg
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-slate-600", !onEditar && "pr-5")}>
                  {fmt(b.Gramaje)} g/m²
                </TableCell>
                {onEditar && (
                  <TableCell
                    className="pr-5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditar(b)}
                      className="gap-1.5 font-bold text-c3"
                    >
                      <SquarePen size={14} strokeWidth={2.5} />
                      Editar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}