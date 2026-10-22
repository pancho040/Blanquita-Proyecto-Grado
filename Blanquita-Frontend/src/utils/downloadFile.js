import { pedir } from "@/utils/api";
import { ABIERTO_EN_VISTA_PREVIA, abrirVistaPrevia } from "@/utils/vistaPreviaPDF";

const TIPO_PDF = "application/pdf";

export function obtenerNombreArchivo(response, nombrePorDefecto) {
  const disposicion = response.headers.get("Content-Disposition");
  const coincidencia = disposicion?.match(/filename="?([^"]+)"?/);

  return coincidencia?.[1] ?? nombrePorDefecto;
}

const esPdf = (blob, nombre) => blob.type === TIPO_PDF || nombre.toLowerCase().endsWith(".pdf");

export function descargarArchivo(blob, nombreArchivo) {
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.URL.revokeObjectURL(url);
}

export async function descargarDesdeUrl(url, nombrePorDefecto) {
  const response = await pedir(url);
  const blob = await response.blob();
  const nombre = obtenerNombreArchivo(response, nombrePorDefecto);

  if (esPdf(blob, nombre) && abrirVistaPrevia({ blob, nombre })) return ABIERTO_EN_VISTA_PREVIA;

  descargarArchivo(blob, nombre);
}

export async function imprimirArchivo(blob) {
  const { default: printJS } = await import("print-js");
  const urlLocal = window.URL.createObjectURL(blob);

  try {
    await new Promise((resolve, reject) => {
      printJS({
        printable: urlLocal,
        type: "pdf",
        onLoadingEnd: resolve,
        onError: () => reject(new Error("No se pudo abrir la impresión del PDF")),
      });
    });
  } finally {
    window.URL.revokeObjectURL(urlLocal);
  }
}

export async function imprimirPDF(url) {
  const response = await pedir(url);
  await imprimirArchivo(await response.blob());
}
