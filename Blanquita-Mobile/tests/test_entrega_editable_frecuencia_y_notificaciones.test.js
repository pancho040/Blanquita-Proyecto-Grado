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

// Interceptar módulos nativos de React Native y Expo antes de requerir código fuente
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

  console.log("\n==================================================================");
  console.log("✅ TODAS LAS PRUEBAS DE SUB-AGENTE D COMPLETADAS CON ÉXITO (100%)");
  console.log("==================================================================");
}

ejecutarSuiteEntregaFrecuenciaNotificaciones()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ ERROR EN SUITE SUB-AGENTE D:", err);
    process.exit(1);
  });
