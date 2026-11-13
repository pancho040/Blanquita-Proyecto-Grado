import { CONFIG } from "../constants/Config";
import { getTokenEnMemoria } from "../api/client";

/**
 * Servicio de WebSocket para Blanquita Choferes Móvil.
 * Conexión bidireccional en tiempo real a /ws/logistica.
 * Soporta reconexión inteligente con backoff exponencial,
 * suscripción a eventos tipados y heartbeat.
 */

class WsService {
  constructor() {
    this.ws = null;
    this.tokenActual = null;
    this.estaConectadoVal = false;
    this.conectando = false;
    this.debeReconectar = true;
    this.reintentos = 0;
    this.reconnectTimer = null;
    this.listeners = new Map(); // evento -> Set<callback>
  }

  obtenerWsUrl(token) {
    const baseHttp = CONFIG.API_BASE_URL || "http://192.168.1.65:8000";
    let baseWs = baseHttp.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
    if (baseWs.endsWith("/")) {
      baseWs = baseWs.slice(0, -1);
    }
    const tokenVal = token || this.tokenActual || getTokenEnMemoria() || "";
    const tokenParam = tokenVal ? `?token=${encodeURIComponent(tokenVal)}` : "";
    return `${baseWs}/ws/logistica${tokenParam}`;
  }

  conectar(token = null) {
    if (token) {
      this.tokenActual = token;
    } else if (!this.tokenActual) {
      this.tokenActual = getTokenEnMemoria();
    }

    if (!this.tokenActual) {
      console.log("[wsService] Sin token disponible; no se inicia conexión WebSocket.");
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.debeReconectar = true;
    this.conectando = true;

    try {
      const url = this.obtenerWsUrl(this.tokenActual);
      console.log(`[wsService] Conectando a WebSocket: ${url.replace(/token=([^&]{6})[^&]+/, "token=$1...")}`);

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("[wsService] Conexión WebSocket establecida con éxito.");
        this.estaConectadoVal = true;
        this.conectando = false;
        this.reintentos = 0;
        this.emitir("conexion", { conectado: true });

        // Enviar handshake de autenticación si se requiere en protocolo JSON
        try {
          this.ws.send(
            JSON.stringify({
              tipo: "autenticacion",
              token: this.tokenActual,
              version: CONFIG.CLIENT_VERSION || "1.0.0",
            })
          );
        } catch (_e) {}
      };

      this.ws.onmessage = (event) => {
        try {
          let data = event.data;
          if (typeof data === "string") {
            try {
              data = JSON.parse(data);
            } catch {
              // Si no es JSON, se conserva como string en mensaje
              data = { tipo: "texto", mensaje: data };
            }
          }

          const tipo = (data.tipo || data.event || data.type || data.accion || "").toLowerCase();
          console.log(`[wsService] Mensaje recibido [${tipo || "generico"}]:`, data);

          // Emitir al tipo específico
          if (tipo) {
            this.emitir(tipo, data);
          }
          // Emitir al canal global
          this.emitir("mensaje", data);
        } catch (err) {
          console.warn("[wsService] Error procesando mensaje WebSocket:", err.message);
        }
      };

      this.ws.onerror = (err) => {
        console.log("[wsService] Aviso en canal WebSocket:", err.message || "Fallo de conexión");
        this.estaConectadoVal = false;
        this.conectando = false;
      };

      this.ws.onclose = (event) => {
        console.log(`[wsService] Canal WebSocket cerrado (código: ${event.code || "desconocido"}).`);
        this.estaConectadoVal = false;
        this.conectando = false;
        this.emitir("desconexion", { codigo: event.code });
        this.programarReconexion();
      };
    } catch (err) {
      console.log("[wsService] Error instanciando WebSocket:", err.message);
      this.estaConectadoVal = false;
      this.conectando = false;
      this.programarReconexion();
    }
  }

  programarReconexion() {
    if (!this.debeReconectar || !this.tokenActual) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reintentos += 1;
    // Backoff exponencial: 1s, 2s, 4s, 8s, 16s, máx 30s
    const delayMs = Math.min(1000 * Math.pow(2, this.reintentos - 1), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const tiempoTotal = delayMs + jitter;

    console.log(`[wsService] Programando reconexión en ${Math.round(tiempoTotal / 1000)}s (intento ${this.reintentos})...`);
    this.reconnectTimer = setTimeout(() => {
      this.conectar();
    }, tiempoTotal);
  }

  desconectar() {
    this.debeReconectar = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_e) {}
      this.ws = null;
    }
    this.estaConectadoVal = false;
    this.conectando = false;
    this.reintentos = 0;
  }

  enviar(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      this.ws.send(payload);
      return true;
    }
    console.warn("[wsService] No se pudo enviar mensaje; WebSocket no está abierto.");
    return false;
  }

  estaConectado() {
    return Boolean(this.estaConectadoVal && this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  on(evento, callback) {
    const ev = (evento || "").toLowerCase();
    if (!this.listeners.has(ev)) {
      this.listeners.set(ev, new Set());
    }
    this.listeners.get(ev).add(callback);
    return () => this.off(ev, callback);
  }

  off(evento, callback) {
    const ev = (evento || "").toLowerCase();
    const set = this.listeners.get(ev);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(ev);
      }
    }
  }

  suscribir(evento, callback) {
    return this.on(evento, callback);
  }

  emitir(evento, data) {
    const ev = (evento || "").toLowerCase();
    const set = this.listeners.get(ev);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[wsService] Error en callback de evento ${ev}:`, e);
        }
      });
    }
  }
}

export const wsService = new WsService();
export default wsService;
