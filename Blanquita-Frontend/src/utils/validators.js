import { Roles, PREFIJO_POR_ROL, CODIGO_MIN, CODIGO_MAX } from "@/constants/Values";
export const EsEncargado=(idRol)=> idRol===Roles.Encargado
export const EsGerente=(idRol)=> idRol===Roles.Gerente
export const VeComoLider=(idRol)=> EsEncargado(idRol) || EsGerente(idRol)
export const rutaDeRol=(idRol, ruta)=> `/${PREFIJO_POR_ROL[idRol]}/${ruta}`

export function extraerMensajeError(data, fallback = "Ocurrió un error inesperado") {
  const detail = data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        const campo = Array.isArray(err?.loc)
          ? err.loc.filter((l) => l !== "body").join(".")
          : "";
        return campo ? `${campo}: ${err?.msg}` : err?.msg;
      })
      .filter(Boolean)
      .join(" | ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || detail.message || fallback;
  }

  if (typeof data?.message === "string") return data.message;

  return fallback;
}

export async function manejarErrorBackend(response) {
  const data = await response.json().catch(() => ({}));

  const mensaje = extraerMensajeError(
    data,
    `Error ${response.status}: ${response.statusText || "solicitud fallida"}`,
  );

  const error = new Error(mensaje);
  error.status = response.status;
  error.detail = data?.detail;

  throw error;
}

export const aEntero = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export const numeroONulo = (valor) =>
  valor === null || valor === undefined || valor === "" ? null : Number(valor);

const NO_PERMITIDOS_OBSERVACION = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,;:()"\/#-]/g;

export const limpiarObservacion = (texto) =>
  texto.replace(/\s/g, " ").replace(NO_PERMITIDOS_OBSERVACION, "");

const PATRON_CODIGO = /^[A-ZÑ0-9]+(-[A-ZÑ0-9]+)*$/;

export const errorCodigo = (codigo) => {
  if (!codigo) return "Falta el código";
  if (codigo.length < CODIGO_MIN || codigo.length > CODIGO_MAX || !PATRON_CODIGO.test(codigo)) {
    return `Código inválido: ${CODIGO_MIN} a ${CODIGO_MAX} caracteres, solo letras, números y guiones`;
  }
  return "";
};
