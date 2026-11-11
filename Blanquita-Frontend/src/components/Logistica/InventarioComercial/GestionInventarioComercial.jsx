import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import {
  Boxes,
  Truck,
  Calendar,
  Printer,
  RefreshCw,
  Search
} from "lucide-react";
import { toast } from "sonner";
import {
  ObtenerInventarioSucursal,
  ObtenerReporteInventarioValorizado,
  CargarChofer
} from "@/services/Logistica/InventarioComercialService";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";

export default function GestionInventarioComercial({ usuario = null }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: false,
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

  const cargarDatos = useCallback(async () => {
    const sidNum = Number(sucursal) || 1;
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
  }, [sucursal, pestaña, fechaCorte]);

  useEffect(() => {
    if (!cargandoAlcance) {
      cargarDatos();
    }
  }, [sucursal, pestaña, fechaCorte, cargandoAlcance, cargarDatos]);

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
        sucursal_id: Number(sucursal),
        items: [{ presentacion_id: Number(formCarga.presentacion_id), cantidad: cantNum }]
      });
      toast.success("Mercadería cargada exitosamente al camión del chofer.");
      setModalCargaAbierto(false);
      setFormCarga({ chofer_id: "", presentacion_id: "", cantidad: "" });
      cargarDatos();
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
    <div className="space-y-4">
      {/* Cabecera Principal */}
      <PageHeader
        title="Inventario Comercial de Sucursal"
        subtitle="Gestión de stock físico, traslados a camiones y valoración formal por almacén."
        branchFilter={
          <BranchFilter
            sucursal={sucursal}
            onChange={setSucursal}
            sucursales={sucursalesPermitidas}
            esMultisede={esMultisede}
            permiteTodas={false}
          />
        }
      >
        <button
          onClick={() => setModalCargaAbierto(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-semibold rounded cursor-pointer shadow-none"
        >
          <Truck size={15} />
          Cargar Camión a Chofer
        </button>
        <button
          onClick={() => cargarDatos()}
          className="p-1.5 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
          title="Refrescar datos"
        >
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
      </PageHeader>

      {/* Tabs de Navegación */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setPestaña("inventario")}
          className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            pestaña === "inventario"
              ? "border-[#1C96C5] text-[#1C96C5]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Stock Físico Disponible
        </button>
        <button
          onClick={() => setPestaña("reporte")}
          className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            pestaña === "reporte"
              ? "border-[#1C96C5] text-[#1C96C5]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Reporte Valorizado de Inventario
        </button>
      </div>

      {/* VISTA 1: INVENTARIO FÍSICO DISPONIBLE */}
      {pestaña === "inventario" && (
        <div className="space-y-4">
          {/* Métricas Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white rounded border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Presentaciones Registradas</span>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">{itemsInventario.length}</p>
            </div>
            <div className="p-4 bg-white rounded border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Bultos Disponibles</span>
              <p className="text-2xl font-bold font-mono text-[#1C96C5] tabular-nums mt-1">
                {itemsInventario.reduce((acc, c) => acc + (Number(c.cantidad_disponible) || 0), 0)}
              </p>
            </div>
            <div className="p-4 bg-white rounded border border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Valor Monetario Total</span>
              <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums mt-1">
                Bs. {totalValorSucursal.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-500 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Buscar por producto, empaque (Jaba/Plancha) o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-white text-xs border border-slate-300 rounded focus:outline-none focus:border-[#1C96C5]"
            />
          </div>

          {/* Tabla de Stock */}
          <div className="bg-white border border-slate-200 rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3">Empaque</th>
                    <th className="py-2.5 px-3 text-right">Disponible</th>
                    <th className="py-2.5 px-3 text-right">Reservado</th>
                    <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cargando ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500">
                        Cargando existencias comerciales...
                      </td>
                    </tr>
                  ) : itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500">
                        No hay existencias registradas en esta sucursal.
                      </td>
                    </tr>
                  ) : (
                    paginacion.itemsPaginados.map((it, idx) => (
                      <tr key={`${it.id}-${it.presentacion_id || idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{it.codigo_presentacion}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{it.nombre_producto}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium text-[11px] text-slate-700">
                            {it.tipo_contenedor}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {Number(it.cantidad_disponible).toFixed(0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                          {Number(it.cantidad_reservada).toFixed(0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                          Bs. {Number(it.precio_unitario_vigente).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded border border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-slate-600" />
              <label className="text-xs font-semibold text-slate-800">Fecha de Corte Histórica:</label>
              <input
                type="date"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800"
              />
            </div>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded cursor-pointer"
            >
              <Printer size={14} />
              Imprimir Reporte Paisaje
            </button>
          </div>

          {reporteValorizado && (
            <div className="bg-white border border-slate-200 rounded p-5 print:p-0 print:border-none">
              <div className="border-b border-slate-200 pb-3 mb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Papelera Blanquita S.R.L.</h2>
                  <p className="text-xs text-slate-600">
                    Reporte Oficial de Inventario Valorizado - {reporteValorizado.sucursal_nombre}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Corte: {new Date(reporteValorizado.fecha_corte).toLocaleDateString("es-BO")}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Valor Total Inventario</span>
                  <p className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                    Bs. {Number(reporteValorizado.valor_total_inventario).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Producto</th>
                    <th className="py-2 px-3">Empaque</th>
                    <th className="py-2 px-3 text-right">Existencia Física</th>
                    <th className="py-2 px-3 text-right">Precio Unitario</th>
                    <th className="py-2 px-3 text-right">Subtotal Bs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {reporteValorizado.items.map((it, idx) => (
                    <tr key={`rep-val-${it.presentacion_id || it.codigo_presentacion || idx}-${idx}`}>
                      <td className="py-2 px-3 font-mono font-medium">{it.codigo_presentacion}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{it.nombre_producto}</td>
                      <td className="py-2 px-3">{it.tipo_contenedor}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">{Number(it.cantidad_disponible).toFixed(0)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">Bs. {Number(it.precio_unitario).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        Bs. {Number(it.subtotal_valorizado).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pie de firmas para impresión */}
              <div className="hidden print:grid grid-cols-2 gap-8 mt-12 pt-6 border-t border-slate-300 text-center text-xs text-slate-700">
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded max-w-md w-full p-5 border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Truck size={18} className="text-[#1C96C5]" />
                Cargar Camión de Chofer
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Descuenta stock de la sucursal activa y carga al inventario del repartidor con el precio oficial vigente.
              </p>
            </div>

            <form onSubmit={handleCargarChofer} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1">ID de Chofer / Repartidor:</label>
                <input
                  type="number"
                  placeholder="Ej. 1"
                  required
                  value={formCarga.chofer_id}
                  onChange={(e) => setFormCarga({ ...formCarga, chofer_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#1C96C5]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1">Presentación a Despachar:</label>
                <select
                  required
                  value={formCarga.presentacion_id}
                  onChange={(e) => setFormCarga({ ...formCarga, presentacion_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#1C96C5] bg-white"
                >
                  <option value="">Seleccione presentación...</option>
                  {itemsInventario.map((it, idx) => (
                    <option key={`opt-carga-${it.presentacion_id || it.id || idx}-${idx}`} value={it.presentacion_id}>
                      {it.nombre_producto} ({it.codigo_presentacion} - {it.tipo_contenedor}) - Disp: {Number(it.cantidad_disponible).toFixed(0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-800 block mb-1">Cantidad de Bultos a Cargar:</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej. 25"
                  required
                  value={formCarga.cantidad}
                  onChange={(e) => setFormCarga({ ...formCarga, cantidad: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-[#1C96C5] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalCargaAbierto(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCarga}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1C96C5] hover:bg-[#157A9E] rounded transition-colors cursor-pointer disabled:opacity-50"
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
