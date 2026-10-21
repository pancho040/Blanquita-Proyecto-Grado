import { nombreEstadoCatalogo } from "@/constants/Estados";
import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";
import { numeroONulo } from "@/utils/validators";

export const limpiarTexto = (texto) => (texto ?? "").trim().replace(/\s+/g, " ");

export const ProductoAsociado = (data) => ({
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  Activo: data.Activo
});

export const ProductoDisponible = (data) => ({
  ...ProductoAsociado(data),
  IdTipoActual: data.IdTipoActual ?? null,
  NombreTipoActual: data.NombreTipoActual ?? null
});

export const TipoMateriaPrimaBase = (data) => ({
  Descripcion: data.Descripcion ?? null,
  Activo: data.Activo,
  NombreEstado: nombreEstadoCatalogo(data.Activo),
  ...NivelStockResponse(data)
});

export const DatosTipoRequest = (datos) => ({
  Descripcion: limpiarTexto(datos.Descripcion) || null,
  StockMinimo: numeroONulo(datos.StockMinimo),
  StockPreventivo: numeroONulo(datos.StockPreventivo)
});

export const ListarTiposResponse = (tipos, filtros = {}, nombreDe) => {
  const busqueda = limpiarTexto(filtros.Busqueda).toLowerCase();
  const filtrados = tipos.filter(
    (t) =>
      (!busqueda ||
        nombreDe(t).toLowerCase().includes(busqueda) ||
        (t.Descripcion ?? "").toLowerCase().includes(busqueda)) &&
      (filtros.Activo === null || filtros.Activo === undefined || String(t.Activo) === String(filtros.Activo))
  );
  const pagina = filtros.Pagina ?? 1;
  const tamano = filtros.TamanoPagina ?? 15;

  return {
    Total: filtrados.length,
    Pagina: pagina,
    TamanoPagina: tamano,
    Tipos: filtrados.slice((pagina - 1) * tamano, pagina * tamano)
  };
};

export const CambiarEstadoTipoRequest = (id, activo, motivo) => ({
  Id: id,
  Activo: activo,
  Motivo: (motivo ?? "").trim()
});

export const CambiarEstadoTipoResponse = (data) => ({
  Id: data.Id,
  Nombre: data.Nombre,
  ActivoAnterior: data.ActivoAnterior,
  NombreEstadoAnterior: nombreEstadoCatalogo(data.ActivoAnterior),
  Activo: data.Activo,
  NombreEstado: nombreEstadoCatalogo(data.Activo)
});
