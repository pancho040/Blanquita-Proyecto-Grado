import React, { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
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
import { SkeletonRow } from "@/components/common/LoadingStates";
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
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: false,
  });

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

  const cargarMovimientos = useCallback(async (idCaja = null) => {
    try {
      setCargandoMovs(true);
      const sidNum = Number(sucursal) || 1;
      const data = await ObtenerMovimientosCaja({
        idAperturaCierre: idCaja,
        limit: 100,
        idSucursal: sidNum,
      });
      setMovimientos(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      toast.error("Error al cargar movimientos: " + err.message);
    } finally {
      setCargandoMovs(false);
    }
  }, [sucursal]);

  const cargarDatos = useCallback(async () => {
    try {
      setCargandoCaja(true);
      const sidNum = Number(sucursal) || 1;
      const [cajaRes, catsRes, bancosRes] = await Promise.all([
        ObtenerCajaActual(sidNum).catch(() => null),
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
  }, [sucursal, cargarMovimientos]);

  useEffect(() => {
    if (!cargandoAlcance) {
      cargarDatos();
    }
  }, [sucursal, cargandoAlcance, cargarDatos]);

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
    <div className="space-y-4">
      {/* Encabezado y Acciones Principales */}
      <PageHeader
        title="Flujo de Caja y Libro Diario"
        subtitle="Libro diario de ingresos, egresos en efectivo y arqueos de caja física por sucursal."
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
        <Button
          type="button"
          variant="outline"
          onClick={() => setModalImportarOpen(true)}
          className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 font-medium text-xs h-8 px-2.5 rounded shadow-none"
          title="Importar libro diario y arqueos desde archivo Excel"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-[#15803D]" />
          <span>Importar Excel</span>
        </Button>
        {cajaActual && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalResumenOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 font-medium text-xs h-8 px-2.5 rounded shadow-none"
            title="Visualizar informe consolidado de liquidez para gerencia"
          >
            <FileText className="h-3.5 w-3.5 text-[#1C96C5]" />
            <span>Informe de Cierre</span>
          </Button>
        )}

        {cajaActual ? (
          <>
            <Button
              onClick={() => setModalMovimientoOpen(true)}
              className="bg-[#1C96C5] hover:bg-[#157A9E] text-white flex items-center gap-1.5 text-xs h-8 px-3 rounded font-medium border-0 shadow-none"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Registrar Movimiento
            </Button>
            <Button
              onClick={() => setModalArqueoOpen(true)}
              className="bg-[#B91C1C] hover:bg-red-800 text-white flex items-center gap-1.5 text-xs h-8 px-3 rounded font-medium border-0 shadow-none"
            >
              <Lock className="h-3.5 w-3.5" />
              Cerrar Caja con Arqueo
            </Button>
          </>
        ) : (
          <Button
            onClick={() => setModalAperturaOpen(true)}
            className="bg-[#15803D] hover:bg-green-800 text-white flex items-center gap-1.5 text-xs h-8 px-3 rounded font-medium border-0 shadow-none"
          >
            <Unlock className="h-3.5 w-3.5" />
            Aperturar Caja del Día
          </Button>
        )}
      </PageHeader>

      {/* Tarjeta de Estado de Caja Actual */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Estado y Responsable */}
        <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Estado de Jornada
            </span>
            {cajaActual ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]">
                <CheckCircle2 className="h-3 w-3" /> Abierta
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-100 border-slate-200 text-slate-600">
                <Lock className="h-3 w-3" /> Cerrada
              </span>
            )}
          </div>
          <div className="mt-3">
            <div className="text-[11px] text-slate-500">Responsable:</div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {cajaActual?.NombreUsuarioApertura || usuario?.NombreCompleto || "Sin turno activo"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              {cajaActual?.FechaApertura
                ? new Date(cajaActual.FechaApertura).toLocaleDateString("es-BO", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })
                : "Requiere apertura"}
            </div>
          </div>
        </div>

        {/* Saldo Inicial */}
        <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Saldo Inicial
          </span>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
              Bs. {(cajaActual?.SaldoInicial || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Fondo de caja base</span>
          </div>
        </div>

        {/* Ingresos vs Egresos del Día */}
        <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Flujo del Turno
          </span>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#15803D] font-medium flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" /> Ingresos:
              </span>
              <span className="font-bold font-mono tabular-nums text-[#15803D]">
                +Bs. {(cajaActual?.TotalIngresos || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#B91C1C] font-medium flex items-center gap-1">
                <ArrowDownLeft className="h-3.5 w-3.5" /> Egresos:
              </span>
              <span className="font-bold font-mono tabular-nums text-[#B91C1C]">
                -Bs. {(cajaActual?.TotalEgresos || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Saldo Teórico Actual */}
        <div className="bg-white p-4 rounded border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Saldo Teórico en Caja
          </span>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono tabular-nums text-[#1C96C5]">
              Bs. {(cajaActual?.SaldoFinalTeorico || cajaActual?.SaldoInicial || 0).toLocaleString("es-BO", {
                minimumFractionDigits: 2,
              })}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Arqueo físico requerido al cierre</span>
          </div>
        </div>
      </div>

      {/* Tabs / Switcher entre Libro Diario e Historial */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setVistaActiva("diario")}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
            vistaActiva === "diario"
              ? "bg-[#1C96C5] text-white"
              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" /> Libro Diario de Movimientos
        </button>
        <button
          onClick={() => {
            setVistaActiva("historial");
            cargarHistorialCajas();
          }}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
            vistaActiva === "historial"
              ? "bg-[#1C96C5] text-white"
              : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
          }`}
        >
          <History className="h-3.5 w-3.5" /> Historial de Turnos y Arqueos
        </button>
      </div>

      {/* VISTA 1: LIBRO DIARIO */}
      {vistaActiva === "diario" && (
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          {/* Filtros */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Buscar por glosa, beneficiario o N°..."
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                  className="pl-8 h-8 bg-white text-xs rounded border-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <div className="flex rounded border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
                <button
                  onClick={() => setFiltroTipo("TODOS")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    filtroTipo === "TODOS" ? "bg-[#1C96C5] text-white" : "hover:text-slate-900"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroTipo("Ingreso")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    filtroTipo === "Ingreso" ? "bg-[#15803D] text-white" : "hover:text-slate-900"
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setFiltroTipo("Egreso")}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    filtroTipo === "Egreso" ? "bg-[#B91C1C] text-white" : "hover:text-slate-900"
                  }`}
                >
                  Egresos
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-center">Fecha / Hora</th>
                  <th className="py-2 px-3">N° Comprobante</th>
                  <th className="py-2 px-3">Categoría Contable</th>
                  <th className="py-2 px-3">Beneficiario / Concepto</th>
                  <th className="py-2 px-3">Medio / Cuenta</th>
                  <th className="py-2 px-3 text-center">Tipo</th>
                  <th className="py-2 px-3 text-right">Monto (Bs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargandoMovs ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <SkeletonRow key={idx} cols={7} rowIdx={idx} />
                  ))
                ) : movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-xs text-slate-500 font-mono">
                      No se encontraron movimientos registrados en este turno.
                    </td>
                  </tr>
                ) : (
                  paginacion.itemsPaginados.map((m) => (
                    <tr key={m.IdMovimiento} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap text-center font-mono text-slate-600">
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
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">
                        {m.NumeroComprobante || `MOV-${m.IdMovimiento}`}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-800 text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {m.NombreCategoria || "General"}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-xs truncate">
                        <div className="font-semibold text-slate-900 text-xs">
                          {m.Beneficiario || "Sin beneficiario"}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate" title={m.Glosa}>
                          {m.Glosa}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {m.NombreBanco ? (
                          <span className="flex items-center gap-1 font-medium text-slate-800">
                            <Building2 className="h-3.5 w-3.5 text-[#1C96C5]" />
                            {m.NombreBanco}
                          </span>
                        ) : (
                          <span className="text-slate-500">Efectivo en Caja</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            m.Tipo === "Ingreso"
                              ? "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                              : "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]"
                          }`}
                        >
                          {m.Tipo === "Ingreso" ? "+ Ingreso" : "- Egreso"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        <span className={m.Tipo === "Ingreso" ? "text-[#15803D]" : "text-[#B91C1C]"}>
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
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-center">Fecha Apertura</th>
                  <th className="py-2 px-3 text-center">Fecha Cierre</th>
                  <th className="py-2 px-3">Cajero / Usuario</th>
                  <th className="py-2 px-3 text-right">Saldo Inicial</th>
                  <th className="py-2 px-3 text-right">Saldo Teórico</th>
                  <th className="py-2 px-3 text-right">Saldo Arqueado</th>
                  <th className="py-2 px-3 text-center">Diferencia</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cajasHistorial.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-6 text-center text-xs text-slate-500 font-mono">
                      No hay historial de turnos registrado aún.
                    </td>
                  </tr>
                ) : (
                  cajasHistorial.map((c) => {
                    const dif = c.Diferencia ?? 0;
                    return (
                      <tr key={c.IdAperturaCierre} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-center font-mono text-slate-600">
                          {c.FechaApertura ? new Date(c.FechaApertura).toLocaleDateString("es-BO") : "-"}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">
                          {c.FechaCierre ? new Date(c.FechaCierre).toLocaleDateString("es-BO") : "En curso"}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {c.NombreUsuarioApertura || "Cajero"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          Bs. {Number(c.SaldoInicial || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          Bs. {Number(c.SaldoFinalTeorico ?? c.SaldoInicial ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {c.SaldoFinalReal !== null && c.SaldoFinalReal !== undefined ? `Bs. ${Number(c.SaldoFinalReal).toFixed(2)}` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {c.Estado === "Abierta" ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-100 text-slate-600 border-slate-200">
                              Pendiente
                            </span>
                          ) : Math.abs(dif) < 0.01 ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium border bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]">
                              Cuadrado
                            </span>
                          ) : dif > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium border bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]">
                              +{dif.toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium border bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]">
                              {dif.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                              c.Estado === "Abierta"
                                ? "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {c.Estado}
                          </span>
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
          <DialogContent className="w-full sm:max-w-2xl p-5 rounded border border-slate-300 bg-white">
            <DialogHeader className="pb-2 border-b border-slate-200">
              <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Unlock className="h-4 w-4 text-[#15803D]" />
                Apertura de Caja Diaria
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAperturar} className="space-y-3 pt-2">
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
                  className="h-8 text-right font-mono tabular-nums text-sm font-bold rounded border-slate-300"
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
                  className="text-xs rounded border-slate-300"
                />
              </div>

              <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalAperturaOpen(false)}
                  className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={guardandoApertura}
                  className="h-8 px-3 rounded text-xs bg-[#15803D] hover:bg-green-800 text-white font-medium border-0"
                >
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
          <DialogContent className="w-full sm:max-w-3xl p-5 rounded border border-slate-300 bg-white">
            <DialogHeader className="pb-2 border-b border-slate-200">
              <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <PlusCircle className="h-4 w-4 text-[#1C96C5]" />
                Registrar Movimiento en Caja
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCrearMovimiento} className="space-y-3 pt-2">
              {/* Switch Tipo */}
              <div className="flex rounded border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setTipoMov("Ingreso")}
                  className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                    tipoMov === "Ingreso"
                      ? "bg-[#15803D] text-white"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  + Ingreso de Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMov("Egreso")}
                  className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                    tipoMov === "Egreso"
                      ? "bg-[#B91C1C] text-white"
                      : "text-slate-700 hover:text-slate-900"
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
                    className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                    className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                    className="h-8 font-mono tabular-nums text-right font-bold text-xs rounded border-slate-300"
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
                    className="h-8 text-xs font-mono rounded border-slate-300"
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
                  className="h-8 text-xs rounded border-slate-300"
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
                  className="text-xs rounded border-slate-300"
                />
              </div>

              <DialogFooter className="gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalMovimientoOpen(false)}
                  className="h-8 px-3 rounded text-xs border border-slate-300 text-slate-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={guardandoMov}
                  className={`h-8 px-3 rounded text-xs font-medium text-white border-0 ${
                    tipoMov === "Ingreso"
                      ? "bg-[#15803D] hover:bg-green-800"
                      : "bg-[#B91C1C] hover:bg-red-800"
                  }`}
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

