import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Truck, ArrowRight, Boxes, Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Reactividad WebSocket Instantánea (Cero F5)
  useEffect(() => {
    consultarPendientes();

    logisticaSocket.conectar();
    const unsubCarga1 = logisticaSocket.suscribir("solicitud_carga_recibida", () => {
      consultarPendientes();
    });
    const unsubCarga2 = logisticaSocket.suscribir("solicitud_carga_creada", () => {
      consultarPendientes();
    });
    const unsubCarga3 = logisticaSocket.suscribir("carga_camion_aprobada", () => {
      consultarPendientes();
    });
    const unsubCarga4 = logisticaSocket.suscribir("carga_camion_observada", () => {
      consultarPendientes();
    });
    const unsubCarga5 = logisticaSocket.suscribir("carga_camion_rechazada", () => {
      consultarPendientes();
    });

    const handleWsEvent = (e) => {
      const { tipo } = e.detail || {};
      if (
        !tipo ||
        tipo.includes("carga") ||
        tipo.includes("operacion") ||
        tipo.includes("ruta")
      ) {
        consultarPendientes();
      }
    };
    window.addEventListener("blanquita:ws-event", handleWsEvent);

    return () => {
      unsubCarga1();
      unsubCarga2();
      unsubCarga3();
      unsubCarga4();
      unsubCarga5();
      window.removeEventListener("blanquita:ws-event", handleWsEvent);
    };
  }, [consultarPendientes]);

  // Ordenar con prioridad según la sucursal activa en la página
  // Potosí: id_sucursal == 2; Sucre: id_sucursal == 1
  const solicitudesOrdenadas = useMemo(() => {
    if (!solicitudesPendientes || solicitudesPendientes.length === 0) return [];

    const idSucursalActiva =
      sucursal === "2" || sucursal === 2 ? 2 : (sucursal === "1" || sucursal === 1 ? 1 : null);

    return [...solicitudesPendientes].sort((a, b) => {
      const sucursalA = Number(a.id_sucursal || a.IdSucursal || (String(a.nombre_ruta || "").toLowerCase().includes("potos") ? 2 : 1));
      const sucursalB = Number(b.id_sucursal || b.IdSucursal || (String(b.nombre_ruta || "").toLowerCase().includes("potos") ? 2 : 1));

      if (idSucursalActiva) {
        if (sucursalA === idSucursalActiva && sucursalB !== idSucursalActiva) return -1;
        if (sucursalB === idSucursalActiva && sucursalA !== idSucursalActiva) return 1;
      }
      return 0;
    });
  }, [solicitudesPendientes, sucursal]);

  if (!solicitudesOrdenadas || solicitudesOrdenadas.length === 0) {
    return null;
  }

  const solicitudPrincipal = solicitudesOrdenadas[0];
  const nombreChofer = solicitudPrincipal.nombre_chofer || solicitudPrincipal.chofer_nombre || "Un chofer";
  const nombreRuta = solicitudPrincipal.nombre_ruta || solicitudPrincipal.ruta_nombre || `Ruta #${solicitudPrincipal.id_asignacion_ruta || "Asignada"}`;
  const totalPendientes = solicitudesOrdenadas.length;

  const sucursalPrincipal = Number(
    solicitudPrincipal.id_sucursal ||
    solicitudPrincipal.IdSucursal ||
    (String(solicitudPrincipal.nombre_ruta || "").toLowerCase().includes("potos") ? 2 : 1)
  );
  const esPotosi = sucursalPrincipal === 2;
  const sedeTexto = esPotosi ? "POTOSÍ" : "SUCRE";

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
      <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 text-amber-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 shadow-xs">
            <Truck className="h-5 w-5 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md">
                Solicitud de Stock en Camión
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-extrabold px-1.5 py-0.5 border ${
                  esPotosi
                    ? "border-purple-400 text-purple-900 bg-purple-100"
                    : "border-sky-400 text-sky-900 bg-sky-100"
                }`}
              >
                <Building2 className="h-3 w-3 mr-1 shrink-0 inline" />
                [{sedeTexto}]
              </Badge>
              {totalPendientes > 1 && (
                <span className="text-xs font-bold text-amber-800">
                  (+{totalPendientes - 1} pendientes más)
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-amber-950 truncate mt-1">
              El chofer <strong className="underline decoration-amber-500">{nombreChofer}</strong> solicitó aprobación de carga de inventario para iniciar la <strong className="text-slate-900">{nombreRuta}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => handleAbrirRevision(solicitudPrincipal)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-1.5 h-8 gap-1.5 shadow-xs"
          >
            <Boxes className="h-4 w-4 shrink-0" />
            <span>Revisar y Resolver Carga</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </div>
      </div>

      <BandejaSolicitudCargaModal
        abierto={modalAbierto}
        onOpenChange={setModalAbierto}
        solicitud={solicitudSeleccionada}
        alAprobar={handleAprobadoExitoso}
        alResolver={() => consultarPendientes()}
      />
    </>
  );
}
