import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/common/StatusBadge";
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
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-300 bg-white print:border-none print:p-0">
        <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between print:hidden">
          <DialogTitle className="flex items-center gap-2 text-slate-900 text-base font-bold">
            <FileText className="h-5 w-5 text-[#1C96C5]" />
            <span>Informe de Cierre de Caja</span>
          </DialogTitle>
          <Button
            type="button"
            onClick={() => window.print()}
            className="bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-1.5 h-8 text-xs font-medium px-3 rounded border-0"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir</span>
          </Button>
        </DialogHeader>

        <div className="space-y-4 print:p-4 print:space-y-4">
          {/* MEMBRETE FORMAL */}
          <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-wider text-slate-900">
                Papelera Blanquita
              </h1>
              <p className="text-xs font-semibold text-slate-700 uppercase">
                Shema Asociados S.R.L. • Contabilidad y Tesorería
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Planta Parque Industrial Mz-4 • Resumen Diario de Tesorería para Gerencia
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                ARQUEO / CIERRE N°
              </span>
              <span className="text-base font-bold font-mono text-[#1C96C5]">
                {caja.NumeroArqueo || `CJ-${caja.IdAperturaCierreCaja || caja.IdCaja}`}
              </span>
              <span className="text-xs font-medium font-mono text-slate-700 block mt-0.5">
                {caja.FechaApertura ? new Date(caja.FechaApertura).toLocaleDateString("es-BO") : new Date().toLocaleDateString("es-BO")}
              </span>
            </div>
          </div>

          {/* DATOS DE LA JORNADA */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block font-medium">Responsable Turno:</span>
              <span className="font-bold text-slate-900 mt-0.5 block">
                {caja.NombreUsuarioApertura || "Cajero Central"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Estado de Caja:</span>
              <div className="mt-0.5">
                <StatusBadge
                  estado={caja.FechaCierre ? "COMPLETADO" : "PENDIENTE"}
                  label={caja.FechaCierre ? "Cerrada y Conciliada" : "Abierta en Operación"}
                />
              </div>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Hora de Apertura:</span>
              <span className="font-bold font-mono text-slate-900 mt-0.5 block">
                {caja.FechaApertura ? new Date(caja.FechaApertura).toLocaleTimeString("es-BO") : "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Hora de Cierre:</span>
              <span className="font-bold font-mono text-slate-900 mt-0.5 block">
                {caja.FechaCierre ? new Date(caja.FechaCierre).toLocaleTimeString("es-BO") : "En curso"}
              </span>
            </div>
          </div>

          {/* RESUMEN FINANCIERO */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide block">Saldo Inicial</span>
              <span className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1 block">
                {formatearMonto(saldoInicial)}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Fondo de apertura</span>
            </div>

            <div className="p-3 bg-[#F0FDF4] border border-[#86EFAC] rounded">
              <span className="text-[11px] font-semibold text-[#15803D] uppercase tracking-wide block">Total Ingresos</span>
              <span className="text-base font-bold font-mono tabular-nums text-[#15803D] mt-1 block">
                +{formatearMonto(totalIngresos)}
              </span>
              <span className="text-[11px] text-slate-600 mt-0.5 block">{ingresos.length} operaciones</span>
            </div>

            <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded">
              <span className="text-[11px] font-semibold text-[#B91C1C] uppercase tracking-wide block">Total Egresos</span>
              <span className="text-base font-bold font-mono tabular-nums text-[#B91C1C] mt-1 block">
                -{formatearMonto(totalEgresos)}
              </span>
              <span className="text-[11px] text-slate-600 mt-0.5 block">{egresos.length} egresos</span>
            </div>

            <div className="p-3 bg-[#F0F9FF] border border-[#BAE6FD] rounded">
              <span className="text-[11px] font-semibold text-[#0369A1] uppercase tracking-wide block">Saldo Neto en Caja</span>
              <span className="text-base font-bold font-mono tabular-nums text-[#0369A1] mt-1 block">
                {formatearMonto(saldoReal)}
              </span>
              <span className="text-[11px] text-slate-600 mt-0.5 block">Efectivo físico</span>
            </div>
          </div>

          {/* AUDITORÍA Y CONCILIACIÓN */}
          <div
            className={`p-3 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              Math.abs(diferencia) < 0.01
                ? "bg-[#F0FDF4] border-[#86EFAC] text-slate-800"
                : diferencia > 0
                ? "bg-[#FFFBEB] border-[#FDE68A] text-slate-800"
                : "bg-[#FEF2F2] border-[#FCA5A5] text-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {Math.abs(diferencia) < 0.01 ? (
                <CheckCircle2 className="h-4 w-4 text-[#15803D] shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-[#B45309] shrink-0" />
              )}
              <div>
                <span className="text-xs font-bold block">
                  {Math.abs(diferencia) < 0.01
                    ? "Cuadre Conforme (Saldo Físico coincide con Sistema al 100%)"
                    : diferencia > 0
                    ? `Sobrante Detectado: +${formatearMonto(diferencia)}`
                    : `Faltante de Caja: ${formatearMonto(diferencia)}`}
                </span>
                <span className="text-[11px] text-slate-600 block font-mono">
                  Saldo Teórico: {formatearMonto(saldoTeorico)} | Físico Recontado: {formatearMonto(saldoReal)}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] font-semibold text-slate-600 block uppercase">Diferencia:</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${
                Math.abs(diferencia) < 0.01
                  ? "text-[#15803D]"
                  : diferencia > 0
                  ? "text-[#B45309]"
                  : "text-[#B91C1C]"
              }`}>
                {diferencia >= 0 ? "+" : ""}
                {diferencia.toFixed(2)} Bs.
              </span>
            </div>
          </div>

          {/* FIRMAS FORMALES DE CIERRE */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs text-slate-700">
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-900">Cajero / Contador Responsable</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Elaboración y Arqueo Físico</p>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-900">Gerencia General / Auditoría</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Aprobación y Visto Bueno</p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-3 print:hidden">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Cerrar Informe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
