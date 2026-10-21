import {
  DatosTipoRequest,
  TipoMateriaPrimaBase,
  limpiarTexto
} from "@/models/MateriaPrima/TipoMateriaPrima";

export const TipoRodelaAdminItem = (data) => ({
  IdTipoRodela: data.IdTipoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  CantidadEnAlmacen: data.CantidadEnAlmacen,
  ...TipoMateriaPrimaBase(data)
});

export const CrearTipoRodelaRequest = (datos) => ({
  NombreTipoRodela: limpiarTexto(datos.Nombre),
  ...DatosTipoRequest(datos)
});

export const EditarTipoRodelaRequest = (idTipoRodela, datos) => ({
  IdTipoRodela: idTipoRodela,
  ...DatosTipoRequest(datos)
});
