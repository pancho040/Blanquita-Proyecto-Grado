/**
 * LogisticaWebSocket.js
 * Canal WebSocket en tiempo real para optimización de cuota en planes gratuitos (Cero Polling).
 * Maneja eventos de:
 *  - solicitud_carga_recibida
 *  - operacion_ruta_registrada
 *  - ubicacion_chofer_actualizada
 *  - carga_camion_aprobada
 *  - ruta_reordenada
 *  - operacion_revisada
 *  - ruta_finalizada_admin
 */

class LogisticaWebSocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.estaConectado = false;
    this.estadoListeners = new Set();
  }

  conectar() {
    if (typeof window === "undefined") return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const isHttps = window.location.protocol === "https:";
      const wsProtocol = isHttps ? "wss:" : "ws:";
      const host = window.location.host;

      // URL del WebSocket de logística
      const wsUrl = `${wsProtocol}//${host}/ws/logistica`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.estaConectado = true;
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
          if (tipoEvento) {
            this._despachar(tipoEvento, mensaje.datos || mensaje.payload || mensaje);
          }
        } catch {
          // Ignorar mensajes no-JSON o pongs planos
        }
      };

      this.socket.onclose = () => {
        this.estaConectado = false;
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
        // En caso de fallo de conexión inmediata, onclose gestionará la reconexión
      };
    } catch {
      this.estaConectado = false;
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
    this._notificarCambioEstado(false);
  }
}

export const logisticaSocket = new LogisticaWebSocketClient();
