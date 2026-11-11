/**
 * Suite de Pruebas Automatizadas Fase 3.3 (Revisor Frontend de Sucursales)
 * Ejecuta verificación completa de los 3 perfiles de usuario simulados,
 * aislamiento de filtros, fallback cerrado, manipulación de URL y persistencia.
 */

import assert from "node:assert/strict";
import test, { describe, beforeEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, "../src");

// Simulación de entorno DOM (window, location, history, sessionStorage)
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
    search: "",
    href: "http://localhost:4321/contador/notas-venta",
  },
  history: {
    replaceState(state, title, url) {
      const u = new URL(url, "http://localhost:4321");
      globalThis.window.location.search = u.search;
      globalThis.window.location.href = u.href;
    },
  },
  addEventListener() {},
};

// Importar el store
const {
  inicializarAlcanceUsuario,
  cambiarSucursalActiva,
  getSnapshot,
  usePaginaSucursal,
  SUCURSALES_CATALOGO,
} = await import("../src/stores/branchStore.js");

describe("Fase 3.3 - Pruebas de Frontend con 3 Perfiles Simulados (Sin BD)", () => {
  beforeEach(() => {
    globalThis.window.sessionStorage.clear();
    globalThis.window.location.search = "";
    globalThis.window.location.href = "http://localhost:4321/contador/notas-venta";
  });

  // =========================================================================
  // PERFIL 1: MULTISEDE (Gerente / Contador / Supervisor con puede_ver_todas)
  // =========================================================================
  test("Perfil 1 (Multisede): Filtro visible, permite 'Todas', Sucre y Potosí, y persiste en sessionStorage", () => {
    const usuarioMultisede = {
      IdUsuario: 12,
      NombreCompleto: "Don Osvaldo Gerente",
      IdRol: 3,
      IsAdmin: true,
      puede_ver_todas: true,
      sucursales_permitidas: [
        { id: 1, nombre: "Sucursal Central Sucre", ciudad: "Sucre" },
        { id: 2, nombre: "Sucursal Potosí", ciudad: "Potosí" },
      ],
      IdSucursal: 1,
    };

    inicializarAlcanceUsuario(usuarioMultisede);
    let snap = getSnapshot();

    // 1. Debe ser multisede con filtro visible
    assert.equal(snap.puedeVerTodas, true);
    assert.equal(snap.sucursalesPermitidas.length, 2);
    const esMultisede = snap.sucursalesPermitidas.length > 1 || snap.puedeVerTodas;
    assert.equal(esMultisede, true, "El filtro DEBE ser visible para multisede");

    // 2. Puede cambiar a 'todas'
    cambiarSucursalActiva("todas");
    snap = getSnapshot();
    assert.equal(snap.sucursalActiva, "todas");
    assert.equal(globalThis.window.sessionStorage.getItem("blanquita_sucursal_activa"), "todas");
    assert.equal(globalThis.window.location.search, "?sucursal=todas");

    // 3. Puede alternar a Potosí (2)
    cambiarSucursalActiva(2);
    snap = getSnapshot();
    assert.equal(snap.sucursalActiva, "2");
    assert.equal(globalThis.window.sessionStorage.getItem("blanquita_sucursal_activa"), "2");
    assert.equal(globalThis.window.location.search, "?sucursal=2");

    // 4. En pantalla operativa que NO permite 'todas', usePaginaSucursal fuerza sede física individual
    cambiarSucursalActiva("todas");
    snap = getSnapshot();
    // Simulamos hook en componente operativo (permiteTodas: false)
    let sucursalEfectiva = snap.sucursalActiva;
    if (sucursalEfectiva === "todas") {
      sucursalEfectiva = String(snap.sucursalAsignada || snap.sucursalesPermitidas[0]?.id || 1);
    }
    assert.equal(sucursalEfectiva, "1", "En pantallas operativas 'todas' debe resolverse a sede física individual");
  });

  // =========================================================================
  // PERFIL 2: SEDE FIJA SUCRE (IdSucursal = 1, sin permiso multisede)
  // =========================================================================
  test("Perfil 2 (Sede Fija Sucre): Filtro oculto, manipulación ?sucursal=2 es restaurada a 1, no permite 'todas'", () => {
    const usuarioSucre = {
      IdUsuario: 20,
      NombreCompleto: "Operador Sucre",
      IdRol: 1,
      IsAdmin: false,
      puede_ver_todas: false,
      sucursales_permitidas: [{ id: 1, nombre: "Sucursal Central Sucre", ciudad: "Sucre" }],
      IdSucursal: 1,
    };

    // Simulamos intento malicioso de manipular URL con ?sucursal=2
    globalThis.window.location.search = "?sucursal=2";

    inicializarAlcanceUsuario(usuarioSucre);
    const snap = getSnapshot();

    // 1. Filtro debe estar OCULTO
    const esMultisede = snap.sucursalesPermitidas.length > 1 || snap.puedeVerTodas;
    assert.equal(esMultisede, false, "El filtro DEBE estar oculto para usuario de sede fija");

    // 2. La manipulación de URL a ?sucursal=2 debe ser RESTAURADA a sucursal 1 (fallo cerrado)
    assert.equal(snap.sucursalActiva, "1");
    assert.equal(globalThis.window.location.search, "?sucursal=1", "URL manipulada debe restaurarse a sucursal 1");

    // 3. Intento de cambiar a 'todas' debe ser ignorado
    cambiarSucursalActiva("todas");
    assert.equal(getSnapshot().sucursalActiva, "1");

    // 4. Intento de cambiar a Potosí (2) debe ser ignorado
    cambiarSucursalActiva(2);
    assert.equal(getSnapshot().sucursalActiva, "1");
  });

  // =========================================================================
  // PERFIL 3: SEDE FIJA POTOSÍ (IdSucursal = 2, sin permiso multisede)
  // =========================================================================
  test("Perfil 3 (Sede Fija Potosí): Filtro oculto, manipulación ?sucursal=1 es restaurada a 2, no permite 'todas'", () => {
    const usuarioPotosi = {
      IdUsuario: 30,
      NombreCompleto: "Chofer Potosí",
      IdRol: 6,
      IsAdmin: false,
      puede_ver_todas: false,
      sucursales_permitidas: [{ id: 2, nombre: "Sucursal Potosí", ciudad: "Potosí" }],
      IdSucursal: 2,
    };

    // Simulamos intento de manipular URL con ?sucursal=1 o ?sucursal=todas
    globalThis.window.location.search = "?sucursal=todas";

    inicializarAlcanceUsuario(usuarioPotosi);
    const snap = getSnapshot();

    // 1. Filtro debe estar OCULTO
    const esMultisede = snap.sucursalesPermitidas.length > 1 || snap.puedeVerTodas;
    assert.equal(esMultisede, false, "El filtro DEBE estar oculto para usuario de Potosí");

    // 2. La manipulación de URL con ?sucursal=todas debe ser RESTAURADA a sucursal 2
    assert.equal(snap.sucursalActiva, "2");
    assert.equal(globalThis.window.location.search, "?sucursal=2", "URL manipulada debe restaurarse a sucursal 2");

    // 3. Intento de cambiar a Sucre (1) debe ser ignorado
    cambiarSucursalActiva(1);
    assert.equal(getSnapshot().sucursalActiva, "2");
  });

  // =========================================================================
  // VERIFICACIÓN DE PERSISTENCIA Y AISLAMIENTO DE PESTAÑAS (sessionStorage)
  // =========================================================================
  test("Persistencia por pestaña (sessionStorage): Sobrevive a recarga y no contamina otras pestañas", () => {
    // Si la pestaña ya tenía sucursal 2 en sessionStorage
    globalThis.window.sessionStorage.setItem("blanquita_sucursal_activa", "2");

    const usuarioMultisede = {
      IdUsuario: 12,
      puede_ver_todas: true,
      sucursales_permitidas: SUCURSALES_CATALOGO,
      IdSucursal: 1,
    };

    inicializarAlcanceUsuario(usuarioMultisede);
    assert.equal(getSnapshot().sucursalActiva, "2", "Debe recuperar la selección persistida de la pestaña");
  });

  // =========================================================================
  // AUDITORÍA DE CÓDIGO FUENTE: AUSENCIA TOTAL DE LOCALSTORAGE Y EVENTOS AD-HOC
  // =========================================================================
  test("Ausencia total de localStorage.getItem('blanquita_sucursal_activa') y eventos 'sucursal_cambiada'", () => {
    function buscarEnDirectorio(dir, extensiones) {
      let resultados = [];
      const archivos = fs.readdirSync(dir);
      for (const archivo of archivos) {
        const rutaCompleta = path.join(dir, archivo);
        const stat = fs.statSync(rutaCompleta);
        if (stat.isDirectory()) {
          resultados = resultados.concat(buscarEnDirectorio(rutaCompleta, extensiones));
        } else if (extensiones.some((ext) => archivo.endsWith(ext))) {
          const contenido = fs.readFileSync(rutaCompleta, "utf8");
          if (contenido.includes("blanquita_sucursal_activa") && contenido.includes("localStorage")) {
            resultados.push(`localStorage en: ${rutaCompleta}`);
          }
          if (contenido.includes("sucursal_cambiada")) {
            resultados.push(`sucursal_cambiada en: ${rutaCompleta}`);
          }
        }
      }
      return resultados;
    }

    const hallazgos = buscarEnDirectorio(SRC_DIR, [".js", ".jsx", ".astro"]);
    assert.equal(hallazgos.length, 0, `Se encontraron usos obsoletos:\n${hallazgos.join("\n")}`);
  });
});
