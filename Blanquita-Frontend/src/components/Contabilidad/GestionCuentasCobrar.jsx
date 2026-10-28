import React, { useState, useEffect } from "react";
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
import ModalImportarExcel from "./ModalImportarExcel";
import { ImportarCuentasCobrar } from "@/services/Contabilidad/importacionService";
import { FileSpreadsheet } from "lucide-react";
import { cache, invalidateContabilidad } from "@/lib/cacheService";

export default function GestionCuentasCobrar({ usuario }) {
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

  useEffect(() => {
    cargarDatos();
  }, [pagina, filtroEstado, filtroSoloVencidas]);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos();
    }, 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const cargarDatos = async () => {
    try {
      setCargando(true);

      // Auxiliares desde caché
      let clientesData = cache.get("contabilidad:clientesCxC");
      let bancosData = cache.get("contabilidad:cuentasBancarias");

      const peticiones = [
        ObtenerCuentasCobrar({
          page: pagina,
          limit: limite,
          estado: filtroEstado !== "TODOS" ? filtroEstado : null,
          busqueda: busqueda.trim(),
          soloVencidas: filtroSoloVencidas,
        }),
        ObtenerCarteraResumen().catch(() => null),
      ];

      if (!clientesData) {
        peticiones.push(ObtenerClientesCxC().catch(() => []));
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
        cache.set("contabilidad:clientesCxC", clientesData, 300);
      }
      if (!bancosData) {
        const bRes = resultados[idx++];
        bancosData = Array.isArray(bRes) ? bRes : bRes?.items || [];
        cache.set("contabilidad:cuentasBancarias", bancosData, 300);
      }

      const items = Array.isArray(cuentasRes) ? cuentasRes : (cuentasRes?.items || []);
      setCuentas(items);
      setTotalRegistros(cuentasRes?.total != null ? cuentasRes.total : items.length);
      setTotalPaginas(cuentasRes?.total_paginas || 1);

      setResumen(resumenRes);
      setClientes(clientesData);
      setBancos(bancosData);
    } catch (err) {
      toast.error("Error al cargar datos de cuentas por cobrar: " + err.message);
    } finally {
      setCargando(false);
    }
  };

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
      await CrearCuentaCobrar({
        id_cliente: Number(formCrear.id_cliente),
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
    // HU-08: Registrar recordatorio de mora en el log de auditoría
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
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <HandCoins className="h-7 w-7 text-[#20A7DB]" />
            Cuentas por Cobrar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cartera de clientes, estados de cuenta, mora y abonos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalImportarOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs font-semibold text-xs h-10"
            title="Importar cartera de clientes y cuentas por cobrar desde Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Importar Excel</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setModalCrearOpen(true)}
            className="flex items-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <PlusCircle className="h-4 w-4 text-[#20A7DB]" />
            Nueva Cuenta
          </Button>
          <Button
            onClick={() => abrirModalAbono()}
            className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-2 shadow-xs"
          >
            <HandCoins className="h-4 w-4" />
            Registrar Abono
          </Button>
        </div>
      </div>

      {/* Tarjetas Resumen de Cartera */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Cartera */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Cartera por Cobrar
          </span>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-800">
              Bs. {(resumen?.TotalPorCobrar || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-slate-400">{resumen?.TotalCuentasActivas || 0} créditos pendientes</span>
          </div>
        </div>

        {/* Cartera Vigente */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Cartera Vigente (&le; 15 días)
          </span>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-600">
              Bs. {(resumen?.CarteraVigente || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-emerald-600/80 font-medium">Dentro de plazo normal</span>
          </div>
        </div>

        {/* Cartera Vencida (Alerta RN-01) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Mora &gt; 15 Días (RN-01)
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-600">
              Bs. {(resumen?.CarteraVencida || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-rose-500 font-semibold">
              {resumen?.ClientesEnMora || 0} clientes en riesgo de bloqueo
            </span>
          </div>
        </div>

        {/* Total Abonos del Período */}
        <div className="bg-gradient-to-br from-[#20A7DB] to-[#1281ab] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
            Total Recuperado / Abonos
          </span>
          <div className="mt-2">
            <div className="text-2xl font-extrabold">
              Bs. {(resumen?.TotalAbonado || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-white/80">Depositado en Banco Unión / BNB</span>
          </div>
        </div>
      </div>

      {/* Tabla de Cuentas por Cobrar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Barra de Filtros */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar cliente, ciudad o nota de venta..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-9 h-9 bg-white text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setFiltroSoloVencidas(!filtroSoloVencidas);
                setPagina(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                filtroSoloVencidas
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Solo Vencidos (&gt;15 días)
            </button>

            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
              {["TODOS", "Pendiente", "Parcial", "Pagada"].map((est) => (
                <button
                  key={est}
                  onClick={() => {
                    setFiltroEstado(est);
                    setPagina(1);
                  }}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    filtroEstado === est ? "bg-[#20A7DB] text-white" : "hover:text-slate-900"
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
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Cliente / Razón Social</th>
                <th className="py-3 px-4">Ciudad</th>
                <th className="py-3 px-4">Nota de Venta</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4 text-center">Días Mora</th>
                <th className="py-3 px-4 text-right">Monto Original</th>
                <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    Cargando cuentas por cobrar...
                  </td>
                </tr>
              ) : cuentas.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No se encontraron cuentas que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                cuentas.map((c) => {
                  const diasMora = c.DiasMora || 0;
                  const esMoraGrave = diasMora > 15;

                  return (
                    <tr key={c.IdCuentaCobrar} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 text-xs">
                          {c.RazonSocial || c.NombreComercial}
                        </div>
                        {c.NIT_CI && <div className="text-[11px] text-slate-400 ">NIT: {c.NIT_CI}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                        {c.Ciudad || "Sucre"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-xs text-[#20A7DB]">
                        {c.NumeroNota || `NV-${c.IdNotaVenta || c.IdCuentaCobrar}`}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {c.FechaEmision ? new Date(c.FechaEmision).toLocaleDateString("es-BO") : "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.Estado === "Pagada" ? (
                          <span className="text-xs text-emerald-600 font-semibold">Al día</span>
                        ) : esMoraGrave ? (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-xs flex items-center justify-center gap-1 mx-auto w-fit">
                            <AlertTriangle className="h-3 w-3" /> {diasMora} días
                          </Badge>
                        ) : diasMora > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-medium text-xs">
                            {diasMora} días
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">0 días</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600 text-xs">
                        Bs. {Number(c.MontoTotal || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                        <span className={Number(c.SaldoPendiente || 0) > 0 ? "text-rose-600" : "text-emerald-600"}>
                          Bs. {Number(c.SaldoPendiente || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          className={
                            c.Estado === "Pagada"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : c.Estado === "Parcial"
                              ? "bg-blue-100 text-blue-800 border-blue-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          }
                        >
                          {c.Estado}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => abrirDetalle(c)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
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
                                className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 font-semibold"
                                title="Enviar recordatorio de mora vía WhatsApp"
                              >
                                <MessageSquare className="h-3 w-3" />
                                Recordar
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => abrirModalAbono(c)}
                                className="h-7 px-2 text-xs text-[#20A7DB] border-[#20A7DB]/40 hover:bg-[#20A7DB]/10 flex items-center gap-1"
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
          <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-800">
                <PlusCircle className="h-5 w-5 text-[#20A7DB]" />
                Registrar Cuenta por Cobrar
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCrearCuenta} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cliente */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
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
                    className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
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
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Destino / Ciudad *
                  </label>
                  <select
                    value={formCrear.destino}
                    onChange={(e) => setFormCrear({ ...formCrear, destino: e.target.value })}
                    className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
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
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Teléfono / Celular
                  </label>
                  <Input
                    value={formCrear.celular}
                    onChange={(e) => setFormCrear({ ...formCrear, celular: e.target.value })}
                    placeholder="Ej: 71234567"
                    className="text-xs h-9"
                  />
                </div>

                {/* Línea de Crédito */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Línea de Crédito
                  </label>
                  <Input
                    value={formCrear.linea_credito}
                    onChange={(e) => setFormCrear({ ...formCrear, linea_credito: e.target.value })}
                    placeholder="Ej: 5000 Bs o 15 días"
                    className="text-xs h-9"
                  />
                </div>

                {/* N° Nota de Venta */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    N° Nota de Venta
                  </label>
                  <Input
                    value={formCrear.numero_nota}
                    onChange={(e) => setFormCrear({ ...formCrear, numero_nota: e.target.value })}
                    placeholder="Ej: NV-1045"
                    className="text-xs h-9"
                  />
                </div>

                {/* N° Nota de Entrega */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    N° Nota de Entrega
                  </label>
                  <Input
                    value={formCrear.numero_entrega}
                    onChange={(e) => setFormCrear({ ...formCrear, numero_entrega: e.target.value })}
                    placeholder="Ej: NE-308"
                    className="text-xs h-9"
                  />
                </div>

                {/* Monto Total */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
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
                    className="text-xs h-9"
                  />
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Fecha Emisión
                    </label>
                    <Input
                      type="date"
                      value={formCrear.fecha_emision}
                      onChange={(e) => setFormCrear({ ...formCrear, fecha_emision: e.target.value })}
                      className="text-xs h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Fecha Vencimiento
                    </label>
                    <Input
                      type="date"
                      value={formCrear.fecha_vencimiento}
                      onChange={(e) => setFormCrear({ ...formCrear, fecha_vencimiento: e.target.value })}
                      className="text-xs h-9"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Observaciones
                </label>
                <Textarea
                  rows={2}
                  value={formCrear.observaciones}
                  onChange={(e) => setFormCrear({ ...formCrear, observaciones: e.target.value })}
                  placeholder="Acuerdo comercial, condiciones de pago..."
                  className="text-xs"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setModalCrearOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardandoCrear} className="bg-[#20A7DB] hover:bg-[#1992c0] text-white">
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
        <DialogContent className="w-full sm:max-w-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <PlusCircle className="h-5 w-5 text-[#20A7DB]" />
              Registrar Abono Bancario de Cliente
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegistrarAbono} className="space-y-3.5">
            {/* Cuenta por cobrar */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
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
                className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
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
                <label className="text-xs font-semibold text-slate-700 block mb-1">
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
                  className="font-bold text-base h-9 text-slate-800"
                />
              </div>

              {/* Cuenta Bancaria de Destino */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Banco de Destino *
                </label>
                <select
                  required
                  value={formAbono.id_cuenta_bancaria}
                  onChange={(e) => setFormAbono({ ...formAbono, id_cuenta_bancaria: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
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
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° Boleta / Depósito Bancario
                </label>
                <Input
                  value={formAbono.numero_deposito}
                  onChange={(e) => setFormAbono({ ...formAbono, numero_deposito: e.target.value })}
                  placeholder="Ej: DEP-48921"
                  className="text-xs h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nombre del Depositante
                </label>
                <Input
                  value={formAbono.depositante}
                  onChange={(e) => setFormAbono({ ...formAbono, depositante: e.target.value })}
                  placeholder="Ej: Juan Perez (Chofer)"
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Conversión Dólares Opcional */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Equivalente en Dólares ($us) (Opcional)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block">Monto en $us</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formAbono.monto_dolares}
                    onChange={(e) => setFormAbono({ ...formAbono, monto_dolares: e.target.value })}
                    placeholder="0.00"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block">Tipo de Cambio</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formAbono.tipo_cambio}
                    onChange={(e) => setFormAbono({ ...formAbono, tipo_cambio: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Observaciones del Abono
              </label>
              <Textarea
                rows={2}
                value={formAbono.observaciones}
                onChange={(e) => setFormAbono({ ...formAbono, observaciones: e.target.value })}
                placeholder="Detalle de transferencia interbancaria, retención o acuerdo de pago..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalAbonoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoAbono} className="bg-[#20A7DB] hover:bg-[#1992c0] text-white">
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
        <DialogContent className="w-full sm:max-w-4xl max-h-[88vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <FileText className="h-5 w-5 text-[#20A7DB]" />
              Estado de Cuenta: {detalleCuenta?.Cliente?.RazonSocial || cuentaSeleccionada?.RazonSocial}
            </DialogTitle>
          </DialogHeader>

          {detalleCuenta && (
            <div className="space-y-4">
              {/* Tarjeta de Resumen del Crédito */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block uppercase">Monto Total Nota:</span>
                  <span className="font-bold text-slate-800 text-sm">
                    Bs. {Number(detalleCuenta.MontoTotal || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase">Total Abonado:</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    Bs. {Number((detalleCuenta.MontoTotal || 0) - (detalleCuenta.SaldoPendiente || 0)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase">Saldo Deudor:</span>
                  <span className="font-bold text-rose-600 text-sm">
                    Bs. {Number(detalleCuenta.SaldoPendiente || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Historial de Abonos */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Historial de Abonos y Depósitos Registrados
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">N° Depósito</th>
                        <th className="py-2.5 px-3">Banco Destino</th>
                        <th className="py-2.5 px-3">Depositante</th>
                        <th className="py-2.5 px-3 text-right">Monto (Bs.)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detalleCuenta.Abonos && detalleCuenta.Abonos.length > 0 ? (
                        detalleCuenta.Abonos.map((ab) => (
                          <tr key={ab.IdAbono} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">{ab.FechaAbono ? new Date(ab.FechaAbono).toLocaleDateString("es-BO") : "-"}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">{ab.NumeroDeposito || "-"}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-700">{ab.NombreBanco || "Efectivo"}</td>
                            <td className="py-2.5 px-3 text-slate-500">{ab.Depositante || "-"}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              Bs. {Number(ab.MontoAbono || 0).toFixed(2)}
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

          <DialogFooter className="flex justify-between items-center w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 text-slate-700 hover:text-slate-900 border-slate-300"
            >
              <Printer className="h-4 w-4 text-[#20A7DB]" />
              <span>Imprimir Estado de Cuenta</span>
            </Button>
            <Button variant="outline" onClick={() => setModalDetalleOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
