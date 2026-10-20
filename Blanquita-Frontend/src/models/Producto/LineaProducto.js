import { nombreEstadoCatalogo } from "@/constants/Estados";
import { NivelStockResponse } from "@/models/AlertaStock/AlertaStock";
import { limpiarTexto } from "@/models/MateriaPrima/TipoMateriaPrima";
import { numeroONulo } from "@/utils/validators";

export const CONTENEDOR_JABA = "Jaba";
export const CONTENEDOR_PLANCHA = "Plancha";
export const CONTENEDORES_PRESENTACION = [CONTENEDOR_JABA, CONTENEDOR_PLANCHA];

const LETRAS_CONTENEDOR = { [CONTENEDOR_JABA]: "J", [CONTENEDOR_PLANCHA]: "P" };

export const ORIGEN_NINGUNO = "ninguno";
export const ORIGEN_PAPEL = "papel";
export const ORIGEN_SERVILLETA = "servilleta";

export const codigoSugerido = (siglas, contenedor, unidades) =>
  siglas && LETRAS_CONTENEDOR[contenedor] && Number(unidades) > 0
    ? `${siglas}-${LETRAS_CONTENEDOR[contenedor]}${String(Number(unidades)).padStart(2, "0")}`
    : "";

export const siglasSugeridas = (nombre) => {
  const letras = limpiarTexto(nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, "");
  const palabras = letras.split(" ").filter(Boolean);
  const iniciales = palabras.length >= 3 ? palabras.map((p) => p[0]).join("") : "";
  return (iniciales || letras.replace(/ /g, "")).slice(0, 3);
};

export const textoContenido = (p) =>
  p.TipoContenedor === CONTENEDOR_PLANCHA
    ? `Plancha · ${p.CantidadRollosUnidades} u.`
    : `${p.TipoContenedor} · ${p.CantidadRollosUnidades} u/paq · ${p.CantidadPorUnidadTerminada} paq`;

export const origenDe = (linea) =>
  linea.IdTipoBobina !== null
    ? { tipo: ORIGEN_PAPEL, id: linea.IdTipoBobina }
    : linea.IdTipoBobinaServilleta !== null
      ? { tipo: ORIGEN_SERVILLETA, id: linea.IdTipoBobinaServilleta }
      : { tipo: ORIGEN_NINGUNO, id: null };

export const textoOrigen = (linea) =>
  linea.NombreTipoBobina
    ? `Bobina papel · ${linea.NombreTipoBobina}`
    : linea.NombreTipoBobinaServilleta
      ? `Bobina servilleta · ${linea.NombreTipoBobinaServilleta}`
      : "Sin materia prima (merma o segunda)";

export const PresentacionAdminItem = (data) => ({
  IdPresentacion: data.IdPresentacion,
  IdProducto: data.IdProducto,
  TipoContenedor: data.TipoContenedor,
  CantidadRollosUnidades: data.CantidadRollosUnidades ?? null,
  CantidadPorUnidadTerminada: data.CantidadPorUnidadTerminada ?? null,
  CodigoPresentacion: data.CodigoPresentacion,
  Activo: data.Activo,
  NombreEstado: nombreEstadoCatalogo(data.Activo),
  CantidadActual: Number(data.CantidadActual ?? 0),
  ...NivelStockResponse(data)
});

export const LineaProductoAdminItem = (data) => ({
  IdProducto: data.IdProducto,
  NombreProducto: data.NombreProducto,
  SiglasProducto: data.SiglasProducto,
  Activo: data.Activo,
  NombreEstado: nombreEstadoCatalogo(data.Activo),
  IdTipoBobina: data.IdTipoBobina ?? null,
  NombreTipoBobina: data.NombreTipoBobina ?? null,
  IdTipoBobinaServilleta: data.IdTipoBobinaServilleta ?? null,
  NombreTipoBobinaServilleta: data.NombreTipoBobinaServilleta ?? null,
  EnProduccion: data.EnProduccion,
  Presentaciones: (data.Presentaciones ?? []).map(PresentacionAdminItem)
});

export const TipoOrigenItem = (data) => ({
  Id: data.Id,
  Nombre: data.Nombre
});

export const TiposOrigenResponse = (data) => ({
  BobinaPapel: (data.BobinaPapel ?? []).map(TipoOrigenItem),
  BobinaServilleta: (data.BobinaServilleta ?? []).map(TipoOrigenItem)
});

const OrigenRequest = (origen) => ({
  IdTipoBobina: origen.tipo === ORIGEN_PAPEL ? origen.id : null,
  IdTipoBobinaServilleta: origen.tipo === ORIGEN_SERVILLETA ? origen.id : null
});

export const PresentacionRequest = (fila) => ({
  TipoContenedor: fila.TipoContenedor,
  CantidadRollosUnidades: Number(fila.CantidadRollosUnidades),
  CantidadPorUnidadTerminada:
    fila.TipoContenedor === CONTENEDOR_PLANCHA ? 1 : Number(fila.CantidadPorUnidadTerminada),
  CodigoPresentacion: (fila.CodigoPresentacion ?? "").replace(/\s/g, "").toUpperCase() || null,
  StockMinimo: numeroONulo(fila.StockMinimo),
  StockPreventivo: numeroONulo(fila.StockPreventivo)
});

export const CrearLineaProductoRequest = (datos) => ({
  NombreProducto: limpiarTexto(datos.Nombre),
  SiglasProducto: (datos.Siglas ?? "").toUpperCase(),
  Presentaciones: datos.Presentaciones.map(PresentacionRequest),
  ...OrigenRequest(datos.Origen)
});

export const EditarLineaProductoRequest = (idProducto, origen) => ({
  IdProducto: idProducto,
  ...OrigenRequest(origen)
});

export const CrearPresentacionRequest = (idProducto, fila) => ({
  IdProducto: idProducto,
  ...PresentacionRequest(fila)
});
