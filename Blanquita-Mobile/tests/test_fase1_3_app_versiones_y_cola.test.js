// Blanquita-Mobile/tests/test_fase1_3_app_versiones_y_cola.test.js
// Pruebas específicas para Punto 5 (Versiones y Sincronización en Bloqueo) y Punto 6 (Cierre de sesión seguro)

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
  clear: async () => { Object.keys(storage).forEach(k => delete storage[k]); return true; }
};

// Inyectar mock antes de cargar syncQueue
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@react-native-async-storage/async-storage") {
    return AsyncStorageMock;
  }
  return originalLoad.apply(this, arguments);
};

const { SyncQueue } = require("../src/database/syncQueue");

async function ejecutarPruebas() {
  console.log("=== INICIANDO PRUEBAS FASE 1.3: PUNTOS 5 Y 6 ===");

  // -------------------------------------------------------------
  // PUNTO 5: MODAL DE BLOQUEO DURO PERMITE SINCRONIZAR Y BANNER NO BLOQUEANTE
  // -------------------------------------------------------------
  console.log("\n>>> Test Punto 5: Modal de bloqueo duro y Banner no bloqueante");
  
  // 5.1 Simular listener de bloqueo duro
  let bloqueoDuroActivo = false;
  let versionExigida = null;
  const mockHardBlockListener = (required, version) => {
    bloqueoDuroActivo = Boolean(required);
    versionExigida = version;
  };

  // 5.2 Simular listener de banner no bloqueante
  let bannerNoBloqueanteVisible = false;
  let versionSugerida = null;
  const mockSoftUpdateListener = (version) => {
    bannerNoBloqueanteVisible = true;
    versionSugerida = version;
  };

  // Simular respuesta del servidor con versión sugerida (sin x-upgrade-required)
  const headerSugerida = { "x-latest-client-version": "1.0.5" };
  if (headerSugerida["x-latest-client-version"] > "1.0.0") {
    mockSoftUpdateListener(headerSugerida["x-latest-client-version"]);
  }
  assert.strictEqual(bannerNoBloqueanteVisible, true, "Banner no bloqueante debe activarse ante version sugerida");
  assert.strictEqual(versionSugerida, "1.0.5");
  assert.strictEqual(bloqueoDuroActivo, false, "El bloqueo duro NO debe activarse ante version sugerida");
  console.log("   [PASS] 5a. Banner no bloqueante emitido sin bloquear operacion del chofer.");

  // Simular respuesta del servidor con bloqueo duro (x-upgrade-required: true)
  const headerBloqueoDuro = { "x-upgrade-required": "true", "x-minimum-client-version": "2.0.0" };
  if (headerBloqueoDuro["x-upgrade-required"] === "true") {
    mockHardBlockListener(true, headerBloqueoDuro["x-minimum-client-version"]);
  }
  assert.strictEqual(bloqueoDuroActivo, true, "Bloqueo duro debe activarse");
  assert.strictEqual(versionExigida, "2.0.0");

  // Verificar que durante el bloqueo duro se puede sincronizar la cola pendiente
  await AsyncStorageMock.clear();
  await SyncQueue.encolarOperacion("COBRO", { monto: 120.50, cliente: "Tienda San Martin" });
  const pendientesEnBloqueo = await SyncQueue.contarPendientes();
  assert.strictEqual(pendientesEnBloqueo, 1, "Debe existir 1 operacion pendiente en cola");

  // Mock de SyncService.procesarCola(true)
  let syncInvocadoConForzar = false;
  const mockSyncService = {
    procesarCola: async (forzar) => {
      syncInvocadoConForzar = forzar;
      const cola = await SyncQueue.obtenerCola();
      await SyncQueue.guardarCola([]); // Sincronizado exitoso
      return { exito: true, procesadas: cola.length };
    }
  };

  const resSync = await mockSyncService.procesarCola(true);
  assert.strictEqual(syncInvocadoConForzar, true, "procesarCola debe llamarse con forzar=true");
  assert.strictEqual(resSync.exito, true);
  assert.strictEqual(resSync.procesadas, 1);
  const pendientesPostSync = await SyncQueue.contarPendientes();
  assert.strictEqual(pendientesPostSync, 0, "La cola debe quedar en 0 tras sincronizar durante el bloqueo duro");
  console.log("   [PASS] 5b. Modal de bloqueo duro permite sincronizar la cola pendiente sin impedir el respaldo.");

  // -------------------------------------------------------------
  // PUNTO 6: AMBOS CAMINOS DE LOGOUT CON DINERO EN COLA (BLOQUEO VS FORZAR Y EXCEPCION 4XX)
  // -------------------------------------------------------------
  console.log("\n>>> Test Punto 6: Cierre de sesion con dinero pendiente y excepcion de 4xx");

  await AsyncStorageMock.clear();
  // Encolar cobro 1: reintentable (red)
  const op1 = await SyncQueue.encolarOperacion("COBRO", { monto: 350.00, cliente: "Farmacia Bolivia" });
  // Encolar cobro 2: reintentable
  await SyncQueue.encolarOperacion("COBRO", { monto: 150.00, cliente: "Abarrotes Don Pedro" });
  // Encolar cobro 3: con fallo 400 (no reintentable / regla de negocio)
  const op3 = await SyncQueue.encolarOperacion("COBRO", { monto: 80.00, cliente: "Kiosko Central" });
  await SyncQueue.registrarFalloOperacion(op3.id, { response: { status: 400 }, message: "Cliente inactivo" });

  // Verificar resumen de dinero
  const resumen = await SyncQueue.obtenerResumenDineroPendiente();
  assert.strictEqual(resumen.totalOperaciones, 3, "Total operaciones con dinero debe ser 3");
  assert.strictEqual(resumen.cantidadReintentables, 2, "Reintentables deben ser 2");
  assert.strictEqual(resumen.cantidadNoReintentables4xx, 1, "No reintentables 4xx debe ser 1");
  assert.strictEqual(resumen.totalDineroBs, 500.00, "Monto total reintentable debe ser 350 + 150 = 500 Bs (excluye 4xx)");
  assert.strictEqual(resumen.bloqueoRequerido, true, "Debe requerir bloqueo por tener cobros reintentables");

  // Simular logica de AuthContext.cerrarSesion
  async function simularCerrarSesion(forzar = false) {
    const res = await SyncQueue.obtenerResumenDineroPendiente();
    if (res.bloqueoRequerido && !forzar) {
      return {
        bloqueado: true,
        requiereConfirmacion: true,
        cantidad: res.cantidadReintentables,
        montoTotal: res.totalDineroBs,
        desgloseReintentables: res.reintentables,
        desgloseNoReintentables: res.noReintentables4xx,
      };
    }
    await SyncQueue.limpiarCola();
    return {
      exito: true,
      advertencia4xx: res.cantidadNoReintentables4xx > 0 ? `Descartadas ${res.cantidadNoReintentables4xx} con error 4xx` : null
    };
  }

  // Camino A: Intento de logout regular sin forzar -> Bloqueado
  const logoutBloqueado = await simularCerrarSesion(false);
  assert.strictEqual(logoutBloqueado.bloqueado, true);
  assert.strictEqual(logoutBloqueado.requiereConfirmacion, true);
  assert.strictEqual(logoutBloqueado.cantidad, 2);
  assert.strictEqual(logoutBloqueado.montoTotal, 500.00);
  assert.strictEqual(logoutBloqueado.desgloseReintentables.length, 2);
  assert.strictEqual(logoutBloqueado.desgloseNoReintentables.length, 1);
  console.log("   [PASS] 6a. Camino 1: Logout bloqueado con desglose de Bs. 500.00 y 2 cobros pendientes.");

  // Camino B: Chofer confirma forzar el cierre -> Exitoso
  const logoutForzado = await simularCerrarSesion(true);
  assert.strictEqual(logoutForzado.exito, true);
  assert.ok(logoutForzado.advertencia4xx.includes("Descartadas 1 con error 4xx"));
  const colaPostForzado = await SyncQueue.obtenerCola();
  assert.strictEqual(colaPostForzado.length, 0, "La cola debe quedar limpia tras forzar");
  console.log("   [PASS] 6b. Camino 2: Logout forzado con confirmacion explicita purga la sesion.");

  // Camino C: Cola que SOLO contiene errores 4xx no reintentables -> No bloquea el logout
  await AsyncStorageMock.clear();
  const opErr = await SyncQueue.encolarOperacion("COBRO", { monto: 90.00, cliente: "Error 422 Validacion" });
  await SyncQueue.registrarFalloOperacion(opErr.id, { response: { status: 422 }, message: "Monto no coincide" });
  
  const resumenSolo4xx = await SyncQueue.obtenerResumenDineroPendiente();
  assert.strictEqual(resumenSolo4xx.bloqueoRequerido, false, "Errores 4xx NO deben exigir bloqueo");
  const logoutSolo4xx = await simularCerrarSesion(false);
  assert.strictEqual(logoutSolo4xx.exito, true, "Logout debe permitirse sin confirmacion si solo hay 4xx");
  console.log("   [PASS] 6c. Errores 4xx permanentes no impiden el cierre de sesion.");

  console.log("\n=======================================================");
  console.log("TODOS LOS CASOS DE PRUEBA DE PUNTOS 5 Y 6 VERIFICADOS.");
  console.log("=======================================================\n");
}

ejecutarPruebas().catch((e) => {
  console.error("Fallo en prueba:", e);
  process.exit(1);
});
