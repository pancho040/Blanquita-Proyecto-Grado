import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

export const ResumenInventarioRodelaResponse = (data) => ({
  IdTipoRodela: data.IdTipoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  Descripcion: data.Descripcion ?? null,
  CantidadEnAlmacen: data.CantidadEnAlmacen,
  CantidadAbiertas: data.CantidadAbiertas,
  Activo: data.Activo,
  ...NivelStockResponse(data)
});

export const DetalleInventarioRodelaRequest = (idTipoRodela) => ({
  IdTipoRodela: idTipoRodela
});

export const DetalleInventarioRodelaResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela,
  CodigoLote: data.CodigoLote,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor,
  TipoEstado: data.TipoEstado
});

export const RodelaEnAlmacenResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela
});

export const TrasladarRodelaRequest = (idRodela, observacion) => ({
  IdRodela: idRodela,
  Observacion: observacion ?? null
});

export const TrasladarRodelaResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});

export const CorregirTrasladoRodelaRequest = (idRodela, observacion) => ({
  IdRodela: idRodela,
  Observacion: observacion ?? null
});

export const CorregirTrasladoRodelaResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});

export const DeshacerTrasladoRodelaRequest = (idRodela, observacion) => ({
  IdRodela: idRodela,
  Observacion: observacion ?? null
});

export const DeshacerTrasladoRodelaResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});

export const EditarRodelaRequest = (idRodela, codigoRodela, observacion) => ({
  IdRodela: idRodela,
  CodigoRodela: (codigoRodela ?? "").trim(),
  Observacion: (observacion ?? "").trim()
});

export const EditarRodelaResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoAnterior: data.CodigoAnterior,
  CodigoRodela: data.CodigoRodela,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});

export const RodelaReingresableResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela,
  IdTipoRodela: data.IdTipoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor,
  FechaTraslado: data.FechaTraslado,
  MinutosRestantes: data.MinutosRestantes
});
