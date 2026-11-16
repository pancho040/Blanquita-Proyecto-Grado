/**
 * LogisticaSSEClient.js
 * Módulo único y canónico para la comunicación en tiempo real de Logística y Flota vía Server-Sent Events (SSE).
 * Provee:
 * - Singleton de conexión `logisticaSSE` con reconexión por backoff y cursor Last-Event-ID persistido.
 * - Cero tokens en URL (autenticación estricta por cookie/Bearer en cabecera).
 * - Pausa/reanudación reactiva con 'visibilitychange'.
 * - Sondeo de respaldo automático únicamente cuando el stream está caído y la pestaña visible.
 * - Hooks de React: `useLogisticaEventos` y `useEstadoConexionLogistica`.
 */

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useEffect, useState, useRef, useCallback } from "react";
import { z } from "zod";

export const ESTADO_EN_LINEA = "En línea";
export const ESTADO_RECONECTANDO = "Reconectando";
export const ESTADO_SIN_CONEXION = "Sin conexión";

const SchemaEventoBasico = z.object({
  id_asignacion: z.union([z.number(), z.string()]).optional(),
  id_chofer: z.union([z.number(), z.string()]).optional(),
  id_ruta: z.union([z.number(), z.string()]).optional(),
  estado: z.string().optional(),
}).passthrough();

const LAST_EVENT_STORAGE_KEY = "blanquita_sse_last_event_id";

