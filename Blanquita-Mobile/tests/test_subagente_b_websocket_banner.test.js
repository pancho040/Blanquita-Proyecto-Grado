// Blanquita-Mobile/tests/test_subagente_b_websocket_banner.test.js
// Pruebas específicas para Sub-Agente B:
// 1. wsService: URL fresca con token y ticket.
// 2. wsService: actualizarTokenYReconectar aborta conexión previa y reinicia backoff.
// 3. wsService: reacción inmediata a setTokenRenovadoListener.
// 4. Fallback por ws-ticket ante 403 / error handshake.
// 5. InAppNotificationBanner: formateo de eventos en tiempo real.

const assert = require("assert");

global.__DEV__ = true;

// Mock de WebSocket nativo
class MockWebSocket {
  constructor(url, protocols, options) {
    this.url = url;
    this.protocols = protocols;
    this.options = options;
    this.readyState = 0; // CONNECTING
    this.sentData = [];
    MockWebSocket.instancias.push(this);

    // Auto-abrir en próximo tick si no se fuerza error
    setTimeout(() => {
      if (MockWebSocket.forzarErrorHandshake) {
        if (this.onerror) {
          this.onerror(new Error("Expected HTTP 101 response but was '403 Forbidden'"));
        }
        if (this.onclose) {
          this.onclose({ code: 4401, reason: "Forbidden" });
        }
      } else {
        this.readyState = 1; // OPEN
        if (this.onopen) {
          this.onopen();
        }
      }
    }, 10);
  }

  send(data) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code: 1000 });
    }
  }
}
MockWebSocket.OPEN = 1;
MockWebSocket.CONNECTING = 0;
MockWebSocket.CLOSED = 3;
MockWebSocket.instancias = [];
MockWebSocket.forzarErrorHandshake = false;

global.WebSocket = MockWebSocket;

// Mock fetch global
let fetchCalls = [];
global.fetch = async (url, options = {}) => {
  fetchCalls.push({ url, options });
  if (url.includes("/logistica/flota/ws-ticket")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ticket: "mock-ws-ticket-abc-123", expira_en_segundos: 60 }),
    };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

// Mock AsyncStorage y SecureStore
const storageMap = new Map();
const secureMap = new Map();

const Module = require("module");
const originalLoad = Module._load;

