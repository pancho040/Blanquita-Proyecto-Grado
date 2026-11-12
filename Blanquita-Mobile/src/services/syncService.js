import { SyncQueue } from "../database/syncQueue";
import { LogisticaApi } from "../api/logisticaApi";
import { LocalDB } from "../database/localDb";

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
              let payloadEntrega = {
                ...item.payload,
                latitud: item.gps?.latitud || item.payload?.latitud || -19.0483,
                longitud: item.gps?.longitud || item.payload?.longitud || -65.2598,
              };

              // Subir foto general de comprobante si la tiene
              if (item.payload?.foto_uri && !item.payload?.id_comprobante_archivo) {
                const subida = await LogisticaApi.subirArchivoComprobante(
                  item.payload.foto_uri,
                  "COMPROBANTE_ENTREGA",
                  item.payload.id_pedido || 0
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

              const resEntrega = await LogisticaApi.registrarEntrega(payloadEntrega, idempotencyKey);
              if (!resEntrega.success) {
                const err = new Error(resEntrega.error);
                err.status = resEntrega.status;
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
          console.error(`[SyncService] Error en item ${item.id} (${item.tipo}):`, error.message);
          fallidas++;
          await SyncQueue.registrarFalloOperacion(item.id, error);

          // Subagente B: Un 401 durante la sync pausa la cola; no cuenta como error del ítem ni lo descarta
          const status = error?.status || error?.response?.status;
          const msg = String(error?.message || "").toLowerCase();
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
}

export const syncService = new SyncService();
