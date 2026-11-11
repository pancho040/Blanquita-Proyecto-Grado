import React, { useState, useRef } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Database,
  FileCheck,
  X,
  FileUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ModalImportarExcel({
  abierto,
  onCerrar,
  titulo = "Importar Datos desde Excel",
  descripcion = "Sube un archivo de cálculo (.xlsx) o procesa el archivo oficial del sistema.",
  archivoPredeterminadoNombre = "Archivo Oficial del Sistema (.xlsx)",
  onImportar,
  onCompletado,
}) {
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleCerrar = () => {
    if (procesando) return;
    setArchivo(null);
    setResultado(null);
    onCerrar();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast.error("Por favor selecciona un archivo Excel (.xlsx o .xls)");
        return;
      }
      setArchivo(file);
      setResultado(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast.error("Por favor arrastra un archivo Excel (.xlsx o .xls)");
        return;
      }
      setArchivo(file);
      setResultado(null);
    }
  };

  const ejecutarImportacion = async (usarArchivoSubido = true) => {
    try {
      setProcesando(true);
      setResultado(null);
      const fileToSend = usarArchivoSubido ? archivo : null;
      const res = await onImportar(fileToSend);
      setResultado(res);
      toast.success(res?.mensaje || "¡Importación completada con éxito!");
      if (onCompletado) {
        onCompletado(res);
      }
    } catch (err) {
      toast.error(err.message || "Error al procesar el archivo Excel");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-md sm:max-w-lg bg-white rounded border border-slate-300 shadow-md p-5">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#F0FDF4] text-[#15803D] rounded border border-[#86EFAC]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {titulo}
              </DialogTitle>
              <p className="text-xs text-slate-600 mt-0.5">
                {descripcion}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido Principal */}
        <div className="space-y-3 py-2">
          {/* Zona Drag & Drop */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`cursor-pointer transition-colors border-2 border-dashed rounded p-4 text-center ${
              dragOver
                ? "border-[#1C96C5] bg-[#F0F9FF]"
                : archivo
                ? "border-[#86EFAC] bg-[#F0FDF4]"
                : "border-slate-300 hover:border-slate-400 bg-slate-50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />

            {archivo ? (
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded border border-[#86EFAC]">
                <div className="flex items-center gap-2 overflow-hidden text-left">
                  <FileCheck className="h-5 w-5 text-[#15803D] shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {archivo.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      {(archivo.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchivo(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-[#B91C1C] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 py-1">
                <div className="mx-auto w-8 h-8 rounded bg-slate-200/70 flex items-center justify-center text-slate-600">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Haz clic o arrastra tu archivo Excel
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Formatos admitidos: .XLSX o .XLS
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Opción rápida del archivo del servidor */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white px-2.5 text-slate-500 font-medium">
                o sincronizar archivo del servidor
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Database className="h-4 w-4 text-[#1C96C5] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {archivoPredeterminadoNombre}
                </p>
                <p className="text-[11px] text-slate-500">
                  Archivo oficial en carpeta del servidor
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={procesando}
              onClick={() => ejecutarImportacion(false)}
              className="text-xs h-8 border-slate-300 hover:bg-white shrink-0 font-medium rounded text-slate-700"
            >
              Procesar Oficial
            </Button>
          </div>

          {/* Resultado de la Importación */}
          {resultado && (
            <div className="p-3 bg-[#F0FDF4] border border-[#86EFAC] rounded text-left space-y-1">
              <div className="flex items-center gap-2 text-[#15803D] text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 text-[#15803D]" />
                <span>{resultado.mensaje || "Registros procesados exitosamente"}</span>
              </div>
              {resultado.detalle && (
                <div className="text-[11px] text-slate-700 space-y-0.5 pl-6 font-mono">
                  {Object.entries(resultado.detalle)
                    .filter(([k]) => k !== "Archivo")
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-600">{k}:</span>
                        <span className="font-bold tabular-nums text-slate-900">{String(v)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCerrar}
            disabled={procesando}
            className="text-slate-700 hover:bg-slate-100 text-xs h-8 rounded"
          >
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>

          {archivo && (
            <Button
              type="button"
              onClick={() => ejecutarImportacion(true)}
              disabled={procesando}
              className="bg-[#15803D] hover:bg-green-800 text-white text-xs h-8 flex items-center gap-1.5 rounded font-medium border-0"
            >
              {procesando ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <FileUp className="h-3.5 w-3.5" />
                  <span>Subir e Importar</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
