// Blanquita-Mobile/tests/test_token_refresh_persistencia.test.js
// Tests de verificación para:
// 1. Persistencia inmediata del nuevo access_token tras refresh token (en memoria y defaults de axios).
// 2. Comprobación de que una petición hecha tras el refresh (ej. 5 segundos después) use el nuevo token y NO el viejo.
// 3. Normalizador de payload ENTREGA_CON_COBRO (tipos numéricos, presentacion_id, credito null si saldo <= 0).
// 4. Extracción transparente de mensajes de error de servidor (Pydantic / mensaje / detail).

const assert = require("assert");

global.__DEV__ = true;

// Mocks en memoria de almacenamiento
const storageMap = new Map();
const mockAsyncStorage = {
  getItem: async (key) => storageMap.get(key) || null,
  setItem: async (key, val) => {
    storageMap.set(key, String(val));
    return true;
  },
  removeItem: async (key) => {
    storageMap.delete(key);
    return true;
  },
  multiRemove: async (keys) => {
    keys.forEach((k) => storageMap.delete(k));
    return true;
  },
};

const secureMap = new Map();
const mockSecureStore = {
  getItemAsync: async (key) => secureMap.get(key) || null,
  setItemAsync: async (key, val) => {
    secureMap.set(key, String(val));
    return true;
  },
  deleteItemAsync: async (key) => {
    secureMap.delete(key);
    return true;
  },
};

const Module = require("module");
const originalLoad = Module._load;

