import { SyncQueue } from "../database/syncQueue";
import { LogisticaApi } from "../api/logisticaApi";
import { ClientesApi } from "../api/clientesApi";
import { LocalDB } from "../database/localDb";

/**
 * Motor de Sincronización Asíncrona Automática
 * Cumple con HU-28: Sincronización automática de datos cifrados
 * Procesa la cola secuencialmente cuando se restablece la conexión
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
  async procesarCola(forzar = false) {
    if (this.sincronizando) {
      console.log("[SyncService] Ya hay una sincronización en curso.");
      return { exito: false, mensaje: "Sincronización ya en curso." };
    }

    this.sincronizando = true;
    this.notificar({ enProgreso: true, mensaje: "Iniciando sincronización..." });

    let exitosas = 0;
    let fallidas = 0;

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

          // Procesar según el tipo de operación
          switch (item.tipo) {
            case "ENTREGA": {
              // HU-31: Registrar entrega de pedido con coordenadas GPS
              const payloadEntrega = {
                ...item.payload,
                gps: item.gps,
                fechaRegistroMovil: item.fechaCreacion,
              };
              await LogisticaApi.registrarEntrega(payloadEntrega);
              break;
            }

            case "COBRO": {
              // HU-32: Registrar cobro a cliente con coordenadas GPS
              const payloadCobro = {
                ...item.payload,
                gps: item.gps,
                fechaRegistroMovil: item.fechaCreacion,
              };
              await LogisticaApi.registrarCobro(payloadCobro);
              break;
            }

            case "NUEVO_CLIENTE": {
              // HU-29: Registrar nuevo cliente creado en campo
              const payloadCliente = {
                ...item.payload,
                Latitud: item.gps.latitud,
                Longitud: item.gps.longitud,
              };
              await ClientesApi.crearCliente(payloadCliente);
              break;
            }

            case "CIERRE_RUTA": {
              // HU-34: Enviar paquete de liquidación y cierre de ruta
              await LogisticaApi.cerrarYLiquidarRuta(
                item.payload.idAsignacion,
                item.payload
              );
              break;
            }

            case "PING_GPS": {
              // HU-33: Telemetría de posición en tiempo real
              await LogisticaApi.enviarTelemetriaPing({
                ...item.payload,
                Latitud: item.gps.latitud,
                Longitud: item.gps.longitud,
                PrecisionMts: item.gps.precision,
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
          await SyncQueue.registrarFalloOperacion(item.id, error.friendlyMessage || error.message);

          // Si el error es de conectividad (offline), detenemos el bucle para no reintentar en vano
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
        mensaje: restantes === 0 ? "¡Todo sincronizado!" : `${restantes} operaciones pendientes.`,
      });

      return {
        exito: true,
        procesadas: exitosas,
        fallidas,
        pendientes: restantes,
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
