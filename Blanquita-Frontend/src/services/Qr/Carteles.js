import { descargarDesdeUrl, imprimirPDF } from "@/utils/downloadFile";

const BASE_URL = "/api/qr";

export async function imprimirCartelQr(ruta) {
  await imprimirPDF(`${BASE_URL}/${ruta}`);
}

export async function descargarCartelQr(ruta) {
  return descargarDesdeUrl(`${BASE_URL}/${ruta}`, "cartel-qr.pdf");
}
