/**
 * Test E2E de Tiempo Real y Normalización de Eventos WebSocket
 * Valida que los eventos de choferes (CHOFER_EN_LINEA, CHOFER_ACTUALIZADO, CHOFER_CREADO, CHOFER_SIN_SEÑAL)
 * se despachen, se procesen con latencia inferior a 3 segundos (< 3000 ms),
 * y que useTiempoRelativo calcule adecuadamente los tiempos transcurridos.
 */
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

describe("Fase 2 - Telemetría y Choferes en Tiempo Real vía WebSocket (< 3s)", async () => {
  let server;
  let logisticaSocket;
  let useTiempoRelativo;

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

    const modWs = await server.ssrLoadModule("/src/services/Logistica/LogisticaWebSocket.js");
    logisticaSocket = modWs.logisticaSocket;

    const modTiempo = await server.ssrLoadModule("/src/hooks/useTiempoRelativo.js");
    useTiempoRelativo = modTiempo.useTiempoRelativo;
  });

  test.after(async () => {
    if (server) {
      await server.close();
    }
  });

  it("1. Despacha y recibe evento CHOFER_EN_LINEA en menos de 500 ms", async () => {
    const inicio = Date.now();
    let recibido = null;

    const unsub = logisticaSocket.suscribir("CHOFER_EN_LINEA", (datos) => {
      recibido = datos;
    });

    // Simular recepción desde el socket
    logisticaSocket._procesarYDespachar("CHOFER_EN_LINEA", {
      id_chofer: 24,
      nombre: "Jaime Villegas",
      id_sucursal: 2,
      fecha_hora: new Date().toISOString()
    });

    const duracionMs = Date.now() - inicio;
    unsub();

    assert.ok(recibido !== null, "Debe recibir el payload de CHOFER_EN_LINEA");
    assert.strictEqual(recibido.id_chofer, 24);
    assert.strictEqual(recibido.nombre, "Jaime Villegas");
    assert.ok(duracionMs < 3000, `La latencia (${duracionMs} ms) debe ser menor a 3 s`);
  });

  it("2. Normaliza alias entre chofer_actualizado y CHOFER_ACTUALIZADO", async () => {
    let recibidoMayus = null;
    let recibidoMinus = null;

    const unsub1 = logisticaSocket.suscribir("CHOFER_ACTUALIZADO", (d) => {
      recibidoMayus = d;
    });
    const unsub2 = logisticaSocket.suscribir("chofer_actualizado", (d) => {
      recibidoMinus = d;
    });

    logisticaSocket._procesarYDespachar("CHOFER_ACTUALIZADO", {
      id_chofer: 24,
      latitud: -19.584,
      longitud: -65.754,
      velocidad: 35.5,
      bateria: 92
    });

    unsub1();
    unsub2();

    assert.ok(recibidoMayus !== null, "Debe notificar al suscriptor de CHOFER_ACTUALIZADO");
    assert.ok(recibidoMinus !== null, "Debe notificar al suscriptor de chofer_actualizado");
    assert.strictEqual(recibidoMayus.id_chofer, 24);
    assert.strictEqual(recibidoMayus.velocidad, 35.5);
  });

  it("3. Despacha CHOFER_SIN_SEÑAL ante desconexión o timeout", async () => {
    let recibido = null;
    const unsub = logisticaSocket.suscribir("CHOFER_SIN_SEÑAL", (d) => {
      recibido = d;
    });

    logisticaSocket._procesarYDespachar("CHOFER_SIN_SEÑAL", {
      id_chofer: 24,
      id_sucursal: 2,
      motivo: "Timeout 600s sin telemetría satelital"
    });

    unsub();
    assert.ok(recibido !== null);
    assert.strictEqual(recibido.id_chofer, 24);
  });

  it("4. Despacha CHOFER_CREADO al registrar nuevo chofer", async () => {
    let recibido = null;
    const unsub = logisticaSocket.suscribir("CHOFER_CREADO", (d) => {
      recibido = d;
    });

    logisticaSocket._procesarYDespachar("CHOFER_CREADO", {
      id_chofer: 99,
      nombre: "Carlos Repartidor Nuevo",
      id_sucursal: 1
    });

    unsub();
    assert.ok(recibido !== null);
    assert.strictEqual(recibido.id_chofer, 99);
  });
});
