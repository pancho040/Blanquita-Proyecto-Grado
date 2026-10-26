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
      <DialogContent className="max-w-md sm:max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">
                {titulo}
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {descripcion}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido Principal */}
        <div className="space-y-4 py-2">
          {/* Zona Drag & Drop */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`cursor-pointer transition-all border-2 border-dashed rounded-xl p-5 text-center ${
              dragOver
                ? "border-[#20A7DB] bg-sky-50/50"
                : archivo
                ? "border-emerald-400 bg-emerald-50/40"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
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
              <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs">
                <div className="flex items-center gap-2.5 overflow-hidden text-left">
                  <FileCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {archivo.name}
                    </p>
                    <p className="text-xs text-slate-400">
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
                  className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Haz clic o arrastra tu archivo Excel
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Formatos admitidos: .XLSX o .XLS
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Opción rápida del archivo del servidor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2.5 text-slate-400 font-medium">
                o sincronizar archivo del servidor
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Database className="h-4 w-4 text-[#20A7DB] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {archivoPredeterminadoNombre}
                </p>
                <p className="text-[11px] text-slate-400">
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
              className="text-xs h-8 border-slate-300 hover:bg-white shrink-0 font-medium"
            >
              Procesar Oficial
            </Button>
          </div>

          {/* Resultado de la Importación */}
          {resultado && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-left space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{resultado.mensaje || "Registros procesados exitosamente"}</span>
              </div>
              {resultado.detalle && (
                <div className="text-[11.5px] text-emerald-950/80 space-y-0.5 pl-6 font-mono">
                  {Object.entries(resultado.detalle)
                    .filter(([k]) => k !== "Archivo")
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{k}:</span>
                        <span className="font-bold">{String(v)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCerrar}
            disabled={procesando}
            className="text-slate-600 hover:bg-slate-100 text-xs h-9"
          >
            {resultado ? "Cerrar" : "Cancelar"}
          </Button>

          {archivo && (
            <Button
              type="button"
              onClick={() => ejecutarImportacion(true)}
              disabled={procesando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 flex items-center gap-1.5 shadow-xs"
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
