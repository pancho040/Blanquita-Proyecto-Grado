import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Truck,
  Printer,
  RefreshCw,
  AlertCircle,
  Package,
  Boxes,
  DollarSign,
  Search,
  CheckCircle2,
  AlertTriangle,
  User,
  ShieldCheck,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { ListarInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import { ObtenerRepartidores } from "@/services/Logistica/RutaService";

export default function InventarioCamionTab({
  usuario = null,
  choferPreseleccionado = null,
  asignacionPreseleccionada = null,
  alActualizar = null
}) {
  const [repartidores, setRepartidores] = useState([]);
  const [cargandoChoferes, setCargandoChoferes] = useState(true);
  const [choferId, setChoferId] = useState(null);

  const [inventario, setInventario] = useState([]);
  const [cargandoInventario, setCargandoInventario] = useState(false);
  const [errorInventario, setErrorInventario] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroStock, setFiltroStock] = useState("TODOS"); // 'TODOS' | 'CON_STOCK' | 'AGOTADOS'

  const esChofer = Number(usuario?.IdRol) === 6;

  // Formateadores numéricos de precisión boliviana
  const formatearBs = (val) =>
    Number(val || 0).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const formatearEntero = (val) =>
    Number(val || 0).toLocaleString("es-BO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

  // 1. Carga inicial de choferes
  useEffect(() => {
    let montado = true;
    async function inicializarChoferes() {
      try {
        setCargandoChoferes(true);
        const lista = await ObtenerRepartidores().catch(() => []);
        if (!montado) return;
        setRepartidores(lista || []);

        // Prioridad de selección: prop > rol chofer > primer repartidor
        let idSeleccionado = null;
        if (choferPreseleccionado) {
          idSeleccionado = Number(choferPreseleccionado);
        } else if (esChofer && usuario?.IdUsuario) {
          idSeleccionado = Number(usuario.IdUsuario);
        } else if (lista && lista.length > 0) {
          idSeleccionado = Number(lista[0].IdUsuario);
        }

        if (idSeleccionado) {
          setChoferId((prev) => prev || idSeleccionado);
        }
      } catch (err) {
        if (montado) {
          toast.error("Error al cargar lista de choferes de reparto.");
        }
      } finally {
        if (montado) {
          setCargandoChoferes(false);
        }
      }
    }

    inicializarChoferes();
    return () => {
      montado = false;
    };
  }, [choferPreseleccionado, esChofer, usuario?.IdUsuario]);

  // 2. Consulta de inventario del chofer
  const cargarInventario = useCallback(async (id) => {
    if (!id) return;
    try {
      setCargandoInventario(true);
      setErrorInventario(null);
      const data = await ListarInventarioChofer(id);
      setInventario(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err.message || "Error al obtener inventario móvil del camión";
      setErrorInventario(msg);
      toast.error(msg);
    } finally {
      setCargandoInventario(false);
    }
  }, []);

  useEffect(() => {
    if (choferId) {
      cargarInventario(choferId);
    }
  }, [choferId, cargarInventario]);

  // Información del chofer activo
  const choferSeleccionadoInfo = useMemo(() => {
    if (!choferId) return null;
    return repartidores.find((r) => Number(r.IdUsuario) === Number(choferId)) || null;
  }, [choferId, repartidores]);

  // Métricas KPI resumidas
  const metricas = useMemo(() => {
    let totalCargado = 0;
    let totalVendido = 0;
    let totalRemanente = 0;
    let valorTotalRemanente = 0;
    let valorTotalRevalorizado = 0;
    let ajusteRevalorizacionTotal = 0;
    let valorTotalVendidoSalida = 0;
    let itemsAgotados = 0;

    for (const item of inventario) {
      const cargado = Number(item.cantidad_cargada || 0);
      const vendido = Number(item.cantidad_vendida || 0);
      const remanente = Number(item.cantidad_remanente || 0);
      const precio = Number(item.precio_vigente_carga || 0);
      const precioActual = Number(item.precio_vigente_actual ?? precio);
      const valor = Number(item.valor_remanente ?? (remanente * precio));
      const valorReval = Number(item.valor_remanente_revalorizado ?? (remanente * precioActual));
      const ajuste = Number(item.diferencia_revalorizacion_bs ?? (valorReval - valor));

      totalCargado += cargado;
      totalVendido += vendido;
      totalRemanente += remanente;
      valorTotalRemanente += valor;
      valorTotalRevalorizado += valorReval;
      ajusteRevalorizacionTotal += ajuste;
      valorTotalVendidoSalida += (vendido * precio);

      if (remanente <= 0) {
        itemsAgotados += 1;
      }
    }

    const totalUnicoRendir = valorTotalVendidoSalida + valorTotalRevalorizado;

    return {
      totalCargado,
      totalVendido,
      totalRemanente,
      valorTotalRemanente,
      valorTotalRevalorizado,
      ajusteRevalorizacionTotal,
      valorTotalVendidoSalida,
      totalUnicoRendir,
      itemsAgotados,
      totalItems: inventario.length
    };
  }, [inventario]);

  // Filtrado de ítems
  const itemsFiltrados = useMemo(() => {
    return inventario.filter((item) => {
      const cumpleBusqueda =
        !busqueda ||
        (item.nombre_producto &&
          item.nombre_producto.toLowerCase().includes(busqueda.toLowerCase())) ||
        (item.codigo_presentacion &&
          item.codigo_presentacion.toLowerCase().includes(busqueda.toLowerCase())) ||
        (item.tipo_contenedor &&
          item.tipo_contenedor.toLowerCase().includes(busqueda.toLowerCase()));

      const remanente = Number(item.cantidad_remanente || 0);
      if (filtroStock === "CON_STOCK" && remanente <= 0) return false;
      if (filtroStock === "AGOTADOS" && remanente > 0) return false;

      return cumpleBusqueda;
    });
  }, [inventario, busqueda, filtroStock]);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR DE CONTROL (OCULTA EN IMPRESIÓN) */}
      {/* ============================================================== */}
      <div className="print:hidden bg-white border border-slate-200 rounded p-3 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Selector de Chofer */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
              <span>Chofer de Reparto:</span>
            </label>

            {esChofer ? (
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-800">
                <User className="h-3.5 w-3.5 text-slate-600" />
                <span>{usuario?.NombreCompleto || "Mi Camión Asignado"}</span>
                <span className="text-[10px] text-slate-500 font-mono">(ID: {usuario?.IdUsuario})</span>
              </div>
            ) : (
              <select
                value={choferId || ""}
                onChange={(e) => setChoferId(Number(e.target.value))}
                disabled={cargandoChoferes}
                className="h-8.5 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none min-w-[240px]"
              >
                {cargandoChoferes && <option value="">Cargando choferes...</option>}
                {!cargandoChoferes && repartidores.length === 0 && (
                  <option value="">No hay choferes disponibles</option>
                )}
                {repartidores.map((c) => (
                  <option key={c.IdUsuario} value={c.IdUsuario}>
                    {c.NombreCompleto || `Chofer #${c.IdUsuario}`} {c.Ci ? `(CI: ${c.Ci})` : ""}
                  </option>
                ))}
              </select>
            )}

            {asignacionPreseleccionada?.Placa && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                Placa: {asignacionPreseleccionada.Placa}
              </span>
            )}
          </div>

          {/* Acciones de Cabecera: Recargar e Imprimir */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => choferId && cargarInventario(choferId)}
              disabled={cargandoInventario || !choferId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Actualizar existencias en tiempo real"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-slate-600 ${cargandoInventario ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              onClick={handleImprimir}
              disabled={inventario.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 border border-transparent rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="Imprimir hoja de control de carga"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Imprimir Carga</span>
            </button>
          </div>
        </div>

        {/* Fila secundaria: Buscador y Filtro de Estado */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, presentación o producto..."
              className="w-full h-8 pl-8 pr-2.5 bg-white border border-slate-200 rounded text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500">Filtrar:</span>
            <button
              type="button"
              onClick={() => setFiltroStock("TODOS")}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                filtroStock === "TODOS"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Todos ({metricas.totalItems})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStock("CON_STOCK")}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                filtroStock === "CON_STOCK"
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Con Remanente ({metricas.totalItems - metricas.itemsAgotados})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStock("AGOTADOS")}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                filtroStock === "AGOTADOS"
                  ? "bg-amber-700 text-white border-amber-700"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Agotados ({metricas.itemsAgotados})
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. TARJETA DESTACADA: TOTAL ÚNICO A RENDIR CON DESGLOSE */}
      {/* ============================================================== */}
      <div className="print:hidden bg-slate-900 border border-slate-800 text-white rounded p-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
              <DollarSign className="h-4 w-4" />
              <span>Total Único a Rendir (Liquidación de Turno)</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-white mt-1">
              Bs. {formatearBs(metricas.totalUnicoRendir)}
            </div>
          </div>
          <div className="flex flex-col sm:items-end gap-1 text-xs border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-4">
            <div className="flex items-center justify-between sm:justify-end gap-2 text-slate-300">
              <span>Ventas en ruta (a precio salida):</span>
              <span className="font-mono font-bold text-white">Bs. {formatearBs(metricas.valorTotalVendidoSalida)}</span>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 text-slate-300">
              <span>Sobrante en camión (a precio vigente):</span>
              <span className="font-mono font-bold text-sky-300">Bs. {formatearBs(metricas.valorTotalRevalorizado)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. RESUMEN KPI COMPACTO DE ALTA DENSIDAD */}
      {/* ============================================================== */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* KPI 1: Remanente Físico Actual */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Remanente en Camión</span>
            <Boxes className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatearEntero(metricas.totalRemanente)}
            </span>
            <span className="text-[11px] text-slate-500">unidades/fardos</span>
          </div>
        </div>

        {/* KPI 2: Cantidad Vendida en Ruta */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Vendido en Ruta</span>
            <Package className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono tabular-nums text-emerald-700">
              {formatearEntero(metricas.totalVendido)}
            </span>
            <span className="text-[11px] text-slate-500">entregados</span>
          </div>
        </div>

        {/* KPI 3: Stock Cargado Inicial */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Carga Inicial Total</span>
            <Truck className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-800">
              {formatearEntero(metricas.totalCargado)}
            </span>
            <span className="text-[11px] text-slate-500">despachados</span>
          </div>
        </div>

        {/* KPI 4: Valor Total Remanente (Bs) */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Valor Remanente (Salida)</span>
            <DollarSign className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              Bs. {formatearBs(metricas.valorTotalRemanente)}
            </span>
            <span className="text-[11px] text-slate-500">precio carga</span>
          </div>
        </div>

        {/* KPI 5: Valor Revalorizado Vigente */}
        <div className="col-span-2 sm:col-span-4 bg-emerald-50/50 border border-emerald-200 rounded p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" strokeWidth={2} />
            <div>
              <span className="text-xs font-bold text-emerald-900">
                Valoración a Precio Vigente de Sucursal (Revalorización):
              </span>
              <p className="text-[11px] text-emerald-700">
                Al cierre de turno o traspaso al día siguiente, el sobrante se rinde al precio vigente.
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-3 self-end sm:self-auto">
            <div className="text-right">
              <span className="text-xs text-slate-600 mr-1.5">Ajuste Neto:</span>
              <span className={`text-xs font-mono font-bold ${metricas.ajusteRevalorizacionTotal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {metricas.ajusteRevalorizacionTotal >= 0 ? "+" : ""}Bs. {formatearBs(metricas.ajusteRevalorizacionTotal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-900">
                Bs. {formatearBs(metricas.valorTotalRevalorizado)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. ENCABEZADO FORMAL EXCLUSIVO PARA IMPRESIÓN (@media print) */}
      {/* ============================================================== */}
      <div className="hidden print:block border-b border-slate-400 pb-3 mb-3 text-black">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-base font-bold tracking-tight uppercase">Papelera Blanquita S.R.L.</h1>
            <h2 className="text-xs font-bold text-slate-700 uppercase">
              Control de Inventario Móvil y Carga de Camión
            </h2>
            <p className="text-[10px] text-slate-600">
              Operaciones de Reparto y Distribución Comercial — Sucre / Potosí
            </p>
          </div>
          <div className="text-right text-[11px]">
            <p><span className="font-semibold">Fecha Emisión:</span> {new Date().toLocaleDateString("es-BO")} {new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</p>
            <p><span className="font-semibold">Chofer:</span> {choferSeleccionadoInfo?.NombreCompleto || `ID ${choferId}`}</p>
            {choferSeleccionadoInfo?.Ci && <p><span className="font-semibold">CI:</span> {choferSeleccionadoInfo.Ci}</p>}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-300 text-[10px]">
          <div><span className="font-semibold">Carga Inicial:</span> {formatearEntero(metricas.totalCargado)} fardos</div>
          <div><span className="font-semibold">Vendido en Ruta:</span> {formatearEntero(metricas.totalVendido)} fardos</div>
          <div><span className="font-semibold">Remanente Físico:</span> {formatearEntero(metricas.totalRemanente)} fardos</div>
          <div><span className="font-semibold">Valor Remanente:</span> Bs. {formatearBs(metricas.valorTotalRemanente)}</div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. TABLA OPERATIVA DE ALTA DENSIDAD */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden print:border-slate-400 print:rounded-none">
        {/* ESTADO: CARGANDO */}
        {cargandoInventario && (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-400" />
            <p className="text-xs font-medium">Consultando inventario físico en tiempo real...</p>
          </div>
        )}

        {/* ESTADO: ERROR */}
        {!cargandoInventario && errorInventario && (
          <div className="p-6 text-center text-red-700 bg-red-50 border-b border-red-200 space-y-2">
            <AlertCircle className="h-5 w-5 mx-auto text-red-600" />
            <p className="text-xs font-semibold">{errorInventario}</p>
            <button
              type="button"
              onClick={() => choferId && cargarInventario(choferId)}
              className="px-3 py-1 bg-red-700 text-white rounded text-xs font-medium hover:bg-red-800 transition-colors"
            >
              Reintentar Consulta
            </button>
          </div>
        )}

        {/* ESTADO: LISTA VACÍA */}
        {!cargandoInventario && !errorInventario && itemsFiltrados.length === 0 && (
          <div className="p-10 text-center text-slate-500 space-y-2">
            <Boxes className="h-8 w-8 mx-auto text-slate-300" strokeWidth={1.5} />
            <p className="text-xs font-semibold text-slate-700">No se registraron productos en el camión</p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              {inventario.length === 0
                ? "Este chofer no tiene despacho de mercadería activo para hoy o su carga ya fue liquidada."
                : "No hay productos que coincidan con el filtro o búsqueda aplicada."}
            </p>
          </div>
        )}

        {/* TABLA PRINCIPAL DE EXISTENCIAS */}
        {!cargandoInventario && !errorInventario && itemsFiltrados.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider print:bg-slate-100 print:border-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Presentación / Producto</th>
                  <th className="px-3 py-2 text-left">Tipo Contenedor</th>
                  <th className="px-3 py-2 text-right">Carga Inicial</th>
                  <th className="px-3 py-2 text-right">Vendido en Ruta</th>
                  <th className="px-3 py-2 text-right">Remanente Camión</th>
                  <th className="px-3 py-2 text-right">P. Salida (Bs)</th>
                  <th className="px-3 py-2 text-right">P. Vigente (Bs)</th>
                  <th className="px-3 py-2 text-right">Subtotal Revalorizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 print:divide-slate-300">
                {itemsFiltrados.map((item) => {
                  const remanente = Number(item.cantidad_remanente || 0);
                  const cargado = Number(item.cantidad_cargada || 0);
                  const vendido = Number(item.cantidad_vendida || 0);
                  const precioCarga = Number(item.precio_vigente_carga || 0);
                  const precioActual = Number(item.precio_vigente_actual ?? precioCarga);
                  const subtotalReval = Number(item.valor_remanente_revalorizado ?? (remanente * precioActual));
                  const difReval = Number(item.diferencia_revalorizacion_bs ?? ((precioActual - precioCarga) * remanente));
                  const agotado = remanente <= 0;

                  return (
                    <tr
                      key={item.id || item.presentacion_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        agotado ? "bg-amber-50/30" : ""
                      }`}
                    >
                      {/* 1. Presentación / Producto */}
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {item.nombre_producto || "Producto"}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {item.codigo_presentacion || "S/C"}
                          </span>
                        </div>
                      </td>

                      {/* 2. Tipo Contenedor */}
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 print:border-none print:p-0">
                          {item.tipo_contenedor || "Fardo / Paquete"}
                        </span>
                      </td>

                      {/* 3. Stock Inicial Cargado */}
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                        {formatearEntero(cargado)}
                      </td>

                      {/* 4. Cantidad Vendida en Ruta */}
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {formatearEntero(vendido)}
                      </td>

                      {/* 5. Remanente Físico en Camión (con alerta sutil si remanente = 0) */}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {agotado ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 print:text-black">
                              <AlertTriangle className="h-2.5 w-2.5 text-amber-600 print:hidden" />
                              Agotado en ruta
                            </span>
                          ) : null}
                          <span
                            className={`font-mono tabular-nums font-bold ${
                              agotado ? "text-amber-800" : "text-slate-900"
                            }`}
                          >
                            {formatearEntero(remanente)}
                          </span>
                        </div>
                      </td>

                      {/* 6. Precio Carga (Salida) */}
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                        {formatearBs(precioCarga)}
                      </td>

                      {/* 7. Precio Vigente Sucursal */}
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatearBs(precioActual)}
                        {difReval !== 0 && (
                          <span className={`block text-[10px] ${difReval > 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {difReval > 0 ? "+" : ""}{formatearBs(difReval)} Bs
                          </span>
                        )}
                      </td>

                      {/* 8. Subtotal Revalorizado (Bs) */}
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatearBs(subtotalReval)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* PIE DE TABLA CON TOTALES CONSOLIDADOS */}
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-900 print:bg-slate-100">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-left uppercase text-[11px] tracking-wider text-slate-600">
                    Total General en Camión ({itemsFiltrados.length} líneas)
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatearEntero(
                      itemsFiltrados.reduce((acc, i) => acc + Number(i.cantidad_cargada || 0), 0)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700">
                    {formatearEntero(
                      itemsFiltrados.reduce((acc, i) => acc + Number(i.cantidad_vendida || 0), 0)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-bold">
                    {formatearEntero(
                      itemsFiltrados.reduce((acc, i) => acc + Number(i.cantidad_remanente || 0), 0)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 font-mono text-[11px]">-</td>
                  <td className="px-3 py-2 text-right text-slate-400 font-mono text-[11px]">-</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-emerald-800">
                    Bs. {formatearBs(
                      itemsFiltrados.reduce(
                        (acc, i) =>
                          acc +
                          Number(
                            i.valor_remanente_revalorizado ??
                              (Number(i.cantidad_remanente || 0) * Number(i.precio_vigente_actual ?? i.precio_vigente_carga ?? 0))
                          ),
                        0
                      )
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 5. FIRMAS DE CONFORMIDAD EXCLUSIVAS PARA IMPRESIÓN */}
      {/* ============================================================== */}
      <div className="hidden print:grid grid-cols-2 gap-12 pt-16 mt-8 text-center text-xs">
        <div className="border-t border-black pt-2">
          <p className="font-bold text-black uppercase">Firma y Sello Chofer</p>
          <p className="text-[10px] text-slate-600">
            {choferSeleccionadoInfo?.NombreCompleto || "Conformidad Chofer de Reparto"}
          </p>
        </div>
        <div className="border-t border-black pt-2">
          <p className="font-bold text-black uppercase">Firma y Sello Supervisor de Despachos</p>
          <p className="text-[10px] text-slate-600">Control de Almacén y Rutas — Papelera Blanquita</p>
        </div>
      </div>
    </div>
  );
}
