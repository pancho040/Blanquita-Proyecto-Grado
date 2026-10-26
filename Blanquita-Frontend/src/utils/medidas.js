import { DECIMALES_PESO, ENTEROS_MEDIDA } from "@/constants/Values";
import { formatearNumero } from "@/utils/numeros";

export const aMedida = (valor, decimales = DECIMALES_PESO, enteros = ENTEROS_MEDIDA) => {
  const limpio = String(valor ?? "")
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "");
  const [entero, ...resto] = limpio.split(".");
  const parteEntera = entero.replace(/^0+(?=\d)/, "").slice(0, enteros);
  if (!resto.length || decimales === 0) return parteEntera;
  return `${parteEntera}.${resto.join("").slice(0, decimales)}`;
};

const mostrar = (valor, decimales) =>
  formatearNumero(valor, { decimales, decimalesMinimos: 0 });

export const errorMedida = (
  valor,
  { etiqueta, unidad, maximo, minimo = 0, obligatorio = true, decimales = DECIMALES_PESO },
) => {
  if (valor === "" || valor === null || valor === undefined) {
    return obligatorio ? `Falta ${etiqueta.toLowerCase()}` : null;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0 || numero < minimo || numero > maximo) {
    return minimo > 0
      ? `${etiqueta} entre ${mostrar(minimo, decimales)} y ${mostrar(maximo, decimales)} ${unidad}`
      : `${etiqueta} mayor a 0 y hasta ${mostrar(maximo, decimales)} ${unidad}`;
  }
  return null;
};

export const fueraDeRango = (valor, [minimo, maximo]) => {
  if (valor === "" || valor === null || valor === undefined) return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && (numero < minimo || numero > maximo);
};

export const textoRango = ([minimo, maximo], unidad, decimales = DECIMALES_PESO) =>
  `${mostrar(minimo, decimales)} a ${mostrar(maximo, decimales)} ${unidad}`;
