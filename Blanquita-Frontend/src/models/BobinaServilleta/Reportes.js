import { UnidadServilletaResponse } from "./BobinaServilleta";

export const ReporteInventarioBobinaServilletaRequest = (idsTipoBobinaServilleta) => ({
  IdsTipoBobinaServilleta: idsTipoBobinaServilleta ?? null
});

export const VerBobinasServilletaRequest = (filtros = {}) => ({
  CodigoBobina: filtros.CodigoBobina ?? null,
  IdProveedor: filtros.IdProveedor ?? null,
  IdTipoBobinaServilleta: filtros.IdTipoBobinaServilleta ?? null,
  IdEstadoMateriaPrima: filtros.IdEstadoMateriaPrima ?? null,
  IdBobinaServilleta: filtros.IdBobinaServilleta ?? null,
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 50
});

export const BobinaServilletaCatalogoResponse = (data) => ({
  IdBobinaServilleta: data.IdBobinaServilleta,
  TipoEstado: data.TipoEstado,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  CodigoLote: data.CodigoLote,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor,
  Unidades: (data.Unidades ?? []).map(UnidadServilletaResponse)
});

export const VerBobinasServilletaResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Bobinas: (data.Bobinas ?? []).map(BobinaServilletaCatalogoResponse)
});

export const VerLotesBobinaServilletaRequest = (filtros = {}) => ({
  FechaInicio: filtros.FechaInicio ?? null,
  FechaFin: filtros.FechaFin ?? null,
  IdProveedor: filtros.IdProveedor ?? null,
  IdsTipoBobinaServilleta: filtros.IdsTipoBobinaServilleta ?? null,
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 50
});

export const LoteBobinaServilletaCatalogoResponse = (data) => ({
  IdLoteBobinaServilleta: data.IdLoteBobinaServilleta,
  FechaRecepcion: data.FechaRecepcion,
  NombreProveedor: data.NombreProveedor,
  CantidadBobinas: data.CantidadBobinas
});

export const VerLotesBobinaServilletaResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Lotes: (data.Lotes ?? []).map(LoteBobinaServilletaCatalogoResponse)
});

export const VerProduccionesServilletaRequest = (filtros = {}) => ({
  FechaInicio: filtros.FechaInicio ?? null,
  FechaFin: filtros.FechaFin ?? null,
  IdTurno: filtros.IdTurno ?? null,
  IdsTipoBobinaServilleta: filtros.IdsTipoBobinaServilleta ?? null,
  CodigoBobina: filtros.CodigoBobina ?? null,
  Operador: filtros.Operador ?? null,
  IdEstadoProduccion: filtros.IdEstadoProduccion ?? null,
  IdsEstadoProduccion: filtros.IdsEstadoProduccion ?? null,
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 50
});

export const ProduccionServilletaCatalogoResponse = (data) => ({
  IdProduccionServilleta: data.IdProduccionServilleta,
  NombreEstadoProduccion: data.NombreEstadoProduccion,
  NombreTurno: data.NombreTurno,
  Operador: data.Operador,
  Ci: data.Ci,
  NombreRol: data.NombreRol,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  CodigoBobina: data.CodigoBobina,
  DescripcionMedida: data.DescripcionMedida,
  DescripcionFormato: data.DescripcionFormato,
  IdSubBobinaServilleta: data.IdSubBobinaServilleta,
  FechaInicioProduccion: data.FechaInicioProduccion,
  FechaFinProduccion: data.FechaFinProduccion ?? null,
  DuracionTotal: data.DuracionTotal ?? null
});

export const VerProduccionesServilletaResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Producciones: (data.Producciones ?? []).map(ProduccionServilletaCatalogoResponse)
});
