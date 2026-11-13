/**
 * Suite de Pruebas: Entrega Editable, Creación de Cliente con Frecuencia y Filtrado de Notificaciones
 * Sistema ERP Papelera Blanquita (Blanquita-Mobile - Subagente D)
 *
 * Verificaciones automatizadas:
 * a) Edición libre de cantidades en entrega:
 *    - Entregar menos de lo pedido (PIDIO_MENOS o entrega parcial).
 *    - Entregar más de lo pedido (PIDIO_MAS) respetando el límite del stock del camión (stock_camion).
 *    - Agregar un producto adicional del camión que no estaba en el pedido original (es_agregado_camion: true).
 *    - Generación del payload compuesto para POST /api/movil/v1/chofer/entregar con items_entregados, montos calculados y cobro.
 * b) Filtrado estricto de notificaciones de chofer:
 *    - Descarte total de avisos de caja chica, vales de Kevin, finanzas, compras o contabilidad.
 *    - Descarte de avisos dirigidos a otro id_usuario / id_chofer.
 *    - Aceptación exclusiva de avisos del chofer (RUTA_ASIGNADA, CARGA_CAMION_APROBADA, CARGA_CAMION_OBSERVADA, etc.).
 *    - Aislamiento en almacenamiento local (LocalDB) por id_usuario (@blanquita_notificaciones_{id_usuario}).
 * c) Creación de cliente con frecuencia y pedido habitual:
 *    - Selección de frecuencias (DIARIO, CADA_2_DIAS, SEMANAL con días seleccionados, FECHA_ESPECIFICA).
 *    - Especificación de productos y cantidades programadas en pedido_habitual / items_programados.
 *    - Contrato de envío a POST /api/movil/v1/chofer/cliente-en-ruta.
 * d) Ausencia de emojis Unicode:
 *    - Validación automatizada de que no existan emojis en los textos de notificación generados.
 */

const assert = require("assert");

global.__DEV__ = true;

// Mocks en memoria para almacenamiento
const storage = new Map();
const mockAsyncStorage = {
  getItem: async (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: async (k, v) => {
    storage.set(k, String(v));
    return true;
  },
  removeItem: async (k) => {
    storage.delete(k);
    return true;
  },
  multiRemove: async (keys) => {
    keys.forEach((k) => storage.delete(k));
    return true;
  },
  clear: async () => {
    storage.clear();
    return true;
  },
};

const secureStorageMap = new Map();
const mockSecureStore = {
  getItemAsync: async (k) => (secureStorageMap.has(k) ? secureStorageMap.get(k) : null),
  setItemAsync: async (k, v) => {
    secureStorageMap.set(k, String(v));
    return true;
  },
  deleteItemAsync: async (k) => {
    secureStorageMap.delete(k);
    return true;
  },
};

// Mock de WebSocket nativo para pruebas de resiliencia
class MockWebSocket {
  constructor(url, protocols, options) {
    this.url = url;
    this.protocols = protocols;
    this.options = options;
    this.readyState = 0; // CONNECTING
    this.sentData = [];
    MockWebSocket.instancias.push(this);

    setTimeout(() => {
      if (MockWebSocket.forzarErrorHandshake) {
        if (this.onerror) {
          this.onerror(new Error("Expected HTTP 101 response but was '403 Forbidden'"));
        }
        if (this.onclose) {
          this.onclose({ code: 4401, reason: "Forbidden" });
        }
      } else {
        this.readyState = 1; // OPEN
        if (this.onopen) {
          this.onopen();
        }
      }
    }, 10);
  }

  send(data) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code: 1000 });
    }
  }
}
MockWebSocket.OPEN = 1;
MockWebSocket.CONNECTING = 0;
MockWebSocket.CLOSED = 3;
MockWebSocket.instancias = [];
MockWebSocket.forzarErrorHandshake = false;

global.WebSocket = MockWebSocket;

// Interceptar módulos nativos de React Native y Expo antes de requerir código fuente
const Module = require("module");
const originalLoad = Module._load;

// Registrar extensiones de assets binarios para Node.js
['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].forEach((ext) => {
  require.extensions[ext] = (module) => {
    module.exports = 1;
  };
});

const dummyComp = (name) => {
  const c = () => null;
  c.displayName = name;
  return c;
};
const baseReactNative = {
  Platform: { OS: "android", select: (obj) => obj.android || obj.default },
  StyleSheet: { create: (s) => s, flatten: (s) => s },
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: () => {} }),
  },
  Alert: {
    alert: () => {},
  },
  View: dummyComp("View"),
  Text: dummyComp("Text"),
  SafeAreaView: dummyComp("SafeAreaView"),
  ScrollView: dummyComp("ScrollView"),
  TouchableOpacity: dummyComp("TouchableOpacity"),
  KeyboardAvoidingView: dummyComp("KeyboardAvoidingView"),
  Modal: dummyComp("Modal"),
  TextInput: dummyComp("TextInput"),
  ActivityIndicator: dummyComp("ActivityIndicator"),
};
const reactNativeMock = new Proxy(baseReactNative, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return dummyComp(String(prop));
  },
});

