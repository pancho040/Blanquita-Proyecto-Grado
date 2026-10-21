export const IngresoProductoTerminadoItem = ({
  IdPresentacion,
  Cantidad,
  Observacion = null,
}) => ({
  IdPresentacion,
  Cantidad,
  Observacion,
});

export const IngresoProductoTerminadoRequest = ({ Presentaciones = [] }) => ({
  Presentaciones: Presentaciones.map((item) => IngresoProductoTerminadoItem(item)),
});

export const IngresoProductoTerminadoResponse = ({
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  CantidadIngresada,
  CantidadActual,
}) => ({
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  CantidadIngresada,
  CantidadActual,
});

export const IngresoProductoTerminadoResponseList = (jsonList) =>
  (jsonList ?? []).map((item) => IngresoProductoTerminadoResponse(item));

export const SalidaProductoTerminadoItem = ({ IdPresentacion, Cantidad }) => ({
  IdPresentacion,
  Cantidad,
});

export const SalidaProductoTerminadoRequest = ({ Observacion, Presentaciones = [] }) => ({
  Observacion,
  Presentaciones: Presentaciones.map((item) => SalidaProductoTerminadoItem(item)),
});

export const SalidaProductoTerminadoItemResponse = ({
  IdMovimientoProductoTerminado,
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  CantidadSalida,
  CantidadActual,
}) => ({
  IdMovimientoProductoTerminado,
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  CantidadSalida,
  CantidadActual,
});

export const SalidaProductoTerminadoResponse = ({
  FechaMovimiento,
  Observacion,
  CantidadTotal,
  Presentaciones,
}) => ({
  FechaMovimiento,
  Observacion,
  CantidadTotal,
  Presentaciones: (Presentaciones ?? []).map((item) => SalidaProductoTerminadoItemResponse(item)),
});

export const CorreccionProductoTerminadoRequest = ({
  IdPresentacion,
  Cantidad,
  Observacion,
}) => ({
  IdPresentacion,
  Cantidad,
  Observacion,
});

export const CorreccionProductoTerminadoResponse = ({
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  NombreTipoMovimientoInventario,
  CantidadAplicada,
  CantidadActual,
}) => ({
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  NombreTipoMovimientoInventario,
  CantidadAplicada,
  CantidadActual,
});

export const VerInventarioProductoTerminadoRequest = ({ IdProducto = null } = {}) => ({
  IdProducto,
});

export const VerInventarioProductoTerminadoResponse = ({
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  TipoContenedor,
  CantidadRollosUnidades,
  CantidadPorUnidadTerminada,
  CantidadActual,
  Activo,
  StockMinimo = null,
  StockPreventivo = null,
  NivelStock = null,
}) => ({
  IdPresentacion,
  CodigoPresentacion,
  NombreProducto,
  TipoContenedor,
  CantidadRollosUnidades,
  CantidadPorUnidadTerminada,
  CantidadActual,
  Activo,
  StockMinimo,
  StockPreventivo,
  NivelStock,
});

export const VerInventarioProductoTerminadoResponseList = (jsonList) =>
  (jsonList ?? []).map((item) => VerInventarioProductoTerminadoResponse(item));

export const ProductoResponse = ({
  IdProducto,
  NombreProducto,
  IdTipoBobina,
  IdTipoBobinaServilleta,
  Activo,
}) => ({
  IdProducto,
  NombreProducto,
  IdTipoBobina,
  IdTipoBobinaServilleta,
  Activo,
});