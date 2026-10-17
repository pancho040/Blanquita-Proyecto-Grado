import { ObtenerTiposPapelBobina } from "@/services/BobinaPapel/BobinaPapel";
import { obtenerProductos } from "@/services/Inventario/Inventario";

export const PRODUCTO_BOBINA_PAPEL = {
  cargar: async () =>
    (await obtenerProductos()).filter((p) => p.IdTipoBobina !== null),
  campo: "IdsProducto",
  campoValor: "IdProducto",
  campoEtiqueta: "NombreProducto",
  etiqueta: "Producto",
};

export const TIPO_BOBINA_PAPEL = {
  cargar: ObtenerTiposPapelBobina,
  campo: "IdsTipoBobina",
  campoValor: "IdTipoBobina",
  campoEtiqueta: "NombreTipoBobina",
  etiqueta: "Tipo de bobina",
};

export const CODIGO_BOBINA_PAPEL = {
  campo: "CodigoBobina",
  etiqueta: "Código de bobina",
  placeholder: "Ej. 963-R20",
};
