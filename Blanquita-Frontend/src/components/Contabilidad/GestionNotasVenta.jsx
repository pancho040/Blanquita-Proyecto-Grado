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
  Printer,
  FileText,
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
import PaginacionTabla from "@/components/common/PaginacionTabla";
import ModalImportarExcel from "./ModalImportarExcel";
import { ImportarNotasVenta } from "@/services/Contabilidad/importacionService";
import { FileSpreadsheet } from "lucide-react";
import { cache, invalidateContabilidad } from "@/lib/cacheService";

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
  const [modalImportarOpen, setModalImportarOpen] = useState(false);
  const [notaSeleccionada, setNotaSeleccionada] = useState(null);
  const [detalleNota, setDetalleNota] = useState(null);

  // Formulario Nueva Nota
  const [formNota, setFormNota] = useState({
    numero_nota: "",
    numero_entrega: "",
    destino: "Sucre",
    id_cliente: "",
    numero_camion: "1",
    chofer: "",
    placa: "",
    flete_chofer: "0",
    condicion_venta: "Crédito",
    dias_credito: "15",
    observaciones: "",
    // Presentaciones según Excel 5_CONTROL NOTAS DE VENTA
    paquetes_mega_12r: "0",
    precio_mega_12r: "120.00",
    paquetes_economico: "0",
    precio_economico: "70.00",
    paquetes_mega_30m: "0",
    precio_mega_30m: "135.00",
    paquetes_lux_6r: "0",
    precio_lux_6r: "55.00",
    paquetes_lux_12r: "0",
    precio_lux_12r: "95.00",
    paquetes_lux_24r: "0",
    precio_lux_24r: "180.00",
    paquetes_serv_500x6: "0",
    precio_serv_500x6: "45.00",
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

      let clientesData = cache.get("contabilidad:clientesCxC");
      const peticiones = [
        ObtenerNotasVenta({
          page: pagina,
          limit: limite,
          estadoPago: filtroEstadoPago !== "TODOS" ? filtroEstadoPago : null,
          busqueda: busqueda.trim(),
        }),
      ];

      if (!clientesData) {
        peticiones.push(ObtenerClientesCxC().catch(() => []));
      }

      const resultados = await Promise.all(peticiones);
      const notasRes = resultados[0];

      if (!clientesData) {
        const cRes = resultados[1];
        clientesData = Array.isArray(cRes) ? cRes : cRes?.items || [];
        cache.set("contabilidad:clientesCxC", clientesData, 300);
      }

      const items = Array.isArray(notasRes) ? notasRes : (notasRes?.items || []);
      setNotas(items);
      setTotalRegistros(notasRes?.total != null ? notasRes.total : items.length);
      setTotalPaginas(notasRes?.total_paginas || 1);

      setClientes(clientesData);
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

    // Armar detalles según productos reales de Excel
    const itemsProductos = [
      { nombre: "MEGA 12R", paquetes: parseInt(formNota.paquetes_mega_12r, 10) || 0, precio: parseFloat(formNota.precio_mega_12r) || 0 },
      { nombre: "Económico", paquetes: parseInt(formNota.paquetes_economico, 10) || 0, precio: parseFloat(formNota.precio_economico) || 0 },
      { nombre: "MEGA 12R 30m", paquetes: parseInt(formNota.paquetes_mega_30m, 10) || 0, precio: parseFloat(formNota.precio_mega_30m) || 0 },
      { nombre: "LUX 6R", paquetes: parseInt(formNota.paquetes_lux_6r, 10) || 0, precio: parseFloat(formNota.precio_lux_6r) || 0 },
      { nombre: "LUX 12R", paquetes: parseInt(formNota.paquetes_lux_12r, 10) || 0, precio: parseFloat(formNota.precio_lux_12r) || 0 },
      { nombre: "LUX 24R", paquetes: parseInt(formNota.paquetes_lux_24r, 10) || 0, precio: parseFloat(formNota.precio_lux_24r) || 0 },
      { nombre: "SERV 500X6", paquetes: parseInt(formNota.paquetes_serv_500x6, 10) || 0, precio: parseFloat(formNota.precio_serv_500x6) || 0 },
    ];

    const detalles = itemsProductos
      .filter((p) => p.paquetes > 0)
      .map((p) => ({
        presentacion: p.nombre,
        paquetes_entregados: p.paquetes,
        precio_unitario: p.precio,
        subtotal: p.paquetes * p.precio,
      }));

    if (detalles.length === 0) {
      toast.error("Debe ingresar al menos una presentación con paquetes despachados");
      return;
    }

    const subtotal = detalles.reduce((acc, d) => acc + d.subtotal, 0);

    const obsArray = [];
    if (formNota.numero_entrega.trim()) obsArray.push(`N° Entrega: ${formNota.numero_entrega.trim()}`);
    if (formNota.destino.trim()) obsArray.push(`Destino: ${formNota.destino.trim()}`);
    if (formNota.observaciones.trim()) obsArray.push(formNota.observaciones.trim());
    const obsCompleta = obsArray.join(" | ");

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
        observaciones: obsCompleta || null,
        detalles,
      });

      toast.success("¡Nota de venta y despacho registrado exitosamente!");
      invalidateContabilidad();
      setModalNuevaOpen(false);
      setFormNota({
        numero_nota: "",
        numero_entrega: "",
        destino: "Sucre",
        id_cliente: "",
        numero_camion: "1",
        chofer: "",
        placa: "",
        flete_chofer: "0",
        condicion_venta: "Crédito",
        dias_credito: "15",
        observaciones: "",
        paquetes_mega_12r: "0",
        precio_mega_12r: "120.00",
        paquetes_economico: "0",
        precio_economico: "70.00",
        paquetes_mega_30m: "0",
        precio_mega_30m: "135.00",
        paquetes_lux_6r: "0",
        precio_lux_6r: "55.00",
        paquetes_lux_12r: "0",
        precio_lux_12r: "95.00",
        paquetes_lux_24r: "0",
        precio_lux_24r: "180.00",
        paquetes_serv_500x6: "0",
        precio_serv_500x6: "45.00",
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
            Notas de Venta
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Control de despachos, notas de venta y entregas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setModalImportarOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs font-semibold text-xs h-10"
            title="Importar control de notas de venta y despachos en camión desde Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Importar Excel</span>
          </Button>
          <Button
            onClick={() => setModalNuevaOpen(true)}
            className="bg-[#20A7DB] hover:bg-[#1992c0] text-white flex items-center gap-2 shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            Nueva Nota
          </Button>
        </div>
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
                    <td className="py-3 px-4 font-bold text-xs text-[#20A7DB]">
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

        {/* Paginación Estandarizada */}
        <PaginacionTabla
          paginaActual={pagina}
          totalPaginas={totalPaginas}
          totalItems={totalRegistros}
          pageSize={limite}
          indiceInicio={notas.length > 0 ? (pagina - 1) * limite + 1 : 0}
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

      {/* MODAL REGISTRAR NOTA */}
      {modalNuevaOpen && (
      <Dialog open={modalNuevaOpen} onOpenChange={setModalNuevaOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Truck className="h-5 w-5 text-[#20A7DB]" />
              Registrar Nota de Venta
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearNota} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° Nota de Venta *
                </label>
                <Input
                  required
                  value={formNota.numero_nota}
                  onChange={(e) => setFormNota({ ...formNota, numero_nota: e.target.value })}
                  placeholder="Ej: NV-501"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  N° Nota de Entrega
                </label>
                <Input
                  value={formNota.numero_entrega}
                  onChange={(e) => setFormNota({ ...formNota, numero_entrega: e.target.value })}
                  placeholder="Ej: NE-308"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cliente *
                </label>
                <select
                  required
                  value={formNota.id_cliente}
                  onChange={(e) => {
                    const id = e.target.value;
                    const cli = clientes.find((c) => c.IdCliente.toString() === id);
                    setFormNota({
                      ...formNota,
                      id_cliente: id,
                      destino: cli?.Ciudad || formNota.destino,
                    });
                  }}
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

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Destino / Ciudad
                </label>
                <select
                  value={formNota.destino}
                  onChange={(e) => setFormNota({ ...formNota, destino: e.target.value })}
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
            </div>

            {/* Datos del Camión y Transporte */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Transporte y Despacho
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
                  <label className="text-[10px] text-slate-500 block">Chofer</label>
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
                    className="text-xs h-8"
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

            {/* Desglose de Paquetes según Excel 5_CONTROL NOTAS DE VENTA */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-3">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                Paquetes Despachados
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block">MEGA 12R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_mega_12r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_mega_12r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">Económico</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_economico}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_economico: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">MEGA 12R 30m</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_mega_30m}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_mega_30m: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">LUX 6R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_lux_6r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_lux_6r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">LUX 12R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_lux_12r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_lux_12r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">LUX 24R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_lux_24r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_lux_24r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">SERV 500X6</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_serv_500x6}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_serv_500x6: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">Bonificación (Sin cargo)</label>
                  <Input
                    type="number"
                    value={formNota.bonificacion_paquetes}
                    onChange={(e) => setFormNota({ ...formNota, bonificacion_paquetes: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 mt-1"
                  />
                </div>
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
      )}

      {/* MODAL IMPORTAR EXCEL */}
      <ModalImportarExcel
        abierto={modalImportarOpen}
        onCerrar={() => setModalImportarOpen(false)}
        titulo="Importar Notas de Venta (Camiones y Despachos)"
        descripcion="Sube tu archivo Excel o procesa el control oficial del servidor para registrar despachos en camión, fletes y paquetes entregados."
        archivoPredeterminadoNombre="5_CONTROL NOTAS DE VENTA AGOSTO_2026.XLSX"
        onImportar={ImportarNotasVenta}
        onCompletado={async () => {
          await cargarDatos();
        }}
      />

      {/* MODAL DETALLE DE LA NOTA */}
      {modalDetalleOpen && (
      <Dialog open={modalDetalleOpen} onOpenChange={setModalDetalleOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8">
          <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg font-bold">
              <FileText className="h-5 w-5 text-[#20A7DB]" />
              <span>Nota Oficial de Venta & Despacho: {detalleNota?.NumeroNota || notaSeleccionada?.NumeroNota}</span>
            </DialogTitle>
            <Button
              type="button"
              onClick={() => window.print()}
              className="bg-[#20A7DB] hover:bg-[#188cba] text-white gap-1.5 h-8 text-xs font-semibold px-3 shadow-2xs"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir Nota / Recibo</span>
            </Button>
          </DialogHeader>

          {detalleNota && (
            <div className="space-y-5 print:p-0">
              {/* MEMBRETE CORPORATIVO FORMAL */}
              <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                    Empresa de Papel Blanquita (Shema Asociados S.R.L.)
                  </h1>
                  <p className="text-xs font-semibold text-slate-600 uppercase">
                    División Comercial, Despacho y Facturación • Sucre, Bolivia
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Calle Regimiento Charcas N° 37 • Tel: (4) 64-51234 • NIT: 1024589028
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    NOTA DE VENTA N°
                  </span>
                  <span className="text-lg font-black text-[#20A7DB]">
                    {detalleNota.NumeroNota || "NV-000"}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                    Fecha: {detalleNota.FechaVenta ? new Date(detalleNota.FechaVenta).toLocaleDateString("es-BO") : new Date().toLocaleDateString("es-BO")}
                  </span>
                </div>
              </div>

              {/* DATOS DE LA OPERACIÓN Y CLIENTE */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <strong className="text-slate-500 block font-medium">Cliente / Razón Social:</strong>
                  <span className="font-bold text-slate-900 mt-0.5 block">{detalleNota.Cliente?.RazonSocial}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium">Destino / Ciudad:</strong>
                  <span className="font-bold text-slate-900 mt-0.5 block">{detalleNota.Cliente?.Ciudad || "Sucre"}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium">Transportista / Chofer:</strong>
                  <span className="font-bold text-slate-900 mt-0.5 block">{detalleNota.Chofer || "No asignado"}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium">Placa Camión:</strong>
                  <span className="font-bold text-slate-900 mt-0.5 block">{detalleNota.Placa || "-"}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium">Condición de Venta:</strong>
                  <span className="font-bold text-slate-900 mt-0.5 block">{detalleNota.CondicionVenta}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium">Flete de Chofer:</strong>
                  <span className="font-bold text-slate-900 mt-0.5 block">Bs. {Number(detalleNota.FleteChofer || 0).toFixed(2)}</span>
                </div>
                <div className="sm:col-span-2">
                  <strong className="text-slate-500 block font-medium">Observaciones:</strong>
                  <span className="text-slate-700 mt-0.5 block">{detalleNota.Observacion || "Despacho regular conforme a pedido."}</span>
                </div>
              </div>

              {/* TABLA DE ÍTEMS */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
                  Ítems y Productos Despachados
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Presentación / Producto</th>
                        <th className="py-2.5 px-3 text-center">Cantidad Paquetes</th>
                        <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detalleNota.Detalles?.map((d) => (
                        <tr key={d.IdDetalleNota} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{d.Presentacion}</td>
                          <td className="py-2.5 px-3 text-center font-bold">{d.PaquetesEntregados}</td>
                          <td className="py-2.5 px-3 text-right ">Bs. {Number(d.PrecioUnitario || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            Bs. {Number(d.Subtotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TOTALES */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm gap-3">
                <span className="font-bold text-slate-700">Total Importe Neto de la Operación:</span>
                <span className="font-black text-lg text-[#20A7DB]">
                  Bs. {Number(detalleNota.TotalNeto || 0).toFixed(2)}
                </span>
              </div>

              {/* SECCIÓN FORMAL DE FIRMAS IMPRIMIBLE */}
              <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">Entregado Conforme</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Firma Transportista / Despacho</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">Recibido Conforme</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Firma y Sello del Cliente</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-100 pt-3">
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
