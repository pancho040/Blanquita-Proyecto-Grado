export const AbrirBobinaServilletaRequest = (idBobinaServilleta, observacion) => ({
  IdBobinaServilleta: idBobinaServilleta,
  Observacion: observacion ?? null
});

export const AbrirBobinaServilletaResponse = (data) => ({
  IdBobinaServilleta: data.IdBobinaServilleta,
  IdEstadoMateriaPrima: data.IdEstadoMateriaPrima,
  SubBobinas: (data.SubBobinas ?? []).map((s) => ({
    IdTipoMedidaSubBobina: s.IdTipoMedidaSubBobina,
    MedidaMm: s.MedidaMm,
    Cantidad: s.Cantidad
  })),
  CantidadSubBobinasTotal: data.CantidadSubBobinasTotal
});

export const IniciarProduccionServilletaRequest = (idSubBobina) => ({
  IdSubBobina: idSubBobina
});

export const IniciarProduccionServilletaResponse = (data) => ({
  IdProduccionServilleta: data.IdProduccionServilleta,
  FechaInicioProduccion: data.FechaInicioProduccion,
  IdTurno: data.IdTurno,
  NombreTurno: data.NombreTurno
});

export const PausaProduccionServilletaRequest = (idProduccionServilleta, motivoPausaProduccion) => ({
  IdProduccionServilleta: idProduccionServilleta,
  MotivoPausaProduccion: motivoPausaProduccion ?? null
});

export const PausaProduccionServilletaResponse = (data) => ({
  IdPausaProduccionServilleta: data.IdPausaProduccionServilleta,
  IdProduccionServilleta: data.IdProduccionServilleta,
  FechaHoraPausa: data.FechaHoraPausa,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  FechaHoraReanudacion: data.FechaHoraReanudacion ?? null,
  IdEstadoProduccion: data.IdEstadoProduccion
});

export const ReanudarProduccionServilletaRequest = (idProduccionServilleta, motivoReanudacion) => ({
  IdProduccionServilleta: idProduccionServilleta,
  MotivoReanudacion: motivoReanudacion ?? null
});

export const ReanudarProduccionServilletaResponse = (data) => ({
  IdPausaProduccionServilleta: data.IdPausaProduccionServilleta,
  IdProduccionServilleta: data.IdProduccionServilleta,
  FechaHoraPausa: data.FechaHoraPausa,
  MotivoPausaProduccion: data.MotivoPausaProduccion ?? null,
  FechaHoraReanudacion: data.FechaHoraReanudacion,
  MotivoReanudacion: data.MotivoReanudacion ?? null,
  IdEstadoProduccion: data.IdEstadoProduccion
});

export const FinalizarProduccionServilletaRequest = (idProduccionServilleta) => ({
  IdProduccionServilleta: idProduccionServilleta
});

export const FinalizarProduccionServilletaResponse = (data) => ({
  IdProduccionServilleta: data.IdProduccionServilleta,
  FechaFinProduccion: data.FechaFinProduccion,
  IdEstadoProduccion: data.IdEstadoProduccion,
  NombreEstadoProduccion: data.NombreEstadoProduccion
});

export const CancelarProduccionServilletaRequest = (idProduccionServilleta, motivoCancelacion) => ({
  IdProduccionServilleta: idProduccionServilleta,
  MotivoCancelacion: motivoCancelacion ?? null
});

export const CancelarProduccionServilletaResponse = (data) => ({
  IdCancelacionProduccionServilleta: data.IdCancelacionProduccionServilleta,
  IdProduccionServilleta: data.IdProduccionServilleta,
  FechaHoraCancelacion: data.FechaHoraCancelacion,
  MotivoCancelacion: data.MotivoCancelacion ?? null,
  IdEstadoProduccion: data.IdEstadoProduccion
});

export const VerProduccionServilletaActivasRequest = (idTipoMedidaSubBobina) => ({
  IdTipoMedidaSubBobina: idTipoMedidaSubBobina ?? null
});

export const VerProduccionServilletaActivasResponse = (data) => ({
  IdProduccionServilleta: data.IdProduccionServilleta,
  NombreEstadoProduccion: data.NombreEstadoProduccion,
  IdSubBobina: data.IdSubBobina,
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  IdTipoMedidaSubBobina: data.IdTipoMedidaSubBobina,
  MedidaMm: data.MedidaMm,
  DescripcionFormato: data.DescripcionFormato,
  NombreTurno: data.NombreTurno,
  FechaInicioProduccion: data.FechaInicioProduccion
});

export const VerPausasProduccionServilletaActivasResponse = (data) => ({
  IdPausaProduccionServilleta: data.IdPausaProduccionServilleta,
  IdProduccionServilleta: data.IdProduccionServilleta,
  IdSubBobina: data.IdSubBobina,
  CodigoUnidadOrigen: data.CodigoUnidadOrigen,
  IdTipoMedidaSubBobina: data.IdTipoMedidaSubBobina,
  MedidaMm: data.MedidaMm,
  DescripcionFormato: data.DescripcionFormato,
  FechaHoraPausa: data.FechaHoraPausa,
  NombreEstadoProduccion: data.NombreEstadoProduccion
});
