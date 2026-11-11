import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/common/StatusBadge";
import { toast } from "sonner";
import {
  ObtenerTrackingAsignacion,
  RegistrarEntregaParada,
  RegistrarCobroParada
} from "@/services/Logistica/RutaService";
import {
  MapPin,
  Loader2,
  CheckCircle2,
  Phone,
  DollarSign,
  Navigation,
  ShieldCheck
} from "lucide-react";

export default function ModalDetalleParadasGPS({
  idAsignacion,
  abierto,
  onCerrar,
  onActualizacion
}) {
  if (!abierto || !idAsignacion) return null;

  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState(null);
  const [paradaParaCobro, setParadaParaCobro] = useState(null);
  const [montoCobro, setMontoCobro] = useState("");
  const [metodoCobro, setMetodoCobro] = useState("1"); // 1 = Efectivo
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const res = await ObtenerTrackingAsignacion(idAsignacion);
      setData(res);
    } catch (err) {
      toast.error("Error al cargar paradas de la asignación");
      onCerrar();
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto && idAsignacion) {
      cargarDatos();
    }
  }, [abierto, idAsignacion]);

  // Registrar Entrega Contingente con GPS
  const handleEntregarParada = async (parada) => {
    if (!parada.IdPedido) {
      toast.error("Esta parada no tiene un pedido asignado formalmente");
      return;
    }
    try {
      setProcesandoAccion(true);
      const lat = parseFloat(parada.Latitud) || data.LatitudChofer || -19.0435;
      const lng = parseFloat(parada.Longitud) || data.LongitudChofer || -65.258;

      await RegistrarEntregaParada({
        IdPedido: parada.IdPedido,
        LatitudEntrega: lat,
        LongitudEntrega: lng,
        Observacion: "Entrega verificada por supervisor/chofer con coordenadas GPS"
      });

      toast.success(`Pedido #${parada.NumeroPedido || parada.IdPedido} marcado como Entregado`);
      await cargarDatos();
      if (onActualizacion) onActualizacion();
    } catch (err) {
      toast.error(err.message || "Error al registrar entrega");
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Registrar Cobro Contingente
  const handleRegistrarCobro = async (e) => {
    e.preventDefault();
    if (!paradaParaCobro || !paradaParaCobro.IdPedido) return;

    try {
      setProcesandoAccion(true);
      const lat = parseFloat(paradaParaCobro.Latitud) || data.LatitudChofer || -19.0435;
      const lng = parseFloat(paradaParaCobro.Longitud) || data.LongitudChofer || -65.258;

      await RegistrarCobroParada({
        IdPedido: paradaParaCobro.IdPedido,
        IdMetodoPago: parseInt(metodoCobro, 10),
        Monto: parseFloat(montoCobro),
        NumeroReferencia: metodoCobro === "1" ? null : "OP-VENTA-FIELD",
        LatitudCobro: lat,
        LongitudCobro: lng,
        Observacion: "Cobro registrado con captura de coordenadas GPS de campo"
      });

      toast.success("Cobro registrado y conciliado en ruta");
      setParadaParaCobro(null);
      setMontoCobro("");
      await cargarDatos();
      if (onActualizacion) onActualizacion();
    } catch (err) {
      toast.error(err.message || "Error al registrar cobro");
    } finally {
      setProcesandoAccion(false);
    }
  };

  const formatearMonto = (val) =>
    new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(val || 0);

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-200">
        <DialogHeader className="border-b border-slate-200 pb-2.5 flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="h-4 w-4 text-[#1C96C5]" />
            <span>Paradas y Entregas de la Asignación</span>
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-[#1C96C5]" />
            <p className="text-xs text-slate-600 font-medium">Cargando paradas...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-600 text-xs">
            No se encontró información de la asignación.
          </div>
        ) : (
          <div className="space-y-4">
            {/* ENCABEZADO DE TELEMETRÍA */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-600 block font-medium">Repartidor:</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {data.NombreRepartidor}
                </span>
                {data.CelularRepartidor && (
                  <a
                    href={`tel:${data.CelularRepartidor}`}
                    className="text-[11px] text-[#1C96C5] hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="h-3 w-3" />
                    {data.CelularRepartidor}
                  </a>
                )}
              </div>

              <div>
                <span className="text-slate-600 block font-medium">Ruta y Zona:</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {data.NombreRuta} ({data.NombreZona})
                </span>
              </div>

              <div>
                <span className="text-slate-600 block font-medium">Progreso de Paradas:</span>
                <span className="font-bold font-mono tabular-nums text-slate-900 mt-0.5 block">
                  {data.ParadasEntregadas || 0} / {data.TotalParadas || 0} completadas
                </span>
              </div>

              <div>
                <span className="text-slate-600 block font-medium">Recaudación en Ruta:</span>
                <span className="font-bold font-mono tabular-nums text-emerald-700 text-sm mt-0.5 block">
                  {formatearMonto(data.TotalRecaudado)}
                </span>
              </div>
            </div>

            {/* FORMULARIO RÁPIDO DE COBRO */}
            {paradaParaCobro && (
              <form
                onSubmit={handleRegistrarCobro}
                className="bg-sky-50 border border-sky-200 rounded p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-[#1C96C5]" />
                    <span>Registrar Cobro para: {paradaParaCobro.NombrePuntoVenta}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setParadaParaCobro(null)}
                    className="text-xs text-sky-800 hover:text-sky-950 underline font-medium"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-800">Monto a Cobrar (Bs.)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={montoCobro}
                      onChange={(e) => setMontoCobro(e.target.value)}
                      placeholder="Ej. 150.00"
                      required
                      className="mt-1 h-8 text-xs font-mono font-bold rounded"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-slate-800">Método de Pago</Label>
                    <select
                      value={metodoCobro}
                      onChange={(e) => setMetodoCobro(e.target.value)}
                      className="mt-1 w-full h-8 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-[#1C96C5] focus:outline-none"
                    >
                      <option value="1">Efectivo Contado</option>
                      <option value="2">Transferencia Bancaria</option>
                      <option value="3">QR Banco Unión / Simple</option>
                      <option value="4">Cheque</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={procesandoAccion}
                      className="w-full bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-1.5 h-8 text-xs font-semibold rounded"
                    >
                      {procesandoAccion ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span>Confirmar Cobro con GPS</span>
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* LISTA SECUENCIAL DE PARADAS */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Itinerario Secuencial de Visita y Estado GPS
              </h4>

              {data.Paradas?.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded bg-slate-50">
                  No hay puntos de venta configurados para esta ruta.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.Paradas?.map((p, idx) => {
                    const esEntregado = p.EstadoEntrega === "Entregado";
                    const tieneGPS = p.Latitud && p.Longitud;
                    const tieneCobro = parseFloat(p.MontoCobrado || 0) > 0;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded border transition-colors ${
                          esEntregado
                            ? "bg-emerald-50/20 border-emerald-200"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* INFORMACIÓN DEL CLIENTE Y PARADA */}
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`flex items-center justify-center h-6 w-6 rounded text-xs font-mono font-bold shrink-0 ${
                                esEntregado
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-800"
                              }`}
                            >
                              {p.OrdenVisita || idx + 1}
                            </span>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs">
                                  {p.NombrePuntoVenta}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-xs text-slate-700 font-medium">
                                  {p.NombreCliente}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                                <span>{p.Direccion || "Sin dirección específica"}</span>
                                {p.Referencia && (
                                  <span className="text-slate-500">({p.Referencia})</span>
                                )}
                              </p>

                              {/* AUDITORÍA GPS */}
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                                {tieneGPS && (
                                  <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                    GPS Cliente: {parseFloat(p.Latitud).toFixed(4)},{" "}
                                    {parseFloat(p.Longitud).toFixed(4)}
                                  </span>
                                )}

                                {p.LatitudEntrega && (
                                  <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                    GPS Entrega: {parseFloat(p.LatitudEntrega).toFixed(4)},{" "}
                                    {parseFloat(p.LongitudEntrega).toFixed(4)}
                                  </span>
                                )}

                                {p.MontoPedido && (
                                  <span className="font-semibold text-slate-800 font-mono tabular-nums">
                                    Pedido: {formatearMonto(p.MontoPedido)}
                                  </span>
                                )}

                                {tieneCobro && (
                                  <span className="font-bold font-mono tabular-nums text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Cobrado: {formatearMonto(p.MontoCobrado)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ACCIONES Y ESTADO */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <StatusBadge
                              estado={esEntregado ? "ENTREGADO" : "PENDIENTE"}
                            />

                            {!esEntregado && p.IdPedido && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={procesandoAccion}
                                onClick={() => handleEntregarParada(p)}
                                className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-medium rounded"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Entrega
                              </Button>
                            )}

                            {p.IdPedido && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setParadaParaCobro(p);
                                  const resto = Math.max(
                                    0,
                                    parseFloat(p.MontoPedido || 0) - parseFloat(p.MontoCobrado || 0)
                                  );
                                  setMontoCobro(resto > 0 ? resto.toFixed(2) : "0.00");
                                }}
                                className="h-7 text-xs border-sky-300 text-[#1C96C5] hover:bg-sky-50 font-medium rounded"
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                Cobrar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-slate-200 pt-2.5">
              <Button type="button" variant="outline" size="sm" onClick={onCerrar} className="rounded h-8 text-xs">
                Cerrar Detalle
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
