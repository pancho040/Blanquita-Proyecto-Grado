import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ImportarBiometrico } from "@/services/RRHH/RRHHService";
import { 
  Fingerprint, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Info,
  Clock,
  Trash2
} from "lucide-react";

export default function ModalImportarBiometrico({ abierto, onCerrar, onImportado }) {
  if (!abierto) return null;
  const [archivoNombre, setArchivoNombre] = useState("");
  const [textoCrudo, setTextoCrudo] = useState("");
  const [dispositivo, setDispositivo] = useState("NGTeco-MB20 (Planta)");
  const [tipoDefecto, setTipoDefecto] = useState("AUTO");
  const [registrosParseados, setRegistrosParseados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resumen, setResumen] = useState(null);

  // Parser robusto para salidas de Biométricos NGTeco / ZKTeco / Anviz
  const parsearTextoMarcas = (texto) => {
    if (!texto || !texto.trim()) {
      setRegistrosParseados([]);
      return;
    }

    const lineas = texto.split(/\r?\n/);
    const parsed = [];

    for (const linea of lineas) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#") || limpia.startsWith("//")) continue;

      // Intentar dividir por tabulación, coma, punto y coma o espacios múltiples
      let partes = limpia.split(/\t+|,|;/);
      if (partes.length < 2) {
        // Separación por espacios
        partes = limpia.split(/\s{2,}|\s+/);
      }

      partes = partes.map(p => p.trim()).filter(Boolean);

      if (partes.length >= 2) {
        let identificador = partes[0];
        let fechaHoraStr = "";
        let tipo = tipoDefecto;

        // Caso común: partes[1] es fecha "2026-10-21" y partes[2] es hora "06:05:00"
        if (partes.length >= 3 && /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/.test(partes[1]) && /^\d{2}:\d{2}/.test(partes[2])) {
          fechaHoraStr = `${partes[1]} ${partes[2]}`;
          if (partes[3]) {
            const rawTipo = partes[3].toUpperCase();
            if (rawTipo === "0" || rawTipo === "IN" || rawTipo.includes("ENTRADA")) tipo = "ENTRADA";
            else if (rawTipo === "1" || rawTipo === "OUT" || rawTipo.includes("SALIDA")) tipo = "SALIDA";
          }
        } 
        // Caso: partes[1] ya contiene fecha y hora juntas: "2026-10-21 06:05:00"
        else if (partes[1].includes(" ") || partes[1].includes("T")) {
          fechaHoraStr = partes[1];
          if (partes[2]) {
            const rawTipo = partes[2].toUpperCase();
            if (rawTipo === "0" || rawTipo === "IN" || rawTipo.includes("ENTRADA")) tipo = "ENTRADA";
            else if (rawTipo === "1" || rawTipo === "OUT" || rawTipo.includes("SALIDA")) tipo = "SALIDA";
          }
        } 
        // Caso con fecha en partes[0] e ID en partes[1]
        else if (/^\d{4}-\d{2}-\d{2}/.test(partes[0])) {
          fechaHoraStr = partes[0];
          identificador = partes[1];
        }

        // Normalizar formato de fecha si viene en DD/MM/YYYY
        if (fechaHoraStr) {
          const matchDMY = fechaHoraStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(.+)$/);
          if (matchDMY) {
            fechaHoraStr = `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]} ${matchDMY[4]}`;
          }

          parsed.push({
            CodigoUsuario: identificador,
            Identificador: identificador,
            FechaHora: fechaHoraStr,
            Estado: tipo,
            Tipo: tipo,
            Dispositivo: dispositivo,
            IdDispositivo: dispositivo
          });
        }
      }
    }

    setRegistrosParseados(parsed);
  };

  const handleArchivoSeleccionado = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivoNombre(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const contenido = event.target?.result;
      if (typeof contenido === "string") {
        setTextoCrudo(contenido);
        parsearTextoMarcas(contenido);
      }
    };
    reader.readAsText(file);
  };

  const handleTextoChange = (e) => {
    const val = e.target.value;
    setTextoCrudo(val);
    parsearTextoMarcas(val);
  };

  const handleLimpiar = () => {
    setTextoCrudo("");
    setArchivoNombre("");
    setRegistrosParseados([]);
    setResumen(null);
  };

  const handleCargarEjemplo = () => {
    const hoy = new Date().toISOString().split("T")[0];
    const ejemplo = 
`10000001\t${hoy} 05:58:30\t0
10000002\t${hoy} 06:12:15\t0
10000003\t${hoy} 07:28:00\t0
10000004\t${hoy} 07:35:10\t0
10000005\t${hoy} 07:44:00\t0
10000001\t${hoy} 15:02:40\t1
10000002\t${hoy} 16:30:00\t1
10000003\t${hoy} 15:35:12\t1
10000004\t${hoy} 17:00:00\t1`;
    setTextoCrudo(ejemplo);
    setArchivoNombre("ejemplo_ngteco_export.dat");
    parsearTextoMarcas(ejemplo);
  };

  const handleImportar = async () => {
    if (registrosParseados.length === 0) {
      toast.error("No se detectaron marcas válidas para importar.");
      return;
    }

    try {
      setLoading(true);
      const res = await ImportarBiometrico(registrosParseados);
      setResumen(res);
      toast.success(`Se importaron ${res.registros_guardados || 0} marcas y se procesaron ${res.asistencias_procesadas || 0} registros de asistencia.`);
      if (onImportado) onImportado();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al procesar archivo biométrico");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Importar Marcas de Biométrico NGTeco
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Instrucciones rápidas */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0" />
            <span>Formatos admitidos: <strong>.DAT, .TXT, .CSV, .LOG</strong>. El sistema procesa marcas y horarios automáticamente.</span>
          </div>

          {/* Opciones de terminal y carga */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Terminal Biométrico
              </Label>
              <Input
                value={dispositivo}
                onChange={(e) => setDispositivo(e.target.value)}
                placeholder="Ej. NGTeco MB20 Planta El Alto"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Detección de Tipo
              </Label>
              <select
                value={tipoDefecto}
                onChange={(e) => {
                  setTipoDefecto(e.target.value);
                  parsearTextoMarcas(textoCrudo);
                }}
                className="mt-1 w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="AUTO">Detección Automática (Entrada / Salida por horario)</option>
                <option value="ENTRADA">Forzar todo como Entrada</option>
                <option value="SALIDA">Forzar todo como Salida</option>
              </select>
            </div>
          </div>

          {/* Dropzone o Selector de archivo */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <input
              type="file"
              id="fileBiometrico"
              accept=".dat,.txt,.csv,.log,.tsv"
              onChange={handleArchivoSeleccionado}
              className="hidden"
            />
            <label htmlFor="fileBiometrico" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="h-8 w-8 text-blue-500 mb-2" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {archivoNombre ? `Archivo: ${archivoNombre}` : "Haz clic para seleccionar el archivo exportado del USB"}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Formatos compatibles: .dat, .txt, .csv, .log (NGTeco, ZKTeco, BioTime)
              </span>
            </label>
          </div>

          {/* Pegar texto o ver ejemplo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                Contenido crudo o pegar directamente:
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCargarEjemplo}
                  className="h-6 text-[11px] px-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Cargar datos de ejemplo
                </Button>
                {textoCrudo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLimpiar}
                    className="h-6 text-[11px] px-2 text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
            <textarea
              rows={4}
              value={textoCrudo}
              onChange={handleTextoChange}
              placeholder="Pega aquí el contenido del archivo si no deseas subirlo..."
              className="w-full p-2.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Previsualización de marcas parseadas */}
          {registrosParseados.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {registrosParseados.length} registros listos para procesar
                </span>
                <span className="text-[11px] text-slate-500">Mostrando primeros 5</span>
              </div>
              <div className="max-h-40 overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 border-b border-slate-200 dark:border-slate-800 text-[11px]">
                      <th className="py-1.5 px-3">#</th>
                      <th className="py-1.5 px-3">ID / CI</th>
                      <th className="py-1.5 px-3">Fecha y Hora</th>
                      <th className="py-1.5 px-3">Tipo Marca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {registrosParseados.slice(0, 5).map((reg, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-1.5 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{reg.Identificador}</td>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{reg.FechaHora}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            reg.Tipo === "ENTRADA" 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" 
                              : reg.Tipo === "SALIDA"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {reg.Tipo}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado de la última importación */}
          {resumen && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ¡Importación completada con éxito!
              </p>
              <p className="text-emerald-700 dark:text-emerald-400">
                Marcaciones guardadas en BD: <strong>{resumen.registros_guardados || 0}</strong> | Asistencias diarias recalculadas: <strong>{resumen.asistencias_procesadas || 0}</strong>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onCerrar}
            disabled={loading}
            className="text-xs"
          >
            Cerrar
          </Button>

          <Button
            type="button"
            onClick={handleImportar}
            disabled={loading || registrosParseados.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando marcas...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4" />
                Procesar e Importar {registrosParseados.length > 0 && `(${registrosParseados.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
