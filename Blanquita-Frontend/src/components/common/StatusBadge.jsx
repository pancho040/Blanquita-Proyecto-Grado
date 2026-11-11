import React from "react";
import { cn } from "@/lib/utils";

/**
 * StatusBadge - Componente unificado de insignias de estado para Papelera Blanquita.
 * Cumple con DESIGN.md: radio de 4px, texto de 11px, borde de 1px y punto indicador de 6px.
 */
export default function StatusBadge({ 
  estado = "PENDIENTE", 
  label = null, 
  variant = null, 
  className = "",
  showDot = true 
}) {
  const norm = String(estado || "").trim().toUpperCase();

  let finalVariant = variant;
  if (!finalVariant) {
    if (["APROBADO", "FINALIZADA", "COMPLETADO", "ACTIVO", "PAGADO", "LIQUIDADO", "CONCILIADO", "ENTREGADO"].includes(norm)) {
      finalVariant = "success";
    } else if (["PENDIENTE", "EN_REVISION", "OBSERVADO", "PARCIAL", "EN RUTA", "EN_RUTA"].includes(norm)) {
      finalVariant = "warning";
    } else if (["RECHAZADO", "CANCELADA", "ANULADO", "INACTIVO", "MORA", "FALTANTE", "ERROR"].includes(norm)) {
      finalVariant = "danger";
    } else {
      finalVariant = "info";
    }
  }

  const styles = {
    success: {
      bg: "bg-[#F0FDF4]",
      border: "border-[#86EFAC]",
      text: "text-[#15803D]",
      dot: "bg-[#15803D]",
    },
    warning: {
      bg: "bg-[#FFFBEB]",
      border: "border-[#FDE68A]",
      text: "text-[#B45309]",
      dot: "bg-[#B45309]",
    },
    danger: {
      bg: "bg-[#FEF2F2]",
      border: "border-[#FCA5A5]",
      text: "text-[#B91C1C]",
      dot: "bg-[#B91C1C]",
    },
    info: {
      bg: "bg-[#F0F9FF]",
      border: "border-[#BAE6FD]",
      text: "text-[#0369A1]",
      dot: "bg-[#0369A1]",
    },
    neutral: {
      bg: "bg-slate-100",
      border: "border-slate-200",
      text: "text-slate-700",
      dot: "bg-slate-500",
    }
  }[finalVariant] || {
    bg: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-700",
    dot: "bg-slate-500",
  };

  const displayText = label || estado;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap",
        styles.bg,
        styles.border,
        styles.text,
        className
      )}
    >
      {showDot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)}
          aria-hidden="true"
        />
      )}
      <span>{displayText}</span>
    </span>
  );
}
