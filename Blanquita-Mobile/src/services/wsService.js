import { CONFIG } from "../constants/Config";
import apiClient, { getTokenEnMemoria, setTokenRenovadoListener } from "../api/client";
import * as clientModule from "../api/client";
import { SecureStorage } from "./secureStorage";

/**
 * Valida si un string de token posee formato mínimo admisible.
 */
const esTokenValido = (t) => {
  return Boolean(
    t &&
      typeof t === "string" &&
      t.trim().length > 20 &&
      t !== "undefined" &&
      t !== "null"
  );
};

/**
 * Servicio de WebSocket para Blanquita Choferes Móvil.
 * Conexión bidireccional en tiempo real a /ws/logistica.
 * Soporta autenticación fresca (token en memoria y SecureStore),
 * prevención de llamadas con token vencido, obtención de tickets protegida
 * contra colisiones de refresh, y despacho tipado de eventos.
 */
class WsService {
  constructor() {
    this.ws = null;
    this.tokenActual = null;
    this.ticketActual = null;
    this.estaConectadoVal = false;
    this.conectando = false;
    this.debeReconectar = true;
    this.reintentos = 0;
    this.reconnectTimer = null;
    this.intentoTicketFallback = false;
    this.listeners = new Map(); // evento -> Set<callback>
  }

  /**
   * Obtiene el token más reciente disponible, priorizando memoria y luego SecureStore.
   * Garantiza que nunca se intente conectar con credenciales cacheadas viejas.
   */
  async resolverTokenMasReciente(tokenParam = null) {
    if (esTokenValido(tokenParam)) {
      return tokenParam;
    }
    const enMemoria = getTokenEnMemoria();
    if (esTokenValido(enMemoria)) {
      return enMemoria;
    }
    try {
      const tokenSeguro = await SecureStorage.obtenerToken();
      if (esTokenValido(tokenSeguro)) {
        return tokenSeguro;
      }
    } catch (_e) {}

    return esTokenValido(this.tokenActual) ? this.tokenActual : null;
  }

  /**
   * Construye dinámicamente la URL de WebSocket incluyendo parámetros token y ticket.
   */
  obtenerWsUrl(token, ticket = null) {
    const baseHttp = CONFIG.API_BASE_URL || "http://192.168.1.65:8000";
    let baseWs = baseHttp.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
    if (baseWs.endsWith("/")) {
      baseWs = baseWs.slice(0, -1);
    }
    const tokenVal = token || getTokenEnMemoria() || this.tokenActual || "";
    const ticketVal = ticket || this.ticketActual || tokenVal;

    const params = [];
    if (tokenVal) {
      params.push(`token=${encodeURIComponent(tokenVal)}`);
    }
    if (ticketVal) {
      params.push(`ticket=${encodeURIComponent(ticketVal)}`);
    }

    const queryStr = params.length > 0 ? `?${params.join("&")}` : "";
    return `${baseWs}/ws/logistica${queryStr}`;
  }

