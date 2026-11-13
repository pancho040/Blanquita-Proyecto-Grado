import { SyncQueue } from "../database/syncQueue";
import { LogisticaApi } from "../api/logisticaApi";
import { ClientesApi } from "../api/clientesApi";
import { LocalDB } from "../database/localDb";

/**
 * Sanitizar objeto de payload para logging limpio sin cadenas base64 gigantes (Subagente B)
 */
export function sanitizarPayloadParaLog(obj) {
  if (!obj || typeof obj !== "object") return obj;
  try {
    const copia = JSON.parse(JSON.stringify(obj));
    if (copia.firma_chofer) {
      copia.firma_chofer = `[Firma Chofer length: ${copia.firma_chofer.length}]`;
    }
    if (copia.firma_cliente) {
      copia.firma_cliente = `[Firma Cliente length: ${copia.firma_cliente.length}]`;
    }
    if (copia.foto_uri && copia.foto_uri.length > 100) {
      copia.foto_uri = `[Foto URI length: ${copia.foto_uri.length}]`;
    }
    if (copia.cobro && Array.isArray(copia.cobro.pagos)) {
      copia.cobro.pagos = copia.cobro.pagos.map((p) => ({
        ...p,
        foto_uri: p.foto_uri ? `[Foto Tramo length: ${p.foto_uri.length}]` : null,
      }));
    }
    if (copia.entrega_con_cobro) {
      if (copia.entrega_con_cobro.firma_chofer) {
        copia.entrega_con_cobro.firma_chofer = `[Firma Chofer length: ${copia.entrega_con_cobro.firma_chofer.length}]`;
      }
      if (copia.entrega_con_cobro.firma_cliente) {
        copia.entrega_con_cobro.firma_cliente = `[Firma Cliente length: ${copia.entrega_con_cobro.firma_cliente.length}]`;
      }
      if (copia.entrega_con_cobro.cobro && Array.isArray(copia.entrega_con_cobro.cobro.pagos)) {
        copia.entrega_con_cobro.cobro.pagos = copia.entrega_con_cobro.cobro.pagos.map((p) => ({
          ...p,
          foto_uri: p.foto_uri ? `[Foto Tramo length: ${p.foto_uri.length}]` : null,
        }));
      }
    }
    return copia;
  } catch (_e) {
    return "[Payload no serializable]";
  }
}

/**
 * Normalizador/Migrador de payload para ENTREGA_CON_COBRO según contrato de handoff-sync.md (Subagente B)
 */
