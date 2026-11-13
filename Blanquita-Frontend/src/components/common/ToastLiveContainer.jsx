import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Truck,
  CheckCircle2,
  MapPin,
  RefreshCw,
  QrCode,
  DollarSign,
  AlertCircle,
  X,
  ExternalLink,
  Radio,
  Clock,
  ShieldAlert,
  User,
} from "lucide-react";
import { logisticaSocket } from "@/services/Logistica/LogisticaWebSocket";
import { useBranch } from "@/stores/branchStore";

// Sonido sutil y elegante de notificación web sintetizado con Web Audio API (Cero dependencias)
function reproducirChimeNotificacion() {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Re 5 (D5)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // La 5 (A5)

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Si el navegador bloquea audio sin interacción previa, ignorar silenciosamente
  }
}

export default function ToastLiveContainer({ basePath = "supervisor", esAdmin = false }) {
  const { sucursalActiva, sucursalAsignada, puedeVerTodas } = useBranch();
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);
  toastsRef.current = toasts;

  const removerToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const extraerSedeEvento = useCallback((datos = {}) => {
    const rawSede =
      datos.id_sucursal ??
      datos.IdSucursal ??
      datos.idSucursal ??
      datos.sucursal_id ??
      datos.payload?.id_sucursal ??
      datos.payload?.IdSucursal ??
      datos.payload?.idSucursal;

    if (rawSede != null && rawSede !== "" && rawSede !== "todas") {
      return Number(rawSede);
    }
    return null;
  }, []);

  const agregarToast = useCallback(
    (datosToast) => {
      const sedeEvento = extraerSedeEvento(datosToast);

      // Aislamiento estricto: usuario de sede fija SOLO ve eventos de su sede
      if (!puedeVerTodas) {
        const miSede = sucursalAsignada ? Number(sucursalAsignada) : null;
        if (miSede != null && sedeEvento != null && sedeEvento !== miSede) {
          return;
        }
      }

      const id = datosToast.id || `toast-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const nuevo = {
        id,
        hora: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        creadoEn: Date.now(),
        idSucursal: sedeEvento,
        ...datosToast,
      };

      reproducirChimeNotificacion();

      setToasts((prev) => {
        // Mantener máximo 5 toasts simultáneos para no saturar pantalla
        const filtrados = prev.slice(-4);
        return [...filtrados, nuevo];
      });

      // Notificar a la campana de notificaciones de NavBar
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("blanquita:notificacion-nueva", {
            detail: nuevo,
          })
        );
      }

      // Auto-eliminar a los 7.5 segundos
      setTimeout(() => {
        removerToast(id);
      }, 7500);
    },
    [removerToast, puedeVerTodas, sucursalAsignada, extraerSedeEvento]
  );

  // Conexión permanente a WebSocket y escucha de eventos de logística
  useEffect(() => {
    // Conecta automáticamente al montar
    logisticaSocket.conectar();

    // 1. Solicitud de Carga de Camión
    const unsubCarga1 = logisticaSocket.suscribir("solicitud_carga_recibida", (datos = {}) => {
      const chofer = datos.nombre_chofer || datos.chofer || (datos.id_chofer ? `Chofer #${datos.id_chofer}` : "Chofer en planta");
      agregarToast({
        tipo: "solicitud_carga",
        titulo: "Solicitud de Carga de Camión",
        nombreChofer: chofer,
        detalle: datos.mensaje || `Solicitó validación de stock para salir a reparto (${datos.items_count || 1} ítems).`,
        accionUrl: esAdmin ? "/admin/asignaciones" : "/supervisor/asignaciones",
        accionTexto: "Ver y Aprobar Stock",
        color: "amber",
        icono: Truck,
        payload: datos,
      });
    });

    const unsubCarga2 = logisticaSocket.suscribir("solicitud_carga_creada", (datos = {}) => {
      const chofer = datos.nombre_chofer || datos.chofer || (datos.id_chofer ? `Chofer #${datos.id_chofer}` : "Chofer en planta");
      agregarToast({
        tipo: "solicitud_carga",
        titulo: "Solicitud de Carga de Camión",
        nombreChofer: chofer,
        detalle: datos.mensaje || `El chofer registró nueva solicitud de carga para el camión.`,
        accionUrl: esAdmin ? "/admin/asignaciones" : "/supervisor/asignaciones",
        accionTexto: "Ver y Aprobar Stock",
        color: "amber",
        icono: Truck,
        payload: datos,
      });
    });

    // 2. Operación de ruta registrada (Entrega o Cobro en camino)
    const unsubOp = logisticaSocket.suscribir("operacion_ruta_registrada", (datos = {}) => {
      const chofer = datos.nombre_chofer || datos.chofer || "Chofer en ruta";
      const esCobro = datos.tipo_operacion === "COBRO" || datos.monto;
      agregarToast({
        tipo: esCobro ? "cobro_ruta" : "entrega_ruta",
        titulo: esCobro ? "Cobro Registrado en Ruta" : "Entrega Registrada en Ruta",
        nombreChofer: chofer,
        detalle: datos.mensaje || (esCobro ? `Se registró un cobro por Bs. ${datos.monto || "0.00"}` : "Pedido entregado al cliente en ruta."),
        accionUrl: esAdmin ? "/admin/asignaciones" : "/supervisor/asignaciones",
        accionTexto: "Ir a Revisar / Aprobar",
        color: "emerald",
        icono: esCobro ? DollarSign : CheckCircle2,
        payload: datos,
      });
    });

    // 3. Ubicación de Chofer Actualizada (Telemetría Satelital)
    const unsubUbicacion = logisticaSocket.suscribir("ubicacion_chofer_actualizada", (datos = {}) => {
      // Notificar solo si hay cambios significativos o estado de alerta
      if (datos.alerta || datos.estado_movimiento === "Detenido con Alarma") {
        const chofer = datos.nombre_chofer || `Chofer #${datos.id_chofer || datos.IdUsuarioRepartidor || ""}`;
        agregarToast({
          tipo: "alerta_ubicacion",
          titulo: "Alerta de Chofer en Ruta",
          nombreChofer: chofer,
          detalle: datos.mensaje || `Alerta en parada: ${datos.estado_movimiento || "Detención prolongada"}`,
          accionUrl: "/supervisor/rutas/rastreo",
          accionTexto: "Ver en Mapa GPS",
          color: "rose",
          icono: ShieldAlert,
          payload: datos,
        });
      }
    });

    // 4. Ruta Reordenada
    const unsubReorden = logisticaSocket.suscribir("ruta_reordenada", (datos = {}) => {
      agregarToast({
        tipo: "ruta_reordenada",
        titulo: "Secuencia de Ruta Reordenada",
        nombreChofer: datos.nombre_chofer || "Supervisor de Logística",
        detalle: datos.mensaje || "Se modificó el orden vial de paradas asignadas para hoy.",
        accionUrl: esAdmin ? "/admin/asignaciones" : "/supervisor/asignaciones",
        accionTexto: "Ver Asignaciones",
        color: "indigo",
        icono: RefreshCw,
        payload: datos,
      });
    });

    // 5. Carga de Camión Aprobada
    const unsubCargaAprobada = logisticaSocket.suscribir("carga_camion_aprobada", (datos = {}) => {
      agregarToast({
        tipo: "carga_aprobada",
        titulo: "Carga de Camión Aprobada",
        nombreChofer: datos.nombre_chofer || "Administración",
        detalle: datos.mensaje || `Asignación #${datos.id_asignacion || ""} habilitada para salir a reparto.`,
        accionUrl: esAdmin ? "/admin/asignaciones" : "/supervisor/asignaciones",
        accionTexto: "Ver Ruta",
        color: "emerald",
        icono: CheckCircle2,
        payload: datos,
      });
    });

    // 6. Ruta Finalizada por Admin
    const unsubRutaFin = logisticaSocket.suscribir("ruta_finalizada_admin", (datos = {}) => {
      agregarToast({
        tipo: "ruta_finalizada",
        titulo: "Ruta Finalizada y Chofer Liberado",
        nombreChofer: datos.nombre_chofer || "Supervisión",
        detalle: datos.mensaje || "Ruta cerrada exitosamente por auditoría. Chofer listo para nuevo viaje.",
        accionUrl: esAdmin ? "/admin/asignaciones" : "/supervisor/asignaciones",
        accionTexto: "Ver Historial",
        color: "slate",
        icono: Clock,
        payload: datos,
      });
    });

    // 7. Cobro QR Registrado
    const unsubQr = logisticaSocket.suscribir("cobro_qr_registrado", (datos = {}) => {
      agregarToast({
        tipo: "cobro_qr",
        titulo: "Nuevo Pago QR Pendiente",
        nombreChofer: datos.nombre_chofer || "Reparto / Clientes",
        detalle: datos.mensaje || `Comprobante QR por Bs. ${datos.monto || "0.00"} pendiente de validación contable.`,
        accionUrl: "/contador/aprobacion-qr",
        accionTexto: "Aprobar QR",
        color: "blue",
        icono: QrCode,
        payload: datos,
      });
    });

    // 8. Soporte para eventos lanzados desde ventanas o pruebas locales
    const handleTrigger = (e) => {
      if (e?.detail) {
        agregarToast(e.detail);
      }
    };
    window.addEventListener("blanquita:trigger-toast", handleTrigger);

    return () => {
      unsubCarga1();
      unsubCarga2();
      unsubOp();
      unsubUbicacion();
      unsubReorden();
      unsubCargaAprobada();
      unsubRutaFin();
      unsubQr();
      window.removeEventListener("blanquita:trigger-toast", handleTrigger);
    };
  }, [agregarToast, esAdmin]);

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-label="Notificaciones en vivo de logística"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icono = toast.icono || Truck;

        // Estilos semánticos por color
        const colorClasses = {
          amber: "border-amber-400 bg-amber-50/95 text-amber-950 dark:bg-amber-950/90 dark:text-amber-100",
          emerald: "border-emerald-500 bg-emerald-50/95 text-emerald-950 dark:bg-emerald-950/90 dark:text-emerald-100",
          blue: "border-sky-500 bg-sky-50/95 text-sky-950 dark:bg-sky-950/90 dark:text-sky-100",
          indigo: "border-indigo-400 bg-indigo-50/95 text-indigo-950 dark:bg-indigo-950/90 dark:text-indigo-100",
          rose: "border-rose-500 bg-rose-50/95 text-rose-950 dark:bg-rose-950/90 dark:text-rose-100",
          slate: "border-slate-400 bg-slate-50/95 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100",
        }[toast.color] || "border-[#20A7DB] bg-white/95 text-slate-900";

        const badgeClasses = {
          amber: "bg-amber-100 text-amber-800 border-amber-300",
          emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
          blue: "bg-sky-100 text-sky-800 border-sky-300",
          indigo: "bg-indigo-100 text-indigo-800 border-indigo-300",
          rose: "bg-rose-100 text-rose-800 border-rose-300",
          slate: "bg-slate-200 text-slate-800 border-slate-300",
        }[toast.color] || "bg-sky-100 text-sky-800";

        const buttonClasses = {
          amber: "bg-amber-600 hover:bg-amber-700 text-white",
          emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
          blue: "bg-[#20A7DB] hover:bg-[#1C96C5] text-white",
          indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
          rose: "bg-rose-600 hover:bg-rose-700 text-white",
          slate: "bg-slate-700 hover:bg-slate-800 text-white",
        }[toast.color] || "bg-[#20A7DB] hover:bg-[#1C96C5] text-white";

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto rounded-2xl border-2 p-3.5 shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 fade-in ${colorClasses}`}
            style={{
              boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 0 1px 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-xs ${badgeClasses}`}
              >
                <Icono size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-bold tracking-tight truncate leading-tight">
                    {toast.titulo}
                  </h4>
                  <span className="text-[10px] font-medium opacity-70 shrink-0">
                    {toast.hora}
                  </span>
                </div>

                {toast.nombreChofer && (
                  <p className="mt-0.5 text-[11px] font-semibold opacity-90 truncate flex items-center gap-1">
                    <User size={12} className="shrink-0 opacity-75" />
                    <span>{toast.nombreChofer}</span>
                  </p>
                )}

                <p className="mt-1 text-xs leading-relaxed opacity-85 line-clamp-2">
                  {toast.detalle}
                </p>

                {toast.accionUrl && (
                  <div className="mt-2.5 flex items-center justify-end gap-2">
                    <a
                      href={toast.accionUrl}
                      onClick={() => removerToast(toast.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer ${buttonClasses}`}
                    >
                      <span>{toast.accionTexto || "Ver"}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removerToast(toast.id)}
                aria-label="Cerrar notificación"
                className="shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
