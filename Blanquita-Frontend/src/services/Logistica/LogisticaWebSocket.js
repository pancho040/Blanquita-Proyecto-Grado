/**
 * LogisticaWebSocket.js (Fachada Retrocompatible sobre LogisticaSSEClient)
 * Toda la comunicación en tiempo real de Logística y Flota ha migrado a Server-Sent Events (SSE).
 * Este módulo provee una fachada con la misma API de logisticaSocket delegando completamente
 * en logisticaSSE, evitando aperturas de WebSocket paralelos y garantizando un único stream activo.
 */
import { logisticaSSE } from "./LogisticaSSEClient";

class LogisticaWebSocketFacade {
  constructor() {
    this.sse = logisticaSSE;
  }

  conectar(token = null) {
    if (token) {
      this.sse.setToken(token);
    }
    this.sse.conectar();
  }

  desconectar() {
    this.sse.desconectar();
  }

  setSucursal(sucursalId) {
    this.sse.setSucursal(sucursalId);
  }

  setToken(token) {
    this.sse.setToken(token);
  }

  on(evento, callback) {
    return this.sse.on(evento, callback);
  }

  off(evento, callback) {
    return this.sse.off(evento, callback);
  }

  onEstadoChange(callback) {
    return this.sse.onEstadoChange((conectado, estado) => {
      callback(conectado, estado);
    });
  }

  estaConectado() {
    return this.sse.conectado;
  }

  enviar(tipo, payload = {}) {
    // Los eventos en SSE se emiten a través de mutaciones HTTP / API REST
    return true;
  }
}

// Singleton global persistente
const g = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {});
const WS_FACADE_KEY = Symbol.for("blanquita.logisticaSocketFacade");

export const logisticaSocket = (g[WS_FACADE_KEY] ??= new LogisticaWebSocketFacade());
export default logisticaSocket;
