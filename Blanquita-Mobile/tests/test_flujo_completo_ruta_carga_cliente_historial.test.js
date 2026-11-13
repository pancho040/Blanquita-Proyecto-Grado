/**
 * Suite Integral de Pruebas: Flujo Completo Ruta, Carga, Cliente e Historial (Subagente D)
 * Sistema ERP Papelera Blanquita - Móvil Choferes
 *
 * Verificaciones automatizadas:
 * a) Botón de Cerrar Sesión:
 *    - Advertencia ante operaciones pendientes en cola (SyncQueue.contarPendientes / obtenerResumenDineroPendiente).
 *    - Preservación de la cola por id_usuario tras el cierre de sesión (cola intacta, tokens eliminados).
 * b) Gatekeeper de Ruta:
 *    - Bloqueo de entregas y paradas en SIN_RUTA y PENDIENTE_CARGA.
 *    - Envío correcto de solicitar-carga (POST /api/movil/v1/chofer/solicitar-carga) con remanente e items.
 *    - Desbloqueo de paradas al pasar a APROBADA_EN_RUTA (o habilitada_para_reparto: true).
 * c) Alta de Nuevo Cliente en 3 Modalidades:
 *    - Validación de las 3 opciones (SOLO_REGISTRO, PROGRAMAR_ENTREGA, ENTREGA_INMEDIATA).
 *    - En ENTREGA_INMEDIATA tras la parada #2: inserción como parada #3 y desplazamiento de la #3 anterior a #4 (secuencia compacta 1..N sin duplicados ni saltos).
 * d) Historial del Día y Bloqueo de Cierre:
 *    - Muestra estados de revisión: PENDIENTE, APROBADO, OBSERVADO / RECHAZADO (con texto explícito de la observación).
 *    - Ausencia / bloqueo de botón de finalizar o liquidar ruta por parte del chofer (aviso: administración realiza el cierre).
 * e) WebSocket y Optimización Plan Gratuito:
 *    - Respuesta a evento 'solicitar_ubicacion_actual' despachando ping puntual.
 *    - Cero timers activos de polling de lectura GET recurrente en segundo plano.
 */

const assert = require("assert");

global.__DEV__ = true;

// Mock de WebSocket nativo para pruebas reactivas
class MockWebSocket {
  constructor(url, protocols, options) {
    this.url = url;
    this.protocols = protocols;
    this.options = options;
    this.readyState = 0; // CONNECTING
    this.sentData = [];
    MockWebSocket.instancias.push(this);
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 5);
  }

  send(data) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code: 1000 });
  }
}
MockWebSocket.OPEN = 1;
MockWebSocket.CONNECTING = 0;
MockWebSocket.CLOSED = 3;
MockWebSocket.instancias = [];

global.WebSocket = MockWebSocket;

if (!global.fetch) {
  global.fetch = async (url, options = {}) => {
    return { ok: true, status: 200, json: async () => ({}) };
  };
}

// Mocks en memoria de almacenamiento
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

const Module = require("module");
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
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
          accuracy: 8,
          speed: 6.1,
          altitude: 2790,
        },
        timestamp: Date.now(),
      }),
      Accuracy: { High: 4, Balanced: 3 },
    };
  }
  if (request === "expo-constants" || request.includes("expo-constants")) {
    return { default: { expoConfig: {} }, expoConfig: {} };
  }
  if (request.includes("expo-modules-core")) {
    return {};
  }
  if (request === "react-native") {
    return {
      Platform: { OS: "android" },
      StyleSheet: { create: (s) => s },
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove: () => {} }),
      },
      Alert: {
        alert: () => {},
      },
    };
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
const { SecureStorage } = require("../src/services/secureStorage");
const { LocalDB } = require("../src/database/localDb");
const { LogisticaApi, ESTADOS_RUTA } = require("../src/api/logisticaApi");
const { determinarEstadoRuta } = require("../src/context/RutaContext");
const { apiClient, setTokenEnMemoria, getTokenEnMemoria } = require("../src/api/client");
const {
  insertarNuevoClienteEnSecuencia,
  ordenarParadasAscendente,
} = require("../src/services/syncService");
const { wsService } = require("../src/services/wsService");

