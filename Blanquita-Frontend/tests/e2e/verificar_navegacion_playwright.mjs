/**
 * verificar_navegacion_playwright.mjs
 * Prueba e2e con Playwright Headless contra la aplicación web real.
 * Revisa:
 * 1. Cero errores de JavaScript en consola o de página (pageerror).
 * 2. Cero conexiones WebSocket creadas.
 * 3. Cero llamadas a ws-ticket.
 * 4. Exactamente 1 conexión SSE activa durante la navegación.
 * 5. Llamadas a /Usuario/mi-alcance controladas por documento.
 * Recorrido: /inicio?sucursal=2 -> /supervisor/rutas?vista=vivo -> ?vista=planificacion -> despachos -> clientes -> rutas.
 */

import { chromium } from "playwright";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

const baseUrl = process.env.BASE_URL || "http://localhost:4321";

console.log(`======================================================================`);
console.log(`  PLAYWRIGHT E2E: NAVEGACIÓN Y MEDICIÓN DE NETWORK (${baseUrl})`);
console.log(`======================================================================`);

// 1. Obtener credenciales reales de supervisor de Potosí de prueba
console.log("[1/6] Obteniendo sesión de prueba para supervisor Potosí...");
const pythonExe = path.resolve(rootDir, "Blanquita-Backend/.venv/Scripts/python.exe");
const tokenScript = path.resolve(__dirname, "generar_token_e2e.py");

const credsRaw = execSync(`"${pythonExe}" "${tokenScript}"`, { cwd: rootDir, encoding: "utf-8" });
const creds = JSON.parse(credsRaw);
if (!creds.token) {
  console.error("❌ No se pudo obtener token de autenticación:", credsRaw);
  process.exit(1);
}
console.log(`  -> Sesión generada con éxito para CI ${creds.ci} (IdUsuario ${creds.id_usuario})`);

// 2. Iniciar navegador Playwright Chromium headless
console.log("[2/6] Iniciando Chromium Headless...");
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  baseURL: baseUrl,
});

// Inyectar cookies de sesión
const urlObj = new URL(baseUrl);
await context.addCookies([
  {
    name: "token",
    value: creds.token,
    domain: urlObj.hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  },
  {
    name: "refresh_token",
    value: creds.refresh_token,
    domain: urlObj.hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  },
]);

const page = await context.newPage();

// 3. Monitoreo estricto de Network y Consola
let sseConexionesActivas = 0;
const metricas = {
  webSocketsCount: 0,
  wsTicketCalls: 0,
  sseTotalPeticiones: 0,
  sseConcurrentesMaximas: 0,
  miAlcanceCalls: 0,
  documentNavigations: 0,
  erroresConsola: [],
  erroresPagina: [],
};

// Escuchar apertura de WebSockets
page.on("websocket", (ws) => {
  const wsUrl = ws.url();
  // El WebSocket interno de Vite HMR en modo dev server
  if (wsUrl.includes("4321") && (wsUrl.includes("token=") || wsUrl.includes("vite-hmr"))) {
    return;
  }
  metricas.webSocketsCount += 1;
  console.error(`❌ [NETWORK VIOLATION] Se abrió un WebSocket de aplicación: ${wsUrl}`);
});

// Escuchar solicitudes de red
page.on("request", (req) => {
  const url = req.url();
  const headers = req.headers();

  if (req.isNavigationRequest()) {
    metricas.documentNavigations += 1;
    sseConexionesActivas = 0; // Cada documento parte con 0 conexiones SSE activas
    console.log(`  [DocNav #${metricas.documentNavigations}] Navegación de documento: ${url}`);
  }

  if (url.includes("ws-ticket")) {
    metricas.wsTicketCalls += 1;
    console.error(`❌ [NETWORK VIOLATION] Llamada prohibida a ws-ticket: ${url}`);
  }

  if (url.includes("/api/logistica/eventos/stream") || headers["accept"] === "text/event-stream") {
    metricas.sseTotalPeticiones += 1;
    sseConexionesActivas += 1;
    metricas.sseConcurrentesMaximas = Math.max(metricas.sseConcurrentesMaximas, sseConexionesActivas);
    console.log(`  -> [SSE Petición #${metricas.sseTotalPeticiones}] Conexión abierta (Activas concurrentes: ${sseConexionesActivas})`);
  }

  if (url.includes("/Usuario/mi-alcance")) {
    metricas.miAlcanceCalls += 1;
    console.log(`  -> [mi-alcance Petición #${metricas.miAlcanceCalls}]`);
  }
});

page.on("response", (res) => {
  const url = res.url();
  if (url.includes("/api/logistica/eventos/stream")) {
    console.log(`  -> [SSE Response Status] ${res.status()}`);
  }
});

page.on("requestfailed", (req) => {
  const url = req.url();
  if (url.includes("/api/logistica/eventos/stream")) {
    sseConexionesActivas = Math.max(0, sseConexionesActivas - 1);
    console.log(`  -> [SSE Request Closed/Aborted] Activas restantes: ${sseConexionesActivas}`);
  }
});

page.on("requestfinished", (req) => {
  const url = req.url();
  if (url.includes("/api/logistica/eventos/stream")) {
    sseConexionesActivas = Math.max(0, sseConexionesActivas - 1);
    console.log(`  -> [SSE Request Finished] Activas restantes: ${sseConexionesActivas}`);
  }
});

// Escuchar errores de página (JS unhandled exceptions)
page.on("pageerror", (err) => {
  metricas.erroresPagina.push(err.message || String(err));
  console.error(`❌ [PAGE ERROR]:`, err);
});

