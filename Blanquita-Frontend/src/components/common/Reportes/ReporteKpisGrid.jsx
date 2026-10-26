import React from "react";

export const formatCurrency = (val) => {
  if (val === null || val === undefined) return "Bs. 0.00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "Bs. 0.00";
  return `Bs. ${num.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatNumber = (val) => {
  if (val === null || val === undefined) return "0";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "0";
  return num.toLocaleString("es-BO");
};

export default function ReporteKpisGrid({ items, kpis, loading = false }) {
  const lista = (items && items.length > 0) ? items : (kpis || []);
  if (!lista.length) return null;

  const colorSchemeMap = {
    blue: { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-600" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-600" },
    rose: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-600" },
    indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-600" },
    slate: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600" },
  };

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
      {lista.map((kpi, idx) => {
        const Icon = kpi.icono || kpi.icon;
        const schemeColors = kpi.colorScheme ? colorSchemeMap[kpi.colorScheme] || colorSchemeMap.blue : null;
        const bgClass = kpi.colorBg || schemeColors?.bg || "bg-slate-100 dark:bg-slate-800";
        const textClass = kpi.colorText || schemeColors?.text || "text-sky-600";

        return (
          <div
            key={idx}
            className={`border rounded-xl p-4 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between transition-all ${
              kpi.destacado ? "ring-1 ring-sky-500/40 bg-sky-50/20 dark:bg-sky-950/20" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {kpi.titulo}
              </span>
              {Icon && (
                <div className={`p-1.5 rounded-lg ${bgClass}`}>
                  <Icon className={`h-4 w-4 ${textClass}`} />
                </div>
              )}
            </div>

            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                {loading ? (
                  <span className="animate-pulse text-slate-400">...</span>
                ) : kpi.esMoneda || kpi.formato === "moneda" ? (
                  formatCurrency(kpi.valor)
                ) : kpi.formato === "numero" ? (
                  formatNumber(kpi.valor)
                ) : (
                  kpi.valor ?? 0
                )}
              </div>
              {kpi.subtitulo && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {kpi.subtitulo}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
