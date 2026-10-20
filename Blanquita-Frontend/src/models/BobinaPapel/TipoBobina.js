import {
  DatosTipoRequest,
  ProductoAsociado,
  TipoMateriaPrimaBase,
  limpiarTexto
} from "@/models/MateriaPrima/TipoMateriaPrima";

export const TipoBobinaAdminItem = (data) => ({
  IdTipoBobina: data.IdTipoBobina,
  NombreTipoBobina: data.NombreTipoBobina,
  DiametroMm: Number(data.DiametroMm),
  Formato: Number(data.Formato),
  TaraKg: Number(data.TaraKg),
  CantidadBobinas: data.CantidadBobinas,
  Productos: (data.Productos ?? []).map(ProductoAsociado),
  ...TipoMateriaPrimaBase(data)
});

const DatosTipoBobinaRequest = (datos) => ({
  DiametroMm: Number(datos.DiametroMm),
  Formato: Number(datos.Formato),
  TaraKg: Number(datos.TaraKg),
  IdsProducto: datos.IdsProducto ?? [],
  ...DatosTipoRequest(datos)
});

export const CrearTipoBobinaRequest = (datos) => ({
  NombreTipoBobina: limpiarTexto(datos.Nombre),
  ...DatosTipoBobinaRequest(datos)
});

export const EditarTipoBobinaRequest = (idTipoBobina, datos) => ({
  IdTipoBobina: idTipoBobina,
  ...DatosTipoBobinaRequest(datos)
});
