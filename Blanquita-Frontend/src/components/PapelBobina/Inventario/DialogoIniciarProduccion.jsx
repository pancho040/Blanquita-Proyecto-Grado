import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ETIQUETA = "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export default function DialogoIniciarProduccion({
  abierto,
  codigos,
  nombreTipo,
  nombreProducto,
  enviando,
  onCerrar,
  onConfirmar,
}) {
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (abierto) setConfirmado(false);
  }, [abierto]);

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !enviando && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar producción</DialogTitle>
          <DialogDescription>
            Revisa las bobinas y el producto antes de enviarlas a producción.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className={ETIQUETA}>Bobinas</span>
              <div className="flex flex-wrap gap-2">
                {codigos.map((codigo) => (
                  <span
                    key={codigo}
                    className="rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-bold text-c3 ring-1 ring-slate-200"
                  >
                    {codigo}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5">
                <span className={ETIQUETA}>Tipo de bobina</span>
                <span className="text-sm font-bold text-slate-900">{nombreTipo}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={ETIQUETA}>Producto</span>
                <span className="text-sm font-bold text-slate-900">{nombreProducto}</span>
              </div>
            </div>
          </div>

          <label
            htmlFor="confirmar-inicio"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
          >
            <input
              id="confirmar-inicio"
              type="checkbox"
              checked={confirmado}
              disabled={enviando}
              onChange={(e) => setConfirmado(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-slate-900"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-slate-900">
                Confirmo que voy a iniciar la producción de {nombreProducto} con las bobinas{" "}
                {codigos.join(" + ")}
              </span>
              <span className="text-[12.5px] text-slate-600">
                Las bobinas saldrán del almacén y la acción quedará registrada con su usuario.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={onConfirmar}
            disabled={enviando || !confirmado}
            className="h-11 w-full gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold hover:opacity-90 sm:w-auto"
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : "Iniciar producción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
