const assert = require("assert");
const Module = require("module");

const originalLoad = Module._load;
Module._load = function (request) {
  if (request === "expo-secure-store") {
    return {
      getItemAsync: async () => null,
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    };
  }
  if (request === "@react-native-async-storage/async-storage") {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    };
  }
  if (request === "react-native") {
    return {
      Platform: { OS: "android" },
      StyleSheet: { create: (s) => s },
      AppState: { addEventListener: () => ({ remove: () => {} }), currentState: "active" },
    };
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const { calcularWsUrl, wsService } = require("../src/services/wsService");
const { CONFIG } = require("../src/constants/Config");

console.log("=================================================");
console.log(" TEST: CÁLCULO DINÁMICO Y AISLAMIENTO DE WS URL  ");
console.log("=================================================");

// 1. HTTP local -> WS local
const urlLocal = calcularWsUrl("http://192.168.1.65:8000");
assert.strictEqual(
  urlLocal,
  "ws://192.168.1.65:8000/ws/logistica",
  "http:// debe convertirse estrictamente en ws:// con la misma IP y puerto"
);
console.log("  ✓ Conversión HTTP local a WS correcta:", urlLocal);

// 2. HTTPS producción -> WSS producción
const urlRender = calcularWsUrl("https://blanquita-proyecto-grado-9f7j.onrender.com");
assert.strictEqual(
  urlRender,
  "wss://blanquita-proyecto-grado-9f7j.onrender.com/ws/logistica",
  "https:// debe convertirse estrictamente en wss://"
);
console.log("  ✓ Conversión HTTPS producción a WSS correcta:", urlRender);

// 3. Trailing slash y parámetros token / ticket
const urlConParams = calcularWsUrl("http://localhost:8000/", "jwt_chofer_24", "ticket_efimero_99");
assert.strictEqual(
  urlConParams,
  "ws://localhost:8000/ws/logistica?token=jwt_chofer_24&ticket=ticket_efimero_99",
  "Parámetros token y ticket deben adjuntarse sin duplicar slashes"
);
console.log("  ✓ Soporte de trailing slash y query params correcto");

// 4. Ausencia de baseHttp arroja error y nunca usa un fallback silencioso
assert.throws(
  () => calcularWsUrl(""),
  /No se ha definido la URL base/,
  "Debe arrojar error si no se pasa baseHttp"
);
console.log("  ✓ Validación de ausencia de URL base estricta (cero fallback silencioso)");

// 5. wsService.obtenerWsUrl deriva de la configuración actual
const wsServiceUrl = wsService.obtenerWsUrl("tok_test");
const baseEsperada = (CONFIG.API_BASE_URL || "").replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
assert.ok(
  wsServiceUrl.startsWith(baseEsperada),
  `wsService debe derivar de CONFIG.API_BASE_URL (${baseEsperada})`
);
console.log("  ✓ wsService.obtenerWsUrl vinculado a CONFIG.API_BASE_URL");

console.log("=================================================");
console.log(" ✅ TODAS LAS COMPROBACIONES DE WS URL SUPERADAS");
console.log("=================================================");
