import { UmbralStockItem } from "@/models/AlertaStock/AlertaStock";
import { EstadoBloqueoProductoTerminadoResponse } from "@/models/Inventario/inventario";
import { ResumenConteoResponse } from "@/models/Inventario/conteo";

export const ProduccionBobinaPapelResponse = (data) => ({
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  IdPausaProduccionBobinaTubo: data.IdPausaProduccionBobinaTubo ?? null,
  NombreTipoBobina: data.NombreTipoBobina,
  NombreProducto: data.NombreProducto,
  CodigoBobina1: data.CodigoBobina1,
  CodigoBobina2: data.CodigoBobina2,
  NombreTurno: data.NombreTurno ?? null,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  Operador: data.Operador,
  FechaInicioProduccion: data.FechaInicioProduccion ?? null,
  FechaHoraPausa: data.FechaHoraPausa ?? null,
  CantidadLogsActual: Number(data.CantidadLogsActual ?? 0),
  Atrasada: Boolean(data.Atrasada),
});

export const ProduccionBobinaServilletaResponse = (data) => ({
  IdProduccionServilleta: data.IdProduccionServilleta,
  IdPausaProduccionServilleta: data.IdPausaProduccionServilleta ?? null,
  MedidaMm: Number(data.MedidaMm ?? 0),
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  NombreTurno: data.NombreTurno ?? null,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  Operador: data.Operador,
  FechaInicioProduccion: data.FechaInicioProduccion ?? null,
  FechaHoraPausa: data.FechaHoraPausa ?? null,
  Atrasada: Boolean(data.Atrasada),
});

export const ProduccionResponse = (data, mapear) => ({
  Activas: (data?.Activas ?? []).map(mapear),
  Pausadas: (data?.Pausadas ?? []).map(mapear),
});

export const NotificacionesResponse = (data) => ({
  ModoConsulta: data.ModoConsulta
    ? { HoraInicio: data.ModoConsulta.HoraInicio, HoraFin: data.ModoConsulta.HoraFin }
    : null,
  Stock: data.Stock
    ? {
        SinStock: (data.Stock.SinStock ?? []).map(UmbralStockItem),
        Criticos: (data.Stock.Criticos ?? []).map(UmbralStockItem),
      }
    : null,
  BloqueoProductoTerminado: data.BloqueoProductoTerminado
    ? EstadoBloqueoProductoTerminadoResponse(data.BloqueoProductoTerminado)
    : null,
  ConteoProductoTerminado: data.ConteoProductoTerminado
    ? ResumenConteoResponse(data.ConteoProductoTerminado)
    : null,
  HorasAlertaConteo: Number(data.HorasAlertaConteo ?? 0),
  BobinaPapel: ProduccionResponse(data.BobinaPapel, ProduccionBobinaPapelResponse),
  BobinaServilleta: ProduccionResponse(data.BobinaServilleta, ProduccionBobinaServilletaResponse),
  HorasAlertaPausa: Number(data.HorasAlertaPausa ?? 0),
  Atrasadas: Number(data.Atrasadas ?? 0),
  Total: Number(data.Total ?? 0),
});
