import { useState } from "react";
import { QrCode, Printer, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imprimirCartelQr, descargarCartelQr } from "@/services/Qr/Carteles";

export function TarjetaQr({ titulo, descripcion, ruta }) {
  const [enProceso, setEnProceso] = useState(null);
  const [error, setError] = useState("");

  const ejecutar = async (clave, accion) => {
    setEnProceso(clave);
    setError("");
    try {
      await accion(ruta);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnProceso(null);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:w-80">
      <div className="text-center">
        <div className="text-lg font-extrabold text-slate-900">{titulo}</div>
        {descripcion && (
          <p className="mt-1 text-[13px] leading-snug text-slate-500">{descripcion}</p>
        )}
      </div>

      <div className="flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-c4/25 bg-white">
        <QrCode size={96} strokeWidth={1.75} className="text-c4" />
      </div>

      {error && (
        <div className="w-full rounded-lg bg-red-50 px-3 py-2 text-center text-[13px] font-semibold text-red-600">
          {error}
        </div>
      )}

      <div className="mt-auto flex w-full gap-2">
        <Button
          onClick={() => ejecutar("imprimir", imprimirCartelQr)}
          disabled={enProceso !== null}
          className="h-11 flex-1 gap-2 bg-gradient-to-r from-c3 to-c4 font-extrabold text-white hover:opacity-90"
        >
          {enProceso === "imprimir" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Printer size={16} strokeWidth={2.75} />
          )}
          Imprimir
        </Button>
        <Button
          variant="outline"
          onClick={() => ejecutar("descargar", descargarCartelQr)}
          disabled={enProceso !== null}
          className="h-11 gap-2 border-2 border-slate-200 font-bold text-c3"
        >
          {enProceso === "descargar" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Eye size={16} strokeWidth={2.75} />
          )}
          Ver
        </Button>
      </div>
    </div>
  );
}
