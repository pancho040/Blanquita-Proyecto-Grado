/**
 * LogisticaSSEClient: Singleton para la conexión persistente Server-Sent Events (SSE)
 * Reemplaza y supera WebSocket ofreciendo outbox garantizada con Last-Event-ID,
 * reconexión transparente, compatibilidad con proxies HTTP y supervivencia a cambios de ruta.
 */
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { z } from "zod";

const SchemaEventoBasico = z.object({
  id_asignacion: z.union([z.number(), z.string()]).optional(),
  id_chofer: z.union([z.number(), z.string()]).optional(),
  id_ruta: z.union([z.number(), z.string()]).optional(),
  estado: z.string().optional(),
}).passthrough();

class LogisticaSSEClient {
  constructor() {
    this.abortController = null;
    this.conectado = false;
    this.estado = "desconectado"; // 'conectado' | 'reconectando' | 'desconectado'
    this.ultimoEventoId = 0;
    this.oyentes = new Map(); // tipoEvento -> Set(callbacks)
    this.oyentesEstado = new Set();
    this.reintentoTimeout = null;
    this.sucursalId = null;
    this.token = null;

    // Restaurar cursor de la sesión si existe
    if (typeof window !== "undefined") {
      try {
        const guardado = sessionStorage.getItem("blanquita_sse_last_event_id");
        if (guardado) this.ultimoEventoId = parseInt(guardado, 10) || 0;
      } catch {}
    }
  }

  setSucursal(sucursalId) {
    if (this.sucursalId !== sucursalId) {
      this.sucursalId = sucursalId;
      if (this.conectado) {
        // Reconectar para ajustar filtro de sucursal
        this.reconectar();
      }
    }
  }

  setToken(token) {
    this.token = token;
  }

  notificarEstado(conectado, estado) {
    this.conectado = conectado;
    this.estado = estado;
    this.oyentesEstado.forEach((cb) => {
      try { cb(conectado, estado); } catch (e) { console.warn("[SSE] Error en callback de estado:", e); }
    });
  }

  conectar() {
    if (typeof window === "undefined") return;
    if (this.conectado || this.estado === "conectando") return;

    if (this.reintentoTimeout) {
      clearTimeout(this.reintentoTimeout);
      this.reintentoTimeout = null;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.notificarEstado(false, "conectando");

    const params = new URLSearchParams();
    if (this.sucursalId && this.sucursalId !== "todas") {
      params.set("sucursal_id", this.sucursalId);
    }
    if (this.token) {
      params.set("token", this.token);
    }
    if (this.ultimoEventoId > 0) {
      params.set("last_event_id", this.ultimoEventoId);
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
      credentials: "include",
      signal,
      openWhenHidden: true,
      onopen: async (response) => {
        if (response.ok && response.status === 200) {
          this.notificarEstado(true, "conectado");
        } else if (response.status === 401 || response.status === 403) {
          this.notificarEstado(false, "desconectado");
          throw new Error(`SSE denegado: HTTP ${response.status}`);
        } else {
          this.notificarEstado(false, "reconectando");
        }
      },
      onmessage: (msg) => {
        if (msg.id) {
          const numId = parseInt(msg.id, 10);
          if (!isNaN(numId) && numId > this.ultimoEventoId) {
            this.ultimoEventoId = numId;
            try {
              sessionStorage.setItem("blanquita_sse_last_event_id", String(numId));
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

        // Disparar CustomEvent retrocompatible para componentes que escuchan blanquita:ws-event
        try {
          window.dispatchEvent(
            new CustomEvent("blanquita:ws-event", {
              detail: { tipo: tipoEvento, ...datos },
            })
          );
          window.dispatchEvent(
            new CustomEvent("blanquita:sse-event", {
              detail: { tipo: tipoEvento, ...datos },
            })
          );
        } catch {}
      },
      onerror: (err) => {
        if (signal.aborted) return;
        this.notificarEstado(false, "reconectando");
        // Permitir que fetchEventSource reintente automáticamente
      },
      onclose: () => {
        if (!signal.aborted) {
          this.notificarEstado(false, "reconectando");
        }
      },
    }).catch(() => {
      if (!signal.aborted) {
        this.notificarEstado(false, "reconectando");
      }
    });
  }

  reconectar() {
    this.desconectar();
    if (typeof window !== "undefined") {
      this.reintentoTimeout = setTimeout(() => {
        this.conectar();
      }, 300);
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
    this.notificarEstado(false, "desconectado");
  }

  suscribir(tipo, callback) {
    if (!this.oyentes.has(tipo)) {
      this.oyentes.set(tipo, new Set());
    }
    this.oyentes.get(tipo).add(callback);

    // Si aún no está conectado, iniciar conexión automáticamente
    this.conectar();

    return () => {
      const set = this.oyentes.get(tipo);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this.oyentes.delete(tipo);
      }
    };
  }

  onEstadoConexion(callback) {
    this.oyentesEstado.add(callback);
    callback(this.conectado, this.estado);
    return () => {
      this.oyentesEstado.delete(callback);
    };
  }

  emitir(tipo, payload) {
    const set = this.oyentes.get(tipo);
    if (set) {
      set.forEach((cb) => {
        try { cb(payload); } catch (e) { console.warn(`[SSE] Error en handler de '${tipo}':`, e); }
      });
    }
    // Oyente comodín para todos los eventos
    const setWildcard = this.oyentes.get("*");
    if (setWildcard) {
      setWildcard.forEach((cb) => {
        try { cb(tipo, payload); } catch (e) { console.warn(`[SSE] Error en handler '*':`, e); }
      });
    }
  }
}

// Singleton accesible globalmente
const GLOBAL_KEY = "__blanquita_logistica_sse__";
if (typeof window !== "undefined") {
  if (!window[GLOBAL_KEY]) {
    window[GLOBAL_KEY] = new LogisticaSSEClient();
  }
}

export const logisticaSSE = (typeof window !== "undefined" && window[GLOBAL_KEY]) 
  ? window[GLOBAL_KEY] 
  : new LogisticaSSEClient();

export default logisticaSSE;
