import { SyncQueue } from "../database/syncQueue";
import { LogisticaApi } from "../api/logisticaApi";
import { ClientesApi } from "../api/clientesApi";

/**
 * Motor de Sincronización Asíncrona Automática (Fase 2)
 * Cumple con HU-28 y Reglas 3 y 4 de Choferes Móviles:
 * 1. Procesa la cola secuencialmente con X-Idempotency-Key.
 * 2. Manejo diferido de fotos y firmas sin desbordar AsyncStorage (sube primero archivo y luego acción).
 * 3. Notificación de alerta de revalorización si el servidor recalcula precios.
 */
class SyncService {
  constructor() {
    this.sincronizando = false;
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
   * @param {boolean} forzar - Si es forzado por el usuario o automático
   */
  async procesarCola(_forzar = false) {
    if (this.sincronizando) {
      console.log("[SyncService] Ya hay una sincronización en curso.");
      return { exito: false, mensaje: "Sincronización ya en curso." };
    }

    this.sincronizando = true;
    this.notificar({ enProgreso: true, mensaje: "Iniciando sincronización..." });

    let exitosas = 0;
    let fallidas = 0;
    const alertasRevalorizacion = [];

    try {
      const cola = await SyncQueue.obtenerCola();
      if (cola.length === 0) {
        this.notificar({ enProgreso: false, pendientes: 0, mensaje: "Al día. Sin pendientes." });
        this.sincronizando = false;
        return { exito: true, procesadas: 0, pendientes: 0 };
      }

      console.log(`[SyncService] Procesando ${cola.length} operaciones pendientes...`);

      for (const item of cola) {
        try {
          this.notificar({
            enProgreso: true,
            pendientes: cola.length - exitosas,
            mensaje: `Sincronizando ${item.tipo.toLowerCase()}...`,
          });

          const idempotencyKey = item.idempotencyKey || item.id;

          // Procesar según el tipo de operación
          switch (item.tipo) {
            case "ENTREGA": {
              // HU-31: Registrar entrega física (total/parcial)
              let payloadEntrega = {
                ...item.payload,
                latitud: item.gps?.latitud || item.payload?.latitud || -19.0483,
                longitud: item.gps?.longitud || item.payload?.longitud || -65.2598,
              };

              // Regla 4: Si tiene archivo de foto comprobante local, subirlo primero
              if (item.payload?.foto_uri && !item.payload?.id_comprobante_archivo) {
                const subida = await LogisticaApi.subirArchivoComprobante(
                  item.payload.foto_uri,
                  "COMPROBANTE_ENTREGA",
                  item.payload.id_pedido || 0
                );
                if (subida.success) {
                  payloadEntrega.id_comprobante_archivo = subida.idComprobante;
                  payloadEntrega.url_comprobante = subida.urlArchivo;
                } else if (subida.status >= 500 || !subida.status) {
                  // Fallo de red/servidor al subir archivo: no procesar entrega para reintentar luego
                  throw new Error(subida.error || "Fallo al subir foto de comprobante");
                }
              }

              const resEntrega = await LogisticaApi.registrarEntrega(payloadEntrega, idempotencyKey);
              if (!resEntrega.success) {
                const err = new Error(resEntrega.error);
                err.status = resEntrega.status;
                throw err;
              }

              // Detectar alerta de revalorización emitida por el servidor
              if (resEntrega.alertaRevalorizacion) {
                alertasRevalorizacion.push(resEntrega.alertaRevalorizacion);
                console.log("[SyncService] ALERTA DE REVALORIZACIÓN:", resEntrega.alertaRevalorizacion);
              }
              break;
            }

            case "COBRO": {
              // HU-32: Registrar cobro (simple o mixto)
              let payloadCobro = {
                ...item.payload,
                latitud: item.gps?.latitud || item.payload?.latitud || -19.0483,
                longitud: item.gps?.longitud || item.payload?.longitud || -65.2598,
              };

              // Regla 4: Subir fotos locales de tramos QR/Transferencia antes de despachar cobro
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
                    } else if (subida.status >= 500 || !subida.status) {
                      throw new Error(subida.error || "Fallo al subir comprobante de cobro QR/Transferencia");
                    }
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
                } else if (subida.status >= 500 || !subida.status) {
                  throw new Error(subida.error || "Fallo al subir comprobante de pago");
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

            case "NUEVO_CLIENTE": {
              const payloadCliente = {
                ...item.payload,
                Latitud: item.gps?.latitud || item.payload?.Latitud,
                Longitud: item.gps?.longitud || item.payload?.Longitud,
              };
              await ClientesApi.crearCliente(payloadCliente);
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

          // Si llegó aquí, fue exitosa: remover de la cola local
          await SyncQueue.removerOperacion(item.id);
          exitosas++;
        } catch (error) {
          console.error(`[SyncService] Error en item ${item.id} (${item.tipo}):`, error.message);
          fallidas++;
          await SyncQueue.registrarFalloOperacion(item.id, error);

          // Si el error es de conectividad (offline), detener bucle
          if (error.isOffline || error.code === "ECONNABORTED" || error.message?.includes("Network")) {
            console.log("[SyncService] Red no disponible. Pausando sincronización.");
            break;
          }
        }
      }

      const restantes = await SyncQueue.contarPendientes();
      this.notificar({
        enProgreso: false,
        pendientes: restantes,
        alertasRevalorizacion,
        mensaje: restantes === 0 ? "¡Todo sincronizado!" : `${restantes} operaciones pendientes.`,
      });

      return {
        exito: true,
        procesadas: exitosas,
        fallidas,
        pendientes: restantes,
        alertasRevalorizacion,
      };
    } catch (globalError) {
      console.error("[SyncService] Error global en sincronización:", globalError);
      this.notificar({ enProgreso: false, error: globalError.message });
      return { exito: false, error: globalError.message };
    } finally {
      this.sincronizando = false;
    }
  }
}

export const syncService = new SyncService();
