import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ObtenerRepartidores, 
  CrearRepartidor, 
  CambiarEstadoRepartidor 
} from "@/services/Logistica/RutaService";
import { 
  Users, 
  UserPlus, 
  Phone, 
  ShieldCheck, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Truck,
  IdCard
} from "lucide-react";

export default function GestionChoferesModal({ abierto, onCerrar, onActualizado }) {
  if (!abierto) return null;
  const [repartidores, setRepartidores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [nuevoChofer, setNuevoChofer] = useState({
    Ci: "",
    PrimerNombre: "",
    SegundoNombre: "",
    ApellidoPaterno: "",
    ApellidoMaterno: "",
    Celular: "",
    Clave: "Blanquita123!"
  });

  const cargarChoferes = async () => {
    try {
      setLoading(true);
      const data = await ObtenerRepartidores();
      setRepartidores(data);
    } catch (err) {
      toast.error(err.message || "Error al cargar conductores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      cargarChoferes();
      setMostrandoFormulario(false);
    }
  }, [abierto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNuevoChofer(prev => ({ ...prev, [name]: value }));
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nuevoChofer.Ci.trim() || !nuevoChofer.PrimerNombre.trim() || !nuevoChofer.ApellidoPaterno.trim()) {
      toast.error("CI, Primer Nombre y Apellido Paterno son obligatorios");
      return;
    }

    try {
      setGuardando(true);
      await CrearRepartidor(nuevoChofer);
      toast.success(`Chofer ${nuevoChofer.PrimerNombre} ${nuevoChofer.ApellidoPaterno} registrado con éxito`);
      setNuevoChofer({
        Ci: "",
        PrimerNombre: "",
        SegundoNombre: "",
        ApellidoPaterno: "",
        ApellidoMaterno: "",
        Celular: "",
        Clave: "Blanquita123!"
      });
      setMostrandoFormulario(false);
      await cargarChoferes();
      if (onActualizado) onActualizado();
    } catch (err) {
      toast.error(err.message || "Error al registrar chofer");
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleEstado = async (chofer) => {
    const nuevoEstado = chofer.IdEstadoUsuario === 1 ? 2 : 1;
    try {
      await CambiarEstadoRepartidor(chofer.IdUsuario, nuevoEstado);
      toast.success(`Estado de ${chofer.NombreCompleto} actualizado`);
      cargarChoferes();
      if (onActualizado) onActualizado();
    } catch (err) {
      toast.error(err.message || "Error al cambiar estado");
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-6 w-6 text-[#20A7DB]" />
              <span>Conductores</span>
            </DialogTitle>
          </div>

          <Button
            type="button"
            onClick={() => setMostrandoFormulario(!mostrandoFormulario)}
            className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 h-9 text-xs font-semibold px-3"
          >
            <UserPlus className="h-4 w-4" />
            <span>{mostrandoFormulario ? "Ver Lista" : "Nuevo Conductor"}</span>
          </Button>
        </DialogHeader>

        {/* FORMULARIO PARA REGISTRAR NUEVO CHOFER */}
        {mostrandoFormulario ? (
          <form onSubmit={handleCrear} className="space-y-4 pt-2 animate-in fade-in-50 duration-150">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <IdCard className="h-4 w-4 text-[#20A7DB]" />
                <span>Datos del Conductor</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Carnet de Identidad (CI) *</Label>
                  <Input
                    name="Ci"
                    value={nuevoChofer.Ci}
                    onChange={handleChange}
                    placeholder="Ej. 7891004"
                    required
                    className="mt-1 bg-white border-slate-300 font-mono text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Primer Nombre *</Label>
                  <Input
                    name="PrimerNombre"
                    value={nuevoChofer.PrimerNombre}
                    onChange={handleChange}
                    placeholder="Ej. Roberto"
                    required
                    className="mt-1 bg-white border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Segundo Nombre</Label>
                  <Input
                    name="SegundoNombre"
                    value={nuevoChofer.SegundoNombre}
                    onChange={handleChange}
                    placeholder="Ej. Carlos"
                    className="mt-1 bg-white border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Apellido Paterno *</Label>
                  <Input
                    name="ApellidoPaterno"
                    value={nuevoChofer.ApellidoPaterno}
                    onChange={handleChange}
                    placeholder="Ej. Mendoza"
                    required
                    className="mt-1 bg-white border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Apellido Materno</Label>
                  <Input
                    name="ApellidoMaterno"
                    value={nuevoChofer.ApellidoMaterno}
                    onChange={handleChange}
                    placeholder="Ej. Flores"
                    className="mt-1 bg-white border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Celular WhatsApp</Label>
                  <Input
                    name="Celular"
                    value={nuevoChofer.Celular}
                    onChange={handleChange}
                    placeholder="Ej. 71239845"
                    className="mt-1 bg-white border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Contraseña de Acceso al Sistema</Label>
                <Input
                  name="Clave"
                  type="text"
                  value={nuevoChofer.Clave}
                  onChange={handleChange}
                  placeholder="Blanquita123!"
                  className="mt-1 bg-white border-slate-300 text-sm font-mono max-w-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Clave inicial con la que el chofer ingresará a su módulo de entregas.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-200">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setMostrandoFormulario(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  size="sm" 
                  className="bg-[#20A7DB] hover:bg-[#188cba] text-white px-6 font-semibold"
                  disabled={guardando}
                >
                  {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar y Guardar Chofer
                </Button>
              </div>
            </div>
          </form>
        ) : (
          /* LISTA DE CHOFERES */
          <div className="space-y-4 pt-2">
            {loading ? (
              <div className="py-20 flex flex-col justify-center items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
                <p className="text-xs text-slate-500 font-medium">Cargando nómina de conductores...</p>
              </div>
            ) : repartidores.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No hay choferes registrados</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Registra el primer conductor de la empresa con el botón superior.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => setMostrandoFormulario(true)} 
                  className="bg-[#20A7DB] text-white"
                >
                  Registrar Primer Chofer
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50/90 text-xs text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Nombre del Conductor</th>
                      <th className="px-4 py-3">CI</th>
                      <th className="px-4 py-3">Contacto Móvil</th>
                      <th className="px-4 py-3 text-center">Despachos Asignados</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {repartidores.map((c) => (
                      <tr key={c.IdUsuario} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {c.NombreCompleto}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">
                          {c.Ci}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.Celular ? (
                            <a
                              href={`https://wa.me/591${c.Celular.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:underline font-medium"
                            >
                              <Phone className="h-3 w-3 text-emerald-600" />
                              <span>{c.Celular}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                            {c.TotalAsignaciones || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={c.IdEstadoUsuario === 1 ? "bg-emerald-500 text-white font-medium text-xs" : "bg-slate-400 text-white font-medium text-xs"}>
                            {c.IdEstadoUsuario === 1 ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleEstado(c)}
                            className="h-8 px-2.5 text-xs text-slate-700 hover:border-slate-400 shadow-2xs"
                          >
                            {c.IdEstadoUsuario === 1 ? "Desactivar" : "Activar"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}