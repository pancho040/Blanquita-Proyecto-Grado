export const CatalogoInsumoResponse = (data) => ({
  IdInventarioInsumo: data.IdInventarioInsumo,
  IdTipoInsumo: data.IdTipoInsumo,
  CantidadActual: data.CantidadActual,
  NombreInsumo: data.NombreInsumo,
  DescripcionInsumo: data.DescripcionInsumo ?? null,
  Activo: data.Activo
});

export const MovimientoInsumoRequest = (idTipoInsumo, cantidad, observacion) => ({
  IdTipoInsumo: idTipoInsumo,
  Cantidad: cantidad,
  Observacion: observacion
});

export const MovimientoInsumoResponse = (data) => ({
  IdMovimientoInsumo: data.IdMovimientoInsumo,
  IdTipoInsumo: data.IdTipoInsumo,
  NombreInsumo: data.NombreInsumo,
  NombreMovimiento: data.NombreMovimiento,
  CantidadMovimiento: data.CantidadMovimiento,
  CantidadActual: data.CantidadActual,
  FechaMovimiento: data.FechaMovimiento
});

export const InsumoItem = (data) => ({
  IdTipoInsumo: data.IdTipoInsumo,
  NombreInsumo: data.NombreInsumo,
  DescripcionInsumo: data.DescripcionInsumo ?? null,
  CantidadActual: data.CantidadActual
});

export const ListarInsumosRequest = (filtros = {}) => ({
  Busqueda: filtros.Busqueda ?? null,
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 20
});

export const ListarInsumosResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Insumos: (data.Insumos ?? []).map(InsumoItem)
});

const limpiarTexto = (texto) => (texto ?? "").trim().replace(/\s+/g, " ");

export const InsumoDatos = (datos) => ({
  NombreInsumo: limpiarTexto(datos.NombreInsumo),
  DescripcionInsumo: limpiarTexto(datos.DescripcionInsumo)
});

export const CrearInsumoRequest = InsumoDatos;

export const EditarInsumoRequest = (idTipoInsumo, datos) => ({
  IdTipoInsumo: idTipoInsumo,
  DescripcionInsumo: limpiarTexto(datos.DescripcionInsumo)
});

export const InsumoResponse = InsumoItem;
