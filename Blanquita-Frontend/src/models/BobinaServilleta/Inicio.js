import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";

const ProduccionMedidaResponse = (data) => ({
  IdTipoMedidaSubBobina: data.IdTipoMedidaSubBobina,
  MedidaMm: Number(data.MedidaMm ?? 0),
  Iniciadas: Number(data.Iniciadas ?? 0),
  Finalizadas: Number(data.Finalizadas ?? 0),
});

const IndicadoresSemanaResponse = (data = {}) => ({
  Iniciadas: Number(data.Iniciadas ?? 0),
  IniciadasSemanaAnterior: Number(data.IniciadasSemanaAnterior ?? 0),
  Finalizadas: Number(data.Finalizadas ?? 0),
  FinalizadasSemanaAnterior: Number(data.FinalizadasSemanaAnterior ?? 0),
  Canceladas: Number(data.Canceladas ?? 0),
  BobinasAbiertas: Number(data.BobinasAbiertas ?? 0),
  BobinasAbiertasSemanaAnterior: Number(data.BobinasAbiertasSemanaAnterior ?? 0),
  Pausas: Number(data.Pausas ?? 0),
  SegundosPausa: Number(data.SegundosPausa ?? 0),
  SegundosPausaSemanaAnterior: Number(data.SegundosPausaSemanaAnterior ?? 0),
});

const ProduccionDiaResponse = (data) => ({
  Fecha: data.Fecha,
  Iniciadas: Number(data.Iniciadas ?? 0),
  Finalizadas: Number(data.Finalizadas ?? 0),
  Medidas: (data.Medidas ?? []).map(ProduccionMedidaResponse),
});

const MotivoPausaResponse = (data) => ({
  Motivo: data.Motivo,
  Pausas: Number(data.Pausas ?? 0),
  Segundos: Number(data.Segundos ?? 0),
});

const ProduccionActivaResponse = (data) => ({
  IdProduccionServilleta: data.IdProduccionServilleta,
  MedidaMm: Number(data.MedidaMm ?? 0),
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  NombreTurno: data.NombreTurno,
  Operador: data.Operador,
  FechaInicioProduccion: data.FechaInicioProduccion,
  Atrasada: Boolean(data.Atrasada),
});

const PausaAbiertaResponse = (data) => ({
  IdPausaProduccionServilleta: data.IdPausaProduccionServilleta,
  IdProduccionServilleta: data.IdProduccionServilleta,
  MedidaMm: Number(data.MedidaMm ?? 0),
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  Operador: data.Operador,
  FechaHoraPausa: data.FechaHoraPausa,
  Atrasada: Boolean(data.Atrasada),
});

const StockBobinaResponse = (data) => ({
  IdTipoBobinaServilleta: data.IdTipoBobinaServilleta,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  Activo: Boolean(data.Activo),
  CantidadBobinaServilleta: Number(data.CantidadBobinaServilleta ?? 0),
  ...NivelStockResponse(data),
});

const StockSubBobinaResponse = (data) => ({
  IdTipoMedidaSubBobina: data.IdTipoMedidaSubBobina,
  NombreTipoMedida: data.NombreTipoMedida,
  MedidaMm: Number(data.MedidaMm ?? 0),
  Activo: Boolean(data.Activo),
  CantidadSubBobinas: Number(data.CantidadSubBobinas ?? 0),
  ...NivelStockResponse(data),
});

const SubBobinaFueraResponse = (data) => ({
  IdSubBobinaServilleta: data.IdSubBobinaServilleta,
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  NombreTipoMedida: data.NombreTipoMedida,
  FechaUltimoMovimiento: data.FechaUltimoMovimiento ?? null,
});

const UltimoLoteResponse = (data) =>
  data
    ? {
        IdLoteBobinaServilleta: data.IdLoteBobinaServilleta,
        FechaRecepcion: data.FechaRecepcion,
        NombreProveedor: data.NombreProveedor,
        NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta ?? null,
        CantidadBobinas: Number(data.CantidadBobinas ?? 0),
        PesoBrutoTotalKg: Number(data.PesoBrutoTotalKg ?? 0),
      }
    : null;

export const InicioBobinaServilletaResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  HorasAlertaPausa: Number(data.HorasAlertaPausa ?? 0),
  Indicadores: IndicadoresSemanaResponse(data.Indicadores),
  Dias: (data.Dias ?? []).map(ProduccionDiaResponse),
  Medidas: (data.Medidas ?? []).map(ProduccionMedidaResponse),
  MotivosPausa: (data.MotivosPausa ?? []).map(MotivoPausaResponse),
  Activas: (data.Activas ?? []).map(ProduccionActivaResponse),
  Pausadas: (data.Pausadas ?? []).map(PausaAbiertaResponse),
  StockBobinas: (data.StockBobinas ?? []).map(StockBobinaResponse),
  StockSubBobinas: (data.StockSubBobinas ?? []).map(StockSubBobinaResponse),
  FueraInventario: {
    Cantidad: Number(data.FueraInventario?.Cantidad ?? 0),
    SubBobinas: (data.FueraInventario?.SubBobinas ?? []).map(SubBobinaFueraResponse),
  },
  UltimoLote: UltimoLoteResponse(data.UltimoLote),
});
