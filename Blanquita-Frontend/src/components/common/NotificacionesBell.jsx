import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Bell,
  Truck,
  CheckCircle2,
  DollarSign,
  QrCode,
  AlertTriangle,
  Check,
  CheckCheck,
  ExternalLink,
  Trash2,
  Inbox,
  Radio,
  MapPin,
  Clock,
} from "lucide-react";

const STORAGE_KEY = "blanquita_notificaciones_v1";

const NOTIFICACIONES_SEMILLA = [
  {
    id: "semilla-carga-101",
    tipo: "solicitud_carga",
    categoria: "CARGA",
    titulo: "Solicitud de Carga de Camión",
    nombreChofer: "Carlos Méndez (Camión #3)",
    detalle: "Solicita validación de stock remanente y carga de 150 paq. Higiénico Clásico y 80 Servilletas para iniciar Ruta 101.",
    fecha: "Hace 10 min",
    creadoEn: Date.now() - 10 * 60 * 1000,
    leida: false,
    accionUrl: "/supervisor/asignaciones",
    accionTexto: "Ver y Aprobar Stock",
    color: "amber",
  },
  {
    id: "semilla-cobro-202",
    tipo: "operacion_ruta",
    categoria: "COBROS",
    titulo: "Nueva Entrega con Cobro en Ruta",
    nombreChofer: "Mario Flores (Camión #1)",
    detalle: "Completó entrega a Supermercado Litoral: Cobro de Bs. 1,450.00 en efectivo registrado.",
    fecha: "Hace 22 min",
    creadoEn: Date.now() - 22 * 60 * 1000,
    leida: false,
    accionUrl: "/supervisor/asignaciones",
    accionTexto: "Ir a Revisar/Aprobar",
    color: "emerald",
  },
  {
    id: "semilla-qr-303",
    tipo: "cobro_qr",
    categoria: "COBROS",
    titulo: "Cobro QR Pendiente de Aprobación",
    nombreChofer: "Juan Pérez (Camión #2)",
    detalle: "Cliente Tienda El Sol realizó abono QR por Bs. 320.00 (Ref #849201). Pendiente de conciliación contable.",
    fecha: "Hace 45 min",
    creadoEn: Date.now() - 45 * 60 * 1000,
    leida: false,
    accionUrl: "/contador/aprobacion-qr",
    accionTexto: "Revisar Cobro QR",
    color: "blue",
  },
  {
    id: "semilla-alerta-404",
    tipo: "alerta_ruta",
    categoria: "ALERTAS",
    titulo: "Alerta: No-Entrega en Parada",
    nombreChofer: "Roberto Arce (Camión #4)",
    detalle: "Parada #5 (Distribuidora Central) reportada como No Entregada. Motivo: Local cerrado temporalmente.",
    fecha: "Hace 1 hora",
    creadoEn: Date.now() - 60 * 60 * 1000,
    leida: false,
    accionUrl: "/supervisor/rutas/rastreo",
    accionTexto: "Ver en Rastreo GPS",
    color: "rose",
  },
];

