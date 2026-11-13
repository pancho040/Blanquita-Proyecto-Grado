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
 * contra colisiones de refresh, control estricto de concurrencia y despacho tipado de eventos.
 */
class WsService {
  constructor() {
    this.ws = null;
    this.tokenActual = null;
    this.ticketActual = null;
    this.estaConectadoVal = false;
    this.conectando = false;
    this.conectandoEnCurso = false;
    this.debeReconectar = true;
    this.reintentos = 0;
    this.reconnectTimer = null;
    this.ticketTimer = null;
    this.ticketRequestId = 0;
    this.intentoTicketFallback = false;
    this.listeners = new Map(); // evento -> Set<callback>
  }

  /**
   * Limpia temporizadores activos de reconexión y ticket de fallback.
   */
  limpiarTemporizadores() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ticketTimer) {
      clearTimeout(this.ticketTimer);
      this.ticketTimer = null;
    }
  }

  /**
   * Cancela de inmediato timers y promesas residuales de fallback a ws-ticket.
   */
  cancelarFallbackTicket() {
    if (this.ticketTimer) {
      clearTimeout(this.ticketTimer);
      this.ticketTimer = null;
    }
    this.ticketRequestId += 1;
    this.intentoTicketFallback = false;
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
   * Inicia la conexión WebSocket asegurando una única conexión activa y control de concurrencia.
   */
  async conectar(token = null, ticketForzado = null) {
    // Si ya existe socket abierto con token válido: cancelar timers residuales y no duplicar
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (esTokenValido(token) && this.tokenActual && token !== this.tokenActual) {
        this.actualizarTokenYReconectar(token);
        return;
      }
      this.cancelarFallbackTicket();
      console.log("[wsService] WebSocket ya abierto y activo. Se cancela llamada concurrente a conectar().");
      return;
    }

    // Candado de conexión en curso: cancela llamadas concurrentes mientras esté en proceso
    if (
      this.conectandoEnCurso ||
      (this.ws && this.ws.readyState === WebSocket.CONNECTING)
    ) {
      console.log("[wsService] Conexión WebSocket ya en curso o socket en CONNECTING; cancelando llamada concurrente.");
      return;
    }

    // Candado síncrono antes de cualquier operación asíncrona
    this.conectandoEnCurso = true;
    this.conectando = true;

    // Limpia temporizadores pendientes antes de abrir un nuevo socket
    this.limpiarTemporizadores();

    try {
      // 1. Obtener SIEMPRE el token más reciente y verificar su validez
      const tokenFresco = await this.resolverTokenMasReciente(token);
      if (esTokenValido(tokenFresco)) {
        this.tokenActual = tokenFresco;
      }

      if (!esTokenValido(this.tokenActual)) {
        console.log("[wsService] Sin token válido disponible; no se inicia conexión WebSocket.");
        this.conectandoEnCurso = false;
        this.conectando = false;
        return;
      }

      if (ticketForzado) {
        this.ticketActual = ticketForzado;
      }

      // Verificación de estado tras await por si otra llamada abrió el canal
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        console.log("[wsService] Socket ya abierto o conectando tras resolver token; abortando inicio redundante.");
        this.conectandoEnCurso = false;
        this.conectando = false;
        return;
      }

      // Desconectar socket previo de forma limpia y reiniciar temporizadores
      this.desconectarSocketInterno();
      this.limpiarTemporizadores();

      this.debeReconectar = true;
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

      const socketInstancia = (() => {
        try {
          return new WebSocket(url, null, options);
        } catch (_optErr) {
          // Fallback para entornos donde el 3er parámetro options no es admitido
          return new WebSocket(url);
        }
      })();

      this.ws = socketInstancia;

      socketInstancia.onopen = () => {
        if (this.ws !== socketInstancia) return;

        console.log("[wsService] Conexión WebSocket establecida con éxito.");
        this.estaConectadoVal = true;
        this.conectando = false;
        this.conectandoEnCurso = false;
        this.reintentos = 0;

        // Cancela inmediatamente cualquier timer o promesa residual de fallback a ws-ticket
        this.cancelarFallbackTicket();

        this.emitir("conexion", { conectado: true });

        // Enviar handshake de autenticación en protocolo JSON
        try {
          socketInstancia.send(
            JSON.stringify({
              tipo: "autenticacion",
              token: this.tokenActual,
              ticket: this.ticketActual,
              version: CONFIG.CLIENT_VERSION || "1.0.0",
            })
          );
        } catch (_e) {}
      };

      socketInstancia.onmessage = (event) => {
        if (this.ws !== socketInstancia) return;

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

          // Handshake exitoso o snapshot inicial cancela cualquier timer residual de ticket
          if (
            tipo === "snapshot_inicial" ||
            tipo === "snapshot" ||
            tipo === "autenticado" ||
            tipo === "autenticacion" ||
            tipo === "handshake_ok" ||
            tipo === "bienvenida"
          ) {
            this.cancelarFallbackTicket();
          }

          console.log(`[wsService] Mensaje recibido [${tipo || "generico"}]:`, data);

          if (tipo) {
            this.emitir(tipo, data);
          }
          this.emitir("mensaje", data);
        } catch (err) {
          console.warn("[wsService] Error procesando mensaje WebSocket:", err.message);
        }
      };

      socketInstancia.onerror = (err) => {
        if (this.ws !== socketInstancia) return;

        const errorMsg = err?.message || "Fallo de conexión";
        console.log("[wsService] Aviso en canal WebSocket:", errorMsg);
        this.estaConectadoVal = false;
        this.conectando = false;
        this.conectandoEnCurso = false;

        // Fallback con ws-ticket si hubo rechazo 403 o error en el handshake
        const esRechazoAuth =
          errorMsg.includes("403") ||
          errorMsg.includes("Expected HTTP 101") ||
          errorMsg.includes("handshake");

        if (esRechazoAuth && !this.intentoTicketFallback && esTokenValido(this.tokenActual)) {
          this.intentoTicketFallback = true;
          const currentRequestId = ++this.ticketRequestId;

          if (this.ticketTimer) {
            clearTimeout(this.ticketTimer);
          }

          this.ticketTimer = setTimeout(async () => {
            try {
              if (this.ticketRequestId !== currentRequestId || this.estaConectado()) {
                return;
              }
              console.log("[wsService] Handshake rechazado (403/101). Solicitando ws-ticket como fallback...");
              const ticket = await this.solicitarWsTicket(this.tokenActual);

              if (this.ticketRequestId !== currentRequestId || this.estaConectado()) {
                console.log("[wsService] Fallback de ticket descartado: socket ya conectado o intento cancelado.");
                return;
              }

              if (ticket) {
                this.ticketActual = ticket;
                this.desconectarSocketInterno();
                this.conectandoEnCurso = false;
                this.conectar(this.tokenActual, ticket);
              }
            } catch (errFallback) {
              console.log("[wsService] Error ejecutando fallback ws-ticket:", errFallback.message);
            } finally {
              if (this.ticketRequestId === currentRequestId) {
                this.ticketTimer = null;
              }
            }
          }, 0);
        }
      };

      socketInstancia.onclose = async (event) => {
        if (this.ws !== socketInstancia) return;

        console.log(`[wsService] Canal WebSocket cerrado (código: ${event?.code || "desconocido"}).`);
        this.estaConectadoVal = false;
        this.conectando = false;
        this.conectandoEnCurso = false;
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
      this.conectandoEnCurso = false;
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
   * Actualiza el token activo y fuerza una reconexión inmediata si el token es nuevo.
   * Cancela el socket previo y reinicia el contador de backoff.
   */
  actualizarTokenYReconectar(nuevoToken) {
    if (!esTokenValido(nuevoToken)) return;

    // Si el socket actual ya está conectado con ESE MISMO token, no desconectar ni reconectar en falso
    if (this.estaConectado() && this.tokenActual === nuevoToken) {
      console.log("[wsService] Socket ya conectado con el mismo token; se omite reconexión innecesaria.");
      this.cancelarFallbackTicket();
      return;
    }

    // Si ya estamos conectando en curso con ese mismo token, tampoco reconectar en falso
    if (this.conectandoEnCurso && this.tokenActual === nuevoToken) {
      console.log("[wsService] Conexión en curso con el mismo token; se omite reconexión redundante.");
      return;
    }

    console.log("[wsService] Actualizando token y reconectando WebSocket de inmediato...");

    // Limpia temporizadores pendientes y cancela promesas residuales de ticket
    this.limpiarTemporizadores();
    this.cancelarFallbackTicket();

    // Aborta limpiamente el socket previo
    this.desconectarSocketInterno();

    this.tokenActual = nuevoToken;
    this.ticketActual = null;
    this.intentoTicketFallback = false;
    this.estaConectadoVal = false;
    this.conectando = false;
    this.conectandoEnCurso = false;
    this.reintentos = 0;
    this.debeReconectar = true;

    // Conectar una sola vez de forma controlada
    this.conectar(nuevoToken);
  }

  /**
   * Programa un intento de reconexión tras desconexión con backoff exponencial.
   */
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
      this.reconnectTimer = null;
      this.conectar();
    }, tiempoTotal);
  }

  /**
   * Desconecta intencionalmente y limpia todos los recursos y timers.
   */
  desconectar() {
    this.debeReconectar = false;
    this.limpiarTemporizadores();
    this.cancelarFallbackTicket();
    this.desconectarSocketInterno();
    this.estaConectadoVal = false;
    this.conectando = false;
    this.conectandoEnCurso = false;
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
