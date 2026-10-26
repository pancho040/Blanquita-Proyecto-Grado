import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ObtenerRutaDetalle } from "@/services/Logistica/RutaService";
import { Printer, FileText, Loader2, Truck, UserCheck, Calendar, MapPin, Phone } from "lucide-react";

export default function HojaDeRutaModal({ asignacion, abierto, onCerrar }) {
  if (!abierto || !asignacion) return null;
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function cargarDetalle() {
      if (!asignacion?.IdRutaDistribucion) return;
      try {
        setLoading(true);
        const detalle = await ObtenerRutaDetalle(asignacion.IdRutaDistribucion);
        setPuntos(detalle.PuntosVenta || []);
      } catch (err) {
        toast.error("Error al cargar paradas de la hoja de ruta");
      } finally {
        setLoading(false);
      }
    }

    if (abierto && asignacion) {
      cargarDetalle();
    }
  }, [abierto, asignacion]);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[95vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#20A7DB]" />
            <span>Hoja de Ruta</span>
          </DialogTitle>
          <Button
            type="button"
            onClick={handleImprimir}
            className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 h-8 text-xs font-semibold px-3.5 shadow-2xs"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir</span>
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            <p className="text-xs text-slate-500 font-medium">Cargando hoja de ruta...</p>
          </div>
        ) : (
          /* DOCUMENTO FORMAL IMPRIMIBLE */
          <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-6 text-slate-900 print:border-none print:p-0">
            {/* MEMBRETE CORPORATIVO */}
            <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                  Papelera Blanquita
                </h1>
                <p className="text-xs font-semibold text-slate-600 uppercase">
                  Shema Asociados S.R.L. • Logística y Distribución • Sucre, Bolivia
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Parque Industrial de Sucre
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  HOJA DE RUTA N°
                </span>
                <span className="font-mono text-lg font-black text-[#20A7DB]">
                  HR-{asignacion?.IdAsignacionRuta?.toString().padStart(5, "0")}
                </span>
                <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                  Fecha: {asignacion?.FechaAsignacion}
                </p>
              </div>
            </div>

            {/* METADATOS DEL DESPACHO */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-bold">Conductor / Chofer</span>
                <strong className="text-slate-900 font-semibold">{asignacion?.NombreRepartidor}</strong>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-bold">Ruta & Zona</span>
                <strong className="text-slate-900 font-semibold">{asignacion?.NombreRuta} ({asignacion?.NombreZona})</strong>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-bold">Odómetro Inicial</span>
                <strong className="font-mono text-slate-900">{asignacion?.KilometrajeInicial ? `${asignacion.KilometrajeInicial} km` : "Pendiente"}</strong>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[10px] font-bold">Odómetro Final</span>
                <strong className="font-mono text-slate-900">{asignacion?.KilometrajeFinal ? `${asignacion.KilometrajeFinal} km` : "____________"}</strong>
              </div>
            </div>

            {asignacion?.Observacion && (
              <div className="p-2.5 rounded bg-sky-50/50 border border-sky-100 text-xs">
                <span className="font-bold text-sky-900">Instrucciones Operativas:</span> {asignacion.Observacion}
              </div>
            )}

            {/* TABLA DE PARADAS / ENTREGAS */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Itinerario de Entrega & Firma de Conformidad ({puntos.length} clientes):
              </h3>

              <div className="overflow-x-auto border border-slate-300 rounded-lg">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 uppercase text-[11px] font-bold text-slate-700 border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5">Cliente / Tienda</th>
                      <th className="p-2.5">Dirección & Referencia</th>
                      <th className="p-2.5 text-center">Cobranza (Bs)</th>
                      <th className="p-2.5 text-center w-36">Firma / Sello Recepción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {puntos.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-slate-400 italic">
                          No hay paradas asociadas a esta ruta.
                        </td>
                      </tr>
                    ) : (
                      puntos.map((p, idx) => (
                        <tr key={p.IdPuntoVenta} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-bold text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="p-2.5">
                            <strong className="text-slate-900">{p.NombreCliente}</strong>
                            <p className="text-[11px] text-slate-500">{p.NombrePuntoVenta}</p>
                          </td>
                          <td className="p-2.5 text-slate-700">
                            <p>{p.Direccion}</p>
                            {p.Referencia && <p className="text-[10px] text-slate-500 italic">Ref: {p.Referencia}</p>}
                          </td>
                          <td className="p-2.5 text-center font-mono">
                            Bs. _________
                          </td>
                          <td className="p-2.5 text-center border-l border-slate-200">
                            <div className="h-8 border-b border-dashed border-slate-400"></div>
                            <span className="text-[9px] text-slate-400 uppercase">Firma de Recibido</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECCIÓN DE FIRMAS Y LIQUIDACIÓN */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 w-48 mx-auto font-semibold text-slate-800">
                  Firma del Conductor
                </div>
                <p className="text-[10px] text-slate-500">C.I. {asignacion?.NombreRepartidor}</p>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-400 pt-2 w-48 mx-auto font-semibold text-slate-800">
                  Supervisor de Logística
                </div>
                <p className="text-[10px] text-slate-500">Despacho y Control de Carga</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={handleImprimir}
            className="bg-[#20A7DB] hover:bg-[#188cba] text-white font-semibold"
          >
            Imprimir Planilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}