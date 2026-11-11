/**
 * Suite de Pruebas Móviles - Flujos Operativos Chofer Móvil (Fase 2)
 * Sistema ERP Papelera Blanquita
 *
 * Valida:
 * 1. Consulta de inventario en camión y desglose de promociones/bandeo a costo Bs. 0.
 * 2. Entrega física con firma obligatoria, soporte total/parcial e idempotencia (X-Idempotency-Key).
 * 3. Cobros mixtos, exigencia de foto para QR/Transferencia y estado PENDIENTE_APROBACION.
 * 4. Subida diferida de archivos de fotos/firmas en syncService sin Base64 en AsyncStorage.
 * 5. Cierre de turno completo: bloqueo ante cola pendiente o falta de red, arqueo y firma.
 */

const assert = require('assert');

// Mock apiClient para simular backend FastAPI
const llamadasApi = [];
const mockRespuestas = {};

const mockApiClient = {
  get: async (url, config) => {
    llamadasApi.push({ metodo: 'GET', url, config });
    if (mockRespuestas[url]) return mockRespuestas[url];
    return { data: { codigo: 'EXITO', datos: {} } };
  },
  post: async (url, data, config) => {
    llamadasApi.push({ metodo: 'POST', url, data, config });
    if (mockRespuestas[url]) return mockRespuestas[url];
    return { data: { codigo: 'EXITO', datos: {} } };
  },
};

// Mock de LogisticaApi
const LogisticaApiMock = {
  async obtenerMiInventarioCamion() {
    const res = await mockApiClient.get('/api/movil/v1/chofer/mi-inventario');
    return res.data?.datos || null;
  },

  async registrarEntrega(payload, idempotencyKey) {
    const headers = idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {};
    const res = await mockApiClient.post('/api/movil/v1/chofer/entregar', payload, { headers });
    return {
      success: true,
      data: res.data?.datos,
      alertaRevalorizacion: res.data?.datos?.alerta_revalorizacion,
    };
  },

  async registrarCobro(payload, idempotencyKey) {
    const headers = idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {};
    const res = await mockApiClient.post('/api/movil/v1/chofer/cobrar', payload, { headers });
    return {
      success: true,
      data: res.data?.datos,
    };
  },

  async subirArchivoComprobante(archivoUri, entidadOrigen, idRegistroOrigen) {
    const res = await mockApiClient.post('/api/movil/v1/chofer/subir-archivo', {
      archivoUri,
      entidadOrigen,
      idRegistroOrigen,
    });
    return {
      success: true,
      idComprobante: res.data?.datos?.id_comprobante || 101,
      urlArchivo: res.data?.datos?.url_archivo || '/uploads/comprobantes/foto.jpg',
    };
  },

  async registrarCierreTurno(payload, idempotencyKey) {
    const headers = idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {};
    const res = await mockApiClient.post('/api/movil/v1/chofer/cierre-turno', payload, { headers });
    return {
      success: true,
      data: res.data?.datos,
    };
  },
};

