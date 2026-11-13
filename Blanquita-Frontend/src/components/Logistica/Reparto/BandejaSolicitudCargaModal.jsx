import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Boxes,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  PackageCheck,
  ShieldCheck,
  RotateCcw,
  Edit3
} from "lucide-react";
import { AprobarCargaCamion } from "@/services/Logistica/RutaService";

export default function BandejaSolicitudCargaModal({
  abierto,
  onOpenChange,
  solicitud = null,
  asignacion = null,
  alAprobar = null
}) {
  const [aprobando, setAprobando] = useState(false);
  const [observacionAprobacion, setObservacionAprobacion] = useState("");
  const [itemsEditables, setItemsEditables] = useState([]);
  const [stockRemanente, setStockRemanente] = useState([]);

  const idAsignacion = asignacion?.IdAsignacionRuta || solicitud?.id_asignacion || solicitud?.id_asignacion_ruta || solicitud?.IdAsignacionRuta;
  const choferNombre = asignacion?.NombreRepartidor || solicitud?.nombre_chofer || solicitud?.chofer_nombre || "Chofer";
  const rutaNombre = asignacion?.NombreRuta || solicitud?.ruta_nombre || "Ruta de Distribución";

  // Inicializar items cuando se abre o cambia la solicitud/asignación
  useEffect(() => {
    if (!abierto) return;

    let itemsBase = [];
    let remanenteBase = [];

    if (solicitud?.detalles && Array.isArray(solicitud.detalles)) {
      itemsBase = solicitud.detalles.map((d) => ({
        presentacion_id: d.id_presentacion || d.presentacion_id,
        nombre_producto: d.nombre_producto || `Presentación #${d.id_presentacion || d.presentacion_id}`,
        cantidad_solicitada: Number(d.stock_adicional_solicitado ?? d.cantidad_solicitada ?? 0),
        cantidad_aprobada: Number(d.stock_adicional_aprobado ?? d.stock_adicional_solicitado ?? d.cantidad_solicitada ?? 0),
        unidad: d.unidad || "u"
      }));

      remanenteBase = solicitud.detalles
        .filter((d) => Number(d.stock_remanente || 0) > 0)
        .map((d) => ({
          presentacion_id: d.id_presentacion || d.presentacion_id,
          nombre_producto: d.nombre_producto || `Presentación #${d.id_presentacion || d.presentacion_id}`,
          cantidad_remanente: Number(d.stock_remanente || 0),
          unidad: d.unidad || "u"
        }));
    } else if (solicitud?.items && Array.isArray(solicitud.items)) {
      itemsBase = solicitud.items.map((it) => ({
        presentacion_id: it.presentacion_id || it.id_presentacion,
        nombre_producto: it.nombre_producto || `Presentación #${it.presentacion_id || it.id_presentacion}`,
        cantidad_solicitada: Number(it.cantidad_solicitada ?? it.cantidad ?? 0),
        cantidad_aprobada: Number(it.cantidad_aprobada ?? it.cantidad_solicitada ?? it.cantidad ?? 0),
        unidad: it.unidad || "u"
      }));
      remanenteBase = (solicitud.stock_remanente || solicitud.remanente || []).map((r) => ({
        presentacion_id: r.presentacion_id,
        nombre_producto: r.nombre_producto || `Presentación #${r.presentacion_id}`,
        cantidad_remanente: Number(r.cantidad_remanente || 0),
        unidad: r.unidad || "u"
      }));
    } else {
      // Valores estándar del catálogo si no hay detalle explícito
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

      remanenteBase = [
        {
          presentacion_id: 1,
          nombre_producto: "Papel Higiénico Blanquita Clásico 4 rollos",
          cantidad_remanente: 8.0,
          unidad: "paquetes"
        },
        {
          presentacion_id: 2,
          nombre_producto: "Papel Higiénico Blanquita Doble Hoja 4 rollos",
          cantidad_remanente: 4.0,
          unidad: "paquetes"
        }
      ];
    }

    setItemsEditables(itemsBase);
    setStockRemanente(remanenteBase);
    setObservacionAprobacion(solicitud?.observacion_admin || "Carga física y stock de camión verificados por supervisor");
  }, [abierto, solicitud, asignacion]);

  const handleActualizarCantidadAprobada = (index, nuevaCantidad) => {
    const val = Math.max(0, parseFloat(nuevaCantidad) || 0);
    setItemsEditables((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], cantidad_aprobada: val };
      return copia;
    });
  };

  const handleAprobar = async () => {
    if (!idAsignacion) {
      toast.error("No se encontró el ID de asignación para aprobar la carga");
      return;
    }

    try {
      setAprobando(true);
      const itemsPayload = itemsEditables.map((item) => ({
        presentacion_id: Number(item.presentacion_id),
        cantidad_aprobada: Number(item.cantidad_aprobada)
      }));

      await AprobarCargaCamion(idAsignacion, {
        items: itemsPayload,
        items_aprobados: itemsPayload,
        observacion: observacionAprobacion || "Carga física y stock de camión verificados por supervisor",
        usar_remanente: true
      });

      toast.success("¡Stock de camión aprobado! Ruta habilitada para reparto en app móvil");
      if (alAprobar) {
        alAprobar(idAsignacion);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Error al aprobar carga de camión");
    } finally {
      setAprobando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sky-100 text-[#1C96C5] rounded">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-800">
                  Bandeja de Solicitud de Carga de Camión
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  {rutaNombre} • Chofer: <strong className="text-slate-700">{choferNombre}</strong>
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-[11px]">
              Pendiente de Aprobación
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* 1. Stock Remanente del Chofer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                Stock Remanente en Camión (Jornada anterior)
              </span>
              <span className="text-[11px] text-slate-400">Verificado en vehículo</span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                  <tr>
                    <th className="py-1.5 px-3 font-semibold">Producto</th>
                    <th className="py-1.5 px-3 font-semibold text-right">Cantidad Remanente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {stockRemanente.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-2.5 text-center text-slate-400 text-xs">
                        Sin remanente previo (camión vacío al inicio).
                      </td>
                    </tr>
                  ) : (
                    stockRemanente.map((rem, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-medium">
                          {rem.nombre_producto || `Presentación #${rem.presentacion_id}`}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5">
                <PackageCheck className="h-3.5 w-3.5 text-[#1C96C5]" />
                Productos Solicitados (Permite ajustar cantidades antes de aprobar)
              </span>
              <span className="text-[11px] text-[#1C96C5] font-bold">
                {itemsEditables.reduce((acc, curr) => acc + Number(curr.cantidad_aprobada || 0), 0)} unidades a cargar
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-sky-50 border-b border-sky-100 text-sky-900 text-[11px]">
                  <tr>
                    <th className="py-1.5 px-3 font-semibold">Producto</th>
                    <th className="py-1.5 px-3 font-semibold text-right">Solicitado</th>
                    <th className="py-1.5 px-3 font-semibold text-center w-36">Cant. a Aprobar</th>
                    <th className="py-1.5 px-3 font-semibold text-right">Stock Final Camión</th>
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
                        <td className="py-2 px-3 font-medium">
                          {item.nombre_producto || `Presentación #${item.presentacion_id}`}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500 font-mono">
                          {item.cantidad_solicitada} {item.unidad || "u"}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
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
                        <td className="py-2 px-3 text-right font-extrabold text-emerald-700 font-mono">
                          {stockFinal} {item.unidad || "u"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observación opcional de supervisión */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600">
              Observación de Inspección de Carga:
            </label>
            <Input
              type="text"
              value={observacionAprobacion}
              onChange={(e) => setObservacionAprobacion(e.target.value)}
              placeholder="Ej: Verificado por almacenero de turno y estiba conforme en camión..."
              className="h-8 text-xs text-slate-700"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cerrar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAprobar}
            disabled={aprobando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{aprobando ? "Aprobando..." : "Aprobar Stock y Habilitar Ruta en App Móvil"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
