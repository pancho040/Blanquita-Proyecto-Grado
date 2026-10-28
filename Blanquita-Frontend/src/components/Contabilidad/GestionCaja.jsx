import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  Lock,
  Unlock,
  History,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  Tag,
  Search,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ArqueoCajaModal from "./ArqueoCajaModal";
import ResumenCajaModal from "./ResumenCajaModal";
import ModalImportarExcel from "./ModalImportarExcel";
import { ImportarFlujoCaja } from "@/services/Contabilidad/importacionService";
import { FileSpreadsheet } from "lucide-react";
import { usePaginacion } from "@/hooks/usePaginacion";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { cache } from "@/lib/cacheService";
import {
  ObtenerCajaActual,
  ObtenerCajas,
  AperturarCaja,
  ObtenerMovimientosCaja,
  RegistrarMovimientoCaja,
  ObtenerCategoriasCaja,
  ObtenerCuentasBancarias,
} from "@/services/Contabilidad/tesoreriaService";

export default function GestionCaja({ usuario }) {
  const [cajaActual, setCajaActual] = useState(null);
  const [cargandoCaja, setCargandoCaja] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMovs, setCargandoMovs] = useState(false);
  const [cajasHistorial, setCajasHistorial] = useState([]);

  // Modales
  const [modalAperturaOpen, setModalAperturaOpen] = useState(false);
  const [modalMovimientoOpen, setModalMovimientoOpen] = useState(false);
  const [modalArqueoOpen, setModalArqueoOpen] = useState(false);
  const [modalResumenOpen, setModalResumenOpen] = useState(false);
  const [modalImportarOpen, setModalImportarOpen] = useState(false);

  // Datos para formularios
  const [categorias, setCategorias] = useState([]);
  const [cuentasBancarias, setCuentasBancarias] = useState([]);

  // Formulario Apertura
  const [saldoInicialApertura, setSaldoInicialApertura] = useState("0");
  const [obsApertura, setObsApertura] = useState("");
  const [guardandoApertura, setGuardandoApertura] = useState(false);

  // Formulario Movimiento
  const [tipoMov, setTipoMov] = useState("Ingreso");
  const [idCategoriaMov, setIdCategoriaMov] = useState("");
  const [idCuentaMov, setIdCuentaMov] = useState("");
  const [montoMov, setMontoMov] = useState("");
  const [glosaMov, setGlosaMov] = useState("");
  const [beneficiarioMov, setBeneficiarioMov] = useState("");
  const [numeroComprobanteMov, setNumeroComprobanteMov] = useState("");
  const [guardandoMov, setGuardandoMov] = useState(false);

  // Filtros Libro Diario
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [vistaActiva, setVistaActiva] = useState("diario"); // "diario" o "historial"

  // Cargar estado inicial
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargandoCaja(true);
      const [cajaRes, catsRes, bancosRes] = await Promise.all([
        ObtenerCajaActual().catch(() => null),
        ObtenerCategoriasCaja().catch(() => []),
        ObtenerCuentasBancarias().catch(() => []),
      ]);

      setCajaActual(cajaRes);
      setCategorias(catsRes);
      setCuentasBancarias(bancosRes);

      if (cajaRes?.IdAperturaCierre) {
        cargarMovimientos(cajaRes.IdAperturaCierre);
      } else {
        cargarMovimientos();
      }
    } catch (err) {
      toast.error("Error al cargar datos de caja: " + (err.message || ""));
    } finally {
      setCargandoCaja(false);
    }
  };

  const cargarMovimientos = async (idCaja = null) => {
    try {
      setCargandoMovs(true);
      const data = await ObtenerMovimientosCaja({
        idAperturaCierre: idCaja,
        limit: 100,
      });
      setMovimientos(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      toast.error("Error al cargar movimientos: " + err.message);
    } finally {
      setCargandoMovs(false);
    }
  };

  const cargarHistorialCajas = async () => {
    try {
      const data = await ObtenerCajas(20, 0);
      setCajasHistorial(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      toast.error("Error al cargar historial: " + err.message);
    }
  };

  const handleAperturar = async (e) => {
    e.preventDefault();
    const monto = parseFloat(saldoInicialApertura);
    if (isNaN(monto) || monto < 0) {
      toast.error("El saldo inicial debe ser un número mayor o igual a 0");
      return;
    }

    try {
      setGuardandoApertura(true);
      await AperturarCaja({
        saldo_inicial: monto,
        observaciones_apertura: obsApertura.trim() || "Apertura de turno",
      });
      toast.success("¡Caja abierta exitosamente!");
      setModalAperturaOpen(false);
      setSaldoInicialApertura("0");
      setObsApertura("");
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al aperturar caja");
    } finally {
      setGuardandoApertura(false);
    }
  };

  const handleCrearMovimiento = async (e) => {
    e.preventDefault();
    const monto = parseFloat(montoMov);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto válido mayor a 0");
      return;
    }
    if (!idCategoriaMov) {
      toast.error("Seleccione una categoría contable");
      return;
    }
    if (!glosaMov.trim()) {
      toast.error("Ingrese el concepto o glosa del movimiento");
      return;
    }

    try {
      setGuardandoMov(true);
      await RegistrarMovimientoCaja({
        id_apertura_cierre: cajaActual?.IdAperturaCierre || null,
        tipo: tipoMov,
        id_categoria: parseInt(idCategoriaMov, 10),
        id_cuenta_bancaria: idCuentaMov ? parseInt(idCuentaMov, 10) : null,
        monto,
        glosa: glosaMov.trim(),
        beneficiario: beneficiarioMov.trim() || null,
        numero_comprobante: numeroComprobanteMov.trim() || null,
        respaldo: numeroComprobanteMov.trim() || null,
      });

      toast.success(`Movimiento de ${tipoMov.toLowerCase()} registrado correctamente`);
      setModalMovimientoOpen(false);
      // Limpiar form
      setMontoMov("");
      setGlosaMov("");
      setBeneficiarioMov("");
      setNumeroComprobanteMov("");
      setIdCategoriaMov("");
      setIdCuentaMov("");

      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al registrar movimiento");
    } finally {
      setGuardandoMov(false);
    }
  };

  // Filtrado de movimientos
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (filtroTipo !== "TODOS" && m.Tipo !== filtroTipo) return false;
      if (filtroBusqueda.trim()) {
        const q = filtroBusqueda.toLowerCase();
        const coincideGlosa = m.Glosa?.toLowerCase().includes(q);
        const coincideBen = m.Beneficiario?.toLowerCase().includes(q);
        const coincideComp = m.NumeroComprobante?.toLowerCase().includes(q);
        const coincideCat = m.NombreCategoria?.toLowerCase().includes(q);
        return coincideGlosa || coincideBen || coincideComp || coincideCat;
      }
      return true;
    });
  }, [movimientos, filtroTipo, filtroBusqueda]);

  // Paginación optimizada
  const paginacion = usePaginacion(movimientosFiltrados, 15);

  return (
    <div className="space-y-6">
      {/* Encabezado y Acciones Principales */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <Wallet className="h-7 w-7 text-[#20A7DB]" />
            Flujo de Caja
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Libro diario de ingresos, egresos y arqueo de caja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalImportarOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs font-semibold text-xs h-10"
            title="Importar libro diario y arqueos desde archivo Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Importar Excel</span>
          </Button>
          {cajaActual && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalResumenOpen(true)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs font-semibold text-xs h-10"
              title="Visualizar informe consolidado de liquidez para gerencia"
            >
              <FileText className="h-4 w-4 text-[#20A7DB]" />
              <span>Informe de Cierre</span>
            </Button>
          )}

          {cajaActual ? (
            <>
              <Button
                onClick={() => setModalMovimientoOpen(true)}
                className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-2 shadow-xs"
              >
                <PlusCircle className="h-4 w-4" />
                Registrar Movimiento
              </Button>
              <Button
                onClick={() => setModalArqueoOpen(true)}
                variant="outline"
                className="border-rose-300 text-rose-700 hover:bg-rose-50 flex items-center gap-2"
              >
                <Lock className="h-4 w-4" />
                Cerrar Caja con Arqueo
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setModalAperturaOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-xs"
            >
              <Unlock className="h-4 w-4" />
              Aperturar Caja del Día
            </Button>
          )}
        </div>
      </div>

      {/* Tarjeta de Estado de Caja Actual */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Estado y Responsable */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Estado de Jornada
            </span>
            {cajaActual ? (
              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Abierta
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1 font-semibold">
                <Lock className="h-3.5 w-3.5" /> Cerrada
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium text-slate-500">Responsable:</div>
            <div className="text-base font-bold text-slate-800">
              {cajaActual?.NombreUsuarioApertura || usuario?.NombreCompleto || "Sin turno activo"}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {cajaActual?.FechaApertura
                ? new Date(cajaActual.FechaApertura).toLocaleDateString("es-BO", {
                    weekday: "long",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Requiere apertura para operar"}
            </div>
          </div>
        </div>

        {/* Saldo Inicial */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Saldo Inicial
          </span>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-700">
              Bs. {(cajaActual?.SaldoInicial || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-slate-400">Fondo de caja base</span>
          </div>
        </div>

        {/* Ingresos vs Egresos del Día */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Flujo del Turno
          </span>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" /> Ingresos:
              </span>
              <span className="font-bold text-emerald-700">
                +Bs. {(cajaActual?.TotalIngresos || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <ArrowDownLeft className="h-4 w-4" /> Egresos:
              </span>
              <span className="font-bold text-rose-700">
                -Bs. {(cajaActual?.TotalEgresos || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Saldo Teórico Actual */}
        <div className="bg-gradient-to-br from-[#20A7DB] to-[#1281ab] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
            Saldo Teórico en Caja
          </span>
          <div className="mt-2">
            <div className="text-3xl font-extrabold">
              Bs. {(cajaActual?.SaldoFinalTeorico || cajaActual?.SaldoInicial || 0).toLocaleString("es-BO", {
                minimumFractionDigits: 2,
              })}
            </div>
            <span className="text-xs text-white/80">Debe coincidir con arqueo físico</span>
          </div>
        </div>
      </div>

      {/* Tabs / Switcher entre Libro Diario e Historial */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setVistaActiva("diario")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            vistaActiva === "diario"
              ? "bg-[#20A7DB] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Wallet className="h-4 w-4" /> Libro Diario de Movimientos
        </button>
        <button
          onClick={() => {
            setVistaActiva("historial");
            cargarHistorialCajas();
          }}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            vistaActiva === "historial"
              ? "bg-[#20A7DB] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <History className="h-4 w-4" /> Historial de Turnos y Arqueos
        </button>
      </div>

      {/* VISTA 1: LIBRO DIARIO */}
      {vistaActiva === "diario" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filtros */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por glosa, beneficiario o N°..."
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                  className="pl-9 h-9 bg-white text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
                <button
                  onClick={() => setFiltroTipo("TODOS")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filtroTipo === "TODOS" ? "bg-[#20A7DB] text-white" : "hover:text-slate-900"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroTipo("Ingreso")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filtroTipo === "Ingreso" ? "bg-emerald-600 text-white" : "hover:text-slate-900"
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setFiltroTipo("Egreso")}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filtroTipo === "Egreso" ? "bg-rose-600 text-white" : "hover:text-slate-900"
                  }`}
                >
                  Egresos
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">N° Comprobante</th>
                  <th className="py-3 px-4">Categoría Contable</th>
                  <th className="py-3 px-4">Beneficiario / Concepto</th>
                  <th className="py-3 px-4">Medio / Cuenta</th>
                  <th className="py-3 px-4 text-center">Tipo</th>
                  <th className="py-3 px-4 text-right">Monto (Bs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargandoMovs ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      Cargando movimientos de caja...
                    </td>
                  </tr>
                ) : movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No se encontraron movimientos registrados en este turno.
                    </td>
                  </tr>
                ) : (
                  paginacion.itemsPaginados.map((m) => (
                    <tr key={m.IdMovimiento} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                        {m.FechaMovimiento
                          ? new Date(m.FechaMovimiento).toLocaleDateString("es-BO", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                        {m.NumeroComprobante || `MOV-${m.IdMovimiento}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded-md">
                          {m.NombreCategoria || "General"}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        <div className="font-semibold text-slate-800 text-xs">
                          {m.Beneficiario || "Sin beneficiario"}
                        </div>
                        <div className="text-xs text-slate-500 truncate" title={m.Glosa}>
                          {m.Glosa}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {m.NombreBanco ? (
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <Building2 className="h-3.5 w-3.5 text-[#20A7DB]" />
                            {m.NombreBanco}
                          </span>
                        ) : (
                          <span className="text-slate-400">Efectivo en Caja</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.Tipo === "Ingreso" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-xs">
                            + Ingreso
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 border border-rose-300 font-semibold text-xs">
                            - Egreso
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                        <span className={m.Tipo === "Ingreso" ? "text-emerald-700" : "text-rose-700"}>
                          Bs. {Number(m.Monto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginacion de movimientos de caja */}
          <PaginacionTabla {...paginacion} />
        </div>
      )}

      {/* VISTA 2: HISTORIAL DE TURNOS */}
      {vistaActiva === "historial" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Fecha Apertura</th>
                  <th className="py-3 px-4">Fecha Cierre</th>
                  <th className="py-3 px-4">Cajero / Usuario</th>
                  <th className="py-3 px-4 text-right">Saldo Inicial</th>
                  <th className="py-3 px-4 text-right">Saldo Teórico</th>
                  <th className="py-3 px-4 text-right">Saldo Arqueado</th>
                  <th className="py-3 px-4 text-center">Diferencia</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cajasHistorial.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      No hay historial de turnos registrado aún.
                    </td>
                  </tr>
                ) : (
                  cajasHistorial.map((c) => {
                    const dif = c.Diferencia ?? 0;
                    return (
                      <tr key={c.IdAperturaCierre} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">
                          {c.FechaApertura ? new Date(c.FechaApertura).toLocaleDateString("es-BO") : "-"}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {c.FechaCierre ? new Date(c.FechaCierre).toLocaleDateString("es-BO") : "En curso"}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                          {c.NombreUsuarioApertura || "Cajero"}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          Bs. {Number(c.SaldoInicial || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          Bs. {Number(c.SaldoFinalTeorico ?? c.SaldoInicial ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {c.SaldoFinalReal !== null && c.SaldoFinalReal !== undefined ? `Bs. ${Number(c.SaldoFinalReal).toFixed(2)}` : "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {c.Estado === "Abierta" ? (
                            <Badge className="bg-slate-100 text-slate-600">Pendiente</Badge>
                          ) : Math.abs(dif) < 0.01 ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Cuadrado</Badge>
                          ) : dif > 0 ? (
                            <Badge className="bg-amber-100 text-amber-800">+{dif.toFixed(2)}</Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-800">{dif.toFixed(2)}</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              c.Estado === "Abierta"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }
                          >
                            {c.Estado}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginacion de movimientos de caja */}
          <PaginacionTabla {...paginacion} />
        </div>
      )}

      {/* MODAL APERTURA DE CAJA */}
      {modalAperturaOpen && (
        <Dialog open={modalAperturaOpen} onOpenChange={setModalAperturaOpen}>
          <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-800">
                <Unlock className="h-5 w-5 text-emerald-600" />
                Apertura de Caja Diaria
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAperturar} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Saldo Inicial en Efectivo (Bs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={saldoInicialApertura}
                  onChange={(e) => setSaldoInicialApertura(e.target.value)}
                  placeholder="0.00"
                  className="text-lg font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Observaciones de Apertura
                </label>
                <Textarea
                  rows={2}
                  value={obsApertura}
                  onChange={(e) => setObsApertura(e.target.value)}
                  placeholder="Novedades, billetes fraccionados, turno mañana..."
                  className="text-sm"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setModalAperturaOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardandoApertura} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {guardandoApertura ? "Aperturando..." : "Confirmar Apertura"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL REGISTRO DE MOVIMIENTO */}
      {modalMovimientoOpen && (
        <Dialog open={modalMovimientoOpen} onOpenChange={setModalMovimientoOpen}>
          <DialogContent className="w-full sm:max-w-3xl p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-800">
                <PlusCircle className="h-5 w-5 text-[#20A7DB]" />
                Registrar Movimiento en Caja
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCrearMovimiento} className="space-y-3.5">
              {/* Switch Tipo */}
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setTipoMov("Ingreso")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    tipoMov === "Ingreso"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  + Ingreso de Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMov("Egreso")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    tipoMov === "Egreso"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  - Egreso / Salida
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Categoría */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Categoría Contable *
                  </label>
                  <select
                    required
                    value={idCategoriaMov}
                    onChange={(e) => setIdCategoriaMov(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
                  >
                    <option value="">Seleccione Categoría...</option>
                    {categorias
                      .filter((c) => !c.Tipo || c.Tipo === tipoMov)
                      .map((cat) => (
                        <option key={cat.IdCategoria} value={cat.IdCategoria}>
                          {cat.NombreCategoria}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Cuenta Bancaria (opcional) */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Cuenta / Destino (Opcional)
                  </label>
                  <select
                    value={idCuentaMov}
                    onChange={(e) => setIdCuentaMov(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#20A7DB]"
                  >
                    <option value="">Efectivo en Caja</option>
                    {cuentasBancarias.map((b) => (
                      <option key={b.IdCuentaBancaria} value={b.IdCuentaBancaria}>
                        {b.NombreBanco} ({b.TipoMoneda})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Monto */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Monto (Bs.) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    value={montoMov}
                    onChange={(e) => setMontoMov(e.target.value)}
                    placeholder="0.00"
                    className="font-bold text-base h-9"
                  />
                </div>

                {/* Respaldo / Nro. Comprobante */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    N° Comprobante / Respaldo
                  </label>
                  <Input
                    value={numeroComprobanteMov}
                    onChange={(e) => setNumeroComprobanteMov(e.target.value)}
                    placeholder="Ej: Recibo 1208, Factura 773"
                    className="text-xs h-9"
                  />
                </div>
              </div>

              {/* Beneficiario / Solicitante */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Beneficiario / Solicitante
                </label>
                <Input
                  value={beneficiarioMov}
                  onChange={(e) => setBeneficiarioMov(e.target.value)}
                  placeholder="Ej: Juan Perez, Distribuidora Sucre"
                  className="text-xs h-9"
                />
              </div>

              {/* Glosa */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Concepto / Glosa Detallada *
                </label>
                <Textarea
                  rows={2}
                  required
                  value={glosaMov}
                  onChange={(e) => setGlosaMov(e.target.value)}
                  placeholder="Detalle la justificación del movimiento..."
                  className="text-xs"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setModalMovimientoOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={guardandoMov}
                  className={
                    tipoMov === "Ingreso"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  }
                >
                  {guardandoMov ? "Guardando..." : `Confirmar ${tipoMov}`}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL DE ARQUEO Y CIERRE */}
      {modalArqueoOpen && (
        <ArqueoCajaModal
          isOpen={modalArqueoOpen}
          onClose={() => setModalArqueoOpen(false)}
          cajaActual={cajaActual}
          onCajaCerrada={() => {
            cargarDatos();
            setVistaActiva("historial");
          }}
        />
      )}

      {/* MODAL IMPORTAR EXCEL */}
      <ModalImportarExcel
        abierto={modalImportarOpen}
        onCerrar={() => setModalImportarOpen(false)}
        titulo="Importar Flujo de Caja"
        descripcion="Sube tu archivo Excel o procesa el archivo oficial del servidor para cargar ingresos, egresos y arqueos de caja."
        archivoPredeterminadoNombre="Flujo de Caja y Caja Chica 2025 - 2026 OFI.xlsx"
        onImportar={ImportarFlujoCaja}
        onCompletado={async () => {
          await cargarDatos();
        }}
      />

      {/* MODAL DE RESUMEN EJECUTIVO DE CIERRE / LIQUIDEZ */}
      {modalResumenOpen && (
        <ResumenCajaModal
          isOpen={modalResumenOpen}
          onClose={() => setModalResumenOpen(false)}
          caja={cajaActual}
          movimientos={movimientos}
        />
      )}
    </div>
  );
}
