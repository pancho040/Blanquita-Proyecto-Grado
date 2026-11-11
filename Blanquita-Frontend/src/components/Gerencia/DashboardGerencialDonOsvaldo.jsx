import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Receipt,
  Landmark,
  ShieldCheck,
  Calendar,
  Factory,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDebounceSearch } from "@/hooks/useDebounceSearch";
import { SkeletonMetrics, SkeletonBlock } from "@/components/common/LoadingStates";
import PageHeader from "@/components/common/PageHeader";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import BranchFilter from "@/components/common/BranchFilter";
import {
  BuscarReporteGlobal,
  ObtenerKPIsEjecutivos,
  FirmarDocumentoGerencial,
  ListarFirmasHistorial,
  ConciliarBancoReferencial,
  ObtenerReporteConsolidadoPlanta
} from "@/services/Gerencia/gerenciaService";

export default function DashboardGerencialDonOsvaldo({ usuario }) {
  const {
    sucursal,
    setSucursal,
    sucursales,
    cargando: cargandoSucursal,
    esMultisede,
  } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [seccion, setSeccion] = useState("resumen"); // resumen | bancos | planta | firmas
  const [cargando, setCargando] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState(null);

  // Buscador Numérico de 4 dígitos con Debounce de 250ms y AbortController
  const [resultadoBusqueda, setResultadoBusqueda] = useState(null);
  const [modalBusquedaOpen, setModalBusquedaOpen] = useState(false);

  const realizarBusquedaAsincrona = useCallback(async (termino, { signal }) => {
    const limpio = termino?.trim();
    // Búsqueda automática en Don Osvaldo si se ingresan 4 dígitos o más (o código)
    if (!limpio || limpio.length < 3) {
      return;
    }
    try {
      const res = await BuscarReporteGlobal(limpio, sucursal, { signal });
      if (res) {
        setResultadoBusqueda(res);
        setModalBusquedaOpen(true);
      }
    } catch (err) {
      if (err?.name !== "AbortError" && !signal?.aborted) {
        // En búsqueda automática no saturamos con toasts de error si aún está tipeando
      }
    }
  }, [sucursal]);

  const {
    termino: codigoBusqueda,
    setTermino: setCodigoBusqueda,
    cargando: buscando,
    ejecutarInmediato: buscarInmediato,
  } = useDebounceSearch(realizarBusquedaAsincrona, 250);

  // Consolidación de Planta
  const [reportePlanta, setReportePlanta] = useState(null);
  const [cargandoPlanta, setCargandoPlanta] = useState(false);

  // Firmas de Gerencia
  const [firmas, setFirmas] = useState([]);
  const [modalFirmarOpen, setModalFirmarOpen] = useState(false);
  const [docParaFirmar, setDocParaFirmar] = useState(null);
  const [observacionFirma, setObservacionFirma] = useState("");
  const [firmando, setFirmando] = useState(false);

  // Conciliación Bancaria
  const [modalConciliarOpen, setModalConciliarOpen] = useState(false);
  const [bancoParaConciliar, setBancoParaConciliar] = useState(null);
  const [nuevoSaldoConciliado, setNuevoSaldoConciliado] = useState("");
  const [obsConciliacion, setObsConciliacion] = useState("");
  const [conciliando, setConciliando] = useState(false);

  const cargarKPIs = useCallback(async () => {
    try {
      setCargando(true);
      const data = await ObtenerKPIsEjecutivos(sucursal);
      setKpis(data);
    } catch (err) {
      toast.error("Error al cargar KPIs ejecutivos: " + err.message);
    } finally {
      setCargando(false);
    }
  }, [sucursal]);

  useEffect(() => {
    cargarKPIs();
  }, [cargarKPIs]);

  const handleBuscarCodigo = async (e) => {
    if (e) e.preventDefault();
    const codigo = codigoBusqueda.trim();
    if (!codigo) {
      toast.error("Ingrese un código numérico o identificador");
      return;
    }
    try {
      const res = await BuscarReporteGlobal(codigo, sucursal);
      if (res) {
        setResultadoBusqueda(res);
        setModalBusquedaOpen(true);
      } else {
        toast.error("No se encontraron documentos con el código ingresado");
      }
    } catch (err) {
      toast.error(err.message || "No se encontraron documentos");
    }
  };

  const cargarReportePlanta = async () => {
    try {
      setCargandoPlanta(true);
      const data = await ObtenerReporteConsolidadoPlanta();
      setReportePlanta(data);
    } catch (err) {
      toast.error("Error al cargar consolidado de planta: " + err.message);
    } finally {
      setCargandoPlanta(false);
    }
  };

  const cargarFirmas = async () => {
    try {
      const data = await ListarFirmasHistorial(30);
      setFirmas(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFirmarDocumento = async () => {
    if (!docParaFirmar) return;
    try {
      setFirmando(true);
      await FirmarDocumentoGerencial({
        tipo_documento: docParaFirmar.tipo_documento,
        id_registro_documento: docParaFirmar.id_registro,
        codigo_referencia: docParaFirmar.codigo,
        observaciones: observacionFirma || "Autorizado y sellado por Don Osvaldo (Gerencia General)"
      });
      toast.success(`¡Documento ${docParaFirmar.codigo} firmado y autorizado!`);
      setModalFirmarOpen(false);
      setModalBusquedaOpen(false);
      setObservacionFirma("");
      await cargarKPIs();
    } catch (err) {
      toast.error(err.message || "Error al registrar firma");
    } finally {
      setFirmando(false);
    }
  };

  const handleConciliarBanco = async (e) => {
    e.preventDefault();
    if (!bancoParaConciliar) return;
    const saldo = parseFloat(nuevoSaldoConciliado);
    if (isNaN(saldo)) {
      toast.error("Ingrese un monto válido");
      return;
    }
    try {
      setConciliando(true);
      await ConciliarBancoReferencial(bancoParaConciliar.id_cuenta, {
        saldo_conciliado: saldo,
        observaciones: obsConciliacion || "Conciliación semanal manual"
      });
      toast.success(`¡Saldo conciliado de ${bancoParaConciliar.nombre_banco} actualizado!`);
      setModalConciliarOpen(false);
      await cargarKPIs();
    } catch (err) {
      toast.error(err.message || "Error al conciliar banco");
    } finally {
      setConciliando(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* ========================================================================= */}
      {/* CABECERA & CONTROL EJECUTIVO (MODO OPERATE - DON OSVALDO) */}
      {/* ========================================================================= */}
      <PageHeader
        titulo="Panel de Gerencia General"
        subtitulo="Consolidación en Tiempo Real: Ventas, Cuentas por Cobrar, Vales de Caja Chica y Saldos Bancarios"
        icono={ShieldCheck}
        badge={
          <Badge variant="secondary" className="rounded text-xs font-semibold">
            DIRECCIÓN GENERAL
          </Badge>
        }
        permiteTodas={true}
        sucursal={sucursal}
        setSucursal={setSucursal}
        acciones={
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-white px-3 py-1.5 rounded border border-slate-200 shadow-2xs">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span>Fecha operativa:</span>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              {kpis?.fecha_consulta || new Date().toISOString().split("T")[0]}
            </span>
          </div>
        }
      />

      <div className="bg-white p-5 rounded border border-slate-200 space-y-4">
        {/* BUSCADOR NUMÉRICO PROMINENTE DE 4 DÍGITOS */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="buscador-codigo" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              Buscador Ejecutivo por Código o Número (4 dígitos):
            </label>
            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              Vales de caja chica, notas de venta y recibos
            </span>
          </div>

          <form onSubmit={handleBuscarCodigo} className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="buscador-codigo"
                type="text"
                placeholder="Ingrese número o código (ej. 2208, 501, VALE-10)..."
                value={codigoBusqueda}
                onChange={(e) => setCodigoBusqueda(e.target.value)}
                className="w-full h-9 px-3 rounded border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-mono tabular-nums font-medium focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>
            <Button
              type="submit"
              disabled={buscando}
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded border border-transparent shrink-0"
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              {buscando ? "Buscando..." : "Localizar Documento"}
            </Button>
          </form>
          <p className="text-xs text-slate-500">
            Localización directa e inmediata para autorizaciones y auditoría ejecutiva sin navegación intermedia.
          </p>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS INDUSTRIAL */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setSeccion("resumen")}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              seccion === "resumen"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Resumen General
          </button>
          <button
            type="button"
            onClick={() => setSeccion("bancos")}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              seccion === "bancos"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Cuentas Bancarias
          </button>
          <button
            type="button"
            onClick={() => {
              setSeccion("planta");
              if (!reportePlanta) cargarReportePlanta();
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              seccion === "planta"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Inventario en Planta
          </button>
          <button
            type="button"
            onClick={() => {
              setSeccion("firmas");
              cargarFirmas();
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              seccion === "firmas"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Firmas y Autorizaciones
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN: RESUMEN EJECUTIVO (TARJETAS MINIMALISTAS CON BORDES SÓLIDOS) */}
      {/* ========================================================================= */}
      {seccion === "resumen" && (
        <div className="space-y-4">
          {/* Alertas Gerenciales */}
          {kpis?.alertas && kpis.alertas.length > 0 && (
            <div className="space-y-2">
              {kpis.alertas.map((alt, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded border flex items-center justify-between text-xs font-medium ${
                    alt.severidad === "DANGER"
                      ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#B91C1C]"
                      : "bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{alt.mensaje}</span>
                  </div>
                  {alt.codigo_referencia === "CAJA_CHICA" && (
                    <a
                      href="/contador/aprobacion-caja-chica"
                      className="px-2.5 py-1 bg-white border border-slate-300 text-slate-800 rounded text-xs font-medium hover:bg-slate-50 shrink-0"
                    >
                      Revisar Vales
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* CUADRÍCULA DE 4 KPIS MAESTROS CRÍTICOS (CON SKELETON INDUSTRIAL) */}
          {cargando ? (
            <SkeletonMetrics count={4} columnsClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Ventas Hoy */}
              <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-wider">Ventas Globales Hoy</span>
                  <span className="p-1.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                  {`Bs. ${Number(kpis?.ventas_hoy_monto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <p className="text-xs text-slate-600 font-mono tabular-nums">
                  {kpis?.ventas_hoy_cantidad || 0} notas de venta registradas
                </p>
              </div>

              {/* Cuentas por Cobrar & Mora */}
              <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-wider">Cartera por Cobrar</span>
                  <span className="p-1.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    <DollarSign className="h-4 w-4" />
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                  {`Bs. ${Number(kpis?.cuentas_cobrar_saldo_total || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <p className="text-xs text-[#B91C1C] font-mono tabular-nums font-medium">
                  En mora: Bs. {Number(kpis?.cuentas_cobrar_en_mora || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              {/* Vales Caja Chica Pendientes */}
              <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-wider">Vales por Autorizar</span>
                  <span className="p-1.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    <Receipt className="h-4 w-4" />
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                  {`${kpis?.vales_caja_chica_pendientes_cantidad || 0} pendientes`}
                </div>
                <p className="text-xs text-slate-600 font-mono tabular-nums">
                  Total por aprobar: Bs. {Number(kpis?.vales_caja_chica_pendientes_monto || 0).toFixed(2)}
                </p>
              </div>

              {/* Saldos Bancarios */}
              <div className="bg-white p-4 rounded border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-wider">Saldos en Bancos</span>
                  <span className="p-1.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    <Landmark className="h-4 w-4" />
                  </span>
                </div>
                <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                  {`Bs. ${Number(kpis?.saldos_bancarios_total || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <p className="text-xs text-[#15803D] font-mono tabular-nums font-medium">
                  3 cuentas referenciales activas
                </p>
              </div>
            </div>
          )}

          {/* VISTA RESUMIDA DE LOS 3 BANCOS REFERENCIALES */}
          <div className="bg-white p-4 rounded border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                  Saldos Conciliados en los 3 Bancos de la Empresa
                </h3>
                <p className="text-xs text-slate-600">
                  Control referencial clasificado por origen de recaudación
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeccion("bancos")}
                className="h-8 text-xs font-medium border-slate-300"
              >
                Ver Detalle &amp; Conciliar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {kpis?.bancos?.map((b) => (
                <div
                  key={b.id_cuenta}
                  className="p-3.5 rounded border border-slate-200 bg-slate-50 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-slate-900">
                      {b.nombre_banco}
                    </span>
                    <Badge variant="outline" className="rounded text-xs font-bold">
                      {b.sigla}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 font-mono tabular-nums">{b.numero_cuenta}</p>
                  <Badge variant="secondary" className="rounded text-xs uppercase font-semibold text-slate-700">
                    {b.proposito.replace("_", " ")}
                  </Badge>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-semibold uppercase">SALDO CONCILIADO:</span>
                    <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                      Bs. {Number(b.saldo_conciliado || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECCIÓN: LOS 3 BANCOS REFERENCIALES & CONCILIACIÓN */}
      {/* ========================================================================= */}
      {seccion === "bancos" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Conciliación y Control de Cuentas Bancarias
              </h3>
              <p className="text-xs text-slate-600">
                BMSC (Recaudación Choferes) · Banco Unión (Distribuidores y Clientes) · BNB (Institucional)
              </p>
            </div>
            <Button
              size="sm"
              onClick={cargarKPIs}
              className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded"
            >
              Actualizar Saldos
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {kpis?.bancos?.map((b) => (
              <div
                key={b.id_cuenta}
                className="bg-white p-4 rounded border border-slate-200 space-y-3"
              >
                <div className="flex justify-between items-start border-b border-slate-200 pb-2.5">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {b.nombre_banco}
                    </h4>
                    <p className="text-xs text-slate-600 font-mono tabular-nums">{b.numero_cuenta}</p>
                  </div>
                  <Badge variant="outline" className="rounded text-xs font-bold">{b.sigla}</Badge>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Propósito Operativo:</span>
                    <span className="font-semibold text-slate-900">
                      {b.proposito.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Saldo en Sistema:</span>
                    <span className="font-mono tabular-nums font-medium text-slate-800">
                      Bs. {Number(b.saldo_actual || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold font-mono tabular-nums text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Saldo Conciliado:</span>
                    <span>Bs. {Number(b.saldo_conciliado || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums text-right">
                    Última conciliación: {b.fecha_ultima_conciliacion ? b.fecha_ultima_conciliacion.split("T")[0] : "Pendiente"}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setBancoParaConciliar(b);
                    setNuevoSaldoConciliado(String(b.saldo_conciliado || b.saldo_actual || ""));
                    setModalConciliarOpen(true);
                  }}
                  className="w-full h-8 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded border border-transparent"
                >
                  Conciliar Saldo Extracto
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECCIÓN: CONSOLIDACIÓN DE PLANTA (SOLO LECTURA) */}
      {/* ========================================================================= */}
      {seccion === "planta" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-slate-100 border border-slate-200 rounded text-slate-700">
                <Factory className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Consolidación Financiera de Inventario en Planta
                </h3>
                <p className="text-xs text-slate-600">
                  Inspección formal de Materias Primas y Producto Terminado en Sucre vía <code className="font-mono font-semibold text-slate-900">PlantaDataReader</code> (100% Solo Lectura)
                </p>
              </div>
            </div>

            <Button
              onClick={cargarReportePlanta}
              disabled={cargandoPlanta}
              className="h-8 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded shrink-0"
            >
              {cargandoPlanta ? "Leyendo Planta..." : "Actualizar Informe"}
            </Button>
          </div>

          {cargandoPlanta ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-white rounded border border-slate-200 font-mono">
              Cargando saldos físicos de planta en modo solo lectura...
            </div>
          ) : !reportePlanta ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-white rounded border border-slate-200">
              Presione "Actualizar Informe" para generar la consolidación financiera.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tarjetas de Totales Valorizados */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-white rounded border border-slate-200 space-y-1">
                  <span className="text-xs font-semibold text-slate-600 uppercase">Total Materias Primas:</span>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    Bs. {Number(reportePlanta.total_materias_primas_valor || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-white rounded border border-slate-200 space-y-1">
                  <span className="text-xs font-semibold text-slate-600 uppercase">Total Producto Terminado:</span>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                    Bs. {Number(reportePlanta.total_producto_terminado_valor || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-[#F0FDF4] rounded border border-[#86EFAC] space-y-1">
                  <span className="text-xs font-bold text-[#15803D] uppercase tracking-wider">
                    VALOR TOTAL ACTIVOS PLANTA:
                  </span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-[#15803D]">
                    Bs. {Number(reportePlanta.total_valor_inventario_planta || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Tabla Materias Primas */}
              <div className="bg-white rounded border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase text-slate-700 tracking-wider">
                  I. Materias Primas en Almacén Fábrica (Bobinas y Rodelas)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Categoría</th>
                        <th className="px-3 py-2 text-right">Unidades</th>
                        <th className="px-3 py-2 text-right">Peso / Medida</th>
                        <th className="px-3 py-2 text-right">Costo Estimado</th>
                        <th className="px-3 py-2 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportePlanta.materias_primas?.map((mp, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-medium text-slate-900">{mp.categoria}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">{mp.cantidad_unidades}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{mp.peso_o_medida}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">Bs. {Number(mp.costo_unitario_estimado).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-bold font-mono tabular-nums text-slate-900">
                            Bs. {Number(mp.valor_total_estimado).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla Producto Terminado */}
              <div className="bg-white rounded border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase text-slate-700 tracking-wider">
                  II. Producto Terminado en Fábrica Sucre
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2">Presentación</th>
                        <th className="px-3 py-2">Tipo Contenedor</th>
                        <th className="px-3 py-2 text-right">Stock Disponible</th>
                        <th className="px-3 py-2 text-right">Costo Fábrica</th>
                        <th className="px-3 py-2 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportePlanta.producto_terminado?.map((pt, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-medium text-slate-900">{pt.producto_nombre}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{pt.presentacion_codigo}</td>
                          <td className="px-3 py-2 text-slate-700">{pt.tipo_contenedor}</td>
                          <td className="px-3 py-2 text-right font-bold font-mono tabular-nums text-slate-900">
                            {Number(pt.stock_paquetes).toFixed(0)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                            Bs. {Number(pt.precio_referencial).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold font-mono tabular-nums text-slate-900">
                            Bs. {Number(pt.valor_total_estimado).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 text-center font-mono">
                {reportePlanta.nota_auditoria}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECCIÓN: HISTORIAL DE FIRMAS & SELLOS */}
      {/* ========================================================================= */}
      {seccion === "firmas" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded border border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Historial de Autorizaciones y Firmas Digitales
              </h3>
              <p className="text-xs text-slate-600">
                Registro auditable de aprobaciones emitidas por Gerencia General
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={cargarFirmas}
              className="h-8 text-xs font-medium border-slate-300"
            >
              Actualizar
            </Button>
          </div>

          <div className="bg-white rounded border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Fecha y Hora</th>
                    <th className="px-3 py-2">Tipo Documento</th>
                    <th className="px-3 py-2">Código Referencia</th>
                    <th className="px-3 py-2">Firmado Por</th>
                    <th className="px-3 py-2">Observaciones</th>
                    <th className="px-3 py-2 text-center">Sello Digital</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {firmas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-xs text-slate-500 font-mono">
                        No hay firmas emitidas recientemente.
                      </td>
                    </tr>
                  ) : (
                    firmas.map((f) => (
                      <tr key={f.IdFirma} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 font-mono tabular-nums text-slate-600">
                          {f.FechaFirma?.replace("T", " ").split(".")[0]}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{f.TipoDocumento}</td>
                        <td className="px-3 py-2 font-mono tabular-nums font-bold text-slate-900">
                          {f.CodigoReferencia || `ID-${f.IdRegistroDocumento}`}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{f.NombreUsuario || "Gerencia General"}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{f.Observaciones || "-"}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="success" className="gap-1 rounded text-xs">
                            <ShieldCheck className="h-3 w-3" /> AUTORIZADO
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL RESULTADO DE BÚSQUEDA GLOBAL */}
      {/* ========================================================================= */}
      <Dialog open={modalBusquedaOpen} onOpenChange={setModalBusquedaOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5 bg-white rounded border border-slate-200">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-700" />
              Resultado de Búsqueda: "{resultadoBusqueda?.codigo_buscado}"
            </DialogTitle>
          </DialogHeader>

          {!resultadoBusqueda || resultadoBusqueda.documentos.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-mono">
              No se encontró ningún documento con el código o número ingresado.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-600 font-medium">
                Se encontraron {resultadoBusqueda.total_encontrados} documentos vinculados:
              </p>

              {resultadoBusqueda.documentos.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded border border-slate-200 bg-slate-50 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono tabular-nums font-bold text-sm text-slate-900 block">
                        {doc.codigo}
                      </span>
                      <h4 className="font-semibold text-xs text-slate-900">
                        {doc.titulo}
                      </h4>
                    </div>
                    <Badge variant="secondary" className="rounded text-xs font-semibold">
                      {doc.tipo_documento}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600">
                    {doc.descripcion}
                  </p>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500">Estado: </span>
                      <span className="font-semibold text-slate-900">{doc.estado}</span>
                    </div>
                    <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                      Bs. {Number(doc.monto || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        setDocParaFirmar(doc);
                        setModalFirmarOpen(true);
                      }}
                      className="flex-1 h-8 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded gap-1.5"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Firmar y Autorizar
                    </Button>
                    <a
                      href={doc.ruta_acceso}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-medium inline-flex items-center gap-1 text-slate-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      Ver Detalle
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL FIRMA Y SELLO DIGITAL DE GERENCIA */}
      {/* ========================================================================= */}
      <Dialog open={modalFirmarOpen} onOpenChange={setModalFirmarOpen}>
        <DialogContent className="w-full sm:max-w-md p-5 bg-white rounded border border-slate-200">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-800" />
              Autorización y Firma Digital
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs pt-1">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                DOCUMENTO A AUTORIZAR:
              </span>
              <span className="font-bold text-slate-900 text-sm block">
                {docParaFirmar?.codigo} - {docParaFirmar?.titulo}
              </span>
              <p className="font-bold font-mono tabular-nums text-slate-900">
                Monto: Bs. {Number(docParaFirmar?.monto || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <label htmlFor="obs-firma" className="font-semibold text-slate-700 block mb-1">
                Observaciones de Autorización:
              </label>
              <Input
                id="obs-firma"
                placeholder="Aprobado y autorizado formalmente por Gerencia General"
                value={observacionFirma}
                onChange={(e) => setObservacionFirma(e.target.value)}
                className="text-xs h-8 rounded border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <Button
              onClick={handleFirmarDocumento}
              disabled={firmando}
              className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              {firmando ? "Registrando Firma..." : "Confirmar Autorización Ejecutiva"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL CONCILIACIÓN REFERENCIAL DE BANCO */}
      {/* ========================================================================= */}
      <Dialog open={modalConciliarOpen} onOpenChange={setModalConciliarOpen}>
        <DialogContent className="w-full sm:max-w-sm p-5 bg-white rounded border border-slate-200">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-800" />
              Conciliar {bancoParaConciliar?.nombre_banco}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConciliarBanco} className="space-y-4 text-xs pt-1">
            <div>
              <label htmlFor="saldo-extracto" className="font-semibold text-slate-700 block mb-1">
                Saldo Real según Extracto Bancario (Bs):
              </label>
              <Input
                id="saldo-extracto"
                type="number"
                step="0.01"
                value={nuevoSaldoConciliado}
                onChange={(e) => setNuevoSaldoConciliado(e.target.value)}
                required
                className="text-xs h-8 font-mono tabular-nums font-bold rounded border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="obs-conciliacion" className="font-semibold text-slate-700 block mb-1">
                Observación / Referencia Extracto:
              </label>
              <Input
                id="obs-conciliacion"
                placeholder="Extracto oficial emitido a fin de mes"
                value={obsConciliacion}
                onChange={(e) => setObsConciliacion(e.target.value)}
                className="text-xs h-8 rounded border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <Button
              type="submit"
              disabled={conciliando}
              className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded"
            >
              {conciliando ? "Guardando..." : "Asentar Conciliación"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
