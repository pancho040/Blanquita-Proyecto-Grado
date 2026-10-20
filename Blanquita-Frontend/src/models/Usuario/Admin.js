const textoOpcional = (valor) => {
  const texto = (valor ?? "").trim();
  return texto === "" ? null : texto;
};

export const ListarUsuariosRequest = (filtros = {}) => ({
  Busqueda: filtros.Busqueda ?? null,
  IdEstadoUsuario: filtros.IdEstadoUsuario ?? null,
  IdRol: filtros.IdRol ?? null,
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 20,
});

export const UsuarioListaItem = (data) => ({
  IdUsuario: data.IdUsuario,
  Ci: data.Ci,
  PrimerNombre: data.PrimerNombre,
  SegundoNombre: data.SegundoNombre ?? null,
  ApellidoPaterno: data.ApellidoPaterno,
  ApellidoMaterno: data.ApellidoMaterno ?? null,
  NombreCompleto: [data.PrimerNombre, data.SegundoNombre, data.ApellidoPaterno, data.ApellidoMaterno]
    .filter(Boolean)
    .join(" "),
  Celular: data.Celular ?? null,
  FechaRegistro: data.FechaRegistro,
  IsAdmin: Boolean(data.IsAdmin),
  IdRol: data.IdRol,
  NombreRol: data.NombreRol,
  IdEstadoUsuario: data.IdEstadoUsuario,
  NombreEstadoUsuario: data.NombreEstadoUsuario,
});

export const ListarUsuariosResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Usuarios: (data.Usuarios ?? []).map(UsuarioListaItem),
});

export const CrearUsuarioRequest = (datos) => ({
  IdRol: Number(datos.IdRol),
  Ci: (datos.Ci ?? "").trim(),
  PrimerNombre: (datos.PrimerNombre ?? "").trim(),
  SegundoNombre: textoOpcional(datos.SegundoNombre),
  ApellidoPaterno: (datos.ApellidoPaterno ?? "").trim(),
  ApellidoMaterno: textoOpcional(datos.ApellidoMaterno),
  Celular: (datos.Celular ?? "").trim(),
  Clave: datos.Clave,
  IsAdmin: Boolean(datos.IsAdmin),
});

export const CrearUsuarioResponse = (data) => ({
  IdUsuario: data.IdUsuario,
  Ci: data.Ci,
  NombreCompleto: data.NombreCompleto,
  NombreRol: data.NombreRol,
  IsAdmin: data.IsAdmin,
});

export const CambiarEstadoUsuarioRequest = (idUsuario, idEstadoUsuario, motivo) => ({
  IdUsuario: idUsuario,
  IdEstadoUsuario: idEstadoUsuario,
  Motivo: (motivo ?? "").trim(),
});

export const CambiarEstadoUsuarioResponse = (data) => ({
  IdUsuario: data.IdUsuario,
  Ci: data.Ci,
  NombreCompleto: data.NombreCompleto,
  NombreEstadoAnterior: data.NombreEstadoAnterior,
  NombreEstadoUsuario: data.NombreEstadoUsuario,
});

export const EditarUsuarioRequest = (idUsuario, datos) => ({
  IdUsuario: idUsuario,
  PrimerNombre: (datos.PrimerNombre ?? "").trim(),
  SegundoNombre: textoOpcional(datos.SegundoNombre),
  ApellidoPaterno: (datos.ApellidoPaterno ?? "").trim(),
  ApellidoMaterno: textoOpcional(datos.ApellidoMaterno),
  Celular: textoOpcional(datos.Celular),
});

export const EditarUsuarioResponse = (data) => ({
  IdUsuario: data.IdUsuario,
  Ci: data.Ci,
  NombreCompleto: data.NombreCompleto,
});

export const RestablecerClaveRequest =(idUsuario, claveNueva) => ({
  IdUsuario: idUsuario,
  ClaveNueva: claveNueva,
});

export const RestablecerClaveResponse = (data) => ({
  IdUsuario: data.IdUsuario,
  Ci: data.Ci,
  NombreCompleto: data.NombreCompleto,
});
