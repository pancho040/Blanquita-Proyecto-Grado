import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ObtenerClienteDetalle, AgregarPuntoVenta } from "@/services/Logistica/ClienteService";
import { Loader2, Plus, Store, MapPin } from "lucide-react";

export default function DetalleClienteModal({ idCliente, abierto, onCerrar }) {
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mostrandoFormPV, setMostrandoFormPV] = useState(false);
  const [guardandoPV, setGuardandoPV] = useState(false);

  const [nuevoPV, setNuevoPV] = useState({
    NombrePuntoVenta: "",
    Direccion: "",
    Latitud: -19.0429,
    Longitud: -65.2554,
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
      toast.success("Punto de venta agregado");
      setNuevoPV({
        NombrePuntoVenta: "",
        Direccion: "",
        Latitud: -19.0429,
        Longitud: -65.2554,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#20A7DB] flex items-center gap-2">
            <Store className="h-5 w-5" />
            <span>Ficha del Cliente & Puntos de Entrega</span>
          </DialogTitle>
        </DialogHeader>

        {loading || !cliente ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Cabecera Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-xs text-muted-foreground">Razón Social</p>
                <p className="font-semibold text-slate-800">{cliente.RazonSocial}</p>
                {cliente.NombreComercial && (
                  <p className="text-xs text-slate-500">"{cliente.NombreComercial}"</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NIT / CI</p>
                <p className="font-semibold text-slate-800">{cliente.NitCi}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <Badge className={cliente.BloqueadoPorMora ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}>
                  {cliente.BloqueadoPorMora ? "Mora" : cliente.NombreEstado}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Teléfono</p>
                <p className="font-medium text-slate-700">{cliente.Telefono || "No registrado"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Límite de Crédito</p>
                <p className="font-semibold text-sky-700">Bs. {Number(cliente.LimiteCreditoBs).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Días Crédito</p>
                <p className="font-medium text-slate-700">{cliente.DiasCredito} días</p>
              </div>
            </div>

            {/* Puntos de venta / Tiendas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#20A7DB]" />
                  <span>Puntos de Venta / Sucursales ({cliente.PuntosVenta?.length || 0})</span>
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMostrandoFormPV(!mostrandoFormPV)}
                  className="gap-1.5 border-[#20A7DB] text-[#20A7DB] hover:bg-sky-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{mostrandoFormPV ? "Cancelar" : "Nueva Sucursal"}</span>
                </Button>
              </div>

              {mostrandoFormPV && (
                <form onSubmit={handleCrearPV} className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 space-y-3 animate-in fade-in">
                  <p className="text-xs font-bold text-sky-900 uppercase">Agregar Nueva Sucursal / Tienda</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nombre de la Sucursal / Tienda *</Label>
                      <Input
                        value={nuevoPV.NombrePuntoVenta}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, NombrePuntoVenta: e.target.value })}
                        placeholder="Ej. Sucursal Mercado Campesino"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Dirección Completa *</Label>
                      <Input
                        value={nuevoPV.Direccion}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, Direccion: e.target.value })}
                        placeholder="Ej. Calle Nataniel Aguirre #210"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Latitud</Label>
                      <Input
                        type="number"
                        step="any"
                        value={nuevoPV.Latitud}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, Latitud: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Longitud</Label>
                      <Input
                        type="number"
                        step="any"
                        value={nuevoPV.Longitud}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, Longitud: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Referencia</Label>
                      <Input
                        value={nuevoPV.Referencia}
                        onChange={(e) => setNuevoPV({ ...nuevoPV, Referencia: e.target.value })}
                        placeholder="Ej. Puesto #45 sector lácteos"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button type="submit" size="sm" className="bg-[#20A7DB] text-white" disabled={guardandoPV}>
                      {guardandoPV && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Guardar Sucursal
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {cliente.PuntosVenta?.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-3 text-center">No tiene puntos de venta registrados.</p>
                ) : (
                  cliente.PuntosVenta.map((pv) => (
                    <div key={pv.IdPuntoVenta} className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between shadow-xs">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{pv.NombrePuntoVenta}</p>
                        <p className="text-xs text-slate-600">{pv.Direccion}</p>
                        {pv.Referencia && (
                          <p className="text-xs text-slate-400 italic">Ref: {pv.Referencia}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {pv.Latitud && pv.Longitud ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${pv.Latitud}&mlon=${pv.Longitud}#map=17/${pv.Latitud}/${pv.Longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#20A7DB] hover:underline"
                          >
                            <MapPin className="h-3 w-3" />
                            <span>Ver Mapa</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Sin GPS</span>
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
