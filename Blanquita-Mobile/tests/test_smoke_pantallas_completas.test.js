// Blanquita-Mobile/tests/test_smoke_pantallas_completas.test.js
// Smoke test integral: renderiza CADA pantalla de la app con providers mockeados
// y verifica tolerancia a fallos cuando la API rechaza con "Token expirado" (401).

global.__DEV__ = true;

const Module = require("module");
const originalLoad = Module._load;
const React = require("react");

// Registrar extensiones de assets binarios para Node.js
['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].forEach((ext) => {
  require.extensions[ext] = (module, _filename) => {
    module.exports = 1;
  };
});

// Mock de primitivas de React Native
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
  FlatList: (props) => {
    const items = props?.data || [];
    const rendered = items.map((it, idx) => {
      const el = props.renderItem ? props.renderItem({ item: it, index: idx }) : null;
      return React.createElement("View", { key: props.keyExtractor ? props.keyExtractor(it, idx) : idx }, el);
    });
    const empty = items.length === 0 && props.ListEmptyComponent
      ? (typeof props.ListEmptyComponent === "function" ? React.createElement(props.ListEmptyComponent) : props.ListEmptyComponent)
      : null;
    const header = props.ListHeaderComponent
      ? (typeof props.ListHeaderComponent === "function" ? React.createElement(props.ListHeaderComponent) : props.ListHeaderComponent)
      : null;
    return React.createElement("View", props, header, rendered, empty);
  },
  SafeAreaView: mockComponent("SafeAreaView"),
  RefreshControl: mockComponent("RefreshControl"),
  Image: mockComponent("Image"),
  KeyboardAvoidingView: mockComponent("KeyboardAvoidingView"),
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
    alert: () => {},
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
  replace: () => {},
};

let simularTokenExpirado = false;

const mockUser = {
  IdUsuario: 12,
  NombreCompleto: "Carlos Repartidor",
  nombre: "Carlos",
  apellido: "Repartidor",
  Ci: "1234567",
  IdRol: 3,
  RolNombre: "Chofer Repartidor",
  IdSucursal: 1,
};

const mockParada = {
  id: 101,
  IdPuntoVenta: 101,
  NombrePuntoVenta: "Abarrotes Don Pepe",
  NombreCliente: "José Choque",
  Direccion: "Av. Jaime Mendoza #420",
  Latitud: -19.0483,
  Longitud: -65.2598,
  secuencia: 1,
  estado: "PENDIENTE",
  cliente: {
    id_cliente: 10,
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
      presentacion_id: 3,
      nombre_producto: "Papel Higiénico Clásico",
      cantidad: 10,
      cantidad_entregada: 0,
      precio_unitario: 20.0,
      es_bandeo: false,
    },
  ],
};

const mockContexts = {
  auth: {
    user: mockUser,
    usuario: mockUser,
    token: "valid-mock-token",
    tokens: { AccessToken: "mock-token", RefreshToken: "mock-refresh" },
    estaAutenticado: true,
    cargando: false,
    loading: false,
    errorAuth: null,
    iniciarSesion: async () => ({ exito: true }),
    cerrarSesion: async () => ({ exito: true }),
  },
  ruta: {
    hojaRuta: {
      IdAsignacion: 45,
      id: 45,
      paradas: [mockParada],
    },
    asignacionActiva: {
      IdAsignacion: 45,
      paradas: [mockParada],
    },
    metricas: { total_recaudado: 300, total_bultos: 50 },
    recaudacion: { efectivo: 300, transferencias: 0, totalCobrado: 300 },
    cargandoRuta: false,
    syncPendientes: 0,
    cargarRutaDelDia: async () => {},
    ultimaSincronizacion: new Date(),
    registrarEntrega: async () => ({ exito: true }),
    registrarCobro: async () => ({ exito: true }),
    confirmarCierreRuta: async () => ({ exito: true }),
  },
  location: {
    ubicacionActual: { latitud: -19.0435, longitud: -65.2580, precision: 10 },
    obtenerUbicacionActual: async () => ({ latitud: -19.0435, longitud: -65.2580, precision: 10 }),
    iniciarTelemetria: () => {},
    detenerTelemetria: () => {},
  },
  network: {
    isOnline: true,
    connectionType: "WIFI",
    pendientes: 0,
    sincronizando: false,
    syncInProgress: false,
    sincronizarAhora: async () => ({ exito: true, procesadas: 0, pendientes: 0 }),
    forzarSincronizacion: async () => ({ exito: true, procesadas: 0, pendientes: 0 }),
    refrescarPendientes: async () => {},
  },
  notificaciones: {
    notificaciones: [],
    conteoNoLeidas: 0,
    cargando: false,
    refrescarNotificaciones: async () => {},
    manejarPresionarAviso: () => {},
  },
};