  /**
   * Solicita un ticket efímero de un solo uso como fallback cuando el handshake
   * directo por JWT es rechazado con 403 Forbidden por la pasarela o proxy.
   * Utiliza apiClient para beneficiarse de la deduplicación y renovación
   * automática de token single-flight si fuese necesario.
   */
  async solicitarWsTicket(token = null) {
    try {
      if (apiClient && typeof apiClient.post === "function") {
        const resp = await apiClient.post(
          "/logistica/flota/ws-ticket",
          {},
          { timeout: 10000 }
        );
        const data = resp?.data?.datos || resp?.data || {};
        const ticket = data.ticket;
        if (ticket) {
          console.log("[wsService] Ticket WebSocket efímero obtenido exitosamente.");
          return ticket;
        }
      } else {
        const baseHttp = CONFIG.API_BASE_URL || "http://192.168.1.65:8000";
        const tok = token || this.tokenActual;
        const resp = await fetch(`${baseHttp}/logistica/flota/ws-ticket`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${tok}`,
          },
        });

        if (resp.ok) {
          const data = await resp.json();
          const ticket = data?.ticket || data?.datos?.ticket;
          if (ticket) {
            console.log("[wsService] Ticket WebSocket efímero obtenido exitosamente (fetch fallback).");
            return ticket;
          }
        }
      }
    } catch (err) {
      console.log("[wsService] Aviso solicitando ws-ticket:", err.message);
    }
    return null;
  }

  /**
   * Inicia la conexión WebSocket asegurando el token más reciente y cabeceras de autorización.
   */
  async conectar(token = null, ticketForzado = null) {
    // 1. Obtener SIEMPRE el token más reciente y verificar su validez
    const tokenFresco = await this.resolverTokenMasReciente(token);
    if (esTokenValido(tokenFresco)) {
      this.tokenActual = tokenFresco;
    }

    if (!esTokenValido(this.tokenActual)) {
      console.log("[wsService] Sin token válido disponible; no se inicia conexión WebSocket.");
      return;
    }

    if (ticketForzado) {
      this.ticketActual = ticketForzado;
    }

    // Evitar conexiones duplicadas si ya está abierta o en proceso de apertura
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.debeReconectar = true;
    this.conectando = true;

    try {
      const url = this.obtenerWsUrl(this.tokenActual, this.ticketActual);
      console.log(
        `[wsService] Conectando a WebSocket: ${url.replace(/token=([^&]{6})[^&]+/, "token=$1...")}`
      );

      // En React Native WebSocket: enviar token tanto en query param como en cabecera Authorization
      const options = {
        headers: {
          Authorization: `Bearer ${this.tokenActual}`,
        },
      };

      try {
        this.ws = new WebSocket(url, null, options);
      } catch (_optErr) {
        // Fallback para entornos donde el 3er parámetro options no es admitido
        this.ws = new WebSocket(url);
      }

      this.ws.onopen = () => {
        console.log("[wsService] Conexión WebSocket establecida con éxito.");
        this.estaConectadoVal = true;
        this.conectando = false;
        this.reintentos = 0;
        this.intentoTicketFallback = false;
        this.emitir("conexion", { conectado: true });

        // Enviar handshake de autenticación en protocolo JSON
        try {
          this.ws.send(
            JSON.stringify({
              tipo: "autenticacion",
              token: this.tokenActual,
              ticket: this.ticketActual,
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
              data = { tipo: "texto", mensaje: data };
            }
          }

          const tipo = (
            data.tipo ||
            data.event ||
            data.type ||
            data.accion ||
            ""
          ).toLowerCase();
          console.log(`[wsService] Mensaje recibido [${tipo || "generico"}]:`, data);

          if (tipo) {
            this.emitir(tipo, data);
          }
          this.emitir("mensaje", data);
        } catch (err) {
          console.warn("[wsService] Error procesando mensaje WebSocket:", err.message);
        }
      };

      this.ws.onerror = async (err) => {
        const errorMsg = err?.message || "Fallo de conexión";
        console.log("[wsService] Aviso en canal WebSocket:", errorMsg);
        this.estaConectadoVal = false;
        this.conectando = false;

        // Fallback con ws-ticket si hubo rechazo 403 o error en el handshake
        const esRechazoAuth =
          errorMsg.includes("403") ||
          errorMsg.includes("Expected HTTP 101") ||
          errorMsg.includes("handshake");

        if (esRechazoAuth && !this.intentoTicketFallback && esTokenValido(this.tokenActual)) {
          this.intentoTicketFallback = true;
          console.log("[wsService] Handshake rechazado (403/101). Solicitando ws-ticket como fallback...");
          const ticket = await this.solicitarWsTicket(this.tokenActual);
          if (ticket) {
            this.ticketActual = ticket;
            this.desconectarSocketInterno();
            this.conectar(this.tokenActual, ticket);
            return;
          }
        }
      };

      this.ws.onclose = async (event) => {
        console.log(`[wsService] Canal WebSocket cerrado (código: ${event?.code || "desconocido"}).`);
        this.estaConectadoVal = false;
        this.conectando = false;
        this.emitir("desconexion", { codigo: event?.code });

        // Código 4401 indica ticket o token inválido/expirado
        if (event?.code === 4401) {
          console.log("[wsService] Socket cerrado con 4401 (token expirado). Esperando renovación limpia...");
          try {
            if (typeof clientModule.renovarTokenSingleFlight === "function") {
              const nuevoToken = await clientModule.renovarTokenSingleFlight();
              if (esTokenValido(nuevoToken)) {
                this.actualizarTokenYReconectar(nuevoToken);
                return;
              }
            }
          } catch (errRenovacion) {
            console.log("[wsService] Intento de renovación tras 4401 no completado:", errRenovacion.message);
          }
        }

        this.programarReconexion();
      };
    } catch (err) {
      console.log("[wsService] Error instanciando WebSocket:", err.message);
      this.estaConectadoVal = false;
      this.conectando = false;
      this.programarReconexion();
    }
  }

  /**
   * Cierra el socket nativo limpiando sus listeners para evitar eventos espurios.
   */
  desconectarSocketInterno() {
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch (_e) {}
      this.ws = null;
    }
  }

  /**
   * Actualiza el token activo y fuerza una reconexión inmediata.
   * Cancela el socket previo y reinicia el contador de backoff.
   */
  actualizarTokenYReconectar(nuevoToken) {
    if (!esTokenValido(nuevoToken)) return;
    console.log("[wsService] Actualizando token y reconectando WebSocket de inmediato...");

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.desconectarSocketInterno();

    this.tokenActual = nuevoToken;
    this.ticketActual = null;
    this.intentoTicketFallback = false;
    this.estaConectadoVal = false;
    this.conectando = false;
    this.reintentos = 0;
    this.debeReconectar = true;

    this.conectar(nuevoToken);
  }

  programarReconexion() {
    if (!this.debeReconectar || !esTokenValido(this.tokenActual)) return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reintentos += 1;
    // Backoff exponencial: 1s, 2s, 4s, 8s, 16s, máx 30s
    const delayMs = Math.min(1000 * Math.pow(2, this.reintentos - 1), 30000);
    const jitter = Math.floor(Math.random() * 1000);
    const tiempoTotal = delayMs + jitter;

    console.log(
      `[wsService] Programando reconexión en ${Math.round(tiempoTotal / 1000)}s (intento ${this.reintentos})...`
    );
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
    this.desconectarSocketInterno();
    this.estaConectadoVal = false;
    this.conectando = false;
    this.reintentos = 0;
    this.intentoTicketFallback = false;
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

// Suscripción reactiva a setTokenRenovadoListener de client.js para actualizar y reconectar automáticamente
try {
  if (clientModule && typeof clientModule.setTokenRenovadoListener === "function") {
    const origSet = clientModule.setTokenRenovadoListener;
    const listenersRegistrados = new Set();

    listenersRegistrados.add((nuevoToken) => {
      if (esTokenValido(nuevoToken)) {
        wsService.actualizarTokenYReconectar(nuevoToken);
      }
    });

    try {
      clientModule.setTokenRenovadoListener = function (fn) {
        if (typeof fn === "function") {
          listenersRegistrados.add(fn);
        }
        origSet((access, refresh) => {
          listenersRegistrados.forEach((cb) => {
            try {
              cb(access, refresh);
            } catch (_err) {}
          });
        });
      };
    } catch (_e) {}

    origSet((access, refresh) => {
      listenersRegistrados.forEach((cb) => {
        try {
          cb(access, refresh);
        } catch (_err) {}
      });
    });
  } else if (typeof setTokenRenovadoListener === "function") {
    setTokenRenovadoListener((nuevoToken) => {
      if (esTokenValido(nuevoToken)) {
        wsService.actualizarTokenYReconectar(nuevoToken);
      }
    });
  }
} catch (errListener) {
  console.warn("[wsService] Aviso al registrar listener de renovación de token:", errListener.message);
}

export default wsService;
