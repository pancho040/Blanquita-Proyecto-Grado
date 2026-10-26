import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Printer, CheckCircle2, AlertTriangle, Wallet, ArrowUpRight, ArrowDownLeft, Building2 } from "lucide-react";

export default function ResumenCajaModal({ isOpen, onClose, caja, movimientos = [] }) {
  if (!isOpen || !caja) return null;

  const ingresos = movimientos.filter((m) => m.TipoMovimiento === "Ingreso");
  const egresos = movimientos.filter((m) => m.TipoMovimiento === "Egreso");

  const totalIngresos = ingresos.reduce((sum, m) => sum + parseFloat(m.Monto || 0), 0);
  const totalEgresos = egresos.reduce((sum, m) => sum + parseFloat(m.Monto || 0), 0);
  const saldoInicial = parseFloat(caja.SaldoInicial || 0);
  const saldoTeorico = saldoInicial + totalIngresos - totalEgresos;
  const saldoReal = caja.SaldoReal !== null && caja.SaldoReal !== undefined ? parseFloat(caja.SaldoReal) : saldoTeorico;
  const diferencia = saldoReal - saldoTeorico;

  const formatearMonto = (val) =>
    new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(val || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg font-bold">
            <FileText className="h-5 w-5 text-[#20A7DB]" />
            <span>Informe de Cierre de Caja</span>
          </DialogTitle>
          <Button
            type="button"
            onClick={() => window.print()}
            className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 h-8 text-xs font-semibold px-3 shadow-2xs"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir</span>
          </Button>
        </DialogHeader>

        <div className="space-y-6 print:p-0">
          {/* MEMBRETE FORMAL */}
          <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                Papelera Blanquita
              </h1>
              <p className="text-xs font-semibold text-slate-600 uppercase">
                Shema Asociados S.R.L. • Contabilidad • Sucre, Bolivia
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Planta Parque Industrial Mz-4 • Resumen Diario de Tesorería para Gerencia
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                ARQUEO / CIERRE N°
              </span>
              <span className="font-mono text-lg font-black text-[#20A7DB]">
                {caja.NumeroArqueo || `CJ-${caja.IdAperturaCierreCaja || caja.IdCaja}`}
              </span>
              <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                {caja.FechaApertura ? new Date(caja.FechaApertura).toLocaleDateString("es-BO") : new Date().toLocaleDateString("es-BO")}
              </span>
            </div>
          </div>

          {/* DATOS DE LA JORNADA */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block font-medium">Responsable Turno:</span>
              <span className="font-bold text-slate-900 mt-0.5 block">
                {caja.NombreUsuarioApertura || "Cajero Central"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Estado de Caja:</span>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 mt-0.5">
                {caja.FechaCierre ? "Cerrada y Conciliada" : "Abierta en Operación"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Hora de Apertura:</span>
              <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                {caja.FechaApertura ? new Date(caja.FechaApertura).toLocaleTimeString("es-BO") : "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Hora de Cierre:</span>
              <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                {caja.FechaCierre ? new Date(caja.FechaCierre).toLocaleTimeString("es-BO") : "En curso"}
              </span>
            </div>
          </div>

          {/* RESUMEN FINANCIERO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
              <span className="text-xs font-medium text-slate-500 block">Saldo Inicial</span>
              <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
                {formatearMonto(saldoInicial)}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Fondo de apertura</span>
            </div>

            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <span className="text-xs font-semibold text-emerald-800 block">Total Ingresos</span>
              <span className="text-lg font-bold text-emerald-700 mt-1 block font-mono">
                +{formatearMonto(totalIngresos)}
              </span>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">{ingresos.length} operaciones</span>
            </div>

            <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl">
              <span className="text-xs font-semibold text-rose-800 block">Total Egresos</span>
              <span className="text-lg font-bold text-rose-700 mt-1 block font-mono">
                -{formatearMonto(totalEgresos)}
              </span>
              <span className="text-[11px] text-rose-600 mt-0.5 block">{egresos.length} egresos</span>
            </div>

            <div className="p-3.5 bg-sky-50/50 border border-sky-200 rounded-xl">
              <span className="text-xs font-semibold text-sky-800 block">Saldo Neto en Caja</span>
              <span className="text-lg font-black text-[#20A7DB] mt-1 block font-mono">
                {formatearMonto(saldoReal)}
              </span>
              <span className="text-[11px] text-sky-600 mt-0.5 block">Efectivo físico disponible</span>
            </div>
          </div>

          {/* AUDITORÍA Y CONCILIACIÓN */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              Math.abs(diferencia) < 0.01
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : diferencia > 0
                ? "bg-blue-50 border-blue-200 text-blue-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {Math.abs(diferencia) < 0.01 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="text-xs font-bold block">
                  {Math.abs(diferencia) < 0.01
                    ? "Cuadre Conforme (Saldo Físico coincide con Sistema al 100%)"
                    : diferencia > 0
                    ? `Sobrante Detectado: +${formatearMonto(diferencia)}`
                    : `Faltante de Caja: ${formatearMonto(diferencia)}`}
                </span>
                <span className="text-[11px] opacity-90 block">
                  Saldo Teórico del Sistema: {formatearMonto(saldoTeorico)} | Físico Recontado: {formatearMonto(saldoReal)}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] font-semibold block">Diferencia:</span>
              <span className="font-mono text-sm font-black">
                {diferencia >= 0 ? "+" : ""}
                {diferencia.toFixed(2)} Bs.
              </span>
            </div>
          </div>

          {/* FIRMAS FORMALES DE CIERRE */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-800">Cajero / Contador Responsable</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Elaboración y Arqueo Físico</p>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-800">Gerencia General / Auditoría</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Aprobación y Visto Bueno</p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={onClose}>
            Cerrar Informe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
