import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ObtenerBoletaPago, ObtenerTodasLasBoletas } from "@/services/RRHH/RRHHService";
import { 
  Printer, 
  FileText, 
  Building2, 
  Calendar, 
  User, 
  CheckCircle2, 
  Loader2,
  DollarSign,
  Copy
} from "lucide-react";

/**
 * Subcomponente para renderizar una boleta individual oficial
 * idéntica a la plantilla de SHEMA ASOCIADOS S.R.L. en Excel.
 */
function BoletaFisica({ boleta, tipoCopia = "" }) {
  if (!boleta) return null;

  const emp = boleta.Empleado || {};
  const per = boleta.Periodo || {};
  const empLegal = boleta.Empresa || {};
  const tot = boleta.Totales || {};
  const esAsegurado = emp.EsAsegurado ?? true;

  // Normalización de Haberes
  let listaHaberes = boleta.Haberes || [];
  if (!listaHaberes.length && boleta.Ingresos) {
    listaHaberes = [
      { Concepto: "Haber Básico", Monto: boleta.Ingresos.HaberBasico },
      { Concepto: "Bono de Antigüedad", Monto: boleta.Ingresos.BonoAntiguedad },
      { Concepto: `Horas Extras (${boleta.Ingresos.HorasExtrasCantidad || 0} hrs)`, Monto: boleta.Ingresos.HorasExtrasMonto },
      { Concepto: "Otros Bonos y Recargos", Monto: boleta.Ingresos.OtrosBonos },
    ].filter(h => Number(h.Monto || 0) > 0);
  }

  // Normalización de Descuentos
  let listaDescuentos = boleta.Descuentos || [];
  if (!Array.isArray(listaDescuentos) && typeof listaDescuentos === "object") {
    const dObj = listaDescuentos;
    listaDescuentos = [
      { Concepto: "Aporte Gestora / AFP (12.71%)", Monto: dObj.GestoraAFP },
      { Concepto: `Descuento Atrasos (${dObj.MinutosAtraso || 0} min)`, Monto: dObj.AtrasosMonto },
      { Concepto: `Descuento Faltas (${dObj.FaltasCantidad || 0} días)`, Monto: dObj.FaltasMonto },
      { Concepto: "Anticipos de Sueldo", Monto: dObj.Anticipos },
      { Concepto: "Otros Descuentos", Monto: dObj.OtrosDescuentos },
    ].filter(d => Number(d.Monto || 0) > 0);
  }

  const totalGanado = Number(tot.TotalGanado ?? boleta.Ingresos?.TotalGanado ?? 0);
  const totalDescuentos = Number(tot.TotalDescuento ?? boleta.Descuentos?.TotalDescuentos ?? 0);
  const liquidoPagable = Number(tot.LiquidoPagable ?? boleta.LiquidoPagable ?? 0);
  const literal = tot.LiquidoPagableLiteral || boleta.TotalLiteral || "Cero 00/100 Bolivianos";

  return (
    <div className="p-5 sm:p-6 bg-white border border-slate-300 rounded text-slate-900 text-xs print:border-black print:p-4 print:m-0 print:break-after-page shadow-xs">
      {/* Encabezado con Logotipo Oficial y Datos de Empresa */}
      <div className="border-b-2 border-slate-900 pb-3 mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <img 
            src="/Logos/logo-shema.png" 
            alt="Logo SHEMA ASOCIADOS" 
            className="h-12 w-auto object-contain"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-slate-950 leading-tight">
              {empLegal.RazonSocial || "SHEMA ASOCIADOS S.R.L."}
            </h2>
            <p className="text-[10px] text-slate-700 font-medium">
              DE: {empLegal.De || "OSVALDO TÉLLEZ UGARTE"}
            </p>
            <p className="text-[10px] text-slate-600 font-mono">
              NIT: {empLegal.Nit || "335142029"} &nbsp;|&nbsp; N° EMPLEADOR: {empLegal.NroPatronal || "060-210-348"}
            </p>
            <p className="text-[10px] text-slate-500">
              {empLegal.Direccion || "Zona Lajastambo, Barrio Villa Tunari S/N"} &bull; Sucre - Bolivia &bull; Tel: {empLegal.Telefono || "64-55355"}
            </p>
          </div>
        </div>

        <div className="text-right sm:self-center shrink-0">
          <span className="inline-block px-3 py-1 bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider rounded">
            BOLETA DE PAGO
          </span>
          <div className="mt-1">
            <span className="text-[11px] font-bold text-slate-800">
              {per.NombrePeriodo || `Periodo ${per.Mes || ""}/${per.Anio || ""}`}
            </span>
            <span className={`block text-[10px] font-semibold mt-0.5 px-2 py-0.5 rounded border ${
              esAsegurado ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {esAsegurado ? "P. ASEGURADO (12.71% LEY)" : "P. EXTERNO (0% AFP)"}
            </span>
          </div>
          {tipoCopia && (
            <span className="text-[9px] text-slate-400 uppercase tracking-widest block mt-0.5">
              [{tipoCopia}]
            </span>
          )}
        </div>
      </div>

      {/* Ficha de Datos del Trabajador */}
      <div className="bg-slate-50 p-2.5 rounded border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px]">
        <div>
          <span className="text-slate-500 block font-medium text-[10px]">Trabajador:</span>
          <span className="font-bold text-slate-900">
            {emp.NombreEmpleado || emp.NombreCompleto || "Sin nombre"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block font-medium text-[10px]">Cédula de Identidad:</span>
          <span className="font-semibold text-slate-900 font-mono">
            {emp.Ci || emp.CI || "—"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block font-medium text-[10px]">Cargo / Área:</span>
          <span className="font-semibold text-slate-900">
            {emp.Cargo || "Operador"} ({emp.Area || "Planta"})
          </span>
        </div>
        <div>
          <span className="text-slate-500 block font-medium text-[10px]">Fecha de Ingreso:</span>
          <span className="font-semibold text-slate-900">
            {emp.FechaIngreso || "No registrada"}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block font-medium text-[10px]">Días Trabajados:</span>
          <span className="font-semibold text-slate-900">
            {emp.DiasTrabajados ?? boleta.DiasTrabajados ?? 30} días
          </span>
        </div>
        <div className="col-span-1 sm:col-span-3">
          <span className="text-slate-500 block font-medium text-[10px]">Forma de Pago / Cuenta Bancaria:</span>
          <span className="font-semibold text-slate-900">
            {emp.CuentaBancaria && emp.CuentaBancaria !== "Sin registrar"
              ? `${emp.Banco || "Banco"} — Cta: ${emp.CuentaBancaria}`
              : "Pago en Efectivo / Cheque por Ventanilla"}
          </span>
        </div>
      </div>

      {/* Columnas Paralelas: Haberes vs Descuentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* I. Ingresos y Haberes */}
        <div className="border border-slate-300 rounded overflow-hidden">
          <div className="bg-emerald-50 px-3 py-1 border-b border-emerald-200 font-bold text-emerald-900 uppercase text-[10px] tracking-wider flex justify-between items-center">
            <span>I. Remuneraciones / Haberes</span>
            <span>Importe Bs.</span>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {listaHaberes.map((h, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-1 px-3 text-slate-700">{h.Concepto}</td>
                  <td className="py-1 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                    {Number(h.Monto || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {listaHaberes.length === 0 && (
                <tr>
                  <td colSpan="2" className="py-2 text-center text-slate-400 italic">Sin ingresos registrados</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-100/60 font-bold border-t border-emerald-300">
                <td className="py-1.5 px-3 text-emerald-950 uppercase text-[11px]">TOTAL GANADO</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-emerald-950 font-bold">
                  {totalGanado.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* II. Descuentos y Retenciones */}
        <div className="border border-slate-300 rounded overflow-hidden">
          <div className="bg-rose-50 px-3 py-1 border-b border-rose-200 font-bold text-rose-900 uppercase text-[10px] tracking-wider flex justify-between items-center">
            <span>II. Deducciones / Descuentos</span>
            <span>Importe Bs.</span>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {listaDescuentos.map((d, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-1 px-3 text-slate-700">{d.Concepto}</td>
                  <td className="py-1 px-3 text-right font-mono tabular-nums font-medium text-rose-700">
                    {Number(d.Monto || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {listaDescuentos.length === 0 && (
                <tr>
                  <td colSpan="2" className="py-2 text-center text-slate-400 italic">Sin descuentos aplicados</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-rose-100/60 font-bold border-t border-rose-300">
                <td className="py-1.5 px-3 text-rose-950 uppercase text-[11px]">TOTAL DESCUENTOS</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-rose-950 font-bold">
                  {totalDescuentos.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cuadro Resaltado: Líquido Pagable */}
      <div className="bg-slate-100 p-3 rounded border border-slate-300 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
            Líquido Pagable Neto a Percibir:
          </span>
          <span className="text-[11px] text-slate-800 font-medium italic">
            Son: {literal}
          </span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xl font-black font-mono tabular-nums text-slate-950">
            Bs. {liquidoPagable.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Bloque de Firmas Institucionales */}
      <div className="pt-6 pb-2 grid grid-cols-2 gap-8 text-center text-xs">
        <div>
          <div className="border-t border-slate-500 pt-1.5 w-4/5 mx-auto font-bold text-slate-900">
            Por la Empresa
          </div>
          <span className="text-[10px] text-slate-500">Sello y Firma del Empleador</span>
        </div>
        <div>
          <div className="border-t border-slate-500 pt-1.5 w-4/5 mx-auto font-bold text-slate-900">
            {emp.NombreEmpleado || emp.NombreCompleto || "Trabajador"}
          </div>
          <span className="text-[10px] text-slate-500">Recibí Conforme (Firma y CI)</span>
        </div>
      </div>
    </div>
  );
}

export default function BoletaPagoModal({ 
  idDetallePlanilla = null, 
  idPlanilla = null, 
  modoBatch = false, 
  abierto, 
  onCerrar 
}) {
  if (!abierto) return null;

  const [boleta, setBoleta] = useState(null);
  const [listaBoletas, setListaBoletas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const boletaRef = useRef(null);

  useEffect(() => {
    if (abierto) {
      if (modoBatch && idPlanilla) {
        cargarTodasLasBoletas();
      } else if (idDetallePlanilla) {
        cargarBoletaIndividual();
      }
    } else {
      setBoleta(null);
      setListaBoletas([]);
    }
  }, [abierto, idDetallePlanilla, idPlanilla, modoBatch]);

  const cargarBoletaIndividual = async () => {
    try {
      setCargando(true);
      const data = await ObtenerBoletaPago(idDetallePlanilla);
      setBoleta(data);
    } catch (err) {
      console.error(err);
      toast.error("Error al obtener la boleta de pago");
      onCerrar();
    } finally {
      setCargando(false);
    }
  };

  const cargarTodasLasBoletas = async () => {
    try {
      setCargando(true);
      const data = await ObtenerTodasLasBoletas(idPlanilla);
      setListaBoletas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Error al generar las boletas del periodo");
      onCerrar();
    } finally {
      setCargando(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-white border border-slate-300 shadow-xl rounded">
        {/* Cabecera del modal */}
        <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded border border-slate-200 text-slate-800">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {modoBatch ? "Boletas de Pago del Periodo (Impresión Masiva)" : "Boleta Oficial de Pago"}
              </DialogTitle>
              <p className="text-[11px] text-slate-500">
                {modoBatch 
                  ? `Se generaron ${listaBoletas.length} boletas listas para entrega` 
                  : "Formato oficial para entrega al personal y archivo de RRHH"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleImprimir}
              disabled={cargando || (!boleta && !listaBoletas.length)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3.5 h-8 rounded flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir {modoBatch ? `(${listaBoletas.length})` : "Boleta"}
            </Button>
          </div>
        </DialogHeader>

        {cargando ? (
          <div className="py-20 text-center text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-emerald-600" />
            <span className="text-xs font-medium">Generando boletas oficiales con formato institucional...</span>
          </div>
        ) : modoBatch ? (
          /* Modo masivo: Muestra todas las boletas una tras otra */
          <div className="space-y-6 print:space-y-0" ref={boletaRef}>
            {listaBoletas.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No hay empleados registrados en esta planilla.
              </div>
            ) : (
              listaBoletas.map((b, idx) => (
                <div key={idx} className="print:page-break-after">
                  <BoletaFisica boleta={b} tipoCopia="ORIGINAL TRABAJADOR" />
                  <div className="my-4 border-t-2 border-dashed border-slate-300 print:my-6" />
                  <BoletaFisica boleta={b} tipoCopia="COPIA ARCHIVO EMPRESA" />
                </div>
              ))
            )}
          </div>
        ) : boleta ? (
          /* Modo individual: 2 copias por hoja (Original Trabajador y Copia Empresa) */
          <div className="space-y-4" ref={boletaRef}>
            <BoletaFisica boleta={boleta} tipoCopia="ORIGINAL TRABAJADOR" />
            <div className="my-4 border-t-2 border-dashed border-slate-300 print:my-6" />
            <BoletaFisica boleta={boleta} tipoCopia="COPIA ARCHIVO EMPRESA" />
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            No se encontraron datos para esta boleta.
          </div>
        )}

        <DialogFooter className="border-t border-slate-200 pt-3 print:hidden">
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
