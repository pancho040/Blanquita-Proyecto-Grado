const CLAVE = "mensajeAdmin";

export function guardarMensaje(texto) {
  try {
    sessionStorage.setItem(CLAVE, texto);
  } catch {}
}

export function tomarMensaje() {
  try {
    const texto = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return texto;
  } catch {
    return null;
  }
}
