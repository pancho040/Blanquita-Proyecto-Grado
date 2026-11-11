// Blanquita-Mobile/tests/test_pantallas_react_test_renderer.test.js
// Montaje y Renderizado de Pantallas Operativas Chofer Móvil con react-test-renderer (Punto 4 - Fase 2.1)

global.__DEV__ = true;

const Module = require("module");
const originalLoad = Module._load;
const React = require("react");

// Mock canónico de primitivas de React Native
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
    get: (_dim) => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
    addEventListener: () => ({ remove: () => {} }),
  },
  PanResponder: {
    create: () => ({ panHandlers: {} }),
  },
  Animated: {
    Value: class { constructor(v) { this.v = v; } setValue(v) { this.v = v; } interpolate() { return this; } },
    ValueXY: class {
      constructor(v) { this.x = v?.x || 0; this.y = v?.y || 0; }
      setValue(v) { this.x = v.x; this.y = v.y; }
      getTranslateTransform() { return [{ translateX: this.x }, { translateY: this.y }]; }
      getLayout() { return { left: this.x, top: this.y }; }
    },
    timing: () => ({ start: (cb) => cb && cb() }),
    spring: () => ({ start: (cb) => cb && cb() }),
    event: () => () => {},
    View: mockComponent("Animated.View"),
  },
  Alert: {
    alert: (_title, _msg, buttons) => {},
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

// Mock contextos
const mockParada = {
  id: 101,
  IdPuntoVenta: 101,
  NombrePuntoVenta: "Abarrotes Don Pepe",
  NombreCliente: "José Choque",
  Direccion: "Av. Las Delicias #120, Sucre",
  Latitud: -19.0483,
  Longitud: -65.2598,
  secuencia: 1,
  estado: "PENDIENTE",
  cliente: {
    nombre_comercial: "Abarrotes Don Pepe",
    razon_social: "José Choque",
    saldo_pendiente: 150.0,
    telefono: "71234567",
  },
};

const mockPedido = {
  id: 201,
  IdPedido: 201,
  monto_total: 450.0,
  MontoTotal: 450.0,
  items: [
    {
      presentacion_id: 1,
      nombre_producto: "Papel Higiénico Blanquita Blanco Doble Hoja",
      cantidad: 10,
      precio_unitario: 45.0,
      es_bandeo: false,
    },
    {
      presentacion_id: 2,
      nombre_producto: "Servilletas Blanquita Mesa 100u (Cortesía)",
      cantidad: 2,
      precio_unitario: 0.0,
      es_bandeo: true,
      valor_bandeo: 2.0,
    },
  ],
};

const mockContexts = {
  auth: {
    user: { id: 7, nombre: "Juan Repartidor", rol: "repartidor", sucursal_id: 1 },
    token: "fake-token-test",
    isAuthenticated: true,
    loading: false,
  },
  ruta: {
    hojaRuta: {
      id: 50,
      paradas: [mockParada],
    },
    metricas: {
      paradas_totales: 5,
      paradas_completadas: 2,
      total_efectivo: 350.0,
      total_qr: 100.0,
    },
    asignacionActiva: { id: 50, estado: "En Ruta" },
    cargarRutaDelDia: async () => {},
    registrarEntrega: async () => ({ success: true }),
    registrarCobro: async () => ({ success: true }),
    registrarNoEntrega: async () => ({ success: true }),
    cerrarComprobante: () => {},
    comprobanteActual: null,
    ultimaSincronizacion: new Date(),
  },
  location: {
    location: {
      latitude: -19.0483,
      longitude: -65.2598,
      accuracy: 5,
      coords: { latitude: -19.0483, longitude: -65.2598 },
    },
    getCurrentCoords: async () => ({ latitude: -19.0483, longitude: -65.2598 }),
  },
  network: {
    isOnline: true,
    syncInProgress: false,
    forzarSincronizacion: async () => {},
  },
  notificaciones: {
    notificaciones: [],
    conteoNoLeidas: 0,
  },
};

// Registrar extensiones de assets binarios para Node.js
['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].forEach((ext) => {
  require.extensions[ext] = (module, filename) => {
    module.exports = 1;
  };
});

