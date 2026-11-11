import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * EstadoVacio - Vista de estado vacío minimalista industrial sin emojis.
 */
export default function EstadoVacio({
  icono = null,
  titulo = "No se encontraron registros",
  descripcion = "No hay datos disponibles para mostrar con los filtros aplicados.",
  accionTexto = null,
  onAccion = null,
  className = ""
}) {
  const IconoComponent = icono || <FolderOpen className="h-8 w-8 text-slate-400 stroke-[1.5]" />;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded border border-slate-200 bg-white",
        className
      )}
    >
      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-500 mb-3">
        {IconoComponent}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
        {titulo}
      </h3>
      {descripcion && (
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          {descripcion}
        </p>
      )}
      {accionTexto && onAccion && (
        <Button
          onClick={onAccion}
          variant="outline"
          size="sm"
          className="mt-4 rounded"
        >
          {accionTexto}
        </Button>
      )}
    </div>
  );
}
