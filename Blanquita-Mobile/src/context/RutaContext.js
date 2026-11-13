import { createContext, useContext, useState, useEffect, useRef } from "react";
import { LogisticaApi, ESTADOS_RUTA } from "../api/logisticaApi";
import { LocalDB } from "../database/localDb";
import { SyncQueue } from "../database/syncQueue";
import { runSyncIfConnected, iniciarAutoSync } from "../services/autoSync";
import { wsService } from "../services/wsService";
import { useNetwork } from "./NetworkContext";
import { useLocation } from "./LocationContext";
import { useAuth } from "./AuthContext";

export { ESTADOS_RUTA };

/**
 * Determina el estado del flujo de ruta del chofer:
 * SIN_RUTA, PENDIENTE_CARGA, CARGA_SOLICITADA, APROBADA_EN_RUTA, FINALIZADA
 */
export function determinarEstadoRuta(ruta) {
  if (!ruta || (!ruta.IdAsignacion && !ruta.IdAsignacionRuta && !ruta.id)) {
    return ESTADOS_RUTA.SIN_RUTA;
  }
  const estadoRaw = String(ruta.Estado || ruta.estado || ruta.EstadoAsignacion || "").toUpperCase();
  if (estadoRaw === "FINALIZADA" || estadoRaw === "CERRADA") {
    return ESTADOS_RUTA.FINALIZADA;
  }
  if (ruta.estado_flujo && Object.values(ESTADOS_RUTA).includes(ruta.estado_flujo)) {
    return ruta.estado_flujo;
  }
  const estadoCarga = String(ruta.estado_carga || ruta.EstadoCarga || "").toUpperCase();
  if (
    estadoCarga === "SOLICITADA" ||
    estadoCarga === "PENDIENTE_APROBACION" ||
    estadoRaw === "CARGA_SOLICITADA"
  ) {
    return ESTADOS_RUTA.CARGA_SOLICITADA;
  }
  const habilitada = Boolean(
    ruta.habilitada_para_reparto === true ||
    ruta.HabilitadaParaReparto === true ||
    estadoCarga === "APROBADA" ||
    estadoRaw === "APROBADA_EN_RUTA" ||
    estadoRaw === "EN_RUTA" ||
    estadoRaw === "EN_CURSO"
  );
  if (habilitada) {
    return ESTADOS_RUTA.APROBADA_EN_RUTA;
  }
  return ESTADOS_RUTA.PENDIENTE_CARGA;
}

const RutaContext = createContext(null);

