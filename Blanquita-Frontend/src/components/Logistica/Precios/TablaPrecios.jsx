import { useState, useEffect, useMemo } from "react";
import { ObtenerPrecios, GuardarPrecio, ObtenerHistorialPrecios } from "@/services/Logistica/PrecioService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tag, Edit2, Loader2, Package, CheckCircle2, History, Clock, Search, Sparkles, Filter } from "lucide-react";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";

export default function TablaPrecios() {
  const [precios, setPrecios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS"); // "TODOS" | "RECIENTES" | "SIN_PRECIO"

  const [sucursalId, setSucursalId] = useState(() => {
    if (typeof window !== "undefined") {
      const g = localStorage.getItem("blanquita_sucursal_activa");
      return (g && g !== "todas") ? Number(g) : 1;
    }
    return 1;
  });

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

  // Modal Historial de Precios
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
  const [itemHistorial, setItemHistorial] = useState(null);
  const [historialItems, setHistorialItems] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const cargarPrecios = async (sid = sucursalId, forzar = false) => {
    const sActual = (sid && sid !== "todas") ? Number(sid) : 1;
    const cacheKey = `logistica:precios:sucursal:${sActual}`;
    try {
      if (!forzar) {
        const enCache = cache.get(cacheKey);
        if (enCache) {
          setPrecios(enCache);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const data = await ObtenerPrecios(sActual);
      const lista = data || [];
      setPrecios(lista);
      cache.set(cacheKey, lista, 30);
    } catch (err) {
      toast.error(err.message || "Error al cargar catálogo de precios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPrecios(sucursalId);

    const handler = (e) => {
      const sid = e.detail?.sucursalId || "1";
      const numSid = sid !== "todas" ? Number(sid) : 1;
      setSucursalId(numSid);
      cargarPrecios(numSid, true);
    };
    window.addEventListener("sucursal_cambiada", handler);
    return () => window.removeEventListener("sucursal_cambiada", handler);
  }, []);

  // Identificar fecha de cambio más reciente en el catálogo
  const fechaUltimoCambioGlobal = useMemo(() => {
    const fechas = precios
      .filter((p) => p.VigenteDesde)
      .map((p) => new Date(p.VigenteDesde).getTime())
      .filter((t) => !isNaN(t));
    return fechas.length > 0 ? Math.max(...fechas) : null;
  }, [precios]);

  const esModificadoReciente = (p) => {
    if (!p.VigenteDesde) return false;
    const t = new Date(p.VigenteDesde).getTime();
    if (isNaN(t)) return false;
    // Si coincide con la fecha más reciente o tiene menos de 30 días
    if (fechaUltimoCambioGlobal && t === fechaUltimoCambioGlobal) return true;
    const hace30dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return t >= hace30dias;
  };

  // Filtrado de precios
  const preciosFiltrados = useMemo(() => {
    return precios.filter((p) => {
      const texto = `${p.NombreProducto || ""} ${p.CodigoPresentacion || ""} ${p.TipoContenedor || ""}`.toLowerCase();
      const coincideBusqueda = texto.includes(busqueda.toLowerCase());
      if (!coincideBusqueda) return false;

      if (filtroTipo === "RECIENTES") {
        return esModificadoReciente(p);
      }
      if (filtroTipo === "SIN_PRECIO") {
        return p.PrecioUnitario === null || p.PrecioUnitario === undefined;
      }
      return true;
    });
  }, [precios, busqueda, filtroTipo, fechaUltimoCambioGlobal]);

  // Paginación optimizada
  const paginacion = usePaginacion(preciosFiltrados, 10);

  const abrirEditar = (item) => {
    setItemEditar(item);
    setFormPrecio({
      PrecioUnitario: item.PrecioUnitario != null ? String(item.PrecioUnitario) : "",
      PrecioMayorista: item.PrecioMayorista != null ? String(item.PrecioMayorista) : "",
      CantidadMinimaMayorista: item.CantidadMinimaMayorista || 10,
      VigenteDesde: new Date().toISOString().split("T")[0]
    });
    setModalAbierto(true);
  };

  const abrirHistorial = async (item) => {
    setItemHistorial(item);
    setModalHistorialAbierto(true);
    setCargandoHistorial(true);
    try {
      const res = await ObtenerHistorialPrecios(item.IdPresentacion, sucursalId);
      setHistorialItems(res || []);
    } catch (err) {
      toast.error("Error al obtener historial de precios: " + err.message);
      setHistorialItems([]);
    } finally {
      setCargandoHistorial(false);
    }
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
        IdSucursal: sucursalId,
        PrecioUnitario: Number(formPrecio.PrecioUnitario),
        PrecioMayorista: formPrecio.PrecioMayorista ? Number(formPrecio.PrecioMayorista) : null,
        CantidadMinimaMayorista: Number(formPrecio.CantidadMinimaMayorista) || 10,
        VigenteDesde: formPrecio.VigenteDesde
      });
      cache.invalidate(`logistica:precios:sucursal:${sucursalId}`);
      toast.success("Precio actualizado exitosamente con auditoría y revalorización.");
      setModalAbierto(false);
      cargarPrecios(sucursalId, true);
    } catch (err) {
      toast.error(err.message || "Error al guardar precio");
    } finally {
      setGuardando(false);
    }
  };

  const totalConPrecio = precios.filter((p) => p.PrecioUnitario !== null).length;
  const totalSinPrecio = precios.length - totalConPrecio;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Catálogo de Precios Oficiales</h2>
          <p className="text-sm text-muted-foreground">
            Gestión de tarifas unitarias, mayoristas y control cronológico de vigencias por sucursal.
          </p>
        </div>
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Presentaciones</span>
            <p className="text-2xl font-bold text-slate-800">{precios.length}</p>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase">Con Tarifa Vigente</span>
            <p className="text-2xl font-bold text-emerald-700">{totalConPrecio}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase">Pendientes de Asignar</span>
            <p className="text-2xl font-bold text-amber-600">{totalSinPrecio}</p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Tag className="h-5 w-5" />
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#20A7DB]" />
              <span>Lista de Precios Vigente</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Mostrando {preciosFiltrados.length} de {precios.length} presentaciones
              </span>
            </div>
          </div>

          {/* Filtros y Buscador */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por producto o código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 text-xs h-9 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <Button
                variant={filtroTipo === "TODOS" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroTipo("TODOS")}
                className={`text-xs h-8 ${filtroTipo === "TODOS" ? "bg-[#20A7DB] hover:bg-[#1B92C0] text-white" : ""}`}
              >
                Todos
              </Button>
              <Button
                variant={filtroTipo === "RECIENTES" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroTipo("RECIENTES")}
                className={`text-xs h-8 gap-1.5 ${filtroTipo === "RECIENTES" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Editados Recientes
              </Button>
              <Button
                variant={filtroTipo === "SIN_PRECIO" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroTipo("SIN_PRECIO")}
                className={`text-xs h-8 ${filtroTipo === "SIN_PRECIO" ? "bg-slate-700 text-white" : ""}`}
              >
                Sin Tarifa
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#20A7DB]" />
            </div>
          ) : preciosFiltrados.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Package className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium">No se encontraron productos con los filtros seleccionados</p>
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
                    <th className="px-4 py-3 text-center">Cant. Mínima</th>
                    <th className="px-4 py-3 text-center">Última Vigencia</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginacion.itemsPaginados.map((p, idx) => {
                    const tienePrecio = p.PrecioUnitario !== null && p.PrecioUnitario !== undefined;
                    const esReciente = esModificadoReciente(p);

                    return (
                      <tr
                        key={`${p.IdPrecioProducto || p.IdPresentacion}-${p.IdSucursal || ''}-${idx}`}
                        className={`hover:bg-slate-50/70 transition-colors ${esReciente ? "bg-amber-50/30" : ""}`}
                      >
                        <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-600">
                          {p.CodigoPresentacion}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{p.NombreProducto}</span>
                            {esReciente && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1 text-[10px] font-bold px-1.5 py-0">
                                <Sparkles className="h-2.5 w-2.5" />
                                Editado Reciente
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
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
                        <td className="px-4 py-3 text-center text-slate-600 text-xs">
                          {p.PrecioMayorista ? `≥ ${p.CantidadMinimaMayorista || 10} un.` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500 font-mono">
                          {p.VigenteDesde ? (
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{String(p.VigenteDesde).split("T")[0]}</span>
                            </div>
                          ) : (
                            "—"
                          )}
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
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirHistorial(p)}
                              className="h-8 gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              title="Ver historial de cambios de precio"
                            >
                              <History className="h-3.5 w-3.5 text-slate-500" />
                              <span className="hidden md:inline">Historial</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirEditar(p)}
                              className="h-8 gap-1.5 text-[#20A7DB] border-[#20A7DB] hover:bg-sky-50"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              <span>{tienePrecio ? "Modificar" : "Asignar"}</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {preciosFiltrados.length > 0 && <PaginacionTabla {...paginacion} />}
        </CardContent>
      </Card>

      {/* Modal Fijar / Modificar Precio */}
      {modalAbierto && (
        <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
          <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
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
      )}

      {/* Modal Historial de Precios */}
      {modalHistorialAbierto && (
        <Dialog open={modalHistorialAbierto} onOpenChange={setModalHistorialAbierto}>
          <DialogContent className="w-full sm:max-w-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-600" />
                <span>Historial Cronológico de Precios</span>
              </DialogTitle>
            </DialogHeader>

            {itemHistorial && (
              <div className="space-y-4 pt-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{itemHistorial.NombreProducto}</p>
                      <p className="text-xs text-slate-500">
                        {itemHistorial.TipoContenedor} • Código: {itemHistorial.CodigoPresentacion}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      Presentación #{itemHistorial.IdPresentacion}
                    </Badge>
                  </div>
                </div>

                {cargandoHistorial ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  </div>
                ) : historialItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border rounded-xl">
                    No se registran cambios históricos de precio para este producto.
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b">
                        <tr>
                          <th className="p-2.5">Fecha de Vigencia</th>
                          <th className="p-2.5 text-right">Precio Unitario</th>
                          <th className="p-2.5 text-right">Precio Mayorista</th>
                          <th className="p-2.5 text-center">Cant. Mínima</th>
                          <th className="p-2.5 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historialItems.map((h, i) => (
                          <tr key={`hist-${h.IdPrecioProducto || i}`} className={`hover:bg-slate-50/70 ${i === 0 ? "bg-emerald-50/40" : ""}`}>
                            <td className="p-2.5 font-mono text-slate-700 font-medium">
                              {h.VigenteDesde ? String(h.VigenteDesde).split("T")[0] : "—"}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              Bs. {Number(h.PrecioUnitario || 0).toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right text-emerald-700 font-semibold">
                              {h.PrecioMayorista ? `Bs. ${Number(h.PrecioMayorista).toFixed(2)}` : "—"}
                            </td>
                            <td className="p-2.5 text-center text-slate-600">
                              {h.CantidadMinimaMayorista ? `≥ ${h.CantidadMinimaMayorista} un.` : "—"}
                            </td>
                            <td className="p-2.5 text-center">
                              {h.Activo ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  Vigente Actual
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px]">
                                  Histórico
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <DialogFooter className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setModalHistorialAbierto(false)}>
                    Cerrar
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