export class LogisticaSSEClient {
  constructor() {
    this.abortController = null;
    this.conectado = false;
    this.estadoTexto = ESTADO_SIN_CONEXION; // "En línea" | "Reconectando" | "Sin conexión"
    this.ultimoEventoId = 0;
    this.oyentes = new Map(); // tipoEvento -> Set(callbacks)
    this.oyentesEstado = new Set();
    this.reintentoTimeout = null;
    this.sucursalId = null;
    this.token = null;
    this.reintentosFallidos = 0;
    this.sondeoTimer = null;

    if (typeof window !== "undefined") {
      try {
        const guardado = sessionStorage.getItem(LAST_EVENT_STORAGE_KEY);
        if (guardado) this.ultimoEventoId = parseInt(guardado, 10) || 0;

        const params = new URLSearchParams(window.location.search);
        const sucUrl = params.get("sucursal") || params.get("sucursal_id");
        if (sucUrl && sucUrl !== "todas") {
          this.sucursalId = String(sucUrl);
        }
      } catch {}

      // Escuchar cambios de visibilidad de la pestaña
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          // Pestaña recupera foco: si no está en línea, reconectar inmediatamente
          if (this.estadoTexto !== ESTADO_EN_LINEA) {
            this.reconectar();
          }
        }
      });

      // Cerrar limpiamente la conexión al descargar o cambiar de documento
      window.addEventListener("pagehide", () => {
        this.desconectar();
      });
      window.addEventListener("beforeunload", () => {
        this.desconectar();
      });
    }
  }

  setSucursal(sucursalId) {
    const normalizado = (sucursalId == null || sucursalId === "todas") ? null : String(sucursalId);
    if (this.sucursalId !== normalizado) {
      this.sucursalId = normalizado;
      if (this.conectado) {
        this.reconectar();
      }
    }
  }

  setToken(token) {
    this.token = token;
  }

  getEstado() {
    return this.estadoTexto;
  }

  estaConectado() {
    return this.conectado;
  }

  notificarEstado(nuevoEstadoTexto) {
    this.estadoTexto = nuevoEstadoTexto;
    this.conectado = (nuevoEstadoTexto === ESTADO_EN_LINEA);
    this.oyentesEstado.forEach((cb) => {
      try {
        cb(this.estadoTexto, this.conectado);
      } catch (e) {
        console.warn("[SSE] Error en callback de estado:", e);
      }
    });

    // Controlar sondeo de respaldo: solo si NO está en línea y pestaña visible
    if (this.conectado) {
      this.detenerSondeoRespaldo();
      this.reintentosFallidos = 0;
    } else {
      this.iniciarSondeoRespaldo();
    }
  }

  conectar() {
    if (typeof window === "undefined") return;
    if (this.conectado || this.estadoTexto === ESTADO_RECONECTANDO) return;

    if (this.reintentoTimeout) {
      clearTimeout(this.reintentoTimeout);
      this.reintentoTimeout = null;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.notificarEstado(ESTADO_RECONECTANDO);

    // Cero tokens en Query String: solo sucursal y cursor de respaldo
    const params = new URLSearchParams();
    if (this.sucursalId && this.sucursalId !== "todas") {
      params.set("sucursal_id", this.sucursalId);
    }
    if (this.ultimoEventoId > 0) {
      params.set("last_event_id", String(this.ultimoEventoId));
    }

    const qs = params.toString();
    const url = `/api/logistica/eventos/stream${qs ? `?${qs}` : ""}`;

    const headers = {
      "Accept": "text/event-stream",
    };
    if (this.ultimoEventoId > 0) {
      headers["Last-Event-ID"] = String(this.ultimoEventoId);
    }
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    fetchEventSource(url, {
      method: "GET",
      headers,
      credentials: "include", // Cookie HttpOnly
      signal,
      openWhenHidden: true,
      onopen: async (response) => {
        if (response.ok && response.status === 200) {
          this.reintentosFallidos = 0;
          this.notificarEstado(ESTADO_EN_LINEA);
        } else if (response.status === 401 || response.status === 403) {
          this.notificarEstado(ESTADO_SIN_CONEXION);
          throw new Error(`SSE denegado: HTTP ${response.status}`);
        } else {
          this.programarReintento();
        }
      },
      onmessage: (msg) => {
        if (msg.id) {
          const numId = parseInt(msg.id, 10);
          if (!isNaN(numId) && numId > this.ultimoEventoId) {
            this.ultimoEventoId = numId;
            try {
              sessionStorage.setItem(LAST_EVENT_STORAGE_KEY, String(numId));
            } catch {}
          }
        }

        if (!msg.data) return;

        let datos = {};
        try {
          datos = JSON.parse(msg.data);
          SchemaEventoBasico.safeParse(datos);
        } catch {
          datos = { raw: msg.data };
        }

        const tipoEvento = msg.event || "mensaje";
        this.emitir(tipoEvento, datos);
      },
      onerror: (err) => {
        if (signal.aborted) return;
        this.programarReintento();
      },
      onclose: () => {
        if (!signal.aborted) {
          this.programarReintento();
        }
      },
    }).catch(() => {
      if (!signal.aborted) {
        this.programarReintento();
      }
    });
  }

  programarReintento() {
    this.notificarEstado(ESTADO_RECONECTANDO);
    this.reintentosFallidos += 1;
    const backoffMs = Math.min(500 * Math.pow(1.5, this.reintentosFallidos), 10000);

    if (this.reintentoTimeout) clearTimeout(this.reintentoTimeout);
    this.reintentoTimeout = setTimeout(() => {
      this.conectar();
    }, backoffMs);
  }

  iniciarSondeoRespaldo() {
    if (this.sondeoTimer || typeof window === "undefined") return;
    // Disparar un sondeo cada 15 segundos si el stream está caído y la ventana activa
    this.sondeoTimer = setInterval(() => {
      if (!document.hidden && this.estadoTexto !== ESTADO_EN_LINEA) {
        try {
          window.dispatchEvent(new CustomEvent("blanquita:sse-fallback-poll"));
        } catch {}
      }
    }, 15000);
  }

  detenerSondeoRespaldo() {
    if (this.sondeoTimer) {
      clearInterval(this.sondeoTimer);
      this.sondeoTimer = null;
    }
  }

  reconectar() {
    this.desconectar();
    if (typeof window !== "undefined") {
      this.reintentoTimeout = setTimeout(() => {
        this.conectar();
      }, 200);
    }
  }

  desconectar() {
    if (this.reintentoTimeout) {
      clearTimeout(this.reintentoTimeout);
      this.reintentoTimeout = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.notificarEstado(ESTADO_SIN_CONEXION);
  }

  /**
   * Suscribirse a uno o varios tipos de evento.
   * @param {string|string[]} tipos - Tipo de evento o arreglo de tipos (o "*")
   * @param {Function} callback - (datos, tipo) => void
   * @returns {Function} Función para cancelar la suscripción.
   */
  on(tipos, callback) {
    const listaTipos = Array.isArray(tipos) ? tipos : [tipos];

    listaTipos.forEach((tipo) => {
      if (!this.oyentes.has(tipo)) {
        this.oyentes.set(tipo, new Set());
      }
      this.oyentes.get(tipo).add(callback);
    });

    // Iniciar conexión automática al primer suscriptor
    this.conectar();

    return () => {
      listaTipos.forEach((tipo) => {
        const set = this.oyentes.get(tipo);
        if (set) {
          set.delete(callback);
          if (set.size === 0) this.oyentes.delete(tipo);
        }
      });
    };
  }

  /**
   * Escuchar cambios en el estado de conexión ("En línea" | "Reconectando" | "Sin conexión").
   * @param {Function} callback - (estadoTexto, conectado) => void
   * @returns {Function} Función para cancelar la suscripción.
   */
  onEstado(callback) {
    this.oyentesEstado.add(callback);
    callback(this.estadoTexto, this.conectado);
    return () => {
      this.oyentesEstado.delete(callback);
    };
  }

  emitir(tipo, payload) {
    const set = this.oyentes.get(tipo);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload, tipo);
        } catch (e) {
          console.warn(`[SSE] Error en handler de '${tipo}':`, e);
        }
      });
    }

    const setWildcard = this.oyentes.get("*");
    if (setWildcard) {
      setWildcard.forEach((cb) => {
        try {
          cb(payload, tipo);
        } catch (e) {
          console.warn(`[SSE] Error en handler '*':`, e);
        }
      });
    }

    // Disparar CustomEvent unificado
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("blanquita:sse-event", {
            detail: { tipo, ...payload },
          })
        );
      } catch {}
    }
  }

  forzarActualizacion() {
    this.reconectar();
  }
}

