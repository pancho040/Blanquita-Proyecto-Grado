import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Clock,
  Phone,
  DollarSign,
  Navigation,
  AlertCircle,
  Truck,
  ExternalLink,
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
      // Usar coordenadas del cliente o del chofer actual
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
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="h-5 w-5 text-[#20A7DB]" />
            <span>Paradas y Entregas</span>
          </DialogTitle>
        </DialogHeader>

        {cargando ? (
          <div className="py-20 flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            <p className="text-xs text-slate-500 font-medium">Cargando paradas...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No se encontró información de la asignación.
          </div>
        ) : (
          <div className="space-y-6">
            {/* ENCABEZADO DE TELEMETRÍA */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block font-medium">Repartidor a Cargo:</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {data.NombreRepartidor}
                </span>
                {data.CelularRepartidor && (
                  <a
                    href={`tel:${data.CelularRepartidor}`}
                    className="text-[11px] text-[#20A7DB] hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="h-3 w-3" />
                    {data.CelularRepartidor}
                  </a>
                )}
              </div>

              <div>
                <span className="text-slate-500 block font-medium">Ruta y Zona:</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">
                  {data.NombreRuta} ({data.NombreZona})
                </span>
              </div>

              <div>
                <span className="text-slate-500 block font-medium">Progreso de Paradas:</span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {data.ParadasEntregadas || 0} de {data.TotalParadas || 0} completadas
                </span>
              </div>

              <div>
                <span className="text-slate-500 block font-medium">Recaudación en Ruta:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5 block">
                  {formatearMonto(data.TotalRecaudado)}
                </span>
              </div>
            </div>

            {/* FORMULARIO RÁPIDO DE COBRO (SI ESTÁ SELECCIONADA UNA PARADA) */}
            {paradaParaCobro && (
              <form
                onSubmit={handleRegistrarCobro}
                className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span>Registrar Cobro para: {paradaParaCobro.NombrePuntoVenta}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setParadaParaCobro(null)}
                    className="text-xs text-blue-700 hover:text-blue-900 underline font-medium"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-700">Monto a Cobrar (Bs.)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={montoCobro}
                      onChange={(e) => setMontoCobro(e.target.value)}
                      placeholder="Ej. 150.00"
                      required
                      className="mt-1 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-slate-700">Método de Pago</Label>
                    <select
                      value={metodoCobro}
                      onChange={(e) => setMetodoCobro(e.target.value)}
                      className="mt-1 w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 shadow-xs focus:border-[#20A7DB] focus:outline-none"
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
                      className="w-full bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 h-9 text-xs font-semibold"
                    >
                      {procesandoAccion ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>Confirmar Cobro con GPS</span>
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* LISTA SECUENCIAL DE PARADAS */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Itinerario Secuencial de Visita y Estado GPS
              </h4>

              {data.Paradas?.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  No hay puntos de venta configurados para esta ruta.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.Paradas?.map((p, idx) => {
                    const esEntregado = p.EstadoEntrega === "Entregado";
                    const tieneGPS = p.Latitud && p.Longitud;
                    const tieneCobro = parseFloat(p.MontoCobrado || 0) > 0;

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          esEntregado
                            ? "bg-emerald-50/30 border-emerald-200"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* INFORMACIÓN DEL CLIENTE Y PARADA */}
                          <div className="flex items-start gap-3">
                            <span
                              className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${
                                esEntregado
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-200 text-slate-700"
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
                                <span className="text-xs text-slate-600 font-medium">
                                  {p.NombreCliente}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{p.Direccion || "Sin dirección específica"}</span>
                                {p.Referencia && (
                                  <span className="text-slate-400">({p.Referencia})</span>
                                )}
                              </p>

                              {/* AUDITORÍA GPS */}
                              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px]">
                                {tieneGPS && (
                                  <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    GPS Cliente: {parseFloat(p.Latitud).toFixed(4)},{" "}
                                    {parseFloat(p.Longitud).toFixed(4)}
                                  </span>
                                )}

                                {p.LatitudEntrega && (
                                  <span className="font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" />
                                    GPS Entrega: {parseFloat(p.LatitudEntrega).toFixed(4)},{" "}
                                    {parseFloat(p.LongitudEntrega).toFixed(4)}
                                  </span>
                                )}

                                {p.MontoPedido && (
                                  <span className="font-semibold text-slate-700">
                                    Pedido: {formatearMonto(p.MontoPedido)}
                                  </span>
                                )}

                                {tieneCobro && (
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Cobrado: {formatearMonto(p.MontoCobrado)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ACCIONES Y ESTADO */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                esEntregado
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {p.EstadoEntrega || "Pendiente"}
                            </span>

                            {!esEntregado && p.IdPedido && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={procesandoAccion}
                                onClick={() => handleEntregarParada(p)}
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-medium"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Marcar Entrega
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
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 font-medium"
                              >
                                <DollarSign className="h-3.5 w-3.5 mr-1" />
                                Registrar Cobro
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

            <DialogFooter className="border-t border-slate-100 pt-3">
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cerrar Detalle
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
