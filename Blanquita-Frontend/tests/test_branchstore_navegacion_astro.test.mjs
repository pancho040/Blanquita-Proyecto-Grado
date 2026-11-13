/**
 * Test Suite: branchStore en Navegación Astro (ClientRouter / View Transitions)
 * Verificación integral de:
 * a) Request Coalescing (10 llamadas concurrentes -> 1 fetch real).
 * b) Reintentos con backoff ante fallos de red / AbortError / TypeError.
 * c) No-degradación de estado ante props JWT / SSR incompletos.
 * d) Sede fija Potosí: fijación en "2" sin pasar jamás por "1".
 * e) Manejo de errorAlcance y reintentarAlcance().
 * f) getSnapshot() con referencia inmutable y notificaciones acotadas.
 * g) Detección de cambio de usuarioKey.
 */

import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";

// Simulación de entorno global
class MockSessionStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.window = {
  sessionStorage: new MockSessionStorage(),
  location: {
    protocol: "http:",
    hostname: "localhost",
    host: "localhost:4321",
    port: "4321",
    search: "",
    href: "http://localhost:4321/supervisor/asignaciones",
  },
  history: {
    replaceState(state, title, url) {
      const u = new URL(url, "http://localhost:4321");
      globalThis.window.location.search = u.search;
      globalThis.window.location.href = u.href;
    },
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
};

// Delays rápidos para tests unitarios (5ms, 10ms, 15ms)
globalThis.__BRANCH_STORE_RETRY_DELAYS = [5, 10, 15];

const {
  inicializarAlcanceUsuario,
  limpiarSesionSucursal,
  cambiarSucursalActiva,
  refrescarAlcanceDesdeApi,
  reintentarAlcance,
  getSnapshot,
  subscribe,
  useBranch,
  usePaginaSucursal,
  SUCURSALES_CATALOGO
} = await import("../src/stores/branchStore.js");

describe("branchStore - Navegación y Resiliencia Multisede", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    limpiarSesionSucursal();
    globalThis.window.sessionStorage.clear();
    globalThis.window.location.search = "";
    globalThis.window.location.href = "http://localhost:4321/supervisor/asignaciones";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("a) 10 llamadas concurrentes a refrescarAlcanceDesdeApi() => exactamente 1 fetch y mismo resultado", async () => {
    let conteoFetch = 0;
    const datosRespuesta = {
      id_usuario: 10,
      AuthUserId: "usr-10",
      puede_ver_todas: true,
      sucursal_defecto: 1,
      sucursales_permitidas: [
        { id: 1, nombre: "Sucursal Central Sucre" },
        { id: 2, nombre: "Sucursal Potosí" },
      ],
    };

    globalThis.fetch = async (url) => {
      if (url.includes("/api/Usuario/mi-alcance")) {
        conteoFetch++;
        await new Promise((r) => setTimeout(r, 10));
        return {
          ok: true,
          status: 200,
          json: async () => datosRespuesta,
        };
      }
      return { ok: false, status: 404 };
    };

    const promesas = Array.from({ length: 10 }, () => refrescarAlcanceDesdeApi());
    const resultados = await Promise.all(promesas);

    assert.equal(conteoFetch, 1, "Debe realizar exactamente 1 llamada fetch para 10 invocaciones concurrentes");
    for (const res of resultados) {
      assert.notEqual(res, null, "Ningún consumidor debe recibir null");
      assert.equal(res.id_usuario, 10);
    }

    const snap = getSnapshot();
    assert.equal(snap.inicializado, true);
    assert.equal(snap.alcanceConfirmado, true);
  });

  test("b) Primer fetch rechazado con TypeError y segundo OK => store termina inicializado=true y alcanceConfirmado=true", async () => {
    let intentos = 0;
    const datosRespuesta = {
      id_usuario: 15,
      AuthUserId: "usr-15",
      puede_ver_todas: false,
      sucursal_defecto: 2,
      sucursales_permitidas: [{ id: 2, nombre: "Sucursal Potosí" }],
    };

    globalThis.fetch = async (url) => {
      intentos++;
      if (intentos === 1) {
        const error = new TypeError("Failed to fetch");
        error.name = "TypeError";
        throw error;
      }
      return {
        ok: true,
        status: 200,
        json: async () => datosRespuesta,
      };
    };

    const res = await refrescarAlcanceDesdeApi({ forzar: true });
    assert.equal(intentos, 2, "Debe haber reintentado exactamente una vez tras el fallo de red");
    assert.notEqual(res, null);

    const snap = getSnapshot();
    assert.equal(snap.inicializado, true);
    assert.equal(snap.alcanceConfirmado, true);
    assert.equal(snap.sucursalActiva, "2");
  });

  test("c) Tras confirmar con puede_ver_todas=true, llamar inicializarAlcanceUsuario(forma JWT) NO degrada el estado", async () => {
    // 1. Simular confirmación desde mi-alcance
    const alcanceReal = {
      id_usuario: 5,
      AuthUserId: "auth-005",
      puede_ver_todas: true,
      sucursal_defecto: 1,
      sucursales_permitidas: [
        { id: 1, nombre: "Sucursal Central Sucre" },
        { id: 2, nombre: "Sucursal Potosí" },
      ],
    };

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => alcanceReal,
    });

    await refrescarAlcanceDesdeApi({ forzar: true });
    const snapAntes = getSnapshot();
    assert.equal(snapAntes.puedeVerTodas, true);
    assert.equal(snapAntes.alcanceConfirmado, true);

    let notificacionesEmitidas = 0;
    const unsub = subscribe(() => {
      notificacionesEmitidas++;
    });

    // 2. Simular montaje de isla con prop SSR / JWT incompleto
    const usuarioJwtSsr = {
      IdUsuario: 5,
      IdRol: 5,
      IsAdmin: false,
      IdSucursal: null,
      AuthUserId: "auth-005",
      Correo: "supervisor@blanquita.com",
    };

    inicializarAlcanceUsuario(usuarioJwtSsr);

    const snapDespues = getSnapshot();
    unsub();

    assert.equal(notificacionesEmitidas, 0, "No debe emitir notificaciones innecesarias si el usuario ya está confirmado");
    assert.equal(snapDespues.puedeVerTodas, true, "puedeVerTodas NO debe degradarse a false");
    assert.equal(snapDespues.inicializado, true, "inicializado NO debe pasar a false");
    assert.equal(snapDespues.alcanceConfirmado, true);
  });

  test("d) Con usuario de sede fija (puede_ver_todas=false, sucursal_defecto=2): sucursalActiva='2' y jamás pasa por '1'", () => {
    const emisiones = [];
    const unsub = subscribe(() => {
      emisiones.push(getSnapshot().sucursalActiva);
    });

    const usuarioPotosi = {
      id_usuario: 8,
      AuthUserId: "auth-potosi-8",
      puede_ver_todas: false,
      sucursal_defecto: 2,
      sucursales_permitidas: [{ id: 2, nombre: "Sucursal Potosí" }],
      IdSucursal: 2,
    };

    inicializarAlcanceUsuario(usuarioPotosi);
    unsub();

    const snap = getSnapshot();
    assert.equal(snap.sucursalActiva, "2", "La sucursal activa debe ser '2'");
    assert.ok(!emisiones.includes("1"), "El estado JAMÁS debe pasar por '1' para un usuario de Potosí");
  });

  test("e) Si todos los reintentos fallan => errorAlcance=true, inicializado no se degrada, y reintentarAlcance() resuelve", async () => {
    globalThis.fetch = async () => {
      const err = new TypeError("Network error");
      err.name = "TypeError";
      throw err;
    };

    await refrescarAlcanceDesdeApi({ forzar: true });
    let snap = getSnapshot();
    assert.equal(snap.errorAlcance, true, "errorAlcance debe ser true tras agotar reintentos");

    // Ahora simular que la red se recupera
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id_usuario: 33,
        AuthUserId: "auth-33",
        puede_ver_todas: true,
        sucursal_defecto: 1,
        sucursales_permitidas: [
          { id: 1, nombre: "Sucursal Central Sucre" },
          { id: 2, nombre: "Sucursal Potosí" },
        ],
      }),
    });

    await reintentarAlcance();
    snap = getSnapshot();
    assert.equal(snap.errorAlcance, false, "errorAlcance debe limpiarse al resolver");
    assert.equal(snap.alcanceConfirmado, true);
    assert.equal(snap.inicializado, true);
  });

  test("f) getSnapshot() 100 veces devuelve la misma referencia; notificaciones finitas (<= 3)", () => {
    const snap1 = getSnapshot();
    for (let i = 0; i < 100; i++) {
      assert.equal(getSnapshot(), snap1, "getSnapshot debe devolver la misma referencia inmutable");
    }

    let conteo = 0;
    const unsub = subscribe(() => conteo++);

    inicializarAlcanceUsuario({
      id_usuario: 40,
      AuthUserId: "auth-40",
      puede_ver_todas: true,
      sucursal_defecto: 1,
      sucursales_permitidas: [
        { id: 1, nombre: "Sucursal Central Sucre" },
        { id: 2, nombre: "Sucursal Potosí" },
      ],
    });
    unsub();

    assert.ok(conteo <= 3, `Notificaciones finitas (esperado <= 3, obtenido ${conteo})`);
  });

  test("g) Cambio de usuarioKey resetea y reconfirma", async () => {
    // 1. Iniciar con usuario 10
    inicializarAlcanceUsuario({
      id_usuario: 10,
      AuthUserId: "usr-10",
      puede_ver_todas: false,
      sucursal_defecto: 2,
      sucursales_permitidas: [{ id: 2, nombre: "Sucursal Potosí" }],
    });
    assert.equal(getSnapshot().sucursalActiva, "2");

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id_usuario: 99,
        AuthUserId: "usr-99",
        puede_ver_todas: true,
        sucursal_defecto: 1,
        sucursales_permitidas: [
          { id: 1, nombre: "Sucursal Central Sucre" },
          { id: 2, nombre: "Sucursal Potosí" },
        ],
      }),
    });

    // 2. Llamar con usuario 99
    inicializarAlcanceUsuario({
      IdUsuario: 99,
      AuthUserId: "usr-99",
      IdRol: 3,
    });

    // Esperar resolución
    await new Promise((r) => setTimeout(r, 30));

    const snap = getSnapshot();
    assert.equal(snap.puedeVerTodas, true);
    assert.equal(snap.alcanceConfirmado, true);
  });
});