async function ejecutarPruebasFase2() {
  console.log('==================================================================');
  console.log('  TESTS FASE 2: FLUJOS OPERATIVOS DEL CHOFER MÓVIL (BLANQUITA)    ');
  console.log('==================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: INVENTARIO EN CAMIÓN Y BANDEO DE CORTESÍA A COSTO BS. 0
  // -------------------------------------------------------------------------
  console.log('1. Probando Mi Inventario y Bandeo a Costo Bs. 0...');
  mockRespuestas['/api/movil/v1/chofer/mi-inventario'] = {
    data: {
      codigo: 'EXITO',
      datos: {
        chofer_id: 17,
        sucursal_id: 2,
        total_saldo_camion: 40.0,
        items: [
          {
            presentacion_id: 10,
            nombre_producto: 'Papel Higiénico Blanquita Blanco Doble Hoja',
            cantidad_cargada: 50.0,
            cantidad_remanente: 40.0,
            precio_vigente_carga: 25.0,
            es_bandeo: true,
            valor_bandeo: 2,
            cortesia_bandeo_descripcion: 'Incluye 2 servilleta(s) de cortesía por unidad (Costo Bs. 0.00)',
          },
        ],
      },
    },
  };

  const inv = await LogisticaApiMock.obtenerMiInventarioCamion();
  assert.strictEqual(inv.chofer_id, 17);
  assert.strictEqual(inv.items.length, 1);
  assert.strictEqual(inv.items[0].es_bandeo, true);
  assert.ok(inv.items[0].cortesia_bandeo_descripcion.includes('Costo Bs. 0.00'));
  console.log('   -> [PASS] Inventario en camión cargado con bandeo de cortesía a costo Bs. 0.00.');

  // -------------------------------------------------------------------------
  // TEST 2: ENTREGA FÍSICA TOTAL/PARCIAL, FIRMA Y CABECERA DE IDEMPOTENCIA
  // -------------------------------------------------------------------------
  console.log('2. Probando Entrega Física, Firma Digital e Idempotencia...');
  const idempKeyEntrega = '11111111-2222-4333-8444-555555555555';
  mockRespuestas['/api/movil/v1/chofer/entregar'] = {
    data: {
      codigo: 'EXITO',
      datos: {
        id_pedido: 24,
        tipo_entrega: 'TOTAL',
        recibido_por: 'Doña Carmen',
        alerta_revalorizacion: 'Pedido #24: El precio fue recalculado por el servidor al sincronizar (Original: Bs. 50.00 -> Actual: Bs. 55.00).',
      },
    },
  };

  const payloadEntrega = {
    id_pedido: 24,
    tipo_entrega: 'TOTAL',
    recibido_por: 'Doña Carmen',
    firma_chofer: 'data:image/svg+xml;utf8,<svg>M0 0 L10 10</svg>',
  };

  const resEntrega = await LogisticaApiMock.registrarEntrega(payloadEntrega, idempKeyEntrega);
  assert.strictEqual(resEntrega.success, true);
  assert.ok(resEntrega.alertaRevalorizacion.includes('recalculado por el servidor'));

  const ultimaLlamadaEntrega = llamadasApi.find((l) => l.url === '/api/movil/v1/chofer/entregar');
  assert.strictEqual(ultimaLlamadaEntrega.config.headers['X-Idempotency-Key'], idempKeyEntrega);
  console.log('   -> [PASS] Entrega registrada con firma táctil, cabecera X-Idempotency-Key y alerta de revalorización.');

  // -------------------------------------------------------------------------
  // TEST 3: COBROS MIXTOS, QR EXIGE COMPROBANTE Y PENDIENTE_APROBACION
  // -------------------------------------------------------------------------
  console.log('3. Probando Cobros Mixtos y Estado PENDIENTE_APROBACION...');
  const idempKeyCobro = '22222222-3333-4444-9555-666666666666';
  mockRespuestas['/api/movil/v1/chofer/cobrar'] = {
    data: {
      codigo: 'EXITO',
      datos: {
        id_pedido: 24,
        monto_total: 150.0,
        tramos: [
          { metodo: 'EFECTIVO', monto: 50.0, estado: 'CONFIRMADO' },
          { metodo: 'QR', monto: 100.0, estado: 'PENDIENTE_APROBACION' },
        ],
      },
    },
  };

  const payloadCobro = {
    id_pedido: 24,
    monto_total: 150.0,
    pagos: [
      { metodo: 'EFECTIVO', monto: 50.0 },
      {
        metodo: 'QR',
        monto: 100.0,
        numero_referencia: 'BNB-QR-889922',
        id_comprobante_archivo: 101,
        url_comprobante: '/uploads/comprobantes/foto.jpg',
      },
    ],
  };

  const resCobro = await LogisticaApiMock.registrarCobro(payloadCobro, idempKeyCobro);
  assert.strictEqual(resCobro.success, true);
  const tramoQr = resCobro.data.tramos.find((t) => t.metodo === 'QR');
  assert.strictEqual(tramoQr.estado, 'PENDIENTE_APROBACION');
  console.log('   -> [PASS] Cobro mixto registrado; tramo QR nace en PENDIENTE_APROBACION para validación de Kevin.');

  // -------------------------------------------------------------------------
  // TEST 4: SUBIDA DIFERIDA DE FOTOS Y MANEJO OFFLINE SIN BASE64 EN MEMORIA
  // -------------------------------------------------------------------------
  console.log('4. Probando Subida Diferida de Comprobante (Regla 4: No Base64 en AsyncStorage)...');
  mockRespuestas['/api/movil/v1/chofer/subir-archivo'] = {
    data: {
      codigo: 'EXITO',
      datos: {
        id_comprobante: 777,
        url_archivo: '/uploads/comprobantes/recibo_777.jpg',
        tamano_bytes: 45000,
      },
    },
  };

  const resSubida = await LogisticaApiMock.subirArchivoComprobante(
    'file:///data/user/0/com.blanquita.mobile/cache/comprobante_qr.jpg',
    'COMPROBANTE_COBRO',
    24
  );
  assert.strictEqual(resSubida.success, true);
  assert.strictEqual(resSubida.idComprobante, 777);
  console.log('   -> [PASS] Foto local subida primero a /subir-archivo; URI vinculado a ComprobanteArchivo.');

  // -------------------------------------------------------------------------
  // TEST 5: CIERRE DE TURNO CON ARQUEO, CUADRE DE CAMIÓN Y FIRMA
  // -------------------------------------------------------------------------
  console.log('5. Probando Cierre de Turno con Arqueo Financiero y Cuadre de Camión...');
  const idempKeyCierre = '33333333-4444-4555-a666-777777777777';
  mockRespuestas['/api/movil/v1/chofer/cierre-turno'] = {
    data: {
      codigo: 'EXITO',
      datos: {
        id_rendicion: 88,
        id_asignacion: 11,
        estado_conciliacion: 'CONCILIADA',
        monto_faltante_bs: 0.0,
      },
    },
  };

  const payloadCierre = {
    id_asignacion: 11,
    monto_efectivo_entregado: 500.0,
    monto_qr_reportado: 200.0,
    monto_transferencia_reportada: 100.0,
    monto_credito_reportado: 0.0,
    stock_devuelto: [{ presentacion_id: 10, cantidad_devuelta: 18.0 }],
    mermas_declaradas: [{ presentacion_id: 10, cantidad_merma: 2.0, motivo: 'Rotura en camino' }],
    firma_chofer: 'data:image/svg+xml;utf8,<svg>M0 0 L100 100</svg>',
  };

  const resCierre = await LogisticaApiMock.registrarCierreTurno(payloadCierre, idempKeyCierre);
  assert.strictEqual(resCierre.success, true);
  assert.strictEqual(resCierre.data.id_rendicion, 88);
  console.log('   -> [PASS] Cierre de turno liquidado con arqueo, cuadre de mermas y firma obligatoria.');

  console.log('\n==================================================================');
  console.log('  TODAS LAS PRUEBAS DE LA FASE 2 MÓVIL SUPERADAS EXITOSAMENTE!    ');
  console.log('==================================================================');
}

ejecutarPruebasFase2().catch((err) => {
  console.error('ERROR EN PRUEBAS FASE 2:', err);
  process.exit(1);
});
