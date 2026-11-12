import React, { useState, useEffect, useCallback, useMemo } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
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
  AlertCircle
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
import { SkeletonRow } from "@/components/common/LoadingStates";
import ModalImportarExcel from "./ModalImportarExcel";
import StatusBadge from "@/components/common/StatusBadge";
import { ImportarNotasVenta } from "@/services/Contabilidad/importacionService";
import { FileSpreadsheet } from "lucide-react";
import { cache, invalidateContabilidad } from "@/lib/cacheService";

export default function GestionNotasVenta({ usuario }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

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
    id_sucursal: sucursal !== "todas" && sucursal ? Number(sucursal) : 1,
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

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const sid = sucursal === "todas" ? null : sucursal;
      const cacheKeyClientes = `contabilidad:clientesCxC:${sid || "todas"}`;

      let clientesData = cache.get(cacheKeyClientes);
      const peticiones = [
        ObtenerNotasVenta({
          page: pagina,
          limit: limite,
          estadoPago: filtroEstadoPago !== "TODOS" ? filtroEstadoPago : null,
          busqueda: busqueda.trim(),
          idSucursal: sid,
        }),
      ];

      if (!clientesData) {
        peticiones.push(ObtenerClientesCxC(sid).catch(() => []));
      }

      const resultados = await Promise.all(peticiones);
      const notasRes = resultados[0];

      if (!clientesData) {
        const cRes = resultados[1];
        clientesData = Array.isArray(cRes) ? cRes : cRes?.items || [];
        cache.set(cacheKeyClientes, clientesData, 300);
      }

      const items = Array.isArray(notasRes) ? notasRes : (notasRes?.items || []);
      setNotas(items);
      const total = notasRes?.total != null ? notasRes.total : items.length;
      setTotalRegistros(total);
      setTotalPaginas(notasRes?.total_paginas || Math.max(1, Math.ceil(total / limite)));

      setClientes(clientesData);
    } catch (err) {
      toast.error("Error al cargar notas de venta: " + err.message);
    } finally {
      setCargando(false);
    }
  }, [pagina, limite, filtroEstadoPago, busqueda, sucursal]);

  // Sincronización eficiente con debounce de 250 ms para búsqueda
  useEffect(() => {
    if (cargandoAlcance) return;
    const timer = setTimeout(() => {
      cargarDatos();
    }, 250);
    return () => clearTimeout(timer);
  }, [cargarDatos, cargandoAlcance]);

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

    const sidEmision = Number(formNota.id_sucursal) || (sucursal !== "todas" ? Number(sucursal) : null);
    if (!sidEmision) {
      toast.error("Seleccione una sucursal específica para emitir notas de venta");
      return;
    }

    try {
      setGuardandoNota(true);
      await CrearNotaVenta({
        id_cliente: idCli,
        id_sucursal: sidEmision,
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
        id_sucursal: sucursal !== "todas" && sucursal ? Number(sucursal) : 1,
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

  const esModoTodas = sucursal === "todas";

  return (
    <div className="space-y-4">
      {/* Encabezado Operativo */}
      <PageHeader
        title="Notas de Venta y Despachos"
        subtitle="Control de despachos en camión, fletes de chofer, notas de venta y entregas comerciales."
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
          title="Importar control de notas de venta y despachos en camión desde Excel"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-[#15803D]" />
          <span>Importar Excel</span>
        </Button>
        <Button
          disabled={esModoTodas}
          onClick={() => {
            if (esModoTodas) {
              toast.info("Seleccione una sucursal para emitir notas de venta");
              return;
            }
            setModalNuevaOpen(true);
          }}
          className={`h-8 rounded flex items-center gap-1.5 text-xs font-medium shadow-none transition-colors ${
            esModoTodas
              ? "bg-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-200"
              : "bg-[#1C96C5] hover:bg-[#157A9E] text-white"
          }`}
          title={esModoTodas ? "Seleccione una sucursal para emitir notas de venta" : "Registrar nueva nota de venta"}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Nueva Nota</span>
        </Button>
      </PageHeader>

      {/* Alerta preventiva en modo Todas */}
      {esModoTodas && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 text-xs px-3.5 py-2.5 rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            Visualizando notas de venta consolidadas de todas las sedes. Para emitir una nueva nota, seleccione previamente una sede específica (Sucre o Potosí).
          </span>
        </div>
      )}

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Despachos</span>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-2">{totalRegistros}</div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Registros consolidados</span>
        </div>
        <div className="bg-white p-3.5 rounded border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Ventas al Contado</span>
          <div className="text-xl font-bold font-mono tabular-nums text-[#15803D] mt-2">
            {(notas || []).filter((n) => n.CondicionVenta === "Contado").length}
          </div>
          <span className="text-[11px] text-[#15803D] font-medium mt-0.5 block">Cobro inmediato</span>
        </div>
        <div className="bg-white p-3.5 rounded border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Ventas a Crédito</span>
          <div className="text-xl font-bold font-mono tabular-nums text-[#0369A1] mt-2">
            {(notas || []).filter((n) => n.CondicionVenta === "Crédito").length}
          </div>
          <span className="text-[11px] text-[#0369A1] font-medium mt-0.5 block">Plazo de 15 días</span>
        </div>
        <div className="bg-[#FFFBEB] p-3.5 rounded border border-[#FDE68A] flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-[#B45309] uppercase tracking-wider">Pendientes de Cobro</span>
          <div className="text-xl font-bold font-mono tabular-nums text-[#B45309] mt-2">
            {(notas || []).filter((n) => n.EstadoPago === "Pendiente" || n.EstadoPago === "Parcial").length}
          </div>
          <span className="text-[11px] text-[#B45309] font-medium mt-0.5 block">En seguimiento CxC</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 sm:w-80 w-full">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por N° nota, cliente, chofer o placa..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="pl-8 h-8 rounded border-slate-300 bg-white text-xs w-full"
            />
          </div>

          <div className="flex rounded border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600">
            {["TODOS", "Pagado", "Parcial", "Pendiente"].map((est) => (
              <button
                key={est}
                onClick={() => {
                  setFiltroEstadoPago(est);
                  setPagina(1);
                }}
                className={`h-7 px-2.5 rounded text-xs transition-colors ${
                  filtroEstadoPago === est ? "bg-[#1C96C5] text-white font-medium" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {est}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">N° Nota</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Cliente / Destino</th>
                <th className="py-2.5 px-3">Camión / Chofer</th>
                <th className="py-2.5 px-3 text-center">Condición</th>
                <th className="py-2.5 px-3 text-right">Flete Chofer</th>
                <th className="py-2.5 px-3 text-right">Total Neto</th>
                <th className="py-2.5 px-3 text-center">Estado Pago</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <SkeletonRow key={idx} cols={9} rowIdx={idx} />
                ))
              ) : notas.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No se encontraron notas de venta con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                notas.map((n) => (
                  <tr key={n.IdNotaVenta} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-medium text-[#1C96C5]">
                      {n.NumeroNota}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-500">
                      {n.FechaEmision ? new Date(n.FechaEmision).toLocaleDateString("es-BO") : "-"}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900 text-xs">
                        {n.RazonSocial || n.NombreComercial}
                      </div>
                      <div className="text-[11px] text-slate-400">{n.Ciudad || "Sucre"}</div>
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {n.Chofer ? (
                        <>
                          <div className="font-medium text-slate-800">{n.Chofer}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Camión #{n.NumeroCamion || "1"} {n.Placa ? `(${n.Placa})` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">Entrega Local</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-flex px-1.5 py-0.5 rounded border text-[11px] font-medium ${
                          n.CondicionVenta === "Contado"
                            ? "border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]"
                            : "border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]"
                        }`}
                      >
                        {n.CondicionVenta}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {Number(n.FleteChofer || 0) > 0 ? `Bs. ${Number(n.FleteChofer).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      Bs. {Number(n.TotalNeto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <StatusBadge
                        status={
                          n.EstadoPago === "Pagado"
                            ? "aprobado"
                            : n.EstadoPago === "Parcial"
                            ? "info"
                            : "pendiente"
                        }
                        label={n.EstadoPago}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => verDetalle(n)}
                        className="h-7 w-7 p-0 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 rounded border border-slate-300 bg-white">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-base font-semibold">
              <Truck className="h-4 w-4 text-[#1C96C5]" />
              Registrar Nota de Venta y Despacho
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCrearNota} className="space-y-3.5 pt-1">
            {/* Selector de Sucursal para Multisede */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Sucursal de Emisión *
              </label>
              {esMultisede ? (
                <select
                  required
                  value={formNota.id_sucursal || 1}
                  onChange={(e) => setFormNota({ ...formNota, id_sucursal: Number(e.target.value) })}
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
                  Nota: El filtro general está en consolidado. Indique expresamente a qué sede pertenece este despacho.
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  N° Nota de Venta *
                </label>
                <Input
                  required
                  value={formNota.numero_nota}
                  onChange={(e) => setFormNota({ ...formNota, numero_nota: e.target.value })}
                  placeholder="Ej: NV-501"
                  className="text-xs h-8 rounded border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  N° Nota de Entrega
                </label>
                <Input
                  value={formNota.numero_entrega}
                  onChange={(e) => setFormNota({ ...formNota, numero_entrega: e.target.value })}
                  placeholder="Ej: NE-308"
                  className="text-xs h-8 rounded border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
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
                  className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:border-[#1C96C5]"
                >
                  <option value="">Seleccione Cliente...</option>
                  {(clientes || []).map((c) => (
                    <option key={c.IdCliente} value={c.IdCliente}>
                      {c.RazonSocial || c.NombreComercial} ({c.Ciudad})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Destino / Ciudad
                </label>
                <select
                  value={formNota.destino}
                  onChange={(e) => setFormNota({ ...formNota, destino: e.target.value })}
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
            </div>

            {/* Datos del Camión y Transporte */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2.5">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                Transporte y Despacho
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">N° Camión</label>
                  <Input
                    value={formNota.numero_camion}
                    onChange={(e) => setFormNota({ ...formNota, numero_camion: e.target.value })}
                    placeholder="Camión 1"
                    className="text-xs h-8 rounded border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Chofer</label>
                  <Input
                    value={formNota.chofer}
                    onChange={(e) => setFormNota({ ...formNota, chofer: e.target.value })}
                    placeholder="Ej: Roberto Flores"
                    className="text-xs h-8 rounded border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Placa</label>
                  <Input
                    value={formNota.placa}
                    onChange={(e) => setFormNota({ ...formNota, placa: e.target.value })}
                    placeholder="Ej: 3021-XRT"
                    className="text-xs h-8 rounded border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Flete Chofer (Bs.)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formNota.flete_chofer}
                    onChange={(e) => setFormNota({ ...formNota, flete_chofer: e.target.value })}
                    placeholder="0.00"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Condición de Venta</label>
                  <select
                    value={formNota.condicion_venta}
                    onChange={(e) => setFormNota({ ...formNota, condicion_venta: e.target.value })}
                    className="w-full text-xs h-8 rounded border border-slate-300 bg-white px-2.5 font-medium text-slate-700 focus:outline-none focus:border-[#1C96C5]"
                  >
                    <option value="Crédito">Crédito</option>
                    <option value="Contado">Contado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Días de Crédito</label>
                  <Input
                    type="number"
                    value={formNota.dias_credito}
                    onChange={(e) => setFormNota({ ...formNota, dias_credito: e.target.value })}
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right"
                  />
                </div>
              </div>
            </div>

            {/* Desglose de Paquetes según Excel 5_CONTROL NOTAS DE VENTA */}
            <div className="border border-slate-200 rounded p-3 space-y-2.5">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                Paquetes Despachados
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-slate-600 block">MEGA 12R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_mega_12r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_mega_12r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">Económico</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_economico}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_economico: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">MEGA 12R 30m</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_mega_30m}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_mega_30m: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">LUX 6R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_lux_6r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_lux_6r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">LUX 12R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_lux_12r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_lux_12r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">LUX 24R</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_lux_24r}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_lux_24r: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">SERV 500X6</label>
                  <Input
                    type="number"
                    value={formNota.paquetes_serv_500x6}
                    onChange={(e) => setFormNota({ ...formNota, paquetes_serv_500x6: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block">Bonificación (Sin cargo)</label>
                  <Input
                    type="number"
                    value={formNota.bonificacion_paquetes}
                    onChange={(e) => setFormNota({ ...formNota, bonificacion_paquetes: e.target.value })}
                    placeholder="0"
                    className="text-xs h-8 rounded border-slate-300 font-mono text-right mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Observaciones del Despacho
              </label>
              <Textarea
                rows={2}
                value={formNota.observaciones}
                onChange={(e) => setFormNota({ ...formNota, observaciones: e.target.value })}
                placeholder="Ruta Sucre-Santa Cruz, entrega directa en almacén..."
                className="text-xs rounded border-slate-300"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={() => setModalNuevaOpen(false)} className="h-8 rounded text-xs border-slate-300">
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoNota} className="h-8 rounded bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-medium">
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
        <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto p-5 rounded border border-slate-300 bg-white">
          <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between print:hidden">
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-base font-semibold">
              <FileText className="h-4 w-4 text-[#1C96C5]" />
              <span>Nota Oficial de Venta & Despacho: {detalleNota?.NumeroNota || notaSeleccionada?.NumeroNota}</span>
            </DialogTitle>
            <Button
              type="button"
              onClick={() => window.print()}
              className="bg-[#1C96C5] hover:bg-[#157A9E] text-white gap-1.5 h-8 text-xs font-medium px-3 rounded"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Nota / Recibo</span>
            </Button>
          </DialogHeader>

          {detalleNota && (
            <div className="space-y-4 print:p-0 pt-1">
              {/* MEMBRETE CORPORATIVO FORMAL */}
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
                    Empresa de Papel Blanquita (Shema Asociados S.R.L.)
                  </h1>
                  <p className="text-[11px] font-medium text-slate-600 uppercase">
                    División Comercial, Despacho y Facturación • Sucre, Bolivia
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Calle Regimiento Charcas N° 37 • Tel: (4) 64-51234 • NIT: 1024589028
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                    NOTA DE VENTA N°
                  </span>
                  <span className="text-base font-mono font-bold text-[#1C96C5]">
                    {detalleNota.NumeroNota || "NV-000"}
                  </span>
                  <span className="text-xs font-mono text-slate-700 block mt-0.5">
                    Fecha: {detalleNota.FechaVenta ? new Date(detalleNota.FechaVenta).toLocaleDateString("es-BO") : new Date().toLocaleDateString("es-BO")}
                  </span>
                </div>
              </div>

              {/* DATOS DE LA OPERACIÓN Y CLIENTE */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <strong className="text-slate-500 block font-medium uppercase text-[10px]">Cliente / Razón Social:</strong>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{detalleNota.Cliente?.RazonSocial}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium uppercase text-[10px]">Destino / Ciudad:</strong>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{detalleNota.Cliente?.Ciudad || "Sucre"}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium uppercase text-[10px]">Transportista / Chofer:</strong>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{detalleNota.Chofer || "No asignado"}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium uppercase text-[10px]">Placa Camión:</strong>
                  <span className="font-mono text-slate-900 mt-0.5 block">{detalleNota.Placa || "-"}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium uppercase text-[10px]">Condición de Venta:</strong>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{detalleNota.CondicionVenta}</span>
                </div>
                <div>
                  <strong className="text-slate-500 block font-medium uppercase text-[10px]">Flete de Chofer:</strong>
                  <span className="font-mono tabular-nums text-slate-900 mt-0.5 block">Bs. {Number(detalleNota.FleteChofer || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="sm:col-span-2">
                  <strong className="text-slate-500 block font-medium uppercase text-[10px]">Observaciones:</strong>
                  <span className="text-slate-700 mt-0.5 block">{detalleNota.Observacion || "Despacho regular conforme a pedido."}</span>
                </div>
              </div>

              {/* TABLA DE ÍTEMS */}
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-700 mb-2">
                  Ítems y Productos Despachados
                </h4>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Presentación / Producto</th>
                        <th className="py-2 px-3 text-center">Cantidad Paquetes</th>
                        <th className="py-2 px-3 text-right">Precio Unitario</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detalleNota.Detalles?.map((d) => (
                        <tr key={d.IdDetalleNota} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">{d.Presentacion}</td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums font-bold">{d.PaquetesEntregados}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">Bs. {Number(d.PrecioUnitario || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                            Bs. {Number(d.Subtotal || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TOTALES */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-slate-50 rounded border border-slate-200 text-xs gap-2">
                <span className="font-semibold text-slate-700">Total Importe Neto de la Operación:</span>
                <span className="font-mono tabular-nums font-bold text-base text-[#1C96C5]">
                  Bs. {Number(detalleNota.TotalNeto || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* SECCIÓN FORMAL DE FIRMAS IMPRIMIBLE */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                <div className="border-t border-slate-400 pt-1.5">
                  <p className="font-semibold text-slate-800">Entregado Conforme</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Firma Transportista / Despacho</p>
                </div>
                <div className="border-t border-slate-400 pt-1.5">
                  <p className="font-semibold text-slate-800">Recibido Conforme</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Firma y Sello del Cliente</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-slate-200 pt-3 print:hidden">
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
