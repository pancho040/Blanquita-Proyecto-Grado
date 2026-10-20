export const estadoStock = (cantidad, { StockMinimo = null, StockPreventivo = null } = {}) => {
  const valor = Number(cantidad || 0);
  if (valor <= 0) return "agotado";
  if (StockMinimo === null || StockPreventivo === null) return "disponible";
  if (valor <= StockMinimo) return "critico";
  if (valor <= StockPreventivo) return "bajo";
  return "disponible";
};

export const ESTILO_STOCK = {
  disponible: {
    texto: "Disponible",
    clase: "bg-emerald-50 text-emerald-700",
    numero: "text-emerald-700",
  },
  bajo: {
    texto: "Stock bajo",
    clase: "bg-amber-50 text-amber-700",
    numero: "text-amber-600",
  },
  critico: {
    texto: "Stock crítico",
    clase: "bg-red-50 text-red-700",
    numero: "text-red-600",
  },
  agotado: {
    texto: "Sin stock",
    clase: "bg-slate-100 text-slate-500",
    numero: "text-slate-400",
  },
};
