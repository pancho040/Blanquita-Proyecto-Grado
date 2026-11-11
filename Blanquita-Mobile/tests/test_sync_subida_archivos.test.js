// Blanquita-Mobile/tests/test_sync_subida_archivos.test.js
// Validación de Subida Diferida de Archivos y Manejo de Fallos (Punto 3 - Fase 2.1)

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
  setItem: async (k, v) => { storage[k] = String(v); return true; },
  removeItem: async (k) => { delete storage[k]; return true; },
  clear: async () => { Object.keys(storage).forEach((k) => delete storage[k]); return true; },
};

// Inyectar mocks antes de cargar dependencias
const Module = require("module");
const originalLoad = Module._load;

let mockSubidaArchivoHandler = null;
let mockRegistrarEntregaHandler = null;
let mockRegistrarCobroHandler = null;

const LogisticaApiMock = {
  subirArchivoComprobante: async (uri, entidad, idOrigen) => {
    if (mockSubidaArchivoHandler) {
      return await mockSubidaArchivoHandler(uri, entidad, idOrigen);
    }
    return { success: true, idComprobante: 123, urlArchivo: "/uploads/foto123.jpg" };
  },
  registrarEntrega: async (payload, idempKey) => {
    if (mockRegistrarEntregaHandler) {
      return await mockRegistrarEntregaHandler(payload, idempKey);
    }
    return { success: true, data: { id_pedido: payload.id_pedido, estado: "Entregado" } };
  },
  registrarCobro: async (payload, idempKey) => {
    if (mockRegistrarCobroHandler) {
      return await mockRegistrarCobroHandler(payload, idempKey);
    }
    return { success: true, data: { id_pedido: payload.id_pedido } };
  },
  registrarNoEntrega: async () => ({ success: true }),
  registrarCierreTurno: async () => ({ success: true }),
};

const ClientesApiMock = {
  crearCliente: async () => ({ success: true }),
};

Module._load = function (request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return AsyncStorageMock;
  }
  if (request.includes("logisticaApi")) {
    return { LogisticaApi: LogisticaApiMock };
  }
  if (request.includes("clientesApi")) {
    return { ClientesApi: ClientesApiMock };
  }
  return originalLoad.apply(this, arguments);
};