export default function NotificacionesBell({ idRol, esAdmin = false, basePath = "supervisor" }) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("TODAS");
  const [notificaciones, setNotificaciones] = useState([]);
  const contenedorRef = useRef(null);

  // 1. Cargar notificaciones persistentes de localStorage o inicializar semillas
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const guardadas = localStorage.getItem(STORAGE_KEY);
      if (guardadas) {
        const parsed = JSON.parse(guardadas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotificaciones(parsed);
          return;
        }
      }
      // Inicializar con semillas si es primera vez
      setNotificaciones(NOTIFICACIONES_SEMILLA);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(NOTIFICACIONES_SEMILLA));
    } catch {
      setNotificaciones(NOTIFICACIONES_SEMILLA);
    }
  }, []);

  // 2. Guardar en localStorage ante cambios
  const guardarNotificaciones = useCallback((lista) => {
    setNotificaciones(lista);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
      } catch {}
    }
  }, []);

  // 3. Escuchar nuevas notificaciones emitidas por el sistema WebSocket / Toasts
  useEffect(() => {
    if (typeof window === "undefined") return;

    const manejarNuevaNotificacion = (e) => {
      if (!e?.detail) return;
      const nuevo = e.detail;

      // Normalizar categoría para filtrado
      let categoria = "ALERTAS";
      if (nuevo.tipo?.includes("carga")) categoria = "CARGA";
      else if (nuevo.tipo?.includes("cobro") || nuevo.tipo?.includes("entrega") || nuevo.tipo?.includes("operacion")) categoria = "COBROS";
      else if (nuevo.tipo?.includes("ruta") || nuevo.tipo?.includes("ubicacion")) categoria = "ALERTAS";

      const itemFormateado = {
        id: nuevo.id || `notif-${Date.now()}`,
        tipo: nuevo.tipo || "alerta",
        categoria,
        titulo: nuevo.titulo || "Notificación de Logística",
        nombreChofer: nuevo.nombreChofer || "Chofer en ruta",
        detalle: nuevo.detalle || "Nueva actualización en vivo recibida.",
        fecha: "Ahora mismo",
        creadoEn: Date.now(),
        leida: false,
        accionUrl: nuevo.accionUrl || (esAdmin ? "/admin/asignaciones" : "/supervisor/asignaciones"),
        accionTexto: nuevo.accionTexto || "Ver Detalles",
        color: nuevo.color || "amber",
      };

      setNotificaciones((prev) => {
        // Evitar duplicados por id
        const existe = prev.some((n) => n.id === itemFormateado.id);
        if (existe) return prev;
        const actualizadas = [itemFormateado, ...prev.slice(0, 49)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizadas));
        } catch {}
        return actualizadas;
      });
    };

    window.addEventListener("blanquita:notificacion-nueva", manejarNuevaNotificacion);
    return () => {
      window.removeEventListener("blanquita:notificacion-nueva", manejarNuevaNotificacion);
    };
  }, [esAdmin]);

  // 4. Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target)) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [abierto]);

  // Cálculo de no leídas
  const cantidadNoLeidas = useMemo(() => {
    return notificaciones.filter((n) => !n.leida).length;
  }, [notificaciones]);

  // Filtro de lista
  const notificacionesFiltradas = useMemo(() => {
    if (filtro === "TODAS") return notificaciones;
    return notificaciones.filter((n) => n.categoria === filtro);
  }, [notificaciones, filtro]);

  // Marcar una como leída
  const marcarComoLeida = (id, e) => {
    if (e) e.stopPropagation();
    const actualizadas = notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n));
    guardarNotificaciones(actualizadas);
  };

  // Marcar todas como leídas
  const marcarTodasComoLeidas = () => {
    const actualizadas = notificaciones.map((n) => ({ ...n, leida: true }));
    guardarNotificaciones(actualizadas);
  };

  // Eliminar una notificación
  const eliminarNotificacion = (id, e) => {
    if (e) e.stopPropagation();
    const actualizadas = notificaciones.filter((n) => n.id !== id);
    guardarNotificaciones(actualizadas);
  };

  // Vaciar todas las notificaciones
  const vaciarNotificaciones = () => {
    guardarNotificaciones([]);
  };

  // Icono por tipo o categoría
  const getIcono = (notif) => {
    if (notif.categoria === "CARGA") return Truck;
    if (notif.tipo === "cobro_qr") return QrCode;
    if (notif.categoria === "COBROS") return DollarSign;
    if (notif.tipo?.includes("ubicacion")) return Radio;
    return AlertTriangle;
  };

  return (
    <div className="relative" ref={contenedorRef}>
      {/* Botón de Campana */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-label="Campana de notificaciones de logística"
        aria-expanded={abierto}
        title="Notificaciones en tiempo real"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-all duration-150 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        <Bell size={18} className={cantidadNoLeidas > 0 ? "animate-wiggle" : ""} />

        {/* Badge Rojo Contador */}
        {cantidadNoLeidas > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-extrabold text-white shadow-md border-2 border-[#62C1E5] animate-pulse"
            style={{ lineHeight: 1 }}
          >
            {cantidadNoLeidas > 99 ? "99+" : cantidadNoLeidas}
          </span>
        )}
      </button>

      {/* Dropdown Flotante de Notificaciones */}
      {abierto && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 md:w-[410px] rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#A0D9EF] shadow-2xl z-[100] text-slate-800 dark:text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-text"
          style={{
            boxShadow: "0 20px 45px -10px rgba(28, 150, 197, 0.35), 0 0 1px 1px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Cabecera del Dropdown */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#20A7DB] text-white shadow-xs">
                <Bell size={15} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                  Notificaciones
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {cantidadNoLeidas === 0
                    ? "Al día (0 pendientes)"
                    : `${cantidadNoLeidas} pendiente${cantidadNoLeidas > 1 ? "s" : ""}`}
                </span>
              </div>
            </div>

            {cantidadNoLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodasComoLeidas}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#1C96C5] hover:text-[#0f6080] hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Marcar todas las notificaciones como leídas"
              >
                <CheckCheck size={14} />
                <span>Marcar leídas</span>
              </button>
            )}
          </div>

          {/* Filtros rápidos de pestañas */}
          <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            {[
              { id: "TODAS", label: "Todas" },
              { id: "CARGA", label: "Cargas" },
              { id: "COBROS", label: "Cobros/QR" },
              { id: "ALERTAS", label: "Alertas" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltro(tab.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filtro === tab.id
                    ? "bg-[#20A7DB] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Lista de Notificaciones con Scroll suave */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notificacionesFiltradas.length === 0 ? (
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2.5">
                  <Inbox size={22} className="opacity-60" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  No hay notificaciones en esta categoría
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Las alertas de camiones y choferes aparecerán aquí en vivo.
                </p>
              </div>
            ) : (
              notificacionesFiltradas.map((notif) => {
                const IconoComp = getIcono(notif);
                const noLeida = !notif.leida;

                const bgIcono = {
                  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                  blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
                }[notif.color] || "bg-sky-100 text-sky-700";

                return (
                  <div
                    key={notif.id}
                    onClick={() => marcarComoLeida(notif.id)}
                    className={`p-3.5 transition-colors relative flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 cursor-pointer ${
                      noLeida
                        ? "bg-sky-50/40 dark:bg-sky-950/20 font-medium"
                        : "bg-white dark:bg-slate-900 opacity-80 hover:opacity-100"
                    }`}
                  >
                    {/* Indicador de no leída */}
                    {noLeida && (
                      <span className="absolute left-1.5 top-5 h-2 w-2 rounded-full bg-[#20A7DB] ring-2 ring-sky-200 dark:ring-sky-900" />
                    )}

                    {/* Icono de tipo */}
                    <div
                      className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center shadow-2xs ${bgIcono}`}
                    >
                      <IconoComp size={18} />
                    </div>

                    {/* Contenido Principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                          {notif.titulo}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {notif.fecha}
                        </span>
                      </div>

                      {notif.nombreChofer && (
                        <p className="text-[11px] font-semibold text-[#1C96C5] dark:text-sky-400 truncate mt-0.5">
                          👤 {notif.nombreChofer}
                        </p>
                      )}

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug mt-1 line-clamp-2">
                        {notif.detalle}
                      </p>

                      {/* Botón de acción rápida directa */}
                      {notif.accionUrl && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <a
                            href={notif.accionUrl}
                            onClick={(e) => {
                              marcarComoLeida(notif.id, e);
                              setAbierto(false);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-[#20A7DB] hover:bg-[#1C96C5] shadow-2xs transition-colors cursor-pointer"
                          >
                            <span>{notif.accionTexto || "Ver y Gestionar"}</span>
                            <ExternalLink size={12} />
                          </a>

                          <div className="flex items-center gap-1">
                            {noLeida && (
                              <button
                                type="button"
                                onClick={(e) => marcarComoLeida(notif.id, e)}
                                title="Marcar como leída"
                                className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => eliminarNotificacion(notif.id, e)}
                              title="Eliminar notificación"
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pie del Dropdown */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-medium">
              Conexión activa a flota
            </span>
            {notificaciones.length > 0 && (
              <button
                type="button"
                onClick={vaciarNotificaciones}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                Limpiar lista
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
