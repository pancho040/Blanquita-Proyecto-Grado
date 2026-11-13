import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ListOrdered,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  ArrowRightLeft,
  Calendar,
  Store,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Route,
  X
} from "lucide-react";
import BuscadorSelect from "../Common/BuscadorSelect";
import { 
  GuardarPuntosVentaRuta, 
  ObtenerRutas, 
  InsertarParadaOrden, 
  QuitarParadaRuta, 
  MoverParadaRuta, 
  RecalcularOrdenParadas 
} from "@/services/Logistica/RutaService";

export default function EditorParadasDinamicoModal({
  abierto,
  onOpenChange,
  asignacion = null,
  ruta = null,
  todosPuntosVenta = [],
  sucursal = null,
  alGuardar = null
}) {
  const [paradas, setParadas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [paradaParaMover, setParadaParaMover] = useState(null);
  const [modalMoverAbierto, setModalMoverAbierto] = useState(false);
  const [rutaDestinoId, setRutaDestinoId] = useState("");
  const [rutasDisponibles, setRutasDisponibles] = useState([]);

  // Selector para agregar nueva parada
  const [puntoSeleccionado, setPuntoSeleccionado] = useState("");
  const [posicionInsertar, setPosicionInsertar] = useState(1);

  // Inicializar paradas cada vez que se abre el modal con una ruta o asignación
  useEffect(() => {
    if (!abierto) return;

    let initialParadas = [];
    if (asignacion?.Paradas && Array.isArray(asignacion.Paradas)) {
      initialParadas = asignacion.Paradas;
    } else if (ruta?.PuntosVenta && Array.isArray(ruta.PuntosVenta)) {
      initialParadas = ruta.PuntosVenta;
    } else if (asignacion?.PuntosVenta && Array.isArray(asignacion.PuntosVenta)) {
      initialParadas = asignacion.PuntosVenta;
    }

    // Normalizar paradas asegurando OrdenVisita 1..N
    const normalizadas = initialParadas.map((p, idx) => ({
      ...p,
      IdPuntoVenta: p.IdPuntoVenta || p.id_punto_venta || p.idPuntoVenta,
      NombreCliente: p.NombreCliente || p.nombre_cliente || p.Cliente || "Comercio",
      NombrePuntoVenta: p.NombrePuntoVenta || p.nombre_punto_venta || "",
      Direccion: p.Direccion || p.direccion || "",
      OrdenVisita: idx + 1,
      // Si ya fue entregada o cobrada hoy
      estado: p.Estado || p.estado || (p.Entregado ? "ENTREGADO" : "PENDIENTE"),
      esEjecutada: Boolean(
        p.Entregado ||
        p.Cobrado ||
        p.estado === "ENTREGADO" ||
        p.estado === "COBRADO" ||
        p.Estado === "Entregado" ||
        p.Estado === "Cobrado" ||
        p.FechaHoraEntrega
      )
    }));

    setParadas(normalizadas);
    setPosicionInsertar(normalizadas.length + 1);

    // Cargar rutas disponibles para opción de mover parada
    ObtenerRutas(null, sucursal).then((res) => {
      const lista = Array.isArray(res) ? res : [];
      setRutasDisponibles(lista);
      if (lista.length > 0) {
        setRutaDestinoId(String(lista[0].IdRutaDistribucion));
      }
    }).catch(() => {});
  }, [abierto, asignacion, ruta, sucursal]);

  // Puntos de venta disponibles no incluidos en la ruta
  const opcionesPuntosVentaDisponibles = useMemo(() => {
    const idsActuales = new Set(paradas.map((p) => p.IdPuntoVenta));
    return (todosPuntosVenta || [])
      .filter((pv) => !idsActuales.has(pv.IdPuntoVenta))
      .map((pv) => ({
        value: String(pv.IdPuntoVenta),
        label: pv.NombreCliente || pv.RazonSocial || "Cliente",
        sublabel: `${pv.NombrePuntoVenta || ""} • ${pv.Direccion || "Sin dirección"}`,
        icon: <Store className="h-4 w-4" />
      }));
  }, [todosPuntosVenta, paradas]);

  const opcionesRutasSelect = useMemo(() => {
    const idActual = ruta?.IdRutaDistribucion || asignacion?.IdRutaDistribucion;
    return rutasDisponibles
      .filter((r) => String(r.IdRutaDistribucion) !== String(idActual))
      .map((r) => ({
        value: String(r.IdRutaDistribucion),
        label: r.NombreRuta,
        sublabel: `Zona: ${r.NombreZona || "General"}`,
        icon: <Route className="h-4 w-4" />
      }));
  }, [rutasDisponibles, ruta, asignacion]);

  // Reordenar 1..N
  const reordenarCompacto = (lista) => {
    return lista.map((item, idx) => ({
      ...item,
      OrdenVisita: idx + 1
    }));
  };

  const moverParada = (index, direccion) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= paradas.length) return;

    const copia = [...paradas];
    const temp = copia[index];
    copia[index] = copia[nuevoIndex];
    copia[nuevoIndex] = temp;

    const reordenadas = reordenarCompacto(copia);
    setParadas(reordenadas);
    setPosicionInsertar(reordenadas.length + 1);
  };

  const agregarParadaEnPosicion = async () => {
    if (!puntoSeleccionado) {
      toast.error("Selecciona un comercio o punto de venta");
      return;
    }

    const pvObj = todosPuntosVenta.find((p) => String(p.IdPuntoVenta) === String(puntoSeleccionado));
    if (!pvObj) return;

    const idRuta = ruta?.IdRutaDistribucion || asignacion?.IdRutaDistribucion;
    if (idRuta) {
      try {
        await InsertarParadaOrden(idRuta, pvObj.IdPuntoVenta, posicionInsertar);
        toast.success(`Parada #${posicionInsertar} insertada en base de datos; desplazando siguientes +1`);
      } catch (err) {
        toast.error(err.message || "Error al insertar parada en el servidor");
        return;
      }
    }

    const nuevaParada = {
      IdPuntoVenta: pvObj.IdPuntoVenta,
      NombreCliente: pvObj.NombreCliente || pvObj.RazonSocial,
      NombrePuntoVenta: pvObj.NombrePuntoVenta || "",
      Direccion: pvObj.Direccion || "",
      Latitud: pvObj.Latitud,
      Longitud: pvObj.Longitud,
      OrdenVisita: posicionInsertar,
      estado: "PENDIENTE",
      esEjecutada: false
    };

    const copia = [...paradas];
    const idxInsert = Math.max(0, Math.min(posicionInsertar - 1, copia.length));
    copia.splice(idxInsert, 0, nuevaParada);

    const reordenadas = reordenarCompacto(copia);
    setParadas(reordenadas);
    setPuntoSeleccionado("");
    setPosicionInsertar(reordenadas.length + 1);

    if (alGuardar) {
      alGuardar(reordenadas);
    }
  };

  const eliminarParada = async (index) => {
    const objetivo = paradas[index];
    if (objetivo.esEjecutada) {
      toast.error("Regla inquebrantable: Prohibido eliminar una parada ya ejecutada o cobrada hoy");
      return;
    }

    const idRuta = ruta?.IdRutaDistribucion || asignacion?.IdRutaDistribucion;
    if (idRuta) {
      try {
        await QuitarParadaRuta(idRuta, objetivo.IdPuntoVenta);
        toast.info("Parada quitada y secuencia 1..N compactada en base de datos");
      } catch (err) {
        toast.error(err.message || "Error al quitar parada en servidor");
        return;
      }
    }

    const filtradas = paradas.filter((_, idx) => idx !== index);
    const reordenadas = reordenarCompacto(filtradas);
    setParadas(reordenadas);
    setPosicionInsertar(reordenadas.length + 1);

    if (alGuardar) {
      alGuardar(reordenadas);
    }
  };

  const abrirModalMover = (parada) => {
    if (parada.esEjecutada) {
      toast.error("Parada ya ejecutada hoy: no se puede mover o cambiar de ruta");
      return;
    }
    setParadaParaMover(parada);
    setModalMoverAbierto(true);
  };

  const confirmarMoverParada = async () => {
    if (!paradaParaMover || !rutaDestinoId) return;

    const idRutaOrigen = ruta?.IdRutaDistribucion || asignacion?.IdRutaDistribucion;
    if (idRutaOrigen) {
      try {
        await MoverParadaRuta(paradaParaMover.IdPuntoVenta, idRutaOrigen, rutaDestinoId);
        toast.success("Cliente trasladado a la ruta destino. Orden 1..N recalculado en ambas rutas");
      } catch (err) {
        toast.error(err.message || "Error al mover cliente de ruta");
        return;
      }
    }

    // Remover de la lista local de la ruta actual
    const filtradas = paradas.filter((p) => p.IdPuntoVenta !== paradaParaMover.IdPuntoVenta);
    const reordenadas = reordenarCompacto(filtradas);
    setParadas(reordenadas);
    setModalMoverAbierto(false);

    if (alGuardar) {
      alGuardar(reordenadas);
    }
  };

  const handleRecalcularOrden = async () => {
    const idRuta = ruta?.IdRutaDistribucion || asignacion?.IdRutaDistribucion;
    if (!idRuta) return;
    try {
      setGuardando(true);
      const res = await RecalcularOrdenParadas(idRuta);
      if (Array.isArray(res) && res.length > 0) {
        setParadas(res.map((p, idx) => ({ ...p, OrdenVisita: idx + 1 })));
      }
      toast.success("Secuencia vial 1..N compactada sin huecos");
    } catch (err) {
      toast.error(err.message || "Error al recalcular paradas");
    } finally {
      setGuardando(false);
    }
  };

  const guardarCambios = async () => {
    const idRuta = ruta?.IdRutaDistribucion || asignacion?.IdRutaDistribucion;
    if (!idRuta) {
      toast.error("No se identificó el identificador de la ruta");
      return;
    }

    try {
      setGuardando(true);
      const payload = paradas.map((p) => ({
        IdPuntoVenta: p.IdPuntoVenta,
        OrdenVisita: p.OrdenVisita
      }));

      await GuardarPuntosVentaRuta(idRuta, payload);
      toast.success("¡Itinerario 1..N actualizado y guardado correctamente!");

      if (alGuardar) {
        alGuardar(paradas);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Error al guardar el nuevo orden de paradas");
    } finally {
      setGuardando(false);
    }
  };

  const nombreRutaDisplay = ruta?.NombreRuta || asignacion?.NombreRuta || "Ruta de Distribución";

  return (
    <>
      <Dialog open={abierto} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header Impecable (DESIGN.md) */}
          <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-sky-100 text-[#1C96C5] shrink-0">
                <ListOrdered className="h-5 w-5 shrink-0" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-slate-800 leading-tight">
                  Editor Dinámico de Paradas (1..{paradas.length})
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Secuencia vial para: <span className="font-semibold text-slate-700">{nombreRutaDisplay}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="outline" className="text-xs border-sky-300 text-sky-800 bg-sky-50 font-semibold px-2.5 py-1">
                {paradas.length} paradas configuradas
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

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Formulario de agregar parada en posición específica */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-[#1C96C5]" />
                <span>Agregar parada en posición específica</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <div className="md:col-span-8">
                  <BuscadorSelect
                    opciones={opcionesPuntosVentaDisponibles}
                    value={puntoSeleccionado}
                    onChange={setPuntoSeleccionado}
                    placeholder="Buscar cliente para agregar..."
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-1">
                  <span className="text-[11px] text-slate-500 font-medium">Pos:</span>
                  <select
                    value={posicionInsertar}
                    onChange={(e) => setPosicionInsertar(Number(e.target.value))}
                    className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-xs font-semibold"
                  >
                    {Array.from({ length: paradas.length + 1 }, (_, i) => i + 1).map((pos) => (
                      <option key={pos} value={pos}>
                        #{pos}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={agregarParadaEnPosicion}
                    className="w-full h-9 bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-semibold rounded"
                  >
                    Insertar
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista ordenada de paradas 1..N */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                <span>Orden y Cliente</span>
                <span>Acciones / Estado</span>
              </div>

              {paradas.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded">
                  No hay paradas asignadas a esta ruta. Agrega un punto arriba.
                </div>
              ) : (
                paradas.map((parada, index) => {
                  const esEjecutada = parada.esEjecutada;

                  return (
                    <div
                      key={`${parada.IdPuntoVenta}-${index}`}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        esEjecutada
                          ? "bg-slate-50 border-slate-200/80"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Indicador de orden 1..N */}
                        <div
                          className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs ${
                            esEjecutada
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          #{parada.OrdenVisita}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {parada.NombreCliente}
                            </span>
                            {parada.NombrePuntoVenta && (
                              <span className="text-[11px] text-slate-500 truncate">
                                • {parada.NombrePuntoVenta}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{parada.Direccion || "Sin dirección exacta"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Estado y Controles */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {esEjecutada ? (
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0.5 px-2 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{parada.estado || "Ejecutada hoy"}</span>
                            </Badge>

                            {/* Botones Bloqueados con Candado */}
                            <div
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-400 border border-slate-200 text-[11px] font-medium"
                              title="Parada ya ejecutada hoy: prohibido eliminar o mover"
                            >
                              <Lock className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-[10px]">Bloqueada</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Reordenar arriba / abajo */}
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moverParada(index, -1)}
                                className="p-1.5 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Mover arriba"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === paradas.length - 1}
                                onClick={() => moverParada(index, 1)}
                                className="p-1.5 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Mover abajo"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Mover a otra ruta / día */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => abrirModalMover(parada)}
                              className="h-7 px-2 text-[11px] border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 rounded"
                              title="Mover cliente a otra ruta"
                            >
                              <ArrowRightLeft className="h-3 w-3 text-slate-500" />
                              <span>Mover</span>
                            </Button>

                            {/* Eliminar parada */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => eliminarParada(index)}
                              className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 rounded"
                              title="Eliminar parada"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRecalcularOrden}
              disabled={guardando}
              className="text-xs text-slate-700 border-slate-300 gap-1.5"
              title="Compactar la secuencia vial 1..N sin huecos"
            >
              <ListOrdered className="h-3.5 w-3.5 text-[#1C96C5] shrink-0" />
              <span>Compactar 1..N</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={guardarCambios}
                disabled={guardando}
                className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-semibold gap-1.5"
              >
                <Save className="h-3.5 w-3.5 shrink-0" />
                <span>{guardando ? "Guardando..." : "Guardar Itinerario 1..N"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Secundario: Mover Parada a Otra Ruta */}
      <Dialog open={modalMoverAbierto} onOpenChange={setModalMoverAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <ArrowRightLeft className="h-4 w-4 text-[#1C96C5]" />
              <span>Mover Comercio a Otra Ruta</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-700">{paradaParaMover?.NombreCliente}</div>
              <div className="text-slate-500">{paradaParaMover?.Direccion}</div>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700">Ruta Destino:</label>
              <BuscadorSelect
                opciones={opcionesRutasSelect}
                value={rutaDestinoId}
                onChange={setRutaDestinoId}
                placeholder="Seleccionar ruta destino..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalMoverAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmarMoverParada}
              className="bg-[#1C96C5] hover:bg-[#157A9E] text-white"
            >
              Confirmar Traslado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
