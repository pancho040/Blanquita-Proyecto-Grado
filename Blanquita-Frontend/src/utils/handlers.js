import { CODIGO_MAX } from "@/constants/Values";

const NO_PERMITIDOS_CODIGO = /[^A-ZÑ0-9-]/g;

export const aCodigo = (valor) =>
  valor
    .toUpperCase()
    .normalize("NFD")
    .replace(/N\u0303/g, "Ñ")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(NO_PERMITIDOS_CODIGO, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .slice(0, CODIGO_MAX);

export const codigoFinal = (valor) => aCodigo(valor).replace(/-$/, "");

const colocarCursor = (input, posicion) => {
  requestAnimationFrame(() => {
    input.setSelectionRange(posicion, posicion);
  });
};

export const codigoChange = (e, onCambio) => {
  const input = e.target;
  const inicio = input.selectionStart ?? input.value.length;
  onCambio(aCodigo(input.value));
  colocarCursor(input, aCodigo(input.value.slice(0, inicio)).length);
};

export const codigoKeyDown = (e, onCambio) => {
  if (e.key !== " ") return;
  e.preventDefault();

  const input = e.target;
  const antes = input.value.slice(0, input.selectionStart) + "-";
  onCambio(aCodigo(antes + input.value.slice(input.selectionEnd)));
  colocarCursor(input, aCodigo(antes).length);
};



export const ArrayFilter = (ids, arr) => {
  const clave = Object.keys(arr[0] ?? {}).find((k) => k.startsWith("Id"));
  return arr.filter((obj) => ids.includes(obj[clave]));
};

const SEPARADOR_MOTIVOS = ". ";

export const alternarMotivoEnTexto = (motivo, actual) => {
  if (actual.includes(motivo)) {
    return actual
      .replace(motivo, "")
      .replace(/\.\s*\.\s*/g, ". ")
      .replace(/^\s*\.\s*/, "")
      .trimStart();
  }
  const texto = actual.trimEnd();
  if (!texto) return motivo;
  return texto.endsWith(".")
    ? `${texto} ${motivo}`
    : `${texto}${SEPARADOR_MOTIVOS}${motivo}`;
};