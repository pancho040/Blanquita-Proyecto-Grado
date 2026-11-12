import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/common/StatusBadge";
import { toast } from "sonner";
import { ObtenerLiquidacionRuta, CerrarYLiquidarRuta } from "@/services/Logistica/RutaService";
import {
  FileCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UserCheck,
  Calendar
} from "lucide-react";

export default function ModalLiquidacionRuta({ idAsignacion, abierto, onCerrar, onLiquidacionExitosa }) {
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [data, setData] = useState(null);

  // Formulario de arqueo y cierre
  const [efectivoEntregado, setEfectivoEntregado] = useState("");
  const [transfReportada, setTransfReportada] = useState("");
  const [qrReportado, setQrReportado] = useState("");
  const [kmFinal, setKmFinal] = useState("");
  const [observacion, setObservacion] = useState("");

  useEffect(() => {
    if (!abierto || !idAsignacion) {
      setData(null);
      return;
    }
    async function cargar() {
      try {
        setCargando(true);
        const res = await ObtenerLiquidacionRuta(idAsignacion);
        setData(res);

        // Prellenar con montos registrados
        setEfectivoEntregado(res.TotalCobradoEfectivo?.toFixed(2) || "0.00");
        setTransfReportada(res.TotalCobradoTransferenciaQr?.toFixed(2) || "0.00");
        setQrReportado("0.00");
        setKmFinal(res.Asignacion?.KilometrajeFinal?.toString() || "");
        setObservacion(res.Asignacion?.Observacion || "");
      } catch (err) {
        toast.error("Error al cargar la liquidación de la ruta");
        onCerrar();
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [abierto, idAsignacion]);

  // Cálculos de arqueo en tiempo real
  const efNum = parseFloat(efectivoEntregado) || 0;
  const trNum = parseFloat(transfReportada) || 0;
  const qrNum = parseFloat(qrReportado) || 0;
  const totalRendido = efNum + trNum + qrNum;
  const totalCobradoSistema = data ? parseFloat(data.TotalCobrado || 0) : 0;
  const diferencia = totalRendido - totalCobradoSistema;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!data?.Asignacion) return;

    try {
      setProcesando(true);
      await CerrarYLiquidarRuta(idAsignacion, {
        IdUsuarioRepartidor: data.Asignacion.IdUsuarioRepartidor,
        KilometrajeFinal: kmFinal ? parseFloat(kmFinal) : null,
        MontoTotalCobradoRuta: totalCobradoSistema,
        MontoEfectivoEntregado: efNum,
        MontoTransferenciaReportada: trNum,
        MontoQrReportado: qrNum,
        Diferencia: diferencia,
        Conciliada: Math.abs(diferencia) < 0.01,
        ObservacionLiquidacion: observacion
      });

      toast.success("Ruta cerrada y liquidación conciliada para caja exitosamente");
      if (onLiquidacionExitosa) onLiquidacionExitosa();
      onCerrar();
    } catch (err) {
      toast.error(err.message || "Error al registrar liquidación");
    } finally {
      setProcesando(false);
    }
  };

  const formatearMonto = (val) =>
    new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(val || 0);

  return (
    <Dialog open={Boolean(abierto && idAsignacion)} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-200">
        <DialogHeader className="border-b border-slate-200 pb-2.5">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-[#1C96C5]" />
            <span>Liquidación y Cierre Oficial de Ruta</span>
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-[#1C96C5]" />
            <p className="text-xs text-slate-600 font-medium">Consolidando cobranzas y telemetría de ruta...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-600 text-xs">
            No se pudo obtener información de la liquidación
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ENCABEZADO DE ASIGNACIÓN */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-600 block font-medium">Repartidor:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <UserCheck className="h-3.5 w-3.5 text-[#1C96C5]" />
                  {data.Asignacion?.NombreRepartidor}
                </span>
              </div>
              <div>
                <span className="text-slate-600 block font-medium">Ruta & Zona:</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {data.Asignacion?.NombreRuta} ({data.Asignacion?.NombreZona})
                </span>
              </div>
              <div>
                <span className="text-slate-600 block font-medium">Fecha:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5 font-mono">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  {data.Asignacion?.FechaAsignacion}
                </span>
              </div>
              <div>
                <span className="text-slate-600 block font-medium">Estado Asignación:</span>
                <div className="mt-0.5">
                  <StatusBadge estado={data.Asignacion?.Estado || "EN RUTA"} />
                </div>
              </div>
            </div>

            {/* TARJETAS RESUMEN FINANCIERO */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded">
                <span className="text-xs font-medium text-slate-600 block">Total Esperado</span>
                <span className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5 block">
                  {formatearMonto(data.TotalEsperado)}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {data.TotalPedidos} pedidos
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                <span className="text-xs font-semibold text-emerald-900 block">Cobrado en Efectivo</span>
                <span className="text-base font-bold font-mono tabular-nums text-emerald-800 mt-0.5 block">
                  {formatearMonto(data.TotalCobradoEfectivo)}
                </span>
                <span className="text-[11px] text-emerald-700 mt-0.5 block">Físico a caja</span>
              </div>

              <div className="p-3 bg-sky-50 border border-sky-200 rounded">
                <span className="text-xs font-semibold text-sky-900 block">Cobrado Digital / QR</span>
                <span className="text-base font-bold font-mono tabular-nums text-sky-800 mt-0.5 block">
                  {formatearMonto(data.TotalCobradoTransferenciaQr)}
                </span>
                <span className="text-[11px] text-sky-700 mt-0.5 block">Comprobante</span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <span className="text-xs font-semibold text-amber-900 block">Saldo Pendiente</span>
                <span className="text-base font-bold font-mono tabular-nums text-amber-800 mt-0.5 block">
                  {formatearMonto(data.SaldoPendiente)}
                </span>
                <span className="text-[11px] text-amber-700 mt-0.5 block">Por cobrar</span>
              </div>
            </div>

            {/* FORMULARIO DE RENDICIÓN PARA CAJA */}
            <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <Receipt className="h-4 w-4 text-[#1C96C5]" />
                <span>Arqueo y Rendición de Caja</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-800">Efectivo Físico Recibido (Bs.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={efectivoEntregado}
                    onChange={(e) => setEfectivoEntregado(e.target.value)}
                    required
                    className="mt-1 h-8 text-xs font-mono font-bold rounded"
                  />
                  <span className="text-[11px] text-slate-600 mt-0.5 block">Físico entregado por chofer</span>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-800">Transferencias Verificadas (Bs.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transfReportada}
                    onChange={(e) => setTransfReportada(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono rounded"
                  />
                  <span className="text-[11px] text-slate-600 mt-0.5 block">Verificado en banca</span>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-800">Monto QR Banco Unión (Bs.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={qrReportado}
                    onChange={(e) => setQrReportado(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono rounded"
                  />
                  <span className="text-[11px] text-slate-600 mt-0.5 block">Cobros con QR</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-xs font-semibold text-slate-800">Kilometraje Final del Camión</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Ej. 145230.5"
                    value={kmFinal}
                    onChange={(e) => setKmFinal(e.target.value)}
                    className="mt-1 h-8 text-xs font-mono rounded"
                  />
                  <span className="text-[11px] text-slate-600 mt-0.5 block">
                    Km Inicial: {data.Asignacion?.KilometrajeInicial || 0} km
                  </span>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-800">Observaciones del Cierre</Label>
                  <Input
                    type="text"
                    placeholder="Sin novedades en ruta, recaudación conforme..."
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    className="mt-1 h-8 text-xs rounded"
                  />
                </div>
              </div>

              {/* PANEL COMPARATIVO DE CONCILIACIÓN */}
              <div
                className={`p-3 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                  Math.abs(diferencia) < 0.01
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : diferencia > 0
                    ? "bg-blue-50 border-blue-300 text-blue-900"
                    : "bg-red-50 border-red-300 text-red-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  {Math.abs(diferencia) < 0.01 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-bold block">
                      {Math.abs(diferencia) < 0.01
                        ? "Conciliación Exacta (Cuadre 100% Conforme)"
                        : diferencia > 0
                        ? `Sobrante de Caja: +${formatearMonto(diferencia)}`
                        : `Faltante de Caja: ${formatearMonto(diferencia)}`}
                    </span>
                    <span className="text-[11px] opacity-90 block font-mono">
                      Total Sistema: {formatearMonto(totalCobradoSistema)} | Rendido:{" "}
                      {formatearMonto(totalRendido)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-semibold block">Diferencia:</span>
                  <span className="text-sm font-mono font-bold">
                    {diferencia >= 0 ? "+" : ""}
                    {diferencia.toFixed(2)} Bs.
                  </span>
                </div>
              </div>
            </div>

            {/* TABLA DETALLADA DE PEDIDOS ASOCIADOS */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5">
                Detalle de Pedidos Entregados y Cobrados en la Ruta
              </h4>
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase">
                    <tr>
                      <th className="py-2 px-3">N° Pedido</th>
                      <th className="py-2 px-3">Cliente / Punto de Venta</th>
                      <th className="py-2 px-3 text-right">Monto Pedido</th>
                      <th className="py-2 px-3 text-right">Efectivo</th>
                      <th className="py-2 px-3 text-right">Transf / QR</th>
                      <th className="py-2 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.DetallePedidos?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-4 text-center text-slate-500">
                          No hay pedidos asociados a esta ruta.
                        </td>
                      </tr>
                    ) : (
                      data.DetallePedidos?.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-medium text-slate-900">
                            {p.NumeroPedido || `PED-${p.IdPedido}`}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-900 block truncate max-w-[200px]">
                              {p.NombreCliente}
                            </span>
                            <span className="text-[11px] text-slate-600 block truncate max-w-[200px]">
                              {p.NombrePuntoVenta}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {formatearMonto(p.MontoTotal)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-800 font-medium">
                            {formatearMonto(p.CobradoEfectivo)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-sky-800 font-medium">
                            {formatearMonto(p.CobradoTransferenciaQr)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <StatusBadge estado="ENTREGADO" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-200 pt-2.5 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCerrar} disabled={procesando} className="rounded h-8 text-xs">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={procesando}
                size="sm"
                className="bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-1.5 font-semibold rounded h-8 text-xs"
              >
                {procesando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Cerrando Ruta...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3.5 w-3.5" />
                    <span>Confirmar Cierre y Liquidación Oficial</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
