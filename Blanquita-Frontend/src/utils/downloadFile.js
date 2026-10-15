import { pedir } from "@/utils/api";

export function obtenerNombreArchivo(response, nombrePorDefecto) {
  const disposicion = response.headers.get("Content-Disposition");
  const coincidencia = disposicion?.match(/filename="?([^"]+)"?/);

  return coincidencia?.[1] ?? nombrePorDefecto;
}

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

  descargarArchivo(blob, obtenerNombreArchivo(response, nombrePorDefecto));
}

export async function imprimirPDF(url) {
  const response = await pedir(url);
  const blob = await response.blob();
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