// Escuchar console.error en el navegador
page.on("console", (msg) => {
  if (msg.type() === "error") {
    const text = msg.text();
    // Ignorar tooling interno no bloqueante de Vite en modo dev (HMR / Optimize Dep)
    if (
      !text.includes("prefers-reduced-motion") &&
      !text.includes("favicon") &&
      !text.includes("Outdated Optimize Dep")
    ) {
      metricas.erroresConsola.push(text);
      console.error(`❌ [CONSOLE ERROR]: ${text}`);
    }
  }
});

// 4. Recorrido formal de navegación
console.log("[3/6] Iniciando navegación por pantallas del supervisor...");

// Carga inicial de documento: /inicio?sucursal=2 (redirige a /supervisor/inicio)
console.log(`  -> 1. Carga inicial de documento: /inicio?sucursal=2...`);
const respInicial = await page.goto("/inicio?sucursal=2", { waitUntil: "domcontentloaded", timeout: 25000 });
console.log(`     HTTP status inicial: ${respInicial?.status()}`);
await page.waitForTimeout(2000);

// Helper para navegar entre páginas esperando que el nuevo documento cargue
async function navegarAPagina(nombre, rutaDestino) {
  console.log(`  -> Navegando a: ${nombre} (${rutaDestino})...`);
  try {
    await page.goto(rutaDestino, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.error(`❌ Error al navegar a ${nombre}:`, err.message);
    metricas.erroresPagina.push(`Error al navegar a ${nombre}: ${err.message}`);
  }
}

// 2. Rutas - Vista vivo
await navegarAPagina("Rutas - Vista Rastreo en Vivo", "/supervisor/rutas?sucursal=2&vista=vivo");

// 3. Dentro de Rutas: alternar vista a Planificación mediante botón de pestaña interna (SPA sin recarga)
console.log("  -> Alternando pestaña interna a: Planificación...");
const btnPlan = page.locator('button:has-text("Planificación")').first();
if (await btnPlan.isVisible()) {
  await btnPlan.click();
  await page.waitForTimeout(1500);
  console.log("     Pestaña Planificación activada con éxito.");
}
console.log("  -> Alternando pestaña interna de regreso a: En vivo...");
const btnVivo = page.locator('button:has-text("En vivo")').first();
if (await btnVivo.isVisible()) {
  await btnVivo.click();
  await page.waitForTimeout(1500);
  console.log("     Pestaña En vivo activada con éxito.");
}

// 4. Despachos y Asignaciones
await navegarAPagina("Despachos y Asignaciones", "/supervisor/asignaciones?sucursal=2");

// 5. Clientes
await navegarAPagina("Clientes de Sucursal", "/supervisor/clientes?sucursal=2");

// 6. Rutas de Distribución
await navegarAPagina("Rutas de Distribución", "/supervisor/rutas?sucursal=2");

await page.waitForTimeout(1500);

// 5. Verificación y Cierre
await browser.close();

console.log("\n======================================================================");
console.log("  RESUMEN DE MÉTRICAS NETWORK Y ESTABILIDAD PLAYWRIGHT");
console.log("======================================================================");
console.log(`- WebSockets abiertos:              ${metricas.webSocketsCount} (Esperado: 0)`);
console.log(`- Llamadas a ws-ticket:             ${metricas.wsTicketCalls} (Esperado: 0)`);
console.log(`- Peticiones SSE totales:           ${metricas.sseTotalPeticiones}`);
console.log(`- SSE Concurrentes máximas:         ${metricas.sseConcurrentesMaximas} (Esperado: <= 1)`);
console.log(`- Navegaciones de documento HTTP:   ${metricas.documentNavigations}`);
console.log(`- Llamadas a /Usuario/mi-alcance:   ${metricas.miAlcanceCalls} (Esperado <= ${metricas.documentNavigations})`);
console.log(`- Errores de JavaScript (pageerror): ${metricas.erroresPagina.length}`);
console.log(`- Errores de consola (console.error): ${metricas.erroresConsola.length}`);

let fallos = 0;

if (metricas.webSocketsCount > 0) {
  console.error("❌ FALLO: Se detectaron conexiones WebSocket activas.");
  fallos++;
}
if (metricas.wsTicketCalls > 0) {
  console.error("❌ FALLO: Se detectaron llamadas a ws-ticket.");
  fallos++;
}
if (metricas.erroresPagina.length > 0) {
  console.error(`❌ FALLO: Ocurrieron ${metricas.erroresPagina.length} pageerror en el navegador.`);
  fallos++;
}
if (metricas.erroresConsola.length > 0) {
  console.error(`❌ FALLO: Ocurrieron ${metricas.erroresConsola.length} console.error en el navegador.`);
  fallos++;
}
if (metricas.sseTotalPeticiones === 0) {
  console.error("❌ FALLO: No se detectó ninguna conexión SSE.");
  fallos++;
}
if (metricas.sseConcurrentesMaximas > 1) {
  console.error(`❌ FALLO: Se detectaron ${metricas.sseConcurrentesMaximas} conexiones SSE concurrentes (esperado: máximo 1).`);
  fallos++;
}
if (metricas.miAlcanceCalls > metricas.documentNavigations) {
  console.error(`❌ FALLO: Se llamó a /Usuario/mi-alcance ${metricas.miAlcanceCalls} veces (esperado <= ${metricas.documentNavigations} navegaciones).`);
  fallos++;
}

if (fallos > 0) {
  console.error(`\n❌ [PLAYWRIGHT NO APROBADO] Se encontraron ${fallos} incumplimientos de requisitos.`);
  process.exit(1);
} else {
  console.log(`\n✅ [PLAYWRIGHT APROBADO] 0 WebSockets, 0 ws-ticket, 0 pageerrors y 0 console.errors en todo el flujo.`);
  process.exit(0);
}
