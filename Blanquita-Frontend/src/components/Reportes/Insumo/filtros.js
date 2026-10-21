import { verCatalogoInsumo } from "@/services/Insumo/Insumo";

export const TIPO_INSUMO = {
  cargar: () => verCatalogoInsumo(true),
  campo: "IdsTipoInsumo",
  campoValor: "IdTipoInsumo",
  campoEtiqueta: "NombreInsumo",
  etiqueta: "Insumos",
};

const UMBRAL_STOCK_BAJO = 6;

export const estadoStockInsumo = (cantidad) => {
  const valor = Number(cantidad || 0);
  if (valor === 0) return "Sin stock";
  if (valor < UMBRAL_STOCK_BAJO) return "Stock bajo";
  return "Disponible";
};