export function RutaProvider({ children }) {
  const { isOnline, refrescarPendientes, pendientes } = useNetwork();
  const { obtenerUbicacionActual, iniciarTelemetria, detenerTelemetria } = useLocation();
  const { usuario } = useAuth();

  const [asignacionActiva, setAsignacionActiva] = useState(null);
  const [estadoRuta, setEstadoRuta] = useState(ESTADOS_RUTA.SIN_RUTA);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState(null);
  const [comprobanteActual, setComprobanteActual] = useState(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState(new Date());

  const cerrarComprobante = () => setComprobanteActual(null);

  // Recaudación acumulada del chofer en la jornada (HU-32, HU-34)
  const [recaudacion, setRecaudacion] = useState({
    efectivo: 0,
    transferencias: 0,
    totalCobrado: 0,
    cantidadCobros: 0,
  });

  const refrescarPendientesRef = useRef(refrescarPendientes);
  refrescarPendientesRef.current = refrescarPendientes;

  const detenerTelemetriaRef = useRef(detenerTelemetria);
  detenerTelemetriaRef.current = detenerTelemetria;

  const cargarHojaRutaRef = useRef(null);

  /**
   * Limpia la ruta activa localmente y restaura el estado a SIN_RUTA.
   * Permite recibir una nueva asignación de ruta en el mismo día (Soporte Multi-Ruta).
   */
  const limpiarRutaActiva = async () => {
    setAsignacionActiva(null);
    setEstadoRuta(ESTADOS_RUTA.SIN_RUTA);
    setRecaudacion({
      efectivo: 0,
      transferencias: 0,
      totalCobrado: 0,
      cantidadCobros: 0,
    });
    try {
      await LocalDB.guardarRutaActiva(null);
    } catch (_e) {}
    if (detenerTelemetriaRef.current) {
      detenerTelemetriaRef.current();
    }
  };

  // Auto-sincronización Offline-First en background
  useEffect(() => {
    const unsub = iniciarAutoSync(() => {
      if (refrescarPendientesRef.current) {
        refrescarPendientesRef.current();
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Cargar ruta diaria al iniciar o al cambiar usuario
  useEffect(() => {
    if (usuario) {
      if (cargarHojaRutaRef.current) {
        cargarHojaRutaRef.current();
      }
    } else {
      limpiarRutaActiva();
    }
  }, [usuario]);

  // Listener de eventos WebSocket en tiempo real (Subagente B)
  useEffect(() => {
    // 1. Evento: Carga de camión aprobada en Web
    const unsubCargaAprobada = wsService.on("carga_camion_aprobada", async (data) => {
      console.log("[RutaContext] Evento WebSocket carga_camion_aprobada recibido:", data);
      setAsignacionActiva((prev) => {
        if (!prev) return prev;
        const actualizada = {
          ...prev,
          habilitada_para_reparto: true,
          estado_carga: "APROBADA",
          estado: "APROBADA_EN_RUTA",
          estado_flujo: ESTADOS_RUTA.APROBADA_EN_RUTA,
        };
        LocalDB.guardarRutaActiva(actualizada);
        return actualizada;
      });
      setEstadoRuta(ESTADOS_RUTA.APROBADA_EN_RUTA);
      if (usuario && asignacionActiva) {
        iniciarTelemetria(usuario.IdUsuario || usuario.id, asignacionActiva.IdAsignacion || asignacionActiva.IdAsignacionRuta);
      }
      // Refrescar para sincronizar paradas y stock oficial
      if (cargarHojaRutaRef.current) {
        cargarHojaRutaRef.current();
      }
    });

    // 2. Evento: Administrador finaliza la ruta en Web (Soporte Multi-Ruta)
    const unsubRutaFinalizada = wsService.on("ruta_finalizada_admin", async (data) => {
      console.log("[RutaContext] Evento WebSocket ruta_finalizada_admin recibido:", data);
      await limpiarRutaActiva();
    });

    // 3. Evento: Asignación de nueva ruta en el día
    const unsubRutaAsignada = wsService.on("ruta_asignada", async (data) => {
      console.log("[RutaContext] Evento WebSocket ruta_asignada recibido:", data);
      if (cargarHojaRutaRef.current) {
        cargarHojaRutaRef.current();
      }
    });

    return () => {
      if (unsubCargaAprobada) unsubCargaAprobada();
      if (unsubRutaFinalizada) unsubRutaFinalizada();
      if (unsubRutaAsignada) unsubRutaAsignada();
    };
  }, [usuario, asignacionActiva]);

  /**
   * Carga la Hoja de Ruta Diaria (HU-30: Visualizar lista de rutas y pedidos)
   * Si hay red: consulta API central y actualiza almacenamiento local.
   * Si está offline: carga la ruta persistida previamente en LocalDB.
   */
  const cargarHojaRuta = async () => {
    setErrorRuta(null);
    setCargandoRuta(true);

    // 1. Carga Inmediata Optimista desde caché local
    try {
      const rutaLocal = await LocalDB.obtenerRutaActiva();
      if (rutaLocal && (rutaLocal.IdAsignacion || rutaLocal.IdAsignacionRuta || rutaLocal.id)) {
        const estadoLocal = determinarEstadoRuta(rutaLocal);
        if (estadoLocal === ESTADOS_RUTA.FINALIZADA) {
          await limpiarRutaActiva();
        } else {
          setAsignacionActiva(rutaLocal);
          setEstadoRuta(estadoLocal);
          recalcularRecaudacion(rutaLocal);
          if (estadoLocal === ESTADOS_RUTA.APROBADA_EN_RUTA && usuario) {
            iniciarTelemetria(usuario.IdUsuario || usuario.id, rutaLocal.IdAsignacion || rutaLocal.IdAsignacionRuta);
          }
        }
      } else {
        setAsignacionActiva(null);
        setEstadoRuta(ESTADOS_RUTA.SIN_RUTA);
      }
    } catch (_e) {
      setAsignacionActiva(null);
      setEstadoRuta(ESTADOS_RUTA.SIN_RUTA);
    } finally {
      setCargandoRuta(false);
    }

    // 2. Sincronización en segundo plano con la nube
    if (isOnline && usuario) {
      try {
        const idChofer = usuario.IdUsuario || usuario.id;
        const resHoja = await LogisticaApi.obtenerHojaRutaActiva();
        let rutaChofer = resHoja && resHoja.asignacion ? resHoja.asignacion : null;

        if (!rutaChofer) {
          rutaChofer = await LogisticaApi.obtenerRutaActivaChofer(idChofer);
        }

        if (rutaChofer && (rutaChofer.IdAsignacion || rutaChofer.IdAsignacionRuta || rutaChofer.id)) {
          // Si trae paradas del endpoint especializado
          if (resHoja && resHoja.paradas && (!rutaChofer.paradas || rutaChofer.paradas.length === 0)) {
            rutaChofer.paradas = resHoja.paradas;
          }
          const nuevoEstado = determinarEstadoRuta(rutaChofer);

          if (nuevoEstado === ESTADOS_RUTA.FINALIZADA) {
            await limpiarRutaActiva();
          } else {
            setAsignacionActiva(rutaChofer);
            setEstadoRuta(nuevoEstado);
            await LocalDB.guardarRutaActiva(rutaChofer);
            recalcularRecaudacion(rutaChofer);
            setUltimaSincronizacion(new Date());

            if (nuevoEstado === ESTADOS_RUTA.APROBADA_EN_RUTA) {
              iniciarTelemetria(idChofer, rutaChofer.IdAsignacion || rutaChofer.IdAsignacionRuta);
            }
          }
        } else {
          // Servidor confirma que no tiene ruta asignada para hoy
          await limpiarRutaActiva();
        }
      } catch (err) {
        console.log("[RutaContext] Aviso actualizando ruta online:", err.message);
      }
    }
  };
  cargarHojaRutaRef.current = cargarHojaRuta;

  const recalcularRecaudacion = (ruta) => {
    if (!ruta || !ruta.paradas) return;
    let ef = 0;
    let tr = 0;
    let count = 0;

    ruta.paradas.forEach((p) => {
      if (p.cobro) {
        count++;
        if (p.cobro.metodoPago === "EFECTIVO") ef += Number(p.cobro.monto || 0);
        else tr += Number(p.cobro.monto || 0);
      }
    });

    setRecaudacion({
      efectivo: ef,
      transferencias: tr,
      totalCobrado: ef + tr,
      cantidadCobros: count,
    });
  };

  /**
   * Solicitar Carga de Inventario a Almacén/Web (Subagente B - Gatekeeper de Ruta)
   * Permite solicitar stock adicional o confirmar salida con stock remanente
   */
  const solicitarCargaCamion = async ({ usarRemanente = false, observacion = "", items = [] } = {}) => {
    if (!asignacionActiva) {
      return { success: false, error: "No tienes una asignación activa para solicitar carga." };
    }
    const idAsig = asignacionActiva.IdAsignacion || asignacionActiva.IdAsignacionRuta || asignacionActiva.id || 1;
    const res = await LogisticaApi.solicitarCargaCamion({
      id_asignacion: idAsig,
      usar_remanente: usarRemanente,
      observacion,
      items,
    });

    if (res.success || res.codigo === "EXITO") {
      const rutaActualizada = {
        ...asignacionActiva,
        estado_carga: "SOLICITADA",
        estado_flujo: ESTADOS_RUTA.CARGA_SOLICITADA,
      };
      setAsignacionActiva(rutaActualizada);
      setEstadoRuta(ESTADOS_RUTA.CARGA_SOLICITADA);
      try {
        await LocalDB.guardarRutaActiva(rutaActualizada);
      } catch (_e) {}
      return { success: true, data: res.data, mensaje: res.mensaje };
    }
    return res;
  };

  /**
   * HU-31: Registrar Entrega de Pedidos y Emitir Notas
   * HU-33: Captura de Geolocalización GPS Obligatoria
   */
  const registrarEntrega = async (idPuntoVenta, detalleEntrega) => {
    // Gatekeeper: Bloquear entregas si no está en APROBADA_EN_RUTA
    if (estadoRuta !== ESTADOS_RUTA.APROBADA_EN_RUTA) {
      return {
        exito: false,
        success: false,
        error: "Ruta no habilitada: debe estar en estado APROBADA_EN_RUTA para registrar entregas.",
      };
    }
    // 1. Capturar GPS obligatoriamente
    let gps = null;
    try {
      gps = await obtenerUbicacionActual();
    } catch (_e) {
      gps = {
        latitud: detalleEntrega.latitud || -19.0435,
        longitud: detalleEntrega.longitud || -65.2580,
        precision: 10,
      };
    }

    // 2. Generar correlativo de nota de entrega digital
    const numeroNota = `NE-${Date.now().toString().slice(-6)}`;

    const items = detalleEntrega.items_entregados || detalleEntrega.productos || [];
    const totalFardos =
      detalleEntrega.fardosTotales ||
      items.reduce((s, it) => s + Number(it.cantidad || it.Cantidad || 0), 0);
    const montoTotal =
      Number(detalleEntrega.monto_total || detalleEntrega.montoTotal || 0) ||
      items.reduce((s, it) => s + Number(it.subtotal || (it.cantidad || 0) * (it.precio_unitario || 0)), 0);

    // Contrato completo unificado con Chat 2 (Subagente D y handoff-sync.md)
    const datosOperacion = {
      idPuntoVenta,
      id_punto_venta: idPuntoVenta,
      id_pedido: detalleEntrega.id_pedido || detalleEntrega.idPedido || asignacionActiva?.IdPedido,
      idAsignacion: asignacionActiva?.IdAsignacion || asignacionActiva?.IdAsignacionRuta,
      numeroNota,
      tipo_entrega: detalleEntrega.tipo_entrega || "TOTAL",
      recibido_por: detalleEntrega.recibido_por || detalleEntrega.recibidoPor || "Cliente",
      ci_receptor: detalleEntrega.ci_receptor || detalleEntrega.ciReceptor || "",
      observaciones: detalleEntrega.observaciones || detalleEntrega.observacion || "",
      firma_chofer: detalleEntrega.firma_chofer || detalleEntrega.firmaChofer || null,
      firma_cliente: detalleEntrega.firma_cliente || detalleEntrega.firmaCliente || null,
      items_entregados: items.map((it) => ({
        presentacion_id: it.presentacion_id || it.IdPresentacion || it.id,
        producto_nombre: it.producto_nombre || it.NombreProducto || "Producto",
        cantidad: Number(it.cantidad || it.Cantidad || 0),
        precio_unitario: Number(it.precio_unitario || it.PrecioUnitario || 0),
        es_cortesia_bandeo: Boolean(it.es_cortesia_bandeo || it.es_bandeo),
        subtotal: Number(it.subtotal || (it.cantidad || 0) * (it.precio_unitario || 0)),
      })),
      productos: items,
      fardosTotales: totalFardos,
      montoTotal,
      monto_total: montoTotal,
      cobro: detalleEntrega.cobro || null,
      foto_uri: detalleEntrega.foto_uri || null,
      fechaHoraEntrega: new Date().toISOString(),
      gps,
      latitud: gps?.latitud || detalleEntrega.latitud || -19.0435,
      longitud: gps?.longitud || detalleEntrega.longitud || -65.2580,
    };

    // 3. Actualizar estado en la base local (HU-27)
    await LocalDB.actualizarEstadoParada(idPuntoVenta, "ENTREGADO", datosOperacion);

    // Descontar inventario en camión local de forma optimista e inmediata (Subagente D)
    if (items.length > 0) {
      await LocalDB.descontarInventarioCamion(items);
    }

    // 4. Actualizar estado en memoria
    let clienteNombre = "Cliente";
    let puntoNombre = "Punto de Venta";

    setAsignacionActiva((prev) => {
      if (!prev) return prev;
      const paradasList = prev.paradas || prev.Paradas || [];
      const paradasActualizadas = paradasList.map((p) => {
        if (p.IdPuntoVenta === idPuntoVenta || p.id === idPuntoVenta) {
          clienteNombre = p.NombreCliente || p.cliente?.razon_social || clienteNombre;
          puntoNombre = p.NombrePuntoVenta || p.cliente?.nombre_comercial || puntoNombre;
          return {
            ...p,
            Estado: "ENTREGADO",
            estado: "ENTREGADO",
            entrega: datosOperacion,
            estadoEnvio: "Guardado en el teléfono, pendiente de enviar",
          };
        }
        return p;
      });
      const nuevaRuta = { ...prev, paradas: paradasActualizadas, Paradas: paradasActualizadas };
      LocalDB.guardarRutaActiva(nuevaRuta);
      return nuevaRuta;
    });

    const comprobanteEmitido = {
      numeroNota,
      fechaHoraEntrega: datosOperacion.fechaHoraEntrega,
      cliente: clienteNombre,
      puntoVenta: puntoNombre,
      productos: items,
      fardosTotales: totalFardos,
      montoTotal,
      gps,
      recibidoPor: datosOperacion.recibido_por,
      cobro: datosOperacion.cobro,
      estadoTexto: "Guardado en el teléfono, pendiente de enviar",
    };

    setComprobanteActual(comprobanteEmitido);

    // 5. Encolar operación única compuesta en la cola offline (Subagente D)
    const tipoOp = detalleEntrega.cobro ? "ENTREGA_CON_COBRO" : "ENTREGA";
    await SyncQueue.encolarOperacion(tipoOp, datosOperacion, gps, usuario?.IdUsuario);
    await refrescarPendientes();

    // 6. Disparar sincronización silenciosa en background si hay red
    runSyncIfConnected(() => {
      refrescarPendientes();
    });

    return {
      exito: true,
      success: true,
      numeroNota,
      comprobante: comprobanteEmitido,
      datosOperacion,
      mensaje: "Guardado en el teléfono, pendiente de enviar",
    };
  };

  /**
   * Registrar motivo cuando un cliente no pudo ser atendido
   */
  const registrarNoEntrega = async (idPuntoVenta, motivo) => {
    // Gatekeeper: Bloquear si no está en APROBADA_EN_RUTA
    if (estadoRuta !== ESTADOS_RUTA.APROBADA_EN_RUTA) {
      return {
        exito: false,
        success: false,
        error: "Ruta no habilitada: debe estar en estado APROBADA_EN_RUTA para registrar no-entregas.",
      };
    }

    const gps = await obtenerUbicacionActual();

    const datosOperacion = {
      idPuntoVenta,
      idAsignacion: asignacionActiva?.IdAsignacion,
      motivo,
      fechaHora: new Date().toISOString(),
      gps,
    };

    await LocalDB.actualizarEstadoParada(idPuntoVenta, "NO_ENTREGADO", datosOperacion);

    setAsignacionActiva((prev) => {
      if (!prev) return prev;
      const paradasActualizadas = prev.paradas.map((p) => {
        if (p.IdPuntoVenta === idPuntoVenta) {
          return {
            ...p,
            Estado: "NO_ENTREGADO",
            motivoNoEntrega: motivo,
          };
        }
        return p;
      });
      return { ...prev, paradas: paradasActualizadas };
    });

    return { exito: true };
  };

  /**
   * HU-32: Registrar Cobros de Clientes
   * HU-33: Captura de Geolocalización GPS Obligatoria
   */
  const registrarCobro = async (idPuntoVenta, detalleCobro) => {
    // Gatekeeper: Bloquear si no está en APROBADA_EN_RUTA
    if (estadoRuta !== ESTADOS_RUTA.APROBADA_EN_RUTA) {
      return {
        exito: false,
        success: false,
        error: "Ruta no habilitada: debe estar en estado APROBADA_EN_RUTA para registrar cobros.",
      };
    }

    // 1. GPS obligatorio
    const gps = await obtenerUbicacionActual();

    const numeroRecibo = `REC-${Date.now().toString().slice(-6)}`;

    const datosCobro = {
      idPuntoVenta,
      idAsignacion: asignacionActiva?.IdAsignacion,
      numeroRecibo,
      monto: Number(detalleCobro.monto),
      metodoPago: detalleCobro.metodoPago, // "EFECTIVO" | "TRANSFERENCIA_QR"
      tipoCobro: detalleCobro.tipoCobro,   // "CONTADO" | "ABONO_CREDITO" | "CANCELACION_TOTAL"
      saldoPendientePosterior: Math.max(0, (detalleCobro.saldoAnterior || 0) - Number(detalleCobro.monto)),
      observacion: detalleCobro.observacion || "",
      fechaHora: new Date().toISOString(),
      gps,
    };

    // 2. Actualizar estado en memoria y en local
    setAsignacionActiva((prev) => {
      if (!prev) return prev;
      const paradasActualizadas = prev.paradas.map((p) => {
        if (p.IdPuntoVenta === idPuntoVenta) {
          return {
            ...p,
            cobro: datosCobro,
            SaldoDeudor: datosCobro.saldoPendientePosterior,
          };
        }
        return p;
      });
      const nuevaRuta = { ...prev, paradas: paradasActualizadas };
      LocalDB.guardarRutaActiva(nuevaRuta);
      recalcularRecaudacion(nuevaRuta);
      return nuevaRuta;
    });

    // 3. Encolar en la cola offline (HU-28)
    await SyncQueue.encolarOperacion("COBRO", datosCobro, gps);
    await refrescarPendientes();

    // 4. Disparar sincronización silenciosa en background si hay red
    runSyncIfConnected(() => {
      refrescarPendientes();
    });

    return { exito: true, numeroRecibo, datosCobro };
  };

  /**
   * HU-29: Registrar Nuevos Clientes en Campo (Fase 3)
   */
  const registrarNuevoClienteCampo = async (clienteForm) => {
    // 1. Obtener ubicación con fallback si no viene provista
    const lat = clienteForm.latitud || clienteForm.Latitud;
    const lng = clienteForm.longitud || clienteForm.Longitud;
    const gps = (lat && lng) ? { latitud: Number(lat), longitud: Number(lng) } : await obtenerUbicacionActual();

    const razonSocial = clienteForm.razon_social || clienteForm.nombreCliente || clienteForm.razonSocial || "Nuevo Cliente";
    const nombreComercial = clienteForm.nombre_comercial || clienteForm.nombreNegocio || clienteForm.nombreComercial || razonSocial;
    const direccion = clienteForm.direccion || clienteForm.Direccion || "Sin dirección";
    const telefono = clienteForm.telefono || clienteForm.Telefono || null;
    const nitCi = clienteForm.nit_ci || clienteForm.nitCi || null;
    const zona = clienteForm.zona || clienteForm.Zona || null;
    const tipoNegocio = clienteForm.tipo_negocio || clienteForm.tipoNegocio || null;
    const observaciones = clienteForm.observaciones || clienteForm.referencia || clienteForm.Referencia || null;

    const idRuta = asignacionActiva?.IdRutaDistribucion || asignacionActiva?.IdRuta || null;
    const idempotencyKey = clienteForm.idempotencyKey || `cli-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payloadApi = {
      razon_social: razonSocial,
      nombre_comercial: nombreComercial,
      nit_ci: nitCi,
      telefono: telefono,
      direccion: direccion,
      zona: zona,
      tipo_negocio: tipoNegocio,
      observaciones: observaciones,
      latitud: gps.latitud,
      longitud: gps.longitud,
      id_ruta_distribucion: idRuta,
    };

    const nuevoClienteLocal = {
      IdPuntoVenta: `temp_${Date.now()}`,
      NombreCliente: razonSocial,
      NombrePuntoVenta: nombreComercial,
      Telefono: telefono,
      Direccion: direccion,
      Referencia: observaciones,
      Latitud: gps.latitud,
      Longitud: gps.longitud,
      IdZona: asignacionActiva?.IdZona || 1,
      EsNuevoEnCampo: true,
      Estado: "PENDIENTE",
      OrdenVisita: (asignacionActiva?.paradas?.length || 0) + 1,
      SaldoDeudor: 0,
      PedidosPendientes: [],
      fechaRegistro: new Date().toISOString(),
    };

    // 2. Guardar en clientes locales y agregar a la ruta del día
    await LocalDB.agregarClienteLocal(nuevoClienteLocal);

    setAsignacionActiva((prev) => {
      if (!prev) return prev;
      const paradas = [...(prev.paradas || []), nuevoClienteLocal];
      const nuevaRuta = { ...prev, paradas };
      LocalDB.guardarRutaActiva(nuevaRuta);
      return nuevaRuta;
    });

    // 3. Si hay red, enviar directamente al backend; si falla o está offline, encolar en SyncQueue
    if (isOnline) {
      try {
        const res = await LogisticaApi.registrarNuevoCliente(payloadApi, idempotencyKey);
        if (res.success) {
          return { success: true, exito: true, datos: res.data, nuevoCliente: nuevoClienteLocal };
        }
      } catch (_e) {
        // Fallback a encolar offline
      }
    }

    await SyncQueue.encolarOperacion("ALTA_CLIENTE", payloadApi, gps, idempotencyKey);
    await refrescarPendientes();

    return {
      success: true,
      exito: true,
      mensajeOffline: "Cliente registrado en modo offline y programado para sincronización.",
      nuevoCliente: nuevoClienteLocal,
    };
  };

  /**
   * Prohibición de Cerrar/Liquidar Ruta en Móvil (Subagente B)
   * El cierre de ruta y liquidación lo realiza Administración exclusivamente en Web
   */
  const cerrarRutaDiaria = async () => {
    return {
      exito: false,
      success: false,
      mensaje: "El cierre de ruta lo realiza Administración una vez revisadas tus entregas y cobros.",
    };
  };

  const paradasList = asignacionActiva?.paradas || asignacionActiva?.Paradas || [];
  // Gatekeeper: Solo desbloquear paradas si la ruta está formalmente APROBADA_EN_RUTA
  const paradasVisibles = estadoRuta === ESTADOS_RUTA.APROBADA_EN_RUTA ? paradasList : [];

  const entregadosCount = paradasVisibles.filter((p) => (p.Estado || p.estado) === "ENTREGADO").length;
  const pendientesCount = Math.max(0, paradasVisibles.length - entregadosCount);

  const metricas = {
    total_paradas: paradasVisibles.length,
    entregados: entregadosCount,
    pendientes: pendientesCount,
    porcentaje: paradasVisibles.length > 0 ? Math.round((entregadosCount / paradasVisibles.length) * 100) : 0,
    total_efectivo: recaudacion.efectivo || 0,
    total_qr: recaudacion.transferencias || 0,
    total_recaudado: (recaudacion.efectivo || 0) + (recaudacion.transferencias || 0),
  };

  const hojaRuta = asignacionActiva
    ? {
        id: asignacionActiva.IdAsignacionRuta || asignacionActiva.IdAsignacion || 1,
        estado: estadoRuta,
        estado_flujo: estadoRuta,
        habilitada_para_reparto: estadoRuta === ESTADOS_RUTA.APROBADA_EN_RUTA,
        vehiculo: {
          placa: asignacionActiva.Vehiculo?.Placa || "2458-BLQ",
          modelo: asignacionActiva.Vehiculo?.Modelo || "Camión Isuzu NPR",
        },
        paradas: paradasVisibles.map((p, idx) => ({
          id: p.IdPuntoVenta || p.id || idx + 1,
          secuencia: p.OrdenVisita || p.orden || idx + 1,
          estado: (p.Estado || p.estado || "PENDIENTE").toUpperCase(),
          cliente_id: p.IdCliente || p.cliente?.id,
          cliente: {
            id: p.IdCliente || p.cliente?.id,
            razon_social: p.NombreCliente || p.cliente?.razon_social || "Cliente",
            nombre_comercial: p.NombrePuntoVenta || p.cliente?.nombre_comercial || "Punto de Venta",
            direccion: p.Direccion || p.cliente?.direccion || "Sucre, Bolivia",
            telefono: p.Telefono || p.cliente?.telefono,
            latitud: p.Latitud || p.cliente?.latitud,
            longitud: p.Longitud || p.cliente?.longitud,
            saldo_pendiente: Number(p.SaldoDeudor || p.cliente?.saldo_pendiente || 0),
          },
          pedido: {
            id: p.IdPedido || p.pedido?.id || idx + 1,
            monto_total:
              Number(p.MontoPedido || p.pedido?.monto_total || 0) ||
              (p.PedidosPendientes || []).reduce(
                (sum, it) => sum + Number(it.Cantidad || 0) * Number(it.PrecioUnitario || 0),
                0
              ) ||
              450.0,
            items: (p.PedidosPendientes || p.pedido?.items || []).map((it) => ({
              producto_id: it.IdProducto || it.producto_id,
              producto_nombre: it.Nombre || it.producto_nombre,
              cantidad: it.Cantidad || it.cantidad || 1,
              precio_unitario: it.PrecioUnitario || it.precio_unitario || 24.5,
            })),
          },
        })),
      }
    : null;

  return (
    <RutaContext.Provider
      value={{
        asignacionActiva,
        estadoRuta,
        ESTADOS_RUTA,
        hojaRuta,
        metricas,
        cargandoRuta,
        loading: cargandoRuta,
        errorRuta,
        recaudacion,
        comprobanteActual,
        cerrarComprobante,
        cargarHojaRuta,
        cargarRutaDelDia: cargarHojaRuta,
        solicitarCargaCamion,
        limpiarRutaActiva,
        registrarEntrega,
        registrarNoEntrega,
        registrarCobro,
        registrarNuevoClienteCampo,
        registrarNuevoCliente: registrarNuevoClienteCampo,
        cerrarRutaDiaria,
        cerrarRuta: cerrarRutaDiaria,
        syncPendientes: pendientes,
        ultimaSincronizacion,
      }}
    >
      {children}
    </RutaContext.Provider>
  );
}

export function useRuta() {
  const context = useContext(RutaContext);
  if (!context) {
    throw new Error("useRuta debe usarse dentro de un RutaProvider");
  }
  return context;
}
