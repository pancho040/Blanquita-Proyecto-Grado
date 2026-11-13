import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Boxes,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  PackageCheck,
  ShieldCheck,
  RotateCcw,
  Edit3,
  X,
  MapPin,
  Building2
} from "lucide-react";
import { ResolverSolicitudCarga, AprobarCargaCamion } from "@/services/Logistica/RutaService";
import { ObtenerInventarioChofer } from "@/services/Logistica/InventarioComercialService";

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

  // Inicializar items cuando se abre o cambia la solicitud/asignación
  useEffect(() => {
    if (!abierto) {
      setModoAccion(null);
      setMotivoAccion("");
      return;
    }

    let itemsBase = [];
    let remanenteBase = [];

    if (solicitud?.detalles && Array.isArray(solicitud.detalles)) {
      itemsBase = solicitud.detalles.map((d) => {
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
      itemsBase = solicitud.items.map((it) => {
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
    } else {
      // Catálogo estándar si no hay detalle explícito
      itemsBase = [
        {
          presentacion_id: 1,
          nombre_producto: "Papel Higiénico Blanquita Clásico 4 rollos",
          cantidad_solicitada: 50.0,
          cantidad_aprobada: 50.0,
          unidad: "paquetes"
        },
        {
          presentacion_id: 2,
          nombre_producto: "Papel Higiénico Blanquita Doble Hoja 4 rollos",
          cantidad_solicitada: 30.0,
          cantidad_aprobada: 30.0,
          unidad: "paquetes"
        },
        {
          presentacion_id: 3,
          nombre_producto: "Servilleta Blanquita 100u",
          cantidad_solicitada: 20.0,
          cantidad_aprobada: 20.0,
          unidad: "fardos"
        }
      ];

      remanenteBase = [];
    }

    setItemsEditables(itemsBase);
    setStockRemanente(remanenteBase);
    setObservacionAprobacion(solicitud?.observacion_admin || "Carga física y stock de camión verificados por supervisor");
    setModoAccion(null);
    setMotivoAccion("");

    // Si stock_remanente viniera vacío, consultar inventario real a bordo del camión del chofer
    const idChoferParaRemanente =
      solicitud?.id_chofer ||
      solicitud?.chofer_id ||
      solicitud?.IdUsuarioRepartidor ||
      asignacion?.IdUsuarioRepartidor;

    if (idChoferParaRemanente && remanenteBase.length === 0) {
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
              setStockRemanente(remanentesReales);
            }
          }
        })
        .catch(() => {});
    }
  }, [abierto, solicitud, asignacion]);

  const handleActualizarCantidadAprobada = (index, nuevaCantidad) => {
    const val = Math.max(0, parseFloat(nuevaCantidad) || 0);
    setItemsEditables((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], cantidad_aprobada: val };
      return copia;
    });
  };

  // 1. Despachar Aprobación
  const handleAprobar = async () => {
    if (!idAsignacion) {
      toast.error("No se encontró el ID de asignación para aprobar la carga");
      return;
    }

    try {
      setResolviendo(true);
      const itemsPayload = itemsEditables.map((item) => ({
        presentacion_id: Number(item.presentacion_id),
        cantidad_aprobada: Number(item.cantidad_aprobada)
      }));

      await ResolverSolicitudCarga(idAsignacion, {
        decision: "APROBADA",
        items: itemsPayload,
        items_aprobados: itemsPayload,
        observacion: observacionAprobacion || "Carga física y stock de camión verificados por supervisor",
        usar_remanente: true
      });

      toast.success("Stock de camión aprobado y ruta habilitada para reparto en app móvil");
      
      // Sincronizar inmediatamente todas las pestañas y vistas
      window.dispatchEvent(new CustomEvent("blanquita:ws-event", {
        detail: { tipo: "carga_camion_aprobada", idAsignacion }
      }));
      window.dispatchEvent(new CustomEvent("blanquita:carga-actualizada", {
        detail: { idAsignacion, decision: "APROBADA" }
      }));

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

      // Sincronizar inmediatamente todas las pestañas y vistas
      window.dispatchEvent(new CustomEvent("blanquita:ws-event", {
        detail: { tipo: "carga_camion_observada", idAsignacion }
      }));
      window.dispatchEvent(new CustomEvent("blanquita:carga-actualizada", {
        detail: { idAsignacion, decision: "OBSERVADA" }
      }));

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

      toast.error("Solicitud de carga rechazada. La ruta no fue habilitada");

      // Sincronizar inmediatamente todas las pestañas y vistas
      window.dispatchEvent(new CustomEvent("blanquita:ws-event", {
        detail: { tipo: "carga_camion_rechazada", idAsignacion }
      }));
      window.dispatchEvent(new CustomEvent("blanquita:carga-actualizada", {
        detail: { idAsignacion, decision: "RECHAZADA" }
      }));

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
        {/* Header Impecable (DESIGN.md): botón X y badge en flex items-center gap-3 shrink-0 sin solapamiento */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 bg-white">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 bg-sky-100 text-[#1C96C5] rounded-xl shrink-0 mt-0.5">
              <Truck className="h-5 w-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-slate-800 leading-tight">
                Bandeja de Solicitud de Carga de Camión
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-1">
                <span className="font-semibold text-slate-700 truncate">{rutaNombre}</span>
                <span>•</span>
                <span>Chofer: <strong className="text-slate-700">{choferNombre}</strong></span>
                <span>•</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase font-bold px-1.5 py-0 border ${
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
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-xs px-2.5 py-1 font-semibold">
              <Clock className="h-3 w-3 mr-1.5 shrink-0 inline" />
              Pendiente de Aprobación
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

        {/* Body Impecable: flex-1 overflow-y-auto px-6 py-4 */}
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
                      <span>Rechazar Solicitud de Carga</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Observar Solicitud de Carga</span>
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
                  ? "Indica el motivo por el cual no se autoriza la salida de este camión a reparto:"
                  : "Indica las correcciones que el chofer debe realizar en su carga física:"}
              </p>

              <Input
                type="text"
                autoFocus
                value={motivoAccion}
                onChange={(e) => setMotivoAccion(e.target.value)}
                placeholder={
                  modoAccion === "RECHAZAR"
                    ? "Ej: Documentación incompleta, camión asignado a mantenimiento..."
                    : "Ej: Rectificar conteo de Clásico 4 rollos (físico: 40 paq)..."
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
                    <span>{resolviendo ? "Rechazando..." : "Confirmar Rechazo"}</span>
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
                    <span>{resolviendo ? "Enviando..." : "Confirmar Observación"}</span>
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
                Stock Remanente en Camión (Jornada anterior)
              </span>
              <span className="text-[11px] text-slate-400">Verificado en vehículo</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Producto</th>
                    <th className="py-2 px-3 font-semibold text-right">Cantidad Remanente</th>
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

          {/* 2. Productos que solicita cargar hoy con ajuste de cantidades */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5 text-xs">
                <PackageCheck className="h-4 w-4 text-[#1C96C5] shrink-0" />
                Productos Solicitados (Permite ajustar cantidades antes de resolver)
              </span>
              <span className="text-xs text-[#1C96C5] font-bold">
                {itemsEditables.reduce((acc, curr) => acc + Number(curr.cantidad_aprobada || 0), 0)} unidades a cargar
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left">
                <thead className="bg-sky-50 border-b border-sky-100 text-sky-900 text-[11px]">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Producto</th>
                    <th className="py-2 px-3 font-semibold text-right">Solicitado</th>
                    <th className="py-2 px-3 font-semibold text-center w-36">Cant. a Aprobar</th>
                    <th className="py-2 px-3 font-semibold text-right">Stock Final Camión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {itemsEditables.map((item, idx) => {
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
                        <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 font-mono">
                          {stockFinal} {item.unidad || "u"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observación para la aprobación */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Edit3 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <span>Observación de Inspección de Carga:</span>
            </label>
            <Input
              type="text"
              value={observacionAprobacion}
              onChange={(e) => setObservacionAprobacion(e.target.value)}
              placeholder="Ej: Verificado por almacenero de turno y estiba conforme en camión..."
              className="h-9 text-xs text-slate-800 bg-white"
            />
          </div>
        </div>

        {/* Footer Impecable (DESIGN.md): shrink-0 border-t bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-end gap-3 */}
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
            <span>Rechazar Solicitud</span>
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
            <span>Observar Solicitud</span>
          </Button>

          {/* Acción 3: Aprobar Stock y Habilitar Ruta */}
          <Button
            type="button"
            size="sm"
            onClick={handleAprobar}
            disabled={resolviendo}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{resolviendo ? "Procesando..." : "Aprobar Stock y Habilitar Ruta"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
