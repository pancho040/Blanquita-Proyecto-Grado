export const ABIERTO_EN_VISTA_PREVIA = "vista-previa";

let abrirVisor = null;

export function registrarVisorPDF(abrir) {
  abrirVisor = abrir;
  return () => {
    if (abrirVisor === abrir) abrirVisor = null;
  };
}

export function abrirVistaPrevia(archivo) {
  if (!abrirVisor) return false;
  abrirVisor(archivo);
  return true;
}
