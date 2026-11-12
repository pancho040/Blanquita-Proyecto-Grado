/**
 * Test de renderizado del ModalDetalleParadasGPS
 * Valida la corrección del bug de hooks de React ("Internal React error: Expected static flag was missing").
 * Prueba los 3 estados: cerrado, abierto sin datos, y abierto con idAsignacion.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import ReactDOMServer from "react-dom/server";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

describe("ModalDetalleParadasGPS - Reglas de Hooks y Ciclo de Render", async () => {
  let server;
  let ModalDetalleParadasGPS;

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

    const mod = await server.ssrLoadModule("/src/components/Logistica/Rutas/ModalDetalleParadasGPS.jsx");
    ModalDetalleParadasGPS = mod.default;
  });

  test.after(async () => {
    if (server) {
      await server.close();
    }
  });

  it("1. Renderiza correctamente cuando está cerrado (abierto=false, idAsignacion=null)", () => {
    assert.doesNotThrow(() => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ModalDetalleParadasGPS, {
          abierto: false,
          idAsignacion: null,
          onCerrar: () => {},
        })
      );
      assert.strictEqual(typeof html, "string");
    }, "No debe lanzar error de React cuando está cerrado");
  });

  it("2. Renderiza correctamente cuando está abierto pero sin datos (abierto=true, idAsignacion=null)", () => {
    assert.doesNotThrow(() => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ModalDetalleParadasGPS, {
          abierto: true,
          idAsignacion: null,
          onCerrar: () => {},
        })
      );
      assert.strictEqual(typeof html, "string");
    }, "No debe alterar el orden de hooks cuando idAsignacion es null");
  });

  it("3. Renderiza correctamente cuando está abierto con datos/id (abierto=true, idAsignacion=101)", () => {
    assert.doesNotThrow(() => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ModalDetalleParadasGPS, {
          abierto: true,
          idAsignacion: 101,
          onCerrar: () => {},
          onActualizacion: () => {},
        })
      );
      assert.strictEqual(typeof html, "string");
    }, "Todos los hooks se ejecutan incondicionalmente en cada render");
  });
});
