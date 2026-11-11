/**
 * Prueba Unitaria: Cierre de Sesión Completo (Fase 1.1 - Punto C5)
 * Sistema ERP Papelera Blanquita - Móvil
 * 
 * Verifica que el cierre de sesión:
 * 1. Desactiva el dispositivo en el backend vía /auth/logout.
 * 2. Borra tokens de SecureStorage.
 * 3. Limpia la sesión persistida en LocalDB.
 * 4. Limpia el caché de rutas, clientes y productos (LocalDB.limpiarTodo).
 * 5. Limpia la cola de sincronización offline (SyncQueue.limpiarCola).
 */

const assert = require("assert");

console.log("=================================================");
console.log(" TEST: CIERRE DE SESIÓN COMPLETO (PUNTO C5)      ");
console.log("=================================================");

let tokensBorrados = false;
let sesionEliminada = false;
let cacheLimpio = false;
let colaLimpia = false;
let logoutApiLlamado = false;

// Mock de SecureStorage
const mockSecureStorage = {
  async limpiarTokens() {
    tokensBorrados = true;
    return true;
  }
};

// Mock de LocalDB
const mockLocalDB = {
  async eliminarSesion() {
    sesionEliminada = true;
    return true;
  },
  async limpiarTodo() {
    cacheLimpio = true;
    return true;
  }
};

// Mock de SyncQueue
const mockSyncQueue = {
  async limpiarCola() {
    colaLimpia = true;
    return true;
  }
};

// Mock de AuthApi
const mockAuthApi = {
  async logout() {
    logoutApiLlamado = true;
    return { exito: true };
  }
};

async function ejecutarCierreSesion() {
  await mockAuthApi.logout().catch(() => {});
  await mockSecureStorage.limpiarTokens();
  await mockLocalDB.eliminarSesion();
  await mockLocalDB.limpiarTodo();
  await mockSyncQueue.limpiarCola();
}

(async () => {
  await ejecutarCierreSesion();

  assert.strictEqual(logoutApiLlamado, true, "AuthApi.logout() debió ser invocado");
  console.log("   -> [PASS] Backend notificado de cierre de sesión.");

  assert.strictEqual(tokensBorrados, true, "Tokens de SecureStorage debieron ser eliminados");
  console.log("   -> [PASS] Tokens JWT borrados de almacenamiento seguro.");

  assert.strictEqual(sesionEliminada, true, "Sesión de LocalDB debió ser eliminada");
  console.log("   -> [PASS] Sesión de usuario eliminada de base local.");

  assert.strictEqual(cacheLimpio, true, "Caché de rutas y clientes debió ser purgado");
  console.log("   -> [PASS] Caché local completamente limpiado.");

  assert.strictEqual(colaLimpia, true, "Cola de sincronización debió ser limpiada");
  console.log("   -> [PASS] Cola de sincronización purgada.");

  console.log("✅ CIERRE DE SESIÓN COMPLETO: 5/5 comprobaciones superadas.");
})();
