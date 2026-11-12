import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { EnviarPingTelemetria } from "@/services/Logistica/RutaService";
import { Radio, Loader2, Play } from "lucide-react";

const PUNTOS_PREDEFINIDOS_SUCRE = [
  { nombre: "Mercado Campesino", lat: -19.032, lng: -65.251, dir: "Av. Ostria Gutiérrez esq. Pando" },
  { nombre: "Centro Histórico (Plaza 25 de Mayo)", lat: -19.0435, lng: -65.258, dir: "Calle Audiencia esq. España" },
  { nombre: "Zona San Juanillo / Av. Jaime Mendoza", lat: -19.028, lng: -65.248, dir: "Av. Jaime Mendoza #840" },
  { nombre: "Parque Bolívar / Ex-Estación", lat: -19.0375, lng: -65.2595, dir: "Calle Kilómetro 7" },
  { nombre: "Planta Industrial Blanquita", lat: -19.0185, lng: -65.242, dir: "Parque Industrial Sucre Mz-4" }
];

export default function ModalSimuladorGPS({
  repartidores = [],
  repartidorSeleccionado = null,
  abierto,
  onCerrar,
  onPingEmitido
}) {
  const [idRepartidor, setIdRepartidor] = useState(
    repartidorSeleccionado?.IdUsuarioRepartidor || (repartidores[0]?.IdUsuarioRepartidor || "")
  );
  const [latitud, setLatitud] = useState(
    repartidorSeleccionado?.Latitud?.toString() || "-19.0320"
  );
  const [longitud, setLongitud] = useState(
    repartidorSeleccionado?.Longitud?.toString() || "-65.2510"
  );
  const [velocidad, setVelocidad] = useState("32.5");
  const [bateria, setBateria] = useState("85");
  const [estadoMovimiento, setEstadoMovimiento] = useState("En Ruta");
  const [direccion, setDireccion] = useState("Av. Jaime Mendoza, Sucre");
  const [procesando, setProcesando] = useState(false);

  const repartidorActual = repartidores.find(
    (r) => r.IdUsuarioRepartidor === parseInt(idRepartidor, 10)
  ) || repartidorSeleccionado;

  const handleSeleccionarPunto = (pto) => {
    setLatitud(pto.lat.toString());
    setLongitud(pto.lng.toString());
    setDireccion(pto.dir);
  };

  const handleEmitirPing = async (e) => {
    if (e) e.preventDefault();
    if (!idRepartidor) {
      toast.error("Seleccione un repartidor");
      return;
    }

    try {
      setProcesando(true);
      await EnviarPingTelemetria({
        IdUsuarioRepartidor: parseInt(idRepartidor, 10),
        IdAsignacionRuta: repartidorActual?.IdAsignacionRuta || null,
        Latitud: parseFloat(latitud),
        Longitud: parseFloat(longitud),
        Velocidad: parseFloat(velocidad),
        Bateria: parseInt(bateria, 10),
        EstadoMovimiento: estadoMovimiento,
        DireccionAproximada: direccion
      });

      toast.success("Telemetría GPS emitida al servidor");
      if (onPingEmitido) onPingEmitido();
    } catch (err) {
      toast.error(err.message || "Error al emitir telemetría");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Dialog open={Boolean(abierto)} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded border border-slate-200">
        <DialogHeader className="border-b border-slate-200 pb-2.5">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Radio className="h-4 w-4 text-[#1C96C5]" />
            <span>Actualización Manual de Ubicación GPS</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleEmitirPing} className="space-y-4">
          <p className="text-xs text-slate-600">
            Actualice las coordenadas y estado de movimiento del conductor para pruebas o contingencia en campo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-800">Chofer Repartidor</Label>
              <select
                value={idRepartidor}
                onChange={(e) => setIdRepartidor(e.target.value)}
                className="mt-1 w-full h-8 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-[#1C96C5] focus:outline-none"
              >
                {repartidores.map((r) => (
                  <option key={r.IdUsuarioRepartidor} value={r.IdUsuarioRepartidor}>
                    {r.NombreRepartidor} {r.NombreRuta ? `(${r.NombreRuta})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-800">Estado de Movimiento</Label>
              <select
                value={estadoMovimiento}
                onChange={(e) => setEstadoMovimiento(e.target.value)}
                className="mt-1 w-full h-8 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-[#1C96C5] focus:outline-none"
              >
                <option value="En Ruta">En Ruta (Desplazamiento)</option>
                <option value="En Entrega">En Entrega (En comercio)</option>
                <option value="Detenido">Detenido (Tráfico / Semáforo)</option>
                <option value="Retorno a Planta">Retorno a Planta</option>
              </select>
            </div>
          </div>

          {/* ACCESOS RÁPIDOS DE UBICACIÓN EN SUCRE */}
          <div>
            <Label className="text-xs font-semibold text-slate-800 block mb-1">
              Ubicaciones Rápidas en la Ciudad de Sucre
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PUNTOS_PREDEFINIDOS_SUCRE.map((pto, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSeleccionarPunto(pto)}
                  className="p-2 border border-slate-200 rounded text-left hover:border-[#1C96C5] hover:bg-sky-50 transition-colors"
                >
                  <span className="text-[11px] font-bold text-slate-900 block truncate">
                    {pto.nombre}
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 block">
                    {pto.lat.toFixed(4)}, {pto.lng.toFixed(4)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* CAMPOS DE COORDENADAS Y SENSORES */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 border border-slate-200 rounded">
            <div>
              <Label className="text-xs font-medium text-slate-800">Latitud GPS</Label>
              <Input
                type="number"
                step="0.0001"
                value={latitud}
                onChange={(e) => setLatitud(e.target.value)}
                className="mt-1 text-xs h-8 rounded font-mono"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-800">Longitud GPS</Label>
              <Input
                type="number"
                step="0.0001"
                value={longitud}
                onChange={(e) => setLongitud(e.target.value)}
                className="mt-1 text-xs h-8 rounded font-mono"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-800">Velocidad (km/h)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="120"
                value={velocidad}
                onChange={(e) => setVelocidad(e.target.value)}
                className="mt-1 text-xs h-8 rounded font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-800">Batería Móvil (%)</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={bateria}
                onChange={(e) => setBateria(e.target.value)}
                className="mt-1 text-xs h-8 rounded font-mono"
              />
            </div>

            <div className="sm:col-span-4">
              <Label className="text-xs font-medium text-slate-800">Dirección de Referencia</Label>
              <Input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                className="mt-1 text-xs h-8 rounded"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 pt-2.5 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCerrar} className="rounded h-8 text-xs">
              Cerrar
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
                  <span>Enviando Telemetría...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Transmitir Coordenadas</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
