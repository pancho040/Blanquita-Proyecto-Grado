const textoOpcional = (valor) => {
  const texto = (valor ?? "").trim();
  return texto === "" ? null : texto;
};

export const FiltroRegistroIngresoRequest = (filtros = {}) => ({
  FechaInicio: filtros.FechaInicio ?? null,
  FechaFin: filtros.FechaFin ?? null,
  Registro: textoOpcional(filtros.Registro),
  Ci: textoOpcional(filtros.Ci),
});

export const ListarRegistroIngresoRequest = (filtros = {}) => ({
  ...FiltroRegistroIngresoRequest(filtros),
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 20,
});

export const RegistroIngresoItem = (data) => ({
  IdRegistroIngreso: data.IdRegistroIngreso,
  Registro: data.Registro,
  IdUsuario: data.IdUsuario ?? null,
  Ci: data.Ci ?? null,
  PrimerNombre: data.PrimerNombre ?? null,
  ApellidoPaterno: data.ApellidoPaterno ?? null,
  ApellidoMaterno: data.ApellidoMaterno ?? null,
  NombreRol: data.NombreRol ?? null,
  Detalle: data.Detalle ?? null,
  DireccionIp: data.DireccionIp ?? null,
  UserAgent: data.UserAgent ?? null,
  Dispositivo: data.Dispositivo,
  FechaRegistro: data.FechaRegistro,
});

export const ResumenRegistroIngresoResponse = (data = {}) => ({
  Ingresos: data.Ingresos ?? 0,
  Salidas: data.Salidas ?? 0,
  IntentosFallidos: data.IntentosFallidos ?? 0,
  Total: data.Total ?? 0,
  CisDistintos: data.CisDistintos ?? 0,
});

export const ListarRegistroIngresoResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Resumen: ResumenRegistroIngresoResponse(data.Resumen),
  Registros: (data.Registros ?? []).map(RegistroIngresoItem),
});

export const UsuarioRegistroIngresoResponse = (data) => ({
  IdUsuario: data.IdUsuario,
  Ci: data.Ci,
  NombreCompleto: [data.PrimerNombre, data.SegundoNombre, data.ApellidoPaterno, data.ApellidoMaterno]
    .filter(Boolean)
    .join(" "),
  NombreRol: data.NombreRol,
  NombreEstadoUsuario: data.NombreEstadoUsuario,
});

export const ReporteUsuarioRegistroIngresoResponse = (data) => ({
  PeriodoInicio: data.PeriodoInicio,
  PeriodoFin: data.PeriodoFin,
  Ci: data.Ci,
  Registro: data.Registro ?? null,
  Usuario: data.Usuario ? UsuarioRegistroIngresoResponse(data.Usuario) : null,
  Resumen: ResumenRegistroIngresoResponse(data.Resumen),
  UltimoIngreso: data.UltimoIngreso ?? null,
  UltimoIntentoFallido: data.UltimoIntentoFallido ?? null,
  Registros: (data.Registros ?? []).map(RegistroIngresoItem),
});
