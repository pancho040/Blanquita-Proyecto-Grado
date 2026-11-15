/**
 * Test de Verificación de Menú Unificado y Limpieza de Textos
 * Valida que "Rastreo" no aparezca como ruta o menú suelto,
 * y que las constantes institucionales concisas se encuentren definidas y aplicadas.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

describe("Fase 3 - Unificación de Menú sin Rastreo y Textos Concisos", async () => {
  let server;
  let NavBarRoutes;
  let TEXTOS_SUPERVISOR;

  test.before(async () => {
    server = await createServer({
      root: rootDir,
      resolve: {
        alias: {
          "@/constants/estados": path.resolve(rootDir, "src/constants/Estados.js"),
          "@": path.resolve(rootDir, "src"),
        },
      },
      server: { middlewareMode: true },
      appType: "custom",
    });

    NavBarRoutes = await server.ssrLoadModule("/src/constants/NavBarRoutes.js");
    const modTextos = await server.ssrLoadModule("/src/constants/textosNavegacion.js");
    TEXTOS_SUPERVISOR = modTextos.TEXTOS_SUPERVISOR;
  });

  test.after(async () => {
    if (server) {
      await server.close();
    }
  });

  it("1. RutasSupervisor NO contiene 'Rastreo' como elemento suelto ni ruta 'rutas/rastreo'", () => {
    const rutasSup = NavBarRoutes.RutasSupervisor;
    assert.ok(Array.isArray(rutasSup), "RutasSupervisor debe ser un array");

    const titulos = rutasSup.map((r) => r.titulo);
    const paths = rutasSup.map((r) => r.ruta);

    assert.ok(!titulos.includes("Rastreo"), "No debe existir ítem de menú 'Rastreo'");
    assert.ok(!paths.includes("rutas/rastreo"), "No debe existir ruta 'rutas/rastreo'");
    assert.ok(titulos.includes("Rutas"), "Debe existir menú unificado 'Rutas'");
    assert.ok(titulos.includes("Despachos"), "Debe existir menú conciso 'Despachos'");
  });

  it("2. RutasAdmin no contiene enlaces residuales a 'rutas/rastreo'", () => {
    const rutasAdmin = NavBarRoutes.RutasAdmin;
    const moduloLogistica = rutasAdmin.find((m) => m.titulo === "Logística");
    assert.ok(moduloLogistica, "Debe existir módulo Logística en RutasAdmin");

    const subrutas = moduloLogistica.subrutas || [];
    const subTitulos = subrutas.map((s) => s.titulo);
    const subPaths = subrutas.map((s) => s.ruta);

    assert.ok(!subTitulos.includes("Rastreo"), "Logística admin no debe tener 'Rastreo' suelto");
    assert.ok(!subPaths.includes("rutas/rastreo"), "Logística admin no debe apuntar a 'rutas/rastreo'");
    assert.ok(subTitulos.includes("Rutas"), "Debe existir subruta 'Rutas'");
    assert.ok(subTitulos.includes("Despachos"), "Debe existir subruta 'Despachos'");
  });

  it("3. Constantes de textos institucionales están completas y sin palabras de relleno", () => {
    assert.strictEqual(TEXTOS_SUPERVISOR.RUTAS, "Rutas");
    assert.strictEqual(TEXTOS_SUPERVISOR.DESPACHOS, "Despachos");
    assert.strictEqual(TEXTOS_SUPERVISOR.VISTA_EN_VIVO, "En vivo");
    assert.strictEqual(TEXTOS_SUPERVISOR.VISTA_PLANIFICACION, "Planificación");
    assert.strictEqual(TEXTOS_SUPERVISOR.SUBTAB_MAPA, "Mapa");
    assert.strictEqual(TEXTOS_SUPERVISOR.SUBTAB_PARADAS, "Paradas");
    assert.strictEqual(TEXTOS_SUPERVISOR.SUBTAB_PEDIDOS, "Pedidos");
    assert.strictEqual(TEXTOS_SUPERVISOR.TAB_CARGA_STOCK, "Carga y stock");
    assert.strictEqual(TEXTOS_SUPERVISOR.TAB_CIERRE_RENDICION, "Cierre y rendición");
    assert.strictEqual(TEXTOS_SUPERVISOR.TAB_HISTORIAL, "Historial");
  });
});
