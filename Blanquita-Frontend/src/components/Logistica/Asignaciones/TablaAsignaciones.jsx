import { useState, useEffect } from "react";
import { ObtenerAsignaciones, CrearAsignacion, ObtenerRutas, ObtenerRepartidores } from "@/services/Logistica/RutaService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Truck, Plus, Calendar, Loader2, UserCheck, CheckCircle2, Clock } from "lucide-react";

export default function TablaAsignaciones() {
  const hoyStr = new Date().toISOString().split("T")[0];
  const [fecha, setFecha] = useState(hoyStr);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal nueva asignación
  const [modalAbierto, setModalAbierto] = useState(false);
  const [rutas, setRutas] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const [formAsignacion, setFormAsignacion] = useState({
    IdRutaDistribucion: "",
    IdUsuarioRepartidor: "",
    FechaAsignacion: hoyStr,
    KilometrajeInicial: "",
    Observacion: ""
  });

  const cargarAsignaciones = async () => {
    try {
      setLoading(true);
      const data = await ObtenerAsignaciones(fecha);
      setAsignaciones(data);
    } catch (err) {
      toast.error(err.message || "Error al cargar despachos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAsignaciones();
  }, [fecha]);

  const abrirModal = async () => {
    try {
      const [r, rep] = await Promise.all([ObtenerRutas(), ObtenerRepartidores()]);
      setRutas(r);
      setRepartidores(rep);
      setFormAsignacion({
        IdRutaDistribucion: r.length > 0 ? r[0].IdRutaDistribucion : "",
        IdUsuarioRepartidor: rep.length > 0 ? rep[0].IdUsuario : "",
        FechaAsignacion: fecha,
        KilometrajeInicial: "",
        Observacion: ""
      });
      setModalAbierto(true);
    } catch (err) {
      toast.error("Error al preparar formulario");
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!formAsignacion.IdRutaDistribucion || !formAsignacion.IdUsuarioRepartidor) {
      toast.error("Selecciona ruta y repartidor");
      return;
    }
    try {
      setGuardando(true);
      await CrearAsignacion({
        ...formAsignacion,
        IdRutaDistribucion: Number(formAsignacion.IdRutaDistribucion),
        IdUsuarioRepartidor: Number(formAsignacion.IdUsuarioRepartidor),
        KilometrajeInicial: formAsignacion.KilometrajeInicial ? Number(formAsignacion.KilometrajeInicial) : null
      });
      toast.success("Ruta asignada con éxito al repartidor");
      setModalAbierto(false);
      cargarAsignaciones();
    } catch (err) {
      toast.error(err.message || "Error al asignar ruta");
    } finally {
      setGuardando(false);
    }
  };

  const badgeEstado = (estado) => {
    switch (estado) {
      case "Finalizada":
        return <Badge className="bg-emerald-500 text-white">Finalizada</Badge>;
      case "En Ruta":
        return <Badge className="bg-sky-500 text-white">En Ruta</Badge>;
      case "Cancelada":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Programación Diaria de Reparto</h2>
          <p className="text-sm text-muted-foreground">
            Despacho de vehículos, repartidores y control de kilometraje por fecha
          </p>
        </div>
        <Button onClick={abrirModal} className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-2">
          <Plus className="h-4 w-4" />
          <span>Programar Despacho</span>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#20A7DB]" />
            <Label htmlFor="fechaFiltro" className="text-sm font-semibold text-slate-700">Fecha de Ruta:</Label>
            <Input
              id="fechaFiltro"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-auto h-9 bg-slate-50 border-slate-200"
            />
          </div>
          <div className="text-xs text-slate-500">
            {asignaciones.length} despachos programados para este día
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            </div>
          ) : asignaciones.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Truck className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium">No hay despachos asignados para {fecha}</p>
              <p className="text-xs text-muted-foreground">Usa el botón "Programar Despacho" para asignar una ruta a un repartidor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Ruta & Zona</th>
                    <th className="px-4 py-3">Repartidor Asignado</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Km Inicial</th>
                    <th className="px-4 py-3 text-center">Km Final</th>
                    <th className="px-4 py-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {asignaciones.map((a) => (
                    <tr key={a.IdAsignacionRuta} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{a.NombreRuta}</div>
                        <div className="text-xs text-muted-foreground">{a.NombreZona}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-[#20A7DB]" />
                          <span>{a.NombreRepartidor}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {badgeEstado(a.Estado)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        {a.KilometrajeInicial ? `${a.KilometrajeInicial} km` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        {a.KilometrajeFinal ? `${a.KilometrajeFinal} km` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                        {a.Observacion || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Programar Despacho */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#20A7DB] flex items-center gap-2">
              <Truck className="h-5 w-5" />
              <span>Programar Despacho a Repartidor</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCrear} className="space-y-4 pt-2">
            <div>
              <Label>Ruta de Distribución *</Label>
              <select
                value={formAsignacion.IdRutaDistribucion}
                onChange={(e) => setFormAsignacion({ ...formAsignacion, IdRutaDistribucion: e.target.value })}
                required
                className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-xs focus:ring-2 focus:ring-[#20A7DB]"
              >
                {rutas.map((r) => (
                  <option key={r.IdRutaDistribucion} value={r.IdRutaDistribucion}>
                    {r.NombreRuta} ({r.NombreZona})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Agente de Reparto *</Label>
              <select
                value={formAsignacion.IdUsuarioRepartidor}
                onChange={(e) => setFormAsignacion({ ...formAsignacion, IdUsuarioRepartidor: e.target.value })}
                required
                className="w-full text-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-xs focus:ring-2 focus:ring-[#20A7DB]"
              >
                {repartidores.length === 0 ? (
                  <option value="">No hay repartidores con rol 6 activos</option>
                ) : (
                  repartidores.map((u) => (
                    <option key={u.IdUsuario} value={u.IdUsuario}>
                      {u.NombreCompleto} (CI: {u.Ci})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formAsignacion.FechaAsignacion}
                  onChange={(e) => setFormAsignacion({ ...formAsignacion, FechaAsignacion: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Odómetro Inicial (Km)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ej. 45200.5"
                  value={formAsignacion.KilometrajeInicial}
                  onChange={(e) => setFormAsignacion({ ...formAsignacion, KilometrajeInicial: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Observación o Instrucción</Label>
              <Input
                placeholder="Ej. Llevar factura a tienda Don Pepe"
                value={formAsignacion.Observacion}
                onChange={(e) => setFormAsignacion({ ...formAsignacion, Observacion: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAbierto(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#20A7DB] text-white" disabled={guardando || repartidores.length === 0}>
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Despacho
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
