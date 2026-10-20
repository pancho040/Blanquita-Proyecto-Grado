import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

export const InventarioEmpaqueBolsaResponse = (data) => ({
  IdInventarioEmpaqueBolsa: data.IdInventarioEmpaqueBolsa,
  IdTipoEmpaqueBolsa: data.IdTipoEmpaqueBolsa,
  NombreEmpaqueBolsa: data.NombreEmpaqueBolsa,
  DescripcionEmpaqueBolsa: data.DescripcionEmpaqueBolsa ?? null,
  Activo: data.Activo,
  CantidadActual: data.CantidadActual,
  ...NivelStockResponse(data)
});

export const IngresoEmpaqueBolsaRequest = (idProveedor, cantidadToneladasPedida, empaquesBolsa) => ({
  IdProveedor: idProveedor,
  CantidadToneladasPedida: cantidadToneladasPedida ?? null,
  EmpaquesBolsa: empaquesBolsa.map((e) => ({
    IdTipoEmpaqueBolsa: e.IdTipoEmpaqueBolsa,
    Cantidad: e.Cantidad
  }))
});

export const IngresoEmpaqueBolsaResponse = (data) => ({
  IdLoteEmpaque: data.IdLoteEmpaque,
  IdProveedor: data.IdProveedor,
  NombreProveedor: data.NombreProveedor,
  FechaRecepcion: data.FechaRecepcion,
  CantidadToneladasPedida: data.CantidadToneladasPedida ?? null,
  CantidadTotalIngresada: data.CantidadTotalIngresada,
  Items: data.Empaques.map((e) => ({
    IdTipo: e.IdTipoEmpaqueBolsa,
    Nombre: e.NombreEmpaqueBolsa,
    CantidadIngresada: e.CantidadIngresada,
    CantidadActual: e.CantidadActual
  }))
});

export const SalidaEmpaqueBolsaRequest = (idTipoEmpaqueBolsa, cantidad, observacion) => ({
  IdTipoEmpaqueBolsa: idTipoEmpaqueBolsa,
  Cantidad: cantidad,
  Observacion: observacion
});

export const SalidaEmpaqueBolsaResponse = (data) => ({
  IdMovimientoEmpaqueBolsa: data.IdMovimientoEmpaqueBolsa,
  IdTipoEmpaqueBolsa: data.IdTipoEmpaqueBolsa,
  NombreEmpaqueBolsa: data.NombreEmpaqueBolsa,
  NombreMovimiento: data.NombreMovimiento,
  CantidadMovimiento: data.CantidadMovimiento,
  CantidadActual: data.CantidadActual,
  FechaMovimiento: data.FechaMovimiento
});
