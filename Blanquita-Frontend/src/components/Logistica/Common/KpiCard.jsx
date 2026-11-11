import React from "react";

/**
 * Tarjeta de KPI unificada para Papelera Blanquita (Modo Operate / Industrial Minimalist).
 * @param {string} titulo
 * @param {string|number} valor
 * @param {any} icon
 * @param {"default"|"sky"|"emerald"|"amber"|"red"} variant
 * @param {string} subtexto
 */
export default function KpiCard({
  titulo,
  valor,
  icon,
  variant = "default",
  subtexto = ""
}) {
  const styles = {
    default: {
      card: "bg-white border-slate-200",
      titulo: "text-slate-600",
      valor: "text-slate-900",
      icon: "text-slate-500"
    },
    sky: {
      card: "bg-white border-sky-200",
      titulo: "text-sky-800",
      valor: "text-[#1C96C5]",
      icon: "text-[#1C96C5]"
    },
    emerald: {
      card: "bg-white border-emerald-200",
      titulo: "text-emerald-800",
      valor: "text-emerald-700",
      icon: "text-emerald-600"
    },
    amber: {
      card: "bg-white border-amber-200",
      titulo: "text-amber-800",
      valor: "text-amber-700",
      icon: "text-amber-600"
    },
    red: {
      card: "bg-white border-rose-200",
      titulo: "text-rose-800",
      valor: "text-rose-700",
      icon: "text-rose-600"
    }
  };

  const estilo = styles[variant] || styles.default;

  return (
    <div className={`p-4 rounded border ${estilo.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium uppercase tracking-wider block ${estilo.titulo}`}>
          {titulo}
        </span>
        {icon && <span className={`h-4 w-4 shrink-0 ${estilo.icon}`}>{icon}</span>}
      </div>
      <div className="mt-2">
        <span className={`text-2xl font-bold font-mono tabular-nums ${estilo.valor}`}>{valor}</span>
      </div>
      {subtexto && (
        <p className="text-xs text-slate-600 mt-1 truncate">{subtexto}</p>
      )}
    </div>
  );
}
