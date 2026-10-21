import { numeroONulo } from "@/utils/validators";

export const NivelStockResponse = (data) => ({
  StockMinimo: data.StockMinimo ?? null,
  StockPreventivo: data.StockPreventivo ?? null,
  NivelStock: data.NivelStock ?? null
});

export const UmbralStockItem = (data) => ({
  Dominio: data.Dominio,
  NombreDominio: data.NombreDominio,
  Id: data.Id,
  Nombre: data.Nombre,
  CantidadActual: data.CantidadActual,
  Activo: data.Activo,
  ...NivelStockResponse(data)
});

export const ListarUmbralesStockRequest = (dominio) => ({
  Dominio: dominio ?? null
});

export const EditarUmbralStockRequest = (dominio, id, datos) => ({
  Dominio: dominio,
  Id: id,
  StockMinimo: numeroONulo(datos.StockMinimo),
  StockPreventivo: numeroONulo(datos.StockPreventivo)
});
