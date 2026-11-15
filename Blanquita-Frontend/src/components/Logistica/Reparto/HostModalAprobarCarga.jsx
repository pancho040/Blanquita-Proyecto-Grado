import React, { useState, useEffect } from "react";
import BandejaSolicitudCargaModal from "./BandejaSolicitudCargaModal";
import {
  suscribirAprobacionCarga,
  cerrarAprobarCarga,
  abrirAprobarCarga,
} from "@/stores/aprobacionCargaStore";
import { ObtenerSolicitudCarga, ListarSolicitudesCarga } from "@/services/Logistica/RutaService";

export default function HostModalAprobarCarga() {
  const [modalState, setModalState] = useState({
    abierto: false,
    idSolicitud: null,
    idAsignacion: null,
    solicitud: null,
    asignacion: null,
  });
  const [solicitudCargada, setSolicitudCargada] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // 1. Suscribirse al store reactivo de aprobación de carga
  useEffect(() => {
    const unsub = suscribirAprobacionCarga((nuevoEstado) => {
      setModalState(nuevoEstado);
      if (nuevoEstado.solicitud) {
        setSolicitudCargada(nuevoEstado.solicitud);
      }
    });
    return unsub;
  }, []);

  // 2. Soporte para Deep Link (?solicitud=<id> o ?aprobar_carga=<id>)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const idSol = urlParams.get("solicitud") || urlParams.get("aprobar_carga") || urlParams.get("id_solicitud");
      const idAsig = urlParams.get("asignacion") || urlParams.get("id_asignacion");
      if (idSol || idAsig) {
        abrirAprobarCarga({
          idSolicitud: idSol ? Number(idSol) : null,
          idAsignacion: idAsig ? Number(idAsig) : null,
        });
      }
    } catch (_e) {
      // Ignorar error al parsear search params
    }
  }, []);

  // 3. Si se abre el modal y solo se tiene el ID de la solicitud o asignación, buscar el detalle
  useEffect(() => {
    if (!modalState.abierto) {
      setCargandoDetalle(false);
      return;
    }

    // Si ya tenemos la solicitud con detalles, no hace falta fetch
    if (modalState.solicitud?.detalles || modalState.solicitud?.items) {
      setSolicitudCargada(modalState.solicitud);
      return;
    }

    let cancelado = false;
    const cargarDatos = async () => {
      try {
        setCargandoDetalle(true);
        if (modalState.idSolicitud) {
          const res = await ObtenerSolicitudCarga(modalState.idSolicitud);
          if (!cancelado && res) {
            setSolicitudCargada(res.datos || res);
            return;
          }
        }

        // Si tenemos idAsignacion pero no idSolicitud, buscar solicitudes de esa asignación
        if (modalState.idAsignacion) {
          const listado = await ListarSolicitudesCarga(modalState.idAsignacion);
          const items = Array.isArray(listado?.datos) ? listado.datos : Array.isArray(listado) ? listado : [];
          const solPendiente = items.find((s) => s.estado === "PENDIENTE" || s.estado === "OBSERVADA") || items[0];
          if (!cancelado && solPendiente) {
            setSolicitudCargada(solPendiente);
            return;
          }
        }
      } catch (err) {
        console.warn("[HostModalAprobarCarga] No se pudo obtener detalle de solicitud:", err.message);
      } finally {
        if (!cancelado) {
          setCargandoDetalle(false);
        }
      }
    };

    cargarDatos();

    return () => {
      cancelado = true;
    };
  }, [modalState.abierto, modalState.idSolicitud, modalState.idAsignacion, modalState.solicitud]);

  const handleOpenChange = (abierto) => {
    if (!abierto) {
      cerrarAprobarCarga();
    }
  };

  const handleAprobarOResolver = (idAsignacion, decision) => {
    cerrarAprobarCarga();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("blanquita:carga-actualizada", {
          detail: { idAsignacion, decision },
        })
      );
    }
  };

  if (!modalState.abierto) {
    return null;
  }

  const solicitudParaModal = solicitudCargada || modalState.solicitud || {
    id_solicitud: modalState.idSolicitud,
    id_asignacion: modalState.idAsignacion,
  };

  return (
    <BandejaSolicitudCargaModal
      abierto={modalState.abierto}
      onOpenChange={handleOpenChange}
      solicitud={solicitudParaModal}
      asignacion={modalState.asignacion}
      alAprobar={(id) => handleAprobarOResolver(id, "APROBADA")}
      alResolver={(id, dec) => handleAprobarOResolver(id, dec)}
    />
  );
}