const { SyncQueue } = require("../src/database/syncQueue");
const { syncService } = require("../src/services/syncService");

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE SUBIDA DIFERIDA DE ARCHIVOS Y FALLOS 503 ===");

  await AsyncStorageMock.clear();

  // --------------------------------------------------------------------------
  // TEST 1: No Base64 en syncQueue (>1KB), solo URI local y metadatos
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 1: Verificación de no almacenamiento Base64 en SyncQueue");
  const localFileUri = "file:///data/user/0/com.blanquita.app/cache/comprobante_entrega_1042.jpg";
  const payloadConUri = {
    id_pedido: 1042,
    tipo_entrega: "TOTAL",
    recibido_por: "Carlos Mendoza",
    foto_uri: localFileUri, // URI local en almacenamiento del dispositivo
    firma_chofer: "data:image/svg+xml;utf8,<svg></svg>", // Vector SVG liviano, no raster Base64
  };

  const opEncolada = await SyncQueue.encolarOperacion("ENTREGA", payloadConUri);
  assert.ok(opEncolada.id, "Debe generar UUID v4 de idempotencia");
  assert.strictEqual(opEncolada.estado, "pendiente de sincronizar");

  // Leer string crudo guardado en AsyncStorage
  const { CONFIG } = require("../src/constants/Config");
  const claveQueue = CONFIG.SYNC.CLAVE_STORAGE_COLA;
  const queueJson = storage[claveQueue];
  assert.ok(queueJson, "Debe existir la cola en storage");

  const tamanoBytes = Buffer.byteLength(queueJson, "utf8");
  console.log(`  Tamaño serializado de la operación en SyncQueue: ${tamanoBytes} bytes`);
  assert.ok(tamanoBytes < 1024, `El tamaño debe ser estrictamente menor a 1KB (actual: ${tamanoBytes} B). No hay Base64.`);
  assert.ok(queueJson.includes(localFileUri), "Debe contener el localFileUri como ruta de archivo");

  // --------------------------------------------------------------------------
  // TEST 2: Fallo 503 / Timeout en /chofer/subir-archivo mantiene localFileUri reintentable
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 2: Fallo 503 al subir archivo retiene la acción en cola sin perder localFileUri");

  // Configurar mock de subida para simular error 503 (Servicio no disponible en backend/storage)
  mockSubidaArchivoHandler = async (uri, entidad, idOrigen) => {
    return {
      success: false,
      status: 503,
      error: "503 Service Unavailable: Almacenamiento no responde o timeout de red",
    };
  };

  let llamadaEntregaRealizada = false;
  mockRegistrarEntregaHandler = async () => {
    llamadaEntregaRealizada = true;
    return { success: true };
  };

  const resultadoProcesarFallo = await syncService.procesarCola();

  // Verificaciones de comportamiento ante 503:
  assert.strictEqual(llamadaEntregaRealizada, false, "NO se debe intentar despachar la entrega si falló la subida de foto");
  
  const colaDespuesFallo = await SyncQueue.obtenerCola();
  assert.strictEqual(colaDespuesFallo.length, 1, "La operación debe permanecer en cola");

  const itemFallo = colaDespuesFallo[0];
  console.log(`  Estado tras fallo 503: ${itemFallo.estado}, intentos: ${itemFallo.intentos}, esErrorPermanente: ${itemFallo.esErrorPermanente}`);
  assert.strictEqual(itemFallo.estado, "pendiente de sincronizar", "Debe mantenerse 'pendiente de sincronizar' para reintento");
  assert.strictEqual(itemFallo.esErrorPermanente, false, "Fallo 503 NO es un error permanente");
  assert.strictEqual(itemFallo.intentos, 1, "Debe incrementar contador de intentos a 1");
  assert.strictEqual(itemFallo.payload.foto_uri, localFileUri, "El localFileUri debe preservarse intacto sin corrupción");
  assert.ok(itemFallo.ultimoError.includes("503"), "Debe registrar el último error con detalle 503");

  // --------------------------------------------------------------------------
  // TEST 3: Recuperación de red y subida exitosa con vinculación de id_comprobante
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 3: Reintento exitoso sube archivo, inyecta id_comprobante y vacía la cola");

  let payloadEntregaEnviado = null;
  mockSubidaArchivoHandler = async (uri, entidad, idOrigen) => {
    return {
      success: true,
      status: 200,
      idComprobante: 7788,
      urlArchivo: "https://api.blanquita.com/archivos/comprobantes/7788.jpg",
    };
  };

  mockRegistrarEntregaHandler = async (payload, idempKey) => {
    payloadEntregaEnviado = payload;
    return {
      success: true,
      data: { id_pedido: payload.id_pedido, estado: "Entregado" },
    };
  };

  const resultadoProcesarExito = await syncService.procesarCola();
  assert.ok(resultadoProcesarExito.exito, "El procesamiento debe concluir exitosamente");
  assert.ok(payloadEntregaEnviado, "La llamada a registrarEntrega debe haberse ejecutado");
  assert.strictEqual(payloadEntregaEnviado.id_comprobante_archivo, 7788, "Debe haber inyectado id_comprobante_archivo=7788");

  const colaFinal = await SyncQueue.obtenerCola();
  assert.strictEqual(colaFinal.length, 0, "La cola debe quedar limpia (0 pendientes) tras sincronización exitosa");

  // --------------------------------------------------------------------------
  // TEST 4: Subida diferida de comprobante en COBRO mixto y aborto ante 4xx/5xx
  // --------------------------------------------------------------------------
  console.log("\n>>> Test 4: Cobro mixto con tramo QR sube comprobante, inyecta id_comprobante y bloquea ante error 4xx/5xx");

  const localQrUri = "file:///data/user/0/com.blanquita.app/cache/comprobante_qr_99.png";
  const payloadCobroMixto = {
    id_pedido: 2050,
    monto_total: 180.0,
    pagos: [
      { metodo: "EFECTIVO", monto: 80.0 },
      { metodo: "QR", monto: 100.0, foto_uri: localQrUri },
    ],
  };

  await SyncQueue.encolarOperacion("COBRO", payloadCobroMixto);

  // 4.1 Simular fallo 413 (Payload Too Large) al subir foto QR
  mockSubidaArchivoHandler = async (uri, entidad, idOrigen) => {
    return {
      success: false,
      status: 413,
      error: "413 Payload Too Large: El archivo supera el tamaño máximo permitido",
    };
  };

  let llamadaCobroRealizada = false;
  mockRegistrarCobroHandler = async () => {
    llamadaCobroRealizada = true;
    return { success: true };
  };

  await syncService.procesarCola();

  // El cobro jamás debe haberse enviado si la foto falló
  assert.strictEqual(llamadaCobroRealizada, false, "NUNCA debe despacharse el cobro QR si falló la subida del comprobante");

  const colaCobroFallo = await SyncQueue.obtenerCola();
  assert.strictEqual(colaCobroFallo.length, 1, "La operación debe permanecer en cola");
  assert.strictEqual(colaCobroFallo[0].esErrorPermanente, true, "Fallo 413 se clasifica como error permanente de validación");
  assert.strictEqual(colaCobroFallo[0].estado, "error_validacion");
  assert.strictEqual(colaCobroFallo[0].payload.pagos[1].foto_uri, localQrUri, "El foto_uri debe preservarse intacto");

  // 4.2 Simular que se corrige o reintenta con subida exitosa (200 OK)
  // Limpiamos cola y encolamos de nuevo para probar flujo exitoso
  await AsyncStorageMock.clear();
  await SyncQueue.encolarOperacion("COBRO", payloadCobroMixto);

  mockSubidaArchivoHandler = async (uri, entidad, idOrigen) => {
    return {
      success: true,
      status: 200,
      idComprobante: 5544,
      urlArchivo: "https://api.blanquita.com/archivos/comprobantes/5544.png",
    };
  };

  let payloadCobroDespachado = null;
  mockRegistrarCobroHandler = async (payload) => {
    payloadCobroDespachado = payload;
    return { success: true };
  };

  const resultadoCobroExito = await syncService.procesarCola();
  assert.ok(resultadoCobroExito.exito, "El procesamiento debe concluir con éxito");
  assert.ok(payloadCobroDespachado, "El cobro debe haberse despachado a la API");
  assert.strictEqual(payloadCobroDespachado.pagos[1].id_comprobante_archivo, 5544, "Debe inyectar id_comprobante_archivo=5544 en tramo QR");

  const colaCobroFinal = await SyncQueue.obtenerCola();
  assert.strictEqual(colaCobroFinal.length, 0, "La cola debe quedar limpia tras despacho exitoso de cobro");

  console.log("\n>>> [PASSED] Todas las pruebas de subida diferida y tolerancia a fallos 503/4xx concluyeron satisfactoriamente.\n");
}

runTests().catch((err) => {
  console.error("\n[FAILED] Error en test_sync_subida_archivos:", err);
  process.exit(1);
});
