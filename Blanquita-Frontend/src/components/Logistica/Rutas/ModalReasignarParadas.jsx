import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserCheck, ArrowRight, Truck, CheckSquare, Square, Store, MapPin } from "lucide-react";
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-[#1C96C5]" />
            <span>Reasignar Paradas Pendientes a Otro Chofer</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs">
          {/* Tarjeta de origen */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold block uppercase">Ruta Origen</span>
              <span className="font-bold text-slate-800 text-xs">
                {asignacion?.NombreRuta || "Ruta actual"}
              </span>
              <span className="text-slate-500 block text-[11px]">
                Chofer actual: <strong className="text-slate-700">{asignacion?.NombreRepartidor}</strong>
              </span>
            </div>
            <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50">
              {paradasPendientes.length} pendientes
            </Badge>
          </div>

          {/* Selección de Chofer Destino */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Chofer Destino Receptor:</label>
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
                className="text-[11px] text-[#1C96C5] hover:underline font-medium"
              >
                {paradasSeleccionadas.length === paradasPendientes.length
                  ? "Deseleccionar todas"
                  : "Seleccionar todas"}
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 border border-slate-200 rounded p-1.5 bg-white">
              {paradasPendientes.length === 0 ? (
                <div className="py-4 text-center text-slate-400">
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
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all border ${
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
                        <div className="font-semibold truncate">
                          {parada.NombreCliente || parada.RazonSocial || `Parada #${idx + 1}`}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
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

        <DialogFooter className="gap-2">
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
            <ArrowRight className="h-3.5 w-3.5" />
            <span>{guardando ? "Reasignando..." : `Reasignar (${paradasSeleccionadas.length})`}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
