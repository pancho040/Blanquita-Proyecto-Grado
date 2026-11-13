import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { NotificacionesApi } from "../api/notificacionesApi";
import { useAuth } from "./AuthContext";
import { wsService } from "../services/wsService";
import { LogisticaApi } from "../api/logisticaApi";
import { LocalDB } from "../database/localDb";
import { SyncQueue } from "../database/syncQueue";
import apiClient, { getTokenEnMemoria } from "../api/client";

/**
 * Sanitiza cualquier texto entrante removiendo emojis decorativos.
 */
const limpiarTextoEmojis = (texto) => {
  if (!texto || typeof texto !== "string") return "";
  return texto
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{203C}\u{2049}\u{2139}]/gu,
      ""
    )
    .trim();
};

/**
 * Tipos de eventos y notificaciones operativas permitidas exclusivamente para el Chofer.
 */
export const TIPOS_PERMITIDOS_CHOFER = [
  "RUTA_ASIGNADA",
  "CARGA_CAMION_APROBADA",
  "CARGA_CAMION_OBSERVADA",
  "CARGA_CAMION_RECHAZADA",
  "RUTA_REORDENADA",
  "OPERACION_REVISADA",
  "RUTA_FINALIZADA_ADMIN",
  "ABONO_QR_APROBADO",
  "ABONO_QR_RECHAZADO",
  "TELEMETRIA_PING",
  "AVISO_RUTA",
];

/**
 * Palabras clave de módulos administrativos y finanzas que deben descartarse inmediatamente.
 */
const TERMINOS_MODULOS_AJENOS = [
  "vale",
  "vales",
  "caja chica",
  "rendicion",
  "rendición",
  "contabilidad",
  "compras",
  "compra",
  "proveedor",
  "proveedores",
  "sueldo",
  "sueldos",
  "planilla",
  "planillas",
  "finanzas",
  "gasto",
  "gastos",
  "revalorizacion",
  "revalorización",
  "ajuste de nota",
];

/**
 * Normaliza el tipo de notificación recibido de REST o WebSocket a los tipos estándar.
 */
export const normalizarTipoNotificacion = (tipo) => {
  const t = String(tipo || "").trim().toUpperCase();
  if (t === "ABONO_APROBADO") return "ABONO_QR_APROBADO";
  if (t === "ABONO_RECHAZADO") return "ABONO_QR_RECHAZADO";
  if (t === "SOLICITAR_UBICACION_ACTUAL") return "TELEMETRIA_PING";
  if (t === "CARGA_CAMION_RESUELTA") return "CARGA_CAMION_APROBADA";
  return t;
};

/**
 * Comprueba si un aviso menciona módulos ajenos a la operativa del chofer.
 */
