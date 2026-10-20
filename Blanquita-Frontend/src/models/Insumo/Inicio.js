import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

const MovimientoInsumoResponse = (data) => ({
  IdTipoInsumo: data.IdTipoInsumo,
  NombreInsumo: data.NombreInsumo,
  Ingresos: Number(data.Ingresos ?? 0),
  Salidas: Number(data.Salidas ?? 0),
});

const IndicadoresSemanaResponse = (data = {}) => ({
  Ingresos: Number(data.Ingresos ?? 0),
  IngresosSemanaAnterior: Number(data.IngresosSemanaAnterior ?? 0),
  Salidas: Number(data.Salidas ?? 0),
  SalidasSemanaAnterior: Number(data.SalidasSemanaAnterior ?? 0),
  Movimientos: Number(data.Movimientos ?? 0),
  MovimientosSemanaAnterior: Number(data.MovimientosSemanaAnterior ?? 0),
  StockTotal: Number(data.StockTotal ?? 0),
  InsumosEnAlerta: Number(data.InsumosEnAlerta ?? 0),
});

const MovimientoDiaResponse = (data) => ({
  Fecha: data.Fecha,
  Ingresos: Number(data.Ingresos ?? 0),
  Salidas: Number(data.Salidas ?? 0),
  Insumos: (data.Insumos ?? []).map(MovimientoInsumoResponse),
});

const StockInsumoResponse = (data) => ({
  IdTipoInsumo: data.IdTipoInsumo,
  NombreInsumo: data.NombreInsumo,
  Activo: Boolean(data.Activo),
  CantidadActual: Number(data.CantidadActual ?? 0),
  FechaUltimoMovimiento: data.FechaUltimoMovimiento ?? null,
  ...NivelStockResponse(data),
});

const MovimientoRecienteResponse = (data) => ({
  IdMovimientoInsumo: data.IdMovimientoInsumo,
  NombreInsumo: data.NombreInsumo,
  IdTipoMovimiento: data.IdTipoMovimiento,
  NombreMovimiento: data.NombreMovimiento,
  Cantidad: Number(data.Cantidad ?? 0),
  Usuario: data.Usuario,
  FechaMovimiento: data.FechaMovimiento,
  Observacion: data.Observacion ?? null,
});

export const InicioInsumoResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  DiasSinMovimiento: Number(data.DiasSinMovimiento ?? 0),
  Indicadores: IndicadoresSemanaResponse(data.Indicadores),
  Dias: (data.Dias ?? []).map(MovimientoDiaResponse),
  Insumos: (data.Insumos ?? []).map(MovimientoInsumoResponse),
  Stock: (data.Stock ?? []).map(StockInsumoResponse),
  SinMovimiento: (data.SinMovimiento ?? []).map(StockInsumoResponse),
  UltimosMovimientos: (data.UltimosMovimientos ?? []).map(MovimientoRecienteResponse),
});
