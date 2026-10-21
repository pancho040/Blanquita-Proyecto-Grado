import {
  ProduccionBobinaPapelResponse,
  ProduccionBobinaServilletaResponse,
  ProduccionResponse,
} from "@/models/Notificacion/Notificacion";
import { UmbralStockItem } from "@/models/AlertaStock/AlertaStock";
import {
  DespachoResponse,
  LineaSemanaResponse,
  LineaStockResponse,
  numeros,
} from "@/models/Inventario/Inicio";

const TramoResponse = (data) => ({
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  Unidades: Number(data.Unidades ?? 0),
  Contenedores: Number(data.Contenedores ?? 0),
  Lineas: (data.Lineas ?? []).map(LineaSemanaResponse),
});

const PausasAreaResponse = (data = {}) => ({
  Pausas: Number(data.Pausas ?? 0),
  Segundos: Number(data.Segundos ?? 0),
  Motivos: (data.Motivos ?? []).map((motivo) => ({
    Motivo: motivo.Motivo,
    Pausas: Number(motivo.Pausas ?? 0),
    Segundos: Number(motivo.Segundos ?? 0),
  })),
});

export const InicioGerenteResponse = (data) => ({
  Periodo: data.Periodo,
  FechaInicio: data.FechaInicio,
  FechaFin: data.FechaFin,
  Planta: {
    BobinaPapel: ProduccionResponse(data.Planta?.BobinaPapel, ProduccionBobinaPapelResponse),
    BobinaServilleta: ProduccionResponse(data.Planta?.BobinaServilleta, ProduccionBobinaServilletaResponse),
    HorasAlertaPausa: Number(data.Planta?.HorasAlertaPausa ?? 0),
  },
  Stock: {
    UnidadesTotales: Number(data.Stock?.UnidadesTotales ?? 0),
    Alertas: numeros(data.Stock?.Alertas),
    Lineas: (data.Stock?.Lineas ?? []).map(LineaStockResponse),
  },
  Produccion: {
    Unidades: Number(data.Produccion?.Unidades ?? 0),
    Contenedores: Number(data.Produccion?.Contenedores ?? 0),
    Ingresos: Number(data.Produccion?.Ingresos ?? 0),
    DiasConProduccion: Number(data.Produccion?.DiasConProduccion ?? 0),
    Lineas: (data.Produccion?.Lineas ?? []).map(LineaSemanaResponse),
    Tramos: (data.Produccion?.Tramos ?? []).map(TramoResponse),
  },
  Salidas: {
    Despachos: Number(data.Salidas?.Despachos ?? 0),
    Unidades: Number(data.Salidas?.Unidades ?? 0),
    Contenedores: Number(data.Salidas?.Contenedores ?? 0),
    Lineas: (data.Salidas?.Lineas ?? []).map(LineaSemanaResponse),
    Tramos: (data.Salidas?.Tramos ?? []).map(TramoResponse),
    UltimosDespachos: (data.Salidas?.UltimosDespachos ?? []).map(DespachoResponse),
  },
  Pausas: {
    BobinaPapel: PausasAreaResponse(data.Pausas?.BobinaPapel),
    BobinaServilleta: PausasAreaResponse(data.Pausas?.BobinaServilleta),
  },
  MateriaPrima: (data.MateriaPrima ?? []).map((area) => ({
    Dominio: area.Dominio,
    NombreDominio: area.NombreDominio,
    Cantidad: Number(area.Cantidad ?? 0),
    Alertas: Number(area.Alertas ?? 0),
    Criticas: Number(area.Criticas ?? 0),
    Items: (area.Items ?? []).map(UmbralStockItem),
  })),
});
