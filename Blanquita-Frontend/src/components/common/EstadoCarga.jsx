import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EstadoCarga - Componente de carga sobrio e industrial.
 */
export default function EstadoCarga({
  mensaje = "Cargando información...",
  className = "",
  inline = false
}) {
  if (inline) {
    return (
      <span className={cn("inline-flex items-center gap-2 text-xs text-slate-600", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1C96C5]" />
        <span>{mensaje}</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center rounded border border-slate-200 bg-white",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-[#1C96C5] mb-2.5" />
      <p className="text-xs font-medium text-slate-700">{mensaje}</p>
    </div>
  );
}
