// Blanquita-Mobile/tests/test_componentes_react_test_renderer.test.js
// Pruebas de Renderizado de Componentes usando react-test-renderer (Punto 7 - Fase 1.3)

global.__DEV__ = true;

const Module = require("module");
const originalLoad = Module._load;
const React = require("react");

// Mock canónico de primitivas de React Native para pruebas en Node con react-test-renderer
const mockComponent = (name) => {
  const comp = (props) => React.createElement(name, props, props.children);
  comp.displayName = name;
  return comp;
};

const reactNativeMock = {
  View: mockComponent("View"),
  Text: mockComponent("Text"),
  TextInput: mockComponent("TextInput"),
  TouchableOpacity: mockComponent("TouchableOpacity"),
  ActivityIndicator: mockComponent("ActivityIndicator"),
  Modal: mockComponent("Modal"),
  ScrollView: mockComponent("ScrollView"),
  StyleSheet: {
    create: (styles) => styles,
    flatten: (styles) => (Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean)) : styles || {}),
  },
  Platform: {
    OS: "android",
    select: (obj) => obj.android || obj.default,
  },
};

// Mock de lucide-react-native
const lucideMock = new Proxy({}, {
  get: (_target, prop) => mockComponent(`LucideIcon_${String(prop)}`),
});

Module._load = function (request, parent, isMain) {
  if (request === "react-native") {
    return reactNativeMock;
  }
  if (request === "lucide-react-native") {
    return lucideMock;
  }
  return originalLoad.apply(this, arguments);
};

// Registrar Babel para JSX
require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const assert = require("assert");
const renderer = require("react-test-renderer");

// Importar componentes de la app móvil
const { NumericInput } = require("../src/components/common/NumericInput");
const { PaymentSelector } = require("../src/components/common/PaymentSelector");
const { SyncStatusBadge } = require("../src/components/common/SyncStatusBadge");
const { FrescuraIndicador } = require("../src/components/common/FrescuraIndicador");

console.log("=== INICIANDO PRUEBAS DE COMPONENTES CON REACT-TEST-RENDERER ===");

// 1. PRUEBA: NumericInput
{
  console.log("1. Probando NumericInput...");
  let textoIngresado = "";
  const tree = renderer.create(
    React.createElement(NumericInput, {
      label: "Monto a Cobrar",
      value: "150.50",
      moneda: "Bs",
      error: "Monto inválido",
      onChangeText: (t) => { textoIngresado = t; },
    })
  );

  const json = tree.toJSON();
  assert.ok(json, "El componente NumericInput debe renderizar un árbol JSON");

  // Buscar texto del label
  const labelNode = tree.root.findAll((el) => el.type === "Text" && el.props.children === "Monto a Cobrar");
  assert.strictEqual(labelNode.length, 1, "Debe renderizar la etiqueta 'Monto a Cobrar'");

  // Buscar prefijo moneda
  const monedaNode = tree.root.findAll((el) => el.type === "Text" && el.props.children === "Bs");
  assert.strictEqual(monedaNode.length, 1, "Debe renderizar la moneda 'Bs'");

  // Buscar mensaje de error
  const errorNode = tree.root.findAll((el) => el.type === "Text" && el.props.children === "Monto inválido");
  assert.strictEqual(errorNode.length, 1, "Debe renderizar el mensaje de error");

  // Simular onChangeText
  const inputNode = tree.root.findByType("TextInput");
  assert.strictEqual(inputNode.props.value, "150.50");
  inputNode.props.onChangeText("200.00");
  assert.strictEqual(textoIngresado, "200.00", "onChangeText debe invocar el callback con el valor");
  console.log("   ✓ NumericInput probado con éxito (render, props, error, input).");
}

