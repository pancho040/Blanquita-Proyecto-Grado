import { codigoFinal } from "@/utils/handlers";
import { numeroONulo } from "@/utils/validators";

export const BobinaPapel = (data) => ({
  IdBobinaPapel: data.IdBobinaPapel ?? null,
  CodigoBobina: data.CodigoBobina,
  IdTipoBobina: data.IdTipoBobina,
  IdLoteBobina: data.IdLoteBobina,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  PesoBrutoKg: data.PesoBrutoKg ?? null,
  Gramaje: data.Gramaje ?? null,
  PesoNetoKg: data.PesoNetoKg ?? null,
});

export const ListaBobinasPapel = (data) => ({
  Bobinas: (data.Bobinas ?? []).map(BobinaPapel),
});

export const BobinaPapelIngresoItem = (data) => ({
  CodigoBobina: data.CodigoBobina,
  PesoBrutoKg: data.PesoBrutoKg ?? null,
  Gramaje: data.Gramaje ?? null,
  PesoNetoKg: data.PesoNetoKg ?? null,
});

export const IngresoModelo = (data) => ({
  IdProveedor: data.IdProveedor,
  IdTipoBobina: data.IdTipoBobina,
  Bobinas: (data.Bobinas ?? []).map(BobinaPapelIngresoItem),
});

export const IngresoLoteBobinaPapelResponse = (data) => ({
  FechaRecepcion: data.FechaRecepcion,
  CantidadBobinas: data.CantidadBobinas,
});

export const TipoBobinaPapelIngreso = (data) => ({
  IdTipoBobina: data.IdTipoBobina,
  NombreTipoBobina: data.NombreTipoBobina,
  Activo: data.Activo,
  TaraKg: Number(data.TaraKg),
});

export const EditarBobinaPapelRequest = (data) => ({
  IdBobinaPapel: data.IdBobinaPapel,
  CodigoBobina: codigoFinal(data.CodigoBobina ?? ""),
  PesoBrutoKg: Number(data.PesoBrutoKg),
  PesoNetoKg: Number(data.PesoNetoKg),
  Gramaje: numeroONulo(data.Gramaje),
  Observacion: (data.Observacion ?? "").trim() || null,
});

export const EditarBobinaPapelResponse = (data) => ({
  IdBobinaPapel: data.IdBobinaPapel,
  CodigoBobina: data.CodigoBobina,
  PesoBrutoKg: data.PesoBrutoKg,
  PesoNetoKg: data.PesoNetoKg,
  Gramaje: data.Gramaje ?? null,
  FechaMovimiento: data.FechaMovimiento,
});
