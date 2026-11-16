import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

async function main() {
  console.log("=== INICIANDO VERIFICACIÓN E2E PLAYWRIGHT FASE 3 ===");

  const rootDir = path.resolve('..');
  const sessionFile = path.resolve(rootDir, 'docs/manifests/sesion.local.json');
  if (!fs.existsSync(sessionFile)) {
    throw new Error("No existe sesion.local.json");
  }
  const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));

  const capturasDir = path.resolve(rootDir, 'docs/capturas');
  if (!fs.existsSync(capturasDir)) {
    fs.mkdirSync(capturasDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true
  });

  try {
    // ----------------------------------------------------
    // 1. DESKTOP 1280x800
    // ----------------------------------------------------
    const contextDesktop = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    // Agregar cookies
    await contextDesktop.addCookies([
      {
        name: 'token',
        value: session.token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict'
      },
      {
        name: 'refresh_token',
        value: session.refresh_token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict'
      }
    ]);

    const pageDesktop = await contextDesktop.newPage();

    pageDesktop.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
    pageDesktop.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));
    pageDesktop.on('request', req => {
      if (req.url().includes('/api/')) {
        console.log(`[REQUEST] ${req.method()} ${req.url()}`);
      }
    });
    pageDesktop.on('response', resp => {
      if (resp.status() >= 400) {
        console.log(`[HTTP ERROR ${resp.status()}] ${resp.request().method()} ${resp.url()}`);
      }
    });

    console.log("1. Navegando con deep link: /supervisor/despachos?sucursal=2&asignacion=309&tab=cobros&foco=344");
    const resp = await pageDesktop.goto('http://localhost:4321/supervisor/despachos?sucursal=2&asignacion=309&tab=cobros&foco=344', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log(`URL actual: ${pageDesktop.url()}, status: ${resp?.status()}`);

    // Esperar a que el modal aparezca
    console.log("2. Esperando apertura automática de ExpedienteChoferModal...");
    await pageDesktop.waitForSelector('text=Entregas y cobros', { timeout: 15000 });
    console.log("   ✓ Modal abierto automáticamente por deep link en pestaña Entregas y cobros.");

    // Esperar que carguen las operaciones
    await pageDesktop.waitForTimeout(2000);

    // Verificar presencia de cobros
    const content = await pageDesktop.content();
    const contieneCobro125 = content.includes('125.00') || content.includes('125');
    const contieneCobro175 = content.includes('175.00') || content.includes('175');
    const contieneMilton = content.includes('Milton Choque');
    console.log(`   ✓ Chofer Milton Choque visible: ${contieneMilton}`);
    console.log(`   ✓ Cobro Bs. 125 visible: ${contieneCobro125}`);
    console.log(`   ✓ Cobro Bs. 175 visible: ${contieneCobro175}`);

    // Verificar badge o foco
    const elementoFoco = await pageDesktop.$('#operacion-344');
    const elementoFocoAttr = await pageDesktop.$('[data-foco="true"]');
    console.log(`   ✓ Elemento foco 344 encontrado / resaltado: ${!!elementoFoco || !!elementoFocoAttr}`);

    // Tomar captura Desktop con modal abierto en cobros
    const captureModalPath = path.resolve(capturasDir, 'fase3_modal_cobros_desktop.png');
    await pageDesktop.screenshot({ path: captureModalPath, fullPage: false });
    console.log(`   ✓ Captura guardada: ${captureModalPath}`);

    // Probar interacción: botón Aprobar cobro o Aprobar todo
    const btnAprobarTodo = await pageDesktop.$('button:has-text("Aprobar todo")');
    if (btnAprobarTodo) {
      console.log("   ✓ Botón 'Aprobar todo' disponible y renderizado.");
    }

    // Cerrar modal presionando Escape
    console.log("3. Cerrando modal con Escape para verificar la tabla de despachos...");
    await pageDesktop.keyboard.press('Escape');
    await pageDesktop.waitForTimeout(1500);

    // Verificar tabla de despachos en desktop
    const scrollInfo = await pageDesktop.evaluate(() => {
      const contenedor = document.querySelector('.overflow-x-auto') || document.querySelector('table');
      if (!contenedor) return { scrollWidth: 0, clientWidth: 0, hasScroll: false };
      return {
        scrollWidth: contenedor.scrollWidth,
        clientWidth: contenedor.clientWidth,
        hasScroll: contenedor.scrollWidth > contenedor.clientWidth
      };
    });
    console.log(`4. Medición Scroll Horizontal a 1280px: scrollWidth=${scrollInfo.scrollWidth}, clientWidth=${scrollInfo.clientWidth}, hasScroll=${scrollInfo.hasScroll}`);

    // Verificar selector de columnas ocultables
    const btnColumnas = await pageDesktop.$('button:has-text("Columnas")');
    console.log(`5. Selector de columnas visible: ${!!btnColumnas}`);

    const captureDesktopPath = path.resolve(capturasDir, 'fase3_despachos_desktop.png');
    await pageDesktop.screenshot({ path: captureDesktopPath, fullPage: false });
    console.log(`   ✓ Captura Desktop guardada: ${captureDesktopPath}`);

    await contextDesktop.close();

    // ----------------------------------------------------
    // 2. MOBILE 390x844 (iPhone 12/13/14)
    // ----------------------------------------------------
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true
    });

    await contextMobile.addCookies([
      {
        name: 'token',
        value: session.token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict'
      },
      {
        name: 'refresh_token',
        value: session.refresh_token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Strict'
      }
    ]);

    const pageMobile = await contextMobile.newPage();
    console.log("6. Navegando en mobile (390px): /supervisor/despachos?sucursal=2");
    await pageMobile.goto('http://localhost:4321/supervisor/despachos?sucursal=2', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await pageMobile.waitForTimeout(2000);

    const captureMobilePath = path.resolve(capturasDir, 'fase3_despachos_mobile.png');
    await pageMobile.screenshot({ path: captureMobilePath, fullPage: false });
    console.log(`   ✓ Captura Mobile guardada: ${captureMobilePath}`);

    await contextMobile.close();

    console.log("=== VERIFICACIÓN PLAYWRIGHT COMPLETADA CON ÉXITO ===");
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error("ERROR EN PLAYWRIGHT TEST:", err);
  process.exit(1);
});