// 2. PRUEBA: PaymentSelector
{
  console.log("2. Probando PaymentSelector...");
  let metodoElegido = "";
  const tree = renderer.create(
    React.createElement(PaymentSelector, {
      metodoSeleccionado: "QR",
      onSeleccionarMetodo: (m) => { metodoElegido = m; },
    })
  );

  // Verificar métodos renderizados
  const textoEfectivo = tree.root.findAll((el) => el.type === "Text" && el.props.children === "Efectivo");
  const textoQR = tree.root.findAll((el) => el.type === "Text" && el.props.children === "QR Bancario");
  assert.strictEqual(textoEfectivo.length, 1, "Debe contener opción 'Efectivo'");
  assert.strictEqual(textoQR.length, 1, "Debe contener opción 'QR Bancario'");

  // Verificar badge obligatorio para QR
  const badgeQR = tree.root.findAll((el) => el.type === "Text" && el.props.children === "Foto Obligatoria");
  assert.strictEqual(badgeQR.length, 1, "Debe mostrar badge 'Foto Obligatoria' para QR");

  // Disparar selección de método
  const touchables = tree.root.findAllByType("TouchableOpacity");
  assert.strictEqual(touchables.length, 4, "Debe contener 4 botones de métodos de pago");
  touchables[0].props.onPress();
  assert.strictEqual(metodoElegido, "EFECTIVO", "Debe llamar onSeleccionarMetodo con EFECTIVO");
  console.log("   ✓ PaymentSelector probado con éxito (4 métodos, badge QR, interacción).");
}

// 3. PRUEBA: SyncStatusBadge
{
  console.log("3. Probando SyncStatusBadge...");
  // 3a. Sincronizado
  const treeSync = renderer.create(
    React.createElement(SyncStatusBadge, { estado: "sincronizado" })
  );
  const nodeSync = treeSync.root.findAll((el) => el.type === "Text" && el.props.children === "SINCRONIZADO");
  assert.strictEqual(nodeSync.length, 1, "Debe mostrar 'SINCRONIZADO'");

  // 3b. Pendientes
  const treePend = renderer.create(
    React.createElement(SyncStatusBadge, { estado: "pendiente", pendientesCount: 5 })
  );
  const nodePend = treePend.root.findAll((el) => el.type === "Text" && el.props.children === "5 PENDIENTES");
  assert.strictEqual(nodePend.length, 1, "Debe mostrar '5 PENDIENTES'");

  // 3c. Sincronizando
  const treeSpin = renderer.create(
    React.createElement(SyncStatusBadge, { estado: "sincronizando" })
  );
  const nodeSpin = treeSpin.root.findByType("ActivityIndicator");
  assert.ok(nodeSpin, "Debe mostrar spinner ActivityIndicator durante sincronizando");

  // 3d. Error
  const treeErr = renderer.create(
    React.createElement(SyncStatusBadge, { estado: "error" })
  );
  const nodeErr = treeErr.root.findAll((el) => el.type === "Text" && el.props.children === "ERROR SYNC");
  assert.strictEqual(nodeErr.length, 1, "Debe mostrar 'ERROR SYNC'");
  console.log("   ✓ SyncStatusBadge probado con éxito en los 4 estados.");
}

// 4. PRUEBA: FrescuraIndicador
{
  console.log("4. Probando FrescuraIndicador...");
  let actualizarInvocado = false;
  // Simular fecha de hace 3 horas (desactualizado > 2 horas)
  const fechaAntigua = new Date(Date.now() - 3 * 3600 * 1000).toISOString();

  let tree;
  renderer.act(() => {
    tree = renderer.create(
      React.createElement(FrescuraIndicador, {
        ultimaSincronizacion: fechaAntigua,
        onActualizar: () => { actualizarInvocado = true; },
        cargando: false,
      })
    );
  });

  // Debe renderizar aviso desactualizado
  const btnRecargar = tree.root.findByType("TouchableOpacity");
  assert.ok(btnRecargar, "Debe mostrar botón para actualizar datos cuando está desactualizado");
  renderer.act(() => {
    btnRecargar.props.onPress();
  });
  assert.strictEqual(actualizarInvocado, true, "onActualizar debe dispararse al presionar aviso");
  // Desmontar para limpiar setInterval(30000)
  renderer.act(() => {
    tree.unmount();
  });
  console.log("   ✓ FrescuraIndicador probado con éxito (alerta de desactualizado y botón de recarga).");
}

console.log("\n=======================================================");
console.log("ÉXITO: Todos los componentes de UI renderizados y verificados con react-test-renderer.");
console.log("=======================================================\n");
process.exit(0);