export const perteneceAModulosAjenos = (notif) => {
  if (!notif) return false;
  const contenido = [
    notif.tipo,
    notif.titulo,
    notif.mensaje,
    notif.modulo,
    notif.categoria,
    notif.origen,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return TERMINOS_MODULOS_AJENOS.some((palabra) => contenido.includes(palabra));
};

/**
 * Valida si una notificación le pertenece legítimamente al chofer autenticado.
 * Aplica filtro estricto por id_usuario_destino, id_chofer, usuario_destino/ci y tipos permitidos.
 */
export const esNotificacionValidaChofer = (notif, usuarioActual, { esWs = false } = {}) => {
  if (!notif || !usuarioActual) return false;

  const idUsuarioActual = usuarioActual.IdUsuario || usuarioActual.id_usuario;
  const ciUsuarioActual = String(usuarioActual.Ci || usuarioActual.ci || "").trim();

  // 1. Descartar de inmediato si pertenece a módulos ajenos (vales, rendiciones, etc.)
  if (perteneceAModulosAjenos(notif)) {
    return false;
  }

  // 2. Normalizar tipo y verificar lista blanca estricta para chofer
  const tipoNorm = normalizarTipoNotificacion(notif.tipo);
  if (!TIPOS_PERMITIDOS_CHOFER.includes(tipoNorm)) {
    return false;
  }

  // 3. Extracción de destinatario explícito
  const destId =
    notif.id_usuario_destino ??
    notif.id_usuario_destinatario ??
    notif.IdUsuarioDestinatario ??
    notif.id_chofer ??
    notif.IdChofer ??
    notif.id_repartidor ??
    notif.IdRepartidor ??
    notif.IdUsuarioRepartidor ??
    notif.id_usuario ??
    notif.IdUsuario ??
    null;

  const destCi =
    notif.usuario_destino ??
    notif.ci_destino ??
    notif.ci ??
    notif.Ci ??
    null;

  const tieneDestinatario = destId != null || (destCi != null && String(destCi).trim() !== "");

  if (tieneDestinatario) {
    const coincideId = destId != null && idUsuarioActual != null && String(destId) === String(idUsuarioActual);
    const coincideCi = destCi != null && ciUsuarioActual && String(destCi).trim() === ciUsuarioActual;
    if (!coincideId && !coincideCi) {
      // Destinada a otro usuario o chofer -> DESCARTAR
      return false;
    }
    return true;
  }

  // Si no tiene destinatario explícito:
  // En WebSocket (canal broadcast compartido), se descarta para evitar capturar eventos globales ajenos
  if (esWs) {
    return false;
  }

  // En REST: proviene de /api/movil/v1/notificaciones del chofer y superó lista blanca de chofer
  return true;
};

export const NotificacionesContext = createContext(null);

export function NotificacionesProvider({ children, navigationRef }) {
  const { user, usuario, token } = useAuth();
  const usuarioActual = usuario || user || null;
  const idUsuarioActual = usuarioActual?.IdUsuario || usuarioActual?.id_usuario || null;
  const sesionActiva = Boolean(usuarioActual && idUsuarioActual);

  const [notificaciones, setNotificaciones] = useState([]);
  const [conteoNoLeidas, setConteoNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const peticionEnVueloRef = useRef(null);
  const wasConnectedRef = useRef(null);
  const ultimoIdUsuarioRef = useRef(null);

  // Aislamiento por usuario: Almacena lista en localDb bajo @blanquita_notificaciones_{usuarioId}
  const guardarEnAlmacenamientoAislado = useCallback(
    async (items) => {
      if (!idUsuarioActual) return;
      try {
        await LocalDB.guardarNotificacionesLocales(idUsuarioActual, items);
      } catch (err) {
        console.warn("[NotificacionesContext] Error guardando en LocalDB:", err.message);
      }
    },
    [idUsuarioActual]
  );

  // Cargar notificaciones bajo demanda aplicando filtro estricto y persistencia local
  const sincronizarNotificaciones = useCallback(async () => {
    if (!sesionActiva || !idUsuarioActual) return [];

    if (peticionEnVueloRef.current) {
      return peticionEnVueloRef.current;
    }

    setCargando(true);
    peticionEnVueloRef.current = (async () => {
      try {
        const items = await NotificacionesApi.obtenerNotificaciones({ soloNoLeidas: false });
        const listado = Array.isArray(items) ? items : [];

        // Filtro estricto: Descarta avisos ajenos (vales, rendiciones, otros choferes)
        const filtradas = listado.filter((n) =>
          esNotificacionValidaChofer(n, usuarioActual, { esWs: false })
        );

        const listadoLimpio = filtradas.map((n) => ({
          ...n,
          id: n.id || n.id_notificacion || `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tipo: normalizarTipoNotificacion(n.tipo),
          titulo: limpiarTextoEmojis(n.titulo),
          mensaje: limpiarTextoEmojis(n.mensaje),
          id_usuario_destino: idUsuarioActual,
          leido: Boolean(n.leido),
        }));

        setNotificaciones(listadoLimpio);
        const noLeidas = listadoLimpio.filter((n) => !n.leido).length;
        setConteoNoLeidas(noLeidas);

        // Persistir en base local aislada por id_usuario
        await guardarEnAlmacenamientoAislado(listadoLimpio);

        return listadoLimpio;
      } catch (_err) {
        return [];
      } finally {
        setCargando(false);
        peticionEnVueloRef.current = null;
      }
    })();

    return peticionEnVueloRef.current;
  }, [sesionActiva, idUsuarioActual, usuarioActual, guardarEnAlmacenamientoAislado]);

  // Manejo de cambio de usuario o cierre de sesión para aislar memoria y almacenamiento
  useEffect(() => {
    if (!sesionActiva || !idUsuarioActual) {
      // Cierre de sesión o sin usuario: reseteo total en memoria
      setNotificaciones([]);
      setConteoNoLeidas(0);
      ultimoIdUsuarioRef.current = null;
      return;
    }

    // Si cambió de usuario (ej. chofer distinto en el mismo teléfono)
    if (ultimoIdUsuarioRef.current !== idUsuarioActual) {
      ultimoIdUsuarioRef.current = idUsuarioActual;
      setNotificaciones([]);
      setConteoNoLeidas(0);

      // Cargar caché local del chofer actual de inmediato
      LocalDB.obtenerNotificacionesLocales(idUsuarioActual).then((cached) => {
        if (Array.isArray(cached) && cached.length > 0) {
          const validadas = cached.filter((n) =>
            esNotificacionValidaChofer(n, usuarioActual, { esWs: false })
          );
          setNotificaciones(validadas);
          setConteoNoLeidas(validadas.filter((n) => !n.leido).length);
        }
      });

      // Luego sincronizar con el servidor
      sincronizarNotificaciones();
    }
  }, [sesionActiva, idUsuarioActual, usuarioActual, sincronizarNotificaciones]);

  // Refrescar estado local tras eventos WebSocket en tiempo real
  const refrescarEstadoLocalDesdeWS = useCallback(async (tipoEvento) => {
    try {
      const tipoNorm = String(tipoEvento || "").toLowerCase();
      if (
        tipoNorm === "carga_camion_aprobada" ||
        tipoNorm === "carga_camion_observada" ||
        tipoNorm === "carga_camion_rechazada"
      ) {
        const inv = await LogisticaApi.obtenerMiInventarioCamion();
        if (inv) await LocalDB.guardarInventarioCamion(inv);
      } else {
        const [ruta, inv] = await Promise.allSettled([
          LogisticaApi.obtenerHojaRutaActiva(),
          LogisticaApi.obtenerMiInventarioCamion(),
        ]);
        if (ruta.status === "fulfilled" && ruta.value) {
          await LocalDB.guardarRutaActiva(ruta.value);
        }
        if (inv.status === "fulfilled" && inv.value) {
          await LocalDB.guardarInventarioCamion(inv.value);
        }
      }
    } catch (err) {
      console.warn(`[NotificacionesContext] Error refrescando estado local tras ${tipoEvento}:`, err.message);
    }
  }, []);

  // Agregar notificación instantánea recibida por WebSocket con filtro estricto
  const registrarAvisoPush = useCallback(
    async (titulo, mensaje, tipo, metadata = {}) => {
      if (!idUsuarioActual) return;

      const objParaValidar = {
        titulo,
        mensaje,
        tipo,
        ...metadata,
      };

      // Filtro estricto: descarta si no le pertenece al chofer o pertenece a módulos ajenos
      if (!esNotificacionValidaChofer(objParaValidar, usuarioActual, { esWs: true })) {
        return;
      }

      const tipoNormalizado = normalizarTipoNotificacion(tipo || "AVISO_RUTA");

      const nuevaNotif = {
        id: `ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        id_usuario_destino: idUsuarioActual,
        titulo: limpiarTextoEmojis(titulo),
        mensaje: limpiarTextoEmojis(mensaje),
        tipo: tipoNormalizado,
        leido: false,
        fecha_creacion: new Date().toISOString(),
        codigo_referencia: metadata.codigo_referencia || metadata.id_asignacion || null,
        ...metadata,
      };

      setNotificaciones((prev) => {
        const actualizadas = [nuevaNotif, ...prev];
        guardarEnAlmacenamientoAislado(actualizadas);
        return actualizadas;
      });
      setConteoNoLeidas((c) => c + 1);

      // Refresco de datos operativos en LocalDB
      await refrescarEstadoLocalDesdeWS(tipo);
    },
    [idUsuarioActual, usuarioActual, guardarEnAlmacenamientoAislado, refrescarEstadoLocalDesdeWS]
  );

  // Atender solicitud de telemetría puntual emitida desde el panel Web
  const atenderSolicitudUbicacionActual = useCallback(
    async (data) => {
      if (!idUsuarioActual) return;

      // Verificar destinatario del ping
      const destId = data?.id_usuario_destino ?? data?.id_chofer ?? data?.id_repartidor ?? data?.id_usuario;
      if (destId != null && String(destId) !== String(idUsuarioActual)) {
        return;
      }

      try {
        let gpsData = null;

        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 3000,
            });
            gpsData = {
              latitud: Number(pos.coords.latitude.toFixed(6)),
              longitud: Number(pos.coords.longitude.toFixed(6)),
              precision: Math.round(pos.coords.accuracy || 10),
              velocidad: Math.max(0, Math.round((pos.coords.speed || 0) * 3.6)),
            };
          }
        } catch (_e) {
          try {
            const ultimaPos = await Location.getLastKnownPositionAsync();
            if (ultimaPos) {
              gpsData = {
                latitud: Number(ultimaPos.coords.latitude.toFixed(6)),
                longitud: Number(ultimaPos.coords.longitude.toFixed(6)),
                precision: Math.round(ultimaPos.coords.accuracy || 15),
                velocidad: 0,
              };
            }
          } catch (_e2) {}
        }

        if (!gpsData) {
          gpsData = { latitud: -19.0435, longitud: -65.258, precision: 20, velocidad: 0 };
        }

        const idAsignacionVal =
          data?.id_asignacion ||
          data?.IdAsignacion ||
          data?.id_asignacion_ruta ||
          data?.IdAsignacionRuta ||
          null;

        const payload = {
          IdUsuarioRepartidor: Number(idUsuarioActual),
          IdAsignacionRuta: idAsignacionVal ? Number(idAsignacionVal) : null,
          IdAsignacion: idAsignacionVal ? Number(idAsignacionVal) : null,
          Latitud: Number(gpsData.latitud),
          Longitud: Number(gpsData.longitud),
          PrecisionMts: Number(gpsData.precision || 10),
          Velocidad: Number(gpsData.velocidad || 0),
          VelocidadKmh: Number(gpsData.velocidad || 0),
          Bateria: 100,
          EstadoMovimiento: "En Ruta",
          FechaHora: new Date().toISOString(),
        };

        const netState = await NetInfo.fetch();
        if (netState.isConnected && netState.isInternetReachable !== false) {
          try {
            await apiClient.post("/logistica/telemetria/ping", payload, { timeout: 8000 });
            return;
          } catch (errPing) {
            console.log("[NotificacionesContext] Error enviando ping puntual, guardando en local:", errPing.message);
          }
        }

        await SyncQueue.encolarOperacion("PING_GPS", payload, gpsData, idUsuarioActual);
      } catch (err) {
        console.warn("[NotificacionesContext] Error procesando solicitar_ubicacion_actual:", err.message);
      }
    },
    [idUsuarioActual]
  );

  // Refresco solo al volver a primer plano (AppState)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        sesionActiva
      ) {
        sincronizarNotificaciones();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [sesionActiva, sincronizarNotificaciones]);

  // Refresco en transición sin conexión -> con conexión (NetInfo)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isNowConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (isNowConnected && wasConnectedRef.current === false && sesionActiva) {
        sincronizarNotificaciones();
      }
      wasConnectedRef.current = isNowConnected;
    });

    return () => {
      unsubscribe();
    };
  }, [sesionActiva, sincronizarNotificaciones]);

  // Conexión WebSocket y suscripción a eventos de logística del chofer
  useEffect(() => {
    if (!sesionActiva) {
      wsService.desconectar();
      return;
    }

    const tokenActual = token || getTokenEnMemoria();
    if (tokenActual) {
      wsService.actualizarTokenYReconectar(tokenActual);
    }

    const unsubs = [
      wsService.on("ruta_asignada", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Ruta Asignada",
          msg || "Ruta Asignada: Se te asignó una nueva ruta de distribución.",
          "RUTA_ASIGNADA",
          d
        );
      }),

      wsService.on("carga_camion_aprobada", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Carga Aprobada",
          msg || "Carga Aprobada: Tu inventario fue aprobado. Ya puedes iniciar tu reparto.",
          "CARGA_CAMION_APROBADA",
          d
        );
      }),

      wsService.on("carga_camion_observada", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Carga Observada",
          msg || "Carga Observada: Tu solicitud de carga tiene observaciones pendientes.",
          "CARGA_CAMION_OBSERVADA",
          d
        );
      }),

      wsService.on("carga_camion_rechazada", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Carga Rechazada",
          msg || "Carga Rechazada: Tu solicitud de carga fue rechazada.",
          "CARGA_CAMION_RECHAZADA",
          d
        );
      }),

      wsService.on("ruta_reordenada", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Ruta Reordenada",
          msg || "Ruta Reordenada: Se actualizó el orden de tus paradas asignadas.",
          "RUTA_REORDENADA",
          d
        );
      }),

      wsService.on("operacion_revisada", (d) => {
        const esObservado =
          d?.estado === "OBSERVADO" ||
          d?.estado === "observado" ||
          Boolean(d?.observado) ||
          Boolean(d?.es_observado);

        const msg = limpiarTextoEmojis(d?.mensaje);
        const fallback = esObservado
          ? "Operación Observada: Tu entrega o cobro fue observado por Administración."
          : "Operación Revisada: Tu entrega o cobro fue revisado por Administración.";

        registrarAvisoPush(
          esObservado ? "Operación Observada" : "Operación Revisada",
          msg || fallback,
          "OPERACION_REVISADA",
          d
        );
      }),

      wsService.on("ruta_finalizada_admin", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Ruta Finalizada",
          msg || "Ruta Finalizada: Administración dio por concluida tu ruta de hoy.",
          "RUTA_FINALIZADA_ADMIN",
          d
        );
      }),

      wsService.on("abono_qr_aprobado", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Abono QR Aprobado",
          msg || "Abono QR Aprobado: El cobro por QR fue validado y registrado.",
          "ABONO_QR_APROBADO",
          d
        );
      }),

      wsService.on("abono_aprobado", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Abono QR Aprobado",
          msg || "Abono QR Aprobado: El cobro por QR fue validado y registrado.",
          "ABONO_QR_APROBADO",
          d
        );
      }),

      wsService.on("abono_qr_rechazado", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Abono QR Observado",
          msg || "Abono QR Observado: El pago QR tiene observaciones de Administración.",
          "ABONO_QR_RECHAZADO",
          d
        );
      }),

      wsService.on("abono_rechazado", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          "Abono QR Observado",
          msg || "Abono QR Observado: El pago QR tiene observaciones de Administración.",
          "ABONO_QR_RECHAZADO",
          d
        );
      }),

      wsService.on("aviso_ruta", (d) => {
        const msg = limpiarTextoEmojis(d?.mensaje);
        registrarAvisoPush(
          d?.titulo || "Aviso de Ruta",
          msg || "Aviso de Ruta: Novedades en tu hoja de ruta.",
          "AVISO_RUTA",
          d
        );
      }),

      wsService.on("solicitar_ubicacion_actual", (d) => {
        atenderSolicitudUbicacionActual(d);
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === "function") unsub();
      });
    };
  }, [sesionActiva, token, registrarAvisoPush, atenderSolicitudUbicacionActual]);

  /**
   * Marca una notificación como leída tanto localmente como en el servidor.
   */
  const marcarComoLeida = useCallback(
    async (idNotificacion) => {
      if (!idNotificacion) return;

      setNotificaciones((prev) => {
        const actualizadas = prev.map((n) =>
          n.id === idNotificacion ? { ...n, leido: true } : n
        );
        guardarEnAlmacenamientoAislado(actualizadas);
        return actualizadas;
      });

      setConteoNoLeidas((c) => Math.max(0, c - 1));

      if (!String(idNotificacion).startsWith("ws-")) {
        await NotificacionesApi.marcarComoLeida(idNotificacion).catch(() => {});
      }
    },
    [guardarEnAlmacenamientoAislado]
  );

  /**
   * Marca todas las notificaciones pendientes como leídas.
   */
  const marcarTodasComoLeidas = useCallback(async () => {
    const idsPendientes = notificaciones
      .filter((n) => !n.leido)
      .map((n) => n.id);

    if (idsPendientes.length === 0) return;

    setNotificaciones((prev) => {
      const actualizadas = prev.map((n) => ({ ...n, leido: true }));
      guardarEnAlmacenamientoAislado(actualizadas);
      return actualizadas;
    });

    setConteoNoLeidas(0);

    await NotificacionesApi.marcarTodasComoLeidas(idsPendientes).catch(() => {});
  }, [notificaciones, guardarEnAlmacenamientoAislado]);

  /**
   * Al tocar un aviso: se marca leído y navega a la pantalla/parada relevante.
   */
  const manejarPresionarAviso = async (notificacion, navigation) => {
    try {
      if (notificacion?.id && !notificacion.leido) {
        await marcarComoLeida(notificacion.id);
      }

      const nav = navigation || navigationRef?.current;
      if (!nav) return;

      const tipoUpper = normalizarTipoNotificacion(notificacion?.tipo || "");
      switch (tipoUpper) {
        case "RUTA_ASIGNADA":
        case "RUTA_REORDENADA":
        case "RUTA_FINALIZADA_ADMIN":
        case "AVISO_RUTA":
          nav.navigate("HojaRutaTab");
          break;
        case "OPERACION_REVISADA":
          if (notificacion?.codigo_referencia) {
            nav.navigate("DetalleParada", { paradaId: notificacion.codigo_referencia });
          } else {
            nav.navigate("HojaRutaTab");
          }
          break;
        case "CARGA_CAMION_APROBADA":
        case "CARGA_CAMION_OBSERVADA":
        case "CARGA_CAMION_RECHAZADA":
          nav.navigate("MiInventarioTab");
          break;
        case "ABONO_QR_APROBADO":
        case "ABONO_QR_RECHAZADO":
          nav.navigate("CierreRutaTab");
          break;
        default:
          nav.navigate("HojaRutaTab");
          break;
      }
    } catch (err) {
      console.warn("[NotificacionesContext] Error al navegar aviso:", err.message);
    }
  };

  return (
    <NotificacionesContext.Provider
      value={{
        notificaciones,
        conteoNoLeidas,
        cargando,
        refrescarNotificaciones: sincronizarNotificaciones,
        manejarPresionarAviso,
        marcarComoLeida,
        marcarTodasComoLeidas,
      }}
    >
      {children}
    </NotificacionesContext.Provider>
  );
}

export function useNotificaciones() {
  const ctx = useContext(NotificacionesContext);
  return ctx;
}
