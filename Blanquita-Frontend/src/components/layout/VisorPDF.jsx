import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Download, Loader2, Minus, Plus, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { descargarArchivo, imprimirArchivo } from "@/utils/downloadFile";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ZOOM_INICIAL = ZOOMS.indexOf(1);
const ANCHO_MAXIMO_PAGINA = 960;
const MARGEN_PAGINA = 32;

function BotonHerramienta({ ayuda, onClick, disabled, children, className = "" }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={ayuda}
      title={ayuda}
      className={`h-9 w-9 text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      {children}
    </Button>
  );
}

function PaginaCargando({ ancho }) {
  return <Skeleton className="rounded-sm bg-white" style={{ width: ancho, height: ancho * 1.3 }} />;
}

export default function VisorPDF({ archivo, onCerrar }) {
  const contenedor = useRef(null);
  const [ancho, setAncho] = useState(0);
  const [paginas, setPaginas] = useState(0);
  const [zoom, setZoom] = useState(ZOOM_INICIAL);
  const [imprimiendo, setImprimiendo] = useState(false);

  useEffect(() => {
    const observador = new ResizeObserver(([entrada]) => setAncho(entrada.contentRect.width));
    observador.observe(contenedor.current);
    return () => observador.disconnect();
  }, []);

  const anchoPagina =
    Math.max(0, Math.min(ancho - MARGEN_PAGINA, ANCHO_MAXIMO_PAGINA)) * ZOOMS[zoom];

  const descargar = () => {
    descargarArchivo(archivo.blob, archivo.nombre);
    toast.success("PDF descargado");
  };

  const imprimir = async () => {
    setImprimiendo(true);
    try {
      await imprimirArchivo(archivo.blob);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogTitle className="truncate text-[14px] font-extrabold text-slate-900 sm:text-[15px]">
            {archivo.nombre}
          </DialogTitle>
          <span className="text-[12px] text-slate-500">
            {paginas ? `${paginas} ${paginas === 1 ? "página" : "páginas"}` : "Cargando…"}
          </span>
        </div>

        <div className="hidden items-center gap-0.5 rounded-lg bg-slate-50 p-0.5 sm:flex">
          <BotonHerramienta
            ayuda="Alejar"
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
            disabled={zoom === 0}
          >
            <Minus size={16} strokeWidth={2.5} />
          </BotonHerramienta>
          <button
            type="button"
            onClick={() => setZoom(ZOOM_INICIAL)}
            title="Restablecer zoom"
            className="w-12 text-center text-[12.5px] font-bold tabular-nums text-slate-700"
          >
            {Math.round(ZOOMS[zoom] * 100)}%
          </button>
          <BotonHerramienta
            ayuda="Acercar"
            onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            disabled={zoom === ZOOMS.length - 1}
          >
            <Plus size={16} strokeWidth={2.5} />
          </BotonHerramienta>
        </div>

        <Button
          variant="outline"
          onClick={imprimir}
          disabled={imprimiendo || !paginas}
          className="h-9 gap-1.5 px-2.5 font-bold text-slate-700 sm:px-3"
        >
          {imprimiendo ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Printer size={15} strokeWidth={2.5} />
          )}
          <span className="hidden sm:inline">Imprimir</span>
        </Button>
        <Button
          onClick={descargar}
          className="h-9 gap-1.5 bg-gradient-to-r from-c3 to-c4 px-2.5 font-bold text-white hover:opacity-90 sm:px-3"
        >
          <Download size={15} strokeWidth={2.5} />
          <span className="hidden sm:inline">Descargar</span>
        </Button>
        <BotonHerramienta ayuda="Cerrar" onClick={onCerrar}>
          <X size={18} strokeWidth={2.5} />
        </BotonHerramienta>
      </div>

      <div ref={contenedor} className="flex-1 overflow-auto bg-slate-100">
        {anchoPagina > 0 && (
          <Document
            file={archivo.blob}
            suspense={false}
            onLoadSuccess={({ numPages }) => setPaginas(numPages)}
            loading={
              <div className="flex justify-center py-4">
                <PaginaCargando ancho={anchoPagina} />
              </div>
            }
            error={
              <div className="p-10 text-center text-sm font-semibold text-red-600">
                No se pudo mostrar el PDF. Puedes descargarlo con el botón Descargar.
              </div>
            }
            className="mx-auto flex w-fit flex-col items-center gap-4 py-4"
          >
            {Array.from({ length: paginas }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                width={anchoPagina}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={<PaginaCargando ancho={anchoPagina} />}
                className="overflow-hidden rounded-sm shadow-md"
              />
            ))}
          </Document>
        )}
      </div>
    </>
  );
}
