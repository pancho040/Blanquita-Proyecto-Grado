import { useState, useEffect } from "react";
import { ObtenerPrecios, GuardarPrecio } from "@/services/Logistica/PrecioService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tag, Edit2, Loader2, Package, CheckCircle2 } from "lucide-react";

export default function TablaPrecios() {
  const [precios, setPrecios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal edición precio
  const [modalAbierto, setModalAbierto] = useState(false);
  const [itemEditar, setItemEditar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [formPrecio, setFormPrecio] = useState({
    PrecioUnitario: "",
    PrecioMayorista: "",
    CantidadMinimaMayorista: 10,
    VigenteDesde: new Date().toISOString().split("T")[0]
  });

  const cargarPrecios = async () => {
    try {
      setLoading(true);
      const data = await ObtenerPrecios();
      setPrecios(data);
    } catch (err) {
      toast.error(err.message || "Error al cargar catálogo de precios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPrecios();
  }, []);

  const abrirEditar = (item) => {
    setItemEditar(item);
    setFormPrecio({
      PrecioUnitario: item.PrecioUnitario || "",
      PrecioMayorista: item.PrecioMayorista || "",
      CantidadMinimaMayorista: item.CantidadMinimaMayorista || 10,
      VigenteDesde: new Date().toISOString().split("T")[0]
    });
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formPrecio.PrecioUnitario || Number(formPrecio.PrecioUnitario) <= 0) {
      toast.error("El precio unitario debe ser mayor a 0");
      return;
    }
    try {
      setGuardando(true);
      await GuardarPrecio({
        IdPresentacion: itemEditar.IdPresentacion,
        PrecioUnitario: Number(formPrecio.PrecioUnitario),
        PrecioMayorista: formPrecio.PrecioMayorista ? Number(formPrecio.PrecioMayorista) : null,
        CantidadMinimaMayorista: Number(formPrecio.CantidadMinimaMayorista) || 10,
        VigenteDesde: formPrecio.VigenteDesde
      });
      toast.success("Precio actualizado exitosamente");
      setModalAbierto(false);
      cargarPrecios();
    } catch (err) {
      toast.error(err.message || "Error al guardar precio");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Catálogo de Precios de Venta</h2>
          <p className="text-sm text-muted-foreground">
            Tarifas unitarias y mayoristas para productos de papel (megarrollos, higiénico, servilletas)
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#20A7DB]" />
            <span>Lista de Precios Vigente</span>
          </CardTitle>
          <div className="text-xs text-slate-500">
            {precios.length} presentaciones registradas
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            </div>
          ) : precios.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Package className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium">No hay productos en catálogo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Producto / Presentación</th>
                    <th className="px-4 py-3">Contenedor / Unidades</th>
                    <th className="px-4 py-3 text-right">Precio Unitario</th>
                    <th className="px-4 py-3 text-right">Precio Mayorista</th>
                    <th className="px-4 py-3 text-center">Cant. Mínima Mayorista</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {precios.map((p) => {
                    const tienePrecio = p.PrecioUnitario !== null;
                    return (
                      <tr key={p.IdPresentacion} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {p.CodigoPresentacion}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {p.NombreProducto}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.TipoContenedor} {p.CantidadRollosUnidades ? `(${p.CantidadRollosUnidades} un.)` : ""}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {tienePrecio ? `Bs. ${Number(p.PrecioUnitario).toFixed(2)}` : (
                            <span className="text-xs text-amber-500 font-normal italic">Sin precio</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                          {p.PrecioMayorista ? `Bs. ${Number(p.PrecioMayorista).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {p.PrecioMayorista ? `≥ ${p.CantidadMinimaMayorista || 10} un.` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tienePrecio ? (
                            <Badge className="bg-emerald-500 text-white gap-1 text-[11px]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Vigente</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Pendiente
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEditar(p)}
                            className="h-8 gap-1.5 text-[#20A7DB] border-[#20A7DB] hover:bg-sky-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>{tienePrecio ? "Modificar" : "Asignar"}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Fijar Precio */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#20A7DB] flex items-center gap-2">
              <Tag className="h-5 w-5" />
              <span>Establecer Precio de Venta</span>
            </DialogTitle>
          </DialogHeader>

          {itemEditar && (
            <form onSubmit={handleGuardar} className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-sm text-slate-800">{itemEditar.NombreProducto}</p>
                <p className="text-xs text-muted-foreground">
                  {itemEditar.TipoContenedor} - Código: {itemEditar.CodigoPresentacion}
                </p>
              </div>

              <div>
                <Label htmlFor="PrecioUnitario">Precio Unitario (Bs) *</Label>
                <Input
                  id="PrecioUnitario"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ej. 18.50"
                  value={formPrecio.PrecioUnitario}
                  onChange={(e) => setFormPrecio({ ...formPrecio, PrecioUnitario: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="PrecioMayorista">Precio Mayorista (Bs)</Label>
                  <Input
                    id="PrecioMayorista"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ej. 16.00"
                    value={formPrecio.PrecioMayorista}
                    onChange={(e) => setFormPrecio({ ...formPrecio, PrecioMayorista: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="CantidadMinimaMayorista">Cantidad Mínima</Label>
                  <Input
                    id="CantidadMinimaMayorista"
                    type="number"
                    min="1"
                    value={formPrecio.CantidadMinimaMayorista}
                    onChange={(e) => setFormPrecio({ ...formPrecio, CantidadMinimaMayorista: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="VigenteDesde">Vigente a partir de</Label>
                <Input
                  id="VigenteDesde"
                  type="date"
                  value={formPrecio.VigenteDesde}
                  onChange={(e) => setFormPrecio({ ...formPrecio, VigenteDesde: e.target.value })}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setModalAbierto(false)}>Cancelar</Button>
                <Button type="submit" className="bg-[#20A7DB] text-white" disabled={guardando}>
                  {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Precio
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
