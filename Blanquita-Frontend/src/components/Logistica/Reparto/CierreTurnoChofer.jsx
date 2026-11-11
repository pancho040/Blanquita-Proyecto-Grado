import React, { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Package, 
  Clock, 
  UserCheck, 
  Loader2, 
  X, 
  Truck, 
  RotateCcw,
  Printer,
  FileText,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const imprimirActa = () => {
    window.print();
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-[#1C96C5]" />
        <p className="text-xs font-medium">Cargando datos de jornada y repartidores...</p>
      </div>
    );
  }

  const hoyFormateado = new Date().toLocaleDateString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <div className={`space-y-4 ${enModal ? "p-1" : "w-full max-w-4xl mx-auto"}`}>
      {/* Cabecera Sólida Industrial */}
      <div className="bg-white border border-slate-200 rounded p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-800 shrink-0 mt-0.5">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                Cierre Diario de Turno & Rendición
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-50 border-slate-200 text-slate-700">
                Liquidación Oficial
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Conteo físico de existencias devueltas a bodega, reintegro al almacén y arqueo de caja.
            </p>
          </div>
        </div>

        {onCerrar && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCerrar}
            className="h-8 px-2.5 text-xs rounded border-slate-200 text-slate-600 hover:text-slate-900"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cerrar
          </Button>
        )}
      </div>

      {!resultadoCierre ? (
        <form onSubmit={handleCerrarTurno} className="bg-white border border-slate-200 rounded p-4 space-y-4">
          {/* PASO 1: Selección de Repartidor & Estado del Camión */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="w-full sm:w-1/2">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Paso 1: Chofer a Liquidar
              </label>
              {esChofer ? (
                <div className="h-8 text-xs font-medium text-slate-800 bg-white border border-slate-300 px-2.5 rounded flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-[#1C96C5]" />
                  <span>{usuario?.NombreCompleto || "Chofer"}</span>
                </div>
              ) : (
                <select
                  value={choferId || ""}
                  onChange={(e) => handleCambioChofer(e.target.value)}
                  className="w-full h-8 text-xs rounded border border-slate-300 bg-white px-2 text-slate-800 focus:border-slate-900 focus:outline-none"
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

            <div className="text-xs text-slate-600 flex items-center gap-2">
              {cargandoStock ? (
                <span className="text-[#1C96C5] flex items-center gap-1 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando carga...
                </span>
              ) : (
                <span className="bg-white border border-slate-200 px-2.5 py-1 rounded text-slate-700 font-mono text-[11px]">
                  Presentaciones en Camión: <strong className="text-slate-900">{stockCamion.length}</strong>
                </span>
              )}
            </div>
          </div>

          {/* PASO 2: Conteo Físico de Retorno al Almacén */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-500" />
                Paso 2: Conteo Físico de Retorno a Bodega
              </span>
              <span className="text-[11px] text-slate-500">
                Verifica las unidades descargadas físicamente del vehículo.
              </span>
            </div>

            {stockCamion.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600">
                El repartidor <strong>{choferActualNombre}</strong> no registra existencias pendientes en su vehículo.
                Si cobró notas de venta en ruta, ingrese el efectivo a rendir en el Paso 3.
              </div>
            ) : (
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Producto / Presentación</th>
                      <th className="px-3 py-2 text-center w-24">Cargado</th>
                      <th className="px-3 py-2 text-center w-24">Vendido</th>
                      <th className="px-3 py-2 text-center w-24">Teórico</th>
                      <th className="px-3 py-2 text-center w-32">Físico Devuelto</th>
                      <th className="px-3 py-2 text-center w-28">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockCamion.map((stk) => {
                      const presId = stk.presentacion_id;
                      const devuelto = devolucionFisica[presId] ?? stk.cantidad_remanente;
                      const remanenteTeorico = Number(stk.cantidad_remanente) || 0;
                      const devueltoNum = Number(devuelto || 0);
                      const faltante = Math.max(0, remanenteTeorico - devueltoNum);
                      const sobrante = Math.max(0, devueltoNum - remanenteTeorico);

                      return (
                        <tr key={presId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2">
                            <span className="font-semibold text-slate-900 block">
                              {stk.nombre_producto || stk.producto_nombre || "Producto"}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {stk.tipo_contenedor || stk.codigo_presentacion || "Presentación"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums text-slate-700">
                            {stk.cantidad_cargada}
                          </td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums text-emerald-700 font-semibold">
                            {stk.cantidad_vendida}
                          </td>
                          <td className="px-3 py-2 text-center font-mono tabular-nums text-slate-900 font-bold">
                            {remanenteTeorico}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Input
                              type="number"
                              min="0"
                              value={devuelto}
                              onChange={(e) => handleDevolucionChange(presId, e.target.value)}
                              className="w-20 mx-auto text-center font-mono tabular-nums font-bold text-slate-900 h-8 text-xs bg-white rounded border-slate-300"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {faltante > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-50 text-red-700 border border-red-200">
                                -{faltante} u. (Faltante)
                              </span>
                            ) : sobrante > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                +{sobrante} u. (Sobrante)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Exacto (0)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PASO 3: Rendición de Efectivo y Cobros en Caja */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Paso 3: Rendición de Valores en Caja
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded p-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Monto Efectivo Entregado en Caja (Bs.) *
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0.00"
                  value={efectivoEntregado}
                  onChange={(e) => setEfectivoEntregado(e.target.value)}
                  className="h-8 text-xs font-mono tabular-nums text-right bg-white rounded border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Observaciones de Cierre / Reporte de Mermas
                </label>
                <Input
                  placeholder="Sin novedades, empaques dañados, etc."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="h-8 text-xs bg-white rounded border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Botón de Envío */}
          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium h-9 text-xs rounded shadow-xs flex items-center justify-center gap-2 transition-colors"
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
        /* PANTALLA OFICIAL: ACTA DE CIERRE DIARIO Y ARQUEO */
        <div className="bg-white border border-slate-200 rounded p-6 space-y-6">
          {/* Encabezado del Acta */}
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-800" />
                <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
                  Acta Oficial de Cierre Diario & Rendición de Reparto
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Papelera Blanquita — Sucursal Sucre • Fecha: {hoyFormateado}
              </p>
            </div>
            <div className="no-print flex items-center gap-2">
              <Button
                type="button"
                onClick={imprimirActa}
                variant="outline"
                size="sm"
                className="h-8 text-xs px-3 rounded border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" /> Imprimir Acta
              </Button>
            </div>
          </div>

          {/* Estado de Conciliación */}
          <div
            className={`p-3.5 rounded border flex items-start gap-3 ${
              resultadoCierre.EstadoConciliacion === "CONCILIADO"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            {resultadoCierre.EstadoConciliacion === "CONCILIADO" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wider">
                  Estado de Conciliación:
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border bg-white border-current">
                  {resultadoCierre.EstadoConciliacion}
                </span>
              </div>
              <p className="text-xs mt-1">
                {resultadoCierre.EstadoConciliacion === "CONCILIADO"
                  ? "Las existencias devueltas coinciden plenamente con el saldo de camión y los valores en efectivo fueron rendidos a satisfacción."
                  : `Se registraron faltantes físicos o descuadres de caja por un importe total imputable de Bs. ${Number(resultadoCierre.MontoTotalFaltante || 0).toFixed(2)}.`}
              </p>
            </div>
          </div>

          {/* Tarjetas Métricas de Arqueo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-center">
              <span className="text-[11px] text-slate-600 font-medium uppercase tracking-wider block">
                Total Ventas Registradas
              </span>
              <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1">
                Bs. {Number(resultadoCierre.TotalVentasBs || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded border border-emerald-200 text-center">
              <span className="text-[11px] text-emerald-700 font-medium uppercase tracking-wider block">
                Efectivo Rendido en Caja
              </span>
              <p className="text-base font-bold font-mono tabular-nums text-emerald-800 mt-1">
                Bs. {Number(resultadoCierre.MontoEfectivoEntregado || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded border border-red-200 text-center">
              <span className="text-[11px] text-red-700 font-medium uppercase tracking-wider block">
                Faltante Imputable
              </span>
              <p className="text-base font-bold font-mono tabular-nums text-red-700 mt-1">
                Bs. {Number(resultadoCierre.MontoTotalFaltante || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Firmas de Conformidad del Acta para Impresión */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
            <div className="space-y-1">
              <div className="border-b border-slate-300 w-48 mx-auto h-12" />
              <p className="font-semibold text-slate-900">{choferActualNombre}</p>
              <p className="text-[11px] text-slate-500">Chofer Repartidor Responsable</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-300 w-48 mx-auto h-12" />
              <p className="font-semibold text-slate-900">{usuario?.NombreCompleto || "Administrador / Supervisor"}</p>
              <p className="text-[11px] text-slate-500">Supervisor de Distribución / Caja</p>
            </div>
          </div>

          {/* Acciones Finales */}
          <div className="no-print flex gap-2 pt-2">
            <Button
              type="button"
              onClick={() => {
                setResultadoCierre(null);
                setEfectivoEntregado("");
                setObservaciones("");
                if (choferId) cargarStock(choferId);
              }}
              variant="outline"
              className="flex-1 h-8 text-xs rounded border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Realizar Otro Cierre
            </Button>
            {onCerrar && (
              <Button 
                type="button" 
                onClick={onCerrar} 
                className="flex-1 h-8 text-xs rounded bg-slate-900 hover:bg-slate-800 text-white"
              >
                Finalizar y Salir
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
