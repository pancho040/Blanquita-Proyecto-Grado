import React, { useState, useEffect } from "react";
import {
  Search,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Receipt,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Printer,
  Calendar,
  Layers,
  ArrowRight,
  Boxes,
  Factory,
  FileText,
  Clock,
  Sparkles,
  Lock,
  UploadCloud,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BuscarReporteGlobal,
  ObtenerKPIsEjecutivos,
  FirmarDocumentoGerencial,
  ListarFirmasHistorial,
  ConciliarBancoReferencial,
  ObtenerReporteConsolidadoPlanta
} from "@/services/Gerencia/gerenciaService";

export default function DashboardGerencialDonOsvaldo({ usuario }) {
  const [seccion, setSeccion] = useState("resumen"); // resumen | bancos | planta | firmas
  const [cargando, setCargando] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState(null);

  // Buscador Numérico de 4 dígitos
  const [codigoBusqueda, setCodigoBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadoBusqueda, setResultadoBusqueda] = useState(null);
  const [modalBusquedaOpen, setModalBusquedaOpen] = useState(false);

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

  useEffect(() => {
    cargarKPIs();
  }, []);

  const cargarKPIs = async () => {
    try {
      setCargando(true);
      const data = await ObtenerKPIsEjecutivos();
      setKpis(data);
    } catch (err) {
      toast.error("Error al cargar KPIs ejecutivos: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleBuscarCodigo = async (e) => {
    if (e) e.preventDefault();
    if (!codigoBusqueda.trim()) {
      toast.error("Ingrese un código numérico o identificador");
      return;
    }
    try {
      setBuscando(true);
      const res = await BuscarReporteGlobal(codigoBusqueda.trim());
      setResultadoBusqueda(res);
      setModalBusquedaOpen(true);
    } catch (err) {
      toast.error(err.message || "No se encontraron documentos");
    } finally {
      setBuscando(false);
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ========================================================================= */}
      {/* CABECERA & BUSCADOR GLOBAL PROMINENTE (CÓDIGO NUMÉRICO DE 4 DÍGITOS) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-indigo-900/50 shadow-xl text-white space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Panel de Gerencia
                <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30 text-[10px]">
                  GERENCIA GENERAL
                </Badge>
              </h1>
              <p className="text-xs text-indigo-200/80">
                Consolidación en Tiempo Real: Ventas, Cuentas por Cobrar, Vales de Caja Chica y Saldos Bancarios
              </p>
            </div>
          </div>

          <div className="text-xs text-indigo-300/80 bg-indigo-900/40 px-3 py-1.5 rounded-lg border border-indigo-700/40">
            Fecha: <span className="font-bold text-white">{kpis?.fecha_consulta || new Date().toISOString().split("T")[0]}</span>
          </div>
        </div>

        {/* BUSCADOR NUMÉRICO PROMINENTE */}
        <form onSubmit={handleBuscarCodigo} className="relative max-w-2xl">
          <div className="relative flex items-center">
            <Search className="h-5 w-5 absolute left-3.5 text-indigo-300" />
            <input
              type="text"
              placeholder="Buscar por código numérico de 4 dígitos (ej. 2208, 501, VALE-10)..."
              value={codigoBusqueda}
              onChange={(e) => setCodigoBusqueda(e.target.value)}
              className="w-full pl-11 pr-28 py-3 rounded-xl bg-slate-800/80 border border-indigo-400/40 text-white placeholder-indigo-300/50 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-400 shadow-inner"
            />
            <Button
              type="submit"
              disabled={buscando}
              className="absolute right-1.5 h-8 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg"
            >
              {buscando ? "Buscando..." : "Localizar"}
            </Button>
          </div>
          <span className="text-[10px] text-indigo-300/60 mt-1 block pl-1">
            Ingrese el número de vale, nota de venta o recibo para acceder directamente al documento.
          </span>
        </form>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-indigo-800/40">
          <button
            onClick={() => setSeccion("resumen")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              seccion === "resumen"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-800/60 text-indigo-200 hover:bg-slate-800"
            }`}
          >
            Resumen General
          </button>
          <button
            onClick={() => {
              setSeccion("bancos");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              seccion === "bancos"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-800/60 text-indigo-200 hover:bg-slate-800"
            }`}
          >
            Cuentas Bancarias
          </button>
          <button
            onClick={() => {
              setSeccion("planta");
              if (!reportePlanta) cargarReportePlanta();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              seccion === "planta"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-800/60 text-indigo-200 hover:bg-slate-800"
            }`}
          >
            Inventario en Planta
          </button>
          <button
            onClick={() => {
              setSeccion("firmas");
              cargarFirmas();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              seccion === "firmas"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-800/60 text-indigo-200 hover:bg-slate-800"
            }`}
          >
            Firmas y Autorizaciones
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN: RESUMEN EJECUTIVO (TARJETAS MINIMALISTAS) */}
      {/* ========================================================================= */}
      {seccion === "resumen" && (
        <div className="space-y-6">
          {/* Alertas Gerenciales */}
          {kpis?.alertas && kpis.alertas.length > 0 && (
            <div className="space-y-2">
              {kpis.alertas.map((alt, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                    alt.severidad === "DANGER"
                      ? "bg-red-50 dark:bg-red-950/40 border-red-200 text-red-800 dark:text-red-300"
                      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{alt.mensaje}</span>
                  </div>
                  {alt.codigo_referencia === "CAJA_CHICA" && (
                    <a
                      href="/contador/aprobacion-caja-chica"
                      className="px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700"
                    >
                      Revisar Vales
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* CUADRÍCULA DE 4 KPIS CRÍTICOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ventas Hoy */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Ventas Globales</span>
                <span className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                Bs. {Number(kpis?.ventas_hoy_monto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500">
                {kpis?.ventas_hoy_cantidad || 0} notas de venta registradas
              </p>
            </div>

            {/* Cuentas por Cobrar & Mora */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Cartera por Cobrar</span>
                <span className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
                  <DollarSign className="h-4 w-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                Bs. {Number(kpis?.cuentas_cobrar_saldo_total || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-red-600 font-semibold">
                En mora: Bs. {Number(kpis?.cuentas_cobrar_en_mora || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Vales Caja Chica Pendientes */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Vales por Firmar</span>
                <span className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-lg">
                  <Receipt className="h-4 w-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {kpis?.vales_caja_chica_pendientes_cantidad || 0} pendientes
              </div>
              <p className="text-[11px] text-slate-500">
                Total a autorizar: Bs. {Number(kpis?.vales_caja_chica_pendientes_monto || 0).toFixed(2)}
              </p>
            </div>

            {/* Saldos Bancarios */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Saldos en Bancos</span>
                <span className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-lg">
                  <Landmark className="h-4 w-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                Bs. {Number(kpis?.saldos_bancarios_total || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold">
                3 cuentas referenciales activas
              </p>
            </div>
          </div>

          {/* VISTA RESUMIDA DE LOS 3 BANCOS REFERENCIALES */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                  Saldos Conciliados en los 3 Bancos de la Empresa
                </h3>
                <p className="text-xs text-slate-500">
                  Control referencial clasificado por origen de recaudación
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeccion("bancos")}
                className="text-xs font-semibold"
              >
                Ver Detalle & Conciliar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {kpis?.bancos?.map((b) => (
                <div
                  key={b.id_cuenta}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {b.nombre_banco}
                    </span>
                    <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">
                      {b.sigla}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{b.numero_cuenta}</p>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-600">
                    {b.proposito.replace("_", " ")}
                  </Badge>
                  <div className="pt-2 border-t flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-400 font-semibold">SALDO CONCILIADO:</span>
                    <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
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
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                Conciliación y Control de Cuentas Bancarias
              </h3>
              <p className="text-xs text-slate-500">
                BMSC (Recaudación Choferes) • Banco Unión (Distribuidores y Clientes) • BNB (Institucional)
              </p>
            </div>
            <Button
              size="sm"
              onClick={cargarKPIs}
              className="bg-indigo-600 text-white text-xs h-8"
            >
              Actualizar Saldos
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kpis?.bancos?.map((b) => (
              <div
                key={b.id_cuenta}
                className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
              >
                <div className="flex justify-between items-start border-b pb-3">
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">
                      {b.nombre_banco}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">{b.numero_cuenta}</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 font-bold">{b.sigla}</Badge>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Propósito Operativo:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {b.proposito.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Saldo en Sistema:</span>
                    <span className="font-medium text-slate-700">
                      Bs. {Number(b.saldo_actual || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-indigo-600 pt-1 border-t">
                    <span>Saldo Conciliado:</span>
                    <span>Bs. {Number(b.saldo_conciliado || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    Última conciliación: {b.fecha_ultima_conciliacion ? b.fecha_ultima_conciliacion.split("T")[0] : "Pendiente"}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setBancoParaConciliar(b);
                    setNuevoSaldoConciliado(String(b.saldo_conciliado || b.saldo_actual || ""));
                    setModalConciliarOpen(true);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-8"
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
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
                  <Factory className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Consolidación Financiera de Inventario en Planta
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inspección formal de Materias Primas y Producto Terminado en Sucre vía <code className="text-indigo-600 font-bold">PlantaDataReader</code> (100% Solo Lectura)
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={cargarReportePlanta}
              disabled={cargandoPlanta}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8"
            >
              {cargandoPlanta ? "Leyendo Planta..." : "Actualizar Informe"}
            </Button>
          </div>

          {cargandoPlanta ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border">
              Cargando saldos físicos de planta en modo solo lectura...
            </div>
          ) : !reportePlanta ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border">
              Presione "Actualizar Informe" para generar la consolidación financiera.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tarjetas de Totales Valorizados */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Materias Primas:</span>
                  <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                    Bs. {Number(reportePlanta.total_materias_primas_valor || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Producto Terminado:</span>
                  <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                    Bs. {Number(reportePlanta.total_producto_terminado_valor || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
                  <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 uppercase">
                    VALOR TOTAL ACTIVOS PLANTA:
                  </span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    Bs. {Number(reportePlanta.total_valor_inventario_planta || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Tabla Materias Primas */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b font-bold text-xs uppercase text-slate-700">
                  I. Materias Primas en Almacén Fábrica (Bobinas y Rodelas)
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Categoría</th>
                      <th className="p-3">Unidades</th>
                      <th className="p-3">Peso / Medida</th>
                      <th className="p-3 text-right">Costo Estimado</th>
                      <th className="p-3 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reportePlanta.materias_primas?.map((mp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{mp.categoria}</td>
                        <td className="p-3">{mp.cantidad_unidades}</td>
                        <td className="p-3 font-mono text-slate-600">{mp.peso_o_medida}</td>
                        <td className="p-3 text-right">Bs. {Number(mp.costo_unitario_estimado).toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                          Bs. {Number(mp.valor_total_estimado).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tabla Producto Terminado */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b font-bold text-xs uppercase text-slate-700">
                  II. Producto Terminado en Fábrica Sucre
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase text-slate-500 border-b">
                    <tr>
                      <th className="p-3">Producto</th>
                      <th className="p-3">Presentación</th>
                      <th className="p-3">Tipo Contenedor</th>
                      <th className="p-3 text-right">Stock Disponible</th>
                      <th className="p-3 text-right">Costo Fábrica</th>
                      <th className="p-3 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reportePlanta.producto_terminado?.map((pt, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">{pt.producto_nombre}</td>
                        <td className="p-3 font-mono text-slate-600">{pt.presentacion_codigo}</td>
                        <td className="p-3">{pt.tipo_contenedor}</td>
                        <td className="p-3 text-right font-bold text-blue-600">{Number(pt.stock_paquetes).toFixed(0)}</td>
                        <td className="p-3 text-right">Bs. {Number(pt.precio_referencial).toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                          Bs. {Number(pt.valor_total_estimado).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] text-slate-500 text-center font-mono">
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
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                Historial de Autorizaciones y Firmas Digitales
              </h3>
              <p className="text-xs text-slate-500">
                Registro auditable de aprobaciones emitidas por Gerencia General
              </p>
            </div>
            <Button size="sm" onClick={cargarFirmas} className="text-xs h-8">
              Actualizar
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[11px] text-slate-500 border-b">
                <tr>
                  <th className="p-3">Fecha y Hora</th>
                  <th className="p-3">Tipo Documento</th>
                  <th className="p-3">Código Referencia</th>
                  <th className="p-3">Firmado Por</th>
                  <th className="p-3">Observaciones</th>
                  <th className="p-3 text-center">Sello Digital</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {firmas.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      No hay firmas emitidas recientemente.
                    </td>
                  </tr>
                ) : (
                  firmas.map((f) => (
                    <tr key={f.IdFirma} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-slate-500">{f.FechaFirma?.replace("T", " ").split(".")[0]}</td>
                      <td className="p-3 font-bold text-indigo-600">{f.TipoDocumento}</td>
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                        {f.CodigoReferencia || `ID-${f.IdRegistroDocumento}`}
                      </td>
                      <td className="p-3">{f.NombreUsuario || "Gerencia General"}</td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{f.Observaciones || "-"}</td>
                      <td className="p-3 text-center">
                        <Badge className="bg-emerald-100 text-emerald-800 gap-1 text-[10px]">
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
      )}

      {/* ========================================================================= */}
      {/* MODAL RESULTADO DE BÚSQUEDA GLOBAL */}
      {/* ========================================================================= */}
      <Dialog open={modalBusquedaOpen} onOpenChange={setModalBusquedaOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600" />
              Resultado de Búsqueda: "{resultadoBusqueda?.codigo_buscado}"
            </DialogTitle>
          </DialogHeader>

          {!resultadoBusqueda || resultadoBusqueda.documentos.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No se encontró ningún documento con el código o número ingresado.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-500 font-semibold">
                Se encontraron {resultadoBusqueda.total_encontrados} documentos vinculados:
              </p>

              {resultadoBusqueda.documentos.map((doc, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-extrabold text-sm text-indigo-600 block">
                        {doc.codigo}
                      </span>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                        {doc.titulo}
                      </h4>
                    </div>
                    <Badge className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-bold">
                      {doc.tipo_documento}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {doc.descripcion}
                  </p>

                  <div className="flex justify-between items-center text-xs pt-1 border-t">
                    <div>
                      <span className="text-slate-400">Estado: </span>
                      <span className="font-semibold">{doc.estado}</span>
                    </div>
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      Bs. {Number(doc.monto || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setDocParaFirmar(doc);
                        setModalFirmarOpen(true);
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 gap-1"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Firmar y Autorizar
                    </Button>
                    <a
                      href={doc.ruta_acceso}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 rounded text-xs font-semibold flex items-center gap-1 text-slate-800 dark:text-slate-200"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
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
        <DialogContent className="w-full sm:max-w-md p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Autorización y Firma Digital
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200">
              <span className="text-slate-400 block text-[10px]">DOCUMENTO A AUTORIZAR:</span>
              <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                {docParaFirmar?.codigo} - {docParaFirmar?.titulo}
              </span>
              <p className="font-bold text-slate-800 mt-1">Monto: Bs. {Number(docParaFirmar?.monto || 0).toFixed(2)}</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Observaciones de Autorización:
              </label>
              <Input
                placeholder="Aprobado y autorizado formalmente por Gerencia General"
                value={observacionFirma}
                onChange={(e) => setObservacionFirma(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <Button
              onClick={handleFirmarDocumento}
              disabled={firmando}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              {firmando ? "Registrando Firma..." : "Confirmar Autorización"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL CONCILIACIÓN REFERENCIAL DE BANCO */}
      {/* ========================================================================= */}
      <Dialog open={modalConciliarOpen} onOpenChange={setModalConciliarOpen}>
        <DialogContent className="w-full sm:max-w-sm p-6 bg-white dark:bg-slate-900 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-600" />
              Conciliar {bancoParaConciliar?.nombre_banco}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConciliarBanco} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Saldo Real según Extracto Bancario (Bs):
              </label>
              <Input
                type="number"
                step="0.01"
                value={nuevoSaldoConciliado}
                onChange={(e) => setNuevoSaldoConciliado(e.target.value)}
                required
                className="text-xs h-8 font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Observación / Referencia Extracto:
              </label>
              <Input
                placeholder="Extracto oficial emitido a fin de mes"
                value={obsConciliacion}
                onChange={(e) => setObsConciliacion(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <Button
              type="submit"
              disabled={conciliando}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9"
            >
              {conciliando ? "Guardando..." : "Asentar Conciliación"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