// Instancia singleton compartida
const GLOBAL_KEY = Symbol.for("blanquita.logisticaSSE");
const g = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {});

export const logisticaSSE = (g[GLOBAL_KEY] ??= new LogisticaSSEClient());

/**
 * Hook para consumir el estado de la conexión en tiempo real.
 * @returns {"En línea" | "Reconectando" | "Sin conexión"}
 */
export function useEstadoConexionLogistica() {
  const [estado, setEstado] = useState(() => logisticaSSE.getEstado());

  useEffect(() => {
    const unsub = logisticaSSE.onEstado((nuevoEstado) => {
      setEstado(nuevoEstado);
    });
    return unsub;
  }, []);

  return estado;
}

/**
 * Hook para suscribirse a eventos de logística en tiempo real.
 * @param {Object} params
 * @param {string|string[]} params.tipos - Uno o más tipos de evento a escuchar.
 * @param {Function} params.onEvento - Callback ejecutado al recibir un evento: (payload, tipo) => void
 * @param {string|number} [params.sucursalId] - Opcional, sucursal a filtrar.
 * @param {boolean} [params.enabled=true] - Si está habilitada la escucha.
 */
export function useLogisticaEventos({ tipos, onEvento, sucursalId, enabled = true }) {
  const onEventoRef = useRef(onEvento);
  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  const tiposKey = Array.isArray(tipos) ? tipos.join(",") : String(tipos || "");

  useEffect(() => {
    if (!enabled) return;

    if (sucursalId !== undefined && sucursalId !== null) {
      logisticaSSE.setSucursal(sucursalId);
    }

    const unsub = logisticaSSE.on(tipos, (payload, tipo) => {
      if (onEventoRef.current) {
        onEventoRef.current(payload, tipo);
      }
    });

    return () => {
      unsub();
    };
  }, [tiposKey, sucursalId, enabled]);
}

export default logisticaSSE;
