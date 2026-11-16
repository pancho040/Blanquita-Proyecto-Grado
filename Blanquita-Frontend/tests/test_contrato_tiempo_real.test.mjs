/**
 * test_contrato_tiempo_real.test.mjs
 * Test de contrato estático para validar la integridad de la API unificada de tiempo real.
 * Garantiza:
 * 1. Todos los identificadores importados de LogisticaSSEClient existen en sus exports.
 * 2. Ningún archivo en src/ invoca métodos inexistentes o viejos (como suscribir o onEstadoConexion).
 * 3. Prohibición estricta de 'new WebSocket' y del módulo legado 'LogisticaWebSocket'.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, "../src");

// 1. Cargar exports reales del módulo canónico
const moduloPath = path.resolve(srcDir, "services/Logistica/LogisticaSSEClient.js");
const modulo = await import(`file://${moduloPath}`);
const exportsPermitidos = new Set(Object.keys(modulo));
exportsPermitidos.add("default");

// 2. Extraer métodos válidos de la instancia singleton
const instancia = modulo.logisticaSSE || (new modulo.LogisticaSSEClient());
const prototipo = Object.getPrototypeOf(instancia);
const metodosInstancia = new Set([
  ...Object.getOwnPropertyNames(prototipo),
  ...Object.keys(instancia),
]);
// Quitar constructor
metodosInstancia.delete("constructor");

const METODOS_PROHIBIDOS = new Set(["suscribir", "onEstadoConexion", "send", "send_json"]);

console.log("[Contrato SSE] Exports permitidos:", Array.from(exportsPermitidos).join(", "));
console.log("[Contrato SSE] Métodos de instancia permitidos:", Array.from(metodosInstancia).join(", "));

function obtenerArchivos(dir) {
  let resultados = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      resultados = resultados.concat(obtenerArchivos(fullPath));
    } else if (item.isFile() && (item.name.endsWith(".js") || item.name.endsWith(".jsx"))) {
      resultados.push(fullPath);
    }
  }
  return resultados;
}

const archivos = obtenerArchivos(srcDir);
const violaciones = [];

for (const archivo of archivos) {
  const relativo = path.relative(srcDir, archivo).replace(/\\/g, "/");
  const contenido = fs.readFileSync(archivo, "utf-8");
  const lineas = contenido.split("\n");

  // Omitir los propios módulos de definición interna durante la transición
  if (relativo === "services/Logistica/LogisticaSSEClient.js" || relativo === "services/Logistica/LogisticaWebSocket.js") continue;

  // Chequeo 1: Prohibición de módulo legado LogisticaWebSocket
  if (contenido.includes("LogisticaWebSocket")) {
    violaciones.push({
      archivo: relativo,
      linea: lineas.findIndex((l) => l.includes("LogisticaWebSocket")) + 1,
      regla: "NO_LEGACY_IMPORT",
      mensaje: "Importación o referencia al módulo eliminado 'LogisticaWebSocket'.",
    });
  }

  // Chequeo 2: Prohibición de 'new WebSocket'
  if (contenido.includes("new WebSocket")) {
    violaciones.push({
      archivo: relativo,
      linea: lineas.findIndex((l) => l.includes("new WebSocket")) + 1,
      regla: "NO_NEW_WEBSOCKET",
      mensaje: "Instanciación directa de 'new WebSocket' prohibida.",
    });
  }

  // Chequeo 3: Prohibición de métodos viejos no existentes (suscribir, onEstadoConexion)
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    for (const metodoProhibido of METODOS_PROHIBIDOS) {
      const regex = new RegExp(`\\b(logisticaSSE|logisticaSocket)\\.${metodoProhibido}\\b`);
      if (regex.test(linea)) {
        violaciones.push({
          archivo: relativo,
          linea: i + 1,
          regla: "METODO_PROHIBIDO_O_INEXISTENTE",
          mensaje: `Llamada a método prohibido o inexistente '${metodoProhibido}'.`,
        });
      }
    }
  }

  // Chequeo 4: Si importa de LogisticaSSEClient, verificar identificadores importados
  const regexImport = /import\s+\{([^}]+)\}\s+from\s+["'](@\/services\/Logistica\/LogisticaSSEClient|(?:\.\.?\/)+services\/Logistica\/LogisticaSSEClient)["']/g;
  let matchImport;
  while ((matchImport = regexImport.exec(contenido)) !== null) {
    const importados = matchImport[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    for (const ident of importados) {
      if (!exportsPermitidos.has(ident)) {
        violaciones.push({
          archivo: relativo,
          linea: lineas.findIndex((l) => l.includes(ident)) + 1,
          regla: "EXPORT_INEXISTENTE",
          mensaje: `Identificador importado '${ident}' no existe en exports de LogisticaSSEClient.`,
        });
      }
    }
  }

  // Chequeo 5: Llamadas a métodos sobre logisticaSSE: logisticaSSE.<metodo>(...)
  const regexMetodo = /\blogisticaSSE\.([a-zA-Z0-9_]+)\s*\(/g;
  let matchMetodo;
  while ((matchMetodo = regexMetodo.exec(contenido)) !== null) {
    const metodoLlamado = matchMetodo[1];
    if (!metodosInstancia.has(metodoLlamado)) {
      violaciones.push({
        archivo: relativo,
        linea: lineas.findIndex((l) => l.includes(`logisticaSSE.${metodoLlamado}`)) + 1,
        regla: "METODO_INEXISTENTE_INSTANCIA",
        mensaje: `Método 'logisticaSSE.${metodoLlamado}()' no existe en la instancia singleton.`,
      });
    }
  }
}

if (violaciones.length > 0) {
  console.error(`\n❌ [FALLO DE CONTRATO] Se encontraron ${violaciones.length} violaciones en src/:`);
  for (const v of violaciones) {
    console.error(`  - ${v.archivo}:${v.linea} [${v.regla}]: ${v.mensaje}`);
  }
  process.exit(1);
} else {
  console.log(`\n✅ [CONTRATO VÁLIDO] Todos los archivos en src/ cumplen estrictamente con la API única de LogisticaSSEClient.`);
  process.exit(0);
}
