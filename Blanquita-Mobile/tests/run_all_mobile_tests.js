/**
 * Ejecutor Central de Pruebas de la Aplicación Móvil (Fase 1.1)
 * Sistema ERP Papelera Blanquita
 */

const { spawnSync } = require("child_process");
const path = require("path");

const testFiles = [
  "test_fase_1_base_comun.test.js",
  "test_cierre_sesion_completo.test.js",
  "test_componentes_design_system.test.js",
  "calcular_contraste.js",
  "test_fase1_2_componentes_y_frescura.test.js",
  "test_componentes_react_test_renderer.test.js",
];

console.log("==================================================================");
console.log("  SUITE CENTRAL DE PRUEBAS MÓVILES - BLANQUITA CHOFERES (FASE 1.1) ");
console.log("==================================================================\n");

let exitCodeTotal = 0;
let testsPasados = 0;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  console.log(`>>> Ejecutando: ${file}`);
  const result = spawnSync("node", [filePath], { stdio: "inherit" });
  if (result.status === 0) {
    testsPasados++;
    console.log(`[OK] ${file} completado con éxito.\n`);
  } else {
    exitCodeTotal = result.status;
    console.error(`[FAIL] ${file} falló con código ${result.status}.\n`);
  }
}

console.log("==================================================================");
console.log(`RESULTADO FINAL MÓVIL: ${testsPasados}/${testFiles.length} suites pasadas.`);
console.log("==================================================================");

process.exit(exitCodeTotal);
