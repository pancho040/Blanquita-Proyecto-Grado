/**
 * LogisticaWebSocket.js
 * Canal WebSocket en tiempo real para optimización de cuota en planes gratuitos (Cero Polling).
 * Maneja eventos de:
 *  - solicitud_carga_recibida / solicitud_carga_creada
 *  - operacion_ruta_registrada
 *  - ubicacion_chofer_actualizada / POSICION_CHOFER
 *  - carga_camion_aprobada
 *  - ruta_reordenada
 *  - operacion_revisada
 *  - ruta_finalizada_admin
 *  - cobro_qr_registrado
 */

class LogisticaWebSocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.wildcardListeners = new Set();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.estaConectado = false;
    this.isConnecting = false;
    this.estadoListeners = new Set();
  }

  async conectar() {
    if (typeof window === "undefined") return;
    if (this.isConnecting) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;

    try {
      const isHttps = window.location.protocol === "https:";
      const wsProtocol = isHttps ? "wss:" : "ws:";
      const host = window.location.host;

      // Obtener ticket de autenticación efímero para conectar con seguridad sin exponer JWT
      let ticketParam = "";
      try {
        const res = await fetch("/api/logistica/flota/ws-ticket", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ticket) {
            ticketParam = `?ticket=${encodeURIComponent(data.ticket)}`;
          }
        }
      } catch {
        // Fallback a conexión directa si el proxy o cookies autentican
      }

      // URL del WebSocket de logística
      const wsUrl = `${wsProtocol}//${host}/ws/logistica${ticketParam}`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.estaConectado = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this._notificarCambioEstado(true);

        // Heartbeat cada 25s para mantener el túnel vivo en proxies perimetrales (Render)
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ tipo: "ping" }));
          }
        }, 25000);
      };

      this.socket.onmessage = (event) => {
        try {
          const mensaje = JSON.parse(event.data);
          const tipoEvento = mensaje.tipo || mensaje.event || mensaje.evento;
          if (tipoEvento && tipoEvento !== "pong") {
            const datos = mensaje.datos || mensaje.payload || mensaje;
            this._procesarYDespachar(tipoEvento, datos);
          }
        } catch {
          // Ignorar mensajes no-JSON o pongs planos
        }
      };

      this.socket.onclose = () => {
        this.estaConectado = false;
        this.isConnecting = false;
        this._notificarCambioEstado(false);
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

        // Backoff exponencial con tope de 30s
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts += 1;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.conectar();
        }, delay);
      };

      this.socket.onerror = () => {
        this.isConnecting = false;
        // En caso de fallo de conexión inmediata, onclose gestionará la reconexión
      };
    } catch {
      this.estaConectado = false;
      this.isConnecting = false;
      this._notificarCambioEstado(false);
    }
  }

  suscribir(evento, callback) {
    if (!this.listeners.has(evento)) {
      this.listeners.set(evento, new Set());
    }
    this.listeners.get(evento).add(callback);

    // Retorna función desuscriptora para useEffect
    return () => {
      const setCallbacks = this.listeners.get(evento);
      if (setCallbacks) {
        setCallbacks.delete(callback);
      }
    };
  }

  suscribirATodos(callback) {
    this.wildcardListeners.add(callback);
    return () => {
      this.wildcardListeners.delete(callback);
    };
  }

  onEstadoConexion(callback) {
    this.estadoListeners.add(callback);
    callback(this.estaConectado);
    return () => {
      this.estadoListeners.delete(callback);
    };
  }

  _notificarCambioEstado(conectado) {
    this.estadoListeners.forEach((cb) => {
      try {
        cb(conectado);
      } catch {}
    });
  }

  _procesarYDespachar(tipoEvento, datos) {
    // 1. Notificar a oyentes específicos
    this._despachar(tipoEvento, datos);

    // 2. Normalización de alias para interoperabilidad perfecta
    if (tipoEvento === "solicitud_carga_creada") {
      this._despachar("solicitud_carga_recibida", datos);
    } else if (tipoEvento === "solicitud_carga_recibida") {
      this._despachar("solicitud_carga_creada", datos);
    } else if (tipoEvento === "POSICION_CHOFER") {
      this._despachar("ubicacion_chofer_actualizada", datos);
    }

    // 3. Notificar a oyentes globales (wildcard)
    this.wildcardListeners.forEach((cb) => {
      try {
        cb(tipoEvento, datos);
      } catch (err) {
        console.error("Error en wildcard listener:", err);
      }
    });

    // 4. Disparar evento del DOM global para que cualquier tabla abierta se entere
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("blanquita:ws-event", {
          detail: { tipo: tipoEvento, ...datos },
        })
      );
    }
  }

  _despachar(evento, datos) {
    const callbacks = this.listeners.get(evento);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(datos);
        } catch (err) {
          console.error(`Error en listener de WebSocket [${evento}]:`, err);
        }
      });
    }
  }

  enviar(tipo, payload = {}) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ tipo, ...payload }));
      return true;
    }
    return false;
  }

  desconectar() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.estaConectado = false;
    this.isConnecting = false;
    this._notificarCambioEstado(false);
  }
}

export const logisticaSocket = new LogisticaWebSocketClient();
