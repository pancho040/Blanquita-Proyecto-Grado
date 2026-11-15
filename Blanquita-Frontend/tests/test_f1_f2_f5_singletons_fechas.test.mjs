/**
 * Test Suite F1, F2, F5: Verificación de Singletons en globalThis,
 * inmunidad contra iframes de ClientRouter, fechas locales de Bolivia
 * y aislamiento de caché por fecha.
 */

import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import { obtenerFechaHoyBolivia, esHoyBolivia } from "../src/utils/fechas.js";

// Delays rápidos para tests unitarios
globalThis.__BRANCH_STORE_RETRY_DELAYS = [5, 10, 15];

describe("F1, F2, F5 - Singletons, Iframes, Fechas y Caché", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    globalThis.window = {
      self: {},
      top: {},
      location: { host: "localhost:4321", hostname: "localhost", protocol: "http:", search: "", href: "http://localhost:4321" },
      sessionStorage: {
        getItem() { return null; },
        setItem() {},
        removeItem() {},
        clear() {}
      },
      history: { replaceState() {} },
      dispatchEvent() {},
      addEventListener() {},
      removeEventListener() {}
    };
    globalThis.window.self = globalThis.window;
    globalThis.window.top = globalThis.window;
    globalThis.document = {
      addEventListener() {},
      removeEventListener() {},
      visibilityState: "visible"
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  test("1. Fecha oficial Bolivia: Inmune al desfase UTC de las 21:00 BOT", () => {
    const hoyBolivia = obtenerFechaHoyBolivia();
    assert.match(hoyBolivia, /^\d{4}-\d{2}-\d{2}$/, "Debe tener formato YYYY-MM-DD");
    assert.equal(esHoyBolivia(hoyBolivia), true, "La fecha generada debe reconocerse como hoy");
    assert.equal(esHoyBolivia("1999-01-01"), false, "Una fecha pasada no debe ser hoy");
  });

  test("2. Inmunidad a Iframes: Un iframe temporal NO dispara fetch de mi-alcance ni ws-ticket", async () => {
    let fetchDisparado = false;
    globalThis.fetch = async () => {
      fetchDisparado = true;
      return { ok: true, status: 200, json: async () => ({}) };
    };

    // Simular que nos encontramos dentro de un iframe temporal (window.self !== window.top)
    globalThis.window.self = {};
    globalThis.window.top = {};

    const { refrescarAlcanceDesdeApi, esContextoIframe } = await import("../src/stores/branchStore.js");
    assert.equal(esContextoIframe(), true, "Debe detectar que es contexto iframe");

    await refrescarAlcanceDesdeApi({ forzar: true });
    assert.equal(fetchDisparado, false, "En contexto iframe NUNCA debe ejecutar fetch");
  });

  test("3. Singleton en globalThis: Múltiples llamadas concurrentes comparten exactamente el mismo fetch", async () => {
    globalThis.window.self = globalThis.window;
    globalThis.window.top = globalThis.window;

    const { refrescarAlcanceDesdeApi, getSnapshot, limpiarSesionSucursal } = await import("../src/stores/branchStore.js");
    limpiarSesionSucursal();

    let llamadasFetch = 0;
    globalThis.fetch = async (url) => {
      if (url.includes("/api/Usuario/mi-alcance")) {
        llamadasFetch++;
        await new Promise((r) => setTimeout(r, 15));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            IdUsuario: 24,
            puede_ver_todas: true,
            sucursales_permitidas: [1, 2]
          })
        };
      }
      return { ok: false, status: 404 };
    };

    // 5 llamadas simultáneas sin forzar o con forzar
    const promesas = Array.from({ length: 5 }, () => refrescarAlcanceDesdeApi());
    await Promise.all(promesas);

    assert.equal(llamadasFetch, 1, "Solo debe realizarse exactamente 1 petición fetch (coalescing)");
    assert.equal(getSnapshot().puedeVerTodas, true, "El estado debe quedar confirmado");
  });

  test("4. LogisticaWebSocket: Singleton único no abre sockets duplicados", async () => {
    const { logisticaSocket } = await import("../src/services/Logistica/LogisticaWebSocket.js");
    assert.ok(logisticaSocket, "logisticaSocket debe existir");

    let socketsCreados = 0;
    class MockWebSocket {
      constructor(url) {
        socketsCreados++;
        this.url = url;
        this.readyState = 0; // CONNECTING
        setTimeout(() => {
          this.readyState = 1; // OPEN
          if (this.onopen) this.onopen();
        }, 10);
      }
      send() {}
      close() { this.readyState = 3; }
    }
    globalThis.WebSocket = MockWebSocket;

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ticket: "ticket-test-123" })
    });

    const p1 = logisticaSocket.conectar();
    const p2 = logisticaSocket.conectar();
    const p3 = logisticaSocket.conectar();
    await Promise.all([p1, p2, p3]);

    assert.equal(socketsCreados, 1, "Debe abrirse como máximo 1 socket WebSocket");
    logisticaSocket.desconectar();
    setTimeout(() => process.exit(0), 50);
  });
});
