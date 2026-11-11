// Blanquita-Mobile/tests/test_fase3_pantallas_y_cliente.test.js
// Montaje y validación unitaria de pantallas Fase 3 Chofer Móvil con react-test-renderer

global.__DEV__ = true;

const Module = require("module");
const originalLoad = Module._load;
const React = require("react");

// Mock canónico de primitivas React Native
const mockComponent = (name) => {
  const comp = (props) => React.createElement(name, props, props?.children);
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
  FlatList: mockComponent("FlatList"),
  SafeAreaView: mockComponent("SafeAreaView"),
  RefreshControl: mockComponent("RefreshControl"),
  Image: mockComponent("Image"),
  Dimensions: {
    get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  },
  Alert: {
    alert: (_title, _msg, _buttons) => {},
  },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (styles) => (Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean)) : styles || {}),
  },
  Platform: {
    OS: "android",
    select: (obj) => obj.android || obj.default,
  },
};

const lucideMock = new Proxy({}, {
  get: (_target, prop) => mockComponent(`Lucide_${String(prop)}`),
});

const svgMock = new Proxy({}, {
  get: (_target, prop) => mockComponent(`Svg_${String(prop)}`),
});

const mockNavigation = {
  navigate: () => {},
  goBack: () => {},
  setOptions: () => {},
};

const mockContexts = {
  auth: {
    user: { id: 7, nombre: "Juan Chofer", rol: "repartidor", sucursal_id: 1 },
    token: "token-fase3-test",
    isAuthenticated: true,
  },
  ruta: {
    asignacionActiva: { IdAsignacion: 7, IdRutaDistribucion: 10 },
    registrarNuevoCliente: async (_payload) => ({ success: true, exito: true }),
    syncPendientes: 2,
  },
  location: {
    location: null, // Simula interiores sin satélite
    getCurrentCoords: async () => {},
  },
  notificaciones: {
    notificaciones: [
      {
        id: 1,
        tipo: "ABONO_APROBADO",
        titulo: "Cobro QR Aprobado",
        mensaje: "El cobro QR por Bs. 450.00 fue validado por Kevin.",
        leido: false,
        fecha_creacion: new Date().toISOString(),
      },
      {
        id: 2,
        tipo: "ABONO_RECHAZADO",
        titulo: "Cobro QR Observado",
        mensaje: "El comprobante no coincide. Motivo: Comprobante ilegible",
        leido: false,
        fecha_creacion: new Date().toISOString(),
      },
      {
        id: 3,
        tipo: "STOCK_ACTUALIZADO",
        titulo: "Revalorización de Mercadería",
        mensaje: "Se actualizaron los costos de lote en almacén.",
        leido: true,
        fecha_creacion: new Date().toISOString(),
      },
    ],
    conteoNoLeidas: 2,
    cargando: false,
    refrescarNotificaciones: async () => {},
    manejarPresionarAviso: async () => {},
  },
  network: {
    isOnline: true,
    connectionType: "WIFI",
    syncInProgress: false,
    forzarSincronizacion: async () => ({ exitosos: 1, fallidos: 0 }),
  },
};

// Interceptor de dependencias
Module._load = function (request, parent, isMain) {
  if (
    request.endsWith(".webp") ||
    request.endsWith(".png") ||
    request.endsWith(".jpg") ||
    request.endsWith(".jpeg") ||
    request.endsWith(".svg")
  ) {
    return 1;
  }
  if (request === "@react-navigation/native" || request.startsWith("@react-navigation/")) {
    return {
      useNavigation: () => mockNavigation,
      useRoute: () => ({ params: {} }),
      useFocusEffect: (cb) => { cb && cb(); },
    };
  }
  if (request === "react-native" || request.startsWith("react-native/")) return reactNativeMock;
  if (request === "react-native-svg") return svgMock;
  if (request === "lucide-react-native") return lucideMock;
  if (request === "@react-native-community/netinfo") {
    return {
      addEventListener: () => () => {},
      fetch: async () => ({ isConnected: true, type: "wifi" }),
    };
  }
  if (request === "@react-native-async-storage/async-storage") {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
      clear: async () => {},
    };
  }
  if (request.includes("RutaContext")) {
    return { useRuta: () => mockContexts.ruta };
  }
  if (request.includes("LocationContext")) {
    return { useLocation: () => mockContexts.location };
  }
  if (request.includes("AuthContext")) {
    return { useAuth: () => mockContexts.auth };
  }
  if (request.includes("NotificacionesContext")) {
    return { useNotificaciones: () => mockContexts.notificaciones };
  }
  if (request.includes("NetworkContext")) {
    return { useNetwork: () => mockContexts.network };
  }
  if (request.includes("syncQueue")) {
    return {
      SyncQueue: {
        obtenerPendientes: async () => [
          {
            id: 1,
            tipo: "ALTA_CLIENTE",
            timestamp: Date.now(),
            reintentos: 0,
            ultimoError: null,
            payload: { razon_social: "Doña Elena" },
          },
          {
            id: 2,
            tipo: "COBRO",
            timestamp: Date.now(),
            reintentos: 1,
            ultimoError: "422: El método QR exige comprobante fotográfico.",
            payload: { id_pedido: 101 },
          },
        ],
        encolarOperacion: async () => ({ id: 3 }),
      },
    };
  }

  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const renderer = require("react-test-renderer");