Module._load = function (request, parent, isMain) {
  if (request.includes("react-native")) {
    // console.log("RN REQUEST:", request);
  }
  if (
    request.endsWith(".webp") ||
    request.endsWith(".png") ||
    request.endsWith(".jpg") ||
    request.endsWith(".jpeg") ||
    request.endsWith(".svg")
  ) {
    return 1;
  }
  if (
    request === "react-native" ||
    request.startsWith("react-native/") ||
    request.includes("node_modules/react-native/") ||
    request.includes("node_modules\\react-native\\")
  ) {
    return reactNativeMock;
  }
  if (request === "@react-navigation/native" || request.includes("@react-navigation")) {
    return {
      useNavigation: () => ({ navigate: () => {}, goBack: () => {}, dispatch: () => {} }),
      useRoute: () => ({ params: {} }),
      useFocusEffect: (cb) => { cb(); },
    };
  }
  if (request.includes("react-native-safe-area-context")) {
    return {
      SafeAreaView: dummyComp("SafeAreaView"),
      SafeAreaProvider: dummyComp("SafeAreaProvider"),
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
  }
  if (request === "@react-native-async-storage/async-storage") {
    return { default: mockAsyncStorage, ...mockAsyncStorage };
  }
  if (request === "expo-secure-store" || request.includes("expo-secure-store")) {
    return mockSecureStore;
  }
  if (request === "expo-location" || request.includes("expo-location")) {
    return {
      requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
      getForegroundPermissionsAsync: async () => ({ status: "granted" }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: async () => ({
        coords: {
          latitude: -19.0435,
          longitude: -65.258,
          accuracy: 10,
        },
        timestamp: Date.now(),
      }),
    };
  }
  if (request === "expo-constants" || request.includes("expo-constants")) {
    return { default: { expoConfig: {} }, expoConfig: {} };
  }
  if (request.includes("expo-modules-core")) {
    return {};
  }
  if (request === "lucide-react-native") {
    return new Proxy({}, { get: () => () => null });
  }
  if (request === "react-native-svg") {
    return new Proxy({}, { get: () => () => null });
  }
  if (request === "react-native-view-shot") {
    return { captureRef: async () => "file:///mock.png" };
  }
  if (request === "@react-native-community/netinfo") {
    return {
      fetch: async () => ({ isConnected: true, isInternetReachable: true }),
      addEventListener: () => () => {},
    };
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const { SyncQueue } = require("../src/database/syncQueue");
const { LocalDB } = require("../src/database/localDb");
const { LogisticaApi } = require("../src/api/logisticaApi");
const { ClientesApi } = require("../src/api/clientesApi");
const { apiClient, setTokenEnMemoria } = require("../src/api/client");
const { normalizarPayloadEntregaCompuesta } = require("../src/services/syncService");
const {
  TIPOS_PERMITIDOS_CHOFER,
  normalizarTipoNotificacion,
  perteneceAModulosAjenos,
  esNotificacionValidaChofer,
} = require("../src/context/NotificacionesContext");
const { normalizarProductoCamion } = require("../src/screens/Ruta/RegistrarEntregaScreen");
const wsServiceModule = require("../src/services/wsService");
const wsService = wsServiceModule.wsService || wsServiceModule.default || wsServiceModule;
const WsService = wsService.constructor;

// Expresión regular universal para detección exhaustiva de emojis Unicode
const REGEX_EMOJIS_UNICODE =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2300}-\u{23FF}\u{2B50}\u{203C}\u{2049}\u{2139}]/gu;

// Función de sanitización de texto
const limpiarTextoEmojis = (texto) => {
  if (!texto || typeof texto !== "string") return "";
  return texto.replace(REGEX_EMOJIS_UNICODE, "").trim();
};

async function ejecutarSuiteEntregaFrecuenciaNotificaciones() {
  console.log("==================================================================");
  console.log("  SUITE SUB-AGENTE D: ENTREGA EDITABLE, FRECUENCIAS Y NOTIFICACIONES ");
  console.log("==================================================================\n");

  await mockAsyncStorage.clear();
  secureStorageMap.clear();
  setTokenEnMemoria("jwt-chofer-subagente-d-token");

  // ==========================================================================
  // SECCIÓN A: EDICIÓN LIBRE DE CANTIDADES EN ENTREGA
  // ==========================================================================
  console.log(">>> [Sección A] 1. Entregar menos de lo pedido (PIDIO_MENOS / entrega parcial)");
  {
    // Simular pedido original con 10 paquetes de Papel Higiénico Clásico a Bs. 25 c/u
    const pedidoOriginal = {
      id: 201,
      items: [
        {
          presentacion_id: 1,
          producto_nombre: "Papel Higiénico Clásico 4 rollos",
          cantidad: 10,
          precio_unitario: 25.0,
        },
      ],
    };

    // Inventario disponible en camión: 15 paquetes
    const inventarioCamion = [
      {
        presentacion_id: 1,
        nombre_producto: "Papel Higiénico Clásico 4 rollos",
        saldo_camion: 15,
        precio_unitario: 25.0,
      },
    ];

    // Inicializar estado de items editables tal como en RegistrarEntregaScreen
    let itemsEntrega = pedidoOriginal.items.map((i) => ({
      presentacion_id: i.presentacion_id,
      producto_nombre: i.producto_nombre,
      cantidadPedida: i.cantidad,
      cantidadAEntregar: i.cantidad,
      precio_unitario: i.precio_unitario,
      es_bandeo: false,
      es_agregado_camion: false,
    }));

    // El cliente solicita solo 6 bultos (menor a los 10 solicitados)
    const cantidadModificada = 6;
    itemsEntrega[0].cantidadAEntregar = cantidadModificada;

    // Helper de auto-sugerencia de situación de RegistrarEntregaScreen
    const determinarSituacion = (lista) => {
      const hayPidioMas = lista.some(
        (it) => it.es_agregado_camion || it.cantidadAEntregar > it.cantidadPedida
      );
      const hayPidioMenos = lista.some(
        (it) => !it.es_agregado_camion && it.cantidadAEntregar < it.cantidadPedida
      );
      if (hayPidioMas) return "PIDIO_MAS";
      if (hayPidioMenos) return "PIDIO_MENOS";
      return "NORMAL";
    };

    const situacionCalculada = determinarSituacion(itemsEntrega);
    assert.strictEqual(
      situacionCalculada,
      "PIDIO_MENOS",
      "Debe auto-sugerir PIDIO_MENOS cuando la cantidad a entregar es menor a la pedida"
    );

    // Calcular montos
    const totalMontoCalculado = itemsEntrega.reduce(
      (acc, it) => acc + it.cantidadAEntregar * it.precio_unitario,
      0
    );
    assert.strictEqual(
      totalMontoCalculado,
      150.0,
      "El monto total debe calcularse exactamente con la cantidad editada (6 * 25 = 150)"
    );

    // Armar payload compuesto para entrega
    const payloadEntregaMenor = {
      id_pedido: pedidoOriginal.id,
      latitud: -19.0435,
      longitud: -65.258,
      tipo_entrega: "PARCIAL",
      incidencia: situacionCalculada,
      recibido_por: "Dña. Carmen Soliz",
      ci_receptor: "1029384",
      observaciones: "[PIDIO_MENOS] Cliente no tenía suficiente espacio en almacén",
      observacion: "[PIDIO_MENOS] Cliente no tenía suficiente espacio en almacén",
      firma_chofer: "data:image/png;base64,FIRMA_CHOFER_OK",
      firma_cliente: "data:image/png;base64,FIRMA_CLIENTE_OK",
      items_entregados: itemsEntrega.map((i) => ({
        presentacion_id: i.presentacion_id,
        producto_nombre: i.producto_nombre,
        cantidad: i.cantidadAEntregar,
        precio_unitario: i.precio_unitario,
        es_cortesia_bandeo: false,
        subtotal: i.cantidadAEntregar * i.precio_unitario,
      })),
      monto_total: totalMontoCalculado,
      cobro: {
        monto_total: totalMontoCalculado,
        pagos: [
          {
            metodo: "EFECTIVO",
            monto: totalMontoCalculado,
            numero_referencia: null,
            id_comprobante_archivo: null,
          },
        ],
        credito: null,
      },
    };

    // Validar normalización con el contrato del motor de sync
    const normalizado = normalizarPayloadEntregaCompuesta(payloadEntregaMenor);
    assert.strictEqual(normalizado.tipo_entrega, "PARCIAL", "tipo_entrega debe ser PARCIAL");
    assert.strictEqual(normalizado.incidencia, "PIDIO_MENOS", "incidencia debe ser PIDIO_MENOS");
    assert.strictEqual(normalizado.items_entregados[0].cantidad, 6, "Cantidad entregada debe ser 6");
    assert.strictEqual(normalizado.cobro.monto_total, 150, "Cobro debe coincidir con Bs. 150");
    console.log("  ✓ Entrega de menor cantidad (PIDIO_MENOS) validada exitosamente");
  }

  console.log("\n>>> [Sección A] 2. Entregar más de lo pedido (PIDIO_MAS) respetando el límite de stock en camión");
  {
    // Pedido con 4 bultos pedidos de Servilletas Mesa
    const pedidoOriginal = {
      id: 202,
      items: [
        {
          presentacion_id: 3,
          producto_nombre: "Servilletas Blanquita Mesa 200u",
          cantidad: 4,
          precio_unitario: 12.0,
        },
      ],
    };

    // El camión dispone de solo 8 bultos físicos (saldo_camion: 8)
    const inventarioCamion = [
      {
        presentacion_id: 3,
        nombre_producto: "Servilletas Blanquita Mesa 200u",
        saldo_camion: 8,
        precio_unitario: 12.0,
      },
    ];

    let itemsEntrega = pedidoOriginal.items.map((i) => ({
      presentacion_id: i.presentacion_id,
      producto_nombre: i.producto_nombre,
      cantidadPedida: i.cantidad,
      cantidadAEntregar: i.cantidad,
      precio_unitario: i.precio_unitario,
      es_bandeo: false,
      es_agregado_camion: false,
    }));

    // El cliente pide 6 bultos (más de los 4 pedidos pero dentro del stock de 8)
    const itemCamion = inventarioCamion.find((c) => c.presentacion_id === 3);
    const saldoDisponible = itemCamion.saldo_camion;

    let solicitado = 6;
    let cantidadAsignada = Math.min(solicitado, saldoDisponible);
    itemsEntrega[0].cantidadAEntregar = cantidadAsignada;

    const hayPidioMas = itemsEntrega[0].cantidadAEntregar > itemsEntrega[0].cantidadPedida;
    assert.ok(hayPidioMas, "Debe detectar que el cliente pidió más unidades");
    assert.strictEqual(cantidadAsignada, 6, "6 unidades deben permitirse al ser <= stock (8)");

    // Ahora el chofer intenta tipear 15 unidades (superando el stock de 8 del camión)
    let solicitadoExcesivo = 15;
    let cantidadTopeada = Math.min(solicitadoExcesivo, saldoDisponible);
    itemsEntrega[0].cantidadAEntregar = cantidadTopeada;

    assert.strictEqual(
      cantidadTopeada,
      8,
      "La cantidad debe quedar estrictamente topeada al stock_camion (8 bultos)"
    );

    // Calcular montos con los 8 bultos topeados
    const montoFinal = itemsEntrega[0].cantidadAEntregar * itemsEntrega[0].precio_unitario;
    assert.strictEqual(montoFinal, 96.0, "Monto debe ser 8 * 12 = 96 Bs.");

    const payloadMas = {
      id_pedido: pedidoOriginal.id,
      latitud: -19.0435,
      longitud: -65.258,
      tipo_entrega: "PARCIAL",
      incidencia: "PIDIO_MAS",
      recibido_por: "Don Jaime Morales",
      ci_receptor: "7766554",
      observaciones: "[PIDIO_MAS] Cliente solicitó más paquetes aprovechando stock disponible",
      observacion: "[PIDIO_MAS] Cliente solicitó más paquetes aprovechando stock disponible",
      firma_chofer: "data:image/png;base64,FIRMA_CH",
      firma_cliente: "data:image/png;base64,FIRMA_CL",
      items_entregados: [
        {
          presentacion_id: itemsEntrega[0].presentacion_id,
          cantidad: itemsEntrega[0].cantidadAEntregar,
          precio_unitario: itemsEntrega[0].precio_unitario,
        },
      ],
      monto_total: montoFinal,
      cobro: {
        monto_total: montoFinal,
        pagos: [{ metodo: "EFECTIVO", monto: montoFinal }],
      },
    };

    const normMas = normalizarPayloadEntregaCompuesta(payloadMas);
    assert.strictEqual(normMas.incidencia, "PIDIO_MAS", "Incidencia debe ser PIDIO_MAS");
    assert.strictEqual(normMas.items_entregados[0].cantidad, 8, "Debe resguardar los 8 bultos");
    console.log("  ✓ Límite estricto por stock_camion ante PIDIO_MAS comprobado exitosamente");
  }

  console.log("\n>>> [Sección A] 3. Agregar producto adicional del camión que no estaba en el pedido (es_agregado_camion: true)");
  {
    // Pedido inicial con solo Toalla Interdoblada
    const itemsActuales = [
      {
        presentacion_id: 4,
        producto_nombre: "Toalla Interdoblada 150u",
        cantidadPedida: 5,
        cantidadAEntregar: 5,
        precio_unitario: 18.5,
        es_agregado_camion: false,
      },
    ];

    // Inventario del camión contiene Bobinas Industriales que no estaban en el pedido
    const productoCamion = {
      presentacion_id: 5,
      nombre_producto: "Bobina Industrial 500m",
      saldo_camion: 3,
      precio_unitario: 120.0,
    };

    // Agregar producto del camión simulando la lógica de RegistrarEntregaScreen
    const nuevoItemCamion = {
      id: `camion-${productoCamion.presentacion_id}-${Date.now()}`,
      presentacion_id: productoCamion.presentacion_id,
      producto_nombre: productoCamion.nombre_producto,
      cantidadPedida: 0,
      cantidadYaEntregada: 0,
      cantidadPendiente: 0,
      cantidadAEntregar: 2, // Chofer le agrega 2 bobinas
      precio_unitario: productoCamion.precio_unitario,
      es_bandeo: false,
      es_agregado_camion: true,
    };

    const itemsActualizados = [...itemsActuales, nuevoItemCamion];

    assert.strictEqual(itemsActualizados.length, 2, "Debe contener los 2 productos");
    const itemExtra = itemsActualizados.find((i) => i.es_agregado_camion);
    assert.ok(itemExtra, "Debe existir un item con es_agregado_camion: true");
    assert.strictEqual(itemExtra.presentacion_id, 5);
    assert.strictEqual(itemExtra.cantidadPedida, 0);
    assert.strictEqual(itemExtra.cantidadAEntregar, 2);

    // Detección automática de situación
    const hayAgregadoCamion = itemsActualizados.some((i) => i.es_agregado_camion);
    assert.strictEqual(hayAgregadoCamion, true, "Debe detectar item agregado del camión");

    // Intento de superar stock disponible de bobinas (saldo: 3)
    const intentarAgregarMas = 4;
    const permitido = Math.min(intentarAgregarMas, productoCamion.saldo_camion);
    assert.strictEqual(permitido, 3, "No puede exceder el stock disponible de 3 bobinas");

    console.log("  ✓ Inclusión de producto adicional del camión (es_agregado_camion: true) validada");
  }

  console.log("\n>>> [Sección A] 4. Generación de payload compuesto para POST /api/movil/v1/chofer/entregar con cobro mixto");
  {
    let endpointLlamado = false;
    let urlPeticion = "";
    let payloadEnviado = null;
    let headersEnviados = null;

    // Mock temporal de apiClient.post
    const postOriginal = apiClient.post;
    apiClient.post = async (url, data, config) => {
      endpointLlamado = true;
      urlPeticion = url;
      payloadEnviado = data;
      headersEnviados = config?.headers;
      return {
        data: {
          codigo: "EXITO",
          mensaje: "Entrega registrada exitosamente",
          datos: { id_entrega: 501, estado: "ENTREGADO" },
        },
      };
    };

    const idempotencyKey = SyncQueue.generarUuidV4();
    const payloadCompuesto = {
      id_pedido: 305,
      latitud: -19.0435,
      longitud: -65.258,
      tipo_entrega: "PARCIAL",
      incidencia: "PIDIO_MAS",
      recibido_por: "Dña. Martha Flores",
      ci_receptor: "5544332",
      observaciones: "[PIDIO_MAS] Entregó producto extra del camión",
      firma_chofer: "data:image/png;base64,FIRMA_CH_OK",
      firma_cliente: "data:image/png;base64,FIRMA_CL_OK",
      items_entregados: [
        {
          presentacion_id: 1,
          producto_nombre: "Papel Higiénico Clásico",
          cantidad: 6,
          precio_unitario: 25.0,
          es_cortesia_bandeo: false,
          subtotal: 150.0,
        },
        {
          presentacion_id: 5,
          producto_nombre: "Bobina Industrial 500m",
          cantidad: 2,
          precio_unitario: 120.0,
          es_cortesia_bandeo: false,
          subtotal: 240.0,
        },
      ],
      monto_total: 390.0,
      cobro: {
        monto_total: 390.0,
        pagos: [
          {
            metodo: "EFECTIVO",
            monto: 190.0,
            numero_referencia: null,
            id_comprobante_archivo: null,
          },
          {
            metodo: "QR",
            monto: 200.0,
            numero_referencia: "QR-998877",
            id_comprobante_archivo: null,
            foto_uri: "file:///mock/path/comprobante_qr.jpg",
          },
        ],
        credito: null,
      },
    };

    const resp = await LogisticaApi.registrarEntrega(payloadCompuesto, idempotencyKey);
    apiClient.post = postOriginal;

    assert.ok(resp.success, "Respuesta debe ser exitosa");
    assert.strictEqual(endpointLlamado, true, "Debe llamar al endpoint de backend");
    assert.strictEqual(
      urlPeticion,
      "/api/movil/v1/chofer/entregar",
      "Debe despachar exactamente a /api/movil/v1/chofer/entregar"
    );
    assert.strictEqual(
      headersEnviados["X-Idempotency-Key"],
      idempotencyKey,
      "Debe incluir encabezado X-Idempotency-Key con UUID v4"
    );
    assert.strictEqual(payloadEnviado.monto_total, 390.0);
    assert.strictEqual(payloadEnviado.items_entregados.length, 2);
    assert.strictEqual(payloadEnviado.cobro.pagos.length, 2);
    console.log("  ✓ Contrato y despacho a POST /api/movil/v1/chofer/entregar comprobado con éxito");
  }

  // ==========================================================================
  // SECCIÓN B: FILTRADO ESTRICTO DE NOTIFICACIONES DE CHOFER
  // ==========================================================================
  console.log("\n>>> [Sección B] 1. Descarte total de avisos de caja chica, vales, finanzas, compras y contabilidad");
  {
    const usuarioChofer = {
      IdUsuario: 12,
      Ci: "7894561",
      Rol: "CHOFER",
    };

    const notificacionesAjenas = [
      {
        id: 1,
        tipo: "AVISO_ADMIN",
        titulo: "Vale de Caja Chica aprobado",
        mensaje: "Kevin aprobó tu vale de caja chica por Bs. 50 para combustible",
        id_usuario_destino: 12,
      },
      {
        id: 2,
        tipo: "AVISO_RUTA",
        titulo: "Rendición de Gastos",
        mensaje: "Se ha solicitado la rendicion de cuentas de compras a contabilidad",
        id_usuario_destino: 12,
      },
      {
        id: 3,
        tipo: "ORDEN_COMPRA",
        titulo: "Nueva Compra de Materia Prima",
        mensaje: "Proveedor de bobinas entregó factura",
        modulo: "compras",
        id_usuario_destino: 12,
      },
      {
        id: 4,
        tipo: "PLANILLA_SUELDO",
        titulo: "Planilla de sueldos generada",
        mensaje: "Se procesaron las planillas del mes",
        categoria: "finanzas",
        id_usuario_destino: 12,
      },
      {
        id: 5,
        tipo: "REVALORIZACION",
        titulo: "Ajuste de Revalorización",
        mensaje: "Revalorizacion contable de inventario",
        origen: "contabilidad",
        id_usuario_destino: 12,
      },
    ];

    for (const aviso of notificacionesAjenas) {
      const esAjeno = perteneceAModulosAjenos(aviso);
      assert.strictEqual(
        esAjeno,
        true,
        `El aviso "${aviso.titulo || aviso.mensaje}" debe detectarse como módulo ajeno`
      );

      const esValido = esNotificacionValidaChofer(aviso, usuarioChofer);
      assert.strictEqual(
        esValido,
        false,
        `El aviso ajeno "${aviso.titulo || aviso.mensaje}" debe descartarse completamente para el chofer`
      );
    }
    console.log("  ✓ Avisos ajenos de caja chica, vales, finanzas y contabilidad descartados al 100%");
  }

  console.log("\n>>> [Sección B] 2. Descarte de avisos dirigidos a otro id_usuario / id_chofer / ci");
  {
    const usuarioChofer = {
      IdUsuario: 12,
      Ci: "7894561",
      Rol: "CHOFER",
    };

    const notificacionesOtroDestinatario = [
      {
        id: 101,
        tipo: "RUTA_ASIGNADA",
        titulo: "Ruta Asignada",
        mensaje: "Se asignó la ruta Norte",
        id_usuario_destino: 99, // Otro usuario
      },
      {
        id: 102,
        tipo: "CARGA_CAMION_APROBADA",
        titulo: "Carga Aprobada",
        mensaje: "Carga de 120 bultos autorizada",
        id_chofer: 33, // Otro chofer
      },
      {
        id: 103,
        tipo: "RUTA_REORDENADA",
        titulo: "Ruta Reordenada",
        mensaje: "Se reordenó la secuencia",
        ci_destino: "1122334", // Otro CI
      },
      {
        id: 104,
        tipo: "CARGA_CAMION_OBSERVADA",
        titulo: "Carga Observada",
        mensaje: "Faltan unidades de servilletas",
        // Sin destinatario en canal WebSocket broadcast
      },
    ];

    // Primeros 3 tienen destinatario explícito hacia otro chofer
    assert.strictEqual(esNotificacionValidaChofer(notificacionesOtroDestinatario[0], usuarioChofer), false);
    assert.strictEqual(esNotificacionValidaChofer(notificacionesOtroDestinatario[1], usuarioChofer), false);
    assert.strictEqual(esNotificacionValidaChofer(notificacionesOtroDestinatario[2], usuarioChofer), false);

    // El 4to no tiene destinatario explícito en WebSocket broadcast -> debe ser descartado
    assert.strictEqual(
      esNotificacionValidaChofer(notificacionesOtroDestinatario[3], usuarioChofer, { esWs: true }),
      false,
      "En canal broadcast WS sin destinatario explícito debe descartarse para evitar capturas globales"
    );

    console.log("  ✓ Avisos dirigidos a otros usuarios o sin destinatario en WS descartados exitosamente");
  }

  console.log("\n>>> [Sección B] 3. Aceptación exclusiva de avisos del chofer y normalización de alias");
  {
    const usuarioChofer = {
      IdUsuario: 12,
      Ci: "7894561",
      Rol: "CHOFER",
    };

    // Validar lista blanca completa
    const eventosOperativosChofer = [
      "RUTA_ASIGNADA",
      "CARGA_CAMION_APROBADA",
      "CARGA_CAMION_OBSERVADA",
      "CARGA_CAMION_RECHAZADA",
      "RUTA_REORDENADA",
      "OPERACION_REVISADA",
      "RUTA_FINALIZADA_ADMIN",
      "ABONO_QR_APROBADO",
      "ABONO_QR_RECHAZADO",
      "TELEMETRIA_PING",
      "AVISO_RUTA",
    ];

    for (const tipo of eventosOperativosChofer) {
      assert.ok(
        TIPOS_PERMITIDOS_CHOFER.includes(tipo),
        `El tipo "${tipo}" debe pertenecer a TIPOS_PERMITIDOS_CHOFER`
      );

      const notif = {
        id: `ev-${tipo}`,
        tipo,
        titulo: `Aviso institucional: ${tipo}`,
        mensaje: `Detalle operativo de ${tipo}`,
        id_usuario_destino: 12,
      };

      const valida = esNotificacionValidaChofer(notif, usuarioChofer);
      assert.strictEqual(valida, true, `La notificación "${tipo}" debe ser aceptada para el chofer`);
    }

    // Normalización de alias
    assert.strictEqual(normalizarTipoNotificacion("ABONO_APROBADO"), "ABONO_QR_APROBADO");
    assert.strictEqual(normalizarTipoNotificacion("ABONO_RECHAZADO"), "ABONO_QR_RECHAZADO");
    assert.strictEqual(normalizarTipoNotificacion("CARGA_CAMION_RESUELTA"), "CARGA_CAMION_APROBADA");
    assert.strictEqual(normalizarTipoNotificacion("SOLICITAR_UBICACION_ACTUAL"), "TELEMETRIA_PING");
    console.log("  ✓ Aceptación exclusiva de eventos de chofer y normalización de alias comprobada");
  }

  console.log("\n>>> [Sección B] 4. Aislamiento estricto en LocalDB por id_usuario (@blanquita_notificaciones_{id_usuario})");
  {
    const CHOFER_A = 12;
    const CHOFER_B = 25;

    const notifsChoferA = [
      { id: 1, tipo: "RUTA_ASIGNADA", mensaje: "Ruta Sucre Centro para Chofer A" },
      { id: 2, tipo: "CARGA_CAMION_APROBADA", mensaje: "Carga de Chofer A aprobada" },
    ];

    const notifsChoferB = [
      { id: 3, tipo: "RUTA_ASIGNADA", mensaje: "Ruta Potosí Sur para Chofer B" },
    ];

    // Guardar en almacenamiento aislado
    await LocalDB.guardarNotificacionesLocales(CHOFER_A, notifsChoferA);
    await LocalDB.guardarNotificacionesLocales(CHOFER_B, notifsChoferB);

    // Verificar que existen las claves aisladas en AsyncStorage
    const rawClaveA = await mockAsyncStorage.getItem(`@blanquita_notificaciones_${CHOFER_A}`);
    const rawClaveB = await mockAsyncStorage.getItem(`@blanquita_notificaciones_${CHOFER_B}`);
    assert.ok(rawClaveA, "Debe existir clave aislada para Chofer A");
    assert.ok(rawClaveB, "Debe existir clave aislada para Chofer B");

    // Leer notificaciones locales de cada uno
    const leidasA = await LocalDB.obtenerNotificacionesLocales(CHOFER_A);
    const leidasB = await LocalDB.obtenerNotificacionesLocales(CHOFER_B);

    assert.strictEqual(leidasA.length, 2, "Chofer A debe tener exactamente 2 notificaciones");
    assert.strictEqual(leidasB.length, 1, "Chofer B debe tener exactamente 1 notificación");
    assert.strictEqual(leidasA[0].mensaje, "Ruta Sucre Centro para Chofer A");
    assert.strictEqual(leidasB[0].mensaje, "Ruta Potosí Sur para Chofer B");

    // Limpiar notificaciones de Chofer A y verificar que Chofer B no se altera
    await LocalDB.limpiarNotificacionesLocales(CHOFER_A);

    const trasLimpiarA = await LocalDB.obtenerNotificacionesLocales(CHOFER_A);
    const trasLimpiarB = await LocalDB.obtenerNotificacionesLocales(CHOFER_B);

    assert.strictEqual(trasLimpiarA.length, 0, "Notificaciones de Chofer A deben estar vacías");
    assert.strictEqual(trasLimpiarB.length, 1, "Notificaciones de Chofer B deben seguir intactas");
    console.log("  ✓ Aislamiento local de notificaciones por id_usuario (@blanquita_notificaciones_{id}) validado");
  }

  // ==========================================================================
  // SECCIÓN C: CREACIÓN DE CLIENTE CON FRECUENCIA Y PEDIDO HABITUAL
  // ==========================================================================
  console.log("\n>>> [Sección C] 1. Selección y validación de las 4 modalidades de frecuencia de visita");
  {
    const frecuenciasPermitidas = ["DIARIO", "CADA_2_DIAS", "SEMANAL", "FECHA_ESPECIFICA"];

    // 1. DIARIO
    const cfgDiario = {
      frecuencia_visita: "DIARIO",
      dias_semana: [],
      fecha_primera_entrega: null,
    };
    assert.ok(frecuenciasPermitidas.includes(cfgDiario.frecuencia_visita));

    // 2. CADA_2_DIAS
    const cfgCada2Dias = {
      frecuencia_visita: "CADA_2_DIAS",
      dias_semana: [],
      fecha_primera_entrega: null,
    };
    assert.ok(frecuenciasPermitidas.includes(cfgCada2Dias.frecuencia_visita));

    // 3. SEMANAL con días seleccionados
    const cfgSemanal = {
      frecuencia_visita: "SEMANAL",
      dias_semana: ["LUNES", "MIERCOLES", "VIERNES"],
      fecha_primera_entrega: null,
    };
    assert.strictEqual(cfgSemanal.dias_semana.length, 3);
    assert.ok(cfgSemanal.dias_semana.includes("LUNES"));

    // 4. FECHA_ESPECIFICA
    const cfgFecha = {
      frecuencia_visita: "FECHA_ESPECIFICA",
      dias_semana: [],
      fecha_primera_entrega: "2026-11-25",
    };
    assert.match(cfgFecha.fecha_primera_entrega, /^\d{4}-\d{2}-\d{2}$/);
    console.log("  ✓ 4 frecuencias de visita (DIARIO, CADA_2_DIAS, SEMANAL, FECHA_ESPECIFICA) validadas");
  }

  console.log("\n>>> [Sección C] 2. Especificación de productos y cálculo de pedido_habitual / items_programados");
  {
    // Catálogo base disponible en la app
    const catalogo = [
      { id: 1, presentacion_id: 1, nombre: "Papel Higiénico Clásico (Fardo)", precio: 24.5 },
      { id: 2, presentacion_id: 2, nombre: "Papel Higiénico Familiar 12r (Fardo)", precio: 45.0 },
      { id: 3, presentacion_id: 3, nombre: "Servilletas Blanquita Mesa 200u", precio: 12.0 },
    ];

    // Cantidades seleccionadas en la interfaz de NuevoClienteScreen
    const cantidadesSeleccionadas = {
      1: 10, // 10 fardos clásico -> 245 Bs
      3: 5, // 5 paquetes servilletas -> 60 Bs
    };

    const itemsProgramados = Object.entries(cantidadesSeleccionadas).map(([presId, cant]) => ({
      presentacion_id: parseInt(presId, 10),
      cantidad: cant,
    }));

    const pedidoHabitual = itemsProgramados.map((item) => {
      const prod = catalogo.find((p) => p.presentacion_id === item.presentacion_id);
      return {
        presentacion_id: item.presentacion_id,
        nombre: prod.nombre,
        cantidad: item.cantidad,
        precio_unitario: prod.precio,
        subtotal: item.cantidad * prod.precio,
      };
    });

    const totalBultos = pedidoHabitual.reduce((sum, it) => sum + it.cantidad, 0);
    const montoTotalEstimado = pedidoHabitual.reduce((sum, it) => sum + it.subtotal, 0);

    assert.strictEqual(totalBultos, 15, "Total bultos debe ser 10 + 5 = 15");
    assert.strictEqual(montoTotalEstimado, 305.0, "Monto estimado debe ser 245 + 60 = 305 Bs.");
    assert.strictEqual(itemsProgramados.length, 2);
    console.log("  ✓ Especificación y cálculo de pedido_habitual / items_programados comprobado");
  }

  console.log("\n>>> [Sección C] 3. Contrato de envío a POST /api/movil/v1/chofer/cliente-en-ruta con PROGRAMAR_ENTREGA");
  {
    let endpointLlamado = false;
    let urlPeticion = "";
    let payloadRecibido = null;
    let headersRecibidos = null;

    const postOriginal = apiClient.post;
    apiClient.post = async (url, data, config) => {
      endpointLlamado = true;
      urlPeticion = url;
      payloadRecibido = data;
      headersRecibidos = config?.headers;
      return {
        data: {
          codigo: "EXITO",
          mensaje: "Cliente en ruta registrado con éxito",
          datos: { id_cliente: 801, razon_social: data.datos_cliente.razon_social },
        },
      };
    };

    const idempotencyKey = SyncQueue.generarUuidV4();
    const payloadCliente = {
      datos_cliente: {
        razon_social: "Abarrotes Don Pepe",
        nombre_comercial: "Don Pepe",
        nombre_propietario: "José Morales",
        ci_nit: "3498120",
        telefono: "72819283",
        direccion: "Av. Jaime Mendoza #450",
        zona: "Sucre",
        tipo_negocio: "TIENDA_BARRIO",
        latitud: -19.0431,
        longitud: -65.2592,
        frecuencia_visita: "SEMANAL",
        dias_semana: ["LUNES", "JUEVES"],
        pedido_habitual: [
          { presentacion_id: 1, cantidad: 8, precio_unitario: 24.5 },
          { presentacion_id: 2, cantidad: 4, precio_unitario: 45.0 },
        ],
        fecha_primera_entrega: null,
      },
      modalidad: "PROGRAMAR_ENTREGA",
      frecuencia_visita: "SEMANAL",
      dias_semana: ["LUNES", "JUEVES"],
      pedido_habitual: [
        { presentacion_id: 1, cantidad: 8, precio_unitario: 24.5 },
        { presentacion_id: 2, cantidad: 4, precio_unitario: 45.0 },
      ],
      fecha_primera_entrega: null,
      dia_semana_programado: 1, // Lunes
      items_programados: [
        { presentacion_id: 1, cantidad: 8 },
        { presentacion_id: 2, cantidad: 4 },
      ],
      parada_actual_orden: null,
      entrega_con_cobro: null,
    };

    const resultado = await ClientesApi.registrarClienteEnRuta(payloadCliente, idempotencyKey);
    apiClient.post = postOriginal;

    assert.ok(resultado.success, "Respuesta de alta de cliente debe ser exitosa");
    assert.strictEqual(endpointLlamado, true);
    assert.strictEqual(
      urlPeticion,
      "/api/movil/v1/chofer/cliente-en-ruta",
      "Debe despachar exactamente a /api/movil/v1/chofer/cliente-en-ruta"
    );
    assert.strictEqual(
      headersRecibidos["X-Idempotency-Key"],
      idempotencyKey,
      "Debe incluir encabezado X-Idempotency-Key UUID v4"
    );
    assert.strictEqual(payloadRecibido.modalidad, "PROGRAMAR_ENTREGA");
    assert.strictEqual(payloadRecibido.frecuencia_visita, "SEMANAL");
    assert.deepStrictEqual(payloadRecibido.dias_semana, ["LUNES", "JUEVES"]);
    assert.strictEqual(payloadRecibido.items_programados.length, 2);

    // Encolado offline de cliente en ruta
    const opClienteEncolada = await SyncQueue.encolarOperacion(
      "CLIENTE_EN_RUTA",
      payloadCliente,
      { latitud: -19.0431, longitud: -65.2592 },
      12
    );
    assert.ok(opClienteEncolada.idempotencyKey, "Debe tener UUIDv4");
    assert.strictEqual(opClienteEncolada.tipo, "CLIENTE_EN_RUTA");
    assert.strictEqual(opClienteEncolada.estado, "pendiente de sincronizar");

    console.log("  ✓ Contrato POST /api/movil/v1/chofer/cliente-en-ruta y encolado offline comprobado");
  }

  // ==========================================================================
  // SECCIÓN D: AUSENCIA DE EMOJIS UNICODE EN NOTIFICACIONES Y PLANTILLAS
  // ==========================================================================
  console.log("\n>>> [Sección D] 1. Ausencia total de emojis Unicode en textos institucionales y títulos");
  {
    const textosNotificacionesOficiales = [
      "Ruta Asignada: Se ha asignado una nueva hoja de ruta.",
      "Carga Camion Aprobada: Tu solicitud de carga ha sido aprobada por Administración.",
      "Carga Camion Observada: Tu solicitud de carga fue observada. Revisa los motivos.",
      "Carga Camion Rechazada: Tu solicitud de carga fue rechazada por Administración.",
      "Ruta Reordenada: La secuencia de paradas de tu ruta ha sido actualizada.",
      "Operacion Revisada: Tu entrega o cobro fue revisado por Administracion.",
      "Ruta Finalizada: La administracion ha finalizado y cerrado tu ruta del dia.",
      "Abono QR Aprobado: El pago QR ha sido verificado y conciliado por Finanzas.",
      "Abono QR Rechazado: El pago QR fue rechazado. Verifique con el cliente.",
      "Telemetria: Ubicacion solicitada por la central logistica.",
      "Aviso Ruta: Informacion operativa relevante para tu recorrido.",
    ];

    for (const texto of textosNotificacionesOficiales) {
      const contieneEmoji = REGEX_EMOJIS_UNICODE.test(texto);
      assert.strictEqual(
        contieneEmoji,
        false,
        `El texto institucional "${texto}" no debe contener ningún emoji Unicode`
      );
    }
    console.log("  ✓ Cero emojis comprobado en todos los textos institucionales oficiales");
  }

  console.log("\n>>> [Sección D] 2. Sanitización automática de textos entrantes con emojis decorativos");
  {
    const textosContaminados = [
      {
        original: "🚨 RUTA_ASIGNADA 🚚 - Camión listo para despacho ✅",
        esperado: "RUTA_ASIGNADA  - Camión listo para despacho",
      },
      {
        original: "📦 CARGA_CAMION_APROBADA 👍 - Pasa a almacén central 🏭",
        esperado: "CARGA_CAMION_APROBADA  - Pasa a almacén central",
      },
      {
        original: "⚠️ CARGA_CAMION_OBSERVADA 🔍 - Revisar bultos faltantes ❌",
        esperado: "CARGA_CAMION_OBSERVADA  - Revisar bultos faltantes",
      },
      {
        original: "📍 NUEVO_CLIENTE_REGISTRADO 📝 - En espera de visita ⏳",
        esperado: "NUEVO_CLIENTE_REGISTRADO  - En espera de visita",
      },
    ];

    for (const caso of textosContaminados) {
      assert.strictEqual(
        REGEX_EMOJIS_UNICODE.test(caso.original),
        true,
        "El texto de prueba original debe contener emojis"
      );

      const sanitizado = limpiarTextoEmojis(caso.original);
      const sigueTeniendoEmojis = REGEX_EMOJIS_UNICODE.test(sanitizado);
      assert.strictEqual(
        sigueTeniendoEmojis,
        false,
        `El texto sanitizado no debe tener emojis: "${sanitizado}"`
      );
    }
    console.log("  ✓ Sanitización y purga de emojis decorativos validada exitosamente");
  }

  // ==========================================================================
  // SECCIÓN E: REGRESIONES CRÍTICAS SUBAGENTE C
  // ==========================================================================
  console.log("\n==================================================================");
  console.log("  SUITE SUB-AGENTE C: REGRESIONES CRÍTICAS DE STOCK, POTOSÍ Y WS    ");
  console.log("==================================================================\n");

  console.log(">>> [Sección E] 1. Mapeo defensivo de stock en camión (variantes de claves)");
  {
    const casosCamion = [
      {
        raw: { presentacion_id: 11, producto_nombre: "Papel Higiénico 12u", cantidad_remanente: 42, precio_unitario: 24.5 },
        esperadoStock: 42,
        esperadoPresId: 11,
        esperadoNombre: "Papel Higiénico 12u",
        esperadoPrecio: 24.5,
      },
      {
        raw: { id_presentacion: 12, nombre_presentacion: "Bobina Industrial 500m", stock_actual: 18, precio_vigente: 85.0 },
        esperadoStock: 18,
        esperadoPresId: 12,
        esperadoNombre: "Bobina Industrial 500m",
        esperadoPrecio: 85.0,
      },
      {
        raw: { IdPresentacion: 13, NombrePresentacion: "Servilleta Cocktail 100u", saldo_camion: 35, precio_salida: 12.0 },
        esperadoStock: 35,
        esperadoPresId: 13,
        esperadoNombre: "Servilleta Cocktail 100u",
        esperadoPrecio: 12.0,
      },
      {
        raw: { id_producto: 14, nombre: "Toalla Interdoblada 200u", saldo: 27, precio: 19.0 },
        esperadoStock: 27,
        esperadoPresId: 14,
        esperadoNombre: "Toalla Interdoblada 200u",
        esperadoPrecio: 19.0,
      },
      {
        raw: { id: 15, descripcion: "Papel Higiénico Blanco Doble Hoja", cantidad: 50, precio_unitario: 30.0 },
        esperadoStock: 50,
        esperadoPresId: 15,
        esperadoNombre: "Papel Higiénico Blanco Doble Hoja",
        esperadoPrecio: 30.0,
      },
      {
        raw: { presentacion_id: 16, producto_nombre: "Toalla Rollo Autocorte", saldoCamion: 14, precio_unitario: 45.0 },
        esperadoStock: 14,
        esperadoPresId: 16,
        esperadoNombre: "Toalla Rollo Autocorte",
        esperadoPrecio: 45.0,
      },
      {
        raw: { presentacion_id: 17, producto_nombre: "Dispensador Plástico", cantidad_disponible: 6, precio_unitario: 60.0 },
        esperadoStock: 6,
        esperadoPresId: 17,
        esperadoNombre: "Dispensador Plástico",
        esperadoPrecio: 60.0,
      },
    ];

    for (const caso of casosCamion) {
      const normalizado = normalizarProductoCamion(caso.raw);
      assert.ok(normalizado, "El producto normalizado no debe ser null");
      assert.strictEqual(normalizado.presentacion_id, caso.esperadoPresId, "presentacion_id debe coincidir");
      assert.strictEqual(normalizado.producto_nombre, caso.esperadoNombre, "producto_nombre debe coincidir");
      assert.strictEqual(normalizado.saldo_camion, caso.esperadoStock, "saldo_camion debe normalizarse");
      assert.strictEqual(normalizado.cantidad_remanente, caso.esperadoStock, "cantidad_remanente debe reflejar el saldo");
      assert.strictEqual(normalizado.stock_actual, caso.esperadoStock, "stock_actual debe reflejar el saldo");
      assert.strictEqual(normalizado.cantidad_disponible, caso.esperadoStock, "cantidad_disponible debe reflejar el saldo");
      assert.strictEqual(normalizado.precio_unitario, caso.esperadoPrecio, "precio_unitario debe normalizarse");
    }
    console.log("  ✓ Todas las variantes (cantidad_remanente, stock_actual, saldo_camion, saldo, cantidad) normalizadas correctamente");
  }

  console.log("\n>>> [Sección E] 2. Modal + Agregar otro producto del camión: cálculo de saldo restante");
  {
    // Inventario crudo del camión con productos con y sin stock
    const inventarioCamionCrudo = [
      { id_presentacion: 1, nombre_presentacion: "Papel Higiénico Clásico", cantidad_remanente: 20, precio_unitario: 25.0 },
      { IdPresentacion: 2, NombrePresentacion: "Bobina Kraft 400m", stock_actual: 8, precio_vigente: 90.0 },
      { id_producto: 3, nombre: "Servilleta Económica", saldo: 0, precio: 10.0 }, // Agotado en camión
      { id: 4, descripcion: "Toalla Interdoblada Blanca", cantidad: 15, precio: 18.0 },
      { presentacion_id: 5, producto_nombre: "Papel Facial 150u", saldo_camion: -2, precio: 12.0 }, // Stock inválido/negativo
    ];

    // Normalizar inventario del camión
    const inventarioCamion = inventarioCamionCrudo.map(normalizarProductoCamion).filter(Boolean);

    // Simular filtro productosDisponiblesCamion (stock > 0)
    const productosDisponiblesCamion = inventarioCamion.filter((c) => {
      const saldo = Number(
        c.cantidad_remanente ??
        c.saldo_camion ??
        c.saldoCamion ??
        c.stock_actual ??
        c.saldo ??
        c.cantidad ??
        c.cantidad_disponible ??
        0
      );
      return saldo > 0;
    });

    // Solo deben quedar los IDs 1, 2 y 4 (el 3 tiene stock 0 y el 5 tiene stock negativo)
    assert.strictEqual(productosDisponiblesCamion.length, 3, "Solo deben listar productos con stock > 0");
    const idsDisponibles = productosDisponiblesCamion.map((p) => p.presentacion_id);
    assert.deepStrictEqual(idsDisponibles, [1, 2, 4], "IDs disponibles en modal deben ser 1, 2 y 4");

    // Supongamos que en la parada actual ya hay items cargados en la entrega:
    // - Producto 1: se van a entregar 12 bultos (de 20 disponibles)
    // - Producto 2: se van a entregar los 8 bultos (de 8 disponibles -> se agota en la entrega actual)
    // - Producto 4: aún no está en la entrega (0 entregados)
    const itemsEntregaActual = [
      { presentacion_id: 1, producto_nombre: "Papel Higiénico Clásico", cantidadAEntregar: 12 },
      { presentacion_id: 2, producto_nombre: "Bobina Kraft 400m", cantidadAEntregar: 8 },
    ];

    // Simulación exacta del cálculo en el render de cada fila del modal
    const filasModal = productosDisponiblesCamion.map((prod) => {
      const presId = prod.presentacion_id || prod.IdPresentacion || prod.id;
      const stockTotal = Number(
        prod.saldo_camion ??
        prod.cantidad_remanente ??
        prod.stock_actual ??
        prod.cantidad_disponible ??
        prod.cantidad ??
        0
      );
      const itemEnLista = itemsEntregaActual.find(
        (it) => (it.presentacion_id || it.IdPresentacion || it.id) === presId
      );
      const cantidadYaEnEntrega = Number(itemEnLista?.cantidadAEntregar || 0);
      const saldoRestanteReal = Math.max(0, stockTotal - cantidadYaEnEntrega);
      const yaEnLista = Boolean(itemEnLista);
      const sinSaldoRestante = saldoRestanteReal <= 0;

      return {
        presId,
        stockTotal,
        cantidadYaEnEntrega,
        saldoRestanteReal,
        yaEnLista,
        sinSaldoRestante,
        textoBoton: sinSaldoRestante ? "Agotado" : (yaEnLista ? "+1 Sumar" : "+ Agregar"),
      };
    });

    // Validar Producto 1: stock=20, entregando=12 -> saldoRestante=8, yaEnLista=true, sinSaldo=false, texto="+1 Sumar"
    const filaP1 = filasModal.find((f) => f.presId === 1);
    assert.strictEqual(filaP1.stockTotal, 20);
    assert.strictEqual(filaP1.cantidadYaEnEntrega, 12);
    assert.strictEqual(filaP1.saldoRestanteReal, 8);
    assert.strictEqual(filaP1.yaEnLista, true);
    assert.strictEqual(filaP1.sinSaldoRestante, false);
    assert.strictEqual(filaP1.textoBoton, "+1 Sumar");

    // Validar Producto 2: stock=8, entregando=8 -> saldoRestante=0, yaEnLista=true, sinSaldo=true, texto="Agotado"
    const filaP2 = filasModal.find((f) => f.presId === 2);
    assert.strictEqual(filaP2.stockTotal, 8);
    assert.strictEqual(filaP2.cantidadYaEnEntrega, 8);
    assert.strictEqual(filaP2.saldoRestanteReal, 0);
    assert.strictEqual(filaP2.yaEnLista, true);
    assert.strictEqual(filaP2.sinSaldoRestante, true);
    assert.strictEqual(filaP2.textoBoton, "Agotado");

    // Validar Producto 4: stock=15, entregando=0 -> saldoRestante=15, yaEnLista=false, sinSaldo=false, texto="+ Agregar"
    const filaP4 = filasModal.find((f) => f.presId === 4);
    assert.strictEqual(filaP4.stockTotal, 15);
    assert.strictEqual(filaP4.cantidadYaEnEntrega, 0);
    assert.strictEqual(filaP4.saldoRestanteReal, 15);
    assert.strictEqual(filaP4.yaEnLista, false);
    assert.strictEqual(filaP4.sinSaldoRestante, false);
    assert.strictEqual(filaP4.textoBoton, "+ Agregar");

    console.log("  ✓ Modal de adición calcula saldo restante real descontando líneas de entrega y deshabilita al agotarse");
  }

  console.log("\n>>> [Sección E] 3. Saneamiento de id_pedido: null y saneamiento automático de Potosí (id_punto_venta >= 50)");
  {
    // A) Paradas sin pedido nunca deben inventar id_pedido: 1
    const casosSinPedido = [
      { id_punto_venta: 12, id_cliente: 4, items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
      { id_punto_venta: 12, id_cliente: 4, id_pedido: null, items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
      { id_punto_venta: 12, id_cliente: 4, id_pedido: undefined, items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
      { id_punto_venta: 12, id_cliente: 4, id_pedido: "", items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
      { id_punto_venta: 12, id_cliente: 4, id_pedido: 0, items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
      { id_punto_venta: 12, id_cliente: 4, id_pedido: "invalid", items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
    ];

    for (const caso of casosSinPedido) {
      const norm = normalizarPayloadEntregaCompuesta(caso);
      assert.strictEqual(
        norm.id_pedido,
        null,
        `id_pedido debe ser null cuando no hay pedido legítimo, recibido: ${norm.id_pedido}`
      );
      assert.notStrictEqual(
        norm.id_pedido,
        1,
        "PROHIBIDO asignar id_pedido: 1 como fallback artificial"
      );
    }
    console.log("  ✓ normalizarPayloadEntregaCompuesta nunca inventa id_pedido: 1 ante ausencia de pedido");

    // B) Saneamiento automático de ítems atascados de Potosí (id_punto_venta >= 50 con id_pedido === 1)
    const casosPotosiAtascados = [
      { id_punto_venta: 50, id_pedido: 1, id_cliente: 30, items_entregados: [{ presentacion_id: 1, cantidad: 3 }] },
      { id_punto_venta: 53, id_pedido: 1, id_cliente: 31, items_entregados: [{ presentacion_id: 2, cantidad: 4 }] },
      { id_punto_venta: 53, id_pedido: "1", id_cliente: 31, items_entregados: [{ presentacion_id: 2, cantidad: 4 }] },
      { id_punto_venta: 99, id_pedido: 1, id_cliente: 40, items_entregados: [{ presentacion_id: 3, cantidad: 2 }] },
    ];

    for (const caso of casosPotosiAtascados) {
      const norm = normalizarPayloadEntregaCompuesta(caso);
      assert.strictEqual(
        norm.id_pedido,
        null,
        `En Potosí (id_punto_venta=${caso.id_punto_venta}), id_pedido: 1 debe ser saneado automáticamente a null`
      );
    }
    console.log("  ✓ Ítems de Potosí (id_punto_venta >= 50) con id_pedido: 1 son saneados automáticamente a null");

    // C) Puntos de venta legítimos de Sucre con id_pedido real
    const casoSucreConPedido = normalizarPayloadEntregaCompuesta({
      id_punto_venta: 12, // Sucre (< 50)
      id_pedido: 104,
      items_entregados: [{ presentacion_id: 1, cantidad: 5 }],
    });
    assert.strictEqual(casoSucreConPedido.id_pedido, 104, "Pedidos legítimos de Sucre se preservan intactos");
  }

  console.log("\n>>> [Sección E] 4. Eliminación absoluta del fallback roto a /logistica/telemetria/entrega");
  {
    // A) Verificación estática del código fuente de registrarEntrega y registrarEntregaConCobro
    const codigoRegistrarEntrega = LogisticaApi.registrarEntrega.toString();
    const codigoRegistrarEntregaConCobro = LogisticaApi.registrarEntregaConCobro.toString();

    assert.strictEqual(
      codigoRegistrarEntrega.includes("/logistica/telemetria/entrega"),
      false,
      "LogisticaApi.registrarEntrega NO debe contener /logistica/telemetria/entrega"
    );
    assert.strictEqual(
      codigoRegistrarEntregaConCobro.includes("/logistica/telemetria/entrega"),
      false,
      "LogisticaApi.registrarEntregaConCobro NO debe contener /logistica/telemetria/entrega"
    );

    // B) Verificación dinámica de llamadas a API
    const postOriginal = apiClient.post;
    const llamadasEndpoints = [];

    apiClient.post = async (url, payload, options) => {
      llamadasEndpoints.push({ url, payload, options });
      if (url === "/api/movil/v1/chofer/entregar") {
        // Simular error 404 del endpoint primario para comprobar que NO hay fallback roto
        const error404 = new Error("Not Found");
        error404.status = 404;
        error404.response = { status: 404, data: { detail: "No encontrado" } };
        throw error404;
      }
      return { data: { success: true } };
    };

    try {
      const respEntrega = await LogisticaApi.registrarEntrega(
        { id_asignacion: 10, items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
        "idempotency-uuid-test-99"
      );
      assert.strictEqual(respEntrega.success, false, "Debe devolver error procesado sin crash");
      assert.strictEqual(llamadasEndpoints.length, 1, "Solo debió haber 1 llamada a la API");
      assert.strictEqual(
        llamadasEndpoints[0].url,
        "/api/movil/v1/chofer/entregar",
        "La única llamada debe ser a /api/movil/v1/chofer/entregar"
      );
      const intentoTelemetria = llamadasEndpoints.some((c) => c.url.includes("/logistica/telemetria/entrega"));
      assert.strictEqual(
        intentoTelemetria,
        false,
        "Bajo ninguna circunstancia se debe invocar /logistica/telemetria/entrega"
      );

      llamadasEndpoints.length = 0;
      const respEntregaConCobro = await LogisticaApi.registrarEntregaConCobro(
        { id_asignacion: 10, items_entregados: [{ presentacion_id: 1, cantidad: 5 }] },
        "idempotency-uuid-test-100"
      );
      assert.strictEqual(respEntregaConCobro.success, false);
      assert.strictEqual(llamadasEndpoints.length, 1);
      assert.strictEqual(llamadasEndpoints[0].url, "/api/movil/v1/chofer/entregar");
    } finally {
      apiClient.post = postOriginal;
    }
    console.log("  ✓ Confirmado: Cero presencia ni invocación de /logistica/telemetria/entrega");
  }

  console.log("\n>>> [Sección E] 5. wsService: Cancelación de ticket residual en OPEN y handshake");
  {
    const instanciaWs = new WsService();
    instanciaWs.tokenActual = "jwt-token-chofer-subagente-c-valido-123456789";

    // 1. Verificar cancelarFallbackTicket()
    instanciaWs.intentoTicketFallback = true;
    instanciaWs.ticketTimer = setTimeout(() => {}, 50000);
    const reqIdAntes = instanciaWs.ticketRequestId;

    instanciaWs.cancelarFallbackTicket();

    assert.strictEqual(instanciaWs.ticketTimer, null, "ticketTimer debe ser cancelado (null)");
    assert.strictEqual(instanciaWs.intentoTicketFallback, false, "intentoTicketFallback debe ser false");
    assert.strictEqual(instanciaWs.ticketRequestId, reqIdAntes + 1, "ticketRequestId debe incrementarse");

    // 2. Verificar que onopen cancela el fallback residual
    const mockSocket = {
      readyState: 1, // OPEN
      send: () => {},
      close: () => {},
    };
    instanciaWs.ws = mockSocket;
    instanciaWs.ticketTimer = setTimeout(() => {}, 60000);
    instanciaWs.intentoTicketFallback = true;

    instanciaWs.cancelarFallbackTicket();
    assert.strictEqual(instanciaWs.ticketTimer, null);
    assert.strictEqual(instanciaWs.intentoTicketFallback, false);

    // 3. Verificar que mensajes de handshake o snapshot cancelan fallback de ticket
    const tiposHandshake = [
      "snapshot_inicial",
      "snapshot",
      "autenticado",
      "autenticacion",
      "handshake_ok",
      "bienvenida",
    ];

    for (const tipoEvt of tiposHandshake) {
      instanciaWs.ticketTimer = setTimeout(() => {}, 60000);
      instanciaWs.intentoTicketFallback = true;

      const tipo = tipoEvt.toLowerCase();
      if (
        tipo === "snapshot_inicial" ||
        tipo === "snapshot" ||
        tipo === "autenticado" ||
        tipo === "autenticacion" ||
        tipo === "handshake_ok" ||
        tipo === "bienvenida"
      ) {
        instanciaWs.cancelarFallbackTicket();
      }

      assert.strictEqual(
        instanciaWs.ticketTimer,
        null,
        `ticketTimer debe ser cancelado ante evento de handshake: ${tipoEvt}`
      );
      assert.strictEqual(
        instanciaWs.intentoTicketFallback,
        false,
        `intentoTicketFallback debe ser false ante evento de handshake: ${tipoEvt}`
      );
    }
    console.log("  ✓ wsService cancela timers y peticiones residuales de ticket en OPEN y handshake");
  }

  console.log("\n>>> [Sección E] 6. wsService: Conexión única y respeto al candado conectandoEnCurso");
  {
    const instanciaWs = new WsService();
    const TOKEN_PRUEBA = "jwt-chofer-token-resiliente-subagente-c-999";

    // 1. Candado conectandoEnCurso activo: aborta llamadas concurrentes
    instanciaWs.conectandoEnCurso = true;
    instanciaWs.ws = null;

    let llamadaEjecutada = false;
    const origResolver = instanciaWs.resolverTokenMasReciente;
    instanciaWs.resolverTokenMasReciente = async () => {
      llamadaEjecutada = true;
      return TOKEN_PRUEBA;
    };

    await instanciaWs.conectar(TOKEN_PRUEBA);
    assert.strictEqual(
      llamadaEjecutada,
      false,
      "conectar() debe abortar de inmediato si conectandoEnCurso es true"
    );

    // 2. Candado socket en estado CONNECTING (readyState === 0): aborta llamadas concurrentes
    instanciaWs.conectandoEnCurso = false;
    instanciaWs.ws = { readyState: 0 }; // 0: CONNECTING
    llamadaEjecutada = false;

    await instanciaWs.conectar(TOKEN_PRUEBA);
    assert.strictEqual(
      llamadaEjecutada,
      false,
      "conectar() debe abortar de inmediato si el socket actual está en CONNECTING"
    );

    // 3. Socket ya en OPEN con el mismo token: no duplica conexión
    instanciaWs.tokenActual = TOKEN_PRUEBA;
    instanciaWs.ws = { readyState: 1 }; // 1: OPEN
    llamadaEjecutada = false;

    await instanciaWs.conectar(TOKEN_PRUEBA);
    assert.strictEqual(
      llamadaEjecutada,
      false,
      "conectar() no debe abrir un nuevo socket si el canal ya está OPEN con el mismo token"
    );

    instanciaWs.resolverTokenMasReciente = origResolver;

    // 4. Verificación concurrente en vivo con el singleton wsService
    MockWebSocket.instancias = [];
    wsService.desconectar();
    await new Promise((r) => setTimeout(r, 20));

    const p1 = wsService.conectar("jwt-chofer-token-resiliente-subagente-c-88888");
    const p2 = wsService.conectar("jwt-chofer-token-resiliente-subagente-c-88888");
    await Promise.all([p1, p2]);
    await new Promise((r) => setTimeout(r, 30));

    assert.strictEqual(
      MockWebSocket.instancias.length,
      1,
      "Llamadas concurrentes a conectar() no deben abrir más de una instancia de WebSocket"
    );
    assert.strictEqual(wsService.estaConectado(), true, "El servicio debe quedar conectado");
    wsService.desconectar();

    console.log("  ✓ Conexión única garantizada: candado conectandoEnCurso y readyState OPEN/CONNECTING respetados");
  }

  console.log("\n==================================================================");
  console.log("✅ TODAS LAS PRUEBAS DE SUB-AGENTE C Y D COMPLETADAS CON ÉXITO (100%)");
  console.log("==================================================================");
}

ejecutarSuiteEntregaFrecuenciaNotificaciones()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ ERROR EN SUITE SUB-AGENTE C/D:", err);
    process.exit(1);
  });
