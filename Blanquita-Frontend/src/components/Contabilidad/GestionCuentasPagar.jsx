import React, { useState, useEffect } from "react";
import {
  Layers,
  PlusCircle,
  Search,
  Building,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Eye,
  CornerDownLeft,
  DollarSign,
  Package,
  ChevronLeft,
  ChevronRight,
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
  ObtenerCuentasPagar,
  ObtenerKpisCxP,
  ObtenerProveedoresContabilidad,
  ObtenerCuentaPagarDetalle,
  CrearCuentaPagar,
  RegistrarPagoCxP,
  RegistrarDevolucionCxP,
  ObtenerBalanceProveedores,
} from "@/services/Contabilidad/cuentasPagarService";
import { ObtenerCuentasBancarias } from "@/services/Contabilidad/tesoreriaService";
import PaginacionTabla from "@/components/common/PaginacionTabla";
import ModalImportarExcel from "./ModalImportarExcel";
import { ImportarProveedores } from "@/services/Contabilidad/importacionService";
import { FileSpreadsheet } from "lucide-react";
import { cache, invalidateContabilidad } from "@/lib/cacheService";

export default function GestionCuentasPagar({ usuario }) {
  const [cuentas, setCuentas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [balance, setBalance] = useState([]);
  const [cargando, setCargando] = useState(true);

  // KPIs del servidor
  const [kpis, setKpis] = useState({
    TotalDeuda: 0,
    TotalCuentas: 0,
    FacturasPendientes: 0,
    FacturasVencidas: 0,
    ProveedoresConDeuda: 0,
    TotalProveedores: 0,
  });

  // Paginación y Filtros de Servidor
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(15);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  // Modales
  const [modalFacturaOpen, setModalFacturaOpen] = useState(false);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [modalDevolucionOpen, setModalDevolucionOpen] = useState(false);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalImportarOpen, setModalImportarOpen] = useState(false);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [detalleCuenta, setDetalleCuenta] = useState(null);

  // Formulario Factura / Cuenta por Pagar
  const [formFactura, setFormFactura] = useState({
    id_proveedor: "",
    numero_factura: "",
    concepto: "",
    monto_total: "",
    fecha_emision: new Date().toISOString().split("T")[0],
    fecha_vencimiento: "",
    dias_credito: "30",
    observaciones: "",
    // Insumo principal
    descripcion_insumo: "Bobinas de Papel Kraft",
    cantidad: "1",
    unidad_medida: "Tn",
    costo_unitario: "",
  });
  const [guardandoFactura, setGuardandoFactura] = useState(false);

  // Formulario Pago
  const [formPago, setFormPago] = useState({
    id_cuenta_pagar: "",
    monto_pago: "",
    id_cuenta_bancaria: "",
    numero_cheque_transferencia: "",
    metodo_pago: "Transferencia Bancaria",
    observaciones: "",
  });
  const [guardandoPago, setGuardandoPago] = useState(false);

  // Formulario Devolución
  const [formDev, setFormDev] = useState({
    id_cuenta_pagar: "",
    monto_compensado: "",
    motivo: "",
    numero_nota_credito: "",
  });
  const [guardandoDev, setGuardandoDev] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [pagina, filtroEstado]);

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

      let provsData = cache.get("contabilidad:proveedoresCxP");
      let bancosData = cache.get("contabilidad:cuentasBancarias");
      let balanceData = cache.get("contabilidad:balanceProveedores");

      const peticiones = [
        ObtenerKpisCxP().catch(() => null),
        ObtenerCuentasPagar({
          page: pagina,
          limit: limite,
          estado: filtroEstado !== "TODOS" ? filtroEstado : null,
          busqueda: busqueda.trim(),
        }),
      ];

      if (!provsData) peticiones.push(ObtenerProveedoresContabilidad().catch(() => []));
      if (!bancosData) peticiones.push(ObtenerCuentasBancarias().catch(() => []));
      if (!balanceData) peticiones.push(ObtenerBalanceProveedores().catch(() => []));

      const resultados = await Promise.all(peticiones);
      const kpisRes = resultados[0];
      const cuentasRes = resultados[1];

      let idx = 2;
      if (!provsData) {
        const pRes = resultados[idx++];
        provsData = Array.isArray(pRes) ? pRes : pRes?.items || [];
        cache.set("contabilidad:proveedoresCxP", provsData, 300);
      }
      if (!bancosData) {
        const bRes = resultados[idx++];
        bancosData = Array.isArray(bRes) ? bRes : bRes?.items || [];
        cache.set("contabilidad:cuentasBancarias", bancosData, 300);
      }
      if (!balanceData) {
        const balRes = resultados[idx++];
        balanceData = Array.isArray(balRes) ? balRes : [];
        cache.set("contabilidad:balanceProveedores", balanceData, 300);
      }

      if (kpisRes) setKpis(kpisRes);

      const items = Array.isArray(cuentasRes) ? cuentasRes : (cuentasRes?.items || []);
      setCuentas(items);
      setTotalRegistros(cuentasRes?.total != null ? cuentasRes.total : items.length);
      setTotalPaginas(cuentasRes?.total_paginas || 1);

      setProveedores(provsData);
      setBancos(bancosData);
      setBalance(balanceData);
    } catch (err) {
      toast.error("Error al cargar cuentas por pagar: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const verDetalle = async (c) => {
    setCuentaSeleccionada(c);
    try {
      const det = await ObtenerCuentaPagarDetalle(c.IdCuentaPagar);
      setDetalleCuenta(det);
      setModalDetalleOpen(true);
    } catch (err) {
      toast.error("Error al cargar detalle: " + err.message);
    }
  };

  const abrirModalPago = (c = null) => {
    if (c) {
      setCuentaSeleccionada(c);
      setFormPago({
        id_cuenta_pagar: c.IdCuentaPagar.toString(),
        monto_pago: c.SaldoPendiente.toString(),
        id_cuenta_bancaria: bancos[0]?.IdCuentaBancaria?.toString() || "",
        numero_cheque_transferencia: "",
        metodo_pago: "Transferencia Bancaria",
        observaciones: "",
      });
    } else {
      setCuentaSeleccionada(null);
      setFormPago({
        id_cuenta_pagar: "",
        monto_pago: "",
        id_cuenta_bancaria: bancos[0]?.IdCuentaBancaria?.toString() || "",
        numero_cheque_transferencia: "",
        metodo_pago: "Transferencia Bancaria",
        observaciones: "",
      });
    }
    setModalPagoOpen(true);
  };

  const abrirModalDevolucion = (c) => {
    setCuentaSeleccionada(c);
    setFormDev({
      id_cuenta_pagar: c.IdCuentaPagar.toString(),
      monto_compensado: "",
      motivo: "",
      numero_nota_credito: "",
    });
    setModalDevolucionOpen(true);
  };

  const handleCrearFactura = async (e) => {
    e.preventDefault();
    const idProv = parseInt(formFactura.id_proveedor, 10);
    const monto = parseFloat(formFactura.monto_total);

    if (isNaN(idProv)) {
      toast.error("Seleccione un proveedor");
      return;
    }
    if (!formFactura.numero_factura.trim() || isNaN(monto) || monto <= 0) {
      toast.error("Complete el número de factura y un monto válido");
      return;
    }

    try {
      setGuardandoFactura(true);
      await CrearCuentaPagar({
        id_proveedor: idProv,
        numero_factura: formFactura.numero_factura.trim(),
        concepto: formFactura.concepto.trim() || "Compra de Materia Prima / Insumos",
        monto_total: monto,
        fecha_emision: formFactura.fecha_emision || null,
        fecha_vencimiento: formFactura.fecha_vencimiento || null,
        dias_credito: parseInt(formFactura.dias_credito, 10) || 30,
        observaciones: formFactura.observaciones.trim() || null,
        insumos: [
          {
            descripcion_insumo: formFactura.descripcion_insumo,
            cantidad: parseFloat(formFactura.cantidad) || 1,
            unidad_medida: formFactura.unidad_medida,
            costo_unitario: parseFloat(formFactura.costo_unitario) || monto,
            subtotal: monto,
          },
        ],
      });

      toast.success("¡Cuenta por pagar y factura registrada!");
      invalidateContabilidad();
      setModalFacturaOpen(false);
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al registrar factura");
    } finally {
      setGuardandoFactura(false);
    }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    const idCta = parseInt(formPago.id_cuenta_pagar, 10);
    const monto = parseFloat(formPago.monto_pago);

    if (isNaN(idCta) || isNaN(monto) || monto <= 0) {
      toast.error("Seleccione una cuenta e ingrese un monto válido");
      return;
    }

    try {
      setGuardandoPago(true);
      await RegistrarPagoCxP({
        id_cuenta_pagar: idCta,
        monto_pago: monto,
        id_cuenta_bancaria: formPago.id_cuenta_bancaria ? parseInt(formPago.id_cuenta_bancaria, 10) : null,
        numero_cheque_transferencia: formPago.numero_cheque_transferencia.trim() || null,
        metodo_pago: formPago.metodo_pago,
        observaciones: formPago.observaciones.trim() || null,
      });

      toast.success("¡Pago a proveedor registrado exitosamente!");
      invalidateContabilidad();
      setModalPagoOpen(false);
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al registrar pago");
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleRegistrarDevolucion = async (e) => {
    e.preventDefault();
    const idCta = parseInt(formDev.id_cuenta_pagar, 10);
    const monto = parseFloat(formDev.monto_compensado);

    if (isNaN(idCta) || isNaN(monto) || monto <= 0) {
      toast.error("Ingrese un monto de compensación válido");
      return;
    }
    if (!formDev.motivo.trim()) {
      toast.error("Indique el motivo de la devolución de material");
      return;
    }

    try {
      setGuardandoDev(true);
      await RegistrarDevolucionCxP({
        id_cuenta_pagar: idCta,
        monto_compensado: monto,
        motivo: formDev.motivo.trim(),
        numero_nota_credito: formDev.numero_nota_credito.trim() || null,
      });

      toast.success("¡Devolución y reducción de saldo procesada!");
      invalidateContabilidad();
      setModalDevolucionOpen(false);
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al registrar devolución");
    } finally {
      setGuardandoDev(false);
    }
  };

  // Totales desde KPIs del servidor
  const totalDeudaProveedores = kpis.TotalDeuda || 0;
  const facturasVencidas = kpis.FacturasVencidas || 0;
  const totalProveedores = kpis.TotalProveedores || proveedores.length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <Layers className="h-7 w-7 text-[#20A7DB]" />
            Cuentas por Pagar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión de deudas con proveedores, facturas y pagos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalImportarOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs font-semibold text-xs h-10"
            title="Importar cuentas de proveedores e insumos desde Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Importar Excel</span>
          </Button>
          <Button
            onClick={() => setModalFacturaOpen(true)}
            className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-2 shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            Nueva Factura
          </Button>
          <Button
            onClick={() => abrirModalPago()}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
          >
            <CreditCard className="h-4 w-4" />
            Registrar Pago
          </Button>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Deuda a Proveedores
          </span>
          <div className="text-2xl font-bold text-slate-800 mt-2">
            Bs. {totalDeudaProveedores.toLocaleString("es-BO", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Insumos y materias primas en crédito</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Facturas Vencidas
          </span>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {facturasVencidas} facturas
          </div>
          <span className="text-xs text-rose-500 mt-1 block">Requieren cancelación prioritaria</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Proveedores Activos
          </span>
          <div className="text-2xl font-bold text-[#20A7DB] mt-2">
            {totalProveedores} empresas
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Vinto, Derqui, Multiflex, Colmaflex...</span>
        </div>
      </div>

      {/* Tabla de Facturas por Pagar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar proveedor, N° factura o concepto..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-9 h-9 bg-white text-sm"
            />
          </div>

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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">N° Factura</th>
                <th className="py-3 px-4">Concepto / Insumo</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-right">Monto Original</th>
                <th className="py-3 px-4 text-right">Saldo Deudor</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    Cargando cuentas por pagar a proveedores...
                  </td>
                </tr>
              ) : cuentas.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No se encontraron cuentas por pagar con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                cuentas.map((c) => (
                  <tr key={c.IdCuentaPagar} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 text-xs">{c.NombreProveedor}</div>
                      <div className="text-[11px] text-slate-400">{c.Ciudad || "Bolivia"}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-xs text-[#20A7DB]">
                      {c.NumeroFactura}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 max-w-xs truncate" title={c.Concepto}>
                      {c.Concepto}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {c.FechaEmision ? new Date(c.FechaEmision).toLocaleDateString("es-BO") : "-"}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {c.FechaVencimiento ? (
                        <span className={c.EsVencida && Number(c.SaldoPendiente || 0) > 0 ? "text-rose-600 font-bold" : "text-slate-600"}>
                          {new Date(c.FechaVencimiento).toLocaleDateString("es-BO")}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-600 text-xs">
                      Bs. {Number(c.MontoTotal != null ? c.MontoTotal : (c.PrecioFacturado || 0)).toFixed(2)}
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
                          onClick={() => verDetalle(c)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                          title="Ver detalle"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {Number(c.SaldoPendiente || 0) > 0 && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirModalPago(c)}
                              className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              title="Pagar"
                            >
                              Pagar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirModalDevolucion(c)}
                              className="h-7 px-1.5 text-xs text-amber-700 hover:bg-amber-50"
                              title="Compensar Devolución"
                            >
                              <CornerDownLeft className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* MODAL REGISTRAR FACTURA PROVEEDOR */}
      {modalFacturaOpen && (
      <Dialog open={modalFacturaOpen} onOpenChange={setModalFacturaOpen}>
        <DialogContent className="w-full sm:max-w-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <PlusCircle className="h-5 w-5 text-[#20A7DB]" />
              Registrar Factura de Compra / Proveedor
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearFactura} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Proveedor de Materia Prima *
              </label>
              <select
                required
                value={formFactura.id_proveedor}
                onChange={(e) => setFormFactura({ ...formFactura, id_proveedor: e.target.value })}
                className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
              >
                <option value="">Seleccione Proveedor...</option>
                {proveedores.map((p) => (
                  <option key={p.IdProveedor} value={p.IdProveedor}>
                    {p.NombreEmpresa} ({p.Rubro || "Insumos"})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° Factura / Nota *
                </label>
                <Input
                  required
                  value={formFactura.numero_factura}
                  onChange={(e) => setFormFactura({ ...formFactura, numero_factura: e.target.value })}
                  placeholder="Ej: FAC-8492"
                  className="text-xs h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Importe Total (Bs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={formFactura.monto_total}
                  onChange={(e) => setFormFactura({ ...formFactura, monto_total: e.target.value })}
                  placeholder="0.00"
                  className="font-bold text-sm h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Fecha Emisión
                </label>
                <Input
                  type="date"
                  value={formFactura.fecha_emision}
                  onChange={(e) => setFormFactura({ ...formFactura, fecha_emision: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Fecha Vencimiento
                </label>
                <Input
                  type="date"
                  value={formFactura.fecha_vencimiento}
                  onChange={(e) => setFormFactura({ ...formFactura, fecha_vencimiento: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Días Crédito
                </label>
                <Input
                  type="number"
                  value={formFactura.dias_credito}
                  onChange={(e) => setFormFactura({ ...formFactura, dias_credito: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Concepto / Insumo Principal
              </label>
              <Input
                value={formFactura.concepto}
                onChange={(e) => setFormFactura({ ...formFactura, concepto: e.target.value })}
                placeholder="Ej: Compra Bobina Papel Kraft 40gr"
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalFacturaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoFactura} className="bg-[#20A7DB] hover:bg-[#1992c0] text-white">
                {guardandoFactura ? "Guardando..." : "Registrar Cuenta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL REGISTRAR PAGO A PROVEEDOR */}
      {modalPagoOpen && (
      <Dialog open={modalPagoOpen} onOpenChange={setModalPagoOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Registrar Pago a Proveedor
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegistrarPago} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Factura / Cuenta a Cancelar *
              </label>
              <select
                required
                value={formPago.id_cuenta_pagar}
                onChange={(e) => {
                  const id = e.target.value;
                  const c = cuentas.find((x) => x.IdCuentaPagar.toString() === id);
                  setFormPago({
                    ...formPago,
                    id_cuenta_pagar: id,
                    monto_pago: c ? c.SaldoPendiente.toString() : formPago.monto_pago,
                  });
                }}
                className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
              >
                <option value="">Seleccione Factura...</option>
                {cuentas
                  .filter((c) => Number(c.SaldoPendiente || 0) > 0)
                  .map((c) => (
                    <option key={c.IdCuentaPagar} value={c.IdCuentaPagar}>
                      {c.NombreProveedor} ({c.NumeroFactura}) - Saldo: Bs. {Number(c.SaldoPendiente || 0).toFixed(2)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monto a Pagar (Bs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={formPago.monto_pago}
                  onChange={(e) => setFormPago({ ...formPago, monto_pago: e.target.value })}
                  placeholder="0.00"
                  className="font-bold text-base h-9 text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Banco Emisor *
                </label>
                <select
                  required
                  value={formPago.id_cuenta_bancaria}
                  onChange={(e) => setFormPago({ ...formPago, id_cuenta_bancaria: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
                >
                  <option value="">Seleccione Cuenta...</option>
                  {bancos.map((b) => (
                    <option key={b.IdCuentaBancaria} value={b.IdCuentaBancaria}>
                      {b.NombreBanco} ({b.TipoMoneda})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° Cheque / Transferencia
                </label>
                <Input
                  value={formPago.numero_cheque_transferencia}
                  onChange={(e) => setFormPago({ ...formPago, numero_cheque_transferencia: e.target.value })}
                  placeholder="Ej: TRF-9120"
                  className="text-xs h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Medio de Pago
                </label>
                <select
                  value={formPago.metodo_pago}
                  onChange={(e) => setFormPago({ ...formPago, metodo_pago: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
                >
                  <option value="Transferencia Bancaria">Transferencia</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Efectivo">Efectivo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Observaciones del Pago
              </label>
              <Textarea
                rows={2}
                value={formPago.observaciones}
                onChange={(e) => setFormPago({ ...formPago, observaciones: e.target.value })}
                placeholder="Cancelación según orden de compra, cheque Banco Unión..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalPagoOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoPago} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {guardandoPago ? "Registrando..." : "Confirmar Pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}

      {/* MODAL REGISTRAR DEVOLUCIÓN / COMPENSACIÓN */}
      {modalDevolucionOpen && (
      <Dialog open={modalDevolucionOpen} onOpenChange={setModalDevolucionOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <CornerDownLeft className="h-5 w-5 text-amber-600" />
              Devolución de Material / Compensación
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegistrarDevolucion} className="space-y-3.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div><strong>Proveedor:</strong> {cuentaSeleccionada?.NombreProveedor}</div>
              <div><strong>Factura:</strong> {cuentaSeleccionada?.NumeroFactura}</div>
              <div><strong>Saldo Pendiente:</strong> Bs. {Number(cuentaSeleccionada?.SaldoPendiente || 0).toFixed(2)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monto a Descontar (Bs.) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.10"
                  required
                  value={formDev.monto_compensado}
                  onChange={(e) => setFormDev({ ...formDev, monto_compensado: e.target.value })}
                  placeholder="0.00"
                  className="font-bold text-sm h-9"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° Nota de Crédito
                </label>
                <Input
                  value={formDev.numero_nota_credito}
                  onChange={(e) => setFormDev({ ...formDev, numero_nota_credito: e.target.value })}
                  placeholder="Ej: NC-0045"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Motivo de Devolución *
              </label>
              <Textarea
                rows={2}
                required
                value={formDev.motivo}
                onChange={(e) => setFormDev({ ...formDev, motivo: e.target.value })}
                placeholder="Bobina de papel húmeda en transporte, polietileno defectuoso..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalDevolucionOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoDev} className="bg-amber-600 hover:bg-amber-700 text-white">
                {guardandoDev ? "Procesando..." : "Aplicar Compensación"}
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
        titulo="Importar Cuentas por Pagar (Proveedores)"
        descripcion="Sube tu archivo Excel o procesa el archivo oficial del servidor para registrar compras a proveedores, pesos y pagos."
        archivoPredeterminadoNombre="CUENTAS PROVEEDOR 2025-2026.xlsx"
        onImportar={ImportarProveedores}
        onCompletado={async () => {
          await cargarDatos();
        }}
      />

      {/* MODAL DETALLE DE LA CUENTA */}
      {modalDetalleOpen && (
      <Dialog open={modalDetalleOpen} onOpenChange={setModalDetalleOpen}>
        <DialogContent className="w-full sm:max-w-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Eye className="h-5 w-5 text-[#20A7DB]" />
              Detalle Factura: {detalleCuenta?.NumeroFactura || cuentaSeleccionada?.NumeroFactura}
            </DialogTitle>
          </DialogHeader>

          {detalleCuenta && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs">
                <div><strong>Proveedor:</strong> {detalleCuenta.Proveedor?.NombreEmpresa}</div>
                <div><strong>NIT:</strong> {detalleCuenta.Proveedor?.NIT || "-"}</div>
                <div><strong>Concepto:</strong> {detalleCuenta.Concepto}</div>
                <div><strong>Monto Total:</strong> Bs. {Number(detalleCuenta.MontoTotal || detalleCuenta.PrecioFacturado || 0).toFixed(2)}</div>
                <div><strong>Saldo Pendiente:</strong> Bs. {Number(detalleCuenta.SaldoPendiente || 0).toFixed(2)}</div>
                <div><strong>Estado:</strong> {detalleCuenta.Estado}</div>
              </div>

              {/* Pagos Realizados */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Historial de Pagos Realizados
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">N° Operación</th>
                        <th className="py-2.5 px-3">Medio</th>
                        <th className="py-2.5 px-3 text-right">Monto Pagado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detalleCuenta.Pagos && detalleCuenta.Pagos.length > 0 ? (
                        detalleCuenta.Pagos.map((p) => (
                          <tr key={p.IdPago}>
                            <td className="py-2.5 px-3">{new Date(p.FechaPago).toLocaleDateString("es-BO")}</td>
                            <td className="py-2.5 px-3 ">{p.NumeroChequeTransferencia || "-"}</td>
                            <td className="py-2.5 px-3">{p.MetodoPago}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              Bs. {Number(p.MontoPago || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="py-4 text-center text-slate-400">
                            No se registran pagos realizados aún.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
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