const safeStringify = (obj) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return;
      seen.add(value);
    }
    return value;
  });
};

let testsEjecutados = 0;
let testsPasados = 0;

function assert(condition, message) {
  testsEjecutados++;
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  testsPasados++;
  console.log(`  [OK] ${message}`);
}

console.log("==================================================================");
console.log("  TEST FASE 3: MONTAJE DE PANTALLAS Y ALTA DE CLIENTE MÓVIL       ");
console.log("==================================================================\n");

// 1. Test NuevoClienteScreen
try {
  const { NuevoClienteScreen } = require("../src/screens/Clientes/NuevoClienteScreen");
  let component;
  renderer.act(() => {
    component = renderer.create(React.createElement(NuevoClienteScreen, { navigation: mockNavigation }));
  });
  const json = component.toJSON();
  assert(json !== null, "NuevoClienteScreen se renderiza correctamente con react-test-renderer");

  const str = safeStringify(json);
  assert(str.includes("Nuevo Cliente"), "NuevoClienteScreen contiene título principal");
  assert(str.includes("Punto GPS del Negocio"), "NuevoClienteScreen contiene sección GPS");
  assert(str.includes("Continuar sin señal GPS precisa"), "NuevoClienteScreen ofrece fallback para interiores/sótanos");
  assert(str.includes("Guardar Cliente"), "NuevoClienteScreen contiene botón de guardado accesible");
} catch (err) {
  console.error("Error en test de NuevoClienteScreen:", err);
}

// 2. Test BandejaAvisosScreen
try {
  const { BandejaAvisosScreen } = require("../src/screens/Avisos/BandejaAvisosScreen");
  let component;
  renderer.act(() => {
    component = renderer.create(React.createElement(BandejaAvisosScreen, { navigation: mockNavigation }));
  });
  const json = component.toJSON();
  assert(json !== null, "BandejaAvisosScreen se renderiza correctamente con react-test-renderer");

  const str = safeStringify(json);
  assert(str.includes("Bandeja de Avisos"), "BandejaAvisosScreen contiene encabezado");
  assert(str.includes("avisos pendientes de lectura"), "BandejaAvisosScreen renderiza subtítulo con conteo de no leídos");
} catch (err) {
  console.error("Error en test de BandejaAvisosScreen:", err);
}

// 3. Test SincronizacionScreen
try {
  const { SincronizacionScreen } = require("../src/screens/Sync/SincronizacionScreen");
  let component;
  renderer.act(() => {
    component = renderer.create(React.createElement(SincronizacionScreen, { navigation: mockNavigation }));
  });
  const json = component.toJSON();
  assert(json !== null, "SincronizacionScreen se renderiza correctamente con react-test-renderer");

  const str = safeStringify(json);
  assert(str.includes("Sincronización"), "SincronizacionScreen contiene encabezado");
  assert(str.includes("Almacén Local de Operaciones"), "SincronizacionScreen contiene tarjeta de almacén");
  assert(str.includes("Detalle de Operaciones"), "SincronizacionScreen incluye desglose de operaciones");
} catch (err) {
  console.error("Error en test de SincronizacionScreen:", err);
}

console.log("\n==================================================================");
console.log(`RESULTADO SUITE FASE 3 MÓVIL: ${testsPasados}/${testsEjecutados} assertions pasadas.`);
console.log("==================================================================\n");

if (testsPasados === testsEjecutados && testsEjecutados > 0) {
  process.exit(0);
} else {
  process.exit(1);
}
