import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";
import { numeroONulo } from "@/utils/validators";

const MovimientoTipoResponse = (data) => ({
  IdTipo: data.IdTipo,
  NombreTipo: data.NombreTipo,
  Ingresos: Number(data.Ingresos ?? 0),
  Salidas: Number(data.Salidas ?? 0),
});

const IndicadoresSemanaResponse = (data = {}) => ({
  Ingresos: Number(data.Ingresos ?? 0),
  IngresosSemanaAnterior: Number(data.IngresosSemanaAnterior ?? 0),
  Salidas: Number(data.Salidas ?? 0),
  SalidasSemanaAnterior: Number(data.SalidasSemanaAnterior ?? 0),
  Reingresos: Number(data.Reingresos ?? 0),
  ReingresosSemanaAnterior: Number(data.ReingresosSemanaAnterior ?? 0),
  StockTotal: Number(data.StockTotal ?? 0),
  TiposEnAlerta: Number(data.TiposEnAlerta ?? 0),
});

const MovimientoDiaResponse = (data) => ({
  Fecha: data.Fecha,
  Ingresos: Number(data.Ingresos ?? 0),
  Salidas: Number(data.Salidas ?? 0),
  Tipos: (data.Tipos ?? []).map(MovimientoTipoResponse),
});

const StockTipoResponse = (data) => ({
  IdTipo: data.IdTipo,
  NombreTipo: data.NombreTipo,
  Activo: Boolean(data.Activo),
  CantidadActual: Number(data.CantidadActual ?? 0),
  ...NivelStockResponse(data),
});

const ReingresableResponse = (data) => ({
  IdEmpaque: data.IdEmpaque,
  CodigoEmpaque: data.CodigoEmpaque,
  NombreTipoEmpaque: data.NombreTipoEmpaque,
  PesoKg: Number(data.PesoKg ?? 0),
  FechaTraslado: data.FechaTraslado,
  MinutosRestantes: Number(data.MinutosRestantes ?? 0),
});

const MovimientoRecienteResponse = (data) => ({
  IdMovimiento: data.IdMovimiento,
  NombreTipo: data.NombreTipo,
  IdTipoMovimiento: data.IdTipoMovimiento,
  NombreMovimiento: data.NombreMovimiento,
  Cantidad: Number(data.Cantidad ?? 0),
  CodigoEmpaque: data.CodigoEmpaque ?? null,
  Usuario: data.Usuario,
  FechaMovimiento: data.FechaMovimiento,
  Observacion: data.Observacion ?? null,
});

const UltimoLoteResponse = (data) =>
  data
    ? {
        IdLoteEmpaque: data.IdLoteEmpaque,
        FechaRecepcion: data.FechaRecepcion,
        CantidadToneladasPedida: numeroONulo(data.CantidadToneladasPedida),
        NombreProveedor: data.NombreProveedor,
        Tipos: data.Tipos ?? null,
        Cantidad: Number(data.Cantidad ?? 0),
        PesoKg: numeroONulo(data.PesoKg),
      }
    : null;

export const InicioEmpaqueResponse = (data) => ({
  Clase: data.Clase,
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  MinutosReingreso: data.MinutosReingreso ?? null,
  Indicadores: IndicadoresSemanaResponse(data.Indicadores),
  Dias: (data.Dias ?? []).map(MovimientoDiaResponse),
  Tipos: (data.Tipos ?? []).map(MovimientoTipoResponse),
  Stock: (data.Stock ?? []).map(StockTipoResponse),
  Reingresables: (data.Reingresables ?? []).map(ReingresableResponse),
  UltimosMovimientos: (data.UltimosMovimientos ?? []).map(MovimientoRecienteResponse),
  UltimoLote: UltimoLoteResponse(data.UltimoLote),
});
