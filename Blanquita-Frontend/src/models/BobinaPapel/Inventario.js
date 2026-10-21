import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

export const VerResumenInventarioBobinaPapelResponse = (data) => ({
  IdTipoBobina: data.IdTipoBobina,
  NombreTipoBobina: data.NombreTipoBobina,
  CantidadBobinas: data.CantidadBobinas,
  PesoNetoTotalKg: data.PesoNetoTotalKg,
  GramajePromedio: data.GramajePromedio,
  Activo: data.Activo,
  ...NivelStockResponse(data)
});

export const VerDetalleInventarioBobinaPapelRequest = (idTipoBobina) => ({
  IdTipoBobina: idTipoBobina
});

export const VerDetalleInventarioBobinaPapelResponse = (data) => ({
  IdBobinaPapel: data.IdBobinaPapel,
  CodigoBobina: data.CodigoBobina,
  CodigoLote: data.CodigoLote,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor,
  PesoBrutoKg: data.PesoBrutoKg,
  PesoNetoKg: data.PesoNetoKg,
  Gramaje: data.Gramaje,
  Reingresada: data.Reingresada ?? false,
  FechaUltimoReingreso: data.FechaUltimoReingreso ?? null
});

export const ReingresarBobinaAInventarioRequest = (idBobinaPapel, observacion) => ({
  IdBobinaPapel: idBobinaPapel,
  Observacion: observacion ?? null
});

export const ReingresarBobinaAInventarioResponse = (data) => ({
  IdBobinaPapel: data.IdBobinaPapel,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});

export const VerBobinasPapelFueraInventarioResponse = (data) => ({
  IdBobinaPapel: data.IdBobinaPapel,
  CodigoBobina: data.CodigoBobina,
  NombreTipoBobina: data.NombreTipoBobina,
  PesoBrutoKg: data.PesoBrutoKg ?? null,
  Gramaje: data.Gramaje ?? null,
  NombreProveedor: data.NombreProveedor,
  FechaRecepcion: data.FechaRecepcion,
  UltimaObservacion: data.UltimaObservacion ?? null,
  FechaUltimoMovimiento: data.FechaUltimoMovimiento ?? null
});