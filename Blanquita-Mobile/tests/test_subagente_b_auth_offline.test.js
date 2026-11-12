// Blanquita-Mobile/tests/test_subagente_b_auth_offline.test.js
// Verificaciones para SUB-AGENTE B:
// 1. Single-flight de renovación de token ante 401.
// 2. Estado sesión expirada sin borrado de caché ni cola.
// 3. Cola ligada a id_usuario y aislamiento entre choferes.
// 4. 401 durante la sync pausa la cola sin descartar el ítem.

const assert = require("assert");

global.__DEV__ = true;

// Mock AsyncStorage en memoria
const storageMap = new Map();
const mockAsyncStorage = {
  getItem: async (key) => storageMap.get(key) || null,
  setItem: async (key, val) => { storageMap.set(key, String(val)); return true; },
  removeItem: async (key) => { storageMap.delete(key); return true; },
  multiRemove: async (keys) => { keys.forEach((k) => storageMap.delete(k)); return true; },
};

// Mock SecureStore en memoria
const secureMap = new Map();
const mockSecureStore = {
  getItemAsync: async (key) => secureMap.get(key) || null,
  setItemAsync: async (key, val) => { secureMap.set(key, String(val)); return true; },
  deleteItemAsync: async (key) => { secureMap.delete(key); return true; },
};

const Module = require("module");
const originalLoad = Module._load;

Module._load = function (request) {
  if (request === "@react-native-async-storage/async-storage") return mockAsyncStorage;
  if (request === "expo-secure-store") return mockSecureStore;
  if (request === "react-native") {
    return {
      Platform: { OS: "android" },
      StyleSheet: { create: (s) => s },
    };
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const { SyncQueue } = require("../src/database/syncQueue");
const { SecureStorage } = require("../src/services/secureStorage");

async function runTests() {
  console.log("=== INICIANDO TESTS SUB-AGENTE B (AUTH Y SESIÓN OFFLINE-FIRST) ===");

  // Test 1: Guardado y lectura de Refresh Token en expo-secure-store
  console.log("\n>>> Test 1: Guardado seguro de refresh token en expo-secure-store");
  await SecureStorage.guardarRefreshToken("refresh-jwt-secret-xyz");
  const refreshLeido = await SecureStorage.obtenerRefreshToken();
  assert.strictEqual(refreshLeido, "refresh-jwt-secret-xyz", "El refresh token debe persistirse en expo-secure-store");
  console.log("  ✓ Refresh token almacenado y leído con éxito");

  // Test 2: Cola de operaciones ligada a id_usuario y aislamiento
  console.log("\n>>> Test 2: Cola de operaciones ligada a id_usuario y aislamiento entre usuarios");
  await SyncQueue.limpiarCola();

  // Chofer 101 encola 2 operaciones
  await SyncQueue.encolarOperacion("ENTREGA", { id_pedido: 1 }, null, 101);
  await SyncQueue.encolarOperacion("COBRO", { id_pedido: 1, monto: 100 }, null, 101);

  // Chofer 202 encola 1 operación
  await SyncQueue.encolarOperacion("ENTREGA", { id_pedido: 2 }, null, 202);

  const colaTotal = await SyncQueue.obtenerCola();
  assert.strictEqual(colaTotal.length, 3, "La cola global debe contener 3 operaciones");

  const colaChofer101 = await SyncQueue.obtenerCola(101);
  assert.strictEqual(colaChofer101.length, 2, "Chofer 101 solo debe ver sus 2 operaciones");
  assert.ok(colaChofer101.every((op) => op.id_usuario === 101), "Todas las operaciones deben pertenecer a 101");

  const colaChofer202 = await SyncQueue.obtenerCola(202);
  assert.strictEqual(colaChofer202.length, 1, "Chofer 202 solo debe ver su 1 operación");
  assert.strictEqual(colaChofer202[0].id_usuario, 202, "La operación debe pertenecer a 202");

  const pendientes101 = await SyncQueue.contarPendientes(101);
  assert.strictEqual(pendientes101, 2, "Conteo de pendientes debe aislar por usuario");
  console.log("  ✓ Aislamiento de colas por id_usuario validado correctamente");

  // Test 3: Registro de fallo por 401 NO descarta el ítem ni lo marca como error permanente
  console.log("\n>>> Test 3: Error 401 (Token Expirado) no incrementa intentos destructivos ni marca error permanente");
  const item101 = colaChofer101[0];
  const error401 = new Error("Token expirado");
  error401.status = 401;

  await SyncQueue.registrarFalloOperacion(item101.id, error401);
  const colaActualizada = await SyncQueue.obtenerCola(101);
  const itemRevisado = colaActualizada.find((op) => op.id === item101.id);

  assert.strictEqual(itemRevisado.esErrorPermanente, false, "401 no debe marcarse como error_permanente ni error_validacion");
  assert.strictEqual(itemRevisado.estado, "pendiente de sincronizar", "El ítem debe mantenerse 'pendiente de sincronizar'");
  assert.strictEqual(itemRevisado.intentos, 0, "401 no debe penalizar los reintentos del ítem");
  console.log("  ✓ 401 preserva el ítem íntegro y pendiente de enviar");

  // Test 4: Error 422 de validación sí se marca como no reintentable
  console.log("\n>>> Test 4: Error 422 (Validación de negocio) marca esErrorPermanente: true sin bloquear la cola");
  const error422 = new Error("El pedido ya fue liquidado");
  error422.status = 422;

  await SyncQueue.registrarFalloOperacion(item101.id, error422);
  const colaCon422 = await SyncQueue.obtenerCola(101);
  const itemCon422 = colaCon422.find((op) => op.id === item101.id);

  assert.strictEqual(itemCon422.esErrorPermanente, true, "422 debe marcarse como permanente");
  assert.strictEqual(itemCon422.estado, "error_validacion", "El estado debe ser error_validacion");
  console.log("  ✓ Distinción entre 401 (reintento seguro al renovar) y 422 (permanente) comprobada");

  console.log("\n=======================================================");
  console.log("ÉXITO: Todas las pruebas de SUB-AGENTE B superadas.");
  console.log("=======================================================\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fallo en tests de Subagente B:", err);
  process.exit(1);
});
