import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

const ProduccionProductoResponse = (data) => ({
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  Logs: Number(data.Logs ?? 0),
  Cargadas: Number(data.Cargadas ?? 0),
});

const IndicadoresSemanaResponse = (data = {}) => ({
  Logs: Number(data.Logs ?? 0),
  LogsSemanaAnterior: Number(data.LogsSemanaAnterior ?? 0),
  Cargadas: Number(data.Cargadas ?? 0),
  CargadasSemanaAnterior: Number(data.CargadasSemanaAnterior ?? 0),
  Finalizadas: Number(data.Finalizadas ?? 0),
  Canceladas: Number(data.Canceladas ?? 0),
  CambiosLinea: Number(data.CambiosLinea ?? 0),
  Pausas: Number(data.Pausas ?? 0),
  SegundosPausa: Number(data.SegundosPausa ?? 0),
  SegundosPausaSemanaAnterior: Number(data.SegundosPausaSemanaAnterior ?? 0),
});

const ProduccionDiaResponse = (data) => ({
  Fecha: data.Fecha,
  Logs: Number(data.Logs ?? 0),
  Cargadas: Number(data.Cargadas ?? 0),
  Productos: (data.Productos ?? []).map(ProduccionProductoResponse),
});

const MotivoPausaResponse = (data) => ({
  Motivo: data.Motivo,
  Pausas: Number(data.Pausas ?? 0),
  Segundos: Number(data.Segundos ?? 0),
});

const ProduccionActivaResponse = (data) => ({
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  NombreTipoBobina: data.NombreTipoBobina,
  NombreProducto: data.NombreProducto,
  CodigoBobina1: data.CodigoBobina1,
  CodigoBobina2: data.CodigoBobina2,
  NombreTurno: data.NombreTurno,
  Operador: data.Operador,
  FechaInicioProduccion: data.FechaInicioProduccion,
  CantidadLogsActual: Number(data.CantidadLogsActual ?? 0),
  Atrasada: Boolean(data.Atrasada),
});

const PausaAbiertaResponse = (data) => ({
  IdPausaProduccionBobinaTubo: data.IdPausaProduccionBobinaTubo,
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  NombreTipoBobina: data.NombreTipoBobina,
  NombreProducto: data.NombreProducto,
  CodigoBobina1: data.CodigoBobina1,
  CodigoBobina2: data.CodigoBobina2,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  Operador: data.Operador,
  FechaHoraPausa: data.FechaHoraPausa,
  CantidadLogsActual: Number(data.CantidadLogsActual ?? 0),
  Atrasada: Boolean(data.Atrasada),
});

const StockTipoResponse = (data) => ({
  IdTipoBobina: data.IdTipoBobina,
  NombreTipoBobina: data.NombreTipoBobina,
  Activo: Boolean(data.Activo),
  CantidadBobinas: Number(data.CantidadBobinas ?? 0),
  PesoNetoTotalKg: Number(data.PesoNetoTotalKg ?? 0),
  ...NivelStockResponse(data),
});

const BobinaFueraResponse = (data) => ({
  IdBobinaPapel: data.IdBobinaPapel,
  CodigoBobina: data.CodigoBobina,
  NombreTipoBobina: data.NombreTipoBobina,
  FechaUltimoMovimiento: data.FechaUltimoMovimiento ?? null,
});

const UltimoLoteResponse = (data) =>
  data
    ? {
        IdLoteBobina: data.IdLoteBobina,
        CodigoLote: data.CodigoLote,
        FechaRecepcion: data.FechaRecepcion,
        NombreProveedor: data.NombreProveedor,
        NombreTipoBobina: data.NombreTipoBobina ?? null,
        CantidadBobinas: Number(data.CantidadBobinas ?? 0),
        PesoNetoTotalKg: Number(data.PesoNetoTotalKg ?? 0),
      }
    : null;

export const InicioBobinaPapelResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  HorasAlertaPausa: Number(data.HorasAlertaPausa ?? 0),
  Indicadores: IndicadoresSemanaResponse(data.Indicadores),
  Dias: (data.Dias ?? []).map(ProduccionDiaResponse),
  Productos: (data.Productos ?? []).map(ProduccionProductoResponse),
  MotivosPausa: (data.MotivosPausa ?? []).map(MotivoPausaResponse),
  Activas: (data.Activas ?? []).map(ProduccionActivaResponse),
  Pausadas: (data.Pausadas ?? []).map(PausaAbiertaResponse),
  Stock: (data.Stock ?? []).map(StockTipoResponse),
  FueraInventario: {
    Cantidad: Number(data.FueraInventario?.Cantidad ?? 0),
    Bobinas: (data.FueraInventario?.Bobinas ?? []).map(BobinaFueraResponse),
  },
  UltimoLote: UltimoLoteResponse(data.UltimoLote),
});
