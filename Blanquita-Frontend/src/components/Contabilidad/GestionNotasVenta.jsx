import React, { useState, useEffect } from "react";
import {
  Truck,
  PlusCircle,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  Package,
  Layers,
  DollarSign,
  MapPin,
  Tag,
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
  ObtenerNotasVenta,
  ObtenerNotaVentaDetalle,
  CrearNotaVenta,
  ObtenerClientesCxC,
} from "@/services/Contabilidad/cuentasCobrarService";

export default function GestionNotasVenta({ usuario }) {
  const [notas, setNotas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros y paginación
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstadoPago, setFiltroEstadoPago] = useState("TODOS");
  const [pagina, setPagina] = useState(1);
  const [limite, setLimite] = useState(15);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  // Modales
  const [modalNuevaOpen, setModalNuevaOpen] = useState(false);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [notaSeleccionada, setNotaSeleccionada] = useState(null);
  const [detalleNota, setDetalleNota] = useState(null);

  // Formulario Nueva Nota
  const [formNota, setFormNota] = useState({
    numero_nota: "",
    id_cliente: "",
    numero_camion: "1",
    chofer: "",
    placa: "",
    flete_chofer: "0",
    condicion_venta: "Crédito",
    dias_credito: "15",
    observaciones: "",
    // Paquetes
    paquetes_mega: "0",
    precio_mega: "120.00",
    paquetes_lux: "0",
    precio_lux: "95.00",
    paquetes_servilleta: "0",
    precio_servilleta: "45.00",
    bonificacion_paquetes: "0",
  });
  const [guardandoNota, setGuardandoNota] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [pagina, filtroEstadoPago]);

  // Debounce búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      cargarDatos();
    }, 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [notasRes, clientesRes] = await Promise.all([
        ObtenerNotasVenta({
          page: pagina,
          limit: limite,
          estadoPago: filtroEstadoPago !== "TODOS" ? filtroEstadoPago : null,
          busqueda: busqueda.trim(),
        }),
        ObtenerClientesCxC().catch(() => []),
      ]);

      const items = Array.isArray(notasRes) ? notasRes : (notasRes?.items || []);
      setNotas(items);
      setTotalRegistros(notasRes?.total != null ? notasRes.total : items.length);
      setTotalPaginas(notasRes?.total_paginas || 1);

      setClientes(Array.isArray(clientesRes) ? clientesRes : clientesRes?.items || []);
    } catch (err) {
      toast.error("Error al cargar notas de venta: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const verDetalle = async (nota) => {
    setNotaSeleccionada(nota);
    try {
      const data = await ObtenerNotaVentaDetalle(nota.IdNotaVenta);
      setDetalleNota(data);
      setModalDetalleOpen(true);
    } catch (err) {
      toast.error("Error al cargar detalle: " + err.message);
    }
  };

  const handleCrearNota = async (e) => {
    e.preventDefault();
    const idCli = parseInt(formNota.id_cliente, 10);
    if (isNaN(idCli)) {
      toast.error("Seleccione un cliente");
      return;
    }
    if (!formNota.numero_nota.trim()) {
      toast.error("Ingrese el número correlativo de nota de venta");
      return;
    }

    // Armar detalles
    const detalles = [];
    const pMega = parseInt(formNota.paquetes_mega, 10) || 0;
    const pLux = parseInt(formNota.paquetes_lux, 10) || 0;
    const pServ = parseInt(formNota.paquetes_servilleta, 10) || 0;

    if (pMega > 0) {
      detalles.push({
        presentacion: "Mega Rollo Papel",
        paquetes_entregados: pMega,
        precio_unitario: parseFloat(formNota.precio_mega) || 0,
        subtotal: pMega * (parseFloat(formNota.precio_mega) || 0),
      });
    }
    if (pLux > 0) {
      detalles.push({
        presentacion: "Lux Clásico Papel",
        paquetes_entregados: pLux,
        precio_unitario: parseFloat(formNota.precio_lux) || 0,
        subtotal: pLux * (parseFloat(formNota.precio_lux) || 0),
      });
    }
    if (pServ > 0) {
      detalles.push({
        presentacion: "Servilleta Mesa",
        paquetes_entregados: pServ,
        precio_unitario: parseFloat(formNota.precio_servilleta) || 0,
        subtotal: pServ * (parseFloat(formNota.precio_servilleta) || 0),
      });
    }

    if (detalles.length === 0) {
      toast.error("Debe ingresar al menos una presentación con paquetes despachados");
      return;
    }

    const subtotal = detalles.reduce((acc, d) => acc + d.subtotal, 0);

    try {
      setGuardandoNota(true);
      await CrearNotaVenta({
        id_cliente: idCli,
        numero_nota: formNota.numero_nota.trim(),
        numero_camion: formNota.numero_camion.trim() || null,
        chofer: formNota.chofer.trim() || null,
        placa: formNota.placa.trim() || null,
        flete_chofer: parseFloat(formNota.flete_chofer) || 0,
        bonificacion_paquetes: parseInt(formNota.bonificacion_paquetes, 10) || 0,
        condicion_venta: formNota.condicion_venta,
        dias_credito: parseInt(formNota.dias_credito, 10) || 15,
        subtotal,
        total_neto: subtotal,
        observaciones: formNota.observaciones.trim() || null,
        detalles,
      });

      toast.success("¡Nota de venta y despacho registrado exitosamente!");
      setModalNuevaOpen(false);
      setFormNota({
        numero_nota: "",
        id_cliente: "",
        numero_camion: "1",
        chofer: "",
        placa: "",
        flete_chofer: "0",
        condicion_venta: "Crédito",
        dias_credito: "15",
        observaciones: "",
        paquetes_mega: "0",
        precio_mega: "120.00",
        paquetes_lux: "0",
        precio_lux: "95.00",
        paquetes_servilleta: "0",
        precio_servilleta: "45.00",
        bonificacion_paquetes: "0",
      });
      await cargarDatos();
    } catch (err) {
      toast.error(err.message || "Error al crear nota de venta");
    } finally {
      setGuardandoNota(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <Truck className="h-7 w-7 text-[#20A7DB]" />
            Control de Notas de Venta y Despachos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Despachos en camión, fletes, desglose de paquetes (Mega, Lux, Servilleta) y bonificaciones de venta.
          </p>
        </div>

        <Button
          onClick={() => setModalNuevaOpen(true)}
          className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-2 shadow-xs"
        >
          <PlusCircle className="h-4 w-4" />
          Registrar Despacho / Nota
        </Button>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Total Despachos</span>
          <div className="text-2xl font-bold text-slate-800 mt-1">{totalRegistros}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Ventas al Contado</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {notas.filter((n) => n.CondicionVenta === "Contado").length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Ventas a Crédito</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {notas.filter((n) => n.CondicionVenta === "Crédito").length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase">Pendientes de Cobro</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {notas.filter((n) => n.EstadoPago === "Pendiente" || n.EstadoPago === "Parcial").length}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por N° nota, cliente, chofer o placa..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-9 h-9 bg-white text-sm"
            />
          </div>

          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
            {["TODOS", "Pagado", "Parcial", "Pendiente"].map((est) => (
              <button
                key={est}
                onClick={() => {
                  setFiltroEstadoPago(est);
                  setPagina(1);
                }}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filtroEstadoPago === est ? "bg-[#20A7DB] text-white" : "hover:text-slate-900"
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
                <th className="py-3 px-4">N° Nota</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Cliente / Destino</th>
                <th className="py-3 px-4">Camión / Chofer</th>
                <th className="py-3 px-4 text-center">Condición</th>
                <th className="py-3 px-4 text-right">Flete Chofer</th>
                <th className="py-3 px-4 text-right">Total Neto</th>
                <th className="py-3 px-4 text-center">Estado Pago</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    Cargando notas de venta y despachos...
                  </td>
                </tr>
              ) : notas.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No se encontraron notas de venta con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                notas.map((n) => (
                  <tr key={n.IdNotaVenta} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-xs text-[#20A7DB]">
                      {n.NumeroNota}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {n.FechaEmision ? new Date(n.FechaEmision).toLocaleDateString("es-BO") : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 text-xs">
                        {n.RazonSocial || n.NombreComercial}
                      </div>
                      <div className="text-[11px] text-slate-400">{n.Ciudad || "Sucre"}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {n.Chofer ? (
                        <>
                          <div className="font-medium text-slate-700">{n.Chofer}</div>
                          <div className="text-[11px] text-slate-400">
                            Camión #{n.NumeroCamion || "1"} {n.Placa ? `(${n.Placa})` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">Entrega Local</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={
                          n.CondicionVenta === "Contado"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {n.CondicionVenta}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-slate-600">
                      {Number(n.FleteChofer || 0) > 0 ? `Bs. ${Number(n.FleteChofer).toFixed(2)}` : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                      Bs. {Number(n.TotalNeto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={
                          n.EstadoPago === "Pagado"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : n.EstadoPago === "Parcial"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }
                      >
                        {n.EstadoPago}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => verDetalle(n)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                        title="Ver detalle del despacho"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Mostrando {notas.length > 0 ? (pagina - 1) * limite + 1 : 0} a{" "}
            {Math.min(pagina * limite, totalRegistros)} de {totalRegistros} notas
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Por página:</span>
            <select
              value={limite}
              onChange={(e) => {
                setLimite(Number(e.target.value));
                setPagina(1);
              }}
              className="text-xs h-8 border border-slate-200 rounded-md bg-white px-2 text-slate-700"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>

            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1 || cargando}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="h-8 px-2 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Anterior
              </Button>
              <span className="px-2 font-medium text-slate-700">
                Pág. {pagina} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= totalPaginas || cargando}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                className="h-8 px-2 text-xs"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL REGISTRAR NOTA */}
      <Dialog open={modalNuevaOpen} onOpenChange={setModalNuevaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Truck className="h-5 w-5 text-[#20A7DB]" />
              Registrar Nota de Venta y Despacho en Camión
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearNota} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° Nota de Venta *
                </label>
                <Input
                  required
                  value={formNota.numero_nota}
                  onChange={(e) => setFormNota({ ...formNota, numero_nota: e.target.value })}
                  placeholder="Ej: NV-501"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cliente / Distribuidor *
                </label>
                <select
                  required
                  value={formNota.id_cliente}
                  onChange={(e) => setFormNota({ ...formNota, id_cliente: e.target.value })}
                  className="w-full text-xs h-9 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700"
                >
                  <option value="">Seleccione Cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.IdCliente} value={c.IdCliente}>
                      {c.RazonSocial || c.NombreComercial} ({c.Ciudad})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Datos del Camión y Transporte */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Datos del Camión y Transporte
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block">N° Camión</label>
                  <Input
                    value={formNota.numero_camion}
                    onChange={(e) => setFormNota({ ...formNota, numero_camion: e.target.value })}
                    placeholder="Camión 1"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">Nombre Chofer</label>
                  <Input
                    value={formNota.chofer}
                    onChange={(e) => setFormNota({ ...formNota, chofer: e.target.value })}
                    placeholder="Ej: Roberto Flores"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">Placa</label>
                  <Input
                    value={formNota.placa}
                    onChange={(e) => setFormNota({ ...formNota, placa: e.target.value })}
                    placeholder="Ej: 3021-XRT"
                    className="text-xs font-mono h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-slate-500 block">Flete Chofer (Bs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formNota.flete_chofer}
                    onChange={(e) => setFormNota({ ...formNota, flete_chofer: e.target.value })}
                    placeholder="0.00"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">Condición de Venta</label>
                  <select
                    value={formNota.condicion_venta}
                    onChange={(e) => setFormNota({ ...formNota, condicion_venta: e.target.value })}
                    className="w-full text-xs h-8 rounded-md border border-slate-300 bg-white px-2 font-medium"
                  >
                    <option value="Crédito">Crédito</option>
                    <option value="Contado">Contado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">Días de Crédito</label>
                  <Input
                    type="number"
                    value={formNota.dias_credito}
                    onChange={(e) => setFormNota({ ...formNota, dias_credito: e.target.value })}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            {/* Desglose de Paquetes de Papel */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-3">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                Desglose de Paquetes Despachados
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block">Paquetes Mega Rollo</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_mega}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_mega: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">Paquetes Lux Clásico</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_lux}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_lux: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">Paquetes Servilleta</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_servilleta}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_servilleta: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block">
                  Bonificaciones / Paquetes Promoción sin Cargo
                </label>
                <Input
                  type="number"
                  value={formNota.bonificacion_paquetes}
                  onChange={(e) => setFormNota({ ...formNota, bonificacion_paquetes: e.target.value })}
                  placeholder="0"
                  className="text-xs h-8 mt-1 w-44"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Observaciones del Despacho
              </label>
              <Textarea
                rows={2}
                value={formNota.observaciones}
                onChange={(e) => setFormNota({ ...formNota, observaciones: e.target.value })}
                placeholder="Ruta Sucre-Santa Cruz, entrega directa en almacén..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalNuevaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoNota} className="bg-[#20A7DB] hover:bg-[#1992c0] text-white">
                {guardandoNota ? "Guardando..." : "Confirmar Despacho"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLE DE LA NOTA */}
      <Dialog open={modalDetalleOpen} onOpenChange={setModalDetalleOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Eye className="h-5 w-5 text-[#20A7DB]" />
              Detalle del Despacho: {detalleNota?.NumeroNota || notaSeleccionada?.NumeroNota}
            </DialogTitle>
          </DialogHeader>

          {detalleNota && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs">
                <div><strong>Cliente:</strong> {detalleNota.Cliente?.RazonSocial}</div>
                <div><strong>Ciudad:</strong> {detalleNota.Cliente?.Ciudad}</div>
                <div><strong>Chofer:</strong> {detalleNota.Chofer || "No asignado"}</div>
                <div><strong>Placa:</strong> {detalleNota.Placa || "-"}</div>
                <div><strong>Condición:</strong> {detalleNota.CondicionVenta}</div>
                <div><strong>Flete Chofer:</strong> Bs. {Number(detalleNota.FleteChofer || 0).toFixed(2)}</div>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Ítems Despachados
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Presentación</th>
                        <th className="py-2.5 px-3 text-center">Paquetes</th>
                        <th className="py-2.5 px-3 text-right">P. Unitario</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detalleNota.Detalles?.map((d) => (
                        <tr key={d.IdDetalleNota}>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{d.Presentacion}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{d.PaquetesEntregados}</td>
                          <td className="py-2.5 px-3 text-right">Bs. {Number(d.PrecioUnitario || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            Bs. {Number(d.Subtotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                <span className="font-bold text-slate-700">Total Importe Neto:</span>
                <span className="font-extrabold text-base text-[#20A7DB]">
                  Bs. {Number(detalleNota.TotalNeto || 0).toFixed(2)}
                </span>
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
    </div>
  );
}
