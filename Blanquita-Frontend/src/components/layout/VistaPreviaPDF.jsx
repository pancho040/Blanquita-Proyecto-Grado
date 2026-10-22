import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { registrarVisorPDF } from "@/utils/vistaPreviaPDF";

const VisorPDF = lazy(() => import("./VisorPDF"));

function Cargando({ nombre }) {
  return (
    <>
      <div className="flex items-center border-b border-slate-200 px-4 py-3">
        <DialogTitle className="truncate text-[15px] font-extrabold text-slate-900">{nombre}</DialogTitle>
      </div>
      <div className="flex flex-1 items-center justify-center bg-slate-100 text-slate-500">
        <Loader2 size={28} className="animate-spin" />
      </div>
    </>
  );
}

export default function VistaPreviaPDF() {
  const [archivo, setArchivo] = useState(null);

  useEffect(() => registrarVisorPDF(setArchivo), []);

  return (
    <Dialog open={archivo !== null} onOpenChange={(open) => !open && setArchivo(null)}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[94dvh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        {archivo && (
          <Suspense fallback={<Cargando nombre={archivo.nombre} />}>
            <VisorPDF archivo={archivo} onCerrar={() => setArchivo(null)} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
