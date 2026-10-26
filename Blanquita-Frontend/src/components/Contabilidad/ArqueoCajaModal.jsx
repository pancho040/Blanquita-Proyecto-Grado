import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Coins, Banknote, Calculator, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { CerrarCaja } from "@/services/Contabilidad/tesoreriaService";

const CORTES_BILLETES = [200, 100, 50, 20, 10];
const CORTES_MONEDAS = [5, 2, 1, 0.5, 0.2, 0.1];

export default function ArqueoCajaModal({ isOpen, onClose, cajaActual, onCajaCerrada }) {
  if (!isOpen) return null;
  const [cantidades, setCantidades] = useState({});
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Inicializar cortes en 0
  useEffect(() => {
    if (isOpen) {
      const inicial = {};
      [...CORTES_BILLETES, ...CORTES_MONEDAS].forEach((corte) => {
        inicial[corte] = 0;
      });
      setCantidades(inicial);
      setObservaciones("");
    }
  }, [isOpen]);

  const handleCantidadChange = (corte, valor) => {
    const num = parseInt(valor, 10);
    setCantidades((prev) => ({
      ...prev,
      [corte]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  // Calcular subtotales
  const subtotalBilletes = CORTES_BILLETES.reduce(
    (acc, corte) => acc + corte * (cantidades[corte] || 0),
    0
  );

  const subtotalMonedas = CORTES_MONEDAS.reduce(
    (acc, corte) => acc + corte * (cantidades[corte] || 0),
    0
  );

  const totalFisico = subtotalBilletes + subtotalMonedas;
  const saldoTeorico = cajaActual?.SaldoFinalTeorico ?? cajaActual?.SaldoInicial ?? 0;
  const diferencia = totalFisico - saldoTeorico;

  const handleConfirmarCierre = async () => {
    if (!cajaActual?.IdAperturaCierre) {
      toast.error("No se encontró una caja abierta para cerrar");
      return;
    }

    if (diferencia !== 0 && (!observaciones || observaciones.trim().length < 5)) {
      toast.warning("Existe una diferencia de arqueo. Debe ingresar una justificación detallada (mínimo 5 caracteres)");
      return;
    }

    try {
      setGuardando(true);
      const arqueoDetalle = [
        ...CORTES_BILLETES.map((corte) => ({
          tipo_corte: "Billete",
          denominacion: corte,
          cantidad: cantidades[corte] || 0,
        })),
        ...CORTES_MONEDAS.map((corte) => ({
          tipo_corte: "Moneda",
          denominacion: corte,
          cantidad: cantidades[corte] || 0,
        })),
      ];

      await CerrarCaja({
        id_apertura_cierre: cajaActual.IdAperturaCierre,
        saldo_final_real: totalFisico,
        observaciones_cierre: observaciones.trim() || "Cierre de jornada regular",
        autorizado_contador: true,
        justificativo_diferencia: observaciones.trim(),
        arqueo_detalle: arqueoDetalle,
      });

      toast.success("¡Caja cerrada y arqueo registrado exitosamente!");
      if (onCajaCerrada) onCajaCerrada();
      onClose();
    } catch (err) {
      toast.error(err.message || "Error al registrar el cierre de caja");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-slate-800">
            <Calculator className="h-6 w-6 text-[#20A7DB]" />
            Arqueo y Cierre de Caja
          </DialogTitle>
          <p className="text-xs text-slate-500">
            Conteo de billetes y monedas.
          </p>
        </DialogHeader>

        {/* Comparativa Teórica vs Real */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Saldo Teórico en Sistema
            </span>
            <span className="text-xl font-bold text-slate-700 mt-1">
              Bs. {saldoTeorico.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Físico Arqueado
            </span>
            <span className="text-xl font-bold text-[#20A7DB] mt-1">
              Bs. {totalFisico.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Diferencia de Caja
            </span>
            <div className="mt-1 flex items-center gap-2">
              {Math.abs(diferencia) < 0.01 ? (
                <Badge className="bg-emerald-600 text-white flex items-center gap-1 font-semibold text-sm px-2.5 py-0.5">
                  <CheckCircle2 className="h-4 w-4" /> Cuadrado (0.00)
                </Badge>
              ) : diferencia > 0 ? (
                <Badge className="bg-amber-500 text-white flex items-center gap-1 font-semibold text-sm px-2.5 py-0.5">
                  <AlertTriangle className="h-4 w-4" /> Sobrante +Bs. {diferencia.toFixed(2)}
                </Badge>
              ) : (
                <Badge className="bg-rose-600 text-white flex items-center gap-1 font-semibold text-sm px-2.5 py-0.5">
                  <XCircle className="h-4 w-4" /> Faltante -Bs. {Math.abs(diferencia).toFixed(2)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tablas de Cortes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {/* Billetes */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Banknote className="h-5 w-5 text-emerald-600" />
                <span>Billetes</span>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                Subtotal: Bs. {subtotalBilletes.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2.5">
              {CORTES_BILLETES.map((corte) => (
                <div key={corte} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-600 w-20">Bs. {corte}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-slate-400">×</span>
                    <Input
                      type="number"
                      min="0"
                      value={cantidades[corte] || ""}
                      onChange={(e) => handleCantidadChange(corte, e.target.value)}
                      placeholder="0"
                      className="h-8 text-center font-semibold"
                    />
                  </div>
                  <span className="w-24 text-right font-bold text-slate-700">
                    Bs. {((cantidades[corte] || 0) * corte).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monedas */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Coins className="h-5 w-5 text-amber-500" />
                <span>Monedas</span>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                Subtotal: Bs. {subtotalMonedas.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2.5">
              {CORTES_MONEDAS.map((corte) => (
                <div key={corte} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-600 w-20">Bs. {corte.toFixed(2)}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-slate-400">×</span>
                    <Input
                      type="number"
                      min="0"
                      value={cantidades[corte] || ""}
                      onChange={(e) => handleCantidadChange(corte, e.target.value)}
                      placeholder="0"
                      className="h-8 text-center font-semibold"
                    />
                  </div>
                  <span className="w-24 text-right font-bold text-slate-700">
                    Bs. {((cantidades[corte] || 0) * corte).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Observaciones y Justificación */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Observaciones y Justificación del Arqueo
            {diferencia !== 0 && (
              <span className="text-rose-600 ml-1 font-bold">
                (Obligatorio si existe diferencia)
              </span>
            )}
          </label>
          <Textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Detalle motivos de diferencias, billetes deteriorados o cualquier novedad al cierre..."
            className="text-sm"
          />
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarCierre}
            disabled={guardando}
            className="bg-[#20A7DB] hover:bg-[#1b8ebc] text-white"
          >
            {guardando ? "Cerrando Caja..." : "Confirmar Cierre y Arqueo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
