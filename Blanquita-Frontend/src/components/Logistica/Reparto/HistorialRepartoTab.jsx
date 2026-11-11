import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Search,
  Calendar,
  User,
  Truck,
  Printer,
  Eye,
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  DollarSign,
  PenTool,
  RefreshCw,
  ImageIcon,
  ZoomIn,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import {
  ObtenerNotasVenta,
  ObtenerNotaVentaDetalle
} from "@/services/Contabilidad/cuentasCobrarService";
import {
  ObtenerRepartidores,
  ObtenerAsignaciones
} from "@/services/Logistica/RutaService";

export default function HistorialRepartoTab({
  usuario = null,
  choferPreseleccionado = null,
  fechaInicial = null,
  alActualizar = null
}) {
  // Pestaña activa dentro del historial
  const [seccionActiva, setSeccionActiva] = useState("notas"); // 'notas' | 'cierres'

  // Catálogo de choferes
  const [repartidores, setRepartidores] = useState([]);
  const [cargandoChoferes, setCargandoChoferes] = useState(true);

  // Filtros
  const hoyStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [fechaDesde, setFechaDesde] = useState(fechaInicial || hoyStr);
  const [fechaHasta, setFechaHasta] = useState(fechaInicial || hoyStr);
  const [filtroChoferId, setFiltroChoferId] = useState(
    choferPreseleccionado ? String(choferPreseleccionado) : "TODOS"
  );
  const [filtroFormaPago, setFiltroFormaPago] = useState("TODOS"); // 'TODOS' | 'Efectivo' | 'QR' | 'Credito'
  const [filtroEstadoCobro, setFiltroEstadoCobro] = useState("TODOS"); // 'TODOS' | 'Aprobado' | 'Pendiente'
  const [busqueda, setBusqueda] = useState("");

  // Datos de notas de venta
  const [notas, setNotas] = useState([]);
  const [cargandoNotas, setCargandoNotas] = useState(false);
  const [errorNotas, setErrorNotas] = useState(null);

  // Datos de cierres / asignaciones de turno
  const [asignacionesTurno, setAsignacionesTurno] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);

  // Modales
  const [notaDetalle, setNotaDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [fotoModal, setFotoModal] = useState(null);
  const [notaImprimir, setNotaImprimir] = useState(null);

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
      maximumFractionDigits: 0
    });

  const formatearFechaHora = (fechaIso) => {
    if (!fechaIso) return "-";
    try {
      const d = new Date(fechaIso);
      if (isNaN(d.getTime())) return String(fechaIso);
      return d.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return String(fechaIso);
    }
  };

  // 1. Carga inicial de choferes
  useEffect(() => {
    let montado = true;
    async function cargarChoferes() {
      try {
        setCargandoChoferes(true);
        const lista = await ObtenerRepartidores().catch(() => []);
        if (!montado) return;
        setRepartidores(lista || []);

        if (esChofer && usuario?.IdUsuario) {
          setFiltroChoferId(String(usuario.IdUsuario));
        } else if (choferPreseleccionado) {
          setFiltroChoferId(String(choferPreseleccionado));
        }
      } catch (err) {
        if (montado) {
          toast.error("Error al cargar lista de choferes.");
        }
      } finally {
        if (montado) {
          setCargandoChoferes(false);
        }
      }
    }

    cargarChoferes();
    return () => {
      montado = false;
    };
  }, [choferPreseleccionado, esChofer, usuario?.IdUsuario]);

  // 2. Consulta de Notas de Venta en ruta
  const consultarNotas = useCallback(async () => {
    try {
      setCargandoNotas(true);
      setErrorNotas(null);

      const params = {
        fechaDesde,
        fechaHasta,
        busqueda: busqueda.trim(),
        limit: 150
      };

      const res = await ObtenerNotasVenta(params);
      const lista = Array.isArray(res) ? res : res?.items || [];
      setNotas(lista);
    } catch (err) {
      const msg = err.message || "Error al consultar historial de entregas.";
      setErrorNotas(msg);
      toast.error(msg);
    } finally {
      setCargandoNotas(false);
    }
  }, [fechaDesde, fechaHasta, busqueda]);

  // 3. Consulta de Cierres / Asignaciones
  const consultarTurnos = useCallback(async () => {
    try {
      setCargandoTurnos(true);
      const idRep = filtroChoferId !== "TODOS" ? Number(filtroChoferId) : null;
      const data = await ObtenerAsignaciones(fechaDesde, idRep).catch(() => []);
      setAsignacionesTurno(Array.isArray(data) ? data : []);
    } catch {
      setAsignacionesTurno([]);
    } finally {
      setCargandoTurnos(false);
    }
  }, [fechaDesde, filtroChoferId]);

  useEffect(() => {
    consultarNotas();
    if (seccionActiva === "cierres") {
      consultarTurnos();
    }
  }, [consultarNotas, consultarTurnos, seccionActiva]);

  // 4. Filtrado en memoria de notas de venta
  const notasFiltradas = useMemo(() => {
    return notas.filter((n) => {
      // Filtro por Chofer
      if (filtroChoferId !== "TODOS") {
        const idN = n.IdChofer || n.id_chofer || n.IdUsuarioRepartidor;
        if (String(idN) !== String(filtroChoferId)) {
          // Búsqueda por coincidencia de nombre si no viene el ID exacto
          const choferObj = repartidores.find((r) => String(r.IdUsuario) === String(filtroChoferId));
          const nombreBuscado = choferObj?.NombreCompleto?.toLowerCase() || "";
          const choferNota = (n.Chofer || n.NombreRepartidor || "").toLowerCase();
          if (!nombreBuscado || !choferNota.includes(nombreBuscado)) {
            return false;
          }
        }
      }

      // Filtro por Forma de Pago
      if (filtroFormaPago !== "TODOS") {
        const metodo = (n.MetodoPago || n.metodo_pago || "").toLowerCase();
        if (filtroFormaPago === "Efectivo" && !metodo.includes("efectivo")) return false;
        if (filtroFormaPago === "QR" && !metodo.includes("qr") && !metodo.includes("transferencia"))
          return false;
        if (filtroFormaPago === "Credito" && !metodo.includes("credito") && !metodo.includes("crédito"))
          return false;
      }

      // Filtro por Estado de Cobro
      if (filtroEstadoCobro !== "TODOS") {
        const saldo = Number(n.SaldoPendiente ?? n.saldo_pendiente ?? 0);
        const metodo = (n.MetodoPago || "").toLowerCase();
        const tieneComprobante = Boolean(n.ComprobanteQRArchivoId || n.UrlComprobante);

        if (filtroEstadoCobro === "Aprobado") {
          // Pagado totalmente o aprobado
          if (saldo > 0) return false;
        } else if (filtroEstadoCobro === "Pendiente") {
          // Pendiente QR o saldo deudor
          const esPendienteQR = metodo.includes("qr") && tieneComprobante && saldo > 0;
          if (saldo <= 0 && !esPendienteQR) return false;
        }
      }

      return true;
    });
  }, [notas, filtroChoferId, filtroFormaPago, filtroEstadoCobro, repartidores]);

  // 5. KPIs Resumidos del Historial
  const kpis = useMemo(() => {
    let totalEmitido = 0;
    let totalEfectivo = 0;
    let totalQR = 0;
    let totalCredito = 0;
    let notasConFirma = 0;

    for (const n of notasFiltradas) {
      const montoTotal = Number(n.TotalNeto ?? n.ImporteNeto ?? n.TotalVentaBruto ?? 0);
      const ef = Number(n.MontoEfectivo || 0);
      const qr = Number(n.MontoQR || 0);
      const cr = Number(n.MontoCredito ?? n.SaldoPendiente ?? 0);

      totalEmitido += montoTotal;
      totalEfectivo += ef;
      totalQR += qr;
      totalCredito += cr;

      if (n.FirmaDigitalUrl || n.FirmaNombre || n.firma_digital_url) {
        notasConFirma += 1;
      }
    }

    // Si los montos específicos son 0 pero hay método global, aproximar según total
    if (totalEfectivo === 0 && totalQR === 0 && totalCredito === 0 && totalEmitido > 0) {
      for (const n of notasFiltradas) {
        const tot = Number(n.TotalNeto ?? n.ImporteNeto ?? n.TotalVentaBruto ?? 0);
        const m = (n.MetodoPago || "").toLowerCase();
        if (m.includes("efectivo")) totalEfectivo += tot;
        else if (m.includes("qr") || m.includes("transferencia")) totalQR += tot;
        else if (m.includes("credito") || m.includes("crédito")) totalCredito += tot;
      }
    }

    return {
      totalNotas: notasFiltradas.length,
      totalEmitido,
      totalEfectivo,
      totalQR,
      totalCredito,
      notasConFirma
    };
  }, [notasFiltradas]);

  // 6. Acciones de Detalle, Imagen e Impresión
  const handleVerDetalle = async (nota) => {
    try {
      setCargandoDetalle(true);
      setNotaDetalle(nota);
      const id = nota.IdNotaVenta || nota.id_nota_venta || nota.id;
      if (id) {
        const completa = await ObtenerNotaVentaDetalle(id).catch(() => null);
        if (completa) {
          setNotaDetalle(completa);
        }
      }
    } catch {
      // usa los datos básicos si falla el detalle individual
    } finally {
      setCargandoDetalle(false);
    }
  };

  const handleVerComprobanteQR = (nota) => {
    const url =
      nota.UrlComprobante ||
      nota.url_comprobante ||
      (nota.ComprobanteQRArchivoId ? `/api/storage/archivos/${nota.ComprobanteQRArchivoId}` : null);

    if (url) {
      setFotoModal({
        url,
        numeroNota: nota.NumeroNota || nota.NumeroNotaVenta || "NV",
        chofer: nota.Chofer || nota.NombreRepartidor || "Chofer",
        monto: nota.MontoQR || nota.TotalNeto || 0
      });
    } else {
      toast.info("Esta nota no incluye comprobante fotográfico de QR.");
    }
  };

  const handleImprimirNota = (nota) => {
    setNotaImprimir(nota);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-4">
      {/* ============================================================== */}
      {/* 1. BARRA SUPERIOR DE FILTROS Y PESTAÑAS (NO-PRINT) */}
      {/* ============================================================== */}
      <div className="print:hidden bg-white border border-slate-200 rounded p-3 space-y-3">
        {/* Fila 1: Pestañas secundarias y Selector de Rango */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Selector de Sección */}
          <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 border border-slate-200 rounded">
            <button
              type="button"
              onClick={() => setSeccionActiva("notas")}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                seccionActiva === "notas"
                  ? "bg-white text-slate-900 border border-slate-300 shadow-none"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-slate-600" />
              <span>Notas de Venta en Ruta</span>
              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] font-mono rounded">
                {notasFiltradas.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSeccionActiva("cierres")}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                seccionActiva === "cierres"
                  ? "bg-white text-slate-900 border border-slate-300 shadow-none"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-slate-600" />
              <span>Cierres de Turno y Rendiciones</span>
            </button>
          </div>

          {/* Rango de Fechas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span>Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-slate-900"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                consultarNotas();
                if (seccionActiva === "cierres") consultarTurnos();
              }}
              disabled={cargandoNotas || cargandoTurnos}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 border border-transparent rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${cargandoNotas ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Fila 2: Filtros de Chofer, Forma de Pago, Estado y Búsqueda */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
          {/* Selector de Chofer */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Chofer de Reparto:</label>
            {esChofer ? (
              <div className="h-8 px-2.5 bg-slate-100 border border-slate-200 rounded flex items-center text-xs font-medium text-slate-800">
                {usuario?.NombreCompleto || "Mi usuario"}
              </div>
            ) : (
              <select
                value={filtroChoferId}
                onChange={(e) => setFiltroChoferId(e.target.value)}
                disabled={cargandoChoferes}
                className="h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              >
                <option value="TODOS">Todos los choferes</option>
                {repartidores.map((c) => (
                  <option key={c.IdUsuario} value={String(c.IdUsuario)}>
                    {c.NombreCompleto || `Chofer #${c.IdUsuario}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Filtro Forma de Pago */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Forma de Pago:</label>
            <select
              value={filtroFormaPago}
              onChange={(e) => setFiltroFormaPago(e.target.value)}
              className="h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="TODOS">Todas las formas</option>
              <option value="Efectivo">Solo Efectivo</option>
              <option value="QR">Solo QR / Bancario</option>
              <option value="Credito">Solo Crédito / Saldo</option>
            </select>
          </div>

          {/* Filtro Estado de Cobro */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Estado Cobro:</label>
            <select
              value={filtroEstadoCobro}
              onChange={(e) => setFiltroEstadoCobro(e.target.value)}
              className="h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="Aprobado">Pagado / Aprobado</option>
              <option value="Pendiente">Pendiente QR / Con Saldo</option>
            </select>
          </div>

          {/* Búsqueda de Texto */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Buscar Nota / Cliente:</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="NV-501 o nombre..."
                className="w-full h-8 pl-7 pr-2 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. KPIS RESUMEN OPERATIVO DE ALTA DENSIDAD (NO-PRINT) */}
      {/* ============================================================== */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* KPI 1: Total Notas Emitidas */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Notas Emitidas</span>
            <FileText className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
              {kpis.totalNotas}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">
              {kpis.notasConFirma} firmadas
            </span>
          </div>
        </div>

        {/* KPI 2: Total Facturado / Emitido */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Total Recaudado</span>
            <DollarSign className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
              Bs. {formatearBs(kpis.totalEmitido)}
            </span>
          </div>
        </div>

        {/* KPI 3: Efectivo Cobrado */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Efectivo Físico</span>
            <Banknote className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono tabular-nums text-emerald-700">
              Bs. {formatearBs(kpis.totalEfectivo)}
            </span>
          </div>
        </div>

        {/* KPI 4: QR / Transferencias */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Cobros QR / Banco</span>
            <QrCode className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono tabular-nums text-sky-800">
              Bs. {formatearBs(kpis.totalQR)}
            </span>
          </div>
        </div>

        {/* KPI 5: Crédito / Saldo Pendiente */}
        <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-600 text-xs font-medium">
            <span>Saldo en Crédito</span>
            <CreditCard className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold font-mono tabular-nums text-amber-800">
              Bs. {formatearBs(kpis.totalCredito)}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. VISTA 1: TABLA DE NOTAS DE VENTA EMITIDAS EN RUTA */}
      {/* ============================================================== */}
      {seccionActiva === "notas" && (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {cargandoNotas && (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-400" />
              <p className="text-xs font-medium">Cargando notas de venta emitidas en ruta...</p>
            </div>
          )}

          {!cargandoNotas && errorNotas && (
            <div className="p-6 text-center text-red-700 bg-red-50 border-b border-red-200 space-y-2">
              <AlertCircle className="h-5 w-5 mx-auto text-red-600" />
              <p className="text-xs font-semibold">{errorNotas}</p>
              <button
                type="button"
                onClick={consultarNotas}
                className="px-3 py-1 bg-red-700 text-white rounded text-xs font-medium hover:bg-red-800 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {!cargandoNotas && !errorNotas && notasFiltradas.length === 0 && (
            <div className="p-10 text-center text-slate-500 space-y-2">
              <FileText className="h-8 w-8 mx-auto text-slate-300" strokeWidth={1.5} />
              <p className="text-xs font-semibold text-slate-700">No se encontraron notas de venta</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                No hay entregas registradas para el rango de fechas o los filtros seleccionados.
              </p>
            </div>
          )}

          {!cargandoNotas && !errorNotas && notasFiltradas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">N° Nota</th>
                    <th className="px-3 py-2 text-left">Cliente / Punto de Venta</th>
                    <th className="px-3 py-2 text-left">Chofer</th>
                    <th className="px-3 py-2 text-right">Monto Total</th>
                    <th className="px-3 py-2 text-center">Forma de Pago</th>
                    <th className="px-3 py-2 text-center">Estado Cobro</th>
                    <th className="px-3 py-2 text-center">Firma Cliente</th>
                    <th className="px-3 py-2 text-center">Fecha / Hora</th>
                    <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {notasFiltradas.map((n) => {
                    const numero = n.NumeroNota || n.NumeroNotaVenta || `NV-${n.IdNotaVenta || n.id}`;
                    const cliente =
                      n.RazonSocial ||
                      n.ClienteNombre ||
                      n.ClienteNombreLibre ||
                      "Cliente en Ruta";
                    const chofer = n.Chofer || n.NombreRepartidor || "No asignado";
                    const monto = Number(n.TotalNeto ?? n.ImporteNeto ?? n.TotalVentaBruto ?? 0);
                    const metodo = n.MetodoPago || n.metodo_pago || "Efectivo";
                    const saldo = Number(n.SaldoPendiente ?? n.saldo_pendiente ?? 0);
                    const tieneFirma = Boolean(
                      n.FirmaDigitalUrl || n.FirmaNombre || n.firma_digital_url
                    );
                    const tieneQR = Boolean(
                      n.ComprobanteQRArchivoId ||
                        n.UrlComprobante ||
                        metodo.toLowerCase().includes("qr")
                    );

                    // Badge de Forma de Pago
                    let metodoClase = "bg-slate-100 text-slate-700 border-slate-200";
                    if (metodo.toLowerCase().includes("efectivo")) {
                      metodoClase = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    } else if (metodo.toLowerCase().includes("qr")) {
                      metodoClase = "bg-sky-50 text-sky-700 border-sky-200";
                    } else if (metodo.toLowerCase().includes("credito") || metodo.toLowerCase().includes("crédito")) {
                      metodoClase = "bg-amber-50 text-amber-800 border-amber-200";
                    }

                    // Estado del cobro
                    const esAprobado = saldo <= 0;
                    const esPendienteQR =
                      metodo.toLowerCase().includes("qr") && (n.ComprobanteQRArchivoId || saldo > 0);

                    return (
                      <tr key={n.IdNotaVenta || n.id || numero} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Número de Nota */}
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {numero}
                        </td>

                        {/* 2. Cliente / Punto de Venta */}
                        <td className="px-3 py-2">
                          <div className="flex flex-col max-w-[200px]">
                            <span className="font-semibold text-slate-900 truncate" title={cliente}>
                              {cliente}
                            </span>
                            {n.DestinoDepartamento && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                {n.DestinoDepartamento}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Chofer */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-800">{chofer}</span>
                            {n.PlacaCamion && (
                              <span className="px-1 py-0.2 bg-slate-100 text-[10px] font-mono text-slate-600 rounded border border-slate-200">
                                {n.PlacaCamion}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Monto Total (Bs) */}
                        <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          Bs. {formatearBs(monto)}
                        </td>

                        {/* 5. Forma de Pago */}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${metodoClase}`}
                          >
                            {metodo}
                          </span>
                        </td>

                        {/* 6. Estado del Cobro */}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {esAprobado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Aprobado
                            </span>
                          ) : esPendienteQR ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                              Pendiente QR
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              Saldo Bs. {formatearBs(saldo)}
                            </span>
                          )}
                        </td>

                        {/* 7. Firma del Cliente */}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {tieneFirma ? (
                            <button
                              type="button"
                              onClick={() => handleVerDetalle(n)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title={`Firmado por: ${n.FirmaNombre || "Cliente receptor"}`}
                            >
                              <PenTool className="h-3 w-3 text-emerald-700" />
                              <span>Firmado</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Sin firma</span>
                          )}
                        </td>

                        {/* 8. Hora de Entrega */}
                        <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {formatearFechaHora(n.FechaVenta || n.created_at || n.FechaEmision)}
                        </td>

                        {/* 9. Acciones */}
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* Ver detalle */}
                            <button
                              type="button"
                              onClick={() => handleVerDetalle(n)}
                              className="p-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
                              title="Ver detalle completo de la nota de venta"
                            >
                              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>

                            {/* Ver comprobante QR */}
                            {tieneQR && (
                              <button
                                type="button"
                                onClick={() => handleVerComprobanteQR(n)}
                                className="p-1 text-sky-700 hover:text-sky-900 hover:bg-sky-50 border border-sky-200 rounded transition-colors cursor-pointer"
                                title="Ver comprobante de transferencia / QR"
                              >
                                <QrCode className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                            )}

                            {/* Imprimir */}
                            <button
                              type="button"
                              onClick={() => handleImprimirNota(n)}
                              className="p-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
                              title="Imprimir nota de venta"
                            >
                              <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. VISTA 2: HISTORIAL DE CIERRES DE TURNO Y RENDICIONES */}
      {/* ============================================================== */}
      {seccionActiva === "cierres" && (
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {cargandoTurnos && (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-400" />
              <p className="text-xs font-medium">Consultando hojas de ruta y liquidaciones de chofer...</p>
            </div>
          )}

          {!cargandoTurnos && asignacionesTurno.length === 0 && (
            <div className="p-10 text-center text-slate-500 space-y-2">
              <Clock className="h-8 w-8 mx-auto text-slate-300" strokeWidth={1.5} />
              <p className="text-xs font-semibold text-slate-700">No se encontraron cierres de ruta</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                No hay turnos o asignaciones registradas para la fecha seleccionada.
              </p>
            </div>
          )}

          {!cargandoTurnos && asignacionesTurno.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Ruta / Hoja</th>
                    <th className="px-3 py-2 text-left">Chofer</th>
                    <th className="px-3 py-2 text-left">Placa Camión</th>
                    <th className="px-3 py-2 text-center">Estado Ruta</th>
                    <th className="px-3 py-2 text-right">Paradas Entregadas</th>
                    <th className="px-3 py-2 text-right">Total Cobrado</th>
                    <th className="px-3 py-2 text-center">Fecha Turno</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {asignacionesTurno.map((asig) => {
                    const finalizada = asig.Estado === "Finalizada" || asig.IdEstadoAsignacion === 3;
                    return (
                      <tr key={asig.IdAsignacionRuta} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">
                          {asig.NombreRuta || `Ruta #${asig.IdRuta}`}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {asig.NombreRepartidor || "Chofer"}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {asig.Placa || asig.Observacion?.match(/\(([^)]+)\)/)?.[1] || "5738UPK"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                              finalizada
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-sky-50 text-sky-700 border-sky-200"
                            }`}
                          >
                            {asig.Estado || (finalizada ? "Cerrada" : "En Tránsito")}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {asig.ParadasEntregadas ?? asig.TotalEntregas ?? 0} / {asig.TotalParadas || 1}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                          Bs. {formatearBs(asig.MontoCobradoTotal || asig.TotalVentas || 0)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-600">
                          {asig.FechaAsignacion || fechaDesde}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL DETALLE DE NOTA DE VENTA */}
      {/* ============================================================== */}
      {notaDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40">
          <div className="bg-white border border-slate-300 rounded shadow-md max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Cabecera del Modal */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Detalle de Entrega: {notaDetalle.NumeroNota || notaDetalle.NumeroNotaVenta}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNotaDetalle(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Contenido del Detalle */}
            <div className="p-4 space-y-4 text-xs text-slate-800">
              {/* Metadatos Generales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded p-2.5">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Cliente</span>
                  <p className="font-semibold text-slate-900 truncate">
                    {notaDetalle.RazonSocial ||
                      notaDetalle.ClienteNombre ||
                      notaDetalle.ClienteNombreLibre ||
                      "Cliente en Ruta"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Chofer</span>
                  <p className="font-medium text-slate-800">
                    {notaDetalle.Chofer || notaDetalle.NombreRepartidor || "Asignado"}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Forma de Pago</span>
                  <p className="font-medium text-slate-800">{notaDetalle.MetodoPago || "Efectivo"}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Fecha y Hora</span>
                  <p className="font-mono text-slate-700">
                    {formatearFechaHora(notaDetalle.FechaVenta || notaDetalle.created_at)}
                  </p>
                </div>
              </div>

              {/* Ítems Entregados */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-slate-500" />
                  <span>Productos Entregados en Ruta</span>
                </h4>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-2.5 py-1.5">Producto / Presentación</th>
                        <th className="px-2.5 py-1.5 text-right">Cantidad</th>
                        <th className="px-2.5 py-1.5 text-right">P. Unitario (Bs)</th>
                        <th className="px-2.5 py-1.5 text-right">Subtotal (Bs)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(notaDetalle.Detalles || notaDetalle.detalles || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-3 text-center text-slate-500">
                            No se desglosaron líneas individuales de producto.
                          </td>
                        </tr>
                      ) : (
                        (notaDetalle.Detalles || notaDetalle.detalles).map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-2.5 py-1.5">
                              <span className="font-medium text-slate-900">
                                {it.NombreProducto || it.presentacion || "Papelera Blanquita"}
                              </span>
                              {it.EsBonificacionBandeo && (
                                <span className="ml-2 inline-flex px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold">
                                  Bandeo Promocional
                                </span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
                              {formatearEntero(it.Cantidad || it.paquetes_entregados || 1)}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
                              {formatearBs(it.PrecioUnitario || it.precio_unitario || 0)}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatearBs(it.Subtotal || it.subtotal || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                      <tr>
                        <td colSpan={3} className="px-2.5 py-1.5 text-right uppercase text-[10px] text-slate-600">
                          Total Neto de la Entrega:
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-slate-900 text-sm">
                          Bs. {formatearBs(notaDetalle.TotalNeto ?? notaDetalle.ImporteNeto ?? notaDetalle.TotalVentaBruto)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Receptor y Firma Digital */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1">
                  <h5 className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-500" />
                    <span>Datos del Receptor</span>
                  </h5>
                  <p className="text-xs">
                    <span className="font-semibold text-slate-600">Nombre:</span>{" "}
                    {notaDetalle.FirmaNombre || notaDetalle.firma_nombre || "Receptor en Tienda"}
                  </p>
                  <p className="text-xs">
                    <span className="font-semibold text-slate-600">C.I.:</span>{" "}
                    {notaDetalle.FirmaCi || notaDetalle.firma_ci || "S/CI"}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1">
                  <h5 className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
                    <PenTool className="h-3 w-3 text-slate-500" />
                    <span>Firma Digital Capturada</span>
                  </h5>
                  {notaDetalle.FirmaDigitalUrl || notaDetalle.firma_digital_url ? (
                    <div className="border border-slate-300 rounded bg-white p-1 flex justify-center">
                      <img
                        src={notaDetalle.FirmaDigitalUrl || notaDetalle.firma_digital_url}
                        alt="Firma Receptor"
                        className="max-h-16 object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No se registró firma gráfica en pantalla.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pie del Modal con Acciones */}
            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleImprimirNota(notaDetalle)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir Nota</span>
              </button>
              <button
                type="button"
                onClick={() => setNotaDetalle(null)}
                className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL VISOR DE COMPROBANTE FOTOGRÁFICO QR */}
      {/* ============================================================== */}
      {fotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/50">
          <div className="bg-white border border-slate-300 rounded shadow-md max-w-lg w-full overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-sky-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Comprobante QR — {fotoModal.numeroNota}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFotoModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-100 flex flex-col items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={fotoModal.url}
                alt="Comprobante Transferencia QR"
                className="max-h-[60vh] max-w-full rounded border border-slate-300 object-contain shadow-xs"
              />
            </div>

            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Chofer: <strong>{fotoModal.chofer}</strong>
              </span>
              <button
                type="button"
                onClick={() => setFotoModal(null)}
                className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded text-xs font-medium cursor-pointer"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. FORMATO FORMAL DE IMPRESIÓN DE NOTA DE VENTA (@media print) */}
      {/* ============================================================== */}
      {notaImprimir && (
        <div className="hidden print:block fixed inset-0 bg-white p-6 text-black z-50">
          <div className="border border-black p-4 space-y-4">
            {/* Encabezado */}
            <div className="flex justify-between items-start border-b border-black pb-3">
              <div>
                <h1 className="text-base font-bold uppercase tracking-tight">Papelera Blanquita S.R.L.</h1>
                <p className="text-[11px] text-slate-700">Fábrica de Papel Higiénico y Servilletas</p>
                <p className="text-[10px] text-slate-600">Sucre - Potosí, Bolivia</p>
              </div>
              <div className="text-right border border-black p-2 rounded-none">
                <p className="text-xs font-bold uppercase">Nota de Entrega en Ruta</p>
                <p className="text-sm font-mono font-black">{notaImprimir.NumeroNota || notaImprimir.NumeroNotaVenta}</p>
                <p className="text-[10px] text-slate-600">
                  {formatearFechaHora(notaImprimir.FechaVenta || notaImprimir.created_at)}
                </p>
              </div>
            </div>

            {/* Datos del Cliente y Transporte */}
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-400 pb-3">
              <div>
                <p><span className="font-bold">Cliente / Razón Social:</span> {notaImprimir.RazonSocial || notaImprimir.ClienteNombre || notaImprimir.ClienteNombreLibre || "Cliente General"}</p>
                <p><span className="font-bold">Destino:</span> {notaImprimir.DestinoDepartamento || "Sucre"}</p>
                <p><span className="font-bold">Condición de Venta:</span> {notaImprimir.MetodoPago || "Efectivo"}</p>
              </div>
              <div className="text-right">
                <p><span className="font-bold">Chofer Repartidor:</span> {notaImprimir.Chofer || notaImprimir.NombreRepartidor || "Asignado"}</p>
                {notaImprimir.PlacaCamion && <p><span className="font-bold">Placa Camión:</span> {notaImprimir.PlacaCamion}</p>}
                <p><span className="font-bold">Hora:</span> {new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>

            {/* Tabla de Artículos */}
            <table className="w-full text-left text-xs border border-black border-collapse">
              <thead>
                <tr className="border-b border-black bg-slate-100 font-bold uppercase text-[10px]">
                  <th className="p-1.5 border-r border-black">Producto</th>
                  <th className="p-1.5 border-r border-black text-right">Cant.</th>
                  <th className="p-1.5 border-r border-black text-right">P. Unit (Bs)</th>
                  <th className="p-1.5 text-right">Subtotal (Bs)</th>
                </tr>
              </thead>
              <tbody>
                {(notaImprimir.Detalles || notaImprimir.detalles || []).length > 0 ? (
                  (notaImprimir.Detalles || notaImprimir.detalles).map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="p-1.5 border-r border-black">
                        {it.NombreProducto || it.presentacion || "Papel Blanquita"}
                        {it.EsBonificacionBandeo && " (Bandeo Promo 0.00)"}
                      </td>
                      <td className="p-1.5 border-r border-black text-right font-mono">
                        {formatearEntero(it.Cantidad || it.paquetes_entregados || 1)}
                      </td>
                      <td className="p-1.5 border-r border-black text-right font-mono">
                        {formatearBs(it.PrecioUnitario || it.precio_unitario || 0)}
                      </td>
                      <td className="p-1.5 text-right font-mono font-bold">
                        {formatearBs(it.Subtotal || it.subtotal || 0)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-2 text-center">Detalle de entrega en ruta por lote.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-black font-bold">
                  <td colSpan={3} className="p-1.5 text-right uppercase text-[10px]">Total Cancelado:</td>
                  <td className="p-1.5 text-right font-mono text-sm">
                    Bs. {formatearBs(notaImprimir.TotalNeto ?? notaImprimir.ImporteNeto ?? notaImprimir.TotalVentaBruto)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Firmas al pie */}
            <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs">
              <div className="border-t border-black pt-1">
                <p className="font-bold">Entregué Conforme (Chofer)</p>
                <p className="text-[10px]">{notaImprimir.Chofer || "Papelera Blanquita"}</p>
              </div>
              <div className="border-t border-black pt-1">
                <p className="font-bold">Recibí Conforme (Cliente Receptor)</p>
                <p className="text-[10px]">
                  {notaImprimir.FirmaNombre || "Firma y Aclaración de C.I."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
