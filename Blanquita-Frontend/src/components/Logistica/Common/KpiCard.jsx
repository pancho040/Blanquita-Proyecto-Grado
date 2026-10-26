/**
 * Tarjeta de KPI unificada y reutilizable.
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
      titulo: "text-slate-500",
      valor: "text-slate-900",
      icon: "text-slate-400"
    },
    sky: {
      card: "bg-white border-sky-200 bg-sky-50/20",
      titulo: "text-sky-700",
      valor: "text-sky-800",
      icon: "text-sky-500"
    },
    emerald: {
      card: "bg-white border-emerald-200 bg-emerald-50/20",
      titulo: "text-emerald-700",
      valor: "text-emerald-800",
      icon: "text-emerald-500"
    },
    amber: {
      card: "bg-white border-amber-200 bg-amber-50/20",
      titulo: "text-amber-700",
      valor: "text-amber-800",
      icon: "text-amber-500"
    },
    red: {
      card: "bg-white border-red-200 bg-red-50/20",
      titulo: "text-red-700",
      valor: "text-red-800",
      icon: "text-red-500"
    }
  };

  const estilo = styles[variant] || styles.default;

  return (
    <div className={`p-4 rounded-xl border shadow-2xs transition-all ${estilo.card}`}>
      <span className={`text-[11px] font-semibold uppercase tracking-wider block ${estilo.titulo}`}>
        {titulo}
      </span>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-2xl font-bold font-sans ${estilo.valor}`}>{valor}</span>
        {icon && <span className={`h-5 w-5 ${estilo.icon}`}>{icon}</span>}
      </div>
      {subtexto && (
        <p className="text-[11px] text-slate-400 mt-1 truncate">{subtexto}</p>
      )}
    </div>
  );
}