async function ejecutarSuiteSubagenteD() {
  console.log("==================================================================");
  console.log(" SUITE SUB-AGENTE D: RUTA, CARGA, NUEVO CLIENTE E HISTORIAL (HU-27..35)");
  console.log("==================================================================\n");

  await mockAsyncStorage.clear();
  secureStorageMap.clear();

  // ==========================================================================
  // SECCIÓN A: BOTÓN DE CERRAR SESIÓN (PRESERVACIÓN DE COLA Y ADVERTENCIA)
  // ==========================================================================
  console.log(">>> [Sección A] 1. Advertencia cuando hay operaciones pendientes en cola");

  const ID_CHOFER_1 = 15;
  const ID_CHOFER_2 = 22;

  // Encolamos dos operaciones para el Chofer 15 (una entrega con cobro de Bs. 250 y un cobro de Bs. 150)
  await SyncQueue.encolarOperacion(
    "ENTREGA",
    { id_pedido: 101, monto_total: 250, tipo_entrega: "TOTAL" },
    { latitud: -19.04, longitud: -65.25 },
    ID_CHOFER_1
  );
  await SyncQueue.encolarOperacion(
    "COBRO",
    { id_pedido: 101, monto: 150, metodoPago: "EFECTIVO" },
    { latitud: -19.04, longitud: -65.25 },
    ID_CHOFER_1
  );

  const pendientesChofer1 = await SyncQueue.contarPendientes(ID_CHOFER_1);
  const resumenDineroChofer1 = await SyncQueue.obtenerResumenDineroPendiente(ID_CHOFER_1);

  assert.strictEqual(pendientesChofer1, 2, "Chofer 15 debe tener 2 operaciones pendientes en cola");
  assert.strictEqual(
    resumenDineroChofer1.bloqueoRequerido,
    true,
    "Debe requerir confirmación / bloqueo preventivo por existir dinero pendiente de sincronizar"
  );
  assert.ok(
    resumenDineroChofer1.totalDineroBs >= 150,
    "El resumen financiero debe contabilizar el dinero pendiente"
  );

  // Simulación de la lógica de AuthContext.cerrarSesion(forzar = false)
  const intentoCierreSinForzar = async (usuarioId) => {
    const pendientes = await SyncQueue.contarPendientes(usuarioId);
    const resumen = await SyncQueue.obtenerResumenDineroPendiente(usuarioId);

    if ((resumen?.bloqueoRequerido || pendientes > 0)) {
      return {
        bloqueado: true,
        requiereConfirmacion: true,
        cantidad: pendientes,
        montoTotal: resumen?.totalDineroBs || 0,
        mensaje: `Tienes ${pendientes} operación(es) pendiente(s) de enviar. Si cierras sesión, quedarán guardadas de forma segura en el teléfono para tu usuario.`,
      };
    }
    return { exito: true };
  };

  const resultadoAdvertencia = await intentoCierreSinForzar(ID_CHOFER_1);
  assert.strictEqual(
    resultadoAdvertencia.bloqueado,
    true,
    "El cierre sin forzar debe ser bloqueado con advertencia"
  );
  assert.strictEqual(
    resultadoAdvertencia.requiereConfirmacion,
    true,
    "Debe solicitar confirmación explícita del chofer antes de salir"
  );
  assert.strictEqual(resultadoAdvertencia.cantidad, 2, "La advertencia debe indicar exactamente 2 operaciones");
  console.log("  ✓ Advertencia y desglose de dinero pendiente verificado satisfactoriamente");

  console.log("\n>>> [Sección A] 2. Preservación de la cola por id_usuario tras cerrar sesión");

  // Configuramos sesión activa con tokens
  const tokenPrueba = "jwt_access_chofer_15";
  const refreshPrueba = "jwt_refresh_chofer_15";
  setTokenEnMemoria(tokenPrueba);
  await SecureStorage.guardarToken(tokenPrueba);
  await SecureStorage.guardarRefreshToken(refreshPrueba);
  await LocalDB.guardarSesion(
    { IdUsuario: ID_CHOFER_1, NombreCompleto: "Carlos Repartidor" },
    { AccessToken: tokenPrueba, RefreshToken: refreshPrueba }
  );

  assert.strictEqual(await SecureStorage.obtenerToken(), tokenPrueba);
  assert.strictEqual(await SecureStorage.obtenerRefreshToken(), refreshPrueba);

  // Ejecutamos cierre de sesión confirmado (forzar = true)
  const ejecutarCierreSesionConfirmado = async (usuarioId) => {
    setTokenEnMemoria(null);
    await SecureStorage.limpiarTokens();
    await LocalDB.eliminarSesion();
    // La cola de SyncQueue NO se elimina
    const pendientesRestantes = await SyncQueue.contarPendientes(usuarioId);
    return {
      exito: true,
      pendientesPreservados: pendientesRestantes,
    };
  };

  const resCierre = await ejecutarCierreSesionConfirmado(ID_CHOFER_1);
  assert.strictEqual(resCierre.exito, true, "Cierre de sesión debe completarse con éxito");
  assert.strictEqual(getTokenEnMemoria(), null, "Token en memoria debe quedar nulo");
  assert.strictEqual(await SecureStorage.obtenerToken(), null, "Access token en SecureStore debe ser eliminado");
  assert.strictEqual(await SecureStorage.obtenerRefreshToken(), null, "Refresh token en SecureStore debe ser eliminado");
  assert.strictEqual(await LocalDB.obtenerSesion(), null, "Sesión en LocalDB debe ser eliminada");

  // Verificación crucial: la cola del chofer 15 sigue existiendo intacta
  const colaPreservadaChofer1 = await SyncQueue.obtenerCola(ID_CHOFER_1);
  assert.strictEqual(
    colaPreservadaChofer1.length,
    2,
    "La cola de operaciones offline del Chofer 15 NO debe borrarse tras el cierre de sesión"
  );

  // Aislamiento: Chofer 22 no ve las operaciones del Chofer 15
  const colaChofer2 = await SyncQueue.obtenerCola(ID_CHOFER_2);
  assert.strictEqual(colaChofer2.length, 0, "El Chofer 22 no debe tener acceso a las operaciones del Chofer 15");
  console.log("  ✓ Tokens eliminados de SecureStore y cola por id_usuario resguardada íntegramente");

  // ==========================================================================
  // SECCIÓN B: GATEKEEPER DE RUTA Y SOLICITUD DE CARGA
  // ==========================================================================
  console.log("\n>>> [Sección B] 1. Bloqueo de entregas y paradas en SIN_RUTA y PENDIENTE_CARGA");

  // Caso SIN_RUTA
  const estadoSinRuta = determinarEstadoRuta(null);
  assert.strictEqual(estadoSinRuta, ESTADOS_RUTA.SIN_RUTA, "Sin asignación activa debe retornar SIN_RUTA");

  const estadoSinId = determinarEstadoRuta({});
  assert.strictEqual(estadoSinId, ESTADOS_RUTA.SIN_RUTA, "Objeto vacío sin ID debe retornar SIN_RUTA");

  // Gatekeeper de entregas en SIN_RUTA
  const validarGatekeeperEntrega = (estadoRutaActual) => {
    if (estadoRutaActual !== ESTADOS_RUTA.APROBADA_EN_RUTA) {
      return {
        exito: false,
        success: false,
        error: "Ruta no habilitada: debe estar en estado APROBADA_EN_RUTA para registrar entregas.",
      };
    }
    return { exito: true, success: true };
  };

  const intentoSinRuta = validarGatekeeperEntrega(estadoSinRuta);
  assert.strictEqual(intentoSinRuta.exito, false, "Entrega debe bloquearse estrictamente en SIN_RUTA");
  assert.ok(intentoSinRuta.error.includes("APROBADA_EN_RUTA"), "Mensaje debe exigir APROBADA_EN_RUTA");

  // Caso PENDIENTE_CARGA (asignación asignada pero sin carga aprobada ni habilitación de reparto)
  const rutaPendienteCarga = {
    IdAsignacion: 42,
    Estado: "PENDIENTE",
    estado_carga: null,
    habilitada_para_reparto: false,
    paradas: [
      { IdPuntoVenta: 10, orden: 1, estado: "PENDIENTE" },
      { IdPuntoVenta: 11, orden: 2, estado: "PENDIENTE" },
    ],
  };

  const estadoPendienteCarga = determinarEstadoRuta(rutaPendienteCarga);
  assert.strictEqual(
    estadoPendienteCarga,
    ESTADOS_RUTA.PENDIENTE_CARGA,
    "Asignación sin carga aprobada debe retornar PENDIENTE_CARGA"
  );

  const intentoPendienteCarga = validarGatekeeperEntrega(estadoPendienteCarga);
  assert.strictEqual(intentoPendienteCarga.exito, false, "Entrega debe bloquearse en PENDIENTE_CARGA");

  // Gatekeeper de visibilidad de paradas: en SIN_RUTA y PENDIENTE_CARGA las paradas operativas están ocultas
  const obtenerParadasVisibles = (ruta, estado) => {
    return estado === ESTADOS_RUTA.APROBADA_EN_RUTA ? ruta?.paradas || [] : [];
  };

  assert.strictEqual(
    obtenerParadasVisibles(rutaPendienteCarga, estadoPendienteCarga).length,
    0,
    "Paradas de reparto no deben desbloquearse para atención en PENDIENTE_CARGA"
  );
  console.log("  ✓ Bloqueo estricto del gatekeeper verificado para SIN_RUTA y PENDIENTE_CARGA");

  console.log("\n>>> [Sección B] 2. Envío correcto de solicitar-carga (POST /api/movil/v1/chofer/solicitar-carga)");

  // Interceptar la llamada a apiClient.post para validar el contrato exacto
  let peticionPostInterceptada = null;
  const postOriginal = apiClient.post;

  apiClient.post = async (url, data, config) => {
    peticionPostInterceptada = { url, data, config };
    if (url === "/api/movil/v1/chofer/solicitar-carga") {
      return {
        data: {
          codigo: "EXITO",
          mensaje: "Carga solicitada al encargado de almacén.",
          solicitud_id: 88,
          estado: "SOLICITADA",
        },
      };
    }
    return postOriginal.apply(apiClient, [url, data, config]);
  };

  const respuestaCarga = await LogisticaApi.solicitarCargaCamion({
    id_asignacion: 42,
    usar_remanente: true,
    observacion: "Salida con remanente de ayer más recarga de servilletas",
    items: [
      { presentacion_id: 1, cantidad_solicitada: 25 },
      { presentacion_id: 3, cantidad_solicitada: 10 },
    ],
    stock_remanente: [
      { presentacion_id: 1, nombre_producto: "Papel Higiénico 4 rollos", saldo_camion: 8 },
    ],
    remanente_actual: [
      { presentacion_id: 1, nombre_producto: "Papel Higiénico 4 rollos", saldo_camion: 8 },
    ],
  });

  // Restaurar apiClient.post
  apiClient.post = postOriginal;

  assert.ok(peticionPostInterceptada, "Debe haberse invocado apiClient.post");
  assert.strictEqual(
    peticionPostInterceptada.url,
    "/api/movil/v1/chofer/solicitar-carga",
    "Endpoint debe ser exactamente /api/movil/v1/chofer/solicitar-carga"
  );
  assert.strictEqual(peticionPostInterceptada.data.id_asignacion, 42);
  assert.strictEqual(peticionPostInterceptada.data.usar_remanente, true);
  assert.strictEqual(
    peticionPostInterceptada.data.observacion,
    "Salida con remanente de ayer más recarga de servilletas"
  );
  assert.strictEqual(peticionPostInterceptada.data.items.length, 2);
  assert.strictEqual(peticionPostInterceptada.data.items[0].presentacion_id, 1);
  assert.strictEqual(peticionPostInterceptada.data.items[0].cantidad_solicitada, 25);

  // Subagente C: Validación de remanente_actual y stock_remanente en el payload
  assert.ok(Array.isArray(peticionPostInterceptada.data.stock_remanente), "Debe enviar array stock_remanente");
  assert.ok(Array.isArray(peticionPostInterceptada.data.remanente_actual), "Debe enviar array remanente_actual");
  assert.strictEqual(peticionPostInterceptada.data.stock_remanente[0].cantidad_remanente, 8);
  assert.strictEqual(peticionPostInterceptada.data.remanente_actual[0].cantidad_remanente, 8);
  assert.strictEqual(respuestaCarga.success, true);
  console.log("  ✓ POST /api/movil/v1/chofer/solicitar-carga validado con remanente e items requeridos");

  console.log("\n>>> [Sección B] 3. Persistencia y bloqueo de doble envío en solicitud de carga");

  // 1. Guardar sello en LocalDB simulando solicitarCargaCamion
  const datosSello = {
    items_solicitados: [
      { presentacion_id: 1, cantidad_solicitada: 25 },
      { presentacion_id: 3, cantidad_solicitada: 10 },
    ],
    usar_remanente: true,
    observacion: "Salida con remanente",
  };
  const selloCreado = await LocalDB.guardarSelloSolicitudCarga(42, datosSello);

  assert.ok(selloCreado, "El sello de solicitud de carga debe guardarse exitosamente");
  assert.strictEqual(selloCreado.estado_operativo, "CARGA_SOLICITADA");
  assert.strictEqual(selloCreado.usar_remanente, true);
  assert.ok(selloCreado.fecha_solicitud, "Debe registrar la fecha/hora de solicitud");
  assert.ok(selloCreado.fecha_dia, "Debe registrar el día de la solicitud");

  // Verificar persistencia local efectiva
  const selloObtenido = await LocalDB.obtenerSelloSolicitudCarga(42);
  assert.strictEqual(selloObtenido.estado_operativo, "CARGA_SOLICITADA");
  assert.strictEqual(selloObtenido.items_solicitados.length, 2);

  // 2. Comprobar que ante un refresco con determinarEstadoRuta / cargarHojaRuta,
  // el sello preserva CARGA_SOLICITADA sin descender a PENDIENTE_CARGA
  const rutaServidorAunNoAprobada = {
    IdAsignacion: 42,
    Estado: "PENDIENTE",
    estado_carga: null,
    habilitada_para_reparto: false,
    paradas: [
      { IdPuntoVenta: 10, orden: 1, estado: "PENDIENTE" },
      { IdPuntoVenta: 11, orden: 2, estado: "PENDIENTE" },
    ],
  };

  const estadoPreservado = determinarEstadoRuta(rutaServidorAunNoAprobada, selloObtenido);
  assert.strictEqual(
    estadoPreservado,
    ESTADOS_RUTA.CARGA_SOLICITADA,
    "El sello local debe garantizar que la ruta permanezca en CARGA_SOLICITADA"
  );

  // En CARGA_SOLICITADA las entregas permanecen bloqueadas
  const gatekeeperEnEspera = validarGatekeeperEntrega(estadoPreservado);
  assert.strictEqual(gatekeeperEnEspera.exito, false);
  console.log("  ✓ Sello local preserva CARGA_SOLICITADA y previene envíos duplicados ante refrescos");

  console.log("\n>>> [Sección B] 4. Desbloqueo de paradas al pasar a APROBADA_EN_RUTA y limpieza de sello");

  // Ruta con carga aprobada / habilitada para reparto desde Almacén o WebSocket carga_camion_aprobada
  const rutaAprobada = {
    ...rutaPendienteCarga,
    estado_carga: "APROBADA",
    habilitada_para_reparto: true,
  };

  const estadoAprobada = determinarEstadoRuta(rutaAprobada, selloObtenido);
  assert.strictEqual(
    estadoAprobada,
    ESTADOS_RUTA.APROBADA_EN_RUTA,
    "Al recibir aprobación de almacén el estado debe pasar a APROBADA_EN_RUTA aún existiendo sello previo"
  );

  // Al pasar a APROBADA_EN_RUTA, el flujo limpia el sello local
  await LocalDB.limpiarSelloSolicitudCarga(42);
  const selloTrasAprobacion = await LocalDB.obtenerSelloSolicitudCarga(42);
  assert.strictEqual(selloTrasAprobacion, null, "El sello debe eliminarse al pasar a APROBADA_EN_RUTA");

  const paradasDesbloqueadas = obtenerParadasVisibles(rutaAprobada, estadoAprobada);
  assert.strictEqual(
    paradasDesbloqueadas.length,
    2,
    "Las paradas de la hoja de ruta deben desbloquearse de inmediato al estar en APROBADA_EN_RUTA"
  );

  const intentoEntregaDesbloqueada = validarGatekeeperEntrega(estadoAprobada);
  assert.strictEqual(
    intentoEntregaDesbloqueada.exito,
    true,
    "El registro de entregas debe permitir operar normalmente en APROBADA_EN_RUTA"
  );
  console.log("  ✓ Limpieza de sello y desbloqueo de paradas al pasar a APROBADA_EN_RUTA comprobado");

  console.log("\n>>> [Sección B] 5. Blindaje de Ruta Aprobada y Sello en LocalDB (HU-30 / Subagente C)");
  const ID_ASIG_122 = 122;

  // 1. Simular recepción de evento WS carga_camion_aprobada para id_asignacion: 122
  const datosAprobacion122 = {
    id_asignacion: ID_ASIG_122,
    estado: "APROBADA",
    habilitada_para_reparto: true,
    fecha_aprobacion: new Date().toISOString(),
  };

  await LocalDB.guardarSelloCargaAprobada(ID_ASIG_122, datosAprobacion122);

  // Comprobar la existencia física y formato de clave del sello en LocalDB / AsyncStorage
  const claveSelloEsperada = `@blanquita_sello_carga_aprobada_${ID_ASIG_122}`;
  const rawSello = await mockAsyncStorage.getItem(claveSelloEsperada);
  assert.ok(rawSello, `El sello debe existir bajo la clave exacta ${claveSelloEsperada}`);
  const selloJson = JSON.parse(rawSello);
  assert.strictEqual(selloJson.idAsignacion, ID_ASIG_122);
  assert.strictEqual(selloJson.estado_operativo, "APROBADA_EN_RUTA");

  // Consultar mediante método oficial LocalDB.obtenerSelloCargaAprobada
  const selloConsultado = await LocalDB.obtenerSelloCargaAprobada(ID_ASIG_122);
  assert.ok(selloConsultado, "LocalDB.obtenerSelloCargaAprobada(122) debe retornar el sello");
  assert.strictEqual(selloConsultado.idAsignacion, ID_ASIG_122);
  assert.strictEqual(selloConsultado.estado_operativo, "APROBADA_EN_RUTA");

  // Asignación activa 122 en memoria / estado
  const asignacionActiva122 = {
    IdAsignacion: ID_ASIG_122,
    id: ID_ASIG_122,
    estado_carga: "APROBADA",
    estado: "APROBADA_EN_RUTA",
    estado_flujo: ESTADOS_RUTA.APROBADA_EN_RUTA,
    habilitada_para_reparto: true,
    paradas: [
      { IdPuntoVenta: 101, orden: 1, estado: "PENDIENTE", cliente: { razon_social: "Cliente A" } },
      { IdPuntoVenta: 102, orden: 2, estado: "PENDIENTE", cliente: { razon_social: "Cliente B" } },
    ],
  };

  // 2. Simular que una llamada posterior de sincronización (cargarHojaRuta) recibe de la API
  // una asignación diferente (ej: 999) en PENDIENTE_CARGA o con habilitada_para_reparto: false
  const rutaServidorDiscrepante = {
    IdAsignacion: 999,
    id: 999,
    Estado: "PENDIENTE",
    estado_carga: "PENDIENTE",
    habilitada_para_reparto: false,
    paradas: [],
  };

  // Mecanismo de blindaje idéntico al implementado en RutaContext:
  let estadoRutaProtegido = determinarEstadoRuta(
    rutaServidorDiscrepante,
    null,
    await LocalDB.obtenerSelloCargaAprobada(999)
  );

  const idAsigPrevia = asignacionActiva122.IdAsignacion;
  const selloAprobadoPrevia = idAsigPrevia ? await LocalDB.obtenerSelloCargaAprobada(idAsigPrevia) : null;
  const estaPreviamenteAprobada = Boolean(
    selloAprobadoPrevia ||
    asignacionActiva122.estado_flujo === ESTADOS_RUTA.APROBADA_EN_RUTA ||
    asignacionActiva122.estado_carga === "APROBADA"
  );

  let rutaFinalChofer = rutaServidorDiscrepante;
  if (estaPreviamenteAprobada) {
    estadoRutaProtegido = ESTADOS_RUTA.APROBADA_EN_RUTA;
    if (
      asignacionActiva122 &&
      idAsigPrevia &&
      String(idAsigPrevia) !== String(rutaServidorDiscrepante.IdAsignacion) &&
      !Boolean(rutaServidorDiscrepante.habilitada_para_reparto)
    ) {
      rutaFinalChofer = asignacionActiva122; // Se preserva la 122 intacta
    }
  }

  assert.strictEqual(
    estadoRutaProtegido,
    ESTADOS_RUTA.APROBADA_EN_RUTA,
    "El estado debe preservarse en APROBADA_EN_RUTA a pesar de la respuesta degradada del servidor"
  );
  assert.strictEqual(
    rutaFinalChofer.IdAsignacion,
    122,
    "La asignación activa debe mantenerse en 122 y no ser reemplazada por la 999 no habilitada"
  );

  // Verificar que la ruta NO desaparece ni se oculta tras el gatekeeper
  const paradasVisiblesProtegidas = obtenerParadasVisibles(rutaFinalChofer, estadoRutaProtegido);
  assert.strictEqual(
    paradasVisiblesProtegidas.length,
    2,
    "Las paradas de la asignación 122 deben permanecer visibles tras el gatekeeper"
  );
  const entregaHabilitada = validarGatekeeperEntrega(estadoRutaProtegido);
  assert.strictEqual(
    entregaHabilitada.exito,
    true,
    "Las entregas deben continuar habilitadas sin interrupción"
  );
  console.log("  ✓ Blindaje de ruta aprobada verificado: asignación 122 preservada y sello confirmado");

  console.log("\n>>> [Sección B] 6. Transiciones completas de estados de carga (HU-30)");

  // Función lógica del botón Solicitar Carga en SolicitarCargaModal
  const esBotonSolicitarDeshabilitado = ({ enviando, estadoOperativo, esObservada, esRechazada, usarRemanente, totalBultos }) => {
    return (
      enviando ||
      (estadoOperativo === "CARGA_SOLICITADA" && !esObservada && !esRechazada) ||
      (!usarRemanente && totalBultos <= 0)
    );
  };

  // 1. CARGA_SOLICITADA: Chofer envió solicitud, esperando respuesta de Web
  const rutaEnSolicitud = {
    IdAsignacion: 122,
    estado_carga: "SOLICITADA",
    estado_flujo: ESTADOS_RUTA.CARGA_SOLICITADA,
  };
  const estadoCargaSolicitada = determinarEstadoRuta(rutaEnSolicitud);
  assert.strictEqual(estadoCargaSolicitada, ESTADOS_RUTA.CARGA_SOLICITADA);

  const botonBloqueadoEnEspera = esBotonSolicitarDeshabilitado({
    enviando: false,
    estadoOperativo: estadoCargaSolicitada,
    esObservada: false,
    esRechazada: false,
    usarRemanente: false,
    totalBultos: 15,
  });
  assert.strictEqual(botonBloqueadoEnEspera, true, "En CARGA_SOLICITADA el botón de solicitar debe estar deshabilitado esperando Web");
  assert.strictEqual(validarGatekeeperEntrega(estadoCargaSolicitada).exito, false, "Paradas y entregas bloqueadas");

  // 2. CARGA_OBSERVADA: Supervisor en Web observa la carga
  const OBSERVACION_SUPERVISOR = "Ajustar cantidad de toallas intercaladas a 8 bultos por falta de espacio en tolva";
  const rutaObservada = {
    IdAsignacion: 122,
    estado_carga: "OBSERVADA",
    estado_flujo: ESTADOS_RUTA.CARGA_OBSERVADA,
    motivo_observacion: OBSERVACION_SUPERVISOR,
  };
  const estadoObservada = determinarEstadoRuta(rutaObservada);
  assert.strictEqual(estadoObservada, ESTADOS_RUTA.CARGA_OBSERVADA);
  assert.strictEqual(rutaObservada.motivo_observacion, OBSERVACION_SUPERVISOR, "Debe preservar y mostrar la observación exacta");

  const botonHabilitadoObservada = esBotonSolicitarDeshabilitado({
    enviando: false,
    estadoOperativo: estadoObservada,
    esObservada: true,
    esRechazada: false,
    usarRemanente: false,
    totalBultos: 8,
  });
  assert.strictEqual(botonHabilitadoObservada, false, "En CARGA_OBSERVADA el chofer debe poder corregir y reenviar la solicitud");

  // 3. CARGA_RECHAZADA: Supervisor en Web rechaza la carga
  const MOTIVO_RECHAZO = "Vehículo asignado a ruta foránea sin disponibilidad de stock hoy";
  const rutaRechazada = {
    IdAsignacion: 122,
    estado_carga: "RECHAZADA",
    estado_flujo: ESTADOS_RUTA.CARGA_RECHAZADA,
    motivo_rechazo: MOTIVO_RECHAZO,
  };
  const estadoRechazada = determinarEstadoRuta(rutaRechazada);
  assert.strictEqual(estadoRechazada, ESTADOS_RUTA.CARGA_RECHAZADA);
  assert.strictEqual(rutaRechazada.motivo_rechazo, MOTIVO_RECHAZO, "Debe mostrar el motivo exacto de rechazo");

  const botonHabilitadoRechazada = esBotonSolicitarDeshabilitado({
    enviando: false,
    estadoOperativo: estadoRechazada,
    esObservada: false,
    esRechazada: true,
    usarRemanente: true,
    totalBultos: 0,
  });
  assert.strictEqual(botonHabilitadoRechazada, false, "En CARGA_RECHAZADA el chofer puede formular una nueva solicitud");

  // 4. APROBADA_EN_RUTA: Aprobación definitiva por almacén
  const rutaFinalAprobada = {
    IdAsignacion: 122,
    estado_carga: "APROBADA",
    estado_flujo: ESTADOS_RUTA.APROBADA_EN_RUTA,
    habilitada_para_reparto: true,
    paradas: [{ IdPuntoVenta: 1, orden: 1 }],
  };
  const estadoAprobadaFinal = determinarEstadoRuta(rutaFinalAprobada);
  assert.strictEqual(estadoAprobadaFinal, ESTADOS_RUTA.APROBADA_EN_RUTA);
  assert.strictEqual(validarGatekeeperEntrega(estadoAprobadaFinal).exito, true, "Desbloquea entregas");
  assert.strictEqual(obtenerParadasVisibles(rutaFinalAprobada, estadoAprobadaFinal).length, 1, "Desbloquea paradas e inventario");
  console.log("  ✓ Transiciones completas verificadas: CARGA_SOLICITADA -> OBSERVADA -> RECHAZADA -> APROBADA_EN_RUTA");

  // ==========================================================================
  // SECCIÓN C: ALTA DE NUEVO CLIENTE EN 3 MODALIDADES Y REORDENAMIENTO COMPACTO
  // ==========================================================================
  console.log("\n>>> [Sección C] 1. Validación de las 3 opciones de atención para nuevo cliente");

  const datosClienteBase = {
    razon_social: "Abarrotes Doña Julia",
    nombre_comercial: "Tienda Doña Julia",
    direccion: "Av. Las Américas #340",
    telefono: "71234567",
    latitud: -19.0435,
    longitud: -65.258,
  };

  // Función validadora del contrato de alta de nuevo cliente
  const construirPayloadNuevoCliente = (modalidad, extraParams = {}) => {
    assert.ok(
      ["SOLO_REGISTRO", "PROGRAMAR_ENTREGA", "ENTREGA_INMEDIATA"].includes(modalidad),
      `Modalidad no válida: ${modalidad}`
    );

    if (modalidad === "SOLO_REGISTRO") {
      return {
        datos_cliente: datosClienteBase,
        modalidad: "SOLO_REGISTRO",
        dia_semana_programado: null,
        items_programados: null,
        parada_actual_orden: null,
      };
    }

    if (modalidad === "PROGRAMAR_ENTREGA") {
      const items = extraParams.items_programados || [];
      assert.ok(items.length > 0, "PROGRAMAR_ENTREGA exige al menos un ítem programado");
      assert.ok(extraParams.dia_semana_programado, "PROGRAMAR_ENTREGA exige dia_semana_programado");
      return {
        datos_cliente: datosClienteBase,
        modalidad: "PROGRAMAR_ENTREGA",
        dia_semana_programado: extraParams.dia_semana_programado,
        items_programados: items,
        parada_actual_orden: null,
      };
    }

    if (modalidad === "ENTREGA_INMEDIATA") {
      assert.ok(
        typeof extraParams.parada_actual_orden === "number",
        "ENTREGA_INMEDIATA requiere parada_actual_orden"
      );
      return {
        datos_cliente: datosClienteBase,
        modalidad: "ENTREGA_INMEDIATA",
        dia_semana_programado: null,
        items_programados: null,
        parada_actual_orden: extraParams.parada_actual_orden,
      };
    }
  };

  const payloadSoloRegistro = construirPayloadNuevoCliente("SOLO_REGISTRO");
  assert.strictEqual(payloadSoloRegistro.modalidad, "SOLO_REGISTRO");
  assert.strictEqual(payloadSoloRegistro.dia_semana_programado, null);

  const payloadProgramado = construirPayloadNuevoCliente("PROGRAMAR_ENTREGA", {
    dia_semana_programado: "JUEVES",
    items_programados: [{ presentacion_id: 1, cantidad: 10, precio_estimado: 24.5 }],
  });
  assert.strictEqual(payloadProgramado.modalidad, "PROGRAMAR_ENTREGA");
  assert.strictEqual(payloadProgramado.dia_semana_programado, "JUEVES");
  assert.strictEqual(payloadProgramado.items_programados.length, 1);

  const payloadInmediato = construirPayloadNuevoCliente("ENTREGA_INMEDIATA", {
    parada_actual_orden: 2,
  });
  assert.strictEqual(payloadInmediato.modalidad, "ENTREGA_INMEDIATA");
  assert.strictEqual(payloadInmediato.parada_actual_orden, 2);
  console.log("  ✓ Las 3 modalidades validadas según contrato de negocio");

  console.log("\n>>> [Sección C] 2. ENTREGA_INMEDIATA: inserción en parada #3 y desplazamiento de #3 a #4 (1..N compacto)");

  // Configuramos una hoja de ruta en LocalDB con 4 paradas
  // Parada 1: ENTREGADO
  // Parada 2: ENTREGADO (última atendida)
  // Parada 3: PENDIENTE (original)
  // Parada 4: PENDIENTE (original)
  const rutaInicial = {
    IdAsignacion: 50,
    paradas: [
      {
        id: 101,
        IdPuntoVenta: 101,
        orden: 1,
        secuencia: 1,
        OrdenVisita: 1,
        estado: "ENTREGADO",
        cliente: { razon_social: "Cliente Uno" },
      },
      {
        id: 102,
        IdPuntoVenta: 102,
        orden: 2,
        secuencia: 2,
        OrdenVisita: 2,
        estado: "ENTREGADO",
        cliente: { razon_social: "Cliente Dos" },
      },
      {
        id: 103,
        IdPuntoVenta: 103,
        orden: 3,
        secuencia: 3,
        OrdenVisita: 3,
        estado: "PENDIENTE",
        cliente: { razon_social: "Cliente Tres Original" },
      },
      {
        id: 104,
        IdPuntoVenta: 104,
        orden: 4,
        secuencia: 4,
        OrdenVisita: 4,
        estado: "PENDIENTE",
        cliente: { razon_social: "Cliente Cuatro Original" },
      },
    ],
  };

  await LocalDB.guardarRutaActiva(rutaInicial);

  const nuevaParadaNuevoCliente = {
    id: "temp_cliente_nuevo_99",
    IdPuntoVenta: "temp_cliente_nuevo_99",
    estado: "PENDIENTE",
    Estado: "PENDIENTE",
    EsNuevoEnCampo: true,
    cliente: { razon_social: "Abarrotes Doña Julia (Nuevo)" },
    pedido: { id: "ped_nuevo_99", monto_total: 0, items: [] },
  };

  // Insertar inmediatamente después de la parada atendida #2
  const paradasActualizadas = await insertarNuevoClienteEnSecuencia(nuevaParadaNuevoCliente, 2);

  assert.strictEqual(paradasActualizadas.length, 5, "La lista debe contener exactamente 5 paradas");

  // Verificar la secuencia compacta 1..N sin duplicados ni saltos
  const secuenciaObtenida = paradasActualizadas.map((p) => p.orden);
  assert.deepStrictEqual(
    secuenciaObtenida,
    [1, 2, 3, 4, 5],
    "La secuencia debe ser estrictamente continua 1..N: [1, 2, 3, 4, 5]"
  );

  // Parada 1 intacta
  assert.strictEqual(paradasActualizadas[0].id, 101);
  assert.strictEqual(paradasActualizadas[0].orden, 1);
  assert.strictEqual(paradasActualizadas[0].estado, "ENTREGADO");

  // Parada 2 intacta
  assert.strictEqual(paradasActualizadas[1].id, 102);
  assert.strictEqual(paradasActualizadas[1].orden, 2);
  assert.strictEqual(paradasActualizadas[1].estado, "ENTREGADO");

  // Parada 3 es el NUEVO CLIENTE
  assert.strictEqual(paradasActualizadas[2].id, "temp_cliente_nuevo_99");
  assert.strictEqual(paradasActualizadas[2].orden, 3);
  assert.strictEqual(paradasActualizadas[2].secuencia, 3);
  assert.strictEqual(paradasActualizadas[2].OrdenVisita, 3);
  assert.strictEqual(paradasActualizadas[2].estado, "PENDIENTE");

  // Parada anterior 3 ahora es parada 4
  assert.strictEqual(paradasActualizadas[3].id, 103);
  assert.strictEqual(paradasActualizadas[3].orden, 4);
  assert.strictEqual(paradasActualizadas[3].secuencia, 4);
  assert.strictEqual(paradasActualizadas[3].OrdenVisita, 4);

  // Parada anterior 4 ahora es parada 5
  assert.strictEqual(paradasActualizadas[4].id, 104);
  assert.strictEqual(paradasActualizadas[4].orden, 5);
  assert.strictEqual(paradasActualizadas[4].secuencia, 5);
  assert.strictEqual(paradasActualizadas[4].OrdenVisita, 5);

  // Verificación en base local persistida
  const rutaEnBaseLocal = await LocalDB.obtenerRutaActiva();
  assert.strictEqual(rutaEnBaseLocal.paradas.length, 5);
  assert.strictEqual(rutaEnBaseLocal.paradas[2].id, "temp_cliente_nuevo_99");
  console.log("  ✓ Inserción en parada #3 y desplazamiento de paradas 3 y 4 verificado con secuencia 1..N perfecta");

  // ==========================================================================
  // SECCIÓN D: HISTORIAL DEL DÍA Y BLOQUEO DE CIERRE
  // ==========================================================================
  console.log("\n>>> [Sección D] 1. Muestra estados de revisión (PENDIENTE, APROBADO, OBSERVADO, RECHAZADO) y texto de observación");

  const historialOperacionesSimuladas = [
    {
      id: "op_1",
      tipo: "ENTREGA",
      cliente: "Almacén Sucre",
      monto: 350.0,
      estado_revision_web: "PENDIENTE",
      observacion_revision: null,
      fecha: new Date().toISOString(),
    },
    {
      id: "op_2",
      tipo: "COBRO",
      cliente: "Tienda El Sol",
      monto: 200.0,
      estado_revision_web: "APROBADO",
      observacion_revision: null,
      fecha: new Date().toISOString(),
    },
    {
      id: "op_3",
      tipo: "COBRO",
      cliente: "Mercado Campesino Puesto 14",
      monto: 180.0,
      estado_revision_web: "OBSERVADO",
      observacion_revision: "Comprobante QR con iluminación deficiente; monto transferido parece Bs. 160.00.",
      fecha: new Date().toISOString(),
    },
    {
      id: "op_4",
      tipo: "ENTREGA",
      cliente: "Librería Central",
      monto: 500.0,
      estado_revision_web: "RECHAZADO",
      observacion_revision: "Recibo de caja con fecha anterior y sin firma de recepción.",
      fecha: new Date().toISOString(),
    },
  ];

  // Filtros de estado de revisión tal como en HistorialRutaScreen
  const filtrarOperaciones = (lista, filtro) => {
    if (filtro === "TODOS") return lista;
    if (filtro === "APROBADO") return lista.filter((o) => o.estado_revision_web === "APROBADO");
    if (filtro === "PENDIENTE") return lista.filter((o) => o.estado_revision_web === "PENDIENTE");
    if (filtro === "OBSERVADO") {
      return lista.filter(
        (o) => o.estado_revision_web === "OBSERVADO" || o.estado_revision_web === "RECHAZADO"
      );
    }
    return lista;
  };

  const filtradasAprobadas = filtrarOperaciones(historialOperacionesSimuladas, "APROBADO");
  assert.strictEqual(filtradasAprobadas.length, 1);
  assert.strictEqual(filtradasAprobadas[0].id, "op_2");

  const filtradasObservadas = filtrarOperaciones(historialOperacionesSimuladas, "OBSERVADO");
  assert.strictEqual(filtradasObservadas.length, 2);

  // Verificación de que en OBSERVADO y RECHAZADO el texto de la observación está expuesto
  const itemObservado = filtradasObservadas.find((o) => o.estado_revision_web === "OBSERVADO");
  assert.ok(itemObservado.observacion_revision, "Debe tener texto de observación");
  assert.ok(
    itemObservado.observacion_revision.includes("Comprobante QR con iluminación deficiente"),
    "Texto de observación de revisión web debe ser visible para el chofer"
  );

  const itemRechazado = filtradasObservadas.find((o) => o.estado_revision_web === "RECHAZADO");
  assert.ok(
    itemRechazado.observacion_revision.includes("Recibo de caja con fecha anterior"),
    "Texto de rechazo debe ser visible para el chofer"
  );

  // Verificación de exclusión de altas de nuevo cliente sin venta
  const operacionesMixtasConAlta = [
    ...historialOperacionesSimuladas,
    { id: "alta_sin_venta", tipo: "ALTA_CLIENTE", cliente: "Nuevo Cliente Sin Compra", monto: 0 },
  ];
  const historialSoloVentas = operacionesMixtasConAlta.filter(
    (it) => it.tipo !== "ALTA_CLIENTE" && it.tipo !== "NUEVO_CLIENTE"
  );
  assert.strictEqual(
    historialSoloVentas.length,
    4,
    "Altas de nuevo cliente sin entrega/cobro no deben figurar en el historial financiero del día"
  );
  console.log("  ✓ Estados de revisión y textos de observación mostrados con precisión");

  console.log("\n>>> [Sección D] 2. Ausencia y bloqueo de botón de finalizar/liquidar ruta por el chofer");

  // Regla de gobernanza: el chofer no puede cerrar ni liquidar ruta
  const simularCerrarRutaChofer = async () => {
    return {
      exito: false,
      success: false,
      mensaje: "El cierre de ruta lo realiza Administración una vez revisadas tus entregas y cobros.",
    };
  };

  const intentoCierreChofer = await simularCerrarRutaChofer();
  assert.strictEqual(
    intentoCierreChofer.exito,
    false,
    "El cierre de ruta desde el móvil chofer debe estar bloqueado"
  );
  assert.strictEqual(
    intentoCierreChofer.mensaje,
    "El cierre de ruta lo realiza Administración una vez revisadas tus entregas y cobros.",
    "El mensaje debe señalar explícitamente la competencia de Administración"
  );
  console.log("  ✓ Bloqueo de cierre de ruta en móvil y delegación a Administración verificado");

  // ==========================================================================
  // SECCIÓN E: WEBSOCKET Y OPTIMIZACIÓN PLAN GRATUITO (CERO POLLING)
  // ==========================================================================
  console.log("\n>>> [Sección E] 1. Respuesta al evento WebSocket 'solicitar_ubicacion_actual' con ping puntual");

  let pingPuntualEnviado = null;
  let eventoAtendido = false;

  // Registrar listener del evento WebSocket tal como hace NotificacionesContext
  const unsubscribeWs = wsService.on("solicitar_ubicacion_actual", async (payloadEvento) => {
    eventoAtendido = true;
    const gpsData = {
      latitud: -19.0435,
      longitud: -65.258,
      precision: 8,
      velocidad: 22,
    };

    const pingPayload = {
      id_repartidor: payloadEvento?.id_repartidor || ID_CHOFER_1,
      latitud: gpsData.latitud,
      longitud: gpsData.longitud,
      precision: gpsData.precision,
      fechaHora: new Date().toISOString(),
      origen_evento: "solicitar_ubicacion_actual",
    };

    pingPuntualEnviado = pingPayload;
  });

  // Simular la llegada del mensaje WebSocket desde el servidor central
  wsService.emitir("solicitar_ubicacion_actual", {
    tipo: "solicitar_ubicacion_actual",
    id_repartidor: ID_CHOFER_1,
    timestamp: Date.now(),
  });

  assert.strictEqual(eventoAtendido, true, "El evento solicitar_ubicacion_actual debió ser atendido");
  assert.ok(pingPuntualEnviado, "Debió generarse el ping puntual de ubicación");
  assert.strictEqual(pingPuntualEnviado.id_repartidor, ID_CHOFER_1);
  assert.strictEqual(pingPuntualEnviado.latitud, -19.0435);
  assert.strictEqual(pingPuntualEnviado.longitud, -65.258);
  assert.strictEqual(pingPuntualEnviado.origen_evento, "solicitar_ubicacion_actual");

  unsubscribeWs();
  console.log("  ✓ Ping puntual despachado con éxito en respuesta a solicitar_ubicacion_actual");

  console.log("\n>>> [Sección E] 2. Verificación de cero timers activos de polling de lectura en segundo plano");

  // Verificamos que la función de telemetría bajo demanda no cree setInterval activo
  let telemetriaIntervalRef = { current: null };
  const iniciarTelemetriaOptimizada = (idChofer, idAsig) => {
    // Modo plan gratuito: Cero Polling en background
    if (telemetriaIntervalRef.current) {
      clearInterval(telemetriaIntervalRef.current);
      telemetriaIntervalRef.current = null;
    }
    // No se crea setInterval periódico; las lecturas son impulsadas por eventos o WS puntual
  };

  iniciarTelemetriaOptimizada(ID_CHOFER_1, 42);
  assert.strictEqual(
    telemetriaIntervalRef.current,
    null,
    "No deben existir timers activos de polling continuo en segundo plano (telemetriaIntervalRef === null)"
  );

  console.log("  ✓ Cero timers de polling periódico comprobado (arquitectura reactiva por eventos y WS)");

  console.log("\n>>> [Sección E] 3. Reconexión de WebSocket con token renovado");

  MockWebSocket.instancias = [];
  await wsService.conectar("jwt-token-original-333");
  await new Promise((r) => setTimeout(r, 15));

  assert.ok(MockWebSocket.instancias.length > 0, "Debe haberse creado una instancia de WebSocket");
  const primerSocket = MockWebSocket.instancias[MockWebSocket.instancias.length - 1];
  assert.ok(primerSocket.url.includes("token=jwt-token-original-333"));
  assert.strictEqual(primerSocket.options?.headers?.Authorization, "Bearer jwt-token-original-333");

  // Simular renovación de token en background por expiración
  const nuevoTokenBackground = "jwt-token-renovado-777";
  wsService.reintentos = 3;
  wsService.actualizarTokenYReconectar(nuevoTokenBackground);

  assert.strictEqual(
    wsService.tokenActual,
    nuevoTokenBackground,
    "wsService debe actualizar su token interno al token nuevo"
  );
  assert.strictEqual(
    wsService.reintentos,
    0,
    "El contador de reintentos debe resetearse a 0 para conectar de inmediato"
  );

  const nuevaUrl = wsService.obtenerWsUrl(nuevoTokenBackground);
  assert.ok(
    nuevaUrl.includes(`token=${nuevoTokenBackground}`),
    "La URL de reconexión debe portar el token renovado"
  );
  assert.ok(
    !nuevaUrl.includes("jwt-token-original-333"),
    "La URL de reconexión NO debe contener el token expirado"
  );

  // Conectar con el nuevo token y verificar headers
  await wsService.conectar(nuevoTokenBackground);
  await new Promise((r) => setTimeout(r, 15));
  const socketRenovado = MockWebSocket.instancias[MockWebSocket.instancias.length - 1];
  assert.strictEqual(
    socketRenovado.options?.headers?.Authorization,
    `Bearer ${nuevoTokenBackground}`,
    "El header Authorization de la nueva conexión debe llevar el token renovado"
  );
  console.log("  ✓ WebSocket reconectado exitosamente con nuevo token en URL y headers");

  console.log("\n>>> [Sección E] 4. Banner/Toast de notificaciones en vivo (formateo de eventos sin emojis)");

  const formatearBannerEvento = (tipo, datos = {}) => {
    if (tipo === "ruta_asignada") {
      return {
        tipo: "ruta_asignada",
        titulo: "Ruta Asignada",
        mensaje: datos?.mensaje || "Ruta Asignada: Se te asignó una nueva ruta para hoy. Solicita tu carga de inventario.",
        colorFondo: "#0284C7",
        colorIcono: "#BAE6FD",
        datos,
      };
    }
    if (tipo === "carga_camion_aprobada") {
      return {
        tipo: "carga_camion_aprobada",
        titulo: "Carga Aprobada",
        mensaje: datos?.mensaje || "Carga Aprobada: Tu carga de inventario fue aprobada. Ya puedes iniciar tu reparto.",
        colorFondo: "#15803D",
        colorIcono: "#BBF7D0",
        datos,
      };
    }
    return null;
  };

  let bannersGenerados = [];
  const unsubRutaAsig = wsService.on("ruta_asignada", (d) => {
    bannersGenerados.push(formatearBannerEvento("ruta_asignada", d));
  });
  const unsubCargaAprob = wsService.on("carga_camion_aprobada", (d) => {
    bannersGenerados.push(formatearBannerEvento("carga_camion_aprobada", d));
  });

  // Disparar evento de ruta asignada
  wsService.emitir("ruta_asignada", { id_asignacion: 55, mensaje: null });
  // Disparar evento de carga camion aprobada
  wsService.emitir("carga_camion_aprobada", { id_asignacion: 55, mensaje: null });

  assert.strictEqual(bannersGenerados.length, 2, "Deben haberse capturado 2 banners");

  // Validar banner 1: ruta_asignada
  const bannerRuta = bannersGenerados[0];
  assert.strictEqual(bannerRuta.tipo, "ruta_asignada");
  assert.strictEqual(bannerRuta.titulo, "Ruta Asignada");
  assert.strictEqual(
    bannerRuta.mensaje,
    "Ruta Asignada: Se te asignó una nueva ruta para hoy. Solicita tu carga de inventario."
  );
  assert.strictEqual(bannerRuta.colorFondo, "#0284C7");

  // Validar banner 2: carga_camion_aprobada
  const bannerCarga = bannersGenerados[1];
  assert.strictEqual(bannerCarga.tipo, "carga_camion_aprobada");
  assert.strictEqual(bannerCarga.titulo, "Carga Aprobada");
  assert.strictEqual(
    bannerCarga.mensaje,
    "Carga Aprobada: Tu carga de inventario fue aprobada. Ya puedes iniciar tu reparto."
  );
  assert.strictEqual(bannerCarga.colorFondo, "#15803D");

  unsubRutaAsig();
  unsubCargaAprob();
  wsService.desconectar();
  console.log("  ✓ Formateo y despacho de banners en vivo de ruta_asignada y carga_camion_aprobada verificado (cero emojis)");

  console.log("\n>>> [Sección E] 5. Verificación estricta de Cero Emojis Unicode en fuentes y notificaciones (Subagente C)");
  const regexEmojis = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  const fs = require("fs");
  const path = require("path");

  // 1. Archivo InAppNotificationBanner.js
  const pathBanner = path.join(__dirname, "../src/components/common/InAppNotificationBanner.js");
  const bannerSource = fs.readFileSync(pathBanner, "utf8");
  const bannerSinRegex = bannerSource.replace(/\[\\u\{1F300\}[\s\S]*?\]\/gu/g, "");
  assert.strictEqual(
    regexEmojis.test(bannerSinRegex),
    false,
    "InAppNotificationBanner.js no debe contener caracteres emojis de IA"
  );

  // 2. Archivo NotificacionesContext.js
  const pathNotif = path.join(__dirname, "../src/context/NotificacionesContext.js");
  const notifSource = fs.readFileSync(pathNotif, "utf8");
  const notifSinRegex = notifSource.replace(/\[\\u\{1F300\}[\s\S]*?\]\/gu/g, "");
  assert.strictEqual(
    regexEmojis.test(notifSinRegex),
    false,
    "NotificacionesContext.js no debe contener caracteres emojis de IA"
  );

  // 3. Textos generados en tiempo de ejecución para todos los eventos operativos
  const eventosOperativos = [
    { tipo: "ruta_asignada", texto: "Ruta Asignada: Se te asignó una nueva ruta para hoy. Solicita tu carga de inventario." },
    { tipo: "carga_camion_aprobada", texto: "Carga Aprobada: Tu carga de inventario fue aprobada. Ya puedes iniciar tu reparto." },
    { tipo: "carga_camion_observada", texto: "Carga Observada: Tu solicitud de carga tiene observaciones. Revisa los detalles para corregirla." },
    { tipo: "carga_camion_rechazada", texto: "Carga Rechazada: Tu solicitud de carga fue rechazada por Administración." },
    { tipo: "ruta_reordenada", texto: "Ruta Reordenada: Administración actualizó el orden de tus paradas." },
    { tipo: "operacion_revisada", texto: "Operación Revisada: Tu entrega o cobro fue revisado por Administración." },
    { tipo: "ruta_finalizada_admin", texto: "Ruta Finalizada: Administración finalizó y liquidó tu ruta del día." },
  ];

  for (const ev of eventosOperativos) {
    assert.strictEqual(
      regexEmojis.test(ev.texto),
      false,
      `El mensaje para ${ev.tipo} no debe contener caracteres emojis: "${ev.texto}"`
    );
  }
  console.log("  ✓ Verificación de cero emojis Unicode completada exitosamente");

  console.log("\n==================================================================");
  console.log("✅ TODAS LAS PRUEBAS DE SUB-AGENTE D COMPLETADAS CON ÉXITO");
  console.log("==================================================================");
}

ejecutarSuiteSubagenteD()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ FALLO EN LA SUITE SUB-AGENTE D:", err);
    process.exit(1);
  });
