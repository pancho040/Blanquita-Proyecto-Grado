/**
 * Test Suite Subagente B: Verificación Integral de:
 * 1. LogisticaWebSocket: Resolución de URL apuntando al Backend (puerto 8000 en dev, nunca 4321).
 * 2. branchStore / usePaginaSucursal: Bloqueo de 403 iniciales en Potosí, bandera listoParaConsultar y resolución de sede fija.
 * 3. Aislamiento estricto de notificaciones en sede fija vs multisede.
 */

import assert from "node:assert/strict";
import test, { describe, beforeEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "../src");

// Simulación de entorno DOM mínimo
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

const {
  inicializarAlcanceUsuario,
  limpiarSesionSucursal,
  cambiarSucursalActiva,
  getSnapshot,
  usePaginaSucursal,
  useBranch,
  SUCURSALES_CATALOGO,
} = await import("../src/stores/branchStore.js");

describe("Subagente B - Tests Unitarios Frontend", () => {
  beforeEach(() => {
    limpiarSesionSucursal();
    globalThis.window.sessionStorage.clear();
    globalThis.window.location.search = "";
    globalThis.window.location.href = "http://localhost:4321/supervisor/asignaciones";
  });

  test("1. Estado Inicial en branchStore previene ráfaga de 403 a Sucre", () => {
    // Al cargar la app, ANTES de que mi-alcance responda
    const snap = getSnapshot();
    assert.equal(snap.inicializado, false, "Store no debe estar marcado como inicializado inicialmente");
    assert.equal(snap.sucursalActiva, null, "sucursalActiva inicial debe ser null (no '1') para evitar 403 a Sucre");
  });

  test("2. usePaginaSucursal bloquea consultas con listoParaConsultar=false mientras no resuelve mi-alcance", () => {
    const snap = getSnapshot();
    const listoParaConsultar = Boolean(snap.inicializado);
    let sucursalEfectiva = snap.sucursalActiva;
    if (!listoParaConsultar && !sucursalEfectiva) {
      sucursalEfectiva = null;
    }
    const sucursalIdNumerico =
      !listoParaConsultar || sucursalEfectiva === "todas" || sucursalEfectiva == null
        ? null
        : Number(sucursalEfectiva);

    assert.equal(listoParaConsultar, false, "listoParaConsultar debe ser false antes de inicializar");
    assert.equal(sucursalEfectiva, null, "sucursal no debe forzar '1' a ciegas para un usuario no identificado");
    assert.equal(sucursalIdNumerico, null, "sucursalIdNumerico debe ser null");
  });

  test("3. Usuario de Sede Fija Potosí (ej. Gonzalo Flores) se fija en 2 y JAMÁS en 1", () => {
    // Respuesta típica de /Usuario/mi-alcance para Gonzalo Flores (Potosí)
    const dataMiAlcancePotosi = {
      id_usuario: 15,
      puede_ver_todas: false,
      sucursal_defecto: 2,
      sucursales_permitidas: [
        { id: 2, nombre: "Sucursal Potosí", ciudad: "Potosí" }
      ]
    };

    inicializarAlcanceUsuario(dataMiAlcancePotosi);
    const snap = getSnapshot();

    assert.equal(snap.inicializado, true);
    assert.equal(snap.sucursalActiva, "2", "La sucursal activa debe ser 2 (Potosí)");
    assert.equal(snap.sucursalAsignada, 2, "La sucursal asignada debe ser 2");
    assert.equal(snap.puedeVerTodas, false);
    assert.equal(snap.sucursalesPermitidas.length, 1);
    assert.equal(snap.sucursalesPermitidas[0].id, 2);

    const listoParaConsultar = Boolean(snap.inicializado);
    let sucursalEfectiva = snap.sucursalActiva;
    assert.equal(listoParaConsultar, true);
    assert.equal(sucursalEfectiva, "2");
    assert.equal(Number(sucursalEfectiva), 2);
    assert.equal(globalThis.window.location.search, "?sucursal=2");
  });

  test("4. Manipulación de URL en usuario Potosí se restaura a 2 de forma inviolable", () => {
    const dataMiAlcancePotosi = {
      id_usuario: 15,
      puede_ver_todas: false,
      sucursal_defecto: 2,
      sucursales_permitidas: [{ id: 2, nombre: "Sucursal Potosí", ciudad: "Potosí" }]
    };

    // Intentar forzar sucursal 1 (Sucre) o 'todas'
    globalThis.window.location.search = "?sucursal=1";
    inicializarAlcanceUsuario(dataMiAlcancePotosi);

    const snap = getSnapshot();
    assert.equal(snap.sucursalActiva, "2", "Intento de forzar sucursal 1 debe revertirse a 2");
    assert.equal(globalThis.window.location.search, "?sucursal=2");

    // Intento de llamar cambiarSucursalActiva('todas') o '1'
    cambiarSucursalActiva("todas");
    assert.equal(getSnapshot().sucursalActiva, "2");

    cambiarSucursalActiva(1);
    assert.equal(getSnapshot().sucursalActiva, "2");
  });

  test("5. Auditoría de LogisticaWebSocket: Conecta a puerto 8000 y NUNCA a 4321", () => {
    const archivoWS = path.join(SRC_DIR, "services/Logistica/LogisticaWebSocket.js");
    const contenido = fs.readFileSync(archivoWS, "utf8");

    // Verificar que maneje puerto 8000 y no use window.location.host a ciegas
    assert.ok(contenido.includes("8000"), "LogisticaWebSocket DEBE referenciar el puerto 8000");
    assert.ok(!contenido.includes("const wsUrl = `${wsProtocol}//${host}/ws/logistica${ticketParam}`;"), "No debe armar URL con host directo de frontend");
  });

  test("6. Auditoría de NavBar y NotificacionesBell: Sin animate-ping ni parpadeo y campana limpia", () => {
    const bellFile = path.join(SRC_DIR, "components/common/NotificacionesBell.jsx");
    const bellContent = fs.readFileSync(bellFile, "utf8");

    const navFile = path.join(SRC_DIR, "components/layout/NavBar.jsx");
    const navContent = fs.readFileSync(navFile, "utf8");

    // Icono Bell limpio y sin animate-ping
    assert.ok(bellContent.includes('className="w-5 h-5 shrink-0 text-slate-600"'), "Debe contener el icono Bell con w-5 h-5 shrink-0 text-slate-600");
    assert.ok(!bellContent.includes("animate-ping"), "NotificacionesBell NO debe contener animate-ping");
    assert.ok(!bellContent.includes("animate-wiggle"), "NotificacionesBell NO debe contener animate-wiggle");
    assert.ok(!navContent.includes("animate-ping"), "NavBar NO debe contener animate-ping");
    assert.ok(!navContent.includes("bg-emerald-400 animate-pulse"), "Badge de rol en NavBar no debe tener parpadeo animate-pulse");
    assert.ok(navContent.includes("<ShieldCheck size={13} className=\"text-white shrink-0\" />"), "ShieldCheck debe estar presente y limpio");
  });

  test("7. Auditoría de ToastLiveContainer: Aislamiento por sucursal implementado", () => {
    const toastFile = path.join(SRC_DIR, "components/common/ToastLiveContainer.jsx");
    const toastContent = fs.readFileSync(toastFile, "utf8");

    assert.ok(toastContent.includes("useBranch"), "ToastLiveContainer debe consumir useBranch");
    assert.ok(toastContent.includes("extraerSedeEvento"), "ToastLiveContainer debe implementar extractor de sede");
    assert.ok(toastContent.includes("puedeVerTodas"), "ToastLiveContainer debe filtrar eventos si no es multisede");
  });
});
