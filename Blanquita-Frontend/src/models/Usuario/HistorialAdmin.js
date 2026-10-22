import { UsuarioRegistroIngresoResponse } from "./RegistroIngreso";

const textoOpcional = (valor) => {
  const texto = (valor ?? "").trim();
  return texto === "" ? null : texto;
};

export const FiltroHistorialAdminRequest = (filtros = {}) => ({
  FechaInicio: filtros.FechaInicio ?? null,
  FechaFin: filtros.FechaFin ?? null,
  Modulo: textoOpcional(filtros.Modulo),
  Ci: textoOpcional(filtros.Ci),
  Busqueda: textoOpcional(filtros.Busqueda),
});

export const ListarHistorialAdminRequest = (filtros = {}) => ({
  ...FiltroHistorialAdminRequest(filtros),
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 20,
});

export const HistorialAdminItem = (data) => ({
  IdHistorialAdmin: data.IdHistorialAdmin,
  Modulo: data.Modulo,
  Accion: data.Accion,
  Detalle: data.Detalle ?? null,
  Observacion: data.Observacion,
  FechaMovimiento: data.FechaMovimiento,
  IdUsuario: data.IdUsuario,
  Ci: data.Ci,
  PrimerNombre: data.PrimerNombre,
  ApellidoPaterno: data.ApellidoPaterno,
  NombreRol: data.NombreRol,
  NombreEstadoUsuario: data.NombreEstadoUsuario,
});

export const ResumenHistorialAdminResponse = (data = {}) => ({
  Total: data.Total ?? 0,
  AdministradoresDistintos: data.AdministradoresDistintos ?? 0,
  Modulos: (data.Modulos ?? []).map((m) => ({ Modulo: m.Modulo, Cantidad: m.Cantidad })),
});

export const ListarHistorialAdminResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Resumen: ResumenHistorialAdminResponse(data.Resumen),
  Acciones: (data.Acciones ?? []).map(HistorialAdminItem),
});

export const ReporteUsuarioHistorialAdminResponse = (data) => ({
  PeriodoInicio: data.PeriodoInicio,
  PeriodoFin: data.PeriodoFin,
  Ci: data.Ci,
  Modulo: data.Modulo ?? null,
  Busqueda: data.Busqueda ?? null,
  Usuario: data.Usuario ? UsuarioRegistroIngresoResponse(data.Usuario) : null,
  Resumen: ResumenHistorialAdminResponse(data.Resumen),
  UltimaAccion: data.UltimaAccion ?? null,
  Acciones: (data.Acciones ?? []).map(HistorialAdminItem),
});

export const ListarUsuarioHistorialAdminResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Ci: data.Ci,
  Usuario: data.Usuario ? UsuarioRegistroIngresoResponse(data.Usuario) : null,
  Resumen: ResumenHistorialAdminResponse(data.Resumen),
  UltimaAccion: data.UltimaAccion ?? null,
  Acciones: (data.Acciones ?? []).map(HistorialAdminItem),
});
