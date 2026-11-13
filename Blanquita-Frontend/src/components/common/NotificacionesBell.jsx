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
  User,
  Building2,
  Filter
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBranch } from "@/stores/branchStore";

const STORAGE_KEY = "blanquita_notificaciones_v2";

const NOTIFICACIONES_SEMILLA = [
  {
    id: "semilla-carga-101",
    tipo: "solicitud_carga",
    categoria: "CARGA",
    titulo: "Solicitud de Carga de Camión",
    nombreChofer: "Carlos Méndez (Camión #3)",
    idSucursal: 1, // Sucre
    detalle: "Solicita validación de stock remanente y carga de 150 paq. Higiénico Clásico y 80 Servilletas para iniciar Ruta 101.",
    fecha: "Hace 10 min",
    creadoEn: Date.now() - 10 * 60 * 1000,
    leida: false,
    accionUrl: "/supervisor/asignaciones",
    accionTexto: "Ver y Resolver Stock",
    color: "amber",
  },
  {
    id: "semilla-carga-102",
    tipo: "solicitud_carga",
    categoria: "CARGA",
    titulo: "Solicitud de Carga de Camión - Potosí",
    nombreChofer: "Gonzalo Rivera (Camión #5)",
    idSucursal: 2, // Potosí
    detalle: "Solicita validación de carga para Ruta Villa Imperial Potosí (90 paq. Clásico, 40 Servilletas).",
    fecha: "Hace 15 min",
    creadoEn: Date.now() - 15 * 60 * 1000,
    leida: false,
    accionUrl: "/supervisor/asignaciones",
    accionTexto: "Ver y Resolver Stock",
    color: "amber",
  },
  {
    id: "semilla-cobro-202",
    tipo: "operacion_ruta",
    categoria: "COBROS",
    titulo: "Nueva Entrega con Cobro en Ruta",
    nombreChofer: "Mario Flores (Camión #1)",
    idSucursal: 1, // Sucre
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
    idSucursal: 2, // Potosí
    detalle: "Cliente Tienda El Sol Potosí realizó abono QR por Bs. 320.00 (Ref #849201). Pendiente de conciliación.",
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
    idSucursal: 1, // Sucre
    detalle: "Parada #5 (Distribuidora Central) reportada como No Entregada. Motivo: Local cerrado temporalmente.",
    fecha: "Hace 1 hora",
    creadoEn: Date.now() - 60 * 60 * 1000,
    leida: false,
    accionUrl: "/supervisor/rutas/rastreo",
    accionTexto: "Ver en Rastreo GPS",
    color: "rose",
  },
];

