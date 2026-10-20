import {
  DatosTipoRequest,
  ProductoAsociado,
  TipoMateriaPrimaBase,
  limpiarTexto
} from "@/models/MateriaPrima/TipoMateriaPrima";

export const DetalleFormatoResponse = (data) => ({
  IdTipoMedidaSubBobina: data.IdTipoMedidaSubBobina,
  MedidaMm: data.MedidaMm,
  DescripcionMedida: data.DescripcionMedida ?? null,
  Cantidad: data.Cantidad
});

export const FormatoSubBobinaResponse = (data) => ({
  IdFormatoSubBobina: data.IdFormatoSubBobina,
  DescripcionFormato: data.DescripcionFormato,
  Activo: data.Activo,
  Detalle: (data.Detalle ?? []).map(DetalleFormatoResponse)
});

export const TipoBobinaServilletaAdminItem = (data) => ({
  IdTipoBobinaServilleta: data.IdTipoBobinaServilleta,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta,
  DiametroMm: Number(data.DiametroMm),
  CrepadoPorcentaje: Number(data.CrepadoPorcentaje),
  ResistenciaKgf: Number(data.ResistenciaKgf),
  CantidadUnidades: data.CantidadUnidades,
  CantidadBobinas: data.CantidadBobinas,
  Formatos: (data.Formatos ?? []).map(FormatoSubBobinaResponse),
  Productos: (data.Productos ?? []).map(ProductoAsociado),
  ...TipoMateriaPrimaBase(data)
});

const DatosTipoBobinaServilletaRequest = (datos) => ({
  DiametroMm: Number(datos.DiametroMm),
  CrepadoPorcentaje: Number(datos.CrepadoPorcentaje),
  ResistenciaKgf: Number(datos.ResistenciaKgf),
  CantidadUnidades: Number(datos.CantidadUnidades),
  IdsFormato: datos.IdsFormato ?? [],
  IdsProducto: datos.IdsProducto ?? [],
  ...DatosTipoRequest(datos)
});

export const CrearTipoBobinaServilletaRequest = (datos) => ({
  NombreTipoBobinaServilleta: limpiarTexto(datos.Nombre),
  ...DatosTipoBobinaServilletaRequest(datos)
});

export const EditarTipoBobinaServilletaRequest = (idTipoBobinaServilleta, datos) => ({
  IdTipoBobinaServilleta: idTipoBobinaServilleta,
  ...DatosTipoBobinaServilletaRequest(datos)
});
