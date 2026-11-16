/**
 * ejecutar_playwright_completo.mjs
 * Orquestador automatizado para ejecutar las pruebas e2e de Playwright
 * contra `npm run dev` Y contra `npm run preview`.
 */

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../..");

async function esperarServidor(url, timeoutMs = 45000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(url, (res) => {
          resolve(res.statusCode < 500);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(1500, () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function terminarProceso(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", proc.pid.toString(), "/f", "/t"]);
    } else {
      proc.kill("SIGTERM");
    }
  } catch {}
}

async function ejecutarPruebaContra(modo, comando, args) {
  console.log(`\n======================================================================`);
  console.log(`  EJECUTANDO PLAYWRIGHT CONTRA: npm run ${modo} (http://localhost:4321)`);
  console.log(`======================================================================`);

  console.log(`-> Iniciando servidor frontend (${modo})...`);
  const serverProc = spawn(comando, args, {
    cwd: frontendDir,
    shell: true,
    stdio: "pipe",
    env: { ...process.env, PORT: "4321" },
  });

  serverProc.stdout.on("data", (d) => {
    // console.log(`[${modo}] ${d}`);
  });
  serverProc.stderr.on("data", (d) => {
    // console.error(`[${modo} err] ${d}`);
  });

  const listo = await esperarServidor("http://localhost:4321", 50000);
  if (!listo) {
    console.error(`❌ El servidor frontend (${modo}) no respondió en http://localhost:4321 a tiempo.`);
    terminarProceso(serverProc);
    return false;
  }
  console.log(`  -> Servidor ${modo} activo y respondiendo.`);

  console.log(`-> Ejecutando verificación e2e Playwright...`);
  const e2eScript = path.resolve(__dirname, "verificar_navegacion_playwright.mjs");

  const testProc = spawn(process.execPath, [e2eScript], {
    cwd: frontendDir,
    stdio: "inherit",
    env: { ...process.env, BASE_URL: "http://localhost:4321" },
  });

  const exitCode = await new Promise((resolve) => {
    testProc.on("close", resolve);
  });

  terminarProceso(serverProc);
  await new Promise((r) => setTimeout(r, 2000));

  if (exitCode === 0) {
    console.log(`✅ [PLAYWRIGHT ${modo.toUpperCase()} EXITOSO] 0 errores, 0 WebSockets.`);
    return true;
  } else {
    console.error(`❌ [PLAYWRIGHT ${modo.toUpperCase()} FALLIDO] Código de salida: ${exitCode}`);
    return false;
  }
}

async function main() {
  const okDev = await ejecutarPruebaContra("dev", "npm", ["run", "dev", "--", "--port", "4321"]);
  if (!okDev) {
    console.error("❌ Falló la prueba contra npm run dev.");
    process.exit(1);
  }

  const okPreview = await ejecutarPruebaContra("preview", "npm", ["run", "preview", "--", "--port", "4321"]);
  if (!okPreview) {
    console.error("❌ Falló la prueba contra npm run preview.");
    process.exit(1);
  }

  console.log(`\n🎉 [PLAYWRIGHT COMPLETO APROBADO] Todas las pruebas pasaron en DEV y en PREVIEW.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Excepción en orquestador Playwright:", e);
  process.exit(1);
});
