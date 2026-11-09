import React, { useState, useEffect } from "react";
import {
  Boxes,
  Truck,
  Calendar,
  Printer,
  Download,
  PlusCircle,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  ObtenerInventarioSucursal,
  ObtenerReporteInventarioValorizado,
  CargarChofer
} from "@/services/Logistica/InventarioComercialService";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";

export default function GestionInventarioComercial() {
  const [sucursalId, setSucursalId] = useState(() => {
    if (typeof window !== "undefined") {
      const g = localStorage.getItem("blanquita_sucursal_activa");
      return g && g !== "todas" ? Number(g) : 1;
    }
    return 1;
  });

  const [pestaña, setPestaña] = useState("inventario"); // 'inventario' | 'reporte'
  const [itemsInventario, setItemsInventario] = useState([]);
  const [reporteValorizado, setReporteValorizado] = useState(null);
  const [fechaCorte, setFechaCorte] = useState(() => new Date().toISOString().split("T")[0]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  // Modal de Carga a Chofer
  const [modalCargaAbierto, setModalCargaAbierto] = useState(false);
  const [formCarga, setFormCarga] = useState({
    chofer_id: "",
    presentacion_id: "",
    cantidad: ""
  });
  const [guardandoCarga, setGuardandoCarga] = useState(false);

  const cargarDatos = async (sid = sucursalId) => {
    const sidNum = sid && sid !== "todas" ? Number(sid) : 1;
    setCargando(true);
    try {
      if (pestaña === "inventario") {
        const data = await ObtenerInventarioSucursal(sidNum);
        setItemsInventario(data || []);
      } else {
        const data = await ObtenerReporteInventarioValorizado(sidNum, fechaCorte);
        setReporteValorizado(data);
      }
    } catch (err) {
      toast.error(err.message || "Error al cargar inventario comercial.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos(sucursalId);

    const handler = (e) => {
      const sid = e.detail?.sucursalId || "1";
      const numSid = sid !== "todas" ? Number(sid) : 1;
      setSucursalId(numSid);
      cargarDatos(numSid);
    };
    window.addEventListener("sucursal_cambiada", handler);
    return () => window.removeEventListener("sucursal_cambiada", handler);
  }, [pestaña, fechaCorte]);

  const handleCargarChofer = async (e) => {
    e.preventDefault();
    if (!formCarga.chofer_id || !formCarga.presentacion_id || !formCarga.cantidad) {
      toast.error("Por favor complete todos los campos de la carga.");
      return;
    }
    const cantNum = Number(formCarga.cantidad);
    if (cantNum <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    setGuardandoCarga(true);
    try {
      await CargarChofer({
        chofer_id: Number(formCarga.chofer_id),
        sucursal_id: sucursalId,
        items: [{ presentacion_id: Number(formCarga.presentacion_id), cantidad: cantNum }]
      });
      toast.success("Mercadería cargada exitosamente al camión del chofer.");
      setModalCargaAbierto(false);
      setFormCarga({ chofer_id: "", presentacion_id: "", cantidad: "" });
      cargarDatos(sucursalId);
    } catch (err) {
      toast.error(err.message || "Error al cargar mercadería al chofer.");
    } finally {
      setGuardandoCarga(false);
    }
  };

  const itemsFiltrados = itemsInventario.filter((item) => {
    const texto = `${item.nombre_producto} ${item.codigo_presentacion} ${item.tipo_contenedor}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const paginacion = usePaginacion(itemsFiltrados, 10);
  const totalValorSucursal = itemsInventario.reduce((acc, curr) => acc + (Number(curr.valor_total_disponible) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[#20A7DB]/10 text-[#20A7DB] rounded-xl">
              <Boxes size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Inventario Comercial de Sucursal</h1>
              <p className="text-xs text-slate-500">
                Gestión de stock físico, traslados a camiones y valoración formal (Sede: {sucursalId === 1 ? "Sucre" : sucursalId === 2 ? "Potosí" : `#${sucursalId}`})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalCargaAbierto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#20A7DB] hover:bg-[#1B92C0] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Truck size={16} />
            Cargar Camión a Chofer
          </button>
          <button
            onClick={() => cargarDatos(sucursalId)}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refrescar datos"
          >
            <RefreshCw size={16} className={cargando ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs de Navegación */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setPestaña("inventario")}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            pestaña === "inventario"
              ? "border-[#20A7DB] text-[#20A7DB]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Stock Físico Disponible
        </button>
        <button
          onClick={() => setPestaña("reporte")}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            pestaña === "reporte"
              ? "border-[#20A7DB] text-[#20A7DB]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Reporte Valorizado de Inventario
        </button>
      </div>

      {/* VISTA 1: INVENTARIO FÍSICO DISPONIBLE */}
      {pestaña === "inventario" && (
        <div className="space-y-4">
          {/* Métricas Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Presentaciones Registradas</span>
              <p className="text-2xl font-bold text-slate-800 mt-1">{itemsInventario.length}</p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Bultos Disponibles</span>
              <p className="text-2xl font-bold text-[#20A7DB] mt-1">
                {itemsInventario.reduce((acc, c) => acc + (Number(c.cantidad_disponible) || 0), 0)}
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Valor Monetario Total</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                Bs. {totalValorSucursal.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por producto, empaque (Jaba/Plancha) o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#20A7DB]/30"
            />
          </div>

          {/* Tabla de Stock */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Empaque</th>
                    <th className="py-3 px-4 text-right">Disponible</th>
                    <th className="py-3 px-4 text-right">Reservado</th>
                    <th className="py-3 px-4 text-right">Precio Unitario</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cargando ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        Cargando existencias comerciales...
                      </td>
                    </tr>
                  ) : itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        No hay existencias registradas en esta sucursal.
                      </td>
                    </tr>
                  ) : (
                    paginacion.itemsPaginados.map((it, idx) => (
                      <tr key={`${it.id}-${it.presentacion_id || idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{it.codigo_presentacion}</td>
                        <td className="py-3 px-4 font-medium">{it.nombre_producto}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium text-[11px] text-slate-700">
                            {it.tipo_contenedor}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {Number(it.cantidad_disponible).toFixed(0)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          {Number(it.cantidad_reservada).toFixed(0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          Bs. {Number(it.precio_unitario_vigente).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                          Bs. {Number(it.valor_total_disponible).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {itemsFiltrados.length > 0 && <PaginacionTabla {...paginacion} />}
          </div>
        </div>
      )}

      {/* VISTA 2: REPORTE VALORIZADO FORMAL */}
      {pestaña === "reporte" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-500" />
              <label className="text-xs font-semibold text-slate-700">Fecha de Corte Histórica:</label>
              <input
                type="date"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              <Printer size={15} />
              Imprimir Reporte Paisaje
            </button>
          </div>

          {reporteValorizado && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs print:p-0 print:border-none print:shadow-none">
              <div className="border-b border-slate-200 pb-4 mb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Papelera Blanquita S.R.L.</h2>
                  <p className="text-xs text-slate-500">
                    Reporte Oficial de Inventario Valorizado - {reporteValorizado.sucursal_nombre}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Corte: {new Date(reporteValorizado.fecha_corte).toLocaleDateString("es-BO")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor Total Inventario</span>
                  <p className="text-xl font-black text-emerald-700">
                    Bs. {Number(reporteValorizado.valor_total_inventario).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3">Empaque</th>
                    <th className="py-2.5 px-3 text-right">Existencia F física</th>
                    <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                    <th className="py-2.5 px-3 text-right">Subtotal Bs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reporteValorizado.items.map((it) => (
                    <tr key={it.presentacion_id}>
                      <td className="py-2 px-3 font-mono">{it.codigo_presentacion}</td>
                      <td className="py-2 px-3 font-medium">{it.nombre_producto}</td>
                      <td className="py-2 px-3">{it.tipo_contenedor}</td>
                      <td className="py-2 px-3 text-right font-bold">{Number(it.cantidad_disponible).toFixed(0)}</td>
                      <td className="py-2 px-3 text-right">Bs. {Number(it.precio_unitario).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        Bs. {Number(it.subtotal_valorizado).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pie de firmas para impresión */}
              <div className="hidden print:grid grid-cols-2 gap-8 mt-16 pt-8 border-t border-slate-300 text-center text-xs text-slate-600">
                <div>
                  <div className="border-t border-slate-400 w-48 mx-auto mb-1"></div>
                  <span>Responsable de Almacén / Sucursal</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 w-48 mx-auto mb-1"></div>
                  <span>V°B° Don Osvaldo / Contabilidad</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CARGA A CHOFER */}
      {modalCargaAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Truck size={18} className="text-[#20A7DB]" />
              Cargar Camión de Chofer
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Descuenta stock de la sucursal activa y carga al inventario del repartidor con el precio oficial vigente.
            </p>

            <form onSubmit={handleCargarChofer} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ID de Chofer / Repartidor:</label>
                <input
                  type="number"
                  placeholder="Ej. 1"
                  required
                  value={formCarga.chofer_id}
                  onChange={(e) => setFormCarga({ ...formCarga, chofer_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20A7DB]/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Presentación a Despachar:</label>
                <select
                  required
                  value={formCarga.presentacion_id}
                  onChange={(e) => setFormCarga({ ...formCarga, presentacion_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20A7DB]/30 bg-white"
                >
                  <option value="">Seleccione presentación...</option>
                  {itemsInventario.map((it) => (
                    <option key={it.presentacion_id} value={it.presentacion_id}>
                      {it.nombre_producto} ({it.codigo_presentacion} - {it.tipo_contenedor}) - Disp: {Number(it.cantidad_disponible).toFixed(0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Cantidad de Bultos a Cargar:</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej. 25"
                  required
                  value={formCarga.cantidad}
                  onChange={(e) => setFormCarga({ ...formCarga, cantidad: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20A7DB]/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalCargaAbierto(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCarga}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#20A7DB] hover:bg-[#1B92C0] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {guardandoCarga ? "Cargando..." : "Confirmar Carga"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
