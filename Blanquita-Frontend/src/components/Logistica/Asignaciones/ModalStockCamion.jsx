import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Boxes, Truck, Loader2, X, RefreshCw } from "lucide-react";
import { ListarInventarioChofer } from "@/services/Logistica/InventarioComercialService";

export default function ModalStockCamion({
  abierto,
  onOpenChange,
  idChofer,
  nombreChofer,
  asignacion
}) {
  const [stock, setStock] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargarStock = async () => {
    if (!idChofer) return;
    try {
      setCargando(true);
      const data = await ListarInventarioChofer(idChofer).catch(() => []);
      const lista = Array.isArray(data) ? data : [];
      setStock(lista);
    } catch {
      setStock([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto && idChofer) {
      cargarStock();
    }
  }, [abierto, idChofer]);

  const totalRemanente = stock.reduce(
    (acc, it) => acc + Number(it.cantidad_remanente ?? it.cantidad ?? 0),
    0
  );

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-xl w-full p-0 overflow-hidden">
        <div className="shrink-0 flex items-start justify-between border-b border-slate-200 px-5 py-3.5 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 text-[#1C96C5] rounded-lg">
              <Boxes className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-800">
                Inventario a bordo del camión
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Chofer: <strong className="text-slate-700">{nombreChofer || `Chofer #${idChofer}`}</strong>
                {asignacion?.NombreRuta ? ` · ${asignacion.NombreRuta}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cargarStock}
              disabled={cargando}
              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
              title="Recargar inventario"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs bg-slate-50/50">
          <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
            <span className="font-semibold text-slate-700">Stock total a bordo:</span>
            <Badge variant="outline" className="text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-300">
              {totalRemanente} unidades disponibles
            </Badge>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Producto / Presentación</th>
                  <th className="py-2.5 px-2 font-semibold text-center w-20">Cargado</th>
                  <th className="py-2.5 px-2 font-semibold text-center w-20">Vendido</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-24">En camión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {cargando ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#1C96C5] mb-1" />
                      Consultando inventario en camión...
                    </td>
                  </tr>
                ) : stock.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                      Sin productos registrados a bordo del vehículo.
                    </td>
                  </tr>
                ) : (
                  stock.map((item, idx) => {
                    const cargado = Number(item.cantidad_cargada || 0);
                    const vendido = Number(item.cantidad_vendida || 0);
                    const remanente = Number(item.cantidad_remanente ?? item.cantidad ?? (cargado - vendido));
                    const unidad = item.tipo_contenedor || item.unidad || "u";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-medium">
                          {item.nombre_producto || `Presentación #${item.presentacion_id}`}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 font-mono">
                          {cargado}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 font-mono">
                          {vendido}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                          {remanente} {unidad}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs text-slate-600"
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
