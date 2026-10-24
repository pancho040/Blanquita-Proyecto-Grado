import { codigoFinal } from "@/utils/handlers";
import { UnidadServilletaResponse } from "./BobinaServilleta";
import { numeroONulo } from "@/utils/validators";
import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

export const ReingresarSubBobinaInventarioRequest = (idSubBobina, observacion) => ({
  IdSubBobina: idSubBobina,
  Observacion: observacion ?? null
});

export const ReingresarSubBobinaInventarioResponse = (data) => ({
  IdSubBobina: data.IdSubBobina,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  FechaMovimiento: data.FechaMovimiento
});

export const ResumenInventarioBobinaServilletaResponse = (data) => ({
  IdTipoBobinaServilleta: data.IdTipoBobinaServilleta,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  CantidadBobinaServilleta: data.CantidadBobinaServilleta,
  Activo: data.Activo,
  ...NivelStockResponse(data)
});

export const DetalleInventarioBobinaServilletaRequest = (idTipoBobinaServilleta) => ({
  IdTipoBobinaServilleta: idTipoBobinaServilleta
});

export const DetalleInventarioBobinaServilletaResponse = (data) => ({
  IdBobinaServilleta: data.IdBobinaServilleta,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor,
  Unidades: (data.Unidades ?? []).map(UnidadServilletaResponse)
});

export const ResumenInventarioSubBobinaServilletaResponse = (data) => ({
  IdTipoMedidaSubBobina: data.IdTipoMedidaSubBobina,
  NombreTipoMedida: data.NombreTipoMedida,
  CantidadSubBobinas: data.CantidadSubBobinas,
  Activo: data.Activo,
  ...NivelStockResponse(data)
});

export const DetalleInventarioSubBobinaServilletaRequest = (idTipoMedidaSubBobina) => ({
  IdTipoMedidaSubBobina: idTipoMedidaSubBobina
});

export const DetalleInventarioSubBobinaServilletaResponse = (data) => ({
  IdSubBobinaServilleta: data.IdSubBobinaServilleta,
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  Reingresada: data.Reingresada ?? false,
  FechaUltimoReingreso: data.FechaUltimoReingreso ?? null
});

export const SubBobinaServilletaFueraInventarioResponse = (data) => ({
  IdSubBobinaServilleta: data.IdSubBobinaServilleta,
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  NombreTipoMedida: data.NombreTipoMedida,
  UltimaObservacion: data.UltimaObservacion ?? null,
  FechaUltimoMovimiento: data.FechaUltimoMovimiento ?? null
});

export const EditarUnidadBobinaServilletaItem = (data) => ({
  IdUnidadBobinaServilleta: data.IdUnidadBobinaServilleta,
  CodigoBobina: codigoFinal(data.CodigoBobina ?? ""),
  PesoBrutoKg: numeroONulo(data.PesoBrutoKg),
  GramajeGr: numeroONulo(data.GramajeGr)
});

export const EditarBobinaServilletaRequest = (idBobinaServilleta, unidades, observacion) => ({
  IdBobinaServilleta: idBobinaServilleta,
  Unidades: (unidades ?? []).map(EditarUnidadBobinaServilletaItem),
  Observacion: (observacion ?? "").trim()
});

export const EditarBobinaServilletaResponse = (data) => ({
  IdBobinaServilleta: data.IdBobinaServilleta,
  IdUnidadBobinaServilleta: data.IdUnidadBobinaServilleta,
  CodigoBobina: data.CodigoBobina,
  IdFormatoSubBobina: data.IdFormatoSubBobina,
  DescripcionFormato: data.DescripcionFormato,
  PesoBrutoKg: data.PesoBrutoKg ?? null,
  GramajeGr: data.GramajeGr ?? null,
  FechaMovimiento: data.FechaMovimiento
});