export function normalizarPayloadEntregaCompuesta(payloadOriginal = {}) {
  const p = { ...payloadOriginal };

  // 1. id_pedido como Number entero
  const idPedido = parseInt(
    p.id_pedido ?? p.idPedido ?? p.IdPedido ?? p.pedido_id ?? 0,
    10
  );

  // 2. latitud y longitud como números
  const latitud = typeof p.latitud === "number" ? p.latitud : parseFloat(p.latitud) || -19.0435;
  const longitud = typeof p.longitud === "number" ? p.longitud : parseFloat(p.longitud) || -65.2580;

  // 3. tipo_entrega: "TOTAL" o "PARCIAL"
  const tipoEntrega = String(p.tipo_entrega || "TOTAL").toUpperCase() === "PARCIAL" ? "PARCIAL" : "TOTAL";

  // 4. Strings limpios
  const recibidoPor = String(p.recibido_por || p.recibidoPor || "Cliente").trim();
  const ciReceptor = String(p.ci_receptor || p.ciReceptor || "").trim();
  const observacion = String(p.observacion || p.observaciones || "").trim();

  // 5. Items entregados normalizados según contrato
  const rawItems = Array.isArray(p.items_entregados)
    ? p.items_entregados
    : Array.isArray(p.productos)
    ? p.productos
    : [];

  const itemsNormalizados = rawItems
    .map((it) => {
      const presId = parseInt(
        it.presentacion_id ?? it.id_presentacion ?? it.IdPresentacion ?? it.id_producto ?? it.id ?? 0,
        10
      );
      const cant = typeof it.cantidad === "number" ? it.cantidad : parseFloat(it.cantidad || it.Cantidad || 0);
      const bandeo = Boolean(it.es_cortesia_bandeo || it.es_bandeo);

      return {
        presentacion_id: presId,
        cantidad: Number(cant.toFixed(2)),
        es_cortesia_bandeo: bandeo,
      };
    })
    .filter((it) => it.presentacion_id > 0 && it.cantidad > 0);

  // 6. Bloque Cobro
  let cobroNormalizado = null;
  if (p.cobro && typeof p.cobro === "object") {
    const rawCobro = p.cobro;
    const montoTotal = Number((parseFloat(rawCobro.monto_total ?? p.monto_total ?? 0) || 0).toFixed(2));

    const rawPagos = Array.isArray(rawCobro.pagos) ? rawCobro.pagos : [];
    let sumaPagos = 0;

    const pagosNormalizados = rawPagos.map((pago) => {
      const monto = Number((parseFloat(pago.monto || 0) || 0).toFixed(2));
      sumaPagos = Number((sumaPagos + monto).toFixed(2));
      const metodo = String(pago.metodo || "EFECTIVO").toUpperCase();
      const numRef = pago.numero_referencia ? String(pago.numero_referencia).trim() : null;
      const idComp = pago.id_comprobante_archivo ? parseInt(pago.id_comprobante_archivo, 10) : null;

      const itemPago = {
        metodo,
        monto,
        numero_referencia: numRef,
        id_comprobante_archivo: idComp,
      };
      if (pago.url_comprobante) {
        itemPago.url_comprobante = pago.url_comprobante;
      }
      if (pago.foto_uri) {
        itemPago.foto_uri = pago.foto_uri;
      }
      return itemPago;
    });

    // Crédito
    let creditoNormalizado = null;
    const rawCredito = rawCobro.credito;
    const saldoCredito = rawCredito
      ? Number((parseFloat(rawCredito.saldo || 0) || 0).toFixed(2))
      : 0;

    if (saldoCredito > 0) {
      const plazo = parseInt(rawCredito.plazo_dias || 15, 10);
      const cuotas = parseInt(rawCredito.cuotas || 1, 10);
      let fechaVenc = rawCredito.fecha_vencimiento;
      if (!fechaVenc) {
        const d = new Date();
        d.setDate(d.getDate() + plazo);
        fechaVenc = d.toISOString().split("T")[0];
      }
      creditoNormalizado = {
        saldo: saldoCredito,
        plazo_dias: plazo,
        cuotas,
        fecha_vencimiento: String(fechaVenc),
      };
    }

    // Validar y ajustar balance exacto entre cobro.monto_total y (suma(pagos) + saldoCredito)
    const saldoTotalCalculado = Number((sumaPagos + (creditoNormalizado?.saldo || 0)).toFixed(2));
    const diferencia = Number((montoTotal - saldoTotalCalculado).toFixed(2));

    if (Math.abs(diferencia) > 0 && Math.abs(diferencia) <= 0.05) {
      if (creditoNormalizado) {
        creditoNormalizado.saldo = Number((creditoNormalizado.saldo + diferencia).toFixed(2));
      } else if (pagosNormalizados.length > 0) {
        pagosNormalizados[pagosNormalizados.length - 1].monto = Number(
          (pagosNormalizados[pagosNormalizados.length - 1].monto + diferencia).toFixed(2)
        );
      }
    }

    if (montoTotal > 0 || pagosNormalizados.length > 0 || creditoNormalizado) {
      cobroNormalizado = {
        monto_total: montoTotal,
        pagos: pagosNormalizados,
        credito: creditoNormalizado, // null si saldo <= 0
      };
    }
  }

  const payloadFinal = {
    id_pedido: idPedido,
    latitud,
    longitud,
    tipo_entrega: tipoEntrega,
    recibido_por: recibidoPor,
    ci_receptor: ciReceptor,
    observacion,
    firma_chofer: p.firma_chofer || p.firmaChofer || null,
    firma_cliente: p.firma_cliente || p.firmaCliente || null,
    items_entregados: itemsNormalizados,
  };

  if (cobroNormalizado) {
    payloadFinal.cobro = cobroNormalizado;
  }

  if (p.foto_uri) {
    payloadFinal.foto_uri = p.foto_uri;
  }
  if (p.id_comprobante_archivo) {
    payloadFinal.id_comprobante_archivo = p.id_comprobante_archivo;
  }
  if (p.id_punto_venta || p.idPuntoVenta) {
    payloadFinal.id_punto_venta = p.id_punto_venta || p.idPuntoVenta;
  }

  return payloadFinal;
}

/**
 * Ordenar paradas ascendentemente y garantizar numeración compacta 1..N (Subagente C)
 * Inmutable y determinista: maneja identificadores de forma estable sin comparaciones NaN.
 * @param {Array} paradas - Lista de paradas de la ruta
 * @returns {Array} Lista nueva ordenada por orden ascendente con secuencia normalizada 1..N
 */
