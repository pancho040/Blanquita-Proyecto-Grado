import { useState, useEffect, useMemo } from "react";
import { ObtenerPrecios, GuardarPrecio, ObtenerHistorialPrecios } from "@/services/Logistica/PrecioService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/common/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tag, Edit2, Loader2, Package, CheckCircle2, History, Clock, Search, Sparkles, Building } from "lucide-react";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";
import { esUsuarioGeneral } from "@/lib/sucursalContext";

export default function TablaPrecios({ usuario }) {
  const esGeneral = esUsuarioGeneral(usuario);
  const sucursalFija = (!esGeneral && usuario?.IdSucursal) ? Number(usuario.IdSucursal) : null;

  const [precios, setPrecios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS"); // "TODOS" | "RECIENTES" | "SIN_PRECIO"

  const [sucursalId, setSucursalId] = useState(() => {
    if (sucursalFija) return sucursalFija;
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
    const sEfectiva = sucursalFija || sucursalId;
    cargarPrecios(sEfectiva);

    const handler = (e) => {
      if (sucursalFija) return; // Usuario de sede fija no cambia de sede
      const sid = e.detail?.sucursalId || "1";
      const numSid = sid !== "todas" ? Number(sid) : 1;
      setSucursalId(numSid);
      cargarPrecios(numSid, true);
    };
    window.addEventListener("sucursal_cambiada", handler);
    return () => window.removeEventListener("sucursal_cambiada", handler);
  }, [sucursalFija]);

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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded border border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Catálogo de Precios Oficiales</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Gestión de tarifas unitarias, mayoristas y control cronológico de vigencias por sucursal.
          </p>
        </div>

        {/* Conmutador o distintivo de sucursal */}
        {esGeneral ? (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setSucursalId(1);
                cargarPrecios(1, true);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                sucursalId === 1
                  ? "bg-white text-slate-900 border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sucursal Sucre
            </button>
            <button
              type="button"
              onClick={() => {
                setSucursalId(2);
                cargarPrecios(2, true);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                sucursalId === 2
                  ? "bg-white text-slate-900 border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sucursal Potosí
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-sky-200 bg-sky-50 text-sky-900 text-xs font-semibold">
            <Building className="h-3.5 w-3.5 text-[#1C96C5]" />
            <span>Sede de Operación: {sucursalId === 2 ? "Sucursal Potosí" : "Sucursal Sucre (Central)"}</span>
          </div>
        )}
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-600 font-semibold uppercase">Total Presentaciones</span>
            <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{precios.length}</p>
          </div>
          <div className="p-2 bg-slate-100 text-slate-700 rounded">
            <Package className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-600 font-semibold uppercase">Con Tarifa Vigente</span>
            <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">{totalConPrecio}</p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white p-4 rounded border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-600 font-semibold uppercase">Pendientes de Asignar</span>
            <p className="text-2xl font-bold font-mono text-amber-700 tabular-nums">{totalSinPrecio}</p>
          </div>
          <div className="p-2 bg-amber-50 text-amber-700 rounded border border-amber-200">
            <Tag className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="border border-slate-200 bg-white rounded overflow-hidden">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#1C96C5]" />
              <span>Lista de Precios Vigente</span>
            </h3>
            <span className="text-xs text-slate-600">
              Mostrando <strong className="text-slate-900 font-mono">{preciosFiltrados.length}</strong> de {precios.length} presentaciones
            </span>
          </div>

          {/* Filtros y Buscador */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Buscar por producto o código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 text-xs h-8 bg-white border-slate-300 rounded"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <Button
                variant={filtroTipo === "TODOS" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroTipo("TODOS")}
                className={`text-xs h-8 rounded ${filtroTipo === "TODOS" ? "bg-[#1C96C5] hover:bg-[#157A9E] text-white" : "border-slate-300 text-slate-700"}`}
              >
                Todos
              </Button>
              <Button
                variant={filtroTipo === "RECIENTES" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroTipo("RECIENTES")}
                className={`text-xs h-8 gap-1.5 rounded ${filtroTipo === "RECIENTES" ? "bg-amber-700 hover:bg-amber-800 text-white" : "border-slate-300 text-slate-700"}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Editados Recientes
              </Button>
              <Button
                variant={filtroTipo === "SIN_PRECIO" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroTipo("SIN_PRECIO")}
                className={`text-xs h-8 rounded ${filtroTipo === "SIN_PRECIO" ? "bg-slate-800 text-white" : "border-slate-300 text-slate-700"}`}
              >
                Sin Tarifa
              </Button>
            </div>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#1C96C5]" />
            </div>
          ) : preciosFiltrados.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Package className="mx-auto h-10 w-10 text-slate-400 mb-2" />
              <p className="text-slate-700 font-medium text-xs">No se encontraron productos con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 text-slate-700 text-xs uppercase font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Código</th>
                    <th className="px-3 py-2.5 font-semibold">Producto / Presentación</th>
                    <th className="px-3 py-2.5 font-semibold">Contenedor / Unidades</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Precio Unitario</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Precio Mayorista</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Cant. Mínima</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Última Vigencia</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Estado</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginacion.itemsPaginados.map((p, idx) => {
                    const tienePrecio = p.PrecioUnitario !== null && p.PrecioUnitario !== undefined;
                    const esReciente = esModificadoReciente(p);

                    return (
                      <tr
                        key={`${p.IdPrecioProducto || p.IdPresentacion}-${p.IdSucursal || ''}-${idx}`}
                        className={`hover:bg-slate-50 transition-colors ${esReciente ? "bg-amber-50/20" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-xs font-mono font-semibold text-slate-700">
                          {p.CodigoPresentacion}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{p.NombreProducto}</span>
                            {esReciente && (
                              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-medium px-1.5 py-0.2 rounded inline-flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" />
                                Editado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 text-xs">
                          {p.TipoContenedor} {p.CantidadRollosUnidades ? `(${p.CantidadRollosUnidades} un.)` : ""}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                          {tienePrecio ? `Bs. ${Number(p.PrecioUnitario).toFixed(2)}` : (
                            <span className="text-xs text-amber-700 font-normal italic">Sin precio</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                          {p.PrecioMayorista ? `Bs. ${Number(p.PrecioMayorista).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs font-mono tabular-nums">
                          {p.PrecioMayorista ? `≥ ${p.CantidadMinimaMayorista || 10} un.` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-600 font-mono">
                          {p.VigenteDesde ? (
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-slate-500" />
                              <span>{String(p.VigenteDesde).split("T")[0]}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge
                            estado={tienePrecio ? "VIGENTE" : "PENDIENTE"}
                            variant={tienePrecio ? "success" : "warning"}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirHistorial(p)}
                              className="h-7 text-xs text-slate-600 hover:text-slate-900 rounded"
                              title="Ver historial de cambios de precio"
                            >
                              <History className="h-3.5 w-3.5 text-slate-500" />
                              <span className="hidden md:inline">Historial</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirEditar(p)}
                              className="h-7 text-xs gap-1 text-[#1C96C5] border-sky-300 hover:bg-sky-50 rounded"
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
        </div>
      </div>

      {/* Modal Fijar / Modificar Precio */}
      {modalAbierto && (
        <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
          <DialogContent className="w-full sm:max-w-2xl p-5 sm:p-6 rounded border border-slate-200">
            <DialogHeader className="border-b border-slate-200 pb-2">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Tag className="h-4 w-4 text-[#1C96C5]" />
                <span>Establecer Precio de Venta Oficial</span>
              </DialogTitle>
            </DialogHeader>

            {itemEditar && (
              <form onSubmit={handleGuardar} className="space-y-3 pt-2">
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <p className="font-semibold text-xs text-slate-900">{itemEditar.NombreProducto}</p>
                  <p className="text-[11px] text-slate-600">
                    {itemEditar.TipoContenedor} - Código: <span className="font-mono">{itemEditar.CodigoPresentacion}</span>
                  </p>
                </div>

                <div>
                  <Label htmlFor="PrecioUnitario" className="text-xs font-semibold text-slate-800">Precio Unitario (Bs) *</Label>
                  <Input
                    id="PrecioUnitario"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ej. 18.50"
                    value={formPrecio.PrecioUnitario}
                    onChange={(e) => setFormPrecio({ ...formPrecio, PrecioUnitario: e.target.value })}
                    required
                    className="mt-1 h-8 text-xs font-mono font-bold rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="PrecioMayorista" className="text-xs font-semibold text-slate-800">Precio Mayorista (Bs)</Label>
                    <Input
                      id="PrecioMayorista"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ej. 16.00"
                      value={formPrecio.PrecioMayorista}
                      onChange={(e) => setFormPrecio({ ...formPrecio, PrecioMayorista: e.target.value })}
                      className="mt-1 h-8 text-xs font-mono rounded"
                    />
                  </div>
                  <div>
                    <Label htmlFor="CantidadMinimaMayorista" className="text-xs font-semibold text-slate-800">Cantidad Mínima</Label>
                    <Input
                      id="CantidadMinimaMayorista"
                      type="number"
                      min="1"
                      value={formPrecio.CantidadMinimaMayorista}
                      onChange={(e) => setFormPrecio({ ...formPrecio, CantidadMinimaMayorista: e.target.value })}
                      className="mt-1 h-8 text-xs font-mono rounded"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="VigenteDesde" className="text-xs font-semibold text-slate-800">Vigente a partir de</Label>
                  <Input
                    id="VigenteDesde"
                    type="date"
                    value={formPrecio.VigenteDesde}
                    onChange={(e) => setFormPrecio({ ...formPrecio, VigenteDesde: e.target.value })}
                    required
                    className="mt-1 h-8 text-xs rounded"
                  />
                </div>

                <DialogFooter className="pt-2 border-t border-slate-200">
                  <Button type="button" variant="outline" size="sm" onClick={() => setModalAbierto(false)} className="rounded h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" className="bg-[#1C96C5] hover:bg-[#157A9E] text-white rounded h-8 text-xs font-semibold" disabled={guardando}>
                    {guardando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
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
          <DialogContent className="w-full sm:max-w-2xl p-5 rounded border border-slate-200">
            <DialogHeader className="border-b border-slate-200 pb-2">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="h-4 w-4 text-[#1C96C5]" />
                <span>Historial Cronológico de Precios</span>
              </DialogTitle>
            </DialogHeader>

            {itemHistorial && (
              <div className="space-y-3 pt-1">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{itemHistorial.NombreProducto}</p>
                      <p className="text-[11px] text-slate-600">
                        {itemHistorial.TipoContenedor} • Código: <span className="font-mono">{itemHistorial.CodigoPresentacion}</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700">
                      Presentación #{itemHistorial.IdPresentacion}
                    </span>
                  </div>
                </div>

                {cargandoHistorial ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1C96C5]" />
                  </div>
                ) : historialItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-600 border border-dashed rounded">
                    No se registran cambios históricos de precio para este producto.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
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
                          <tr key={`hist-${h.IdPrecioProducto || i}-${i}`} className={`hover:bg-slate-50 ${i === 0 ? "bg-emerald-50/20" : ""}`}>
                            <td className="p-2.5 font-mono text-slate-700 font-medium">
                              {h.VigenteDesde ? String(h.VigenteDesde).split("T")[0] : "—"}
                            </td>
                            <td className="p-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                              Bs. {Number(h.PrecioUnitario || 0).toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                              {h.PrecioMayorista ? `Bs. ${Number(h.PrecioMayorista).toFixed(2)}` : "—"}
                            </td>
                            <td className="p-2.5 text-center text-slate-600 font-mono tabular-nums">
                              {h.CantidadMinimaMayorista ? `≥ ${h.CantidadMinimaMayorista} un.` : "—"}
                            </td>
                            <td className="p-2.5 text-center">
                              <StatusBadge
                                estado={h.Activo ? "VIGENTE" : "HISTÓRICO"}
                                variant={h.Activo ? "success" : "neutral"}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <DialogFooter className="pt-2 border-t border-slate-200">
                  <Button variant="outline" size="sm" onClick={() => setModalHistorialAbierto(false)} className="rounded h-8 text-xs">
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
