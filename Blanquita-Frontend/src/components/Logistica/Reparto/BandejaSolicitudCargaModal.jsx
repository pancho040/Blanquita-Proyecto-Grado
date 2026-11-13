import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Boxes,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  PackageCheck,
  ShieldCheck,
  RotateCcw
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

  const idAsignacion = asignacion?.IdAsignacionRuta || solicitud?.id_asignacion || solicitud?.IdAsignacionRuta;
  const choferNombre = asignacion?.NombreRepartidor || solicitud?.chofer_nombre || "Chofer";
  const rutaNombre = asignacion?.NombreRuta || solicitud?.ruta_nombre || "Ruta de Distribución";

  // Items solicitados hoy
  const itemsSolicitados = solicitud?.items || solicitud?.Items || [
    {
      presentacion_id: 1,
      nombre_producto: "Papel Higiénico Blanquita Clásico 4 rollos",
      cantidad_solicitada: 50.0,
      unidad: "paquetes"
    },
    {
      presentacion_id: 2,
      nombre_producto: "Papel Higiénico Blanquita Doble Hoja 4 rollos",
      cantidad_solicitada: 30.0,
      unidad: "paquetes"
    },
    {
      presentacion_id: 3,
      nombre_producto: "Servilleta Blanquita 100u",
      cantidad_solicitada: 20.0,
      unidad: "fardos"
    }
  ];

  // Stock remanente en el camión
  const stockRemanente = solicitud?.stock_remanente || solicitud?.remanente || [
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

  const handleAprobar = async () => {
    if (!idAsignacion) {
      toast.error("No se encontró el ID de asignación para aprobar la carga");
      return;
    }

    try {
      setAprobando(true);
      await AprobarCargaCamion(idAsignacion, {
        observacion: observacionAprobacion || "Carga física y stock de camión verificados por supervisor",
        usar_remanente: true
      });

      toast.success("¡Stock de camión aprobado! Ruta habilitada para reparto");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sky-100 text-[#1C96C5] rounded">
                <Boxes className="h-5 w-5" />
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

          {/* 2. Productos que solicita cargar hoy */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-700 font-semibold">
              <span className="flex items-center gap-1.5">
                <PackageCheck className="h-3.5 w-3.5 text-[#1C96C5]" />
                Productos Solicitados para Cargar Hoy
              </span>
              <span className="text-[11px] text-[#1C96C5] font-bold">
                {itemsSolicitados.reduce((acc, curr) => acc + Number(curr.cantidad_solicitada || 0), 0)} unidades totales
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-sky-50 border-b border-sky-100 text-sky-900 text-[11px]">
                  <tr>
                    <th className="py-1.5 px-3 font-semibold">Producto</th>
                    <th className="py-1.5 px-3 font-semibold text-right">Cantidad Solicitada</th>
                    <th className="py-1.5 px-3 font-semibold text-right">Stock Final Previsto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {itemsSolicitados.map((item, idx) => {
                    const remanenteMatch = stockRemanente.find(
                      (r) => Number(r.presentacion_id) === Number(item.presentacion_id)
                    );
                    const cantRemanente = Number(remanenteMatch?.cantidad_remanente || 0);
                    const cantSolicitada = Number(item.cantidad_solicitada || 0);
                    const stockFinal = cantRemanente + cantSolicitada;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-medium">
                          {item.nombre_producto || `Presentación #${item.presentacion_id}`}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#1C96C5]">
                          +{cantSolicitada} {item.unidad || "u"}
                        </td>
                        <td className="py-2 px-3 text-right font-extrabold text-emerald-700">
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
              Observación de Inspección de Carga (Opcional):
            </label>
            <input
              type="text"
              value={observacionAprobacion}
              onChange={(e) => setObservacionAprobacion(e.target.value)}
              placeholder="Ej: Verificado por almacenero de turno y conforme en estiba..."
              className="w-full h-8 px-2.5 rounded border border-slate-200 text-xs text-slate-700"
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
            <span>{aprobando ? "Aprobando..." : "Aprobar Stock y Habilitar Ruta"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
