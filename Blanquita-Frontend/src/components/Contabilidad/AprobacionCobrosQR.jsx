import React, { useState, useEffect } from "react";
import { QrCode, CheckCircle2, XCircle, Eye, Clock, Image as ImageIcon, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/common/StatusBadge";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ObtenerAbonosPendientes, ResolverAbonoKevin } from "@/services/Contabilidad/cuentasCobrarService";

export default function AprobacionCobrosQR({ usuario }) {
  const {
    sucursal,
    setSucursal,
    sucursales,
    cargando: cargandoSucursal,
    esMultisede,
  } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [abonos, setAbonos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fotoModal, setFotoModal] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);

  useEffect(() => {
    cargarAbonos();
  }, [sucursal]);

  const cargarAbonos = async () => {
    try {
      setCargando(true);
      const res = await ObtenerAbonosPendientes(sucursal);
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
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {/* Encabezado Operativo */}
      <PageHeader
        title="Bandeja de Aprobación de Cobros QR y Transferencias"
        subtitle="Verificación contable de comprobantes de pago reportados por choferes y repartidores"
        icon={QrCode}
        actions={
          <div className="flex items-center gap-3">
            {esMultisede && (
              <BranchFilter
                sucursal={sucursal}
                setSucursal={setSucursal}
                sucursales={sucursales}
                cargando={cargandoSucursal}
                permiteTodas={true}
              />
            )}
            <StatusBadge
              estado={abonos.length > 0 ? "PENDIENTE" : "COMPLETADO"}
              label={`${abonos.length} Pendiente${abonos.length === 1 ? "" : "s"}`}
            />
          </div>
        }
      />

      {cargando ? (
        <div className="bg-white border border-slate-200 rounded p-8 text-center text-xs text-slate-500 font-mono">
          Cargando cobranzas pendientes...
        </div>
      ) : abonos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-[#15803D] mx-auto mb-2 opacity-80" />
          <p className="text-sm font-semibold text-slate-800">No hay cobros QR pendientes de validación</p>
          <p className="text-xs text-slate-500 mt-1">Todos los abonos en calle se encuentran conciliados.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-x-auto">
          {abonos.map((abono) => (
            <div
              key={abono.IdAbonoCuentaCobrar}
              className="bg-white p-4 rounded border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">{abono.ClienteNombre}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1]">
                    {abono.NumeroNotaVenta || `Cuenta #${abono.IdCuentaCobrar}`}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Chofer: <span className="font-medium text-slate-800">{abono.ChoferNombre || "Repartidor Asignado"}</span>
                  <span className="mx-1.5 text-slate-300">|</span>
                  Ref: <span className="font-mono text-slate-700">{abono.NumeroReferencia || "S/Ref"}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Saldo deudor actual: <span className="font-mono tabular-nums font-medium text-slate-700">Bs. {Number(abono.SaldoPendiente || 0).toFixed(2)}</span>
                </p>
              </div>

              <div className="flex items-center gap-5 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 uppercase font-medium tracking-wide block">Monto Cobrado</span>
                  <p className="text-base font-bold text-[#15803D] font-mono tabular-nums">
                    Bs. {Number(abono.MontoAbonado).toFixed(2)}
                  </p>
                </div>

                {abono.UrlComprobante ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFotoModal(abono.UrlComprobante)}
                    className="h-8 gap-1.5 text-xs text-slate-700 border-slate-300 rounded hover:bg-slate-50"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-[#1C96C5]" /> Ver Foto
                  </Button>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-100 border-slate-200 text-slate-500">
                    Sin Foto
                  </span>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={procesandoId === abono.IdAbonoCuentaCobrar}
                    onClick={() => handleResolver(abono.IdAbonoCuentaCobrar, true)}
                    className="h-8 bg-[#15803D] hover:bg-green-800 text-white text-xs gap-1 rounded font-medium border-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={procesandoId === abono.IdAbonoCuentaCobrar}
                    onClick={() => handleResolver(abono.IdAbonoCuentaCobrar, false)}
                    className="h-8 bg-[#B91C1C] hover:bg-red-800 text-white text-xs gap-1 rounded font-medium border-0"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Visor de Comprobante QR */}
      <Dialog open={!!fotoModal} onOpenChange={() => setFotoModal(null)}>
        <DialogContent className="max-w-xl rounded border border-slate-300 bg-white p-4">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#1C96C5]" /> Comprobante de Transferencia / QR
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 p-2 flex justify-center bg-slate-50 border border-slate-200 rounded max-h-[70vh] overflow-auto">
            {fotoModal && (
              <img
                src={fotoModal}
                alt="Comprobante QR"
                className="max-w-full rounded border border-slate-200 object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
