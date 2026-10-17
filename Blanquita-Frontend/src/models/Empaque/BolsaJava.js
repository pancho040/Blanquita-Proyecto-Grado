export const InventarioBolsaJavaResponse = (data) => ({
  IdInventarioBolsaJava: data.IdInventarioBolsaJava,
  IdTipoBolsaJava: data.IdTipoBolsaJava,
  NombreBolsaJava: data.NombreBolsaJava,
  DescripcionBolsaJava: data.DescripcionBolsaJava ?? null,
  Activo: data.Activo,
  CantidadActual: data.CantidadActual
});

export const IngresoBolsaJavaRequest = (idProveedor, cantidadToneladasPedida, bolsasJava) => ({
  IdProveedor: idProveedor,
  CantidadToneladasPedida: cantidadToneladasPedida ?? null,
  BolsasJava: bolsasJava.map((b) => ({
    IdTipoBolsaJava: b.IdTipoBolsaJava,
    Cantidad: b.Cantidad
  }))
});

export const IngresoBolsaJavaResponse = (data) => ({
  IdLoteEmpaque: data.IdLoteEmpaque,
  IdProveedor: data.IdProveedor,
  NombreProveedor: data.NombreProveedor,
  FechaRecepcion: data.FechaRecepcion,
  CantidadToneladasPedida: data.CantidadToneladasPedida ?? null,
  CantidadTotalIngresada: data.CantidadTotalIngresada,
  Items: data.BolsasJava.map((b) => ({
    IdTipo: b.IdTipoBolsaJava,
    Nombre: b.NombreBolsaJava,
    CantidadIngresada: b.CantidadIngresada,
    CantidadActual: b.CantidadActual
  }))
});

export const SalidaBolsaJavaRequest = (idTipoBolsaJava, cantidad, observacion) => ({
  IdTipoBolsaJava: idTipoBolsaJava,
  Cantidad: cantidad,
  Observacion: observacion
});

export const SalidaBolsaJavaResponse = (data) => ({
  IdMovimientoBolsaJava: data.IdMovimientoBolsaJava,
  IdTipoBolsaJava: data.IdTipoBolsaJava,
  NombreBolsaJava: data.NombreBolsaJava,
  NombreMovimiento: data.NombreMovimiento,
  CantidadMovimiento: data.CantidadMovimiento,
  CantidadActual: data.CantidadActual,
  FechaMovimiento: data.FechaMovimiento
});