Module._load = function (request) {
  if (request === "@react-native-async-storage/async-storage") return mockAsyncStorage;
  if (request === "expo-secure-store") return mockSecureStore;
  if (request === "react-native") {
    return {
      Platform: { OS: "android" },
      StyleSheet: { create: (s) => s },
      AppState: { addEventListener: () => ({ remove: () => {} }) },
    };
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const apiClientModule = require("../src/api/client");
const apiClient = apiClientModule.default;
const {
  setTokenEnMemoria,
  getTokenEnMemoria,
  parsearDetalleErrorServidor,
} = apiClientModule;
const {
  normalizarPayloadEntregaCompuesta,
  sanitizarPayloadParaLog,
} = require("../src/services/syncService");
const { SecureStorage } = require("../src/services/secureStorage");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== INICIANDO TESTS DE PERSISTENCIA DE TOKEN Y NORMALIZACIÓN DE PAYLOAD ===");

  // -------------------------------------------------------------
  // Test 1: setTokenEnMemoria actualiza memoria y defaults de axios
  // -------------------------------------------------------------
  console.log("\n>>> Test 1: setTokenEnMemoria actualiza token en memoria y cabecera Authorization por defecto");
  setTokenEnMemoria("token_inicial_viejo");
  assert.strictEqual(getTokenEnMemoria(), "token_inicial_viejo", "Debe retornar el token viejo");
  assert.strictEqual(
    apiClient.defaults.headers.common["Authorization"],
    "Bearer token_inicial_viejo",
    "Los defaults de axios deben incluir el token viejo"
  );
  console.log("  ✓ Token inicial configurado correctamente en memoria y defaults de axios");

  // -------------------------------------------------------------
  // Test 2: Simulación de renovación de token y petición posterior
  // -------------------------------------------------------------
  console.log("\n>>> Test 2: Petición ejecutada tras la renovación utiliza el nuevo token y NO el viejo");
  const nuevoToken = "nuevo_jwt_renovado_xyz_999";
  const nuevoRefreshToken = "nuevo_refresh_jwt_888";

  // Simulamos lo que hace renovarTokenSingleFlight al recibir respuesta exitosa:
  setTokenEnMemoria(nuevoToken);
  await SecureStorage.guardarToken(nuevoToken);
  await SecureStorage.guardarRefreshToken(nuevoRefreshToken);

  // Verificamos estado inmediato
  assert.strictEqual(getTokenEnMemoria(), nuevoToken, "Token en memoria debe ser el nuevo inmediatamente");
  assert.strictEqual(
    apiClient.defaults.headers.common["Authorization"],
    `Bearer ${nuevoToken}`,
    "Authorization en defaults debe ser el nuevo"
  );

  // Simulamos paso del tiempo (500ms en test rápido, equivalente a segundos después en la app)
  await sleep(100);

  // Verificamos que el interceptor de petición de apiClient use el nuevo token en una petición simulada
  let headersEnviados = null;
  const configPrueba = { headers: {} };
  
  // Ejecutar el request interceptor manualmente sobre una config
  for (const interceptor of apiClient.interceptors.request.handlers) {
    if (typeof interceptor.fulfilled === "function") {
      const resConfig = await interceptor.fulfilled(configPrueba);
      headersEnviados = resConfig?.headers;
    }
  }

  assert.ok(headersEnviados, "Debe existir objeto headers");
  assert.strictEqual(
    headersEnviados.Authorization,
    `Bearer ${nuevoToken}`,
    "La cabecera enviada en la petición posterior debe ser estrictamente el nuevo access_token"
  );
  console.log("  ✓ Petición posterior utiliza correctamente el nuevo access_token y no el viejo");

  // -------------------------------------------------------------
  // Test 3: Extracción transparente de mensajes de error de servidor
  // -------------------------------------------------------------
  console.log("\n>>> Test 3: parsearDetalleErrorServidor extrae mensajes reales sin ocultarlos");
  
  // Formato con 'mensaje'
  const err1 = { mensaje: "El saldo remanente no cubre el importe total" };
  assert.strictEqual(parsearDetalleErrorServidor(err1), "El saldo remanente no cubre el importe total");

  // Formato con 'detail' string
  const err2 = { detail: "Token expirado" };
  assert.strictEqual(parsearDetalleErrorServidor(err2), "Token expirado");

  // Formato Pydantic FastAPI (lista de objetos)
  const errPydantic = {
    detail: [
      { loc: ["body", "items_entregados", 0, "presentacion_id"], msg: "field required", type: "value_error.missing" },
      { loc: ["body", "cobro", "monto_total"], msg: "value is not a valid float", type: "type_error.float" },
    ],
  };
  const msgPydantic = parsearDetalleErrorServidor(errPydantic);
  assert.ok(msgPydantic.includes("items_entregados.0.presentacion_id: field required"));
  assert.ok(msgPydantic.includes("cobro.monto_total: value is not a valid float"));
  console.log("  ✓ Mensajes de error (incluidos Pydantic) parseados con precisión:", msgPydantic);

  // -------------------------------------------------------------
  // Test 4: Normalizador de payload ENTREGA_CON_COBRO
  // -------------------------------------------------------------
  console.log("\n>>> Test 4: normalizarPayloadEntregaCompuesta adapta payloads heterogéneos al contrato exacto");

  const payloadEntranteDesalineado = {
    id_pedido: "104", // string en lugar de int
    latitud: "-19.0435",
    longitud: "-65.2580",
    tipo_entrega: "total",
    recibidoPor: " Dña. Martha Flores  ",
    ciReceptor: "5839201 CH",
    observaciones: "Entregado con QR",
    firmaChofer: "data:image/svg+xml;utf8,<svg>chofer</svg>",
    firmaCliente: "data:image/svg+xml;utf8,<svg>cliente</svg>",
    items_entregados: [
      { id_presentacion: "1", cantidad: "10.00", es_bandeo: false },
      { IdPresentacion: 2, Cantidad: 2, es_cortesia_bandeo: true },
    ],
    cobro: {
      monto_total: "450.00",
      pagos: [
        { metodo: "efectivo", monto: "200.00" },
        { metodo: "qr", monto: "150.00", numero_referencia: "BNB-123456" },
      ],
      credito: {
        saldo: "100.00",
        plazo_dias: "15",
        cuotas: "1",
        fecha_vencimiento: "2026-11-27",
      },
    },
  };

  const payloadNormalizado = normalizarPayloadEntregaCompuesta(payloadEntranteDesalineado);

  // Validaciones de contrato
  assert.strictEqual(typeof payloadNormalizado.id_pedido, "number", "id_pedido debe ser number");
  assert.strictEqual(payloadNormalizado.id_pedido, 104);
  assert.strictEqual(payloadNormalizado.tipo_entrega, "TOTAL");
  assert.strictEqual(payloadNormalizado.recibido_por, "Dña. Martha Flores");
  assert.strictEqual(payloadNormalizado.observacion, "Entregado con QR");
  assert.strictEqual(payloadNormalizado.items_entregados.length, 2);
  assert.strictEqual(payloadNormalizado.items_entregados[0].presentacion_id, 1);
  assert.strictEqual(payloadNormalizado.items_entregados[0].cantidad, 10);
  assert.strictEqual(payloadNormalizado.items_entregados[0].es_cortesia_bandeo, false);
  assert.strictEqual(payloadNormalizado.items_entregados[1].presentacion_id, 2);
  assert.strictEqual(payloadNormalizado.items_entregados[1].cantidad, 2);
  assert.strictEqual(payloadNormalizado.items_entregados[1].es_cortesia_bandeo, true);

  // Validaciones del bloque cobro
  assert.strictEqual(payloadNormalizado.cobro.monto_total, 450);
  assert.strictEqual(payloadNormalizado.cobro.pagos.length, 2);
  assert.strictEqual(payloadNormalizado.cobro.pagos[0].metodo, "EFECTIVO");
  assert.strictEqual(payloadNormalizado.cobro.pagos[0].monto, 200);
  assert.strictEqual(payloadNormalizado.cobro.pagos[1].metodo, "QR");
  assert.strictEqual(payloadNormalizado.cobro.pagos[1].monto, 150);
  assert.strictEqual(payloadNormalizado.cobro.credito.saldo, 100);
  assert.strictEqual(payloadNormalizado.cobro.credito.plazo_dias, 15);

  // Validar caso de pago completo sin crédito (credito debe ser null, no objeto con saldo: 0)
  const payloadSinCredito = {
    id_pedido: 105,
    items_entregados: [{ presentacion_id: 1, cantidad: 5 }],
    cobro: {
      monto_total: 100,
      pagos: [{ metodo: "EFECTIVO", monto: 100 }],
      credito: { saldo: 0, plazo_dias: 15 },
    },
  };
  const normSinCredito = normalizarPayloadEntregaCompuesta(payloadSinCredito);
  assert.strictEqual(normSinCredito.cobro.credito, null, "Si saldo es 0, credito debe ser null estrictamente");
  console.log("  ✓ Normalizador de entrega y cobro valida tipos y credito null satisfactoriamente");

  // -------------------------------------------------------------
  // Test 5: Sanitizador para logs
  // -------------------------------------------------------------
  console.log("\n>>> Test 5: sanitizarPayloadParaLog trunca firmas y fotos largas para legibilidad");
  const payloadConFirmas = {
    id_pedido: 104,
    firma_chofer: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgMTBMMTAwIDEwMCIvPjwvc3ZnPg==",
    firma_cliente: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cGF0aCBkPSJNMTAgMTBMMTAwIDEwMCIvPjwvc3ZnPg==",
  };
  const sanitizado = sanitizarPayloadParaLog(payloadConFirmas);
  assert.ok(sanitizado.firma_chofer.startsWith("[Firma Chofer length:"));
  assert.ok(sanitizado.firma_cliente.startsWith("[Firma Cliente length:"));
  assert.strictEqual(sanitizado.id_pedido, 104);
  console.log("  ✓ Logs sanitizados legibles sin saturar la consola:", sanitizado);

  console.log("\n=================================================================");
  console.log("ÉXITO TOTAL: Todas las pruebas de persistencia y normalización superadas.");
  console.log("=================================================================\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Fallo en test:", err);
  process.exit(1);
});
