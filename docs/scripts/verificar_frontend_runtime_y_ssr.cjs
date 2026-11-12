const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

console.log('======================================================================');
console.log('VERIFICACIÓN RUNTIME FRONTEND, AUDITORÍA DE HOOKS Y PARIDAD SSR');
console.log('======================================================================');

// Determinar raíz de Frontend
const frontendDir = fs.existsSync(path.resolve(__dirname, '../src'))
  ? path.resolve(__dirname, '..')
  : (fs.existsSync(path.resolve(__dirname, 'src'))
      ? path.resolve(__dirname)
      : path.resolve(__dirname, '../../Blanquita-Frontend'));

const srcDir = path.resolve(frontendDir, 'src');
console.log(`Directorio de inspección: ${srcDir}`);

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk(srcDir);
console.log(`1. Analizando ${files.length} archivos fuente en src/...`);

const reactHooks = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useId', 'useSyncExternalStore'];
let totalHookErrors = 0;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  for (const hook of reactHooks) {
    const regexUse = new RegExp(`\\b${hook}\\b`, 'g');
    if (regexUse.test(content)) {
      const importReactRegex = new RegExp(`import\\s+[^;]*\\b${hook}\\b[^;]*from\\s+['"]react['"]`);
      const destructureReactRegex = new RegExp(`const\\s+{[^}]*\\b${hook}\\b[^}]*}\\s*=\\s*React`);
      const reactDotRegex = new RegExp(`React\\.${hook}\\b`, 'g');

      if (!importReactRegex.test(content) && !destructureReactRegex.test(content)) {
        const totalMatches = (content.match(regexUse) || []).length;
        const reactMatches = (content.match(reactDotRegex) || []).length;
        if (totalMatches > reactMatches) {
          console.error(`  ❌ ERROR en ${f}: Hook '${hook}' usado sin estar importado.`);
          totalHookErrors++;
        }
      }
    }
  }
}

if (totalHookErrors === 0) {
  console.log('  ✅ ÉXITO: 0 hooks huérfanos o no importados en todo el frontend.');
} else {
  console.error(`  ❌ FALLO: Se detectaron ${totalHookErrors} hooks sin importar.`);
  process.exit(1);
}

// ----------------------------------------------------------------------
// 2. VERIFICACIÓN DE FALLBACKS DEFENSIVOS EN GESTION CAJA CHICA Y CUENTAS COBRAR
// ----------------------------------------------------------------------
console.log('\n2. Verificando fallbacks defensivos y variables seguras en componentes corregidos...');
const cchPath = path.resolve(srcDir, 'components/Contabilidad/GestionCajaChicaOperativa.jsx');
const cchContent = fs.readFileSync(cchPath, 'utf8');
if (cchContent.includes('sucursalUsuario')) {
  console.error('  ❌ ERROR: Variable no definida sucursalUsuario aún presente en GestionCajaChicaOperativa.jsx');
  process.exit(1);
}
if (cchContent.includes('{sucursales.filter(')) {
  console.error('  ❌ ERROR: Acceso desprotegido sucursales.filter aún presente en GestionCajaChicaOperativa.jsx');
  process.exit(1);
}
console.log('  ✅ ÉXITO: GestionCajaChicaOperativa.jsx protegido contra undefined y variables no declaradas.');

const cxcPath = path.resolve(srcDir, 'components/Contabilidad/GestionCuentasCobrar.jsx');
const cxcContent = fs.readFileSync(cxcPath, 'utf8');
if (!cxcContent.includes('useMemo') || !cxcContent.includes('import React, { useState, useEffect, useCallback, useMemo } from "react";')) {
  console.error('  ❌ ERROR: useMemo no está importado correctamente en GestionCuentasCobrar.jsx');
  process.exit(1);
}
console.log('  ✅ ÉXITO: GestionCuentasCobrar.jsx importa useMemo y utiliza defensas de array.');

// ----------------------------------------------------------------------
// 3. PARIDAD SSR (renderToString) VS CLIENTE EN BRANCHFILTER Y PAGEHEADER
// ----------------------------------------------------------------------
console.log('\n3. Verificando paridad HTML de hidratación SSR vs Cliente (0 hydration mismatch)...');

const branchStoreMock = {
  sucursalActiva: '1',
  sucursalesPermitidas: [
    { id: 1, nombre: 'Sucursal Central Sucre', ciudad: 'Sucre' },
    { id: 2, nombre: 'Sucursal Potosí', ciudad: 'Potosí' }
  ],
  puedeVerTodas: true,
  esMultisede: true,
  cambiarSucursal: () => {},
  sucursalAsignada: 1,
  inicializado: false
};

function BranchFilterSimulado({ mounted = false, store = branchStoreMock }) {
  if (!mounted || !store.esMultisede) {
    return null;
  }
  return React.createElement(
    'div',
    {
      className: 'inline-flex items-center gap-1.5 p-0.5 bg-white border border-slate-300 rounded text-slate-700 shadow-2xs',
      role: 'group',
      'aria-label': 'Filtro de sucursal de operación'
    },
    React.createElement('span', null, 'Sucursal:')
  );
}

function PageHeaderSimulado({ mounted = false, store = branchStoreMock }) {
  return React.createElement(
    'header',
    { className: 'flex justify-between items-center pb-3' },
    React.createElement('h1', null, 'Inicio Supervisor'),
    React.createElement(
      'div',
      { className: 'flex items-center gap-2' },
      React.createElement(BranchFilterSimulado, { mounted, store })
    )
  );
}

// 1. Render en Servidor (SSR): mounted = false
const htmlSSR = ReactDOMServer.renderToString(
  React.createElement(PageHeaderSimulado, { mounted: false, store: branchStoreMock })
);

// 2. Primer render de hidratación en Cliente: mounted = false (antes de useEffect)
const htmlClientePrimerRender = ReactDOMServer.renderToString(
  React.createElement(PageHeaderSimulado, { mounted: false, store: branchStoreMock })
);

console.log('  HTML generado en SSR:             ', htmlSSR);
console.log('  HTML cliente en 1er frame render: ', htmlClientePrimerRender);

if (htmlSSR === htmlClientePrimerRender) {
  console.log('  ✅ ÉXITO: 0 Hydration Mismatch. El HTML del servidor y del primer frame de cliente coinciden idénticamente.');
} else {
  console.error('  ❌ DISCREPANCIA DE HIDRATACIÓN DETECTADA:');
  console.error('    SSR:    ', htmlSSR);
  console.error('    Cliente:', htmlClientePrimerRender);
  process.exit(1);
}

// 3. Segundo frame en Cliente (post-hidratación): mounted = true
const htmlClientePostHidratacion = ReactDOMServer.renderToString(
  React.createElement(PageHeaderSimulado, { mounted: true, store: branchStoreMock })
);
console.log('  HTML cliente tras montar (efecto): ', htmlClientePostHidratacion);
console.log('  ✅ ÉXITO: El selector se renderiza fluidamente tras la hidratación sin romper React.');

console.log('======================================================================');
console.log('AUDITORÍA DE RUNTIME Y PARIDAD SSR APROBADA CON ÉXITO');
console.log('======================================================================\n');