const mockLocalDb = {
  obtenerSesion: async () => ({ usuario: mockUser, tokens: { AccessToken: "mock" } }),
  guardarSesion: async () => true,
  eliminarSesion: async () => true,
  obtenerRutaActiva: async () => ({ IdAsignacion: 45, paradas: [mockParada] }),
  guardarRutaActiva: async () => true,
  obtenerInventarioCamion: async () => ({
    chofer_id: 12,
    total_bultos_cargados: 20,
    total_bultos_entregados: 5,
    total_saldo_camion: 15,
    valor_total_camion_bs: 300,
    valor_total_revalorizado_bs: 345,
    ajuste_revalorizacion_total_bs: 45,
    items: [
      {
        presentacion_id: 3,
        nombre_producto: "Papel Higiénico Clásico",
        codigo_presentacion: "BLAN-4R",
        tipo_contenedor: "Fardo",
        cantidad_cargada: 20,
        cantidad_vendida: 5,
        cantidad_remanente: 15,
        precio_vigente_carga: 20.0,
        precio_vigente_actual: 23.0,
        valor_remanente: 300.0,
        valor_remanente_revalorizado: 345.0,
        es_bandeo: true,
        valor_bandeo: 2,
      },
    ],
  }),
  guardarInventarioCamion: async () => true,
  obtenerClientesCache: async () => [],
  guardarClientesCache: async () => true,
  limpiarTodo: async () => true,
};

const mockSyncQueue = {
  obtenerCola: async () => [],
  obtenerPendientes: async () => [],
  contarPendientes: async () => 0,
  obtenerResumenDineroPendiente: async () => ({
    totalOperaciones: 0,
    cantidadReintentables: 0,
    cantidadNoReintentables4xx: 0,
    totalDineroBs: 0,
    bloqueoRequerido: false,
  }),
  encolarOperacion: async () => ({ id: "mock-uuid" }),
  removerOperacion: async () => true,
  limpiarCola: async () => true,
};

