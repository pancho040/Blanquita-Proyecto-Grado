import assert from "node:assert";
import test from "node:test";

test("AprobacionCargaStore: Apertura, Cierre y Notificación a Suscriptores", async () => {
  // Simular entorno DOM básico si hace falta
  globalThis.window = {
    dispatchEvent: () => {},
    addEventListener: () => {},
  };

  const {
    abrirAprobarCarga,
    cerrarAprobarCarga,
    suscribirAprobacionCarga,
    obtenerEstadoAprobacionCarga,
  } = await import("../src/stores/aprobacionCargaStore.js");

  let estadoRecibido = null;
  const unsub = suscribirAprobacionCarga((est) => {
    estadoRecibido = est;
  });

  // 1. Abrir con idSolicitud e idAsignacion
  abrirAprobarCarga({ idSolicitud: 101, idAsignacion: 253 });
  assert.strictEqual(estadoRecibido.abierto, true);
  assert.strictEqual(estadoRecibido.idSolicitud, 101);
  assert.strictEqual(estadoRecibido.idAsignacion, 253);

  const snapshot = obtenerEstadoAprobacionCarga();
  assert.strictEqual(snapshot.abierto, true);
  assert.strictEqual(snapshot.idSolicitud, 101);

  // 2. Cerrar
  cerrarAprobarCarga();
  assert.strictEqual(estadoRecibido.abierto, false);

  unsub();
});

test("Fechas: America/La_Paz no adelanta al día siguiente respecto a hora local", async () => {
  const { obtenerFechaHoyBolivia, esHoyBolivia, sumarDiasBolivia } = await import(
    "../src/utils/fechas.js"
  );

  const hoyBolivia = obtenerFechaHoyBolivia();
  assert.match(hoyBolivia, /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(esHoyBolivia(hoyBolivia), true);
  assert.strictEqual(esHoyBolivia("1999-01-01"), false);

  const manana = sumarDiasBolivia(1, hoyBolivia);
  assert.match(manana, /^\d{4}-\d{2}-\d{2}$/);
  assert.notStrictEqual(manana, hoyBolivia);
});
