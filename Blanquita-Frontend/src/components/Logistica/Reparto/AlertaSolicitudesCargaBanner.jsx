import React, { useState, useEffect, useCallback } from "react";
import { Truck, AlertTriangle, ArrowRight, CheckCircle2, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListarSolicitudesCarga } from "@/services/Logistica/RutaService";
import BandejaSolicitudCargaModal from "./BandejaSolicitudCargaModal";
import { logisticaSocket } from "@/services/Logistica/LogisticaWebSocket";

export default function AlertaSolicitudesCargaBanner({ sucursal = null, onAprobado = null }) {
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const consultarPendientes = useCallback(async () => {
    try {
      const data = await ListarSolicitudesCarga(null, "PENDIENTE").catch(() => []);
      const lista = Array.isArray(data) ? data : data?.items || [];
      setSolicitudesPendientes(lista);
    } catch {
      setSolicitudesPendientes([]);
    }
  }, []);

  useEffect(() => {
    consultarPendientes();

    logisticaSocket.conectar();
    const unsubCarga = logisticaSocket.suscribir("solicitud_carga_recibida", () => {
      consultarPendientes();
    });

    const handleWsEvent = (e) => {
      const { tipo } = e.detail || {};
      if (
        tipo === "solicitud_carga_recibida" ||
        tipo === "carga_camion_aprobada" ||
        tipo === "operacion_ruta_registrada"
      ) {
        consultarPendientes();
      }
    };
    window.addEventListener("blanquita:ws-event", handleWsEvent);

    return () => {
      unsubCarga();
      window.removeEventListener("blanquita:ws-event", handleWsEvent);
    };
  }, [consultarPendientes]);

  if (!solicitudesPendientes || solicitudesPendientes.length === 0) {
    return null;
  }

  const solicitudPrincipal = solicitudesPendientes[0];
  const nombreChofer = solicitudPrincipal.nombre_chofer || "Un chofer";
  const nombreRuta = solicitudPrincipal.nombre_ruta || `Ruta #${solicitudPrincipal.id_asignacion_ruta || "Asignada"}`;
  const totalPendientes = solicitudesPendientes.length;

  const handleAbrirRevision = (sol) => {
    setSolicitudSeleccionada(sol);
    setModalAbierto(true);
  };

  const handleAprobadoExitoso = (idAsig) => {
    consultarPendientes();
    if (onAprobado) {
      onAprobado(idAsig);
    }
  };

  return (
    <>
      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 text-amber-900 shadow-sm animate-pulse-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-amber-500 text-white rounded-md shrink-0 shadow-xs">
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                Solicitud de Stock en Camión
              </span>
              {totalPendientes > 1 && (
                <span className="text-xs font-bold text-amber-700">
                  (+{totalPendientes - 1} pendientes más)
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-amber-950 truncate mt-0.5">
              🚚 El chofer <strong className="underline decoration-amber-500">{nombreChofer}</strong> solicitó aprobación de carga de inventario para iniciar la <strong className="text-slate-900">{nombreRuta}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => handleAbrirRevision(solicitudPrincipal)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 h-8 gap-1.5 shadow-xs"
          >
            <Boxes className="h-4 w-4" />
            <span>Revisar y Aprobar Carga</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <BandejaSolicitudCargaModal
        abierto={modalAbierto}
        onOpenChange={setModalAbierto}
        solicitud={solicitudSeleccionada}
        alAprobar={handleAprobadoExitoso}
      />
    </>
  );
}