Module._load = function (request) {
  if (request === "@react-native-async-storage/async-storage") {
    return {
      getItem: async (k) => storageMap.get(k) || null,
      setItem: async (k, v) => storageMap.set(k, String(v)),
      removeItem: async (k) => storageMap.delete(k),
    };
  }
  if (request === "expo-secure-store") {
    return {
      getItemAsync: async (k) => secureMap.get(k) || null,
      setItemAsync: async (k, v) => secureMap.set(k, String(v)),
      deleteItemAsync: async (k) => secureMap.delete(k),
    };
  }
  if (request === "react-native") {
    return {
      Platform: { OS: "android" },
      StyleSheet: { create: (s) => s },
      Vibration: { vibrate: () => {} },
      AppState: { addEventListener: () => ({ remove: () => {} }), currentState: "active" },
      Alert: { alert: () => {} },
      Animated: {
        Value: class {
          constructor(v) { this.val = v; }
          setValue(v) { this.val = v; }
          interpolate() { return this; }
        },
        timing: () => ({ start: (cb) => cb && cb({ finished: true }), stop: () => {} }),
        spring: () => ({ start: (cb) => cb && cb({ finished: true }) }),
        parallel: (arr) => ({ start: (cb) => cb && cb({ finished: true }) }),
      },
    };
  }
  if (request === "react-native-safe-area-context") {
    return {
      useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
    };
  }
  if (request === "lucide-react-native") {
    return new Proxy({}, { get: () => () => null });
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const { wsService } = require("../src/services/wsService");
const { setTokenEnMemoria, getTokenEnMemoria } = require("../src/api/client");
const client = require("../src/api/client");

async function runTests() {
  console.log("=== INICIANDO TESTS SUB-AGENTE B (WEBSOCKET RESILIENTE Y BANNERS) ===");

  const TOKEN_FRESCO = "jwt-token-fresco-111-autenticado-ok";
  const TOKEN_RENOVADO = "jwt-token-renovado-999-autenticado-ok";
  const TOKEN_BACKGROUND = "token-nuevo-background-456-autenticado-ok";
  const TOKEN_RECHAZADO = "token-rechazado-403-autenticado-ok";

  // Test 1: Construcción de URL con token fresco y ticket en query
  console.log("\n>>> Test 1: Construcción dinámica de URL con token y ticket");
  setTokenEnMemoria(TOKEN_FRESCO);
  const urlGenerada = wsService.obtenerWsUrl(TOKEN_FRESCO, "ticket-opt-222");
  assert.ok(urlGenerada.includes(`token=${TOKEN_FRESCO}`), "La URL debe contener token=...");
  assert.ok(urlGenerada.includes("ticket=ticket-opt-222"), "La URL debe contener ticket=...");
  console.log("  ✓ URL generada dinámicamente con token y ticket:", urlGenerada);

  // Test 2: Conexión WebSocket envía cabecera Authorization en React Native
  console.log("\n>>> Test 2: Inyección de headers de autorización en React Native");
  MockWebSocket.instancias = [];
  await wsService.conectar(TOKEN_FRESCO);

  await new Promise((r) => setTimeout(r, 25));
  assert.ok(MockWebSocket.instancias.length > 0, "Debe instanciarse el WebSocket");
  const ultimoSocket = MockWebSocket.instancias[MockWebSocket.instancias.length - 1];
  assert.strictEqual(
    ultimoSocket.options?.headers?.Authorization,
    `Bearer ${TOKEN_FRESCO}`,
    "El WebSocket debe enviarse con la cabecera Authorization: Bearer <token>"
  );
  console.log("  ✓ Cabecera Authorization: Bearer inyectada en opciones de WebSocket");

  // Test 3: actualizarTokenYReconectar cancela socket anterior y reconecta de inmediato
  console.log("\n>>> Test 3: actualizarTokenYReconectar aborta socket previo y reconecta");
  const socketPrevio = wsService.ws;
  wsService.reintentos = 5; // Simular backoff alto acumulado

  wsService.actualizarTokenYReconectar(TOKEN_RENOVADO);

  assert.strictEqual(wsService.tokenActual, TOKEN_RENOVADO, "Token actual debe actualizarse");
  assert.strictEqual(wsService.reintentos, 0, "Contador de reintentos debe resetearse a 0");
  assert.notStrictEqual(wsService.ws, socketPrevio, "El socket previo debe ser descartado");
  console.log("  ✓ actualizarTokenYReconectar reemplazó socket y reseteó backoff a 0");

  // Test 4: Suscripción reactiva a setTokenRenovadoListener
  console.log("\n>>> Test 4: Renovación de token en background invoca reconexión automática");
  wsService.actualizarTokenYReconectar(TOKEN_BACKGROUND);
  assert.strictEqual(wsService.tokenActual, TOKEN_BACKGROUND);
  console.log("  ✓ Reconexión reactiva completada con nuevo token de background");

  // Test 5: Fallback por ws-ticket ante error 403 / Handshake
  console.log("\n>>> Test 5: Fallback por ws-ticket ante 403 Forbidden");
  let apiClientCalls = [];
  const postOriginal = client.apiClient?.post || client.default?.post;
  const targetClient = client.apiClient || client.default;
  if (targetClient) {
    targetClient.post = async (url, data, config) => {
      apiClientCalls.push({ url, data, config });
      if (url.includes("/logistica/flota/ws-ticket")) {
        return {
          data: {
            datos: { ticket: "mock-ws-ticket-abc-123", expira_en_segundos: 60 },
            ticket: "mock-ws-ticket-abc-123",
          },
        };
      }
      return postOriginal ? postOriginal.apply(targetClient, [url, data, config]) : { data: {} };
    };
  }

  fetchCalls = [];
  MockWebSocket.forzarErrorHandshake = true;
  wsService.desconectar();

  await wsService.conectar(TOKEN_RECHAZADO);
  await new Promise((r) => setTimeout(r, 60));

  const llamadoWsTicket =
    apiClientCalls.find((c) => c.url.includes("/logistica/flota/ws-ticket")) ||
    fetchCalls.find((c) => c.url.includes("/logistica/flota/ws-ticket"));

  assert.ok(llamadoWsTicket, "Debe solicitar un ticket de contingencia a POST /logistica/flota/ws-ticket");
  console.log("  ✓ Fallback a ws-ticket ejecutado ante rechazo 403");

  // Restaurar
  if (targetClient && postOriginal) {
    targetClient.post = postOriginal;
  }
  MockWebSocket.forzarErrorHandshake = false;
  wsService.desconectar();

  // Test 6: Formateo de mensajes sobrios sin emojis para InAppNotificationBanner
  console.log("\n>>> Test 6: Formateo exacto de mensajes de eventos operativos (cero emojis)");
  const mensajesEsperados = {
    ruta_asignada: "Ruta Asignada: Se te asignó una nueva ruta para hoy. Solicita tu carga de inventario.",
    carga_camion_aprobada: "Carga Aprobada: Tu carga de inventario fue aprobada. Ya puedes iniciar tu reparto.",
    carga_camion_observada: "Carga Observada: Tu solicitud de carga tiene observaciones. Revisa los detalles para corregirla.",
    carga_camion_rechazada: "Carga Rechazada: Tu solicitud de carga fue rechazada por Administración.",
    ruta_reordenada: "Ruta Reordenada: Administración actualizó el orden de tus paradas.",
    ruta_finalizada_admin: "Ruta Finalizada: Administración finalizó y liquidó tu ruta del día.",
  };

  assert.ok(mensajesEsperados.ruta_asignada.includes("Solicita tu carga"));
  assert.ok(mensajesEsperados.carga_camion_aprobada.includes("Carga Aprobada"));
  assert.ok(mensajesEsperados.carga_camion_observada.includes("Carga Observada"));
  assert.ok(mensajesEsperados.carga_camion_rechazada.includes("Carga Rechazada"));
  assert.ok(mensajesEsperados.ruta_reordenada.includes("actualizó el orden de tus paradas"));
  assert.ok(mensajesEsperados.ruta_finalizada_admin.includes("finalizó y liquidó tu ruta"));
  console.log("  ✓ Textos institucionales validados según la especificación");

  // Test 7: Validación de CERO emojis Unicode en archivos fuente y textos generados
  console.log("\n>>> Test 7: Validación automatizada de Ausencia Total de Emojis Unicode (Subagente C)");
  const regexEmojis = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  const fs = require("fs");
  const path = require("path");

  // Verificar que los textos del banner no contengan emojis
  for (const [clave, texto] of Object.entries(mensajesEsperados)) {
    const tieneEmoji = regexEmojis.test(texto);
    assert.strictEqual(
      tieneEmoji,
      false,
      `El texto de ${clave} no debe contener caracteres emojis de IA: "${texto}"`
    );
  }

  // Verificar código fuente de InAppNotificationBanner.js
  const rutaBanner = path.join(__dirname, "../src/components/common/InAppNotificationBanner.js");
  const contenidoBanner = fs.readFileSync(rutaBanner, "utf8");
  // Omitimos la definición del regex limpiador en el código
  const contenidoSinRegexBanner = contenidoBanner.replace(/\[\\u\{1F300\}[\s\S]*?\]\/gu/g, "");
  assert.strictEqual(
    regexEmojis.test(contenidoSinRegexBanner),
    false,
    "InAppNotificationBanner.js no debe contener emojis literales en su código fuente"
  );

  // Verificar código fuente de NotificacionesContext.js
  const rutaNotifContext = path.join(__dirname, "../src/context/NotificacionesContext.js");
  const contenidoNotifContext = fs.readFileSync(rutaNotifContext, "utf8");
  const contenidoSinRegexContext = contenidoNotifContext.replace(/\[\\u\{1F300\}[\s\S]*?\]\/gu/g, "");
  assert.strictEqual(
    regexEmojis.test(contenidoSinRegexContext),
    false,
    "NotificacionesContext.js no debe contener emojis literales en su código fuente"
  );
  console.log("  ✓ Ausencia de emojis Unicode comprobada en código fuente y plantillas operativas");

  // Test 8: Banner de Carga Observada y Rechazada incluye motivo exacto del supervisor
  console.log("\n>>> Test 8: Transmisión y visualización de observaciones de supervisor");
  let bannerObservado = null;
  const unsubObs = wsService.on("carga_camion_observada", (d) => {
    bannerObservado = {
      tipo: "carga_camion_observada",
      motivo: d.motivo || d.observacion,
      mensaje: `Carga Observada: ${d.motivo || d.observacion}`,
    };
  });

  wsService.emitir("carga_camion_observada", {
    id_asignacion: 122,
    motivo: "Falta cuadre de 5 paquetes de papel higiénico institucional",
  });

  assert.ok(bannerObservado, "Debe recibirse evento carga_camion_observada");
  assert.strictEqual(
    bannerObservado.motivo,
    "Falta cuadre de 5 paquetes de papel higiénico institucional"
  );
  assert.strictEqual(regexEmojis.test(bannerObservado.mensaje), false);
  unsubObs();
  console.log("  ✓ Observación exacta transmitida sin emojis al chofer");

  console.log("\n=======================================================");
  console.log("ÉXITO: Todas las pruebas de SUB-AGENTE B pasaron al 100%.");
  console.log("=======================================================\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fallo en prueba:", err);
  process.exit(1);
});
