export const IniciarProduccionBobinaTuboRequest = (idBobina1, idBobina2, idProducto) => ({
  IdBobina1: idBobina1,
  IdBobina2: idBobina2,
  IdProducto: idProducto ?? null
});

export const IniciarProduccionBobinaTuboResponse = (data) => ({
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  FechaInicioProduccion: data.FechaInicioProduccion,
  IdTurno: data.IdTurno,
  NombreTurno: data.NombreTurno,
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto
});

export const CambiarLineaProduccionBobinaTuboRequest = (idProduccionBobinaTubo, idProducto) => ({
  IdProduccionBobinaTubo: idProduccionBobinaTubo,
  IdProducto: idProducto
});

export const CambiarLineaProduccionBobinaTuboResponse = (data) => ({
  IdProduccionAnterior: data.IdProduccionAnterior,
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  FechaInicioProduccion: data.FechaInicioProduccion,
  IdTurno: data.IdTurno,
  NombreTurno: data.NombreTurno,
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto
});

export const PausarProduccionBobinaTuboRequest =(idProduccionBobinaTubo, motivoPausaProduccion) => ({
  IdProduccionBobinaTubo: idProduccionBobinaTubo,
  MotivoPausaProduccion: motivoPausaProduccion ?? null
});

export const PausarProduccionBobinaTuboResponse = (data) => ({
  IdPausaProduccionBobinaTubo: data.IdPausaProduccionBobinaTubo,
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  FechaHoraPausa: data.FechaHoraPausa,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  FechaHoraReanudacion: data.FechaHoraReanudacion ?? null,
  IdEstadoProduccion: data.IdEstadoProduccion
});

export const ReanudarProduccionBobinaTuboRequest = (idProduccionBobinaTubo, motivoReanudacion) => ({
  IdProduccionBobinaTubo: idProduccionBobinaTubo,
  MotivoReanudacion: motivoReanudacion ?? null
});

export const ReanudarProduccionBobinaTuboResponse = (data) => ({
  IdPausaProduccionBobinaTubo: data.IdPausaProduccionBobinaTubo,
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  FechaHoraPausa: data.FechaHoraPausa,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  FechaHoraReanudacion: data.FechaHoraReanudacion,
  MotivoReanudacion: data.MotivoReanudacion ?? null,
  IdEstadoProduccion: data.IdEstadoProduccion
});

export const FinalizarProduccionBobinaTuboRequest = (idProduccionBobinaTubo) => ({
  IdProduccionBobinaTubo: idProduccionBobinaTubo
});

export const FinalizarProduccionBobinaTuboResponse = (data) => ({
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  FechaFinProduccion: data.FechaFinProduccion,
  IdEstadoProduccion: data.IdEstadoProduccion,
  NombreEstadoProduccion: data.NombreEstadoProduccion
});

export const CancelarProduccionBobinaTuboRequest = (idProduccionBobinaTubo, motivoCancelacion) => ({
  IdProduccionBobinaTubo: idProduccionBobinaTubo,
  MotivoCancelacion: motivoCancelacion ?? null
});

export const CancelarProduccionBobinaTuboResponse = (data) => ({
  IdCancelacionProduccionBobinaTubo: data.IdCancelacionProduccionBobinaTubo,
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  FechaHoraCancelacion: data.FechaHoraCancelacion,
  MotivoCancelacion: data.MotivoCancelacion ?? null,
  IdEstadoProduccion: data.IdEstadoProduccion
});

export const VerProduccionBobinaTuboRequest = (idTipoBobina) => ({
  IdTipoBobina: idTipoBobina ?? null
});

export const VerProduccionBobinaTuboResponse = (data) => ({
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  IdTipoBobina: data.IdTipoBobina,
  NombreTipoBobina: data.NombreTipoBobina,
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  NombreEstadoProduccion: data.NombreEstadoProduccion,
  CodigoBobina1: data.CodigoBobina1,
  CodigoBobina2: data.CodigoBobina2,
  NombreTurno: data.NombreTurno,
  FechaInicioProduccion: data.FechaInicioProduccion,
  CantidadLogsActual: data.CantidadLogsActual
});

export const VerPausasProduccionBobinaTuboActivasRequest = (filtroIdTipoBobina) => ({
  FiltroIdTipoBobina: filtroIdTipoBobina ?? null
});

export const VerPausasProduccionBobinaTuboActivasResponse = (data) => ({
  IdPausaProduccionBobinaTubo: data.IdPausaProduccionBobinaTubo,
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  CodigoBobina1: data.CodigoBobina1,
  CodigoBobina2: data.CodigoBobina2,
  FechaHoraPausa: data.FechaHoraPausa,
  NombreEstadoProduccion: data.NombreEstadoProduccion,
  CantidadLogsActual: data.CantidadLogsActual
});

export const InsertarMovimientoOperadorLogsRequest = (idProduccionBobinaTubo, idTipoMovimientoOperadorLogs, cantidadLogs, observacion) => ({
  IdProduccionBobinaTubo: idProduccionBobinaTubo,
  IdTipoMovimientoOperadorLogs: idTipoMovimientoOperadorLogs,
  CantidadLogs: cantidadLogs,
  Observacion: observacion ?? null
});

export const InsertarMovimientoOperadorLogsResponse = (data) => ({
  IdMovimientoOperadorLogs: data.IdMovimientoOperadorLogs,
  IdProduccionBobinaTubo: data.IdProduccionBobinaTubo,
  IdTipoMovimientoOperadorLogs: data.IdTipoMovimientoOperadorLogs,
  CantidadLogs: data.CantidadLogs,
  CantidadTotalActual: data.CantidadTotalActual,
  FechaMovimiento: data.FechaMovimiento
});