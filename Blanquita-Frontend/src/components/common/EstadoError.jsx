import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * EstadoError - Componente de error para fallos de red o backend.
 */
export default function EstadoError({
  titulo = "Ocurrió un error al cargar los datos",
  mensaje = "No se pudo sincronizar la información con el servidor. Verifique su conexión.",
  onReintentar = null,
  className = ""
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded border border-[#FECACA] bg-[#FEF2F2]",
        className
      )}
    >
      <div className="p-2.5 bg-white border border-[#FECACA] rounded text-[#B91C1C] mb-2.5">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#B91C1C]">
        {titulo}
      </h3>
      {mensaje && (
        <p className="text-xs text-[#991B1B] mt-1 max-w-sm">
          {mensaje}
        </p>
      )}
      {onReintentar && (
        <Button
          onClick={onReintentar}
          variant="outline"
          size="sm"
          className="mt-3.5 border-[#FECACA] bg-white text-[#B91C1C] hover:bg-red-50 gap-1.5 rounded"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reintentar</span>
        </Button>
      )}
    </div>
  );
}
