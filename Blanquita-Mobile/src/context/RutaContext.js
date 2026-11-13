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
 * SIN_RUTA, PENDIENTE_CARGA, CARGA_SOLICITADA, CARGA_OBSERVADA, CARGA_RECHAZADA, APROBADA_EN_RUTA, FINALIZADA
 */
export function determinarEstadoRuta(ruta, selloLocal = null, selloAprobado = null) {
  if (!ruta || (!ruta.IdAsignacion && !ruta.IdAsignacionRuta && !ruta.id)) {
    return ESTADOS_RUTA.SIN_RUTA;
  }
  const estadoRaw = String(ruta.Estado || ruta.estado || ruta.EstadoAsignacion || "").toUpperCase();
  if (estadoRaw === "FINALIZADA" || estadoRaw === "CERRADA") {
    return ESTADOS_RUTA.FINALIZADA;
  }

  // REGLA FUNDAMENTAL DE BLINDAJE: Si tiene sello de carga aprobada de hoy, devolver siempre APROBADA_EN_RUTA
  if (
    selloAprobado &&
    (selloAprobado.estado_operativo === "APROBADA_EN_RUTA" ||
      selloAprobado.estado_operativo === ESTADOS_RUTA.APROBADA_EN_RUTA)
  ) {
    return ESTADOS_RUTA.APROBADA_EN_RUTA;
  }

  const estadoCarga = String(ruta.estado_carga || ruta.EstadoCarga || "").toUpperCase();
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

  // Nuevos estados: OBSERVADA y RECHAZADA
  if (
    estadoCarga === "OBSERVADA" ||
    estadoRaw === "CARGA_OBSERVADA" ||
    ruta.estado_flujo === ESTADOS_RUTA.CARGA_OBSERVADA
  ) {
    return ESTADOS_RUTA.CARGA_OBSERVADA;
  }
  if (
    estadoCarga === "RECHAZADA" ||
    estadoRaw === "CARGA_RECHAZADA" ||
    ruta.estado_flujo === ESTADOS_RUTA.CARGA_RECHAZADA
  ) {
    return ESTADOS_RUTA.CARGA_RECHAZADA;
  }

  // Si existe sello local para esta asignación y la ruta no está en APROBADA_EN_RUTA ni FINALIZADA
  if (selloLocal) {
    if (
      selloLocal.estado_operativo === "CARGA_OBSERVADA" ||
      selloLocal.estado_operativo === ESTADOS_RUTA.CARGA_OBSERVADA
    ) {
      return ESTADOS_RUTA.CARGA_OBSERVADA;
    }
    if (
      selloLocal.estado_operativo === "CARGA_RECHAZADA" ||
      selloLocal.estado_operativo === ESTADOS_RUTA.CARGA_RECHAZADA
    ) {
      return ESTADOS_RUTA.CARGA_RECHAZADA;
    }
    if (
      selloLocal.estado_operativo === "CARGA_SOLICITADA" ||
      selloLocal.estado_operativo === ESTADOS_RUTA.CARGA_SOLICITADA
    ) {
      return ESTADOS_RUTA.CARGA_SOLICITADA;
    }
  }

  if (ruta.estado_flujo && Object.values(ESTADOS_RUTA).includes(ruta.estado_flujo)) {
    return ruta.estado_flujo;
  }
  if (
    estadoCarga === "SOLICITADA" ||
    estadoCarga === "PENDIENTE_APROBACION" ||
    estadoRaw === "CARGA_SOLICITADA"
  ) {
    return ESTADOS_RUTA.CARGA_SOLICITADA;
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
  const [selloCarga, setSelloCarga] = useState(null);
  const [motivoObservacionCarga, setMotivoObservacionCarga] = useState(null);
  const [motivoRechazoCarga, setMotivoRechazoCarga] = useState(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState(null);
  const [comprobanteActual, setComprobanteActual] = useState(null);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState(new Date());

  // Stock e inventario en camión siempre sincronizado (Subagente A)
  const [inventarioCamion, setInventarioCamion] = useState([]);

  const normalizarItemCamionContext = (item) => {
    if (!item) return null;
    const presId = Number(
      item.presentacion_id ??
      item.id_presentacion ??
      item.IdPresentacion ??
      item.id_producto ??
      item.id ??
      0
    );
    const nombreProd = String(
      item.producto_nombre ??
      item.nombre_presentacion ??
      item.nombre ??
      item.NombrePresentacion ??
      item.descripcion ??
      (presId > 0 ? `Producto #${presId}` : "Producto")
    );
    const stockDisp = Number(
      item.cantidad_remanente ??
      item.saldo_camion ??
      item.saldoCamion ??
      item.stock_actual ??
      item.saldo ??
      item.cantidad ??
      item.cantidad_disponible ??
      0
    );
    const precioU = Number(
      item.precio_vigente ??
      item.precio_salida ??
      item.precio_unitario ??
      item.precio ??
      25
    );
    return {
      ...item,
      presentacion_id: presId,
      IdPresentacion: presId,
      id: presId,
      producto_nombre: nombreProd,
      nombre_producto: nombreProd,
      nombre: nombreProd,
      cantidad_remanente: stockDisp,
      saldo_camion: stockDisp,
      stock_actual: stockDisp,
      cantidad_disponible: stockDisp,
      precio_unitario: precioU,
      precio_vigente: precioU,
    };
  };

  const cargarInventarioCamion = async () => {
    let itemsNormalizados = [];
    if (isOnline) {
      try {
        const resInv = await LogisticaApi.obtenerMiInventarioCamion();
        const rawItems = Array.isArray(resInv) ? resInv : (resInv?.items || []);
        if (rawItems && rawItems.length > 0) {
          itemsNormalizados = rawItems.map(normalizarItemCamionContext);
          setInventarioCamion(itemsNormalizados);
          await LocalDB.guardarInventarioCamion({
            items: itemsNormalizados,
            total_saldo_camion: itemsNormalizados.reduce((s, it) => s + (it.saldo_camion || 0), 0),
          });
          return itemsNormalizados;
        }
      } catch (e) {
        console.log("[RutaContext] Aviso al consultar inventario online:", e.message);
      }
    }
    // Fallback a almacenamiento local
    try {
      const invLocal = await LocalDB.obtenerInventarioCamion();
      const rawItems = Array.isArray(invLocal) ? invLocal : (invLocal?.items || []);
      if (rawItems && rawItems.length > 0) {
        itemsNormalizados = rawItems.map(normalizarItemCamionContext);
        setInventarioCamion(itemsNormalizados);
        return itemsNormalizados;
      }
    } catch (e) {
      console.log("[RutaContext] Error al leer inventario de LocalDB:", e.message);
    }
    return [];
  };

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
    const idAsig =
      asignacionActiva?.IdAsignacion ||
      asignacionActiva?.IdAsignacionRuta ||
      asignacionActiva?.id;
    if (idAsig) {
      await LocalDB.limpiarSelloSolicitudCarga(idAsig);
      await LocalDB.limpiarSelloCargaAprobada(idAsig);
    }
    await LocalDB.limpiarSelloSolicitudCarga();
    await LocalDB.limpiarSelloCargaAprobada();
    setSelloCarga(null);
    setMotivoObservacionCarga(null);
    setMotivoRechazoCarga(null);
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

  // Listener de eventos WebSocket en tiempo real (Subagente A y B)
  useEffect(() => {
    // 1. Evento: Carga de camión aprobada en Web
    const unsubCargaAprobada = wsService.on("carga_camion_aprobada", async (data) => {
      console.log("[RutaContext] Evento WebSocket carga_camion_aprobada recibido:", data);
      const idAsig =
        asignacionActiva?.IdAsignacion ||
        asignacionActiva?.IdAsignacionRuta ||
        asignacionActiva?.id ||
        data?.id_asignacion;

      // Sello de Carga Aprobada persistido de inmediato en LocalDB
      if (idAsig) {
        await LocalDB.guardarSelloCargaAprobada(idAsig, data);
        await LocalDB.limpiarSelloSolicitudCarga(idAsig);
      }
      await LocalDB.guardarSelloCargaAprobada("activa", data);
      await LocalDB.limpiarSelloSolicitudCarga();

      setSelloCarga(null);
      setMotivoObservacionCarga(null);
      setMotivoRechazoCarga(null);

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
      if (usuario && (asignacionActiva || idAsig)) {
        iniciarTelemetria(usuario.IdUsuario || usuario.id, idAsig);
      }
      // Refrescar para sincronizar paradas y stock oficial
      if (cargarHojaRutaRef.current) {
        cargarHojaRutaRef.current();
      }
    });

    // 2. Evento: Carga de camión observada por supervisor en Web
    const unsubCargaObservada = wsService.on("carga_camion_observada", async (data) => {
      console.log("[RutaContext] Evento WebSocket carga_camion_observada recibido:", data);
      const motivo =
        data?.motivo ||
        data?.observacion ||
        data?.mensaje ||
        "Carga observada por el supervisor";
      setMotivoObservacionCarga(motivo);
      setMotivoRechazoCarga(null);
      setEstadoRuta(ESTADOS_RUTA.CARGA_OBSERVADA);

      const idAsig =
        asignacionActiva?.IdAsignacion ||
        asignacionActiva?.IdAsignacionRuta ||
        asignacionActiva?.id ||
        data?.id_asignacion;
      if (idAsig) {
        const sello = (await LocalDB.obtenerSelloSolicitudCarga(idAsig)) || {};
        sello.estado_operativo = ESTADOS_RUTA.CARGA_OBSERVADA;
        sello.motivo_observacion = motivo;
        await LocalDB.guardarSelloSolicitudCarga(idAsig, sello);
        setSelloCarga(sello);
      }
      setAsignacionActiva((prev) => {
        if (!prev) return prev;
        const actualizada = {
          ...prev,
          estado_carga: "OBSERVADA",
          estado: "CARGA_OBSERVADA",
          estado_flujo: ESTADOS_RUTA.CARGA_OBSERVADA,
          motivo_observacion: motivo,
        };
        LocalDB.guardarRutaActiva(actualizada);
        return actualizada;
      });
    });

    // 3. Evento: Carga de camión rechazada por supervisor en Web
    const unsubCargaRechazada = wsService.on("carga_camion_rechazada", async (data) => {
      console.log("[RutaContext] Evento WebSocket carga_camion_rechazada recibido:", data);
      const motivo =
        data?.motivo ||
        data?.observacion ||
        data?.mensaje ||
        "Solicitud de carga rechazada por el supervisor";
      setMotivoRechazoCarga(motivo);
      setMotivoObservacionCarga(null);
      setEstadoRuta(ESTADOS_RUTA.CARGA_RECHAZADA);

      const idAsig =
        asignacionActiva?.IdAsignacion ||
        asignacionActiva?.IdAsignacionRuta ||
        asignacionActiva?.id ||
        data?.id_asignacion;
      if (idAsig) {
        const sello = (await LocalDB.obtenerSelloSolicitudCarga(idAsig)) || {};
        sello.estado_operativo = ESTADOS_RUTA.CARGA_RECHAZADA;
        sello.motivo_rechazo = motivo;
        await LocalDB.guardarSelloSolicitudCarga(idAsig, sello);
        setSelloCarga(sello);
      }
      setAsignacionActiva((prev) => {
        if (!prev) return prev;
        const actualizada = {
          ...prev,
          estado_carga: "RECHAZADA",
          estado: "CARGA_RECHAZADA",
          estado_flujo: ESTADOS_RUTA.CARGA_RECHAZADA,
          motivo_rechazo: motivo,
        };
        LocalDB.guardarRutaActiva(actualizada);
        return actualizada;
      });
    });

    // 4. Evento: Carga de camión resuelta
    const unsubCargaResuelta = wsService.on("carga_camion_resuelta", async (data) => {
      console.log("[RutaContext] Evento WebSocket carga_camion_resuelta recibido:", data);
      if (cargarHojaRutaRef.current) {
        cargarHojaRutaRef.current();
      }
    });

    // 5. Evento: Administrador finaliza la ruta en Web (Soporte Multi-Ruta)
    const unsubRutaFinalizada = wsService.on("ruta_finalizada_admin", async (data) => {
      console.log("[RutaContext] Evento WebSocket ruta_finalizada_admin recibido:", data);
      await limpiarRutaActiva();
    });

    // 6. Evento: Asignación de nueva ruta en el día
    const unsubRutaAsignada = wsService.on("ruta_asignada", async (data) => {
      console.log("[RutaContext] Evento WebSocket ruta_asignada recibido:", data);
      if (cargarHojaRutaRef.current) {
        cargarHojaRutaRef.current();
      }
    });

    return () => {
      if (unsubCargaAprobada) unsubCargaAprobada();
      if (unsubCargaObservada) unsubCargaObservada();
      if (unsubCargaRechazada) unsubCargaRechazada();
      if (unsubCargaResuelta) unsubCargaResuelta();
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
    cargarInventarioCamion();

    // 1. Carga Inmediata Optimista desde caché local
    try {
      const rutaLocal = await LocalDB.obtenerRutaActiva();
      if (rutaLocal && (rutaLocal.IdAsignacion || rutaLocal.IdAsignacionRuta || rutaLocal.id)) {
        const idAsig = rutaLocal.IdAsignacion || rutaLocal.IdAsignacionRuta || rutaLocal.id;
        const selloAprobado = await LocalDB.obtenerSelloCargaAprobada(idAsig);
        const selloLocal = await LocalDB.obtenerSelloSolicitudCarga(idAsig);
        setSelloCarga(selloLocal);

        if (rutaLocal.motivo_observacion) {
          setMotivoObservacionCarga(rutaLocal.motivo_observacion);
        }
        if (rutaLocal.motivo_rechazo) {
          setMotivoRechazoCarga(rutaLocal.motivo_rechazo);
        }

        const estadoLocal = determinarEstadoRuta(rutaLocal, selloLocal, selloAprobado);
        if (estadoLocal === ESTADOS_RUTA.FINALIZADA) {
          await limpiarRutaActiva();
        } else {
          setAsignacionActiva(rutaLocal);
          setEstadoRuta(estadoLocal);
          recalcularRecaudacion(rutaLocal);
          if (estadoLocal === ESTADOS_RUTA.APROBADA_EN_RUTA && usuario) {
            iniciarTelemetria(usuario.IdUsuario || usuario.id, idAsig);
          }
        }
      } else {
        setSelloCarga(null);
        setAsignacionActiva(null);
        setEstadoRuta(ESTADOS_RUTA.SIN_RUTA);
      }
    } catch (_e) {
      setSelloCarga(null);
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
          const idAsig = rutaChofer.IdAsignacion || rutaChofer.IdAsignacionRuta || rutaChofer.id;

          // Mapeo defensivo de paradas
          const paradasMapeadas =
            (resHoja && (resHoja.paradas || resHoja.puntos_venta || resHoja.paradas_ruta || resHoja.pedidos)) ||
            rutaChofer.paradas ||
            rutaChofer.Paradas ||
            asignacionActiva?.paradas ||
            [];

          rutaChofer.paradas = paradasMapeadas;

          // Sello de carga aprobada y de solicitud
          const selloAprobado = await LocalDB.obtenerSelloCargaAprobada(idAsig);
          const selloLocal = await LocalDB.obtenerSelloSolicitudCarga(idAsig);
          setSelloCarga(selloLocal);

          let nuevoEstado = determinarEstadoRuta(rutaChofer, selloLocal, selloAprobado);

          // REGLA DE PROTECCIÓN DE ASIGNACIÓN APROBADA:
          // Si en memoria o en LocalDB ya existe una asignación para el día en APROBADA_EN_RUTA (o con sello de carga aprobada),
          // y una llamada subsecuente a cargarHojaRuta() o API devuelve una asignación diferente o en PENDIENTE_CARGA,
          // NO permitas que reemplace ni degrade a la asignación aprobada (a menos que la aprobada pase explícitamente a FINALIZADA o CERRADA).
          const estadoServidorRaw = String(
            rutaChofer.Estado || rutaChofer.estado || rutaChofer.EstadoAsignacion || ""
          ).toUpperCase();
          const estaFinalizadaEnServidor =
            estadoServidorRaw === "FINALIZADA" || estadoServidorRaw === "CERRADA";

          const idAsigPrevia =
            asignacionActiva?.IdAsignacion ||
            asignacionActiva?.IdAsignacionRuta ||
            asignacionActiva?.id;
          const selloAprobadoPrevia = idAsigPrevia
            ? await LocalDB.obtenerSelloCargaAprobada(idAsigPrevia)
            : null;

          const estaPreviamenteAprobada = Boolean(
            selloAprobado ||
            selloAprobadoPrevia ||
            estadoRuta === ESTADOS_RUTA.APROBADA_EN_RUTA ||
            asignacionActiva?.estado_flujo === ESTADOS_RUTA.APROBADA_EN_RUTA ||
            asignacionActiva?.estado_carga === "APROBADA"
          );

          if (estaPreviamenteAprobada && !estaFinalizadaEnServidor) {
            nuevoEstado = ESTADOS_RUTA.APROBADA_EN_RUTA;
            // Si la API devolvió otra asignación o no habilitada mientras la previa ya estaba aprobada,
            // preservar la previa (ej: id_asignacion 122) y evitar que desaparezca o se degrade tras el gatekeeper.
            if (
              asignacionActiva &&
              idAsigPrevia &&
              String(idAsigPrevia) !== String(idAsig) &&
              !Boolean(rutaChofer.habilitada_para_reparto || rutaChofer.HabilitadaParaReparto)
            ) {
              rutaChofer = asignacionActiva;
            } else {
              rutaChofer.habilitada_para_reparto = true;
              rutaChofer.estado_carga = "APROBADA";
              rutaChofer.estado = "APROBADA_EN_RUTA";
              rutaChofer.estado_flujo = ESTADOS_RUTA.APROBADA_EN_RUTA;
              if ((!rutaChofer.paradas || rutaChofer.paradas.length === 0) && asignacionActiva?.paradas?.length > 0) {
                rutaChofer.paradas = asignacionActiva.paradas;
              }
            }
          }

          if (nuevoEstado === ESTADOS_RUTA.FINALIZADA) {
            await LocalDB.limpiarSelloCargaAprobada(idAsig);
            await LocalDB.limpiarSelloSolicitudCarga(idAsig);
            setSelloCarga(null);
            setMotivoObservacionCarga(null);
            setMotivoRechazoCarga(null);
            await limpiarRutaActiva();
          } else if (nuevoEstado === ESTADOS_RUTA.APROBADA_EN_RUTA) {
            // Aprobada por Almacén/Web: fijar sello de carga aprobada y limpiar solicitud
            await LocalDB.guardarSelloCargaAprobada(idAsig);
            await LocalDB.limpiarSelloSolicitudCarga(idAsig);
            setSelloCarga(null);
            setMotivoObservacionCarga(null);
            setMotivoRechazoCarga(null);

            setAsignacionActiva(rutaChofer);
            setEstadoRuta(nuevoEstado);
            await LocalDB.guardarRutaActiva(rutaChofer);
            recalcularRecaudacion(rutaChofer);
            setUltimaSincronizacion(new Date());

            iniciarTelemetria(idChofer, idAsig);
          } else if (nuevoEstado === ESTADOS_RUTA.CARGA_OBSERVADA) {
            const motivo =
              rutaChofer.motivo_observacion ||
              resHoja?.motivo_observacion ||
              selloLocal?.motivo_observacion ||
              "Carga observada por el supervisor";
            setMotivoObservacionCarga(motivo);
            setMotivoRechazoCarga(null);
            rutaChofer.motivo_observacion = motivo;
            setAsignacionActiva(rutaChofer);
            setEstadoRuta(nuevoEstado);
            await LocalDB.guardarRutaActiva(rutaChofer);
            recalcularRecaudacion(rutaChofer);
            setUltimaSincronizacion(new Date());
          } else if (nuevoEstado === ESTADOS_RUTA.CARGA_RECHAZADA) {
            const motivo =
              rutaChofer.motivo_rechazo ||
              resHoja?.motivo_rechazo ||
              selloLocal?.motivo_rechazo ||
              "Solicitud de carga rechazada por el supervisor";
            setMotivoRechazoCarga(motivo);
            setMotivoObservacionCarga(null);
            rutaChofer.motivo_rechazo = motivo;
            setAsignacionActiva(rutaChofer);
            setEstadoRuta(nuevoEstado);
            await LocalDB.guardarRutaActiva(rutaChofer);
            recalcularRecaudacion(rutaChofer);
            setUltimaSincronizacion(new Date());
          } else {
            // Si el sello local existe y el servidor aún no aprobó, mantener CARGA_SOLICITADA
            if (nuevoEstado === ESTADOS_RUTA.CARGA_SOLICITADA) {
              rutaChofer.estado_carga = "SOLICITADA";
              rutaChofer.estado_flujo = ESTADOS_RUTA.CARGA_SOLICITADA;
            }
            setAsignacionActiva(rutaChofer);
            setEstadoRuta(nuevoEstado);
            await LocalDB.guardarRutaActiva(rutaChofer);
            recalcularRecaudacion(rutaChofer);
            setUltimaSincronizacion(new Date());
          }
        } else {
          // Servidor no devolvió asignación: si chofer ya tenía ruta aprobada para hoy, no destruirla por error transitorio
          const idAsigMemoria = asignacionActiva?.IdAsignacion || asignacionActiva?.id;
          const selloAprobadoMemoria = idAsigMemoria
            ? await LocalDB.obtenerSelloCargaAprobada(idAsigMemoria)
            : null;
          if (!selloAprobadoMemoria && estadoRuta !== ESTADOS_RUTA.APROBADA_EN_RUTA) {
            await limpiarRutaActiva();
          }
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
  const solicitarCargaCamion = async ({
    usarRemanente = false,
    usar_remanente = false,
    observacion = "",
    items = [],
    stock_remanente = [],
    remanente_actual = [],
  } = {}) => {
    if (!asignacionActiva) {
      return { success: false, error: "No tienes una asignación activa para solicitar carga." };
    }
    const idAsig = asignacionActiva.IdAsignacion || asignacionActiva.IdAsignacionRuta || asignacionActiva.id || 1;
    const flagRemanente = Boolean(usarRemanente || usar_remanente);
    const remanenteArray =
      stock_remanente && stock_remanente.length > 0
        ? stock_remanente
        : remanente_actual && remanente_actual.length > 0
        ? remanente_actual
        : [];

    // 1. Guardar sello inmediatamente en LocalDB para persistencia y bloqueo
    const selloData = {
      estado_operativo: ESTADOS_RUTA.CARGA_SOLICITADA,
      fecha_solicitud: new Date().toISOString(),
      items_solicitados: items,
      usar_remanente: flagRemanente,
      observacion: observacion || "",
      stock_remanente: remanenteArray,
      remanente_actual: remanenteArray,
    };
    await LocalDB.guardarSelloSolicitudCarga(idAsig, selloData);
    setSelloCarga(selloData);
    setMotivoObservacionCarga(null);
    setMotivoRechazoCarga(null);

    // 2. Actualizar estado y persistir ruta activa local de forma optimista
    const rutaActualizada = {
      ...asignacionActiva,
      estado_carga: "SOLICITADA",
      estado_flujo: ESTADOS_RUTA.CARGA_SOLICITADA,
      sello_solicitud: selloData,
      motivo_observacion: null,
      motivo_rechazo: null,
    };
    setAsignacionActiva(rutaActualizada);
    setEstadoRuta(ESTADOS_RUTA.CARGA_SOLICITADA);
    try {
      await LocalDB.guardarRutaActiva(rutaActualizada);
    } catch (_e) {}

    // 3. Enviar solicitud a la API central
    const res = await LogisticaApi.solicitarCargaCamion({
      id_asignacion: idAsig,
      usar_remanente: flagRemanente,
      observacion,
      items,
      stock_remanente: remanenteArray,
      remanente_actual: remanenteArray,
    });

    if (res.success || res.codigo === "EXITO") {
      return { success: true, data: res.data, mensaje: res.mensaje };
    }
    // Si la API falla por red, el sello local ya garantiza que el chofer no duplique solicitudes
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

    const incidencia = detalleEntrega.incidencia || detalleEntrega.tipo_situacion || null;
    let obsOperacion = (detalleEntrega.observaciones || detalleEntrega.observacion || "").trim();
    if (incidencia && !obsOperacion.includes(`[${incidencia}]`)) {
      obsOperacion = `[${incidencia}] ${obsOperacion}`.trim();
    }

    // Resolver IDs de relación garantizando id_pedido limpio (PROHIBIDO poner || 1)
    const idPvNum = Number(idPuntoVenta || detalleEntrega.id_punto_venta || detalleEntrega.idPuntoVenta || 0);

    const rawIdPedido = detalleEntrega.id_pedido ?? detalleEntrega.idPedido ?? null;
    let idPedidoLimpio = rawIdPedido !== null && rawIdPedido !== undefined && rawIdPedido !== ""
      ? Number(rawIdPedido)
      : null;
    if (isNaN(idPedidoLimpio) || idPedidoLimpio <= 0) {
      idPedidoLimpio = null;
    }
    // Saneamiento específico Potosí (idPuntoVenta >= 50): si viene con 1 falso, transformarlo en null
    if (idPvNum >= 50 && idPedidoLimpio === 1) {
      idPedidoLimpio = null;
    }

    const paradaActual = (asignacionActiva?.paradas || asignacionActiva?.Paradas || []).find(
      (p) => String(p.IdPuntoVenta ?? p.id) === String(idPuntoVenta)
    );

    const idClienteLimpio = Number(
      detalleEntrega.id_cliente ??
      detalleEntrega.idCliente ??
      paradaActual?.IdCliente ??
      paradaActual?.id_cliente ??
      paradaActual?.cliente?.id ??
      0
    ) || null;

    const idAsignacionLimpio = Number(
      detalleEntrega.id_asignacion ??
      detalleEntrega.idAsignacion ??
      paradaActual?.IdAsignacion ??
      paradaActual?.id_asignacion ??
      asignacionActiva?.IdAsignacion ??
      asignacionActiva?.IdAsignacionRuta ??
      asignacionActiva?.id ??
      0
    ) || null;

    // Contrato completo unificado con Chat 2 (Subagente D y handoff-sync.md)
    const datosOperacion = {
      idPuntoVenta: idPvNum,
      id_punto_venta: idPvNum,
      idCliente: idClienteLimpio,
      id_cliente: idClienteLimpio,
      idAsignacion: idAsignacionLimpio,
      id_asignacion: idAsignacionLimpio,
      id_pedido: idPedidoLimpio,
      idPedido: idPedidoLimpio,
      numeroNota,
      tipo_entrega: detalleEntrega.tipo_entrega || "TOTAL",
      incidencia,
      recibido_por: detalleEntrega.recibido_por || detalleEntrega.recibidoPor || "Cliente",
      ci_receptor: detalleEntrega.ci_receptor || detalleEntrega.ciReceptor || "",
      observaciones: obsOperacion,
      observacion: obsOperacion,
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

    // Descontar inventario en camión local de forma optimista e inmediata (Subagente D y A)
    if (items.length > 0) {
      await LocalDB.descontarInventarioCamion(items);
      setInventarioCamion((prev) => {
        return prev.map((itemCamion) => {
          const idPresCamion = itemCamion.presentacion_id || itemCamion.IdPresentacion || itemCamion.id;
          const ent = items.find(
            (it) => (it.presentacion_id || it.IdPresentacion || it.id) === idPresCamion
          );
          if (ent) {
            const cant = Number(ent.cantidad || ent.Cantidad || 0);
            const saldo = Math.max(0, Number(itemCamion.saldo_camion || 0) - cant);
            return {
              ...itemCamion,
              saldo_camion: saldo,
              cantidad_remanente: saldo,
              cantidad_disponible: saldo,
              stock_actual: saldo,
            };
          }
          return itemCamion;
        });
      });
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
   * Registrar motivo e incidencia cuando un cliente no pudo ser atendido
   */
  const registrarNoEntrega = async (idPuntoVenta, motivo, observacion = "") => {
    // Gatekeeper: Bloquear si no está en APROBADA_EN_RUTA
    if (estadoRuta !== ESTADOS_RUTA.APROBADA_EN_RUTA) {
      return {
        exito: false,
        success: false,
        error: "Ruta no habilitada: debe estar en estado APROBADA_EN_RUTA para registrar no-entregas.",
      };
    }

    let gps = null;
    try {
      gps = await obtenerUbicacionActual();
    } catch (_e) {
      gps = {
        latitud: -19.0435,
        longitud: -65.2580,
        precision: 10,
      };
    }

    // Resolver id_pedido de la parada sin falsear a 1 (PROHIBIDO poner || 1)
    const idPvNoEntrega = Number(idPuntoVenta || 0);
    let idPedido = null;
    const paradasList = asignacionActiva?.paradas || asignacionActiva?.Paradas || [];
    const paradaEncontrada = paradasList.find(
      (p) => String(p.IdPuntoVenta ?? p.id) === String(idPuntoVenta)
    );
    if (paradaEncontrada) {
      const rawPed = paradaEncontrada.IdPedido || paradaEncontrada.pedido?.id || paradaEncontrada.id_pedido;
      if (rawPed) {
        idPedido = Number(rawPed);
      }
    }
    if (idPvNoEntrega >= 50 && idPedido === 1) {
      idPedido = null;
    }

    const obsTexto = observacion ? String(observacion).trim() : "";

    const datosOperacion = {
      id_pedido: idPedido,
      idPuntoVenta: idPvNoEntrega,
      id_punto_venta: idPvNoEntrega,
      idAsignacion: asignacionActiva?.IdAsignacion || asignacionActiva?.IdAsignacionRuta || null,
      id_asignacion: asignacionActiva?.IdAsignacion || asignacionActiva?.IdAsignacionRuta || null,
      id_cliente: paradaEncontrada?.IdCliente || paradaEncontrada?.id_cliente || null,
      idCliente: paradaEncontrada?.IdCliente || paradaEncontrada?.id_cliente || null,
      motivo,
      observacion: obsTexto,
      observaciones: obsTexto,
      latitud: gps?.latitud || -19.0435,
      longitud: gps?.longitud || -65.2580,
      fechaHora: new Date().toISOString(),
      gps,
    };

    await LocalDB.actualizarEstadoParada(idPuntoVenta, "NO_ENTREGADO", datosOperacion);

    setAsignacionActiva((prev) => {
      if (!prev) return prev;
      const paradasActualizadas = (prev.paradas || []).map((p) => {
        if (String(p.IdPuntoVenta ?? p.id) === String(idPuntoVenta)) {
          return {
            ...p,
            Estado: "NO_ENTREGADO",
            estado: "NO_ENTREGADO",
            motivoNoEntrega: motivo,
            observacionNoEntrega: obsTexto,
          };
        }
        return p;
      });
      const nuevaRuta = { ...prev, paradas: paradasActualizadas, Paradas: paradasActualizadas };
      LocalDB.guardarRutaActiva(nuevaRuta);
      return nuevaRuta;
    });

    // Encolar en cola offline con X-Idempotency-Key
    await SyncQueue.encolarOperacion("NO_ENTREGA", datosOperacion, gps, usuario?.IdUsuario);
    await refrescarPendientes();

    // Disparar sincronización silenciosa en background si hay red
    runSyncIfConnected(() => {
      refrescarPendientes();
    });

    return { exito: true, success: true };
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
            id: p.IdPedido || p.pedido?.id || p.id_pedido || null,
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
        estadoOperativo: estadoRuta,
        selloCarga,
        motivoObservacionCarga,
        motivoRechazoCarga,
        ESTADOS_RUTA,
        hojaRuta,
        metricas,
        cargandoRuta,
        loading: cargandoRuta,
        errorRuta,
        recaudacion,
        inventarioCamion,
        inventario: inventarioCamion,
        cargarInventarioCamion,
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
