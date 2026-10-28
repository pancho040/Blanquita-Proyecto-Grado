import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ObtenerBoletaPago } from "@/services/RRHH/RRHHService";
import { 
  Printer, 
  FileText, 
  Building2, 
  Calendar, 
  User, 
  CheckCircle2, 
  Loader2,
  DollarSign
} from "lucide-react";

export default function BoletaPagoModal({ idDetallePlanilla, abierto, onCerrar }) {
  if (!abierto || !idDetallePlanilla) return null;
  const [boleta, setBoleta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const boletaRef = useRef(null);

  useEffect(() => {
    if (abierto && idDetallePlanilla) {
      cargarBoleta();
    } else {
      setBoleta(null);
    }
  }, [abierto, idDetallePlanilla]);

  const cargarBoleta = async () => {
    try {
      setCargando(true);
      const data = await ObtenerBoletaPago(idDetallePlanilla);
      setBoleta(data);
    } catch (err) {
      console.error(err);
      toast.error("Error al obtener datos de la boleta de pago");
      onCerrar();
    } finally {
      setCargando(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  if (!abierto) return null;

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Papeleta de Pago Individual
              </DialogTitle>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleImprimir}
            disabled={cargando || !boleta}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 h-8 flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir Boleta
          </Button>
        </DialogHeader>

        {cargando ? (
          <div className="py-16 text-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
            Generando boleta de pago...
          </div>
        ) : !boleta ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No se encontraron datos para esta boleta.
          </div>
        ) : (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1" ref={boletaRef}>
            {/* Boleta física lista para impresión con membrete formal */}
            <div className="p-6 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xs text-slate-800 dark:text-slate-200 text-xs print:m-0 print:p-4 print:border-black">
              {/* Membrete Empresa de Papel Blanquita */}
              <div className="border-b-2 border-slate-800 dark:border-slate-300 pb-3 mb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900 dark:text-white">
                    {boleta.Empresa || "EMPRESA DE PAPEL BLANQUITA (SHEMA ASOCIADOS S.R.L.)"}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    NIT: {boleta.NIT || "1028475024"} | Calle Regimiento Charcas N° 37, Sucre - Bolivia
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Rubro: Fabricación y Distribución de Productos de Papel
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-xs uppercase tracking-wider rounded">
                    BOLETA DE PAGO
                  </span>
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-1">
                    {boleta.Periodo || "Periodo Mensual"}
                  </p>
                </div>
              </div>

              {/* Datos del Trabajador */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-medium">Trabajador:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {boleta.Empleado?.NombreCompleto}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Cédula de Identidad:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {boleta.Empleado?.CI}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Cargo / Área:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {boleta.Empleado?.Cargo} ({boleta.Empleado?.Area})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Fecha Ingreso:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {boleta.Empleado?.FechaIngreso || "No registrada"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Días Trabajados:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {boleta.DiasTrabajados} días
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Cuenta Banco:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {boleta.Empleado?.CuentaBancaria ? `${boleta.Empleado?.Banco} - ${boleta.Empleado?.CuentaBancaria}` : "Efectivo / Cheque"}
                  </span>
                </div>
              </div>

              {/* Detalle de Ingresos vs Descuentos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Ingresos / Haberes */}
                <div className="border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
                  <div className="bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 border-b border-emerald-100 dark:border-emerald-900 font-bold text-emerald-800 dark:text-emerald-300 uppercase text-[11px] tracking-wider">
                    I. Ingresos y Haberes (Bs.)
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Haber Básico</td>
                        <td className="py-1.5 px-3 text-right font-medium">
                          {Number(boleta.Ingresos?.HaberBasico || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Bono de Antigüedad</td>
                        <td className="py-1.5 px-3 text-right font-medium">
                          {Number(boleta.Ingresos?.BonoAntiguedad || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                          Horas Extras ({boleta.Ingresos?.HorasExtrasCantidad || 0} hrs)
                        </td>
                        <td className="py-1.5 px-3 text-right font-medium">
                          {Number(boleta.Ingresos?.HorasExtrasMonto || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Otros Bonos y Recargos</td>
                        <td className="py-1.5 px-3 text-right font-medium">
                          {Number(boleta.Ingresos?.OtrosBonos || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-850 font-bold border-t border-slate-200 dark:border-slate-700">
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-100">TOTAL GANADO</td>
                        <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">
                          {Number(boleta.Ingresos?.TotalGanado || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Descuentos de Ley y Deducciones */}
                <div className="border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
                  <div className="bg-rose-50 dark:bg-rose-950/60 px-3 py-1.5 border-b border-rose-100 dark:border-rose-900 font-bold text-rose-800 dark:text-rose-300 uppercase text-[11px] tracking-wider">
                    II. Descuentos de Ley y Deducciones (Bs.)
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Aporte Gestora / AFP (12.71%)</td>
                        <td className="py-1.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          {Number(boleta.Descuentos?.GestoraAFP || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                          Descuento Atrasos ({boleta.Descuentos?.MinutosAtraso || 0} min)
                        </td>
                        <td className="py-1.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          {Number(boleta.Descuentos?.AtrasosMonto || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">
                          Descuento Faltas ({boleta.Descuentos?.FaltasCantidad || 0} días)
                        </td>
                        <td className="py-1.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          {Number(boleta.Descuentos?.FaltasMonto || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Anticipos de Sueldo / Préstamos</td>
                        <td className="py-1.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          {Number(boleta.Descuentos?.Anticipos || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 text-slate-600 dark:text-slate-300">Otros Descuentos</td>
                        <td className="py-1.5 px-3 text-right font-medium text-rose-600 dark:text-rose-400">
                          {Number(boleta.Descuentos?.OtrosDescuentos || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-850 font-bold border-t border-slate-200 dark:border-slate-700">
                        <td className="py-2 px-3 text-slate-800 dark:text-slate-100">TOTAL DESCUENTOS</td>
                        <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400">
                          {Number(boleta.Descuentos?.TotalDescuentos || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Líquido Pagable Resaltado y Literal en Palabras */}
              <div className="bg-slate-100 dark:bg-slate-850 p-4 rounded-lg border border-slate-300 dark:border-slate-700 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Líquido Pagable Neto:
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 italic">
                    Son: {boleta.TotalLiteral || "Cero 00/100 Bolivianos"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 ">
                    Bs. {Number(boleta.LiquidoPagable || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Casillas de Firma Formal */}
              <div className="pt-8 pb-4 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 dark:border-slate-600 pt-2 w-3/4 mx-auto font-semibold">
                    Empresa de Papel Blanquita (Shema Asociados S.R.L.)
                  </div>
                  <span className="text-[10px] text-slate-400">Empleador / Administración</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 dark:border-slate-600 pt-2 w-3/4 mx-auto font-semibold">
                    {boleta.Empleado?.NombreCompleto}
                  </div>
                  <span className="text-[10px] text-slate-400">Trabajador (Recibí Conforme)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCerrar}
            className="text-xs"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
