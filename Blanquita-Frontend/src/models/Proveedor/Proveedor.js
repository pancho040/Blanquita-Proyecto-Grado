import { nombreEstadoProveedor } from "@/constants/Estados";

export const ProveedorForm = (data) => ({
  IdProveedor: data.IdProveedor,
  NombreProveedor: data.NombreProveedor,
});

export const ProveedorItem = (data) => ({
  IdProveedor: data.IdProveedor,
  NombreProveedor: data.NombreProveedor,
  CelularProveedor: data.CelularProveedor ?? null,
  CorreoProveedor: data.CorreoProveedor ?? null,
  Activo: data.Activo,
  NombreEstadoProveedor: nombreEstadoProveedor(data.Activo),
});

export const ListarProveedoresRequest = (filtros = {}) => ({
  Busqueda: filtros.Busqueda ?? null,
  Activo: filtros.Activo ?? null,
  Pagina: filtros.Pagina ?? 1,
  TamanoPagina: filtros.TamanoPagina ?? 20,
});

export const ListarProveedoresResponse = (data) => ({
  Total: data.Total,
  Pagina: data.Pagina,
  TamanoPagina: data.TamanoPagina,
  Proveedores: (data.Proveedores ?? []).map(ProveedorItem),
});

export const ProveedorContacto = (datos) => ({
  CelularProveedor: (datos.CelularProveedor ?? "").trim() || null,
  CorreoProveedor: (datos.CorreoProveedor ?? "").trim().toLowerCase() || null,
});

export const ProveedorDatos = (datos) => ({
  NombreProveedor: (datos.NombreProveedor ?? "").trim().replace(/\s+/g, " "),
  ...ProveedorContacto(datos),
});

export const CrearProveedorRequest = ProveedorDatos;

export const EditarProveedorRequest = (idProveedor, datos) => ({
  IdProveedor: idProveedor,
  ...ProveedorContacto(datos),
});

export const ProveedorResponse = ProveedorItem;

export const CambiarEstadoProveedorRequest = (idProveedor, activo, motivo) => ({
  IdProveedor: idProveedor,
  Activo: activo,
  Motivo: (motivo ?? "").trim(),
});

export const CambiarEstadoProveedorResponse = (data) => ({
  IdProveedor: data.IdProveedor,
  NombreProveedor: data.NombreProveedor,
  ActivoAnterior: data.ActivoAnterior,
  NombreEstadoAnterior: nombreEstadoProveedor(data.ActivoAnterior),
  Activo: data.Activo,
  NombreEstadoProveedor: nombreEstadoProveedor(data.Activo),
});
