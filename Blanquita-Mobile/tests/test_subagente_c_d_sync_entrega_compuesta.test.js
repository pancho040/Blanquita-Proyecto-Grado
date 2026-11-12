/**
 * Test Suite: Sub-Agentes C y D - Motor de Sincronización y Entrega Compuesta con Cobro
 * Sistema ERP Papelera Blanquita (Blanquita-Mobile)
 */

global.__DEV__ = true;

const assert = require("assert");

// Simulación de AsyncStorage en memoria para pruebas
const storage = new Map();
const mockAsyncStorage = {
  getItem: async (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: async (k, v) => storage.set(k, String(v)),
  removeItem: async (k) => storage.delete(k),
  multiRemove: async (keys) => keys.forEach((k) => storage.delete(k)),
  clear: async () => storage.clear(),
};

// Inyectar mocks antes de cargar módulos
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return { default: mockAsyncStorage, ...mockAsyncStorage };
  }
  if (request === "expo-secure-store") {
    return {
      setItemAsync: async () => {},
      getItemAsync: async () => null,
      deleteItemAsync: async () => {},
    };
  }
  if (request === "react-native") {
    return {
      Platform: { OS: "android" },
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove: () => {} }),
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const { SyncQueue } = require("../src/database/syncQueue");
const { LocalDB } = require("../src/database/localDb");
const { LogisticaApi } = require("../src/api/logisticaApi");
const { syncService } = require("../src/services/syncService");

