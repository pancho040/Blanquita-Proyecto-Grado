export const NivelStockResponse = (data) => ({
  StockMinimo: data.StockMinimo ?? null,
  StockPreventivo: data.StockPreventivo ?? null,
  NivelStock: data.NivelStock ?? null
});
