import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Truck,
  Clock,
  AlertTriangle,
  XCircle,
  PackageCheck,
  ShieldCheck,
  RotateCcw,
  Edit3,
  X,
  Building2,
  Plus,
  Trash2
} from "lucide-react";
import { ResolverSolicitudCarga } from "@/services/Logistica/RutaService";
import { ObtenerInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import { ObtenerPrecios } from "@/services/Logistica/PrecioService";

function fusionarItemsPorPresentacion(items) {
  const mapa = new Map();
  (items || []).forEach((it) => {
    const pid = Number(it.presentacion_id || it.id_presentacion || it.IdPresentacion);
    if (!pid) return;
    const nombre = it.nombre_producto || it.NombreProducto || it.producto || `Presentación #${pid}`;
    const unidad = it.unidad || it.TipoContenedor || "u";
    const sol = Number(it.cantidad_solicitada ?? it.stock_adicional_solicitado ?? it.cantidad ?? 0);
    const apr = Number(it.cantidad_aprobada ?? it.stock_adicional_aprobado ?? (sol > 0 ? sol : 0));

    if (mapa.has(pid)) {
      const prev = mapa.get(pid);
      prev.cantidad_solicitada += sol;
      prev.cantidad_aprobada += apr;
    } else {
      mapa.set(pid, {
        presentacion_id: pid,
        nombre_producto: nombre,
        cantidad_solicitada: sol,
        cantidad_aprobada: apr,
        unidad
      });
    }
  });
  return Array.from(mapa.values());
}

function fusionarRemanentePorPresentacion(remanentes) {
  const mapa = new Map();
  (remanentes || []).forEach((r) => {
    const pid = Number(r.presentacion_id || r.id_presentacion || r.IdPresentacion);
    if (!pid) return;
    const nombre = r.nombre_producto || r.NombreProducto || r.producto || `Presentación #${pid}`;
    const cant = Number(r.cantidad_remanente ?? r.cantidad_actual ?? r.stock_remanente ?? r.cantidad ?? 0);
    const unidad = r.unidad || r.TipoContenedor || "u";
    if (cant <= 0) return;

    if (mapa.has(pid)) {
      const prev = mapa.get(pid);
      prev.cantidad_remanente += cant;
    } else {
      mapa.set(pid, {
        presentacion_id: pid,
        nombre_producto: nombre,
        cantidad_remanente: cant,
        unidad
      });
    }
  });
  return Array.from(mapa.values());
}

export default function BandejaSolicitudCargaModal({
  abierto,
  onOpenChange,
  solicitud = null,
  asignacion = null,
  alAprobar = null,
  alResolver = null
}) {
  const [resolviendo, setResolviendo] = useState(false);
  const [modoAccion, setModoAccion] = useState(null); // null | 'OBSERVAR' | 'RECHAZAR'
  const [motivoAccion, setMotivoAccion] = useState("");
  const [observacionAprobacion, setObservacionAprobacion] = useState("");
  const [itemsEditables, setItemsEditables] = useState([]);
  const [stockRemanente, setStockRemanente] = useState([]);

  // Catálogo para agregar productos
  const [catalogoPrecios, setCatalogoPrecios] = useState([]);
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [presentacionSeleccionada, setPresentacionSeleccionada] = useState("");
  const [cantidadNueva, setCantidadNueva] = useState("10");

  const idAsignacion =
    asignacion?.IdAsignacionRuta ||
    solicitud?.id_asignacion ||
    solicitud?.id_asignacion_ruta ||
    solicitud?.IdAsignacionRuta;
  const choferNombre =
    asignacion?.NombreRepartidor ||
    solicitud?.nombre_chofer ||
    solicitud?.chofer_nombre ||
    "Chofer";
  const rutaNombre =
    asignacion?.NombreRuta ||
    solicitud?.ruta_nombre ||
    solicitud?.nombre_ruta ||
    "Ruta de Distribución";
  const idSucursal =
    solicitud?.id_sucursal ||
    asignacion?.IdSucursal ||
    (rutaNombre.toLowerCase().includes("potosí") || rutaNombre.toLowerCase().includes("potosi") ? 2 : 1);
  const nombreSede = idSucursal === 2 ? "Potosí" : "Sucre";

  useEffect(() => {
    if (!abierto) {
      setModoAccion(null);
      setMotivoAccion("");
      setMostrarAgregar(false);
      return;
    }

    // Cargar catálogo de la sucursal para posibilitar añadir productos
    ObtenerPrecios(idSucursal)
      .then((precios) => {
        setCatalogoPrecios(Array.isArray(precios) ? precios : []);
      })
      .catch(() => setCatalogoPrecios([]));

    let itemsBase = [];
    let remanenteBase = [];

    if (solicitud?.detalles && Array.isArray(solicitud.detalles)) {
      itemsBase = solicitud.detalles
        .filter((d) => Number(d.stock_adicional_solicitado ?? d.cantidad_solicitada ?? 0) > 0)
        .map((d) => {
          const cantSol = Number(d.stock_adicional_solicitado ?? d.cantidad_solicitada ?? 0);
          const cantAprobadaRaw = Number(d.stock_adicional_aprobado ?? 0);
          return {
            presentacion_id: d.id_presentacion || d.presentacion_id,
            nombre_producto: d.nombre_producto || `Presentación #${d.id_presentacion || d.presentacion_id}`,
            cantidad_solicitada: cantSol,
            cantidad_aprobada: cantAprobadaRaw > 0 ? cantAprobadaRaw : cantSol,
            unidad: d.unidad || "u"
          };
        });

      remanenteBase = solicitud.detalles
        .filter((d) => Number(d.stock_remanente || 0) > 0)
        .map((d) => ({
          presentacion_id: d.id_presentacion || d.presentacion_id,
          nombre_producto: d.nombre_producto || `Presentación #${d.id_presentacion || d.presentacion_id}`,
          cantidad_remanente: Number(d.stock_remanente || 0),
          unidad: d.unidad || "u"
        }));
    } else if (solicitud?.items && Array.isArray(solicitud.items)) {
      itemsBase = solicitud.items
        .filter((it) => Number(it.cantidad_solicitada ?? it.cantidad ?? 0) > 0)
        .map((it) => {
          const cantSol = Number(it.cantidad_solicitada ?? it.cantidad ?? 0);
          const cantAprobadaRaw = Number(it.cantidad_aprobada ?? 0);
          return {
            presentacion_id: it.presentacion_id || it.id_presentacion,
            nombre_producto: it.nombre_producto || `Presentación #${it.presentacion_id || it.id_presentacion}`,
            cantidad_solicitada: cantSol,
            cantidad_aprobada: cantAprobadaRaw > 0 ? cantAprobadaRaw : cantSol,
            unidad: it.unidad || "u"
          };
        });

      remanenteBase = (solicitud.stock_remanente || solicitud.remanente || [])
        .filter((r) => Number(r.cantidad_remanente ?? r.cantidad_actual ?? r.cantidad ?? 0) > 0)
        .map((r) => ({
          presentacion_id: r.presentacion_id,
          nombre_producto: r.nombre_producto || `Presentación #${r.presentacion_id}`,
          cantidad_remanente: Number(r.cantidad_remanente ?? r.cantidad_actual ?? r.cantidad ?? 0),
          unidad: r.unidad || "u"
        }));
    }

    setItemsEditables(fusionarItemsPorPresentacion(itemsBase));
    setStockRemanente(fusionarRemanentePorPresentacion(remanenteBase));
    setObservacionAprobacion(solicitud?.observacion_admin || "Carga física y stock de camión verificados");
    setModoAccion(null);
    setMotivoAccion("");

    // Consultar inventario real del chofer si el remanente no venía completo
    const idChoferParaRemanente =
      solicitud?.id_chofer ||
      solicitud?.chofer_id ||
      solicitud?.IdUsuarioRepartidor ||
      asignacion?.IdUsuarioRepartidor;

    if (idChoferParaRemanente) {
      ObtenerInventarioChofer(idChoferParaRemanente)
        .then((inventarioReal) => {
          if (Array.isArray(inventarioReal) && inventarioReal.length > 0) {
            const remanentesReales = inventarioReal
              .filter((stk) => Number(stk.cantidad_remanente ?? stk.cantidad_actual ?? stk.cantidad ?? 0) > 0)
              .map((stk) => ({
                presentacion_id: stk.presentacion_id || stk.id_presentacion,
                nombre_producto: stk.nombre_producto || stk.producto || `Presentación #${stk.presentacion_id || stk.id_presentacion}`,
                cantidad_remanente: Number(stk.cantidad_remanente ?? stk.cantidad_actual ?? stk.cantidad ?? 0),
                unidad: stk.unidad || "u"
              }));
            if (remanentesReales.length > 0) {
              setStockRemanente(fusionarRemanentePorPresentacion(remanentesReales));
            }
          }
        })
        .catch(() => {});
    }
  }, [abierto, solicitud, asignacion, idSucursal]);

  const handleActualizarCantidadAprobada = (index, nuevaCantidad) => {
    const val = Math.max(0, parseFloat(nuevaCantidad) || 0);
    setItemsEditables((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], cantidad_aprobada: val };
      return copia;
    });
  };

  const handleEliminarItem = (index) => {
    setItemsEditables((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAgregarProducto = () => {
    if (!presentacionSeleccionada) {
      toast.error("Seleccione un producto para agregar");
      return;
    }
    const cant = parseFloat(cantidadNueva) || 0;
    if (cant <= 0) {
      toast.error("La cantidad a cargar debe ser mayor a 0");
      return;
    }

    const presId = Number(presentacionSeleccionada);
    const prodCatalogo = catalogoPrecios.find(
      (p) => Number(p.IdPresentacion || p.presentacion_id) === presId
    );

    const nombre = prodCatalogo
      ? `${prodCatalogo.NombreProducto || prodCatalogo.nombre_producto || "Producto"} (${prodCatalogo.CodigoPresentacion || "Pres"})`
      : `Presentación #${presId}`;

    const unidad = prodCatalogo?.TipoContenedor || prodCatalogo?.tipo_contenedor || "u";

    setItemsEditables((prev) => {
      const existente = prev.find((it) => Number(it.presentacion_id) === presId);
      if (existente) {
        return prev.map((it) =>
          Number(it.presentacion_id) === presId
            ? { ...it, cantidad_aprobada: it.cantidad_aprobada + cant }
            : it
        );
      }
      return [
        ...prev,
        {
          presentacion_id: presId,
          nombre_producto: nombre,
          cantidad_solicitada: 0,
          cantidad_aprobada: cant,
          unidad
        }
      ];
    });

    setPresentacionSeleccionada("");
    setCantidadNueva("10");
    setMostrarAgregar(false);
    toast.success("Producto agregado a la lista de carga");
  };

  const totalRemanente = useMemo(() => {
    return stockRemanente.reduce((acc, r) => acc + Number(r.cantidad_remanente || 0), 0);
  }, [stockRemanente]);

  const totalAdicional = useMemo(() => {
    return itemsEditables.reduce((acc, curr) => acc + Number(curr.cantidad_aprobada || 0), 0);
  }, [itemsEditables]);

  const totalFinal = totalRemanente + totalAdicional;

  // 1. Despachar Aprobación
  const handleAprobar = async () => {
    if (!idAsignacion) {
      toast.error("No se encontró el ID de asignación para aprobar la carga");
      return;
    }

    const itemsPayload = itemsEditables
      .map((item) => ({
        presentacion_id: Number(item.presentacion_id),
        cantidad_aprobada: Number(item.cantidad_aprobada)
      }))
      .filter((item) => item.cantidad_aprobada > 0);

    if (itemsPayload.length === 0 && totalRemanente === 0) {
      toast.error("No hay stock en el camión ni carga solicitada para habilitar la ruta");
      return;
    }

    try {
      setResolviendo(true);
      await ResolverSolicitudCarga(idAsignacion, {
        decision: "APROBADA",
        items: itemsPayload,
        items_aprobados: itemsPayload,
        observacion: observacionAprobacion || "Carga física y stock de camión verificados por supervisor",
        usar_remanente: true
      });

      toast.success("Carga aprobada y ruta habilitada para reparto");

      window.dispatchEvent(
        new CustomEvent("blanquita:ws-event", {
          detail: { tipo: "carga_camion_aprobada", idAsignacion }
        })
      );
      window.dispatchEvent(
        new CustomEvent("blanquita:carga-actualizada", {
          detail: { idAsignacion, decision: "APROBADA" }
        })
      );

      if (alAprobar) alAprobar(idAsignacion);
      if (alResolver) alResolver(idAsignacion, "APROBADA");
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Error al aprobar carga de camión");
    } finally {
      setResolviendo(false);
    }
  };

  // 2. Despachar Observación
  const handleObservar = async () => {
    if (!idAsignacion) {
      toast.error("No se encontró el ID de asignación para observar la carga");
      return;
    }
    if (!motivoAccion.trim()) {
      toast.error("Ingresa la observación detallada para el chofer");
      return;
    }

    try {
      setResolviendo(true);
      await ResolverSolicitudCarga(idAsignacion, {
        decision: "OBSERVADA",
        observacion: motivoAccion.trim()
      });

      toast.info("Solicitud observada. Notificación enviada al chofer");

      window.dispatchEvent(
        new CustomEvent("blanquita:ws-event", {
          detail: { tipo: "carga_camion_observada", idAsignacion }
        })
      );
      window.dispatchEvent(
        new CustomEvent("blanquita:carga-actualizada", {
          detail: { idAsignacion, decision: "OBSERVADA" }
        })
      );

      if (alResolver) alResolver(idAsignacion, "OBSERVADA");
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Error al observar solicitud");
    } finally {
      setResolviendo(false);
    }
  };

  // 3. Despachar Rechazo
  const handleRechazar = async () => {
    if (!idAsignacion) {
      toast.error("No se encontró el ID de asignación para rechazar la carga");
      return;
    }
    if (!motivoAccion.trim()) {
      toast.error("Ingresa el motivo del rechazo de la carga");
      return;
    }

    try {
      setResolviendo(true);
      await ResolverSolicitudCarga(idAsignacion, {
        decision: "RECHAZADA",
        motivo: motivoAccion.trim(),
        observacion: motivoAccion.trim()
      });

      toast.error("Solicitud de carga rechazada");

      window.dispatchEvent(
        new CustomEvent("blanquita:ws-event", {
          detail: { tipo: "carga_camion_rechazada", idAsignacion }
        })
      );
      window.dispatchEvent(
        new CustomEvent("blanquita:carga-actualizada", {
          detail: { idAsignacion, decision: "RECHAZADA" }
        })
      );

      if (alResolver) alResolver(idAsignacion, "RECHAZADA");
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Error al rechazar solicitud");
    } finally {
      setResolviendo(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 bg-white">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 bg-sky-100 text-[#1C96C5] rounded-xl shrink-0 mt-0.5">
              <Truck className="h-5 w-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-slate-800 leading-tight">
                Revisión de carga de camión
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-1">
                <span className="font-semibold text-slate-700 truncate">{rutaNombre}</span>
                <span>•</span>
                <span>Chofer: <strong className="text-slate-700">{choferNombre}</strong></span>
                <span>•</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold px-1.5 py-0 border ${
                    idSucursal === 2
                      ? "border-purple-300 text-purple-700 bg-purple-50"
                      : "border-sky-300 text-sky-700 bg-sky-50"
                  }`}
                >
                  <Building2 className="h-3 w-3 mr-1 shrink-0 inline" />
                  {nombreSede}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-xs px-2.5 py-1 font-medium">
              <Clock className="h-3 w-3 mr-1.5 shrink-0 inline" />
              Pendiente
            </Badge>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 text-xs bg-slate-50/50">
          {/* Sub-formulario condicional de Observación o Rechazo */}
          {modoAccion && (
            <div
              className={`p-4 rounded-xl border-2 transition-all ${
                modoAccion === "RECHAZAR"
                  ? "bg-rose-50 border-rose-300 text-rose-950"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {modoAccion === "RECHAZAR" ? (
                    <>
                      <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Rechazar solicitud de carga</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Observar solicitud de carga</span>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setModoAccion(null);
                    setMotivoAccion("");
                  }}
                  className="h-6 px-2 text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancelar acción
                </Button>
              </div>

              <p className="text-xs mb-2 opacity-90">
                {modoAccion === "RECHAZAR"
                  ? "Indique el motivo por el cual no se autoriza la salida de este camión:"
                  : "Indique las correcciones que el chofer debe realizar en su carga física:"}
              </p>

              <Input
                type="text"
                autoFocus
                value={motivoAccion}
                onChange={(e) => setMotivoAccion(e.target.value)}
                placeholder={
                  modoAccion === "RECHAZAR"
                    ? "Ej: Documentación incompleta o vehículo no disponible"
                    : "Ej: Rectificar conteo de Clásico 4 rollos (físico: 40 paq)"
                }
                className="h-9 text-xs bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-sky-500"
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModoAccion(null);
                    setMotivoAccion("");
                  }}
                  className="text-xs"
                >
                  Regresar
                </Button>
                {modoAccion === "RECHAZAR" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={resolviendo || !motivoAccion.trim()}
                    onClick={handleRechazar}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1.5"
                  >
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>{resolviendo ? "Rechazando..." : "Confirmar rechazo"}</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={resolviendo || !motivoAccion.trim()}
                    onClick={handleObservar}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{resolviendo ? "Enviando..." : "Confirmar observación"}</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 1. Stock Remanente del Chofer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5 text-xs">
                <RotateCcw className="h-4 w-4 text-slate-500 shrink-0" />
                Stock remanente a bordo ({totalRemanente} u)
              </span>
              <span className="text-[11px] text-slate-400">Verificado en vehículo</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Producto</th>
                    <th className="py-2 px-3 font-semibold text-right">Cantidad remanente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {stockRemanente.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-3 text-center text-slate-400 text-xs italic">
                        Sin remanente previo (camión vacío al inicio de jornada).
                      </td>
                    </tr>
                  ) : (
                    stockRemanente.map((rem, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-medium">
                          {rem.nombre_producto || `Presentación #${rem.presentacion_id}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {rem.cantidad_remanente} {rem.unidad || "u"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Productos solicitados o carga adicional */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5 text-xs">
                <PackageCheck className="h-4 w-4 text-[#1C96C5] shrink-0" />
                Carga adicional para la ruta ({totalAdicional} u a cargar)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMostrarAgregar(!mostrarAgregar)}
                className="h-7 text-xs border-sky-300 text-[#1C96C5] hover:bg-sky-50 gap-1 px-2"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Agregar producto</span>
              </Button>
            </div>

            {/* Formulario desplegable para agregar producto del catálogo */}
            {mostrarAgregar && (
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2">
                <span className="text-[11px] font-semibold text-sky-900 block">
                  Seleccionar producto del catálogo para cargar:
                </span>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={presentacionSeleccionada}
                    onChange={(e) => setPresentacionSeleccionada(e.target.value)}
                    className="flex-1 w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-800"
                  >
                    <option value="">-- Seleccionar presentación --</option>
                    {catalogoPrecios.map((p) => {
                      const pid = p.IdPresentacion || p.presentacion_id;
                      const nombre = `${p.NombreProducto || p.nombre_producto} - ${p.CodigoPresentacion || ""}`;
                      return (
                        <option key={pid} value={pid}>
                          {nombre}
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={cantidadNueva}
                      onChange={(e) => setCantidadNueva(e.target.value)}
                      placeholder="Cantidad"
                      className="h-8 w-24 text-xs bg-white text-center"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAgregarProducto}
                      className="h-8 bg-[#1C96C5] hover:bg-[#167ca4] text-white text-xs px-3"
                    >
                      Añadir
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMostrarAgregar(false)}
                      className="h-8 text-xs text-slate-500"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left">
                <thead className="bg-sky-50 border-b border-sky-100 text-sky-900 text-[11px]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Producto</th>
                    <th className="py-2 px-3 font-semibold text-right">Solicitado</th>
                    <th className="py-2 px-3 font-semibold text-center w-36">Cant. a aprobar</th>
                    <th className="py-2 px-3 font-semibold text-right">Stock final camión</th>
                    <th className="py-2 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {itemsEditables.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-slate-400 text-xs italic">
                        No hay carga adicional solicitada. El chofer saldrá a repartir únicamente con el stock remanente en su camión ({totalRemanente} u).
                      </td>
                    </tr>
                  ) : (
                    itemsEditables.map((item, idx) => {
                      const remanenteMatch = stockRemanente.find(
                        (r) => Number(r.presentacion_id) === Number(item.presentacion_id)
                      );
                      const cantRemanente = Number(remanenteMatch?.cantidad_remanente || 0);
                      const cantAprobada = Number(item.cantidad_aprobada || 0);
                      const stockFinal = cantRemanente + cantAprobada;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-medium">
                            {item.nombre_producto || `Presentación #${item.presentacion_id}`}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                            {item.cantidad_solicitada} {item.unidad || "u"}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={item.cantidad_aprobada}
                                onChange={(e) => handleActualizarCantidadAprobada(idx, e.target.value)}
                                className="h-7 w-20 text-center font-bold text-xs bg-white border-sky-300 text-[#1C96C5]"
                              />
                              <span className="text-[10px] text-slate-500 font-medium">{item.unidad || "u"}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                            {stockFinal} {item.unidad || "u"}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleEliminarItem(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                              title="Quitar producto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observación para la aprobación */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Edit3 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span>Observación de inspección de carga:</span>
            </label>
            <Input
              type="text"
              value={observacionAprobacion}
              onChange={(e) => setObservacionAprobacion(e.target.value)}
              placeholder="Ej: Stock verificado en plataforma de carga conforme..."
              className="h-9 text-xs text-slate-800 bg-white"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-600 hover:text-slate-900"
          >
            Cerrar
          </Button>

          {/* Acción 1: Rechazar */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setModoAccion("RECHAZAR");
              setMotivoAccion("");
            }}
            disabled={resolviendo}
            className="text-xs border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 gap-1.5"
          >
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Rechazar</span>
          </Button>

          {/* Acción 2: Observar */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setModoAccion("OBSERVAR");
              setMotivoAccion("");
            }}
            disabled={resolviendo}
            className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 gap-1.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Observar</span>
          </Button>

          {/* Acción 3: Aprobar Stock y Habilitar Ruta */}
          <Button
            type="button"
            size="sm"
            onClick={handleAprobar}
            disabled={resolviendo || (totalRemanente === 0 && totalAdicional === 0)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              {resolviendo
                ? "Procesando..."
                : `Aprobar y habilitar ruta (Carga: ${totalAdicional} u · Stock final: ${totalFinal} u)`}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