export function ordenarParadasAscendente(paradas = []) {
  if (!Array.isArray(paradas) || paradas.length === 0) return [];

  const ordenadas = [...paradas].sort((a, b) => {
    const ordA = Number(a.orden ?? a.secuencia ?? a.OrdenVisita ?? 999999);
    const ordB = Number(b.orden ?? b.secuencia ?? b.OrdenVisita ?? 999999);
    if (ordA !== ordB) return ordA - ordB;
    const idA = String(a.id ?? a.IdPuntoVenta ?? a.id_parada ?? a.IdPedido ?? "");
    const idB = String(b.id ?? b.IdPuntoVenta ?? b.id_parada ?? b.IdPedido ?? "");
    return idA.localeCompare(idB);
  });

  return ordenadas.map((p, index) => {
    const nuevoOrden = index + 1;
    return {
      ...p,
      orden: nuevoOrden,
      secuencia: nuevoOrden,
      OrdenVisita: nuevoOrden,
    };
  });
}

/**
 * Actualiza la hoja de ruta en el dispositivo aplicando el nuevo orden 1..N
 * y conservando intacto el estado de las paradas ya atendidas/entregadas (Subagente C)
 * Inmutable y determinista: no muta entradas y conserva paradas locales creadas al paso.
 * @param {Array} paradasNuevasOReordenadas - Lista de paradas recibida desde el servidor o evento
 * @returns {Promise<Array>} Paradas actualizadas y persistidas
 */
export async function aplicarReordenamientoRuta(paradasNuevasOReordenadas = []) {
  try {
    const rutaActual = await LocalDB.obtenerRutaActiva();
    if (!rutaActual) return ordenarParadasAscendente(paradasNuevasOReordenadas);

    const paradasLocales = rutaActual.paradas || [];
    const mapaLocales = new Map();

    paradasLocales.forEach((p) => {
      const clave = String(p.id ?? p.IdPuntoVenta ?? p.id_parada ?? p.id_pedido ?? "");
      if (clave) mapaLocales.set(clave, p);
    });

    const clavesProcesadas = new Set();
    const listaCombinada = [];

    // 1. Incorporar paradas reordenadas del servidor
    (paradasNuevasOReordenadas || []).forEach((pServidor) => {
      const clave = String(pServidor.id ?? pServidor.IdPuntoVenta ?? pServidor.id_parada ?? pServidor.id_pedido ?? "");
      if (!clave) return;
      clavesProcesadas.add(clave);

      const paradaLocal = mapaLocales.get(clave);
      if (paradaLocal) {
        const estadoLocal = String(paradaLocal.estado || paradaLocal.Estado || "").toUpperCase();
        const yaAtendida =
          estadoLocal === "ENTREGADO" ||
          estadoLocal === "NO_ENTREGADO" ||
          Boolean(paradaLocal.cobro) ||
          Boolean(paradaLocal.datosOperacion);

        if (yaAtendida) {
          // Conservar estado local atendido intacto (inmutable)
          listaCombinada.push({
            ...pServidor,
            ...paradaLocal,
            orden: paradaLocal.orden ?? pServidor.orden,
            secuencia: paradaLocal.secuencia ?? pServidor.secuencia ?? paradaLocal.orden,
            OrdenVisita: paradaLocal.OrdenVisita ?? pServidor.OrdenVisita ?? paradaLocal.orden,
            estado: paradaLocal.estado || paradaLocal.Estado,
            Estado: paradaLocal.Estado || paradaLocal.estado,
          });
          return;
        }
      }
      listaCombinada.push({ ...pServidor });
    });

    // 2. Conservar paradas locales que no vinieron en el nuevo array (ej. clientes agregados en ruta offline)
    paradasLocales.forEach((pLocal) => {
      const clave = String(pLocal.id ?? pLocal.IdPuntoVenta ?? pLocal.id_parada ?? pLocal.id_pedido ?? "");
      if (clave && !clavesProcesadas.has(clave)) {
        listaCombinada.push({ ...pLocal });
        clavesProcesadas.add(clave);
      }
    });

    const listaOrdenada = ordenarParadasAscendente(listaCombinada);
    const rutaActualizada = {
      ...rutaActual,
      paradas: listaOrdenada,
      ultimaActualizacion: new Date().toISOString(),
    };

    await LocalDB.guardarRutaActiva(rutaActualizada);
    return listaOrdenada;
  } catch (err) {
    console.error("[SyncService] Error aplicando reordenamiento de ruta:", err);
    return ordenarParadasAscendente(paradasNuevasOReordenadas);
  }
}

/**
 * Inserta un nuevo cliente en ruta inmediatamente después de la parada atendida actual,
 * desplazando las paradas pendientes en +1 y compactando la secuencia 1..N (Subagente C)
 * Inmutable y determinista.
 * @param {Object} nuevaParada - Datos de la parada del nuevo cliente
 * @param {number} paradaActualOrden - Orden de la parada actual o última atendida (ej: 2)
 * @returns {Promise<Array>} Paradas actualizadas de la ruta
 */
