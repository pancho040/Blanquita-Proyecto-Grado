import React, { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Package, 
  Clock, 
  ArrowRight,
  UserCheck,
  Loader2,
  X,
  Truck,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ListarInventarioChofer } from "@/services/Logistica/InventarioComercialService";
import { CierreTurnoChofer } from "@/services/Contabilidad/cuentasCobrarService";
import { ObtenerRepartidores } from "@/services/Logistica/RutaService";

export default function CierreTurnoChoferComponent({ 
  usuario, 
  choferPreseleccionado = null,
  enModal = false,
  alCompletar = null,
  onCerrar = null
}) {
  const [stockCamion, setStockCamion] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoStock, setCargandoStock] = useState(false);
  const [devolucionFisica, setDevolucionFisica] = useState({});
  const [efectivoEntregado, setEfectivoEntregado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [resultadoCierre, setResultadoCierre] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const esChofer = Number(usuario?.IdRol) === 6;
  const [choferId, setChoferId] = useState(() => {
    if (choferPreseleccionado) return Number(choferPreseleccionado);
    if (esChofer && usuario?.IdUsuario) return Number(usuario.IdUsuario);
    return null;
  });

  const sucursalId = 1;

  useEffect(() => {
    cargarCatalogosYChoferes();
  }, []);

  const cargarCatalogosYChoferes = async () => {
    try {
      setCargando(true);
      const reps = await ObtenerRepartidores().catch(() => []);
      setRepartidores(reps || []);

      let idInicial = choferPreseleccionado ? Number(choferPreseleccionado) : null;
      if (!idInicial && esChofer && usuario?.IdUsuario) {
        idInicial = Number(usuario.IdUsuario);
      }
      if (!idInicial && reps && reps.length > 0) {
        idInicial = Number(reps[0].IdUsuario);
      }
      if (!idInicial) {
        idInicial = 9;
      }
      setChoferId(idInicial);

      if (idInicial) {
        await cargarStock(idInicial);
      }
    } catch (err) {
      toast.error("Error al cargar lista de repartidores");
    } finally {
      setCargando(false);
    }
  };

  const cargarStock = async (cid) => {
    try {
      setCargandoStock(true);
      const res = await ListarInventarioChofer(cid).catch(() => []);
      setStockCamion(res || []);
      const initDev = {};
      (res || []).forEach((item) => {
        initDev[item.presentacion_id] = Number(item.cantidad_remanente) || 0;
      });
      setDevolucionFisica(initDev);
    } catch (err) {
      toast.error("Error al cargar inventario del camión");
    } finally {
      setCargandoStock(false);
    }
  };

  const handleCambioChofer = async (nuevoId) => {
    const numId = Number(nuevoId);
    setChoferId(numId);
    setResultadoCierre(null);
    await cargarStock(numId);
  };

  const handleDevolucionChange = (presId, val) => {
    setDevolucionFisica({
      ...devolucionFisica,
      [presId]: val === "" ? "" : Number(val)
    });
  };

  const choferActualNombre = useMemo(() => {
    const c = repartidores.find((r) => Number(r.IdUsuario) === Number(choferId));
    if (c) return c.NombreCompleto;
    if (esChofer && usuario?.NombreCompleto) return usuario.NombreCompleto;
    return "Chofer Asignado";
  }, [repartidores, choferId, esChofer, usuario]);

  const handleCerrarTurno = async (e) => {
    e.preventDefault();
    if (!choferId) {
      toast.error("Seleccione el chofer que rinde cuentas");
      return;
    }

    try {
      setEnviando(true);
      const payload = {
        IdUsuarioRepartidor: Number(choferId),
        IdSucursal: sucursalId,
        StockDevueltoFisico: Object.fromEntries(
          Object.entries(devolucionFisica).map(([k, v]) => [k, Number(v) || 0])
        ),
        MontoEfectivoEntregado: Number(efectivoEntregado || 0),
        Observaciones: observaciones || `Cierre liquidado por supervisor (${usuario?.NombreCompleto || "Admin"})`
      };

      const res = await CierreTurnoChofer(payload);
      setResultadoCierre(res);
      toast.success("Cierre de turno diario procesado exitosamente");
      if (alCompletar) {
        alCompletar(res);
      }
    } catch (err) {
      toast.error("Error al procesar cierre de turno: " + (err.message || "Error en el servidor"));
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
        <p className="text-xs font-medium">Cargando datos de jornada y repartidores...</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto space-y-5 ${enModal ? "max-w-full p-1" : "max-w-3xl p-4"}`}>
      {/* Cabecera Principal */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-400" /> Cierre Diario de Turno y Rendición
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Liquidación física de existencias en camión, retorno al almacén y arqueo de valores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs font-normal">
            Jornada de Reparto
          </Badge>
          {onCerrar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCerrar}
              className="text-white hover:bg-white/20 h-7 w-7 p-0 rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {!resultadoCierre ? (
        <form onSubmit={handleCerrarTurno} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-6">
          {/* Selector de Chofer */}
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="w-full sm:w-1/2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-1">
                Chofer a Liquidar
              </label>
              {esChofer ? (
                <div className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-sky-600" />
                  <span>{usuario?.NombreCompleto || "Chofer"}</span>
                </div>
              ) : (
                <select
                  value={choferId || ""}
                  onChange={(e) => handleCambioChofer(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-medium"
                  required
                >
                  {repartidores.map((r) => (
                    <option key={r.IdUsuario} value={r.IdUsuario}>
                      {r.NombreCompleto} {r.Ci ? `(CI: ${r.Ci})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              {cargandoStock ? (
                <span className="text-sky-600 flex items-center gap-1 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando camión...
                </span>
              ) : (
                <span className="bg-slate-200/60 px-2.5 py-1 rounded-md text-slate-700">
                  Total Presentaciones en Camión: <strong>{stockCamion.length}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Sección 1: Conteo Físico de Retorno al Almacén */}
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-sky-600" /> 1. Conteo Físico de Retorno al Almacén
            </h2>

            {stockCamion.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 text-center">
                El repartidor <strong>{choferActualNombre}</strong> no registra carga remanente en su furgón/camión.
                Si realizó cobros de notas de venta previas, ingrese el importe a rendir a continuación.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                <div className="bg-slate-100/80 p-2.5 font-semibold grid grid-cols-12 text-slate-700 uppercase tracking-wider text-[11px]">
                  <span className="col-span-5">Producto / Presentación</span>
                  <span className="col-span-2 text-center">Cargado</span>
                  <span className="col-span-2 text-center text-emerald-700">Vendido</span>
                  <span className="col-span-3 text-center font-bold text-sky-900">Físico Devuelto</span>
                </div>
                {stockCamion.map((stk) => {
                  const presId = stk.presentacion_id;
                  const devuelto = devolucionFisica[presId] ?? stk.cantidad_remanente;
                  const faltante = Math.max(0, Number(stk.cantidad_remanente) - Number(devuelto || 0));

                  return (
                    <div key={presId} className="p-2.5 grid grid-cols-12 items-center hover:bg-slate-50/80">
                      <div className="col-span-5 pr-2">
                        <span className="font-semibold text-slate-800 block">
                          {stk.nombre_producto || stk.producto_nombre || "Producto"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {stk.tipo_contenedor || stk.codigo_presentacion || ""} • Remanente teórico: {stk.cantidad_remanente}
                        </span>
                      </div>
                      <span className="col-span-2 text-center text-slate-600 font-medium">{stk.cantidad_cargada}</span>
                      <span className="col-span-2 text-center text-emerald-600 font-bold">{stk.cantidad_vendida}</span>
                      <div className="col-span-3 flex flex-col items-center">
                        <Input
                          type="number"
                          min="0"
                          value={devuelto}
                          onChange={(e) => handleDevolucionChange(presId, e.target.value)}
                          className="w-24 text-center font-bold text-sky-700 h-8 text-xs bg-white"
                          required
                        />
                        {faltante > 0 && (
                          <span className="text-[10px] text-red-600 font-semibold mt-0.5">
                            Faltante: {faltante} u.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sección 2: Entrega y Rendición de Efectivo */}
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" /> 2. Entrega y Rendición de Efectivo en Caja
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Monto Efectivo Entregado (Bs.)
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0.00"
                  value={efectivoEntregado}
                  onChange={(e) => setEfectivoEntregado(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Observaciones de Cierre / Mermas
                </label>
                <Input
                  placeholder="Sin novedades, empaques dañados, etc."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-xs gap-2"
          >
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Liquidando Turno y Verificando Arqueo...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Procesar y Liquidar Turno Diario</span>
              </>
            )}
          </Button>
        </form>
      ) : (
        /* Pantalla de Confirmación y Resultados del Cierre */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              resultadoCierre.EstadoConciliacion === "CONCILIADO"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {resultadoCierre.EstadoConciliacion === "CONCILIADO" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm">Estado del Cierre: {resultadoCierre.EstadoConciliacion}</p>
              <p className="text-xs mt-1">
                {resultadoCierre.EstadoConciliacion === "CONCILIADO"
                  ? "Conciliación perfecta. Las existencias devueltas coinciden con el inventario y los valores fueron rendidos satisfactoriamente."
                  : `Se liquidaron faltantes físicos o de caja imputables por un total de Bs. ${Number(resultadoCierre.MontoTotalFaltante || 0).toFixed(2)}.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-xs text-slate-500 font-medium">Total Ventas Registradas</span>
              <p className="text-base font-bold text-slate-800 mt-1">
                Bs. {Number(resultadoCierre.TotalVentasBs || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
              <span className="text-xs text-emerald-700 font-medium">Efectivo Rendido en Caja</span>
              <p className="text-base font-bold text-emerald-800 mt-1">
                Bs. {Number(resultadoCierre.MontoEfectivoEntregado || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
              <span className="text-xs text-red-600 font-medium">Faltante Imputable</span>
              <p className="text-base font-bold text-red-700 mt-1">
                Bs. {Number(resultadoCierre.MontoTotalFaltante || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setResultadoCierre(null);
                setEfectivoEntregado("");
                setObservaciones("");
                if (choferId) cargarStock(choferId);
              }}
              variant="outline"
              className="flex-1 gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Realizar Otro Cierre
            </Button>
            {onCerrar && (
              <Button type="button" onClick={onCerrar} className="flex-1 bg-slate-800 text-white">
                Finalizar y Salir
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
