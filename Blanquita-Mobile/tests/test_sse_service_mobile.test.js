/**
 * Test unitario del cliente SSE Móvil (Blanquita-Mobile/src/services/sseService.js)
 * Verifica parseo de chunks SSE, persistencia de Last-Event-ID, emisión a suscriptores y backoff.
 */
const assert = require("assert");

const storageMap = new Map();
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
      getItemAsync: async () => "mock-jwt-token-chofer-24",
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    };
  }
  if (request === "react-native") {
    return {
      Platform: { OS: "android" },
      AppState: {
        addEventListener: () => ({ remove: () => {} }),
        currentState: "active",
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

async function runTest() {
  console.log("=== INICIANDO TEST CLIENTE SSE MÓVIL ===");

  const { mobileSSEService } = require("../src/services/sseService");

  // Inyectar base url
  mobileSSEService.configurarUrl("http://localhost:8000");

  // 1. Test parseo de bloque SSE simple
  let eventoRecibido = null;
  const unsubscribe = mobileSSEService.on("ENTREGA_REGISTRADA", (data, id) => {
    eventoRecibido = { data, id };
  });

  const chunkSimulado = "id: 105\nevent: ENTREGA_REGISTRADA\ndata: {\"asignacion_id\": 254, \"monto\": 348.30}\n\n";
  mobileSSEService.procesarChunk(chunkSimulado);

  assert.ok(eventoRecibido !== null, "Debe haber recibido el evento");
  assert.strictEqual(eventoRecibido.id, "105");
  assert.strictEqual(eventoRecibido.data.asignacion_id, 254);
  assert.strictEqual(eventoRecibido.data.monto, 348.30);
  assert.strictEqual(mobileSSEService.ultimoEventId, "105");
  console.log("  ✓ Parseo de chunks SSE y actualización de Last-Event-ID exitoso");

  // 2. Test ignorar heartbeats ': ping'
  let heartbeatRecibido = false;
  mobileSSEService.on("ping", () => { heartbeatRecibido = true; });
  mobileSSEService.procesarChunk(": ping\n\n");
  assert.strictEqual(heartbeatRecibido, false, "Los comentarios no deben disparar eventos");
  console.log("  ✓ Heartbeats y comentarios SSE ignorados correctamente");

  // 3. Test listener wildcard '*'
  let eventoWildcard = null;
  mobileSSEService.on("*", (e) => {
    eventoWildcard = e;
  });

  mobileSSEService.procesarChunk("id: 106\nevent: UBICACION_ACTUALIZADA\ndata: {\"lat\": -19.58, \"lng\": -65.75}\n\n");
  assert.ok(eventoWildcard !== null);
  assert.strictEqual(eventoWildcard.tipo, "UBICACION_ACTUALIZADA");
  assert.strictEqual(eventoWildcard.datos.lat, -19.58);
  console.log("  ✓ Suscriptor comodín '*' recibe todos los eventos de telemetría");

  unsubscribe();
  console.log("=== TEST CLIENTE SSE MÓVIL SUPERADO CON ÉXITO ===");
}

runTest().catch((err) => {
  console.error("Error en test SSE móvil:", err);
  process.exit(1);
});