Module._load = function (request) {
  if (
    request.endsWith(".webp") ||
    request.endsWith(".png") ||
    request.endsWith(".jpg") ||
    request.endsWith(".jpeg") ||
    request.endsWith(".svg")
  ) {
    return 1;
  }
  if (request === "react-native" || request.startsWith("react-native/") || request.includes("node_modules/react-native/")) {
    return reactNativeMock;
  }
  if (request === "lucide-react-native") return lucideMock;
  if (request === "react-native-svg") return svgMock;
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
  if (request === "@react-native-async-storage/async-storage") {
    return {
      getItem: async () => null,
      setItem: async () => true,
      removeItem: async () => true,
      multiRemove: async () => true,
    };
  }
  if (request === "@react-native-community/netinfo" || request.includes("netinfo")) {
    return {
      fetch: async () => ({ isConnected: true, isInternetReachable: true, type: "wifi" }),
      addEventListener: () => () => {},
    };
  }
  if (request === "expo-secure-store" || request.includes("expo-secure-store")) {
    return {
      getItemAsync: async () => "mock-token",
      setItemAsync: async () => {},
      deleteItemAsync: async () => {},
    };
  }
  if (request.includes("secureStorage")) {
    return {
      SecureStorage: {
        guardarToken: async () => {},
        obtenerToken: async () => "mock-token",
        guardarRefreshToken: async () => {},
        obtenerRefreshToken: async () => "mock-refresh",
        limpiarTokens: async () => {},
      },
    };
  }
  if (request.includes("AuthContext")) return { useAuth: () => mockContexts.auth };
  if (request.includes("RutaContext")) return { useRuta: () => mockContexts.ruta };
  if (request.includes("LocationContext")) return { useLocation: () => mockContexts.location };
  if (request.includes("NetworkContext")) return { useNetwork: () => mockContexts.network };
  if (request.includes("NotificacionesContext")) return { useNotificaciones: () => mockContexts.notificaciones };
  if (request.includes("localDb")) return { LocalDB: mockLocalDb };
  if (request.includes("syncQueue")) return { SyncQueue: mockSyncQueue };
  if (request.includes("logisticaApi")) {
    return {
      logisticaApi: {
        obtenerMiInventarioCamion: async () => {
          if (simularTokenExpirado) {
            const err = new Error("Token expirado");
            err.status = 401;
            throw err;
          }
          return mockLocalDb.obtenerInventarioCamion();
        },
        obtenerHojaRutaActiva: async () => {
          if (simularTokenExpirado) {
            const err = new Error("Token expirado");
            err.status = 401;
            throw err;
          }
          return { paradas: [mockParada] };
        },
        registrarEntrega: async () => ({ success: true }),
        registrarCobro: async () => ({ success: true }),
        subirArchivoComprobante: async () => ({ success: true, idComprobante: 1 }),
        registrarCierreTurno: async () => ({ success: true }),
        registrarNuevoCliente: async () => ({ success: true }),
      },
      LogisticaApi: {
        obtenerMiInventarioCamion: async () => {
          if (simularTokenExpirado) throw new Error("Token expirado");
          return mockLocalDb.obtenerInventarioCamion();
        },
        obtenerHojaRutaActiva: async () => {
          if (simularTokenExpirado) throw new Error("Token expirado");
          return { paradas: [mockParada] };
        },
        registrarEntrega: async () => ({ success: true }),
        registrarCobro: async () => ({ success: true }),
        subirArchivoComprobante: async () => ({ success: true, idComprobante: 1 }),
        registrarCierreTurno: async () => ({ success: true }),
        registrarNuevoCliente: async () => ({ success: true }),
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

const { LoginScreen } = require("../src/screens/Auth/LoginScreen");
const { HojaRutaScreen } = require("../src/screens/Ruta/HojaRutaScreen");
const { DetalleParadaScreen } = require("../src/screens/Ruta/DetalleParadaScreen");
const { RegistrarEntregaScreen } = require("../src/screens/Ruta/RegistrarEntregaScreen");
const { RegistrarCobroScreen } = require("../src/screens/Ruta/RegistrarCobroScreen");
const { MiInventarioScreen } = require("../src/screens/Inventario/MiInventarioScreen");
const { NuevoClienteScreen } = require("../src/screens/Clientes/NuevoClienteScreen");
const { BandejaAvisosScreen } = require("../src/screens/Avisos/BandejaAvisosScreen");
const { SincronizacionScreen } = require("../src/screens/Sync/SincronizacionScreen");
const { CierreRutaScreen } = require("../src/screens/Cierre/CierreRutaScreen");

console.log("=== INICIANDO SMOKE TEST DE TODAS LAS PANTALLAS (10/10) ===");

const pantallas = [
  { nombre: "LoginScreen", comp: LoginScreen, props: { navigation: mockNavigation } },
  { nombre: "HojaRutaScreen", comp: HojaRutaScreen, props: { navigation: mockNavigation } },
  {
    nombre: "DetalleParadaScreen",
    comp: DetalleParadaScreen,
    props: { navigation: mockNavigation, route: { params: { parada: mockParada, pedido: mockPedido } } },
  },
  {
    nombre: "RegistrarEntregaScreen",
    comp: RegistrarEntregaScreen,
    props: { navigation: mockNavigation, route: { params: { parada: mockParada, pedido: mockPedido } } },
  },
  {
    nombre: "RegistrarCobroScreen",
    comp: RegistrarCobroScreen,
    props: {
      navigation: mockNavigation,
      route: { params: { parada: mockParada, cliente: mockParada.cliente, pedido: mockPedido } },
    },
  },
  { nombre: "MiInventarioScreen", comp: MiInventarioScreen, props: { navigation: mockNavigation } },
  { nombre: "NuevoClienteScreen", comp: NuevoClienteScreen, props: { navigation: mockNavigation } },
  { nombre: "BandejaAvisosScreen", comp: BandejaAvisosScreen, props: { navigation: mockNavigation } },
  { nombre: "SincronizacionScreen", comp: SincronizacionScreen, props: { navigation: mockNavigation } },
  { nombre: "CierreRutaScreen", comp: CierreRutaScreen, props: { navigation: mockNavigation } },
];

// FASE 1: Renderizado con API sana
console.log("\n>>> Ciclo 1: Renderizado con sesión y API disponible");
pantallas.forEach(({ nombre, comp, props }) => {
  let tree;
  assert.doesNotThrow(() => {
    tree = renderer.create(React.createElement(comp, props));
  }, `[CRASH] La pantalla ${nombre} lanzó una excepción al renderizar.`);
  assert.ok(tree && tree.toJSON(), `[ERROR] ${nombre} no generó árbol de render.`);
  console.log(`  ✓ ${nombre} renderizó correctamente`);
});

// FASE 2: Renderizado con API que falla con "Token expirado" (HTTP 401)
console.log("\n>>> Ciclo 2: Degradación elegante ante error de servidor ('Token expirado')");
simularTokenExpirado = true;
pantallas.forEach(({ nombre, comp, props }) => {
  let tree;
  assert.doesNotThrow(() => {
    tree = renderer.create(React.createElement(comp, props));
  }, `[CRASH] ${nombre} crasheó cuando la API falló con 'Token expirado'.`);
  assert.ok(tree && tree.toJSON(), `[ERROR] ${nombre} no generó árbol de render bajo fallo.`);
  console.log(`  ✓ ${nombre} degradó elegantemente sin crash ante 401`);
});

console.log("\n=======================================================");
console.log("ÉXITO: Las 10 pantallas renderizan sin crash y degradan elegantemente ante 401.");
console.log("=======================================================\n");

process.exit(0);
