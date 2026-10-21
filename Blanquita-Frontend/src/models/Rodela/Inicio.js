import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

const MovimientoTipoResponse = (data) => ({
  IdTipoRodela: data.IdTipoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  Enviadas: Number(data.Enviadas ?? 0),
  Recibidas: Number(data.Recibidas ?? 0),
});

const IndicadoresSemanaResponse = (data = {}) => ({
  Enviadas: Number(data.Enviadas ?? 0),
  EnviadasSemanaAnterior: Number(data.EnviadasSemanaAnterior ?? 0),
  Recibidas: Number(data.Recibidas ?? 0),
  RecibidasSemanaAnterior: Number(data.RecibidasSemanaAnterior ?? 0),
  Devueltas: Number(data.Devueltas ?? 0),
  DevueltasSemanaAnterior: Number(data.DevueltasSemanaAnterior ?? 0),
  Correcciones: Number(data.Correcciones ?? 0),
  CorreccionesSemanaAnterior: Number(data.CorreccionesSemanaAnterior ?? 0),
});

const MovimientoDiaResponse = (data) => ({
  Fecha: data.Fecha,
  Enviadas: Number(data.Enviadas ?? 0),
  Recibidas: Number(data.Recibidas ?? 0),
  Tipos: (data.Tipos ?? []).map(MovimientoTipoResponse),
});

const StockTipoResponse = (data) => ({
  IdTipoRodela: data.IdTipoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  Activo: Boolean(data.Activo),
  CantidadEnAlmacen: Number(data.CantidadEnAlmacen ?? 0),
  CantidadAbiertas: Number(data.CantidadAbiertas ?? 0),
  ...NivelStockResponse(data),
});

const RodelaEnProduccionResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  FechaTraslado: data.FechaTraslado ?? null,
});

const ReingresableResponse = (data) => ({
  IdRodela: data.IdRodela,
  CodigoRodela: data.CodigoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  FechaTraslado: data.FechaTraslado,
  MinutosRestantes: Number(data.MinutosRestantes ?? 0),
});

const MovimientoRecienteResponse = (data) => ({
  IdMovimientoRodela: data.IdMovimientoRodela,
  CodigoRodela: data.CodigoRodela,
  NombreTipoRodela: data.NombreTipoRodela,
  IdTipoMovimiento: data.IdTipoMovimiento,
  NombreMovimiento: data.NombreMovimiento,
  Usuario: data.Usuario,
  FechaMovimiento: data.FechaMovimiento,
  Observacion: data.Observacion ?? null,
});

const UltimoLoteResponse = (data) =>
  data
    ? {
        IdLoteRodela: data.IdLoteRodela,
        CodigoLote: data.CodigoLote,
        FechaRecepcion: data.FechaRecepcion,
        NombreProveedor: data.NombreProveedor,
        NombreTipoRodela: data.NombreTipoRodela ?? null,
        CantidadRodelas: Number(data.CantidadRodelas ?? 0),
      }
    : null;

export const InicioRodelaResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  MinutosDeshacerTraslado: Number(data.MinutosDeshacerTraslado ?? 0),
  Indicadores: IndicadoresSemanaResponse(data.Indicadores),
  Dias: (data.Dias ?? []).map(MovimientoDiaResponse),
  Tipos: (data.Tipos ?? []).map(MovimientoTipoResponse),
  Stock: (data.Stock ?? []).map(StockTipoResponse),
  EnProduccion: {
    Cantidad: Number(data.EnProduccion?.Cantidad ?? 0),
    Rodelas: (data.EnProduccion?.Rodelas ?? []).map(RodelaEnProduccionResponse),
  },
  Reingresables: (data.Reingresables ?? []).map(ReingresableResponse),
  UltimosMovimientos: (data.UltimosMovimientos ?? []).map(MovimientoRecienteResponse),
  UltimoLote: UltimoLoteResponse(data.UltimoLote),
});
