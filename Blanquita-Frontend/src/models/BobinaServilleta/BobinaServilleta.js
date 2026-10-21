export const UnidadBobinaServilletaItem = (data) => ({
  CodigoBobina: data.CodigoBobina,
  IdFormatoSubBobina: data.IdFormatoSubBobina,
  PesoBrutoKg: data.PesoBrutoKg ?? null,
  GramajeGr: data.GramajeGr ?? null
});

export const BobinaServilletaItem = (data) => ({
  Unidades: (data.Unidades ?? []).map(UnidadBobinaServilletaItem)
});

export const IngresoBobinaServilletaRequest = (idProveedor, idTipoBobinaServilleta, bobinas) => ({
  IdProveedor: idProveedor,
  IdTipoBobinaServilleta: idTipoBobinaServilleta,
  Bobinas: (bobinas ?? []).map(BobinaServilletaItem)
});

export const IngresoBobinaServilletaResponse = (data) => ({
  FechaRecepcion: data.FechaRecepcion,
  CantidadBobinasServilleta: data.CantidadBobinasServilleta,
  CantidadUnidades: data.CantidadUnidades
});

export const DetalleFormatoResponse = (data) => ({
  IdTipoMedidaSubBobina: data.IdTipoMedidaSubBobina,
  MedidaMm: data.MedidaMm,
  DescripcionMedida: data.DescripcionMedida ?? null,
  Cantidad: data.Cantidad
});

export const FormatoSubBobinaResponse = (data) => ({
  IdFormatoSubBobina: data.IdFormatoSubBobina,
  DescripcionFormato: data.DescripcionFormato,
  Activo: data.Activo,
  Detalle: (data.Detalle ?? []).map(DetalleFormatoResponse)
});

export const TipoBobinaServilletaIngreso = (data) => ({
  IdTipoBobinaServilleta: data.IdTipoBobinaServilleta,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  CantidadUnidades: data.CantidadUnidades,
  Activo: data.Activo,
  Formatos: (data.Formatos ?? []).map(FormatoSubBobinaResponse)
});

export const UnidadServilletaResponse = (data) => ({
  IdUnidadBobinaServilleta: data.IdUnidadBobinaServilleta,
  CodigoBobina: data.CodigoBobina,
  IdFormatoSubBobina: data.IdFormatoSubBobina,
  DescripcionFormato: data.DescripcionFormato,
  PesoBrutoKg: data.PesoBrutoKg ?? null,
  GramajeGr: data.GramajeGr ?? null
});