export async function insertarNuevoClienteEnSecuencia(nuevaParada, paradaActualOrden = 0) {
  try {
    const ruta = await LocalDB.obtenerRutaActiva();
    if (!ruta) {
      const p = {
        ...nuevaParada,
        orden: 1,
        secuencia: 1,
        OrdenVisita: 1,
      };
      return [p];
    }

    const paradasActuales = ruta.paradas || [];
    const posicionInsercion = Math.max(1, Number(paradaActualOrden || 0) + 1);

    // Desplazar pendientes de forma inmutable
    const paradasDesplazadas = paradasActuales.map((p) => {
      const ord = Number(p.orden ?? p.secuencia ?? p.OrdenVisita ?? 0);
      const estado = String(p.estado || p.Estado || "").toUpperCase();
      const yaAtendida =
        estado === "ENTREGADO" ||
        estado === "NO_ENTREGADO" ||
        Boolean(p.cobro) ||
        Boolean(p.datosOperacion);

      if (!yaAtendida && ord >= posicionInsercion) {
        return {
          ...p,
          orden: ord + 1,
          secuencia: ord + 1,
          OrdenVisita: ord + 1,
        };
      }
      return { ...p };
    });

    // Inserción de la nueva parada
    const paradaAInsertar = {
      ...nuevaParada,
      orden: posicionInsercion,
      secuencia: posicionInsercion,
      OrdenVisita: posicionInsercion,
      estado: nuevaParada.estado || nuevaParada.Estado || "PENDIENTE",
      Estado: nuevaParada.Estado || nuevaParada.estado || "PENDIENTE",
    };

    const listaFinal = [...paradasDesplazadas, paradaAInsertar];
    const listaOrdenada = ordenarParadasAscendente(listaFinal);

    const rutaActualizada = {
      ...ruta,
      paradas: listaOrdenada,
      ultimaActualizacion: new Date().toISOString(),
    };

    await LocalDB.guardarRutaActiva(rutaActualizada);
    return listaOrdenada;
  } catch (err) {
    console.error("[SyncService] Error al insertar nuevo cliente en secuencia:", err);
    return [];
  }
}

/**
 * Motor de Sincronización Asíncrona Automática (Offline-First)
 * Cumple con HU-27, HU-28 y especificaciones de Subagentes B, C y D:
 * 1. Procesamiento FIFO secuencial con X-Idempotency-Key estable generada al encolar.
 * 2. Candado estricto con liberación garantizada en finally y watchdog de 2 minutos.
 * 3. Subida prioritaria de comprobantes/fotos antes de despachar entrega o cobro.
 * 4. Aislamiento de cola por chofer activo (id_usuario) sin mezclar datos ajenos.
 * 5. Tolerancia a fallos: 401 pausa sin descartar; 4xx queda como error permanente visible sin bloquear el resto.
 * 6. Refresco de datos locales (hoja de ruta, inventario del camión, saldo) tras cada éxito.
 */
class SyncService {
  constructor() {
    this.sincronizando = false;
    this.horaInicioSync = null;
    this.suscriptores = [];
  }

  // Suscribirse a cambios en la sincronización
  suscribir(callback) {
    this.suscriptores.push(callback);
    return () => {
      this.suscriptores = this.suscriptores.filter((cb) => cb !== callback);
    };
  }

  notificar(estado) {
    this.suscriptores.forEach((cb) => {
      try {
        cb(estado);
      } catch (e) {
        console.error("Error en suscriptor de sync:", e);
      }
    });
  }

