// Blanquita-Mobile/tests/calcular_contraste.js
// Cálculo formal y canónico de luminancia relativa y ratio de contraste según WCAG 2.1

function sRGBtoLin(colorChannel) {
  const c = colorChannel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map(c => c + c).join("");
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function calcularLuminancia(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rLin = sRGBtoLin(r);
  const gLin = sRGBtoLin(g);
  const bLin = sRGBtoLin(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function calcularRatioContraste(hex1, hex2) {
  const l1 = calcularLuminancia(hex1);
  const l2 = calcularLuminancia(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const coloresTexto = [
  { nombre: "textPrimary", hex: "#0F172A", rol: "Texto principal / Montos" },
  { nombre: "textSecondary", hex: "#334155", rol: "Texto secundario" },
  { nombre: "textMuted", hex: "#475569", rol: "Metadatos y badges offline" },
  { nombre: "primaryText", hex: "#0E6E92", rol: "Enlaces y botones con texto" },
  { nombre: "primaryDark", hex: "#157A9E", rol: "Botones interactivos" },
  { nombre: "success", hex: "#15803D", rol: "Texto estado cobrado / online" },
  { nombre: "warning", hex: "#B45309", rol: "Texto estado pendiente / advertencia" },
  { nombre: "danger", hex: "#B91C1C", rol: "Texto error / no-venta" },
  { nombre: "borderStrong", hex: "#64748B", rol: "Bordes de inputs y divisores activos" },
  { nombre: "primary (Gráfico)", hex: "#1C96C5", rol: "Superficies gráficas y acentos (no texto)" }
];

const fondos = [
  { nombre: "surface (Blanco)", hex: "#FFFFFF" },
  { nombre: "background (Slate 50)", hex: "#F8FAFC" }
];

console.log("=== REPORTE FORMAL DE CONTRASTE WCAG 2.1 ===");
console.log(String("Token").padEnd(20) + String("Hex").padEnd(10) + String("Sobre #FFFFFF").padEnd(16) + String("Sobre #F8FAFC").padEnd(16) + "WCAG Cumplimiento");
console.log("-".repeat(78));

let fallasTexto = 0;

for (const t of coloresTexto) {
  const ratioBlanco = calcularRatioContraste(t.hex, "#FFFFFF");
  const ratioFondo = calcularRatioContraste(t.hex, "#F8FAFC");
  
  let nivel = "FAIL";
  if (t.nombre.includes("Gráfico")) {
    nivel = ratioBlanco >= 3.0 ? "WCAG AA (UI/Gráfico >= 3:1)" : "FAIL";
  } else if (t.nombre === "textPrimary") {
    nivel = ratioBlanco >= 7.0 ? "WCAG AAA (>= 7:1)" : "FAIL";
  } else {
    nivel = ratioBlanco >= 4.5 ? "WCAG AA (>= 4.5:1)" : "FAIL";
  }

  if (nivel === "FAIL") {
    fallasTexto++;
  }

  console.log(
    t.nombre.padEnd(20) +
    t.hex.padEnd(10) +
    (ratioBlanco.toFixed(2) + ":1").padEnd(16) +
    (ratioFondo.toFixed(2) + ":1").padEnd(16) +
    nivel
  );
}

console.log("-".repeat(78));
if (fallasTexto > 0) {
  console.error(`ERROR: ${fallasTexto} tokens de texto no cumplen el estandar WCAG AA!`);
  process.exit(1);
} else {
  console.log("ÉXITO: Todos los tokens de texto cumplen WCAG AA (>= 4.5:1) y montos/principal cumplen AAA (>= 7:1).");
}

module.exports = {
  calcularLuminancia,
  calcularRatioContraste
};
