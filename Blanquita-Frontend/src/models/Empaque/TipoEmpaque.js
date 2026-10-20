import {
  DatosTipoRequest,
  TipoMateriaPrimaBase,
  limpiarTexto
} from "@/models/MateriaPrima/TipoMateriaPrima";

export const TipoEmpaqueAdminItem = (data) => ({
  Id: data.Id,
  Nombre: data.Nombre,
  CantidadActual: data.CantidadActual,
  ...TipoMateriaPrimaBase(data)
});

export const CrearTipoEmpaqueRequest = (datos) => ({
  Nombre: limpiarTexto(datos.Nombre),
  ...DatosTipoRequest(datos)
});

export const EditarTipoEmpaqueRequest = (id, datos) => ({
  Id: id,
  ...DatosTipoRequest(datos)
});
