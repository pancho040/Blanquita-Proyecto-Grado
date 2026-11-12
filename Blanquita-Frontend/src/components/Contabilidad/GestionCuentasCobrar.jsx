import React, { useState, useEffect, useCallback, useMemo } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import {
  HandCoins,
  PlusCircle,
  Search,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Eye,
  FileText,
  DollarSign,
  ArrowDownLeft,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ObtenerCuentasCobrar,
  ObtenerCuentaCobrarDetalle,
  CrearCuentaCobrar,
  RegistrarAbono,
  ObtenerCarteraResumen,
  ObtenerClientesCxC,
} from "@/services/Contabilidad/cuentasCobrarService";
import { ObtenerCuentasBancarias } from "@/services/Contabilidad/tesoreriaService";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import { SkeletonRow, SkeletonMetrics } from "@/components/common/LoadingStates";
import ModalImportarExcel from "./ModalImportarExcel";
import StatusBadge from "@/components/common/StatusBadge";
import { ImportarCuentasCobrar } from "@/services/Contabilidad/importacionService";
import { FileSpreadsheet } from "lucide-react";
import { cache, invalidateContabilidad } from "@/lib/cacheService";

export default function GestionCuentasCobrar({ usuario }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

  const [cuentas, setCuentas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros y paginación
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroSoloVencidas, setFiltroSoloVencidas] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(15);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  // Modales
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [modalAbonoOpen, setModalAbonoOpen] = useState(false);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalImportarOpen, setModalImportarOpen] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [detalleCuenta, setDetalleCuenta] = useState(null);

  // Formulario Crear Cuenta Manual (Campos de Excel)
  const [guardandoCrear, setGuardandoCrear] = useState(false);
  const [formCrear, setFormCrear] = useState({
    id_cliente: "",
    IdSucursal: sucursal !== "todas" && sucursal ? Number(sucursal) : 1,
    destino: "Sucre",
    celular: "",
    numero_nota: "",
    numero_entrega: "",
    monto_total: "",
    linea_credito: "",
    fecha_emision: new Date().toISOString().split("T")[0],
    fecha_vencimiento: "",
    observaciones: "",
  });

  // Formulario Abono
  const [formAbono, setFormAbono] = useState({
    id_cuenta_cobrar: "",
    monto_abono: "",
    monto_dolares: "",
    tipo_cambio: "6.96",
    id_cuenta_bancaria: "",
    numero_deposito: "",
    depositante: "",
    metodo_pago: "Depósito Bancario",
    observaciones: "",
  });
  const [guardandoAbono, setGuardandoAbono] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const sid = sucursal === "todas" ? null : sucursal;
      const cacheKeyClientes = `contabilidad:clientesCxC:${sid || "todas"}`;

      // Auxiliares desde caché
      let clientesData = cache.get(cacheKeyClientes);
      let bancosData = cache.get("contabilidad:cuentasBancarias");

      const peticiones = [
        ObtenerCuentasCobrar({
          page: pagina,
          limit: limite,
          estado: filtroEstado !== "TODOS" ? filtroEstado : null,
          busqueda: busqueda.trim(),
          soloVencidas: filtroSoloVencidas,
          idSucursal: sid,
        }),
        ObtenerCarteraResumen(sid).catch(() => null),
      ];

      if (!clientesData) {
        peticiones.push(ObtenerClientesCxC(sid).catch(() => []));
      }
      if (!bancosData) {
        peticiones.push(ObtenerCuentasBancarias().catch(() => []));
      }

      const resultados = await Promise.all(peticiones);
      const cuentasRes = resultados[0];
      const resumenRes = resultados[1];

      let idx = 2;
      if (!clientesData) {
        const cRes = resultados[idx++];
        clientesData = Array.isArray(cRes) ? cRes : cRes?.items || [];
        cache.set(cacheKeyClientes, clientesData, 300);
      }
      if (!bancosData) {
        const bRes = resultados[idx++];
        bancosData = Array.isArray(bRes) ? bRes : bRes?.items || [];
        cache.set("contabilidad:cuentasBancarias", bancosData, 300);
      }

      const items = Array.isArray(cuentasRes) ? cuentasRes : (cuentasRes?.items || []);
      setCuentas(items);
      const total = cuentasRes?.total != null ? cuentasRes.total : items.length;
      setTotalRegistros(total);
      setTotalPaginas(cuentasRes?.total_paginas || Math.max(1, Math.ceil(total / limite)));

      setResumen(resumenRes);
      setClientes(clientesData);
      setBancos(bancosData);
    } catch (err) {
      toast.error("Error al cargar datos de cuentas por cobrar: " + err.message);
    } finally {
      setCargando(false);
    }
  }, [pagina, limite, filtroEstado, filtroSoloVencidas, busqueda, sucursal]);

  useEffect(() => {
    if (!cargandoAlcance) {
      cargarDatos();
    }
  }, [pagina, filtroEstado, filtroSoloVencidas, sucursal, cargandoAlcance, cargarDatos]);

  // Debounce de 250ms para búsqueda de cuentas
  useEffect(() => {
    if (cargandoAlcance) return;
    const timer = setTimeout(() => {
      cargarDatos();
    }, 250);
    return () => clearTimeout(timer);
  }, [busqueda, cargandoAlcance, cargarDatos]);

  // Renderizado optimizado: ventana virtual de registros para no sobrecargar el DOM
  const cuentasAMostrar = useMemo(() => {
    const lista = Array.isArray(cuentas) ? cuentas : [];
    if (lista.length > limite) {
      const inicio = (pagina - 1) * limite;
      return lista.slice(inicio, inicio + limite);
    }
    return lista;
  }, [cuentas, pagina, limite]);

  const abrirDetalle = async (cuenta) => {
    setCuentaSeleccionada(cuenta);
    try {
      const det = await ObtenerCuentaCobrarDetalle(cuenta.IdCuentaCobrar);
      setDetalleCuenta(det);
      setModalDetalleOpen(true);
    } catch (err) {
      toast.error("Error al cargar detalle: " + err.message);
    }
  };

  const handleCrearCuenta = async (e) => {
    e.preventDefault();
    if (!formCrear.id_cliente || !formCrear.monto_total) {
      toast.error("Seleccione un cliente e ingrese el monto");
      return;
    }
    try {
      setGuardandoCrear(true);
      const sidNum = Number(sucursal !== "todas" ? sucursal : (usuario?.IdSucursal || 1));
      await CrearCuentaCobrar({
        id_cliente: Number(formCrear.id_cliente),
        id_sucursal: sidNum,
        IdSucursal: sidNum,
        monto_total: Number(formCrear.monto_total),
        numero_nota: formCrear.numero_nota || undefined,
        numero_entrega: formCrear.numero_entrega || undefined,
        fecha_emision: formCrear.fecha_emision,
        fecha_vencimiento: formCrear.fecha_vencimiento || undefined,
        observaciones: `Destino: ${formCrear.destino} | Cel: ${formCrear.celular} | L.Cred: ${formCrear.linea_credito} | ${formCrear.observaciones}`.trim(),
      });
      toast.success("Cuenta por cobrar registrada exitosamente");
      setModalCrearOpen(false);
      setFormCrear({
        id_cliente: "",
        IdSucursal: sucursal !== "todas" && sucursal ? Number(sucursal) : 1,
        destino: "Sucre",
        celular: "",
        numero_nota: "",
        numero_entrega: "",
        monto_total: "",
        linea_credito: "",
        fecha_emision: new Date().toISOString().split("T")[0],
        fecha_vencimiento: "",
        observaciones: "",
      });
      invalidateContabilidad();
      cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al registrar cuenta");
    } finally {
      setGuardandoCrear(false);
    }
  };

  const abrirModalAbono = (cuenta = null) => {
    if (cuenta) {
      setCuentaSeleccionada(cuenta);
      setFormAbono({
        id_cuenta_cobrar: cuenta.IdCuentaCobrar.toString(),
        monto_abono: cuenta.SaldoPendiente.toString(),
        monto_dolares: "",
        tipo_cambio: "6.96",
        id_cuenta_bancaria: bancos[0]?.IdCuentaBancaria?.toString() || "",
        numero_deposito: "",
        depositante: cuenta.RazonSocial || "",
        metodo_pago: "Depósito Bancario",
        observaciones: "",
      });
    } else {
      setCuentaSeleccionada(null);
      setFormAbono({
        id_cuenta_cobrar: "",
        monto_abono: "",
        monto_dolares: "",
        tipo_cambio: "6.96",
        id_cuenta_bancaria: bancos[0]?.IdCuentaBancaria?.toString() || "",
        numero_deposito: "",
        depositante: "",
        metodo_pago: "Depósito Bancario",
        observaciones: "",
      });
    }
    setModalAbonoOpen(true);
  };

  const handleRegistrarAbono = async (e) => {
    e.preventDefault();
    const idCuenta = parseInt(formAbono.id_cuenta_cobrar, 10);
    const monto = parseFloat(formAbono.monto_abono);

    if (isNaN(idCuenta)) {
      toast.error("Seleccione una cuenta por cobrar");
      return;
    }
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto de abono válido mayor a 0");
      return;
    }

    try {
      setGuardandoAbono(true);
      await RegistrarAbono({
        id_cuenta_cobrar: idCuenta,
        monto_abono: monto,
        monto_dolares: formAbono.monto_dolares ? parseFloat(formAbono.monto_dolares) : null,
        tipo_cambio: formAbono.tipo_cambio ? parseFloat(formAbono.tipo_cambio) : null,
        id_cuenta_bancaria: formAbono.id_cuenta_bancaria ? parseInt(formAbono.id_cuenta_bancaria, 10) : null,
        numero_deposito: formAbono.numero_deposito.trim() || null,
        depositante: formAbono.depositante.trim() || null,
        metodo_pago: formAbono.metodo_pago,
        observaciones: formAbono.observaciones.trim() || null,
      });

      toast.success("¡Abono bancario registrado exitosamente!");
      invalidateContabilidad();
      setModalAbonoOpen(false);
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al registrar abono");
    } finally {
      setGuardandoAbono(false);
    }
  };

  const enviarRecordatorioMora = (cuenta) => {
    const nombre = cuenta.RazonSocial || cuenta.NombreComercial || "Cliente";
    const saldo = Number(cuenta.SaldoPendiente || 0).toFixed(2);
    const nota = cuenta.NumeroNota || `NV-${cuenta.IdNotaVenta || cuenta.IdCuentaCobrar}`;
    const dias = cuenta.DiasMora || 0;
    const telefono = cuenta.Telefono || "";

    const mensaje = encodeURIComponent(
      `Estimado cliente *${nombre}*,\n\nLe saludamos cordialmente de parte de *Empresa de Papel Blanquita (Shema Asociados S.R.L.)*.\n\nLe recordamos de manera atenta que mantiene un saldo pendiente de *Bs. ${saldo}* correspondiente a la Nota de Venta *${nota}* (${dias} días de vencimiento).\n\nAgradecemos su gentil colaboración para regularizar este compromiso a la brevedad mediante nuestras cuentas bancarias autorizadas o coordinando con su ejecutivo de distribución.\n\n_Departamento de Créditos y Cobranzas - Empresa de Papel Blanquita (Shema Asociados S.R.L.)_`
    );

    const url = telefono
      ? `https://wa.me/591${telefono.replace(/\D/g, "")}?text=${mensaje}`
      : `https://wa.me/?text=${mensaje}`;

    window.open(url, "_blank");
    // Registrar recordatorio de mora en el log de auditoría
    if (cuenta.IdCliente) {
      fetch(`/api/contabilidad/cxc/clientes/${cuenta.IdCliente}/recordatorio-mora`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detalle: `Recordatorio de mora enviado a ${nombre} por saldo de Bs. ${saldo} (Nota ${nota}, ${dias} días de vencimiento).`
        })
      }).catch(err => console.error("Error registrando recordatorio:", err));
    }
    toast.success(`Recordatorio de mora registrado y preparado para ${nombre}`);
  };

  return (
    <div className="space-y-4">
      {/* Encabezado Operativo */}
      <PageHeader
        title="Cuentas por Cobrar"
        subtitle="Control de cartera de clientes, estados de cuenta, control de mora y registro de abonos bancarios."
        branchFilter={
          <BranchFilter
            sucursal={sucursal}
            onChange={setSucursal}
            sucursales={sucursalesPermitidas}
            esMultisede={esMultisede}
            permiteTodas={true}
          />
        }
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => setModalImportarOpen(true)}
          className="h-8 rounded border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-medium"
          title="Importar cartera de clientes y cuentas por cobrar desde Excel"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-[#15803D]" />
          <span>Importar Excel</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setModalCrearOpen(true)}
          className="h-8 rounded flex items-center gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium"
        >
          <PlusCircle className="h-3.5 w-3.5 text-[#1C96C5]" />
          <span>Nueva Cuenta</span>
        </Button>
        <Button
          onClick={() => abrirModalAbono()}
          className="h-8 rounded bg-[#1C96C5] hover:bg-[#157A9E] text-white flex items-center gap-1.5 text-xs font-medium shadow-none"
        >
          <ArrowDownLeft className="h-3.5 w-3.5" />
          <span>Registrar Abono</span>
        </Button>
      </PageHeader>

      {/* Tarjetas Resumen de Cartera (con Skeleton industrial) */}
      {cargando && !resumen ? (
        <SkeletonMetrics count={4} columnsClass="grid-cols-1 sm:grid-cols-2 md:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Cartera */}
          <div className="bg-white p-3.5 rounded border border-slate-200 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Cartera por Cobrar
            </span>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                Bs. {(resumen?.TotalPorCobrar || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">{resumen?.TotalCuentasActivas || 0} créditos pendientes</span>
            </div>
          </div>

          {/* Cartera Vigente */}
          <div className="bg-white p-3.5 rounded border border-slate-200 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Cartera Vigente (&le; 15 días)
            </span>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tabular-nums text-[#15803D]">
                Bs. {(resumen?.CarteraVigente || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-[#15803D] font-medium mt-0.5 block">Dentro de plazo normal</span>
            </div>
          </div>

          {/* Cartera Vencida */}
          <div className="bg-[#FEF2F2] p-3.5 rounded border border-[#FCA5A5] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#B91C1C] uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Mora &gt; 15 Días
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tabular-nums text-[#B91C1C]">
                Bs. {(resumen?.CarteraVencida || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-[#B91C1C] font-medium mt-0.5 block">
                {resumen?.ClientesEnMora || 0} clientes en riesgo de bloqueo
              </span>
            </div>
          </div>

          {/* Total Abonos del Período */}
          <div className="bg-white border border-slate-200 p-3.5 rounded flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Recuperado / Abonos
            </span>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                Bs. {(resumen?.TotalAbonado || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Depósitos bancarios verificados</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de Cuentas por Cobrar */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        {/* Barra de Filtros */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-80 w-full">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar cliente, ciudad o nota de venta..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-8 h-8 rounded border-slate-300 bg-white text-xs w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => {
                setFiltroSoloVencidas(!filtroSoloVencidas);
                setPagina(1);
              }}
              className={`h-8 px-2.5 text-xs font-medium rounded border transition-colors flex items-center gap-1.5 ${
                filtroSoloVencidas
                  ? "bg-[#B91C1C] text-white border-[#B91C1C]"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Solo Vencidos (&gt;15 días)
            </button>

            <div className="flex rounded border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
              {["TODOS", "Pendiente", "Parcial", "Pagada"].map((est) => (
                <button
                  key={est}
                  onClick={() => {
                    setFiltroEstado(est);
                    setPagina(1);
                  }}
                  className={`h-7 px-2.5 rounded text-xs transition-colors ${
                    filtroEstado === est ? "bg-[#1C96C5] text-white font-medium" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Cliente / Razón Social</th>
                <th className="py-2.5 px-3">Ciudad</th>
                <th className="py-2.5 px-3">Nota de Venta</th>
                <th className="py-2.5 px-3">Fecha Emisión</th>
                <th className="py-2.5 px-3 text-center">Días Mora</th>
                <th className="py-2.5 px-3 text-right">Monto Original</th>
                <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <SkeletonRow key={idx} cols={9} rowIdx={idx} />
                ))
              ) : cuentasAMostrar.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No se encontraron cuentas que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                cuentasAMostrar.map((c) => {
                  const diasMora = c.DiasMora || 0;
                  const esMoraGrave = diasMora > 15;

                  return (
                    <tr key={c.IdCuentaCobrar} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 text-xs">
                          {c.RazonSocial || c.NombreComercial}
                        </div>
                        {c.NIT_CI && <div className="text-[11px] font-mono text-slate-400">NIT: {c.NIT_CI}</div>}
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">
                        {c.Ciudad || "Sucre"}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-[#1C96C5]">
                        {c.NumeroNota || `NV-${c.IdNotaVenta || c.IdCuentaCobrar}`}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {c.FechaEmision ? new Date(c.FechaEmision).toLocaleDateString("es-BO") : "-"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {c.Estado === "Pagada" ? (
                          <span className="text-[11px] text-[#15803D] font-medium">Al día</span>
                        ) : esMoraGrave ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C] font-mono font-bold text-[11px]">
                            <AlertTriangle className="h-3 w-3" /> {diasMora} d
                          </span>
                        ) : diasMora > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] font-mono font-medium text-[11px]">
                            {diasMora} d
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">0 d</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        Bs. {Number(c.MontoTotal || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                        <span className={Number(c.SaldoPendiente || 0) > 0 ? "text-[#B91C1C]" : "text-[#15803D]"}>
                          Bs. {Number(c.SaldoPendiente || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <StatusBadge
                          status={
                            c.Estado === "Pagada"
                              ? "aprobado"
                              : c.Estado === "Parcial"
                              ? "info"
                              : "pendiente"
                          }
                          label={c.Estado}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirDetalle(c)}
                            className="h-7 w-7 p-0 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Ver historial de abonos"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {Number(c.SaldoPendiente || 0) > 0 && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => enviarRecordatorioMora(c)}
                                className="h-7 px-2 text-[11px] rounded text-[#15803D] border-[#86EFAC] bg-[#F0FDF4] hover:bg-[#DCFCE7] flex items-center gap-1 font-medium"
                                title="Enviar recordatorio de mora vía WhatsApp"
                              >
                                <MessageSquare className="h-3 w-3" />
                                Recordar
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirModalAbono(c)}
                                className="h-7 px-2 text-[11px] rounded text-[#1C96C5] border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E0F2FE] flex items-center gap-1 font-medium"
                              >
                                <PlusCircle className="h-3 w-3" />
                                Abonar
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Estandarizada */}
        <PaginacionTabla
          paginaActual={pagina}
          totalPaginas={totalPaginas}
          totalItems={totalRegistros}
          pageSize={limite}
          indiceInicio={cuentas.length > 0 ? (pagina - 1) * limite + 1 : 0}
          indiceFin={Math.min(pagina * limite, totalRegistros)}
          puedeRetroceder={pagina > 1}
          puedeAvanzar={pagina < totalPaginas}
          cambiarPagina={(p) => setPagina(p)}
          cambiarPageSize={(nuevo) => {
            setLimite(nuevo);
            setPagina(1);
          }}
          opcionesPageSize={[10, 15, 25, 50]}
        />
      </div>

      {/* MODAL NUEVA CUENTA POR COBRAR (EXCEL / MANUAL) */}
      {modalCrearOpen && (
        <Dialog open={modalCrearOpen} onOpenChange={setModalCrearOpen}>
          <DialogContent className="w-full sm:max-w-2xl p-5 rounded border border-slate-300 bg-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 text-base font-semibold">
                <PlusCircle className="h-4 w-4 text-[#1C96C5]" />
                Registrar Cuenta por Cobrar
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCrearCuenta} className="space-y-3.5">
              {/* Sucursal de Registro */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Sucursal de Imputación *
                </label>
                {esMultisede ? (
                  <select
                    required
                    value={formCrear.IdSucursal || 1}
                    onChange={(e) => setFormCrear({ ...formCrear, IdSucursal: Number(e.target.value) })}
                    className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:border-[#1C96C5]"
                  >
                    {(sucursales || sucursalesPermitidas || []).filter((s) => s.id !== "todas").map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre || `Sucursal ${s.id}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 h-8 px-2.5 rounded border border-slate-200 bg-white text-slate-700 text-xs font-semibold">
                    <Building size={13} className="text-[#1C96C5]" />
                    <span>{nombreSucursalActual || "Sucursal Asignada"}</span>
                  </div>
                )}
                {sucursal === "todas" && (
                  <span className="text-[10px] text-[#B45309] font-medium block mt-1">
                    Nota: El filtro general está en consolidado. Indique expresamente a qué sede pertenece este registro.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cliente */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Cliente *
                  </label>
                  <select
                    required
                    value={formCrear.id_cliente}
                    onChange={(e) => {
                      const id = e.target.value;
                      const cli = clientes.find((c) => c.IdCliente.toString() === id);
                      setFormCrear({
                        ...formCrear,
                        id_cliente: id,
                        celular: cli?.Telefono || formCrear.celular,
                        destino: cli?.Ciudad || formCrear.destino,
                      });
                    }}
                    className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:border-[#1C96C5]"
                  >
                    <option value="">Seleccione Cliente...</option>
                    {clientes.map((c) => (
                      <option key={c.IdCliente} value={c.IdCliente}>
                        {c.RazonSocial || c.NombreComercial} ({c.Ciudad || "Sin ciudad"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destino */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Destino / Ciudad *
                  </label>
                  <select
                    value={formCrear.destino}
                    onChange={(e) => setFormCrear({ ...formCrear, destino: e.target.value })}
                    className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:border-[#1C96C5]"
                  >
                    <option value="Sucre">Sucre</option>
                    <option value="Cochabamba">Cochabamba</option>
                    <option value="El Alto">El Alto</option>
                    <option value="Tarija">Tarija</option>
                    <option value="Oruro">Oruro</option>
                    <option value="Potosí">Potosí</option>
                    <option value="Uyuni">Uyuni</option>
                    <option value="La Paz">La Paz</option>
                    <option value="Santa Cruz">Santa Cruz</option>
                  </select>
                </div>

                {/* Celular */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Teléfono / Celular
                  </label>
                  <Input
                    value={formCrear.celular}
                    onChange={(e) => setFormCrear({ ...formCrear, celular: e.target.value })}
                    placeholder="Ej: 71234567"
                    className="text-xs h-8 rounded border-slate-300"
                  />
                </div>

                {/* Línea de Crédito */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Línea de Crédito
                  </label>
                  <Input
                    value={formCrear.linea_credito}
                    onChange={(e) => setFormCrear({ ...formCrear, linea_credito: e.target.value })}
                    placeholder="Ej: 5000 Bs o 15 días"
                    className="text-xs h-8 rounded border-slate-300"
                  />
                </div>

                {/* N° Nota de Venta */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    N° Nota de Venta
                  </label>
                  <Input
                    value={formCrear.numero_nota}
                    onChange={(e) => setFormCrear({ ...formCrear, numero_nota: e.target.value })}
                    placeholder="Ej: NV-1045"
                    className="text-xs h-8 rounded border-slate-300 font-mono"
                  />
                </div>

                {/* N° Nota de Entrega */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    N° Nota de Entrega
                  </label>
                  <Input
                    value={formCrear.numero_entrega}
                    onChange={(e) => setFormCrear({ ...formCrear, numero_entrega: e.target.value })}
                    placeholder="Ej: NE-308"
                    className="text-xs h-8 rounded border-slate-300 font-mono"
                  />
                </div>

                {/* Monto Total */}
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Monto Total (Bs.) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    value={formCrear.monto_total}
                    onChange={(e) => setFormCrear({ ...formCrear, monto_total: e.target.value })}
                    placeholder="0.00"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right"
                  />
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Fecha Emisión
                    </label>
                    <Input
                      type="date"
                      value={formCrear.fecha_emision}
                      onChange={(e) => setFormCrear({ ...formCrear, fecha_emision: e.target.value })}
                      className="text-xs h-8 rounded border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Fecha Vencimiento
                    </label>
                    <Input
                      type="date"
                      value={formCrear.fecha_vencimiento}
                      onChange={(e) => setFormCrear({ ...formCrear, fecha_vencimiento: e.target.value })}
                      className="text-xs h-8 rounded border-slate-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Observaciones
                </label>
                <Textarea
                  rows={2}
                  value={formCrear.observaciones}
                  onChange={(e) => setFormCrear({ ...formCrear, observaciones: e.target.value })}
                  placeholder="Acuerdo comercial, condiciones de pago..."
                  className="text-xs rounded border-slate-300"
                />
              </div>

              <DialogFooter className="gap-2 pt-2 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setModalCrearOpen(false)} className="h-8 rounded text-xs border-slate-300">
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardandoCrear} className="h-8 rounded bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-medium">
                  {guardandoCrear ? "Registrando..." : "Guardar Cuenta"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL REGISTRAR ABONO */}
      {modalAbonoOpen && (
      <Dialog open={modalAbonoOpen} onOpenChange={setModalAbonoOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-5 rounded border border-slate-300 bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-base font-semibold">
              <PlusCircle className="h-4 w-4 text-[#1C96C5]" />
              Registrar Abono Bancario de Cliente
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegistrarAbono} className="space-y-3.5">
            {/* Cuenta por cobrar */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Cuenta / Cliente a Abonar *
              </label>
              <select
                required
                value={formAbono.id_cuenta_cobrar}
                onChange={(e) => {
                  const id = e.target.value;
                  const c = cuentas.find((x) => x.IdCuentaCobrar.toString() === id);
                  setFormAbono({
                    ...formAbono,
                    id_cuenta_cobrar: id,
                    monto_abono: c ? c.SaldoPendiente.toString() : formAbono.monto_abono,
                    depositante: c ? c.RazonSocial || c.NombreComercial : formAbono.depositante,
                  });
                }}
                className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:border-[#1C96C5]"
              >
                <option value="">Seleccione Cuenta o Cliente...</option>
                {cuentas
                  .filter((c) => Number(c.SaldoPendiente || 0) > 0)
                  .map((c) => (
                    <option key={c.IdCuentaCobrar} value={c.IdCuentaCobrar}>
                      {c.RazonSocial || c.NombreComercial} ({c.Ciudad}) - Saldo: Bs. {Number(c.SaldoPendiente || 0).toFixed(2)} [
                      {c.NumeroNota || `ID-${c.IdCuentaCobrar}`}]
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Monto Abono en BOB */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Monto del Abono (Bs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={formAbono.monto_abono}
                  onChange={(e) => setFormAbono({ ...formAbono, monto_abono: e.target.value })}
                  placeholder="0.00"
                  className="font-mono tabular-nums text-right font-bold text-sm h-8 rounded border-slate-300 text-slate-900"
                />
              </div>

              {/* Cuenta Bancaria de Destino */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Banco de Destino *
                </label>
                <select
                  required
                  value={formAbono.id_cuenta_bancaria}
                  onChange={(e) => setFormAbono({ ...formAbono, id_cuenta_bancaria: e.target.value })}
                  className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:border-[#1C96C5]"
                >
                  <option value="">Seleccione Banco...</option>
                  {bancos.map((b) => (
                    <option key={b.IdCuentaBancaria} value={b.IdCuentaBancaria}>
                      {b.NombreBanco} ({b.TipoMoneda})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Datos de Boleta / Comprobante */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  N° Boleta / Depósito Bancario
                </label>
                <Input
                  value={formAbono.numero_deposito}
                  onChange={(e) => setFormAbono({ ...formAbono, numero_deposito: e.target.value })}
                  placeholder="Ej: DEP-48921"
                  className="text-xs h-8 rounded border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Nombre del Depositante
                </label>
                <Input
                  value={formAbono.depositante}
                  onChange={(e) => setFormAbono({ ...formAbono, depositante: e.target.value })}
                  placeholder="Ej: Juan Perez (Chofer)"
                  className="text-xs h-8 rounded border-slate-300"
                />
              </div>
            </div>

            {/* Conversión Dólares Opcional */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                Equivalente en Dólares ($us) (Opcional)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Monto en $us</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formAbono.monto_dolares}
                    onChange={(e) => setFormAbono({ ...formAbono, monto_dolares: e.target.value })}
                    placeholder="0.00"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Tipo de Cambio</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formAbono.tipo_cambio}
                    onChange={(e) => setFormAbono({ ...formAbono, tipo_cambio: e.target.value })}
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Observaciones del Abono
              </label>
              <Textarea
                rows={2}
                value={formAbono.observaciones}
                onChange={(e) => setFormAbono({ ...formAbono, observaciones: e.target.value })}
                placeholder="Detalle de transferencia interbancaria, retención o acuerdo de pago..."
                className="text-xs rounded border-slate-300"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setModalAbonoOpen(false)} className="h-8 rounded text-xs border-slate-300">
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoAbono} className="h-8 rounded bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-medium">
                {guardandoAbono ? "Registrando..." : "Confirmar Abono"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL IMPORTAR EXCEL */}
      <ModalImportarExcel
        abierto={modalImportarOpen}
        onCerrar={() => setModalImportarOpen(false)}
        titulo="Importar Cuentas por Cobrar"
        descripcion="Sube tu archivo Excel o procesa la cartera oficial del servidor para actualizar saldos de clientes y abonos."
        archivoPredeterminadoNombre="3_CUENTAS POR COBRAR GESTION 2025-2026.xlsx"
        onImportar={ImportarCuentasCobrar}
        onCompletado={async () => {
          await cargarDatos();
        }}
      />

      {/* MODAL ESTADO DE CUENTA / HISTORIAL DE ABONOS */}
      {modalDetalleOpen && (
      <Dialog open={modalDetalleOpen} onOpenChange={setModalDetalleOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[88vh] overflow-y-auto p-5 rounded border border-slate-300 bg-white">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-base font-semibold">
              <FileText className="h-4 w-4 text-[#1C96C5]" />
              Estado de Cuenta: {detalleCuenta?.Cliente?.RazonSocial || cuentaSeleccionada?.RazonSocial}
            </DialogTitle>
          </DialogHeader>

          {detalleCuenta && (
            <div className="space-y-4 pt-1">
              {/* Tarjeta de Resumen del Crédito */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded text-xs">
                <div>
                  <span className="text-slate-500 block uppercase text-[11px] font-medium">Monto Total Nota:</span>
                  <span className="font-bold font-mono tabular-nums text-slate-900 text-sm">
                    Bs. {Number(detalleCuenta.MontoTotal || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase text-[11px] font-medium">Total Abonado:</span>
                  <span className="font-bold font-mono tabular-nums text-[#15803D] text-sm">
                    Bs. {Number((detalleCuenta.MontoTotal || 0) - (detalleCuenta.SaldoPendiente || 0)).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase text-[11px] font-medium">Saldo Deudor:</span>
                  <span className="font-bold font-mono tabular-nums text-[#B91C1C] text-sm">
                    Bs. {Number(detalleCuenta.SaldoPendiente || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Historial de Abonos */}
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-600 mb-2">
                  Historial de Abonos y Depósitos Registrados
                </h4>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">N° Depósito</th>
                        <th className="py-2 px-3">Banco Destino</th>
                        <th className="py-2 px-3">Depositante</th>
                        <th className="py-2 px-3 text-right">Monto (Bs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detalleCuenta.Abonos && detalleCuenta.Abonos.length > 0 ? (
                        detalleCuenta.Abonos.map((ab) => (
                          <tr key={ab.IdAbono} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono">{ab.FechaAbono ? new Date(ab.FechaAbono).toLocaleDateString("es-BO") : "-"}</td>
                            <td className="py-2 px-3 font-mono font-medium text-slate-800">{ab.NumeroDeposito || "-"}</td>
                            <td className="py-2 px-3 font-medium text-slate-700">{ab.NombreBanco || "Efectivo"}</td>
                            <td className="py-2 px-3 text-slate-600">{ab.Depositante || "-"}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-[#15803D]">
                              Bs. {Number(ab.MontoAbono || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-6 text-center text-slate-400">
                            No se registran abonos aún para esta cuenta.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center w-full pt-3 border-t border-slate-200 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-8 rounded gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-300"
            >
              <Printer className="h-3.5 w-3.5 text-[#1C96C5]" />
              <span>Imprimir Estado de Cuenta</span>
            </Button>
            <Button variant="outline" onClick={() => setModalDetalleOpen(false)} className="h-8 rounded text-xs border-slate-300">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}

