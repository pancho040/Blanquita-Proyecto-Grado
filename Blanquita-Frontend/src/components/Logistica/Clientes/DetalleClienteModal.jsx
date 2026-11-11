import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/common/StatusBadge";
import { toast } from "sonner";
import { ObtenerClienteDetalle, AgregarPuntoVenta } from "@/services/Logistica/ClienteService";
import { 
  Loader2, 
  Plus, 
  Store, 
  MapPin, 
  Phone, 
  ExternalLink,
  Navigation
} from "lucide-react";
import MapaSelectorUbicacion from "../Common/MapaSelectorUbicacion";

export default function DetalleClienteModal({ idCliente, abierto, onCerrar }) {
  if (!abierto || !idCliente) return null;
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrandoFormPV, setMostrandoFormPV] = useState(false);
  const [guardandoPV, setGuardandoPV] = useState(false);

  const [nuevoPV, setNuevoPV] = useState({
    NombrePuntoVenta: "",
    Direccion: "",
    Latitud: -19.0345,
    Longitud: -65.2530,
    Referencia: "",
  });

  const cargarDetalle = async () => {
    if (!idCliente) return;
    try {
      setLoading(true);
      const data = await ObtenerClienteDetalle(idCliente);
      setCliente(data);
    } catch (err) {
      toast.error(err.message || "Error al cargar información");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (abierto && idCliente) {
      cargarDetalle();
      setMostrandoFormPV(false);
    }
  }, [abierto, idCliente]);

  const handleCoordsChange = ({ lat, lng, referencia }) => {
    setNuevoPV((prev) => ({
      ...prev,
      Latitud: lat,
      Longitud: lng,
      Referencia: referencia ? referencia : prev.Referencia
    }));
  };

  const handleCrearPV = async (e) => {
    e.preventDefault();
    if (!nuevoPV.NombrePuntoVenta.trim() || !nuevoPV.Direccion.trim()) {
      toast.error("Nombre y dirección son obligatorios");
      return;
    }
    try {
      setGuardandoPV(true);
      await AgregarPuntoVenta(idCliente, {
        ...nuevoPV,
        Latitud: Number(nuevoPV.Latitud) || null,
        Longitud: Number(nuevoPV.Longitud) || null,
      });
      toast.success("Nueva sucursal agregada con éxito");
      setNuevoPV({
        NombrePuntoVenta: "",
        Direccion: "",
        Latitud: -19.0345,
        Longitud: -65.2530,
        Referencia: "",
      });
      setMostrandoFormPV(false);
      cargarDetalle();
    } catch (err) {
      toast.error(err.message || "Error al guardar sucursal");
    } finally {
      setGuardandoPV(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-200">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-5 w-5 text-[#1C96C5]" />
            <span>Ficha del Cliente & Puntos de Entrega</span>
          </DialogTitle>
        </DialogHeader>

        {loading || !cliente ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#1C96C5]" />
            <p className="text-xs text-slate-600 font-medium">Cargando ficha comercial del cliente...</p>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Cabecera Info con diseño de tarjetas industriales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                  Razón Social
                </span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{cliente.RazonSocial}</p>
                {cliente.NombreComercial && (
                  <p className="text-xs text-[#1C96C5] font-medium mt-0.5">"{cliente.NombreComercial}"</p>
                )}
              </div>

              <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                  NIT / Carnet
                </span>
                <p className="font-bold font-mono text-slate-900 text-sm mt-0.5">{cliente.NitCi}</p>
                <div className="mt-1">
                  <StatusBadge
                    estado={cliente.BloqueadoPorMora ? "MORA" : (cliente.NombreEstado || "ACTIVO")}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                  Contacto Telefónico
                </span>
                {cliente.Telefono ? (
                  <a
                    href={`https://wa.me/591${cliente.Telefono.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline text-xs mt-0.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{cliente.Telefono} (WhatsApp)</span>
                  </a>
                ) : (
                  <p className="text-xs text-slate-500 italic mt-0.5">No registrado</p>
                )}
                {cliente.CorreoElectronico && (
                  <p className="text-[11px] text-slate-600 truncate mt-0.5">{cliente.CorreoElectronico}</p>
                )}
              </div>

              <div className="p-3.5 rounded bg-sky-50 border border-sky-200">
                <span className="text-xs font-semibold text-sky-900 uppercase tracking-wider block">
                  Límite de Crédito
                </span>
                <p className="font-bold font-mono tabular-nums text-slate-900 text-base mt-0.5">
                  Bs. {Number(cliente.LimiteCreditoBs).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-sky-800">Plazo máximo: {cliente.DiasCredito} días</p>
              </div>

              <div className="p-3.5 rounded bg-slate-50 border border-slate-200 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                  Dirección Comercial Registrada
                </span>
                <p className="text-xs text-slate-900 font-medium mt-0.5">
                  {cliente.Direccion || "Sin dirección fija"}
                </p>
                {cliente.Observacion && (
                  <p className="text-[11px] text-slate-600 italic mt-1 border-t border-slate-200 pt-1">
                    Nota: {cliente.Observacion}
                  </p>
                )}
              </div>
            </div>

            {/* Puntos de venta / Tiendas */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-[#1C96C5]" />
                    <span>Puntos de Entrega & Sucursales ({cliente.PuntosVenta?.length || 0})</span>
                  </h4>
                  <p className="text-xs text-slate-600">
                    Destinos donde los repartidores pueden entregar pedidos de este cliente
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMostrandoFormPV(!mostrandoFormPV)}
                  className="gap-1.5 border-[#1C96C5] text-[#1C96C5] hover:bg-sky-50 font-medium rounded text-xs h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{mostrandoFormPV ? "Ocultar Formulario" : "Nueva Sucursal con Mapa"}</span>
                </Button>
              </div>

              {/* Formulario Nueva Sucursal con Mapa Selector de Sucre */}
              {mostrandoFormPV && (
                <form onSubmit={handleCrearPV} className="p-4 rounded border border-sky-300 bg-sky-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-sky-200 pb-2">
                    <p className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Navigation className="h-4 w-4 text-[#1C96C5]" />
                      <span>Registrar Nueva Sucursal / Tienda en Sucre</span>
                    </p>
                    <span className="text-[11px] text-sky-800 font-medium">Ubicación interactiva</span>
                  </div>

                  {/* MAPA LEAFLET EN EL MODAL */}
                  <MapaSelectorUbicacion
                    lat={nuevoPV.Latitud}
                    lng={nuevoPV.Longitud}
                    onChange={handleCoordsChange}
                    altura="h-60"
                    label="Haz clic en el mapa de Sucre para fijar la ubicación de la sucursal:"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs font-semibold text-slate-800">Nombre de la Sucursal / Tienda *</Label>
                      <Input
                        value={nuevoPV.NombrePuntoVenta}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, NombrePuntoVenta: e.target.value })}
                        placeholder="Ej. Sucursal Mercado Campesino"
                        required
                        className="bg-white border-slate-300 h-8 text-xs mt-1 rounded"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-800">Dirección Completa *</Label>
                      <Input
                        value={nuevoPV.Direccion}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, Direccion: e.target.value })}
                        placeholder="Ej. Calle Nataniel Aguirre #210"
                        required
                        className="bg-white border-slate-300 h-8 text-xs mt-1 rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-800">Referencia de Llegada para el Repartidor</Label>
                    <Input
                      value={nuevoPV.Referencia}
                      onChange={(e) => setNuevoPV({ ...nuevoPV, Referencia: e.target.value })}
                      placeholder="Ej. Puesto #45 sector embutidos frente a la entrada principal..."
                      className="bg-white border-slate-300 h-8 text-xs mt-1 rounded"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-sky-200">
                    <Button type="button" variant="outline" size="sm" onClick={() => setMostrandoFormPV(false)} className="rounded text-xs h-8">
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" className="bg-[#1C96C5] hover:bg-[#157A9E] text-white px-4 font-semibold rounded text-xs h-8" disabled={guardandoPV}>
                      {guardandoPV && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Guardar Sucursal
                    </Button>
                  </div>
                </form>
              )}

              {/* Listado de Sucursales */}
              <div className="space-y-2">
                {cliente.PuntosVenta?.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-300 rounded bg-slate-50">
                    <Store className="h-7 w-7 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-700 font-medium">No tiene puntos de entrega registrados</p>
                    <p className="text-[11px] text-slate-500">Agrega el primer punto de entrega con el botón "Nueva Sucursal".</p>
                  </div>
                ) : (
                  cliente.PuntosVenta.map((pv) => (
                    <div 
                      key={pv.IdPuntoVenta} 
                      className="p-3 rounded border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sky-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{pv.NombrePuntoVenta}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded text-sky-800 bg-sky-50 border border-sky-200 font-medium">
                            Activa
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-0.5">{pv.Direccion}</p>
                        {pv.Referencia && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">Ref: {pv.Referencia}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {pv.Latitud && pv.Longitud ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${pv.Latitud}&mlon=${pv.Longitud}#map=17/${pv.Latitud}/${pv.Longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-[#1C96C5] bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Abrir Mapa GPS</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Sin GPS</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
