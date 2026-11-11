/**
 * Prueba de Validación del Design System y Contraste WCAG AA (Fase 1.1 - Punto C10)
 * Sistema ERP Papelera Blanquita - Móvil
 */

const assert = require("assert");
const { Colors } = require("../src/constants/Colors");

console.log("=================================================");
console.log(" TEST: DESIGN SYSTEM Y CONTRASTE WCAG AA (C10)   ");
console.log("=================================================");

function getLuminance(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// 1. Validar contraste de colores de texto sobre superficie blanca (#FFFFFF)
console.log("1. Validando ratios de contraste contra fondo blanco (#FFFFFF)...");

const coloresTexto = [
  { nombre: "primaryText", hex: Colors.primaryText, min: 4.5 },
  { nombre: "primaryDark", hex: Colors.primaryDark, min: 4.5 },
  { nombre: "secondary", hex: Colors.secondary, min: 4.5 },
  { nombre: "accent", hex: Colors.accent, min: 4.5 },
  { nombre: "success", hex: Colors.success, min: 4.5 },
  { nombre: "warning", hex: Colors.warning, min: 4.5 },
  { nombre: "danger", hex: Colors.danger, min: 4.5 },
  { nombre: "info", hex: Colors.info, min: 4.5 },
  { nombre: "text", hex: Colors.text, min: 4.5 },
  { nombre: "textSecondary", hex: Colors.textSecondary, min: 4.5 },
  { nombre: "textMuted", hex: Colors.textMuted, min: 4.5 },
  { nombre: "estadoEnCamino", hex: Colors.estadoEnCamino, min: 4.5 },
  { nombre: "borderStrong", hex: Colors.borderStrong, min: 3.0 },
];

for (const c of coloresTexto) {
  const ratio = getContrastRatio(c.hex, "#FFFFFF");
  assert(
    ratio >= c.min,
    `Color ${c.nombre} (${c.hex}) tiene ratio ${ratio.toFixed(2)}:1, menor al mínimo requerido de ${c.min}:1`
  );
  console.log(`   -> [PASS] ${c.nombre} (${c.hex}): ${ratio.toFixed(2)}:1 >= ${c.min}:1`);
}

// 2. Validar que primary (#1C96C5) no se use como texto sin advertencia y cumpla al menos 3:1 para UI
const ratioPrimary = getContrastRatio(Colors.primary, "#FFFFFF");
assert(ratioPrimary >= 3.0, "primary (#1C96C5) debe cumplir al menos 3:1 para componentes de UI grandes");
console.log(`   -> [PASS] primary (${Colors.primary}): ${ratioPrimary.toFixed(2)}:1 >= 3.0:1 (Bordes y acentos gráficos)`);

console.log("✅ DESIGN SYSTEM Y WCAG AA: Todos los colores superan la norma estricta.");
