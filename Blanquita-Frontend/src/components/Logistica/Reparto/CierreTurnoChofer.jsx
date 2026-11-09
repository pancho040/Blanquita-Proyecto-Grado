import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, DollarSign, Package, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ListarInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import { CierreTurnoChofer } from "@/services/Contabilidad/cuentasCobrarService";

export default function CierreTurnoChoferComponent({ usuario }) {
  const [stockCamion, setStockCamion] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [devolucionFisica, setDevolucionFisica] = useState({});
  const [efectivoEntregado, setEfectivoEntregado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [resultadoCierre, setResultadoCierre] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const choferId = usuario?.IdUsuario || 4;
  const sucursalId = 1;

  useEffect(() => {
    cargarStock();
  }, []);

  const cargarStock = async () => {
    try {
      setCargando(true);
      const res = await ListarInventarioChofer(choferId);
      setStockCamion(res || []);
      const initDev = {};
      (res || []).forEach(item => {
        initDev[item.presentacion_id] = Number(item.cantidad_remanente) || 0;
      });
      setDevolucionFisica(initDev);
    } catch (err) {
      toast.error("Error al cargar inventario del camión");
    } finally {
      setCargando(false);
    }
  };

  const handleDevolucionChange = (presId, val) => {
    setDevolucionFisica({
      ...devolucionFisica,
      [presId]: Number(val) || 0
    });
  };

  const handleCerrarTurno = async (e) => {
    e.preventDefault();
    try {
      setEnviando(true);
      const payload = {
        IdUsuarioRepartidor: choferId,
        IdSucursal: sucursalId,
        StockDevueltoFisico: devolucionFisica,
        MontoEfectivoEntregado: Number(efectivoEntregado || 0),
        Observaciones: observaciones
      };

      const res = await CierreTurnoChofer(payload);
      setResultadoCierre(res);
      toast.success("Cierre de turno diario procesado exitosamente");
    } catch (err) {
      toast.error("Error al procesar cierre de turno: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <div className="p-8 text-center text-slate-500">Cargando datos de jornada...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-6 h-6 text-sky-400" /> Cierre Diario de Turno y Rendición
            </h1>
            <p className="text-xs text-slate-400 mt-1">Liquidación física de existencias y arqueo de valores</p>
          </div>
          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30">Cierre de Jornada</Badge>
        </div>
      </div>

      {!resultadoCierre ? (
        <form onSubmit={handleCerrarTurno} className="bg-white rounded-2xl border p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              1. Conteo Físico de Retorno al Almacén
            </h2>
            <div className="border rounded-xl overflow-hidden divide-y text-xs">
              <div className="bg-slate-100 p-3 font-semibold grid grid-cols-12 text-slate-700">
                <span className="col-span-5">Producto / Presentación</span>
                <span className="col-span-2 text-center">Cargado</span>
                <span className="col-span-2 text-center">Vendido</span>
                <span className="col-span-3 text-center font-bold text-sky-800">Físico Devuelto</span>
              </div>
              {stockCamion.map((stk) => (
                <div key={stk.presentacion_id} className="p-3 grid grid-cols-12 items-center hover:bg-slate-50">
                  <span className="col-span-5 font-medium text-slate-800">{stk.producto_nombre}</span>
                  <span className="col-span-2 text-center text-slate-500">{stk.cantidad_cargada}</span>
                  <span className="col-span-2 text-center text-emerald-600 font-semibold">{stk.cantidad_vendida}</span>
                  <div className="col-span-3 flex justify-center">
                    <Input
                      type="number"
                      min="0"
                      value={devolucionFisica[stk.presentacion_id] ?? stk.cantidad_remanente}
                      onChange={(e) => handleDevolucionChange(stk.presentacion_id, e.target.value)}
                      className="w-24 text-center font-bold text-sky-700 h-8"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              2. Entrega y Rendición de Efectivo
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Monto Efectivo Entregado (Bs.)</label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="0.00"
                  value={efectivoEntregado}
                  onChange={(e) => setEfectivoEntregado(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Observaciones de Jornada</label>
                <Input
                  placeholder="Mermas en ruta, pinchaduras, etc."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-md"
          >
            {enviando ? "Liquidando Turno..." : "Procesar y Liquidar Turno"}
          </Button>
        </form>
      ) : (
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-6">
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
            resultadoCierre.EstadoConciliacion === "CONCILIADO"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            {resultadoCierre.EstadoConciliacion === "CONCILIADO" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <p className="font-bold text-sm">Estado del Cierre: {resultadoCierre.EstadoConciliacion}</p>
              <p className="text-xs mt-0.5">
                {resultadoCierre.EstadoConciliacion === "CONCILIADO"
                  ? "Cuadre exacto de existencias y valores sin discrepancias."
                  : `Se liquidaron faltantes físicos imputables por un total de Bs. ${resultadoCierre.MontoTotalFaltante.toFixed(2)}.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border">
              <span className="text-xs text-slate-500 font-medium">Total Ventas Bs.</span>
              <p className="text-base font-bold text-slate-800 mt-1">Bs. {resultadoCierre.TotalVentasBs.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border">
              <span className="text-xs text-slate-500 font-medium">Efectivo Entregado</span>
              <p className="text-base font-bold text-slate-800 mt-1">Bs. {resultadoCierre.MontoEfectivoEntregado.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
              <span className="text-xs text-red-600 font-medium">Faltante Imputable</span>
              <p className="text-base font-bold text-red-700 mt-1">Bs. {resultadoCierre.MontoTotalFaltante.toFixed(2)}</p>
            </div>
          </div>

          <Button onClick={() => setResultadoCierre(null)} variant="outline" className="w-full">
            Realizar Nuevo Cierre
          </Button>
        </div>
      )}
    </div>
  );
}
