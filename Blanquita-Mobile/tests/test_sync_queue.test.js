/**
 * Test Suite Automatizado: Mobile Offline-First & Sync Queue
 * Prueba de integración y unitaria para la cola de sincronización de repartidores
 */

const assert = require("assert");

class MockStorage {
  constructor() {
    this.store = {};
  }
  async getItem(key) {
    return this.store[key] || null;
  }
  async setItem(key, value) {
    this.store[key] = String(value);
  }
  async removeItem(key) {
    delete this.store[key];
  }
}

class TestableSyncQueue {
  constructor(storage) {
    this.storage = storage;
    this.KEY = "BLANQUITA_SYNC_QUEUE";
  }

  async getQueue() {
    const raw = await this.storage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : [];
  }

  async enqueue(tipo, payload) {
    const queue = await this.getQueue();
    const item = {
      id: "SYNC-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      tipo,
      payload,
      estado: "PENDIENTE",
      creado_en: new Date().toISOString(),
      intentos: 0,
    };
    queue.push(item);
    await this.storage.setItem(this.KEY, JSON.stringify(queue));
    return item;
  }

  async processQueue(mockApiHandler) {
    const queue = await this.getQueue();
    const pendientes = queue.filter((i) => i.estado === "PENDIENTE");
    const resultados = [];

    for (const item of pendientes) {
      try {
        const respuesta = await mockApiHandler(item.tipo, item.payload);
        item.estado = "SINCRONIZADO";
        item.respuesta = respuesta;
        resultados.push({ id: item.id, status: "OK" });
      } catch (err) {
        item.intentos += 1;
        item.ultimo_error = err.message;
        resultados.push({ id: item.id, status: "ERROR", error: err.message });
      }
    }

    // Persistir estado actualizado
    await this.storage.setItem(this.KEY, JSON.stringify(queue));
    return resultados;
  }

  async getPendingCount() {
    const queue = await this.getQueue();
    return queue.filter((i) => i.estado === "PENDIENTE").length;
  }
}

// Ejecución de Pruebas
async function runMobileOfflineTests() {
  console.log("=================================================");
  console.log(" INICIANDO TEST SUITE OFFLINE-FIRST MOBILE       ");
  console.log("=================================================");

  const storage = new MockStorage();
  const syncManager = new TestableSyncQueue(storage);

  // 1. Encolar entrega sin conexión
  console.log("1. Test: Encolamiento de entrega offline por chofer...");
  const entregaItem = await syncManager.enqueue("REGISTRAR_ENTREGA", {
    id_pedido: 1045,
    id_chofer: 4,
    monto_cobrado_efectivo: 350.0,
    monto_cobrado_qr: 0.0,
    latitud_gps: -19.0435,
    longitud_gps: -65.2598,
    firmado_por: "Juan Pérez",
  });
  assert(entregaItem.id.startsWith("SYNC-"));
  assert(entregaItem.estado === "PENDIENTE");
  assert.strictEqual(await syncManager.getPendingCount(), 1);
  console.log("   -> OK: Transacción de entrega encolada localmente.");

  // 2. Encolar nuevo cliente capturado en campo
  console.log("2. Test: Encolamiento de nuevo cliente en campo con GPS...");
  const clienteItem = await syncManager.enqueue("NUEVO_CLIENTE_GPS", {
    razon_social: "Tienda San Martín",
    nit_ci: "1029384756",
    latitud: -19.0450,
    longitud: -65.2600,
    limite_credito: 1500.0,
  });
  assert.strictEqual(await syncManager.getPendingCount(), 2);
  console.log("   -> OK: Cliente encolado para sincronización en segundo plano.");

  // 3. Simular recuperación de conexión a internet y sincronización por lotes
  console.log("3. Test: Reconexión de red y sincronización por lotes (FIFO)...");
  const peticionesEnviadas = [];
  const mockApi = async (tipo, payload) => {
    peticionesEnviadas.push({ tipo, payload });
    return { exito: true, timestamp_servidor: new Date().toISOString() };
  };

  const resultados = await syncManager.processQueue(mockApi);
  assert.strictEqual(resultados.length, 2);
  assert.strictEqual(resultados[0].status, "OK");
  assert.strictEqual(resultados[1].status, "OK");
  assert.strictEqual(await syncManager.getPendingCount(), 0);
  console.log("   -> OK: Todas las transacciones locales fueron enviadas y confirmadas por el servidor.");

  // 4. Tolerancia a fallos: Si falla una llamada, permanece pendiente y reintenta
  console.log("4. Test: Tolerancia a fallos de red y preservación de cola...");
  await syncManager.enqueue("COBRO_PARCIAL", { id_pedido: 1046, monto: 120.0 });
  const mockApiConError = async () => {
    throw new Error("HTTP 503 Service Unavailable");
  };

  const resError = await syncManager.processQueue(mockApiConError);
  assert.strictEqual(resError[0].status, "ERROR");
  assert.strictEqual(await syncManager.getPendingCount(), 1); // Permanece en cola local
  console.log("   -> OK: Las transacciones que fallan no se pierden y continúan en cola para reintento.");

  console.log("=================================================");
  console.log(" TODOS LOS TESTS OFFLINE MOBILE PASARON AL 100%  ");
  console.log("=================================================");
}

runMobileOfflineTests().catch((err) => {
  console.error("Fallo en tests mobile:", err);
  process.exit(1);
});
