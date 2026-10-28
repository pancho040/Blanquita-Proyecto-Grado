import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ObtenerLiquidacionRuta, CerrarYLiquidarRuta } from "@/services/Logistica/RutaService";
import {
  FileCheck,
  Loader2,
  DollarSign,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UserCheck,
  Calendar,
  Layers
} from "lucide-react";

export default function ModalLiquidacionRuta({ idAsignacion, abierto, onCerrar, onLiquidacionExitosa }) {
  if (!abierto || !idAsignacion) return null;

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [data, setData] = useState(null);

  // Formulario de arqueo y cierre
  const [efectivoEntregado, setEfectivoEntregado] = useState("");
  const [transfReportada, setTransfReportada] = useState("");
  const [qrReportado, setQrReportado] = useState("");
  const [kmFinal, setKmFinal] = useState("");
  const [observacion, setObservacion] = useState("");

  useEffect(() => {
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

    if (abierto && idAsignacion) {
      cargar();
    }
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
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-[#20A7DB]" />
            <span>Liquidación y Cierre de Ruta</span>
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            <p className="text-xs text-slate-500 font-medium">Consolidando cobranzas y telemetría de ruta...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No se pudo obtener información de la liquidación
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ENCABEZADO DE ASIGNACIÓN */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block font-medium">Repartidor:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <UserCheck className="h-3.5 w-3.5 text-[#20A7DB]" />
                  {data.Asignacion?.NombreRepartidor}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Ruta & Zona:</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {data.Asignacion?.NombreRuta} ({data.Asignacion?.NombreZona})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Fecha:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {data.Asignacion?.FechaAsignacion}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-medium">Estado Asignación:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 mt-0.5">
                  {data.Asignacion?.Estado}
                </span>
              </div>
            </div>

            {/* TARJETAS RESUMEN FINANCIERO */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-xs font-medium text-slate-500 block">Total Esperado</span>
                <span className="text-lg font-bold text-slate-900 mt-1 block">
                  {formatearMonto(data.TotalEsperado)}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  {data.TotalPedidos} pedidos asignados
                </span>
              </div>

              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                <span className="text-xs font-semibold text-emerald-800 block">Cobrado en Efectivo</span>
                <span className="text-lg font-bold text-emerald-700 mt-1 block">
                  {formatearMonto(data.TotalCobradoEfectivo)}
                </span>
                <span className="text-[11px] text-emerald-600 mt-0.5 block">A entregar en ventanilla</span>
              </div>

              <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl">
                <span className="text-xs font-semibold text-blue-800 block">Cobrado Transferencias/QR</span>
                <span className="text-lg font-bold text-blue-700 mt-1 block">
                  {formatearMonto(data.TotalCobradoTransferenciaQr)}
                </span>
                <span className="text-[11px] text-blue-600 mt-0.5 block">Comprobante digital</span>
              </div>

              <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl">
                <span className="text-xs font-semibold text-amber-800 block">Saldo por Cobrar</span>
                <span className="text-lg font-bold text-amber-700 mt-1 block">
                  {formatearMonto(data.SaldoPendiente)}
                </span>
                <span className="text-[11px] text-amber-600 mt-0.5 block">Crédito o pendiente</span>
              </div>
            </div>

            {/* FORMULARIO DE RENDICIÓN PARA CAJA */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#20A7DB]" />
                <span>Arqueo y Rendición de Caja</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Efectivo Físico Recibido (Bs.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={efectivoEntregado}
                    onChange={(e) => setEfectivoEntregado(e.target.value)}
                    required
                    className="mt-1 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Registrado por chofer en campo</span>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700">Monto Transferencias Verificado (Bs.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transfReportada}
                    onChange={(e) => setTransfReportada(e.target.value)}
                    className="mt-1 "
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Verificado en banca móvil</span>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700">Monto QR Banco Unión / Otros (Bs.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={qrReportado}
                    onChange={(e) => setQrReportado(e.target.value)}
                    className="mt-1 "
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Cobros con QR instantáneo</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Kilometraje Final del Camión</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Ej. 145230.5"
                    value={kmFinal}
                    onChange={(e) => setKmFinal(e.target.value)}
                    className="mt-1 "
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Km Inicial: {data.Asignacion?.KilometrajeInicial || 0} km
                  </span>
                </div>

                <div>
                  <Label className="text-xs font-medium text-slate-700">Observaciones del Cierre</Label>
                  <Input
                    type="text"
                    placeholder="Sin novedades en ruta, recaudación conforme..."
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* PANEL COMPARATIVO DE CONCILIACIÓN */}
              <div
                className={`p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
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
                        ? "Conciliación Exacta (Cuadre 100% Conforme)"
                        : diferencia > 0
                        ? `Sobrante de Caja: +${formatearMonto(diferencia)}`
                        : `Faltante de Caja: ${formatearMonto(diferencia)}`}
                    </span>
                    <span className="text-[11px] opacity-90 block">
                      Total Cobrado en Sistema: {formatearMonto(totalCobradoSistema)} | Rendido Físico:{" "}
                      {formatearMonto(totalRendido)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-semibold block">Diferencia:</span>
                  <span className="text-sm font-black">
                    {diferencia >= 0 ? "+" : ""}
                    {diferencia.toFixed(2)} Bs.
                  </span>
                </div>
              </div>
            </div>

            {/* TABLA DETALLADA DE PEDIDOS ASOCIADOS */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Detalle de Pedidos Entregados y Cobrados en la Ruta
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">N° Pedido</th>
                      <th className="py-2.5 px-3">Cliente / Punto de Venta</th>
                      <th className="py-2.5 px-3 text-right">Monto Pedido</th>
                      <th className="py-2.5 px-3 text-right">Efectivo</th>
                      <th className="py-2.5 px-3 text-right">Transf / QR</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.DetallePedidos?.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-4 text-center text-slate-400">
                          No hay pedidos asociados a esta ruta.
                        </td>
                      </tr>
                    ) : (
                      data.DetallePedidos?.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {p.NumeroPedido || `PED-${p.IdPedido}`}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-800 block truncate max-w-[200px]">
                              {p.NombreCliente}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                              {p.NombrePuntoVenta}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {formatearMonto(p.MontoTotal)}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                            {formatearMonto(p.CobradoEfectivo)}
                          </td>
                          <td className="py-2 px-3 text-right text-blue-700 font-medium">
                            {formatearMonto(p.CobradoTransferenciaQr)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Entregado
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 pt-3 gap-2">
              <Button type="button" variant="outline" onClick={onCerrar} disabled={procesando}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={procesando}
                className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 font-semibold shadow-2xs"
              >
                {procesando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Cerrando Ruta...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="h-4 w-4" />
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
