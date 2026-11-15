/**
 * Test de Contrato Canónico de Cálculo de Entrega (Mobile vs Backend)
 * Verifica:
 * 1. Caso real Potosí: 375.00 vs 348.30 (Económico 6 -> 5 bultos)
 * 2. Validación de coherencia de cobro ante excedente no justificado
 * 3. Aceptación de cobro con excedente declarado (saldo a favor)
 * 4. Redondeo bancario a 2 decimales
 */

const assert = require("assert");
const {
  calcularTotalEntrega,
  redondearDosDecimales,
  validarCoherenciaCobro,
} = require("../src/utils/calculoEntrega");

console.log("===============================================================");
console.log(" TEST: CONTRATO CANÓNICO CÁLCULO DE ENTREGA (MOBILE)");
console.log("===============================================================");

// 1. Caso real Potosí
console.log("1. Verificando cálculo de caso real Potosí (Sucursal 2)...");
const items = [
  { presentacion_id: 10, cantidad: 5, precio_unitario: 37.8, es_bandeo: false },
  { presentacion_id: 11, cantidad: 5, precio_unitario: 27.0, es_bandeo: false },
  { presentacion_id: 13, cantidad: 5, precio_unitario: 4.86, es_bandeo: false },
];

const resultado = calcularTotalEntrega(items);
assert.strictEqual(resultado.total, 348.3, `Total esperado 348.30, obtenido: ${resultado.total}`);
assert.strictEqual(resultado.items[0].subtotal, 189.0, "Subtotal Mega Rollo esperado 189.00");
assert.strictEqual(resultado.items[1].subtotal, 135.0, "Subtotal Económico esperado 135.00");
assert.strictEqual(resultado.items[2].subtotal, 24.3, "Subtotal Merma esperado 24.30");
console.log("   -> OK: Subtotales y total calculados con precisión exacta (Bs. 348.30).");

// 2. Validación de coherencia cobro sin excedente justificado
console.log("2. Verificando rechazo preventivo de cobro de Bs. 375.00 sobre entrega de Bs. 348.30...");
const valInvalida = validarCoherenciaCobro(348.3, 375.0, "COMPLETO");
assert.strictEqual(valInvalida.esValido, false, "Debe ser inválido porque 375.00 > 348.30");
assert.strictEqual(valInvalida.diferencia, 26.7, `Diferencia esperada 26.70, obtenida: ${valInvalida.diferencia}`);
assert.strictEqual(valInvalida.codigo, "COBRO_EXCEDE_ENTREGADO", "Código de error debe ser COBRO_EXCEDE_ENTREGADO");
console.log("   -> OK: Rechazo preventivo detectado con diferencia exacta de Bs. 26.70.");

// 3. Aceptación de cobro con excedente declarado como saldo a favor
console.log("3. Verificando aceptación con excedente / saldo a favor...");
const valValida = validarCoherenciaCobro(348.3, 375.0, "COMPLETO", 26.7);
assert.strictEqual(valValida.esValido, true, "Debe ser válido con excedente declarado");
console.log("   -> OK: Excedente aceptado con justificación.");

// 4. Redondeo bancario a 2 decimales
console.log("4. Verificando redondeo financiero...");
assert.strictEqual(redondearDosDecimales(348.30000000000007), 348.3);
assert.strictEqual(redondearDosDecimales(26.69999999999999), 26.7);
assert.strictEqual(redondearDosDecimales(0.005), 0.01);
console.log("   -> OK: Redondeos financieros verificados.");

console.log("TODAS LAS PRUEBAS DE CONTRATO DE CÁLCULO PASARON CON ÉXITO.");
