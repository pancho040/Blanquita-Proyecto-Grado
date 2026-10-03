import { useState, useEffect } from "react";
import { ObtenerZonas, CrearZona, ObtenerRutas, CrearRuta, ObtenerRutaDetalle, GuardarPuntosVentaRuta } from "@/services/Logistica/RutaService";
import { ObtenerTodosPuntosVenta } from "@/services/Logistica/ClienteService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MapPin, Route, Plus, Loader2, Calendar, ArrowUp, ArrowDown, Trash2 } from "lucide-react";

const DIAS_SEMANA = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo"
};

export default function GestorRutas() {
  const [zonas, setZonas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Zona
  const [modalZona, setModalZona] = useState(false);
  const [nuevaZona, setNuevaZona] = useState({ NombreZona: "", Descripcion: "" });

  // Modal Ruta
  const [modalRuta, setModalRuta] = useState(false);
  const [nuevaRuta, setNuevaRuta] = useState({
    IdZonaDistribucion: "",
    NombreRuta: "",
    DiaSemana: 1,
    Descripcion: ""
  });

  // Itinerario seleccionado
  const [rutaSeleccionada, setRutaSeleccionada] = useState(null);
  const [puntosRuta, setPuntosRuta] = useState([]);
  const [todosPuntosVenta, setTodosPuntosVenta] = useState([]);
  const [puntoParaAgregar, setPuntoParaAgregar] = useState("");
  const [guardandoItinerario, setGuardandoItinerario] = useState(false);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [z, r, pv] = await Promise.all([
        ObtenerZonas(),
        ObtenerRutas(),
        ObtenerTodosPuntosVenta()
      ]);
      setZonas(z);
      setRutas(r);
      setTodosPuntosVenta(pv);
      if (r.length > 0 && !rutaSeleccionada) {
        seleccionarRuta(r[0]);
      }
    } catch (err) {
      toast.error(err.message || "Error al cargar rutas y zonas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const seleccionarRuta = async (r) => {
    setRutaSeleccionada(r);
    try {
      const detalle = await ObtenerRutaDetalle(r.IdRutaDistribucion);
      setPuntosRuta(detalle.PuntosVenta || []);
    } catch {
      setPuntosRuta([]);
    }
  };

  const handleCrearZona = async (e) => {
    e.preventDefault();
    if (!nuevaZona.NombreZona.trim()) return;
    try {
      await CrearZona(nuevaZona);
      toast.success("Zona creada");
      setNuevaZona({ NombreZona: "", Descripcion: "" });
      setModalZona(false);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al crear zona");
    }
  };

  const handleCrearRuta = async (e) => {
    e.preventDefault();
    if (!nuevaRuta.NombreRuta.trim() || !nuevaRuta.IdZonaDistribucion) {
      toast.error("Nombre de ruta y zona son obligatorios");
      return;
    }
    try {
      await CrearRuta({
        ...nuevaRuta,
        IdZonaDistribucion: Number(nuevaRuta.IdZonaDistribucion),
        DiaSemana: Number(nuevaRuta.DiaSemana)
      });
      toast.success("Ruta creada con éxito");
      setNuevaRuta({ IdZonaDistribucion: "", NombreRuta: "", DiaSemana: 1, Descripcion: "" });
      setModalRuta(false);
      cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al crear ruta");
    }
  };

  // Manejo de paradas de la ruta
  const agregarPuntoAItinerario = () => {
    if (!puntoParaAgregar) return;
    const pvObj = todosPuntosVenta.find((p) => p.IdPuntoVenta === Number(puntoParaAgregar));
    if (!pvObj) return;

    if (puntosRuta.some((p) => p.IdPuntoVenta === pvObj.IdPuntoVenta)) {
      toast.error("Este punto de venta ya está en la ruta");
      return;
    }

    const nuevoItem = {
      IdPuntoVenta: pvObj.IdPuntoVenta,
      NombrePuntoVenta: pvObj.NombrePuntoVenta,
      NombreCliente: pvObj.NombreCliente,
      Direccion: pvObj.Direccion,
      Latitud: pvObj.Latitud,
      Longitud: pvObj.Longitud,
      OrdenVisita: puntosRuta.length + 1
    };
    setPuntosRuta([...puntosRuta, nuevoItem]);
    setPuntoParaAgregar("");
  };

  const moverParada = (index, direccion) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= puntosRuta.length) return;
    const copia = [...puntosRuta];
    const temp = copia[index];
    copia[index] = copia[nuevoIndex];
    copia[nuevoIndex] = temp;
    // Recalcular orden
    copia.forEach((item, idx) => {
      item.OrdenVisita = idx + 1;
    });
    setPuntosRuta(copia);
  };

  const eliminarParada = (index) => {
    const filtrado = puntosRuta.filter((_, idx) => idx !== index);
    filtrado.forEach((item, idx) => {
      item.OrdenVisita = idx + 1;
    });
    setPuntosRuta(filtrado);
  };

  const guardarItinerario = async () => {
    if (!rutaSeleccionada) return;
    try {
      setGuardandoItinerario(true);
      await GuardarPuntosVentaRuta(
        rutaSeleccionada.IdRutaDistribucion,
        puntosRuta.map((p) => ({
          IdPuntoVenta: p.IdPuntoVenta,
          OrdenVisita: p.OrdenVisita
        }))
      );
      toast.success("Itinerario de ruta guardado con éxito");
      cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al guardar paradas");
    } finally {
      setGuardandoItinerario(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Rutas de Distribución (Sucre)</h2>
          <p className="text-sm text-muted-foreground">
            Sectores geográficos y secuencia de visita para los camiones de reparto
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalZona(true)} className="gap-1.5 border-slate-300">
            <Plus className="h-4 w-4" />
            <span>Nueva Zona</span>
          </Button>
          <Button onClick={() => setModalRuta(true)} className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5">
            <Plus className="h-4 w-4" />
            <span>Nueva Ruta</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Rutas por Zona */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Route className="h-4 w-4 text-[#20A7DB]" />
                <span>Rutas Configuradas</span>
              </CardTitle>
              <Badge variant="outline">{rutas.length} activas</Badge>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#20A7DB]" />
                </div>
              ) : rutas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No hay rutas registradas.</p>
              ) : (
                rutas.map((r) => {
                  const seleccionada = rutaSeleccionada?.IdRutaDistribucion === r.IdRutaDistribucion;
                  return (
                    <div
                      key={r.IdRutaDistribucion}
                      onClick={() => seleccionarRuta(r)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        seleccionada
                          ? "border-[#20A7DB] bg-sky-50/70 shadow-xs ring-1 ring-[#20A7DB]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{r.NombreRuta}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-sky-500" />
                            <span>{r.NombreZona}</span>
                          </p>
                        </div>
                        <Badge className="bg-sky-100 text-[#20A7DB] hover:bg-sky-200 border-none font-medium">
                          {DIAS_SEMANA[r.DiaSemana] || "Día flexible"}
                        </Badge>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>{r.TotalPuntosVenta || r.PuntosVenta?.length || 0} tiendas asignadas</span>
                        <span className="text-[#20A7DB] font-semibold">{seleccionada ? "Viendo paradas →" : "Ver paradas"}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Itinerario / Orden de Paradas de la Ruta Seleccionada */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#20A7DB]" />
                  <span>Itinerario de Paradas: {rutaSeleccionada ? rutaSeleccionada.NombreRuta : "Selecciona una ruta"}</span>
                </CardTitle>
                {rutaSeleccionada && (
                  <p className="text-xs text-muted-foreground">
                    Zona: {rutaSeleccionada.NombreZona} | Día: {DIAS_SEMANA[rutaSeleccionada.DiaSemana]}
                  </p>
                )}
              </div>
              {rutaSeleccionada && (
                <Button
                  size="sm"
                  onClick={guardarItinerario}
                  disabled={guardandoItinerario}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {guardandoItinerario && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Guardar Itinerario
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {rutaSeleccionada ? (
                <>
                  {/* Selector para agregar punto de venta a la ruta */}
                  <div className="flex gap-2">
                    <select
                      value={puntoParaAgregar}
                      onChange={(e) => setPuntoParaAgregar(e.target.value)}
                      className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[#20A7DB]"
                    >
                      <option value="">-- Seleccionar punto de venta para agregar a la ruta --</option>
                      {todosPuntosVenta.map((pv) => (
                        <option key={pv.IdPuntoVenta} value={pv.IdPuntoVenta}>
                          {pv.NombreCliente} — {pv.NombrePuntoVenta} ({pv.Direccion})
                        </option>
                      ))}
                    </select>
                    <Button onClick={agregarPuntoAItinerario} size="sm" className="bg-[#20A7DB] text-white shrink-0">
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>

                  {/* Lista de paradas ordenadas */}
                  <div className="space-y-2 max-h-[460px] overflow-y-auto">
                    {puntosRuta.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <MapPin className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                        <p className="text-sm text-slate-500 font-medium">Esta ruta no tiene paradas asignadas aún</p>
                        <p className="text-xs text-muted-foreground">Selecciona tiendas del catálogo para organizar el recorrido.</p>
                      </div>
                    ) : (
                      puntosRuta.map((item, idx) => (
                        <div
                          key={item.IdPuntoVenta}
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#20A7DB] text-xs font-bold text-white">
                              {item.OrdenVisita}
                            </span>
                            <div>
                              <p className="font-semibold text-sm text-slate-900">{item.NombreCliente}</p>
                              <p className="text-xs text-slate-600">{item.NombrePuntoVenta} - {item.Direccion}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={idx === 0}
                              onClick={() => moverParada(idx, -1)}
                              className="h-7 w-7 p-0"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={idx === puntosRuta.length - 1}
                              onClick={() => moverParada(idx, 1)}
                              className="h-7 w-7 p-0"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => eliminarParada(idx)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  Selecciona una ruta en el panel izquierdo para editar sus paradas.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Nueva Zona */}
      <Dialog open={modalZona} onOpenChange={setModalZona}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#20A7DB]">Nueva Zona de Distribución</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearZona} className="space-y-4 pt-2">
            <div>
              <Label>Nombre de la Zona *</Label>
              <Input
                value={nuevaZona.NombreZona}
                onChange={(e) => setNuevaZona({ ...nuevaZona, NombreZona: e.target.value })}
                placeholder="Ej. Mercado Campesino y Alrededores"
                required
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={nuevaZona.Descripcion}
                onChange={(e) => setNuevaZona({ ...nuevaZona, Descripcion: e.target.value })}
                placeholder="Ej. Cuadrante entre Av. Las Américas y Av. Ostria"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalZona(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#20A7DB] text-white">Crear Zona</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Ruta */}
      <Dialog open={modalRuta} onOpenChange={setModalRuta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#20A7DB]">Nueva Ruta de Distribución</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrearRuta} className="space-y-4 pt-2">
            <div>
              <Label>Zona *</Label>
              <select
                value={nuevaRuta.IdZonaDistribucion}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, IdZonaDistribucion: e.target.value })}
                required
                className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-xs focus:ring-2 focus:ring-[#20A7DB]"
              >
                <option value="">-- Seleccionar Zona --</option>
                {zonas.map((z) => (
                  <option key={z.IdZonaDistribucion} value={z.IdZonaDistribucion}>
                    {z.NombreZona}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Nombre de la Ruta *</Label>
              <Input
                value={nuevaRuta.NombreRuta}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, NombreRuta: e.target.value })}
                placeholder="Ej. Ruta A - Tiendas Minoristas"
                required
              />
            </div>
            <div>
              <Label>Día de la Semana Habitual</Label>
              <select
                value={nuevaRuta.DiaSemana}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, DiaSemana: e.target.value })}
                className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-xs focus:ring-2 focus:ring-[#20A7DB]"
              >
                {Object.entries(DIAS_SEMANA).map(([num, nombre]) => (
                  <option key={num} value={num}>{nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={nuevaRuta.Descripcion}
                onChange={(e) => setNuevaRuta({ ...nuevaRuta, Descripcion: e.target.value })}
                placeholder="Ej. Ruta matutina de 07:00 a 13:00"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalRuta(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#20A7DB] text-white">Crear Ruta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