  /**
   * Ejecuta el procesamiento de todas las operaciones pendientes
   * @param {boolean} forzar - Si es forzado manualmente por el chofer
   */
  async procesarCola(forzar = false) {
    const AHORA = Date.now();

    // 1. Candado y Watchdog de seguridad (2 minutos = 120.000 ms)
    if (this.sincronizando) {
      if (this.horaInicioSync && AHORA - this.horaInicioSync > 120000) {
        console.warn("[SyncService] Watchdog: liberando candado pegado por más de 2 minutos.");
        this.sincronizando = false;
        this.horaInicioSync = null;
      } else {
        console.log("[SyncService] Ya hay una sincronización en curso.");
        return { exito: false, mensaje: "Sincronización ya en curso." };
      }
    }

    this.sincronizando = true;
    this.horaInicioSync = Date.now();
    this.notificar({ enProgreso: true, mensaje: "Iniciando sincronización..." });

    let exitosas = 0;
    let fallidas = 0;
    let omitidas4xx = 0;
    const alertasRevalorizacion = [];

    try {
      // 2. Aislamiento de cola por usuario activo (Subagente B)
      const sesion = await LocalDB.obtenerSesion();
      const usuarioIdActivo = sesion?.usuario?.IdUsuario || sesion?.usuario?.id_usuario || null;

      // Si se fuerza manualmente o no hay sesión, obtenemos pendientes del usuario o cola general
      const cola = await SyncQueue.obtenerCola(usuarioIdActivo);

      if (!cola || cola.length === 0) {
        this.notificar({ enProgreso: false, pendientes: 0, mensaje: "Al día. Sin pendientes." });
        return { exito: true, procesadas: 0, fallidas: 0, pendientes: 0 };
      }

      console.log(`[SyncService] Procesando ${cola.length} operaciones para usuario ${usuarioIdActivo || "general"}...`);

      for (const item of cola) {
        // Si el ítem tiene error 4xx permanente de validación de negocio, se omite en sincronización automática
        // para NO bloquear a los demás ítems de la cola FIFO (Subagente C)
        if (item.esErrorPermanente && !forzar) {
          omitidas4xx++;
          continue;
        }

        // Backoff exponencial para reintentos de red a partir del segundo fallo (Subagente C)
        // El primer reintento tras reconexión se ejecuta de inmediato.
        if (!forzar && item.intentos > 1 && item.ultimoIntento) {
          const tiempoDesdeFallo = Date.now() - new Date(item.ultimoIntento).getTime();
          const esperaRequerida = Math.min(60000, 5000 * Math.pow(2, Math.min(item.intentos - 2, 4)));
          if (tiempoDesdeFallo < esperaRequerida) {
            console.log(`[SyncService] Ítem ${item.id} en backoff (${Math.round((esperaRequerida - tiempoDesdeFallo) / 1000)}s restantes).`);
            continue;
          }
        }

        try {
          this.notificar({
            enProgreso: true,
            pendientes: cola.length - exitosas,
            mensaje: `Sincronizando ${item.tipo.toLowerCase()}...`,
          });

          // X-Idempotency-Key generada al encolar (Subagente C y D)
          const idempotencyKey = item.idempotencyKey || item.id;

          switch (item.tipo) {
            case "ENTREGA":
            case "ENTREGA_CON_COBRO": {
              let payloadEntrega = normalizarPayloadEntregaCompuesta({
                ...item.payload,
                latitud: item.gps?.latitud || item.payload?.latitud || -19.0483,
                longitud: item.gps?.longitud || item.payload?.longitud || -65.2598,
              });

              // Subir foto general de comprobante si la tiene
              if (item.payload?.foto_uri && !item.payload?.id_comprobante_archivo) {
                const subida = await LogisticaApi.subirArchivoComprobante(
                  item.payload.foto_uri,
                  "COMPROBANTE_ENTREGA",
                  payloadEntrega.id_pedido || 0
                );
                if (subida.success) {
                  payloadEntrega.id_comprobante_archivo = subida.idComprobante;
                  payloadEntrega.url_comprobante = subida.urlArchivo;
                } else {
                  const err = new Error(subida.error || "Fallo al subir comprobante de entrega");
                  err.status = subida.status || 500;
                  throw err;
                }
              }

              // Subir fotos de comprobante dentro de los tramos de cobro (QR/Transferencia)
              if (payloadEntrega.cobro && Array.isArray(payloadEntrega.cobro.pagos)) {
                for (const tramo of payloadEntrega.cobro.pagos) {
                  if (tramo.foto_uri && !tramo.id_comprobante_archivo) {
                    const subida = await LogisticaApi.subirArchivoComprobante(
                      tramo.foto_uri,
                      "COMPROBANTE_COBRO",
                      payloadEntrega.id_pedido || 0
                    );
                    if (subida.success) {
                      tramo.id_comprobante_archivo = subida.idComprobante;
                      tramo.url_comprobante = subida.urlArchivo;
                    } else {
                      const err = new Error(subida.error || `Fallo al subir comprobante ${tramo.metodo}`);
                      err.status = subida.status || 500;
                      throw err;
                    }
                  } else if (
                    (tramo.metodo === "QR" || tramo.metodo === "TRANSFERENCIA") &&
                    !tramo.id_comprobante_archivo &&
                    !tramo.foto_uri
                  ) {
                    const err = new Error(`El método ${tramo.metodo} exige comprobante fotográfico.`);
                    err.status = 422;
                    throw err;
                  }
                }
              }

              // Limpiar campos efímeros de subida antes de enviar al backend central
              const payloadDespacho = { ...payloadEntrega };
              delete payloadDespacho.foto_uri;
              if (payloadDespacho.cobro && Array.isArray(payloadDespacho.cobro.pagos)) {
                payloadDespacho.cobro.pagos = payloadDespacho.cobro.pagos.map((pago) => {
                  const { foto_uri: _foto_uri, ...resto } = pago;
                  return resto;
                });
              }

              const resEntrega = await LogisticaApi.registrarEntrega(payloadDespacho, idempotencyKey);
              if (!resEntrega.success) {
                const err = new Error(resEntrega.error);
                err.status = resEntrega.status;
                err.serverDetail = resEntrega.serverDetail;
                throw err;
              }

              if (resEntrega.alertaRevalorizacion) {
                alertasRevalorizacion.push(resEntrega.alertaRevalorizacion);
              }

              // Refrescar datos locales tras entrega exitosa (Subagente C)
              const puntoVentaId = payloadEntrega.id_punto_venta || payloadEntrega.idPuntoVenta;
              if (puntoVentaId) {
                await LocalDB.actualizarEstadoParada(puntoVentaId, "ENTREGADO", payloadEntrega);
              }
              if (Array.isArray(payloadEntrega.items_entregados)) {
                await LocalDB.descontarInventarioCamion(payloadEntrega.items_entregados);
              }
              break;
            }

            case "COBRO": {
              let payloadCobro = {
                ...item.payload,
                latitud: item.gps?.latitud || item.payload?.latitud || -19.0483,
                longitud: item.gps?.longitud || item.payload?.longitud || -65.2598,
              };

              if (Array.isArray(payloadCobro.pagos)) {
                for (const tramo of payloadCobro.pagos) {
                  if (tramo.foto_uri && !tramo.id_comprobante_archivo) {
                    const subida = await LogisticaApi.subirArchivoComprobante(
                      tramo.foto_uri,
                      "COMPROBANTE_COBRO",
                      payloadCobro.id_pedido || 0
                    );
                    if (subida.success) {
                      tramo.id_comprobante_archivo = subida.idComprobante;
                      tramo.url_comprobante = subida.urlArchivo;
                    } else {
                      const err = new Error(subida.error || "Fallo al subir comprobante de cobro QR/Transferencia");
                      err.status = subida.status || 500;
                      throw err;
                    }
                  } else if (
                    (tramo.metodo === "QR" || tramo.metodo === "TRANSFERENCIA") &&
                    !tramo.id_comprobante_archivo &&
                    !tramo.foto_uri
                  ) {
                    const err = new Error(`El método ${tramo.metodo} exige comprobante fotográfico.`);
                    err.status = 422;
                    throw err;
                  }
                }
              } else if (item.payload?.foto_uri && !item.payload?.id_comprobante_archivo) {
                const subida = await LogisticaApi.subirArchivoComprobante(
                  item.payload.foto_uri,
                  "COMPROBANTE_COBRO",
                  payloadCobro.id_pedido || 0
                );
                if (subida.success) {
                  payloadCobro.id_comprobante_archivo = subida.idComprobante;
                  payloadCobro.url_comprobante = subida.urlArchivo;
                } else {
                  const err = new Error(subida.error || "Fallo al subir comprobante de pago");
                  err.status = subida.status || 500;
                  throw err;
                }
              }

              const resCobro = await LogisticaApi.registrarCobro(payloadCobro, idempotencyKey);
              if (!resCobro.success) {
                const err = new Error(resCobro.error);
                err.status = resCobro.status;
                throw err;
              }
              break;
            }

            case "NO_ENTREGA": {
              const resNoEntrega = await LogisticaApi.registrarNoEntrega(item.payload, idempotencyKey);
              if (!resNoEntrega.success) {
                const err = new Error(resNoEntrega.error);
                err.status = resNoEntrega.status;
                throw err;
              }
              break;
            }

            case "CLIENTE_EN_RUTA": {
              let payloadClienteRuta = { ...item.payload };

              // Subir fotos pendientes en tramos de cobro (QR o Transferencia) si viene con entrega_con_cobro
              if (payloadClienteRuta.entrega_con_cobro) {
                const entregaCobro = { ...payloadClienteRuta.entrega_con_cobro };

                if (entregaCobro.cobro && Array.isArray(entregaCobro.cobro.pagos)) {
                  for (const tramo of entregaCobro.cobro.pagos) {
                    if (tramo.foto_uri && !tramo.id_comprobante_archivo) {
                      const subida = await LogisticaApi.subirArchivoComprobante(
                        tramo.foto_uri,
                        "COMPROBANTE_COBRO",
                        0
                      );
                      if (subida.success) {
                        tramo.id_comprobante_archivo = subida.idComprobante;
                        tramo.url_comprobante = subida.urlArchivo;
                      } else {
                        const err = new Error(subida.error || `Fallo al subir comprobante ${tramo.metodo}`);
                        err.status = subida.status || 500;
                        throw err;
                      }
                    }
                  }

                  // Limpiar foto_uri efímera antes de despachar al servidor
                  entregaCobro.cobro.pagos = entregaCobro.cobro.pagos.map((p) => {
                    const { foto_uri: _f, ...resto } = p;
                    return resto;
                  });
                }

                payloadClienteRuta.entrega_con_cobro = entregaCobro;
              }

              const resClienteRuta = await ClientesApi.registrarClienteEnRuta(payloadClienteRuta, idempotencyKey);
              if (!resClienteRuta.success) {
                const err = new Error(resClienteRuta.error);
                err.status = resClienteRuta.status;
                err.serverDetail = resClienteRuta.serverDetail;
                throw err;
              }

              // Si fue entrega inmediata con stock entregado, asegurar descuento en inventario de camión local
              if (
                payloadClienteRuta.modalidad === "ENTREGA_INMEDIATA" &&
                Array.isArray(payloadClienteRuta.entrega_con_cobro?.items_entregados)
              ) {
                await LocalDB.descontarInventarioCamion(payloadClienteRuta.entrega_con_cobro.items_entregados);
              }

              // Si el servidor devolvió la ruta o paradas reordenadas, compactar y actualizar 1..N
              const paradasServidor = resClienteRuta.data?.paradas || resClienteRuta.data?.ruta?.paradas;
              if (Array.isArray(paradasServidor) && paradasServidor.length > 0) {
                await aplicarReordenamientoRuta(paradasServidor);
              }
              break;
            }

            case "ALTA_CLIENTE":
            case "NUEVO_CLIENTE": {
              const payloadCliente = {
                razon_social: item.payload?.razon_social || item.payload?.NombreCliente || item.payload?.razonSocial || "Cliente Ruta",
                nombre_comercial: item.payload?.nombre_comercial || item.payload?.NombrePuntoVenta || item.payload?.nombreComercial || null,
                nit_ci: item.payload?.nit_ci || item.payload?.NitCi || item.payload?.nitCi || null,
                telefono: item.payload?.telefono || item.payload?.Telefono || null,
                direccion: item.payload?.direccion || item.payload?.Direccion || "Sin direccion",
                zona: item.payload?.zona || item.payload?.Zona || null,
                tipo_negocio: item.payload?.tipo_negocio || item.payload?.tipoNegocio || null,
                observaciones: item.payload?.observaciones || item.payload?.Observaciones || null,
                latitud: item.gps?.latitud || item.payload?.latitud || item.payload?.Latitud || -19.0431,
                longitud: item.gps?.longitud || item.payload?.longitud || item.payload?.Longitud || -65.2592,
                id_ruta_distribucion: item.payload?.id_ruta_distribucion || item.payload?.IdRutaDistribucion || null,
              };

              const resCliente = await LogisticaApi.registrarNuevoCliente(payloadCliente, idempotencyKey);
              if (!resCliente.success) {
                const err = new Error(resCliente.error);
                err.status = resCliente.status;
                throw err;
              }
              break;
            }

            case "CIERRE_RUTA": {
              const resCierre = await LogisticaApi.registrarCierreTurno(item.payload, idempotencyKey);
              if (!resCierre.success) {
                const err = new Error(resCierre.error);
                err.status = resCierre.status;
                throw err;
              }
              break;
            }

            case "PING_GPS": {
              await LogisticaApi.enviarTelemetriaPing({
                ...item.payload,
                Latitud: item.gps?.latitud || 0,
                Longitud: item.gps?.longitud || 0,
                PrecisionMts: item.gps?.precision || 0,
              });
              break;
            }

            default:
              console.warn(`[SyncService] Tipo de operación desconocido: ${item.tipo}`);
              break;
          }

          // Remoción del ítem exitoso de la cola local
          await SyncQueue.removerOperacion(item.id);
          exitosas++;
          await LocalDB.guardarUltimaSincronizacion();
        } catch (error) {
          const status = error?.status || error?.response?.status || 500;
          const mensajeReal =
            error?.friendlyMessage ||
            error?.message ||
            (typeof error?.serverDetail?.mensaje === "string" ? error.serverDetail.mensaje : null) ||
            (typeof error?.serverDetail?.detail === "string" ? error.serverDetail.detail : null) ||
            "Error en la comunicación con el servidor.";

          const payloadSanitizado = sanitizarPayloadParaLog(item.payload);
          console.error(
            `[SyncService] Error en item ${item.id} (${item.tipo}) [HTTP ${status}]:`,
            mensajeReal,
            "Payload enviado:",
            JSON.stringify(payloadSanitizado)
          );

          fallidas++;
          await SyncQueue.registrarFalloOperacion(item.id, {
            status,
            message: mensajeReal,
            friendlyMessage: mensajeReal,
            codigo: error?.codigo || error?.code,
            response: error?.response,
            serverDetail: error?.serverDetail,
          });

          // Subagente B: Un 401 durante la sync pausa la cola; no cuenta como error del ítem ni lo descarta
          const msg = String(mensajeReal).toLowerCase();
          const es401 = status === 401 || msg.includes("token expirado") || msg.includes("sesión expirada");
          if (es401) {
            console.log("[SyncService] 401 detectado durante la sync. Pausando cola de sincronización.");
            this.notificar({
              enProgreso: false,
              mensaje: "Sesión expirada. Inicia sesión para sincronizar (tus datos están seguros).",
            });
            break;
          }

          // Si el error es de conectividad (offline / timeout / 5xx), pausar para no quemar intentos
          const esRed = error.isOffline || error.code === "ECONNABORTED" || msg.includes("network") || msg.includes("timeout") || status >= 500;
          if (esRed) {
            console.log("[SyncService] Conexión inestable o caída. Pausando ciclo de sincronización.");
            break;
          }

          // Si fue error 4xx de negocio, NO rompemos el bucle: el ítem quedó marcado 'esErrorPermanente: true'
          // y continuamos con el siguiente de la cola FIFO (Subagente C)
        }
      }

      const restantes = await SyncQueue.contarPendientes(usuarioIdActivo);
      this.notificar({
        enProgreso: false,
        pendientes: restantes,
        alertasRevalorizacion,
        mensaje: restantes === 0 ? "¡Todo sincronizado!" : `${restantes} operaciones guardadas en el teléfono, pendientes de enviar.`,
      });

      return {
        exito: true,
        procesadas: exitosas,
        fallidas,
        omitidas4xx,
        pendientes: restantes,
        alertasRevalorizacion,
      };
    } catch (globalError) {
      console.error("[SyncService] Error global en sincronización:", globalError);
      this.notificar({ enProgreso: false, error: globalError.message });
      return { exito: false, error: globalError.message };
    } finally {
      // Candado liberado SIEMPRE en finally (Subagente C)
      this.sincronizando = false;
      this.horaInicioSync = null;
    }
  }

