import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";
import { numeroONulo } from "@/utils/validators";

const PresentacionStockResponse = (data) => ({
  IdPresentacion: data.IdPresentacion,
  CodigoPresentacion: data.CodigoPresentacion,
  TipoContenedor: data.TipoContenedor,
  CantidadRollosUnidades: numeroONulo(data.CantidadRollosUnidades),
  CantidadPorUnidadTerminada: numeroONulo(data.CantidadPorUnidadTerminada),
  Activo: Boolean(data.Activo),
  CantidadActual: Number(data.CantidadActual ?? 0),
  Unidades: Number(data.Unidades ?? 0),
  FechaUltimoMovimiento: data.FechaUltimoMovimiento ?? null,
  ...NivelStockResponse(data),
});

export const LineaStockResponse = (data) => ({
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  Activo: Boolean(data.Activo),
  CantidadActual: Number(data.CantidadActual ?? 0),
  Unidades: Number(data.Unidades ?? 0),
  Presentaciones: (data.Presentaciones ?? []).map(PresentacionStockResponse),
});

const ConteoMovimientoResponse = (data = {}) => ({
  Registros: Number(data.Registros ?? 0),
  RegistrosSemanaAnterior: Number(data.RegistrosSemanaAnterior ?? 0),
  Contenedores: Number(data.Contenedores ?? 0),
});

const PresentacionPendienteResponse = (data) => ({
  IdPresentacion: data.IdPresentacion,
  NombreProducto: data.NombreProducto,
  CodigoPresentacion: data.CodigoPresentacion,
  TipoContenedor: data.TipoContenedor,
  CantidadActual: Number(data.CantidadActual ?? 0),
  FechaUltimoMovimiento: data.FechaUltimoMovimiento ?? null,
});

const MovimientoRecienteResponse = (data) => ({
  IdMovimientoProductoTerminado: data.IdMovimientoProductoTerminado,
  IdTipoMovimientoInventario: data.IdTipoMovimientoInventario,
  NombreTipoMovimientoInventario: data.NombreTipoMovimientoInventario,
  NombreProducto: data.NombreProducto,
  CodigoPresentacion: data.CodigoPresentacion,
  TipoContenedor: data.TipoContenedor,
  Cantidad: Number(data.Cantidad ?? 0),
  Usuario: data.Usuario,
  FechaMovimiento: data.FechaMovimiento,
  Observacion: data.Observacion ?? null,
});

export const LineaSemanaResponse = (data) => ({
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  Unidades: Number(data.Unidades ?? 0),
  Contenedores: Number(data.Contenedores ?? 0),
  Registros: Number(data.Registros ?? 0),
});

const DiaSemanaResponse = (data) => ({
  Fecha: data.Fecha,
  Unidades: Number(data.Unidades ?? 0),
  Contenedores: Number(data.Contenedores ?? 0),
  Lineas: (data.Lineas ?? []).map(LineaSemanaResponse),
});

export const DespachoResponse = (data) =>
  data
    ? {
        IdDespacho: data.IdDespacho,
        FechaMovimiento: data.FechaMovimiento,
        Usuario: data.Usuario,
        Observacion: data.Observacion ?? null,
        NumeroPresentaciones: Number(data.NumeroPresentaciones ?? 0),
        CantidadTotal: Number(data.CantidadTotal ?? 0),
      }
    : null;

export const numeros = (data = {}) => Object.fromEntries(Object.entries(data).map(([clave, valor]) => [clave, Number(valor ?? 0)]));

export const InicioInventarioProductoTerminadoResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  DiasSinMovimiento: Number(data.DiasSinMovimiento ?? 0),
  Alertas: numeros(data.Alertas),
  UnidadesTotales: Number(data.UnidadesTotales ?? 0),
  Lineas: (data.Lineas ?? []).map(LineaStockResponse),
  AjustesPositivos: ConteoMovimientoResponse(data.AjustesPositivos),
  AjustesNegativos: ConteoMovimientoResponse(data.AjustesNegativos),
  Correcciones: ConteoMovimientoResponse(data.Correcciones),
  SinMovimiento: (data.SinMovimiento ?? []).map(PresentacionPendienteResponse),
  InactivasConStock: (data.InactivasConStock ?? []).map(PresentacionPendienteResponse),
  UltimosMovimientos: (data.UltimosMovimientos ?? []).map(MovimientoRecienteResponse),
});

export const InicioProduccionProductoTerminadoResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  Indicadores: numeros(data.Indicadores),
  Dias: (data.Dias ?? []).map(DiaSemanaResponse),
  Lineas: (data.Lineas ?? []).map(LineaSemanaResponse),
  Turnos: (data.Turnos ?? []).map((turno) => ({
    NombreTurno: turno.NombreTurno,
    Unidades: Number(turno.Unidades ?? 0),
    Registros: Number(turno.Registros ?? 0),
  })),
  UltimosIngresos: (data.UltimosIngresos ?? []).map(MovimientoRecienteResponse),
});

export const InicioSalidasProductoTerminadoResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  Indicadores: numeros(data.Indicadores),
  Dias: (data.Dias ?? []).map(DiaSemanaResponse),
  Lineas: (data.Lineas ?? []).map(LineaSemanaResponse),
  PresentacionesDestacadas: (data.PresentacionesDestacadas ?? []).map((p) => ({
    IdPresentacion: p.IdPresentacion,
    NombreProducto: p.NombreProducto,
    CodigoPresentacion: p.CodigoPresentacion,
    TipoContenedor: p.TipoContenedor,
    Contenedores: Number(p.Contenedores ?? 0),
    Unidades: Number(p.Unidades ?? 0),
    CantidadActual: Number(p.CantidadActual ?? 0),
  })),
  Despachos: (data.Despachos ?? []).map(DespachoResponse),
  UltimoDespacho: DespachoResponse(data.UltimoDespacho),
});