export default function NotificacionesBell({
  idRol,
  esAdmin = false,
  basePath = "supervisor",
  sucursalActiva: propSucursalActiva = null,
  puedeVerTodas: propPuedeVerTodas = null,
}) {
  const branch = useBranch();
  const puedeVerTodas = propPuedeVerTodas !== null ? Boolean(propPuedeVerTodas) : branch.puedeVerTodas;
  const sucursalActiva = propSucursalActiva !== null ? propSucursalActiva : branch.sucursalActiva;
  const sucursalAsignada = branch.sucursalAsignada;
  const sedeEfectiva = Number(sucursalAsignada || 1);

  const [abierto, setAbierto] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [filtroSucursal, setFiltroSucursal] = useState("TODAS"); // 'TODAS' | '1' (Sucre) | '2' (Potosí)
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

  // 3. Escuchar nuevas notificaciones emitidas por WebSocket / Toasts / CustomEvents
  useEffect(() => {
    if (typeof window === "undefined") return;

    const manejarNuevaNotificacion = (e) => {
      if (!e?.detail) return;
      const nuevo = e.detail;

      let categoria = "ALERTAS";
      if (nuevo.tipo?.includes("carga")) categoria = "CARGA";
      else if (nuevo.tipo?.includes("cobro") || nuevo.tipo?.includes("entrega") || nuevo.tipo?.includes("operacion")) categoria = "COBROS";
      else if (nuevo.tipo?.includes("ruta") || nuevo.tipo?.includes("ubicacion")) categoria = "ALERTAS";

      // Detectar sede
      let idSede = nuevo.idSucursal || nuevo.id_sucursal || nuevo.payload?.id_sucursal || nuevo.payload?.IdSucursal;
      if (!idSede) {
        const textoDesc = `${nuevo.titulo || ""} ${nuevo.detalle || ""} ${nuevo.nombreChofer || ""}`.toLowerCase();
        idSede = textoDesc.includes("potos") ? 2 : 1;
      }

      // Aislamiento estricto: si el usuario no es multisede, ignorar notificaciones de otra sucursal
      if (!puedeVerTodas && Number(idSede) !== sedeEfectiva) {
        return;
      }

      const itemFormateado = {
        id: nuevo.id || `notif-${Date.now()}`,
        tipo: nuevo.tipo || "alerta",
        categoria,
        idSucursal: Number(idSede) === 2 ? 2 : 1,
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
        const existe = prev.some((n) => n.id === itemFormateado.id);
        if (existe) return prev;
        const actualizadas = [itemFormateado, ...prev.slice(0, 49)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(actualizadas));
        } catch {}
        return actualizadas;
      });
    };

    const handleWsEvent = (e) => {
      const { tipo, datos, payload } = e.detail || {};
      const payloadDatos = datos || payload || {};
      if (tipo === "solicitud_carga_recibida" || tipo === "solicitud_carga_creada") {
        manejarNuevaNotificacion({
          detail: {
            tipo: "solicitud_carga",
            titulo: "Solicitud de Carga de Camión",
            nombreChofer: payloadDatos.nombre_chofer || payloadDatos.chofer || "Chofer en planta",
            detalle: payloadDatos.mensaje || "El chofer solicitó aprobación de carga de inventario para iniciar ruta.",
            idSucursal: payloadDatos.id_sucursal || payloadDatos.IdSucursal || 1,
            color: "amber"
          }
        });
      }
    };

    window.addEventListener("blanquita:notificacion-nueva", manejarNuevaNotificacion);
    window.addEventListener("blanquita:ws-event", handleWsEvent);

    return () => {
      window.removeEventListener("blanquita:notificacion-nueva", manejarNuevaNotificacion);
      window.removeEventListener("blanquita:ws-event", handleWsEvent);
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

  // Cálculo de no leídas (aislado por sede fija si no es multisede)
  const cantidadNoLeidas = useMemo(() => {
    return notificaciones.filter((n) => {
      if (n.leida) return false;
      if (!puedeVerTodas && Number(n.idSucursal || 1) !== sedeEfectiva) return false;
      return true;
    }).length;
  }, [notificaciones, puedeVerTodas, sedeEfectiva]);

  // Filtro y Priorización por Sucursal y Categoría
  const notificacionesFiltradas = useMemo(() => {
    let lista = [...notificaciones];

    // Aislamiento estricto: usuarios no multisede SOLO ven su propia sucursal
    if (!puedeVerTodas) {
      lista = lista.filter((n) => Number(n.idSucursal || 1) === sedeEfectiva);
    } else if (filtroSucursal !== "TODAS") {
      const numFiltro = Number(filtroSucursal);
      lista = lista.filter((n) => Number(n.idSucursal || 1) === numFiltro);
    }

    // Filtro por categoría
    if (filtroCategoria !== "TODAS") {
      lista = lista.filter((n) => n.categoria === filtroCategoria);
    }

    // Prioridad por sucursal activa en la vista si es multisede
    const sedeActivaNum =
      sucursalActiva === "2" || sucursalActiva === 2 ? 2 : (sucursalActiva === "1" || sucursalActiva === 1 ? 1 : null);

    if (puedeVerTodas && sedeActivaNum) {
      lista.sort((a, b) => {
        const sedeA = Number(a.idSucursal || 1);
        const sedeB = Number(b.idSucursal || 1);
        if (sedeA === sedeActivaNum && sedeB !== sedeActivaNum) return -1;
        if (sedeB === sedeActivaNum && sedeA !== sedeActivaNum) return 1;
        return (b.creadoEn || 0) - (a.creadoEn || 0);
      });
    }

    return lista;
  }, [notificaciones, filtroCategoria, filtroSucursal, sucursalActiva, puedeVerTodas, sedeEfectiva]);

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
    <div
      className="relative"
      ref={contenedorRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      {/* Botón de Campana Blindado contra View Transitions de Astro */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-label="Campana de notificaciones de logística"
        aria-expanded={abierto}
        title="Notificaciones en tiempo real"
        className="rounded-xl bg-white/90 hover:bg-white border border-white/40 transition-all duration-150 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-white/40"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          flexShrink: 0,
        }}
      >
        <Bell
          className="text-slate-600"
          style={{ width: "20px", height: "20px", flexShrink: 0, display: "block" }}
        />

        {/* Badge numérico blindado (solo si noLeidas > 0) */}
        {cantidadNoLeidas > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              transform: "translate(35%, -35%)",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              borderRadius: "9999px",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              lineHeight: "18px",
              textAlign: "center",
              pointerEvents: "none",
              zIndex: 20,
              boxShadow: "0 0 0 2px #ffffff",
            }}
          >
            {cantidadNoLeidas > 99 ? "99+" : cantidadNoLeidas}
          </span>
        )}
      </button>

      {/* Dropdown Flotante de Notificaciones */}
      {abierto && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 md:w-[420px] rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#A0D9EF] shadow-2xl z-[100] text-slate-800 dark:text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-text"
          style={{
            boxShadow: "0 20px 45px -10px rgba(28, 150, 197, 0.35), 0 0 1px 1px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Cabecera del Dropdown */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#20A7DB] text-white shadow-xs shrink-0">
                <Bell size={15} className="shrink-0" />
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
                <CheckCheck size={14} className="shrink-0" />
                <span>Marcar leídas</span>
              </button>
            )}
          </div>

          {/* Selector de Sucursal y Categorías */}
          <div className="px-3 pt-2 pb-2 space-y-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            {/* Filtro Sucursal (solo para usuarios multisede) */}
            {puedeVerTodas && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <Building2 size={12} className="shrink-0 text-slate-400" />
                  <span>Sede:</span>
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                  {[
                    { id: "TODAS", label: "Todas" },
                    { id: "1", label: "Sucre" },
                    { id: "2", label: "Potosí" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFiltroSucursal(s.id)}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all ${
                        filtroSucursal === s.id
                          ? "bg-[#1C96C5] text-white shadow-2xs"
                          : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pestañas de categoría */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "TODAS", label: "Todas" },
                { id: "CARGA", label: "Cargas" },
                { id: "COBROS", label: "Cobros/QR" },
                { id: "ALERTAS", label: "Alertas" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFiltroCategoria(tab.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
                    filtroCategoria === tab.id
                      ? "bg-[#20A7DB] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Notificaciones con Scroll suave */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notificacionesFiltradas.length === 0 ? (
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2.5">
                  <Inbox size={22} className="opacity-60 shrink-0" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  No hay notificaciones en este filtro
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Las alertas de camiones y choferes aparecerán aquí en vivo.
                </p>
              </div>
            ) : (
              notificacionesFiltradas.map((notif) => {
                const IconoComp = getIcono(notif);
                const noLeida = !notif.leida;
                const esPotosiNotif = Number(notif.idSucursal) === 2;
                const sedeLabel = esPotosiNotif ? "POTOSÍ" : "SUCRE";

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
                      <IconoComp size={18} className="shrink-0" />
                    </div>

                    {/* Contenido Principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
                            {notif.titulo}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-extrabold uppercase px-1 py-0 border shrink-0 ${
                              esPotosiNotif
                                ? "border-purple-300 text-purple-700 bg-purple-50"
                                : "border-sky-300 text-sky-700 bg-sky-50"
                            }`}
                          >
                            [{sedeLabel}]
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {notif.fecha}
                        </span>
                      </div>

                      {notif.nombreChofer && (
                        <p className="text-[11px] font-semibold text-[#1C96C5] dark:text-sky-400 truncate mt-0.5 flex items-center gap-1">
                          <User size={12} className="shrink-0 text-slate-400" />
                          <span>{notif.nombreChofer}</span>
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
                            <ExternalLink size={12} className="shrink-0" />
                          </a>

                          <div className="flex items-center gap-1">
                            {noLeida && (
                              <button
                                type="button"
                                onClick={(e) => marcarComoLeida(notif.id, e)}
                                title="Marcar como leída"
                                className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Check size={14} className="shrink-0" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => eliminarNotificacion(notif.id, e)}
                              title="Eliminar notificación"
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} className="shrink-0" />
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
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
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
