import React, { useState, useEffect } from "react";
import { QrCode, CheckCircle2, XCircle, Eye, Clock, Image as ImageIcon, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ObtenerAbonosPendientes, ResolverAbonoKevin } from "@/services/Contabilidad/cuentasCobrarService";

export default function AprobacionCobrosQR({ usuario }) {
  const [abonos, setAbonos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fotoModal, setFotoModal] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);

  useEffect(() => {
    cargarAbonos();
  }, []);

  const cargarAbonos = async () => {
    try {
      setCargando(true);
      const res = await ObtenerAbonosPendientes();
      setAbonos(res || []);
    } catch (err) {
      toast.error("Error al cargar abonos pendientes");
    } finally {
      setCargando(false);
    }
  };

  const handleResolver = async (idAbono, aprobado) => {
    try {
      setProcesandoId(idAbono);
      await ResolverAbonoKevin(idAbono, {
        aprobado,
        observacion: aprobado ? "Verificado en extracto bancario" : "Comprobante ilegible o no acreditado"
      });
      toast.success(aprobado ? "Abono aprobado y saldo actualizado" : "Abono rechazado");
      cargarAbonos();
    } catch (err) {
      toast.error("Error al procesar abono: " + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="bg-sky-600 text-white p-6 rounded-2xl shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6" /> Bandeja de Aprobación de Cobros QR y Transferencias
          </h1>
          <p className="text-xs text-sky-100 mt-1">Verificación contable de fotografías de comprobantes de pago de choferes</p>
        </div>
        <Badge className="bg-white/20 text-white border-0">{abonos.length} Pendientes</Badge>
      </div>

      {cargando ? (
        <div className="p-8 text-center text-slate-500">Cargando cobranzas pendientes...</div>
      ) : abonos.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-slate-500 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">No hay cobros QR pendientes de validación</p>
          <p className="text-xs text-slate-400 mt-1">Todos los abonos en calle se encuentran conciliados.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {abonos.map((abono) => (
            <div key={abono.IdAbonoCuentaCobrar} className="bg-white p-5 rounded-2xl border shadow-sm flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-base">{abono.ClienteNombre}</span>
                  <Badge variant="outline" className="text-xs text-sky-700 bg-sky-50 border-sky-200">
                    {abono.NumeroNotaVenta || `Cuenta #${abono.IdCuentaCobrar}`}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  Chofer: <span className="font-medium text-slate-700">{abono.ChoferNombre || "Luis Repartidor"}</span> • Ref: {abono.NumeroReferencia || "S/Ref"}
                </p>
                <p className="text-xs text-slate-400">
                  Saldo deudor actual: Bs. {Number(abono.SaldoPendiente || 0).toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Monto Cobrado</span>
                  <p className="text-lg font-bold text-emerald-600">Bs. {Number(abono.MontoAbonado).toFixed(2)}</p>
                </div>

                {abono.UrlComprobante ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFotoModal(abono.UrlComprobante)}
                    className="gap-1.5 text-xs text-sky-700 border-sky-300"
                  >
                    <ZoomIn className="w-4 h-4" /> Ver Foto
                  </Button>
                ) : (
                  <Badge variant="secondary" className="text-xs text-slate-400">Sin Foto</Badge>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={procesandoId === abono.IdAbonoCuentaCobrar}
                    onClick={() => handleResolver(abono.IdAbonoCuentaCobrar, true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={procesandoId === abono.IdAbonoCuentaCobrar}
                    onClick={() => handleResolver(abono.IdAbonoCuentaCobrar, false)}
                    className="text-xs gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Rechazar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Visor de Comprobante QR */}
      <Dialog open={!!fotoModal} onOpenChange={() => setFotoModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-sky-600" /> Comprobante de Transferencia / QR
            </DialogTitle>
          </DialogHeader>
          <div className="p-2 flex justify-center bg-slate-100 rounded-xl max-h-[70vh] overflow-auto">
            {fotoModal && (
              <img
                src={fotoModal}
                alt="Comprobante QR"
                className="max-w-full rounded-lg shadow-sm object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
