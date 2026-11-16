/**
 * Cliente SSE (Server-Sent Events) para Blanquita-Mobile
 * Conecta con cabecera Authorization: Bearer <token>
 * Soporta Last-Event-ID persistido en AsyncStorage para reconexión sin pérdida
 * Backoff exponencial y escucha de AppState para refresco al volver al primer plano.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { SecureStorage } from "./secureStorage";

const KEY_LAST_EVENT_ID = "blanquita_mobile_sse_last_event_id";
const DEFAULT_BASE_URL = "http://localhost:8000";

class MobileSSEService {
  constructor() {
    this.activo = false;
    this.xhr = null;
    this.listeners = new Map(); // tipoEvento -> Set(callbacks)
    this.reintentoTimeout = null;
    this.reintentoDelay = 1000;
    this.maxReintentoDelay = 30000;
    this.appStateSubscription = null;
    this.ultimoEventId = null;
    this.buffer = "";
    this.baseUrl = DEFAULT_BASE_URL;
  }

  configurarUrl(url) {
    if (url) {
      this.baseUrl = url.replace(/\/+$/, "");
    }
  }

  async inicializar() {
    try {
      const guardado = await AsyncStorage.getItem(KEY_LAST_EVENT_ID);
      if (guardado) {
        this.ultimoEventId = guardado;
      }
    } catch {}

    // Escuchar cambios de estado de la app (Background / Foreground)
    if (!this.appStateSubscription && AppState && AppState.addEventListener) {
      this.appStateSubscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          // Si la conexión se cayó en background, reconectar de inmediato
          if (this.activo && !this.xhr) {
            this.conectar();
          }
        }
      });
    }
  }

  async conectar() {
    if (this.reintentoTimeout) {
      clearTimeout(this.reintentoTimeout);
      this.reintentoTimeout = null;
    }

    this.activo = true;
    await this.inicializar();

    const token = await SecureStorage.obtenerToken().catch(() => null);
    if (!token) {
      this.programarReintento();
      return;
    }

    try {
      if (this.xhr) {
        try { this.xhr.abort(); } catch {}
        this.xhr = null;
      }

      const url = `${this.baseUrl}/logistica/eventos/stream`;
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;
      this.buffer = "";

      xhr.open("GET", url, true);
      xhr.setRequestHeader("Accept", "text/event-stream");
      xhr.setRequestHeader("Cache-Control", "no-cache");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      if (this.ultimoEventId) {
        xhr.setRequestHeader("Last-Event-ID", String(this.ultimoEventId));
      }

      let posicionProcesada = 0;

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const textoCompleto = xhr.responseText || "";
          const nuevosDatos = textoCompleto.substring(posicionProcesada);
          posicionProcesada = textoCompleto.length;

          if (nuevosDatos) {
            this.procesarChunk(nuevosDatos);
          }

          if (xhr.readyState === 4) {
            this.xhr = null;
            if (this.activo) {
              this.programarReintento();
            }
          }
        }
      };

      xhr.onerror = () => {
        this.xhr = null;
        if (this.activo) {
          this.programarReintento();
        }
      };

      xhr.send();
      this.reintentoDelay = 1000; // Reset backoff en intento
    } catch {
      this.programarReintento();
    }
  }

  procesarChunk(chunk) {
    this.buffer += chunk;
    const partes = this.buffer.split("\n\n");
    // La última parte puede ser incompleta
    this.buffer = partes.pop() || "";

    for (const bloque of partes) {
      this.parsearBloqueSSE(bloque.trim());
    }
  }

  parsearBloqueSSE(bloque) {
    if (!bloque || bloque.startsWith(":")) return; // Comentarios o heartbeats

    const lineas = bloque.split("\n");
    let tipoEvento = "message";
    let dataStr = "";
    let eventId = null;

    for (const linea of lineas) {
      if (linea.startsWith("event:")) {
        tipoEvento = linea.substring(6).trim();
      } else if (linea.startsWith("data:")) {
        dataStr += linea.substring(5).trim();
      } else if (linea.startsWith("id:")) {
        eventId = linea.substring(3).trim();
      }
    }

    if (eventId) {
      this.ultimoEventId = eventId;
      AsyncStorage.setItem(KEY_LAST_EVENT_ID, String(eventId)).catch(() => {});
    }

    let datosParseados = dataStr;
    try {
      datosParseados = JSON.parse(dataStr);
    } catch {}

    this.emitir(tipoEvento, datosParseados, eventId);
  }

  emitir(tipo, datos, id) {
    const cbs = this.listeners.get(tipo);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(datos, id);
        } catch (e) {
          console.error(`[MobileSSE] Error en listener de ${tipo}:`, e);
        }
      }
    }
    // Listener global '*'
    const globalCbs = this.listeners.get("*");
    if (globalCbs) {
      for (const cb of globalCbs) {
        try {
          cb({ tipo, datos, id });
        } catch {}
      }
    }
  }

  on(tipoEvento, callback) {
    if (!this.listeners.has(tipoEvento)) {
      this.listeners.set(tipoEvento, new Set());
    }
    this.listeners.get(tipoEvento).add(callback);
    return () => this.off(tipoEvento, callback);
  }

  off(tipoEvento, callback) {
    const cbs = this.listeners.get(tipoEvento);
    if (cbs) {
      cbs.delete(callback);
    }
  }

  programarReintento() {
    if (!this.activo) return;
    if (this.reintentoTimeout) clearTimeout(this.reintentoTimeout);

    this.reintentoTimeout = setTimeout(() => {
      this.conectar();
    }, this.reintentoDelay);

    // Backoff exponencial con jitter
    this.reintentoDelay = Math.min(this.reintentoDelay * 2, this.maxReintentoDelay);
  }

  desconectar() {
    this.activo = false;
    if (this.reintentoTimeout) {
      clearTimeout(this.reintentoTimeout);
      this.reintentoTimeout = null;
    }
    if (this.xhr) {
      try { this.xhr.abort(); } catch {}
      this.xhr = null;
    }
  }

  async resetearCursor() {
    this.ultimoEventId = null;
    await AsyncStorage.removeItem(KEY_LAST_EVENT_ID).catch(() => {});
  }
}

export const mobileSSEService = new MobileSSEService();
