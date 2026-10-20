import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

export const EmpaqueItem = (codigoEmpaque, idTipoEmpaque, pesoKg) => ({
  CodigoEmpaque: codigoEmpaque,
  IdTipoEmpaque: idTipoEmpaque,
  PesoKg: pesoKg
});

export const IngresoEmpaqueRequest = (idProveedor, cantidadToneladasPedida, empaques) => ({
  IdProveedor: idProveedor,
  CantidadToneladasPedida: cantidadToneladasPedida,
  Empaques: empaques.map((e) => EmpaqueItem(e.CodigoEmpaque, e.IdTipoEmpaque, e.PesoKg))
});

export const IngresoEmpaqueResponseItem = (data) => ({
  FechaRecepcion: data.FechaRecepcion,
  IdTipoEmpaque: data.IdTipoEmpaque,
  NombreTipoEmpaque: data.NombreTipoEmpaque,
  CantidadEmpaques: data.CantidadEmpaques
});

export const IngresoEmpaqueResponse = (data) => ({
  Resumen: data.Resumen.map(IngresoEmpaqueResponseItem)
});

export const TrasladarEmpaquesProduccionRequest = (idsEmpaque) => ({
  IdsEmpaque: idsEmpaque
});

export const TrasladarEmpaquesProduccionResponseItem = (data) => ({
  IdEmpaque: data.IdEmpaque,
  CodigoEmpaque: data.CodigoEmpaque,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});

export const ResumenInventarioEmpaqueResponse = (data) => ({
  IdTipoEmpaque: data.IdTipoEmpaque,
  NombreTipoEmpaque: data.NombreTipoEmpaque,
  CantidadEmpaques: data.CantidadEmpaques,
  ...NivelStockResponse(data)
});

export const DetalleInventarioEmpaqueRequest = (idTipoEmpaque) => ({
  IdTipoEmpaque: idTipoEmpaque
});

export const DetalleInventarioEmpaqueResponse = (data) => ({
  IdEmpaque: data.IdEmpaque,
  CodigoEmpaque: data.CodigoEmpaque,
  PesoKg: data.PesoKg,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor
});

export const TipoEmpaqueIngreso = (data) => ({
  IdTipoEmpaque: data.IdTipoEmpaque,
  NombreTipoEmpaque: data.NombreTipoEmpaque,
  Activo: data.Activo
});

export const EmpaqueReingresableResponse = (data) => ({
  IdEmpaque: data.IdEmpaque,
  CodigoEmpaque: data.CodigoEmpaque,
  IdTipoEmpaque: data.IdTipoEmpaque,
  NombreTipoEmpaque: data.NombreTipoEmpaque,
  PesoKg: data.PesoKg,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor,
  FechaTraslado: data.FechaTraslado,
  MinutosRestantes: data.MinutosRestantes
});

export const ReingresarEmpaqueRequest = (idEmpaque, observacion) => ({
  IdEmpaque: idEmpaque,
  Observacion: (observacion ?? "").trim()
});

export const ReingresarEmpaqueResponse = (data) => ({
  IdEmpaque: data.IdEmpaque,
  CodigoEmpaque: data.CodigoEmpaque,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});