  /**
   * Reordena y sincroniza la lista de paradas locales 1..N conservando el estado de las paradas atendidas (Subagente C)
   * @param {Array} paradasServidor - Paradas provistas por el backend o evento WebSocket
   */
  async actualizarRutaConReordenamiento(paradasServidor) {
    const actualizadas = await aplicarReordenamientoRuta(paradasServidor);
    this.notificar({
      enProgreso: false,
      mensaje: "Ruta reordenada y actualizada.",
      paradas: actualizadas,
    });
    return actualizadas;
  }

  /**
   * Inserta nuevo cliente en la secuencia tras la última parada atendida (Subagente C)
   */
  async insertarClienteEnRuta(paradaNueva, paradaActualOrden) {
    const actualizadas = await insertarNuevoClienteEnSecuencia(paradaNueva, paradaActualOrden);
    this.notificar({
      enProgreso: false,
      mensaje: "Cliente insertado en ruta.",
      paradas: actualizadas,
    });
    return actualizadas;
  }

  /**
   * Manejador del evento WebSocket 'ruta_reordenada' (Subagente C)
   * @param {Object} evento - Payload recibido por /ws/logistica
   */
  async procesarEventoRutaReordenada(evento) {
    console.log("[SyncService] Evento ruta_reordenada recibido:", evento);
    const paradas = evento?.paradas || evento?.ruta?.paradas || (Array.isArray(evento) ? evento : []);
    if (paradas.length > 0) {
      return await this.actualizarRutaConReordenamiento(paradas);
    }
    return null;
  }

  /**
   * Procesa la respuesta de GET /api/movil/v1/chofer/resumen-sincronizacion (Subagente C)
   * Actualiza paradas reordenadas conservando atendidas, e inventario en camión
   */
  async procesarResumenSincronizacion(datosResumen) {
    if (!datosResumen) return;

    if (datosResumen.asignacion_activa?.paradas) {
      await this.actualizarRutaConReordenamiento(datosResumen.asignacion_activa.paradas);
    }

    if (Array.isArray(datosResumen.inventario_camion)) {
      await LocalDB.guardarInventarioCamion({
        items: datosResumen.inventario_camion,
        total_saldo_camion: datosResumen.inventario_camion.reduce(
          (sum, i) => sum + Number(i.cantidad_disponible || i.saldo_camion || 0),
          0
        ),
      });
    }
  }
}

export const syncService = new SyncService();
