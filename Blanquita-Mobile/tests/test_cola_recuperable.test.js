/**
 * Test Suite: Cola de Sincronización Recuperable y Migración de Ítems Rechazados
 * Verifica HU-27 / HU-28 y Requerimientos Fase 3:
 * 1. Error 422 pasa el ítem a 'REQUIERE_CORRECCION' sin bloquear otros ítems.
 * 2. SyncQueue.actualizarOperacion preserva id e idempotencyKey.
 * 3. Migración automática del ítem '11d2d239-ffa6-43d0-ba40-aa1f55366b88' en obtenerCola().
 */

global.__DEV__ = true;

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const assert = require("assert");

// Mock de AsyncStorage en memoria
const storage = {};
const AsyncStorageMock = {
  getItem: async (k) => storage[k] || null,
  setItem: async (k, v) => {
    storage[k] = String(v);
    return true;
  },
  removeItem: async (k) => {
    delete storage[k];
    return true;
  },
  clear: async () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    return true;
  },
};

const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return AsyncStorageMock;
  }
  return originalLoad.apply(this, arguments);
};

const { SyncQueue } = require("../src/database/syncQueue");

(async () => {
  console.log("===============================================================");
  console.log(" TEST: COLA RECUPERABLE Y MIGRACIÓN DE ÍTEMS ATASCADOS (MOBILE)");
  console.log("===============================================================");

  // 1. Simular ítem histórico atascado en storage con ID 11d2d239-ffa6-43d0-ba40-aa1f55366b88
  console.log("1. Verificando migración automática de ítem atascado 11d2d239...");
  const colaHistorica = [
    {
      id: "11d2d239-ffa6-43d0-ba40-aa1f55366b88",
      idempotencyKey: "11d2d239-ffa6-43d0-ba40-aa1f55366b88",
      tipo: "ENTREGA_CON_COBRO",
      estado: "error_validacion",
      esErrorPermanente: true,
      ultimoError: "El monto cobrado (Bs. 375.00) excede el total efectivamente entregado (Bs. 348.30)",
      payload: {
        id_punto_venta: 55,
        id_cliente: 194,
        id_asignacion: 254,
        monto_total: 348.30,
        cobro: { monto_total: 375.00, pagos: [{ metodo: "EFECTIVO", monto: 375.00 }] },
      },
    },
    {
      id: "operacion-exitosa-2",
      idempotencyKey: "operacion-exitosa-2",
      tipo: "ENTREGA",
      estado: "pendiente de sincronizar",
      esErrorPermanente: false,
      payload: { id_punto_venta: 56 },
    },
  ];

  await AsyncStorageMock.setItem("@blanquita_sync_queue", JSON.stringify(colaHistorica));

  // Al leer la cola debe migrar automáticamente a 'REQUIERE_CORRECCION'
  const colaLeida = await SyncQueue.obtenerCola();
  assert.strictEqual(colaLeida.length, 2, "Deben existir 2 operaciones");
  const itemMigrado = colaLeida.find((x) => x.id === "11d2d239-ffa6-43d0-ba40-aa1f55366b88");
  assert(itemMigrado, "El ítem debe existir");
  assert.strictEqual(itemMigrado.estado, "REQUIERE_CORRECCION", "El estado debió migrar a REQUIERE_CORRECCION");
  console.log("   -> OK: Ítem 11d2d239 migrado exitosamente a 'REQUIERE_CORRECCION'.");

  // 2. Probar actualizarOperacion con el mismo id e idempotencyKey
  console.log("2. Verificando actualizarOperacion con conservación de idempotencia...");
  const payloadCorregido = {
    ...itemMigrado.payload,
    cobro: { monto_total: 348.30, pagos: [{ metodo: "EFECTIVO", monto: 348.30 }] },
  };

  const resultadoAct = await SyncQueue.actualizarOperacion(
    "11d2d239-ffa6-43d0-ba40-aa1f55366b88",
    payloadCorregido,
    "pendiente de sincronizar"
  );
  assert.strictEqual(resultadoAct, true, "actualizarOperacion debió retornar true");

  const colaActualizada = await SyncQueue.obtenerCola();
  const itemCorregido = colaActualizada.find((x) => x.id === "11d2d239-ffa6-43d0-ba40-aa1f55366b88");
  assert.strictEqual(itemCorregido.estado, "pendiente de sincronizar", "Debe volver a pendiente de sincronizar");
  assert.strictEqual(itemCorregido.esErrorPermanente, false, "esErrorPermanente debe ser false");
  assert.strictEqual(itemCorregido.intentos, 0, "intentos debe resetearse a 0");
  assert.strictEqual(itemCorregido.idempotencyKey, "11d2d239-ffa6-43d0-ba40-aa1f55366b88", "idempotencyKey debe preservarse");
  assert.strictEqual(itemCorregido.payload.cobro.monto_total, 348.30, "Monto cobrado debe ser 348.30");
  console.log("   -> OK: Operación corregida preservando idempotencia transaccional.");

  // 3. Probar que registrarFalloOperacion con 422 setea 'REQUIERE_CORRECCION'
  console.log("3. Verificando registrarFalloOperacion ante HTTP 422...");
  await SyncQueue.registrarFalloOperacion("operacion-exitosa-2", {
    status: 422,
    message: "Validación de negocio fallida",
  });
  const colaConFallo = await SyncQueue.obtenerCola();
  const itemConFallo = colaConFallo.find((x) => x.id === "operacion-exitosa-2");
  assert.strictEqual(itemConFallo.estado, "REQUIERE_CORRECCION");
  assert.strictEqual(itemConFallo.esErrorPermanente, true);
  console.log("   -> OK: Fallo 422 pasa correctamente a REQUIERE_CORRECCION.");

  console.log("TODAS LAS PRUEBAS DE COLA RECUPERABLE PASARON CON ÉXITO.");
})();
