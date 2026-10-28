import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-xl font-bold text-[#20A7DB] flex items-center gap-2">
            <Store className="h-6 w-6 text-[#20A7DB]" />
            <span>Ficha del Cliente & Puntos de Entrega</span>
          </DialogTitle>
        </DialogHeader>

        {loading || !cliente ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <Loader2 className="h-9 w-9 animate-spin text-[#20A7DB]" />
            <p className="text-xs text-slate-500 font-medium">Cargando ficha comercial del cliente...</p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Cabecera Info con diseño de tarjetas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Razón Social
                </span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{cliente.RazonSocial}</p>
                {cliente.NombreComercial && (
                  <p className="text-xs text-[#20A7DB] font-medium mt-0.5">"{cliente.NombreComercial}"</p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  NIT / Carnet
                </span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{cliente.NitCi}</p>
                <div className="mt-1">
                  <Badge className={cliente.BloqueadoPorMora ? "bg-red-500 text-white text-[11px]" : "bg-emerald-500 text-white text-[11px]"}>
                    {cliente.BloqueadoPorMora ? "Bloqueado por Mora" : cliente.NombreEstado || "Activo"}
                  </Badge>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Contacto Telefónico
                </span>
                {cliente.Telefono ? (
                  <a
                    href={`https://wa.me/591${cliente.Telefono.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:underline text-sm mt-0.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{cliente.Telefono} (WhatsApp)</span>
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 italic mt-0.5">No registrado</p>
                )}
                {cliente.CorreoElectronico && (
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{cliente.CorreoElectronico}</p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-100">
                <span className="text-[11px] font-semibold text-sky-800 uppercase tracking-wider block">
                  Límite de Crédito
                </span>
                <p className="font-bold text-sky-950 text-base mt-0.5">
                  Bs. {Number(cliente.LimiteCreditoBs).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-sky-700">Plazo: {cliente.DiasCredito} días máximos</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Dirección Comercial Registrada
                </span>
                <p className="text-xs text-slate-800 font-medium mt-0.5">
                  {cliente.Direccion || "Sin dirección fija"}
                </p>
                {cliente.Observacion && (
                  <p className="text-[11px] text-slate-500 italic mt-1 border-t border-slate-200/60 pt-1">
                    Nota: {cliente.Observacion}
                  </p>
                )}
              </div>
            </div>

            {/* Puntos de venta / Tiendas */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                    <MapPin className="h-4 w-4 text-[#20A7DB]" />
                    <span>Puntos de Entrega & Sucursales ({cliente.PuntosVenta?.length || 0})</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Destinos donde los repartidores pueden entregar pedidos de este cliente
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMostrandoFormPV(!mostrandoFormPV)}
                  className="gap-1.5 border-[#20A7DB] text-[#20A7DB] hover:bg-sky-50 shadow-2xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{mostrandoFormPV ? "Ocultar Formulario" : "Nueva Sucursal con Mapa"}</span>
                </Button>
              </div>

              {/* Formulario Nueva Sucursal con Mapa Selector de Sucre */}
              {mostrandoFormPV && (
                <form onSubmit={handleCrearPV} className="p-5 rounded-2xl border border-sky-300 bg-sky-50/70 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                    <p className="text-xs font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Navigation className="h-4 w-4 text-[#20A7DB]" />
                      <span>Registrar Nueva Sucursal / Tienda en Sucre</span>
                    </p>
                    <span className="text-[11px] text-sky-700 font-medium">Ubicación interactiva</span>
                  </div>

                  {/* MAPA LEAFLET EN EL MODAL */}
                  <MapaSelectorUbicacion
                    lat={nuevoPV.Latitud}
                    lng={nuevoPV.Longitud}
                    onChange={handleCoordsChange}
                    altura="h-60"
                    label="Haz clic en el mapa de Sucre para fijar la ubicación de la sucursal:"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Nombre de la Sucursal / Tienda *</Label>
                      <Input
                        value={nuevoPV.NombrePuntoVenta}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, NombrePuntoVenta: e.target.value })}
                        placeholder="Ej. Sucursal Mercado Campesino"
                        required
                        className="bg-white border-slate-300 h-9 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Dirección Completa *</Label>
                      <Input
                        value={nuevoPV.Direccion}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, Direccion: e.target.value })}
                        placeholder="Ej. Calle Nataniel Aguirre #210"
                        required
                        className="bg-white border-slate-300 h-9 text-sm mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Referencia de Llegada para el Repartidor</Label>
                    <Input
                      value={nuevoPV.Referencia}
                      onChange={(e) => setNuevoPV({ ...nuevoPV, Referencia: e.target.value })}
                      placeholder="Ej. Puesto #45 sector embutidos frente a la entrada principal..."
                      className="bg-white border-slate-300 h-9 text-xs mt-1"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-sky-200">
                    <Button type="button" variant="outline" size="sm" onClick={() => setMostrandoFormPV(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-5 font-semibold" disabled={guardandoPV}>
                      {guardandoPV && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Guardar Sucursal
                    </Button>
                  </div>
                </form>
              )}

              {/* Listado de Sucursales */}
              <div className="space-y-2.5">
                {cliente.PuntosVenta?.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Store className="h-8 w-8 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs text-slate-500 font-medium">No tiene puntos de entrega registrados</p>
                    <p className="text-[11px] text-slate-400">Agrega el primer punto de entrega con el botón "Nueva Sucursal".</p>
                  </div>
                ) : (
                  cliente.PuntosVenta.map((pv) => (
                    <div 
                      key={pv.IdPuntoVenta} 
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-sky-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{pv.NombrePuntoVenta}</span>
                          <Badge variant="outline" className="text-[10px] text-sky-700 bg-sky-50 border-sky-200">
                            Sucursal Activa
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{pv.Direccion}</p>
                        {pv.Referencia && (
                          <p className="text-[11px] text-slate-400 italic mt-0.5">Ref: {pv.Referencia}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {pv.Latitud && pv.Longitud ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${pv.Latitud}&mlon=${pv.Longitud}#map=17/${pv.Latitud}/${pv.Longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#20A7DB] bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Abrir Mapa GPS</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin GPS</span>
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