Module._load = function (request, parent, isMain) {
  if (request.endsWith(".webp") || request.endsWith(".png") || request.endsWith(".jpg") || request.endsWith(".jpeg") || request.endsWith(".svg")) {
    return 1;
  }
  if (request === "@react-native-async-storage/async-storage") {
    return {
      getItem: async () => null,
      setItem: async () => true,
      removeItem: async () => true,
    };
  }
  if (request === "react-native" || request.startsWith("react-native/")) {
    return reactNativeMock;
  }
  if (request === "lucide-react-native") {
    return lucideMock;
  }
  if (request === "react-native-svg") {
    return svgMock;
  }
  if (request === "@react-navigation/native") {
    return {
      useNavigation: () => mockNavigation,
      useRoute: () => ({ params: {} }),
      useFocusEffect: (cb) => { cb(); },
    };
  }
  if (request.includes("react-native-safe-area-context")) {
    return {
      SafeAreaView: mockComponent("SafeAreaView"),
      SafeAreaProvider: mockComponent("SafeAreaProvider"),
      useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
  }
  if (request.includes("react-native-screens")) {
    return {
      enableScreens: () => {},
    };
  }
  if (request.includes("expo-location")) {
    return {
      getCurrentPositionAsync: async () => ({ coords: { latitude: -19.04, longitude: -65.25 } }),
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    };
  }
  if (request.includes("expo-secure-store")) {
    return {
      setItemAsync: async () => {},
      getItemAsync: async () => "fake-token",
      deleteItemAsync: async () => {},
    };
  }
  if (request.includes("secureStorage")) {
    return {
      SecureStorage: {
        guardarToken: async () => {},
        obtenerToken: async () => "fake-token",
        eliminarToken: async () => {},
      },
    };
  }
  if (request.includes("netinfo")) {
    return {
      addEventListener: () => () => {},
      fetch: async () => ({ isConnected: true, isInternetReachable: true }),
    };
  }
  if (request.includes("AuthContext")) return { useAuth: () => mockContexts.auth };
  if (request.includes("RutaContext")) return { useRuta: () => mockContexts.ruta };
  if (request.includes("LocationContext")) return { useLocation: () => mockContexts.location };
  if (request.includes("NetworkContext")) return { useNetwork: () => mockContexts.network };
  if (request.includes("NotificacionesContext")) return { useNotificaciones: () => mockContexts.notificaciones };
  if (request.includes("logisticaApi")) {
    return {
      LogisticaApi: {
        obtenerMiInventarioCamion: async () => [
          { presentacion_id: 1, nombre_presentacion: "Papel Higiénico 24u", stock_camion: 20, bandeo: false }
        ],
        registrarEntrega: async () => ({ success: true }),
        registrarCobro: async () => ({ success: true }),
        subirArchivoComprobante: async () => ({ success: true, idComprobante: 1 }),
        registrarCierreTurno: async () => ({ success: true }),
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

require("@babel/register")({
  presets: ["babel-preset-expo"],
  ignore: [/node_modules/],
});

const assert = require("assert");
const renderer = require("react-test-renderer");

const { HojaRutaScreen } = require("../src/screens/Ruta/HojaRutaScreen");
const { DetalleParadaScreen } = require("../src/screens/Ruta/DetalleParadaScreen");
const { RegistrarEntregaScreen } = require("../src/screens/Ruta/RegistrarEntregaScreen");
const { RegistrarCobroScreen } = require("../src/screens/Ruta/RegistrarCobroScreen");
const { CierreRutaScreen } = require("../src/screens/Cierre/CierreRutaScreen");

console.log("=== INICIANDO PRUEBAS DE RENDERIZADO DE PANTALLAS (REACT-TEST-RENDERER) ===");

// 1. HojaRutaScreen
console.log("\n>>> Test 1: Renderizado HojaRutaScreen");
let treeRuta;
assert.doesNotThrow(() => {
  treeRuta = renderer.create(
    React.createElement(HojaRutaScreen, { navigation: mockNavigation })
  );
}, "HojaRutaScreen debe renderizar sin excepciones");
assert.ok(treeRuta.toJSON(), "HojaRutaScreen debe generar un árbol de renderizado");
console.log("  ✓ HojaRutaScreen renderizada correctamente");

// 2. DetalleParadaScreen
console.log("\n>>> Test 2: Renderizado DetalleParadaScreen");
let treeDetalle;
assert.doesNotThrow(() => {
  treeDetalle = renderer.create(
    React.createElement(DetalleParadaScreen, {
      navigation: mockNavigation,
      route: { params: { parada: mockParada, pedido: mockPedido } },
    })
  );
}, "DetalleParadaScreen debe renderizar sin excepciones");
assert.ok(treeDetalle.toJSON(), "DetalleParadaScreen debe generar un árbol de renderizado");
console.log("  ✓ DetalleParadaScreen renderizada correctamente");

// 3. RegistrarEntregaScreen
console.log("\n>>> Test 3: Renderizado RegistrarEntregaScreen");
let treeEntrega;
assert.doesNotThrow(() => {
  treeEntrega = renderer.create(
    React.createElement(RegistrarEntregaScreen, {
      navigation: mockNavigation,
      route: { params: { parada: mockParada, pedido: mockPedido } },
    })
  );
}, "RegistrarEntregaScreen debe renderizar sin excepciones");
assert.ok(treeEntrega.toJSON(), "RegistrarEntregaScreen debe generar un árbol de renderizado");
console.log("  ✓ RegistrarEntregaScreen renderizada correctamente");

// 4. RegistrarCobroScreen
console.log("\n>>> Test 4: Renderizado RegistrarCobroScreen");
let treeCobro;
assert.doesNotThrow(() => {
  treeCobro = renderer.create(
    React.createElement(RegistrarCobroScreen, {
      navigation: mockNavigation,
      route: { params: { parada: mockParada, cliente: mockParada.cliente, pedido: mockPedido } },
    })
  );
}, "RegistrarCobroScreen debe renderizar sin excepciones");
assert.ok(treeCobro.toJSON(), "RegistrarCobroScreen debe generar un árbol de renderizado");
console.log("  ✓ RegistrarCobroScreen renderizada correctamente");

// 5. CierreRutaScreen
console.log("\n>>> Test 5: Renderizado CierreRutaScreen");
let treeCierre;
assert.doesNotThrow(() => {
  treeCierre = renderer.create(
    React.createElement(CierreRutaScreen, { navigation: mockNavigation })
  );
}, "CierreRutaScreen debe renderizar sin excepciones");
assert.ok(treeCierre.toJSON(), "CierreRutaScreen debe generar un árbol de renderizado");
console.log("  ✓ CierreRutaScreen renderizada correctamente");

console.log("\n=======================================================");
console.log("ÉXITO: Las 5 pantallas operativas renderizan sin fallos con react-test-renderer.");
console.log("=======================================================\n");

process.exit(0);