async function runTests() {
  console.log("==================================================================");
  console.log("TESTS SUB-AGENTES C & D: MOTOR DE SYNC Y ENTREGA CON COBRO");
  console.log("==================================================================\n");

  await mockAsyncStorage.clear();

  // --------------------------------------------------------------------------
  // TEST 1: Encolado sin red con X-Idempotency-Key UUIDv4 estable
  // --------------------------------------------------------------------------
  console.log(">>> Test 1: Encolado offline genera X-Idempotency-Key UUIDv4 estable");
  const payloadEntrega = {
    id_pedido: 104,
    tipo_entrega: "TOTAL",
    recibido_por: "Dña. Martha Flores",
    items_entregados: [
      { presentacion_id: 1, producto_nombre: "Papel Higiénico 4 rollos", cantidad: 10, precio_unitario: 25 },
    ],
    monto_total: 250,
  };

  const opEncolada = await SyncQueue.encolarOperacion("ENTREGA", payloadEntrega, null, 12);
  assert.ok(opEncolada.idempotencyKey, "Debe tener idempotencyKey");
  assert.strictEqual(opEncolada.id, opEncolada.idempotencyKey, "id debe coincidir con idempotencyKey");
  assert.match(
    opEncolada.idempotencyKey,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "Debe cumplir formato UUID v4 estricto"
  );
  assert.strictEqual(opEncolada.estado, "pendiente de sincronizar");
  console.log("  ✓ Operación encolada con UUID v4:", opEncolada.idempotencyKey);

  // --------------------------------------------------------------------------
  // TEST 2: Reintento mantiene la MISMA X-Idempotency-Key (evita duplicados)
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 2: Reintento preserva la misma Idempotency-Key");
  const cola1 = await SyncQueue.obtenerCola(12);
  assert.strictEqual(cola1[0].idempotencyKey, opEncolada.idempotencyKey, "La clave debe ser inmutable");
  console.log("  ✓ Idempotency-Key inmutable verificada");

  // --------------------------------------------------------------------------
  // TEST 3: Error 401 durante sincronización pausa la cola sin descartar el ítem
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 3: Error 401 durante sync pausa la cola sin descartar la operación");
  let llamadasApi = 0;
  LogisticaApi.registrarEntrega = async () => {
    llamadasApi++;
    const err = new Error("Token expirado");
    err.status = 401;
    err.response = { status: 401, data: { codigo: "TOKEN_EXPIRADO" } };
    throw err;
  };

  // Simular sesión de usuario activo 12
  await LocalDB.guardarSesion({ IdUsuario: 12, nombre: "Carlos" }, { AccessToken: "expirado" });

  const resSync401 = await syncService.procesarCola(true);
  assert.strictEqual(llamadasApi, 1, "Debe haber intentado 1 llamada");
  const colaTras401 = await SyncQueue.obtenerCola(12);
  assert.strictEqual(colaTras401.length, 1, "El ítem debe seguir en la cola");
  assert.strictEqual(colaTras401[0].esErrorPermanente, false, "401 no es permanente");
  assert.strictEqual(colaTras401[0].intentos, 0, "401 no penaliza intentos del chofer");
  console.log("  ✓ 401 pausó la cola y preservó el ítem íntegro");

  // --------------------------------------------------------------------------
  // TEST 4: Error 4xx de validación queda con error permanente visible y no bloquea el resto
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 4: Error 4xx de negocio queda con esErrorPermanente=true y no bloquea la cola");
  // Encolar un segundo ítem válido
  const op2 = await SyncQueue.encolarOperacion("COBRO", { id_pedido: 105, monto: 100 }, null, 12);

  // El primer ítem lanzará 422 de negocio, el segundo ítem tendrá éxito
  let itemsLlamados = [];
  LogisticaApi.registrarEntrega = async (payload) => {
    itemsLlamados.push("ENTREGA");
    const err = new Error("Saldo insuficiente en pedido");
    err.status = 422;
    err.response = { status: 422, data: { detail: "Saldo insuficiente" } };
    throw err;
  };

  LogisticaApi.registrarCobro = async (payload) => {
    itemsLlamados.push("COBRO");
    return { success: true, data: { id: 99 } };
  };

  // Ejecutamos sincronización forzada para que procese el primer ítem
  await syncService.procesarCola(true);

  // La cola debe tener el ítem 1 marcado con error de validación, y el ítem 2 debe haberse removido tras éxito
  const colaTras422 = await SyncQueue.obtenerCola(12);
  assert.strictEqual(colaTras422.length, 1, "Solo debe quedar el ítem con error 422");
  assert.strictEqual(colaTras422[0].esErrorPermanente, true, "El ítem 1 debe estar marcado como error permanente");
  assert.strictEqual(colaTras422[0].estado, "error_validacion", "El estado debe ser error_validacion");
  assert.ok(itemsLlamados.includes("COBRO"), "El segundo ítem (COBRO) debió ejecutarse sin ser bloqueado por el 422");
  console.log("  ✓ 4xx marcado como permanente sin bloquear ítems posteriores");

  // --------------------------------------------------------------------------
  // TEST 5: Watchdog de candado pegado (> 2 minutos)
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 5: Watchdog de candado pegado libera ejecución si > 2 minutos");
  syncService.sincronizando = true;
  syncService.horaInicioSync = Date.now() - 130000; // 130 segundos en el pasado (> 120s)

  // Debe detectar timeout y permitir procesar
  const resultadoWatchdog = await syncService.procesarCola(false);
  assert.strictEqual(syncService.sincronizando, false, "El candado debe estar libre en finally");
  console.log("  ✓ Watchdog liberó candado pegado correctamente");

  // --------------------------------------------------------------------------
  // TEST 6: Descuento optimista local de inventario en camión (LocalDB)
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 6: Descuento optimista de inventario en camión con descontarInventarioCamion");
  await LocalDB.guardarInventarioCamion({
    items: [
      { presentacion_id: 1, saldo_camion: 50, total_entregado: 0 },
      { presentacion_id: 2, saldo_camion: 20, total_entregado: 5 },
    ],
    total_saldo_camion: 70,
    total_bultos_entregados: 5,
  });

  await LocalDB.descontarInventarioCamion([
    { presentacion_id: 1, cantidad: 10 },
    { presentacion_id: 2, cantidad: 4 },
  ]);

  const invActualizado = await LocalDB.obtenerInventarioCamion();
  assert.strictEqual(invActualizado.items[0].saldo_camion, 40, "Saldo de presentacion 1 debe ser 40");
  assert.strictEqual(invActualizado.items[0].total_entregado, 10, "Total entregado de presentacion 1 debe ser 10");
  assert.strictEqual(invActualizado.items[1].saldo_camion, 16, "Saldo de presentacion 2 debe ser 16");
  assert.strictEqual(invActualizado.items[1].total_entregado, 9, "Total entregado de presentacion 2 debe ser 9");
  console.log("  ✓ Descuento optimista de inventario verificado");

  // --------------------------------------------------------------------------
  // TEST 7: Subida de fotos de comprobante en entrega compuesta con cobro QR
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 7: Entrega compuesta sube comprobante QR antes de despachar entrega");
  await SyncQueue.limpiarCola(12);

  let archivoComprobanteSubido = false;
  LogisticaApi.subirArchivoComprobante = async (uri, tipo, id) => {
    archivoComprobanteSubido = true;
    return { success: true, idComprobante: 5544, urlArchivo: "https://blanquita.com/fotos/5544.jpg" };
  };

  let payloadEntregaRecibido = null;
  LogisticaApi.registrarEntrega = async (payload, idempKey) => {
    payloadEntregaRecibido = payload;
    return { success: true, data: { id: payload.id_pedido } };
  };

  const payloadCompuesto = {
    id_pedido: 201,
    tipo_entrega: "TOTAL",
    recibido_por: "Dña. Martha Flores",
    ci_receptor: "5839201 CH",
    items_entregados: [{ presentacion_id: 1, cantidad: 5, precio_unitario: 20 }],
    cobro: {
      monto_total: 100,
      pagos: [
        {
          metodo: "QR",
          monto: 100,
          foto_uri: "file:///data/user/0/com.blanquita.app/cache/qr_comprobante.jpg",
          id_comprobante_archivo: null,
        },
      ],
      credito: null,
    },
  };

  await SyncQueue.encolarOperacion("ENTREGA_CON_COBRO", payloadCompuesto, null, 12);
  await syncService.procesarCola(true);

  assert.strictEqual(archivoComprobanteSubido, true, "El comprobante QR debe haberse subido primero");
  assert.ok(payloadEntregaRecibido, "La entrega debe haberse registrado");
  assert.strictEqual(
    payloadEntregaRecibido.cobro.pagos[0].id_comprobante_archivo,
    5544,
    "El id_comprobante_archivo 5544 debe haber sido inyectado en el tramo QR"
  );
  console.log("  ✓ Flujo completo de entrega con cobro QR y comprobante subido exitosamente");

  console.log("\n==================================================================");
  console.log("✅ TODAS LAS PRUEBAS DE SUB-AGENTES C & D SUPERADAS CON ÉXITO");
  console.log("==================================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("\n❌ Fallo en suite C & D:", err);
  process.exit(1);
});
