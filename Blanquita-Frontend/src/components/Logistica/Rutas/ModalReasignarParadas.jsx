import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserCheck, ArrowRight, Truck, CheckSquare, Square, Store, MapPin, X } from "lucide-react";
import BuscadorSelect from "../Common/BuscadorSelect";
import { ReasignarParadasPendientes } from "@/services/Logistica/RutaService";

export default function ModalReasignarParadas({
  abierto,
  onOpenChange,
  asignacion = null,
  repartidores = [],
  alCompletar = null
}) {
  const [choferDestinoId, setChoferDestinoId] = useState("");
  const [paradasSeleccionadas, setParadasSeleccionadas] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // Filtrar paradas pendientes (que no hayan sido entregadas)
  const paradasPendientes = useMemo(() => {
    if (!asignacion) return [];
    const lista = asignacion.Paradas || asignacion.PuntosVenta || [];
    return lista.filter((p) => {
      const estado = (p.Estado || p.estado || "").toUpperCase();
      return estado !== "ENTREGADO" && estado !== "COBRADO" && !p.Entregado && !p.Cobrado;
    });
  }, [asignacion]);

  // Inicializar selección con todas las pendientes
  React.useEffect(() => {
    if (abierto && paradasPendientes.length > 0) {
      setParadasSeleccionadas(paradasPendientes.map((p) => p.IdPuntoVenta || p.id_punto_venta));
    }
  }, [abierto, paradasPendientes]);

  const opcionesRepartidoresDestino = useMemo(() => {
    const choferOrigenId = asignacion?.IdUsuarioRepartidor;
    return (repartidores || [])
      .filter((r) => String(r.IdUsuario) !== String(choferOrigenId))
      .map((r) => ({
        value: String(r.IdUsuario),
        label: r.NombreCompleto,
        sublabel: `CI: ${r.Ci || "-"} ${r.Celular ? `• Tel: ${r.Celular}` : ""}`,
        icon: <UserCheck className="h-4 w-4" />
      }));
  }, [repartidores, asignacion]);

  const toggleParada = (idPv) => {
    setParadasSeleccionadas((prev) =>
      prev.includes(idPv) ? prev.filter((id) => id !== idPv) : [...prev, idPv]
    );
  };

  const toggleTodas = () => {
    if (paradasSeleccionadas.length === paradasPendientes.length) {
      setParadasSeleccionadas([]);
    } else {
      setParadasSeleccionadas(paradasPendientes.map((p) => p.IdPuntoVenta || p.id_punto_venta));
    }
  };

  const handleReasignar = async () => {
    if (!choferDestinoId) {
      toast.error("Selecciona el chofer de destino");
      return;
    }
    if (paradasSeleccionadas.length === 0) {
      toast.error("Selecciona al menos una parada pendiente");
      return;
    }

    try {
      setGuardando(true);
      await ReasignarParadasPendientes(
        asignacion.IdAsignacionRuta,
        Number(choferDestinoId),
        paradasSeleccionadas
      );
      toast.success(
        `Se reasignaron ${paradasSeleccionadas.length} paradas pendientes al nuevo chofer correctamente`
      );
      if (alCompletar) alCompletar();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Error al reasignar paradas");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header Impecable (DESIGN.md) */}
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-sky-100 text-[#1C96C5] shrink-0">
              <Users className="h-5 w-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-slate-800 leading-tight">
                Reasignar Paradas Pendientes a Otro Chofer
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Ruta: <span className="font-semibold text-slate-700">{asignacion?.NombreRuta || "Ruta actual"}</span> • Chofer: <span className="text-slate-700">{asignacion?.NombreRepartidor || "Asignado"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 text-xs px-2.5 py-1 font-semibold">
              {paradasPendientes.length} pendientes
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

        {/* Body Impecable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs bg-slate-50/40">
          {/* Tarjeta de origen */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Ruta y Chofer Origen</span>
              <span className="font-bold text-slate-800 text-xs">
                {asignacion?.NombreRuta || "Ruta actual"}
              </span>
              <span className="text-slate-500 block text-[11px] mt-0.5">
                Chofer actual: <strong className="text-slate-700">{asignacion?.NombreRepartidor}</strong>
              </span>
            </div>
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50">
              {paradasPendientes.length} paradas sin entregar
            </Badge>
          </div>

          {/* Selección de Chofer Destino */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-[#1C96C5] shrink-0" />
              <span>Chofer Destino Receptor:</span>
            </label>
            <BuscadorSelect
              opciones={opcionesRepartidoresDestino}
              value={choferDestinoId}
              onChange={setChoferDestinoId}
              placeholder="Seleccionar chofer que recibirá las paradas..."
            />
          </div>

          {/* Lista de paradas a reasignar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Paradas Pendientes a Transferir:</span>
              <button
                type="button"
                onClick={toggleTodas}
                className="text-[11px] text-[#1C96C5] hover:underline font-medium cursor-pointer"
              >
                {paradasSeleccionadas.length === paradasPendientes.length
                  ? "Deseleccionar todas"
                  : "Seleccionar todas"}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-white shadow-2xs">
              {paradasPendientes.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  No hay paradas pendientes para transferir en esta ruta.
                </div>
              ) : (
                paradasPendientes.map((parada, idx) => {
                  const idPv = parada.IdPuntoVenta || parada.id_punto_venta;
                  const seleccionado = paradasSeleccionadas.includes(idPv);

                  return (
                    <div
                      key={idPv || idx}
                      onClick={() => toggleParada(idPv)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all border ${
                        seleccionado
                          ? "bg-sky-50 border-sky-300 text-slate-800"
                          : "bg-white border-transparent text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {seleccionado ? (
                        <CheckSquare className="h-4 w-4 text-[#1C96C5] shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate text-xs">
                          {parada.NombreCliente || parada.RazonSocial || `Parada #${idx + 1}`}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {parada.Direccion || "Sin dirección"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Impecable */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4 flex flex-wrap items-center justify-end gap-3">
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
            onClick={handleReasignar}
            disabled={guardando || paradasSeleccionadas.length === 0 || !choferDestinoId}
            className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-semibold gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            <span>{guardando ? "Reasignando..." : `Reasignar (${paradasSeleccionadas.length})`}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
