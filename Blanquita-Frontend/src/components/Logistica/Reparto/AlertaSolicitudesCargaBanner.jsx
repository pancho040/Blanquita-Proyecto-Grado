import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Truck, ArrowRight, Boxes, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListarSolicitudesCarga } from "@/services/Logistica/RutaService";
import BandejaSolicitudCargaModal from "./BandejaSolicitudCargaModal";
import { useLogisticaEventos } from "@/services/Logistica/LogisticaSSEClient";

export default function AlertaSolicitudesCargaBanner({ sucursal = null, onAprobado = null }) {
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const consultarPendientes = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      const data = await ListarSolicitudesCarga(null, "PENDIENTE", { signal: ac.signal }).catch(() => []);
      if (!ac.signal.aborted) {
        const lista = Array.isArray(data) ? data : data?.items || [];
        setSolicitudesPendientes(lista);
      }
    } catch {
      if (!ac.signal.aborted) {
        setSolicitudesPendientes([]);
      }
    }
  }, []);

  const consultarPendientesDebounced = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      consultarPendientes();
    }, 250);
  }, [consultarPendientes]);

  useLogisticaEventos({
    tipos: [
      "solicitud_carga_recibida",
      "solicitud_carga_creada",
      "carga_camion_aprobada",
      "carga_camion_observada",
      "carga_camion_rechazada",
      "CARGA_APROBADA",
      "SOLICITUD_CARGA",
    ],
    onEvento: consultarPendientesDebounced,
  });

  useEffect(() => {
    consultarPendientes();

    const handleSseEvent = (e) => {
      const { tipo } = e.detail || {};
      if (tipo && (tipo.includes("carga") || tipo.includes("ruta") || tipo.includes("CARGA"))) {
        consultarPendientesDebounced();
      }
    };

    const handleCargaActualizada = (e) => {
      const { idAsignacion } = e.detail || {};
      if (idAsignacion) {
        setSolicitudesPendientes((prev) =>
          prev.filter(
            (s) =>
              Number(s.id_asignacion || s.id_asignacion_ruta || s.IdAsignacionRuta) !== Number(idAsignacion)
          )
        );
      }
      consultarPendientesDebounced();
    };

    window.addEventListener("blanquita:sse-event", handleSseEvent);
    window.addEventListener("blanquita:carga-actualizada", handleCargaActualizada);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      window.removeEventListener("blanquita:sse-event", handleSseEvent);
      window.removeEventListener("blanquita:carga-actualizada", handleCargaActualizada);
    };
  }, [consultarPendientes, consultarPendientesDebounced]);

  // Ordenar con prioridad según la sucursal activa en la página
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
  const sedeTexto = esPotosi ? "Potosí" : "Sucre";

  const handleAbrirRevision = (sol) => {
    setSolicitudSeleccionada(sol);
    setModalAbierto(true);
  };

  const handleAprobadoExitoso = (idAsig) => {
    setSolicitudesPendientes((prev) =>
      prev.filter(
        (s) =>
          Number(s.id_asignacion || s.id_asignacion_ruta || s.IdAsignacionRuta) !== Number(idAsig)
      )
    );
    consultarPendientesDebounced();
    if (onAprobado) {
      onAprobado(idAsig);
    }
  };

  return (
    <>
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-amber-500 text-white rounded-lg shrink-0">
            <Truck className="h-4 w-4 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-amber-950">
                Solicitud de carga pendiente
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium px-1.5 py-0 border ${
                  esPotosi
                    ? "border-purple-300 text-purple-800 bg-purple-50"
                    : "border-sky-300 text-sky-800 bg-sky-50"
                }`}
              >
                <Building2 className="h-3 w-3 mr-1 shrink-0 inline" />
                {sedeTexto}
              </Badge>
              {totalPendientes > 1 && (
                <span className="text-xs text-amber-700">
                  (+{totalPendientes - 1} pendientes más)
                </span>
              )}
            </div>
            <p className="text-xs text-amber-900 truncate mt-0.5">
              <strong className="font-semibold text-amber-950">{nombreChofer}</strong> solicitó carga para la ruta <strong className="font-semibold text-slate-800">{nombreRuta}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => handleAbrirRevision(solicitudPrincipal)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 h-8 gap-1.5 shadow-2xs"
          >
            <Boxes className="h-3.5 w-3.5 shrink-0" />
            <span>Revisar carga</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
          </Button>
        </div>
      </div>

      <BandejaSolicitudCargaModal
        abierto={modalAbierto}
        onOpenChange={setModalAbierto}
        solicitud={solicitudSeleccionada}
        alAprobar={handleAprobadoExitoso}
        alResolver={() => consultarPendientesDebounced()}
      />
    </>
  );
}
