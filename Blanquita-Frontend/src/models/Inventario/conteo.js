const numeroONulo = (valor) => (valor === null || valor === undefined ? null : Number(valor));

export const IniciarConteoRequest = ({ Motivo }) => ({ Motivo });

export const RegistrarCantidadesConteoRequest = (cantidades) => ({
  Cantidades: cantidades.map(({ IdPresentacion, CantidadFisica }) => ({
    IdPresentacion,
    CantidadFisica: Number(CantidadFisica),
  })),
});

export const CerrarConteoRequest = ({ Motivos, Confirmado }) => ({
  Motivos: Object.entries(Motivos).map(([IdPresentacion, Motivo]) => ({
    IdPresentacion: Number(IdPresentacion),
    Motivo,
  })),
  Confirmado: Boolean(Confirmado),
});

export const AnularConteoRequest = ({ Motivo, Confirmado }) => ({
  Motivo,
  Confirmado: Boolean(Confirmado),
});

export const DetalleConteoResponse = (data) => ({
  IdPresentacion: data.IdPresentacion,
  CodigoPresentacion: data.CodigoPresentacion,
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  NombrePresentacion: data.NombrePresentacion,
  Unidad: data.Unidad,
  TipoContenedor: data.TipoContenedor,
  CantidadPorUnidadTerminada: data.CantidadPorUnidadTerminada ?? null,
  Activo: Boolean(data.Activo),
  CantidadSistema: Number(data.CantidadSistema ?? 0),
  CantidadFisica: numeroONulo(data.CantidadFisica),
  Diferencia: numeroONulo(data.Diferencia),
  MotivoDiferencia: data.MotivoDiferencia ?? null,
  UsuarioConteo: data.UsuarioConteo ?? null,
  FechaHoraConteo: data.FechaHoraConteo ?? null,
  IdMovimientoProductoTerminado: data.IdMovimientoProductoTerminado ?? null,
});

export const ResumenConteoResponse = (data) => ({
  IdConteoProductoTerminado: data.IdConteoProductoTerminado,
  Estado: data.Estado,
  UsuarioInicio: data.UsuarioInicio,
  FechaHoraInicio: data.FechaHoraInicio,
  MotivoInicio: data.MotivoInicio,
  UsuarioCierre: data.UsuarioCierre ?? null,
  FechaHoraCierre: data.FechaHoraCierre ?? null,
  MotivoAnulacion: data.MotivoAnulacion ?? null,
  TotalPresentaciones: Number(data.TotalPresentaciones ?? 0),
  Contadas: Number(data.Contadas ?? 0),
  ConDiferencia: Number(data.ConDiferencia ?? 0),
  Faltante: Number(data.Faltante ?? 0),
  Sobrante: Number(data.Sobrante ?? 0),
  Atrasado: Boolean(data.Atrasado),
});

export const ConteoResponse = (data) => ({
  ...ResumenConteoResponse(data),
  Detalle: (data.Detalle ?? []).map(DetalleConteoResponse),
});

export const EstadoConteoResponse = (data) => ({
  Abierto: Boolean(data?.Abierto),
  HorasAlerta: Number(data?.HorasAlerta ?? 0),
  Conteo: data?.Conteo ? ConteoResponse(data.Conteo) : null,
});
