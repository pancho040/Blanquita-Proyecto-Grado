export const RodelaItem = (codigoRodela) => ({
  CodigoRodela: codigoRodela
});

export const IngresoRodelaRequest = (idProveedor, idTipoRodela, rodelas) => ({
  IdProveedor: idProveedor,
  IdTipoRodela: idTipoRodela,
  Rodelas: rodelas.map(RodelaItem)
});

export const IngresoRodelaResponse = (data) => ({
  FechaRecepcion: data.FechaRecepcion,
  CantidadRodelas: data.CantidadRodelas
});


export const TipoRodelaIngreso = (data) => ({
  IdTipoRodela: data.IdTipoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  Descripcion: data.Descripcion ?? null,
  Activo: data.Activo
});
