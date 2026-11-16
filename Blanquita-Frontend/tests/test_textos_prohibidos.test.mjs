/**
 * Test de verificación de ausencia de palabras prohibidas y de relleno en UI de Logística (L5)
 * Ejecuta con: node tests/test_textos_prohibidos.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_SRC = path.resolve(__dirname, "../src");

const PATRONES_PROHIBIDOS = [
  /satelital/i,
  /centro de mando/i,
  /1\.\.N/i,
  /monitoreo de flota/i,
  /monitoreo de rutas/i,
  /visión integral/i,
  /gestionar chofer \/ expediente/i,
  /expediente de ruta/i,
  /cerrar expediente/i,
  /auditoría al día/i,
  /inventario físico a bordo/i,
  /itinerario y despachos/i,
  /sistema (integral de gestión|de gestión integral)/i,
];

function obtenerArchivos(dir) {
  let archivos = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      archivos = archivos.concat(obtenerArchivos(fullPath));
    } else if (ent.isFile() && (ent.name.endsWith(".jsx") || ent.name.endsWith(".js") || ent.name.endsWith(".astro"))) {
      archivos.push(fullPath);
    }
  }
  return archivos;
}

test("Verificación de Textos Limpios y Libres de Relleno en todo el Frontend (L5)", (t) => {
  const archivos = obtenerArchivos(DIR_SRC);
  const fallos = [];

  for (const archivo of archivos) {
    const contenido = fs.readFileSync(archivo, "utf-8");
    const lineas = contenido.split("\n");

    lineas.forEach((linea, index) => {
      // Ignorar comentarios
      const lineaTrim = linea.trim();
      if (lineaTrim.startsWith("//") || lineaTrim.startsWith("/*") || lineaTrim.startsWith("*")) {
        return;
      }

      // Ignorar imports técnicos
      if (lineaTrim.startsWith("import ") || lineaTrim.startsWith("export default function Expediente")) {
        return;
      }

      for (const patron of PATRONES_PROHIBIDOS) {
        if (patron.test(linea)) {
          const sinComentarios = linea.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//, "");
          if (patron.test(sinComentarios)) {
            fallos.push({
              archivo: path.relative(DIR_SRC, archivo),
              linea: index + 1,
              patron: patron.toString(),
              texto: linea.trim()
            });
          }
        }
      }
    });
  }

  if (fallos.length > 0) {
    console.error("Se encontraron palabras prohibidas en los siguientes archivos:");
    fallos.forEach(f => console.error(`  - ${f.archivo}:${f.linea} [${f.patron}]: ${f.texto}`));
  }

  assert.equal(fallos.length, 0, `Se encontraron ${fallos.length} ocurrencias de palabras prohibidas.`);
});
