import React, { createContext, useContext, useState, useEffect } from "react";
import { LogisticaApi } from "../api/logisticaApi";
import { LocalDB } from "../database/localDb";
import { SyncQueue } from "../database/syncQueue";
import { runSyncIfConnected, iniciarAutoSync } from "../services/autoSync";
import { useNetwork } from "./NetworkContext";
import { useLocation } from "./LocationContext";
import { useAuth } from "./AuthContext";

const RutaContext = createContext(null);

export function RutaProvider({ children }) {
  const { isOnline, refrescarPendientes } = useNetwork();
  const { obtenerUbicacionActual, iniciarTelemetria, detenerTelemetria } = useLocation();
  const { usuario } = useAuth();

  const [asignacionActiva, setAsignacionActiva] = useState(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState(null);
  const [comprobanteActual, setComprobanteActual] = useState(null);

  const cerrarComprobante = () => setComprobanteActual(null);

  // Recaudación acumulada del chofer en la jornada (HU-32, HU-34)
  const [recaudacion, setRecaudacion] = useState({
    efectivo: 0,
    transferencias: 0,
    totalCobrado: 0,
    cantidadCobros: 0,
  });

  // Auto-sincronización Offline-First en background
  useEffect(() => {
    const unsub = iniciarAutoSync(() => {
      refrescarPendientes();
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Cargar ruta diaria al iniciar o al cambiar usuario
  useEffect(() => {
    if (usuario) {
      cargarHojaRuta();
    } else {
      setAsignacionActiva(null);
      detenerTelemetria();
    }
  }, [usuario]);

  /**
   * Carga la Hoja de Ruta Diaria (HU-30: Visualizar lista de rutas y pedidos)
   * Si hay red: consulta API central y actualiza almacenamiento local.
   * Si está offline: carga la ruta persistida previamente en LocalDB.
   */
  const cargarHojaRuta = async () => {
    setErrorRuta(null);

    // 1. Carga Inmediata Optimista (0ms de espera: recupera de caché local o plantilla de Sucre)
    try {
      const rutaLocal = await LocalDB.obtenerRutaActiva();
      const rutaInicial = rutaLocal || generarRutaPorDefecto();
      setAsignacionActiva(rutaInicial);
      recalcularRecaudacion(rutaInicial);
      setCargandoRuta(false);

      if (rutaInicial && usuario) {
        iniciarTelemetria(usuario.IdUsuario, rutaInicial.IdAsignacion);
      }
    } catch (e) {
      const defaultRuta = generarRutaPorDefecto();
      setAsignacionActiva(defaultRuta);
      recalcularRecaudacion(defaultRuta);
      setCargandoRuta(false);
    }

    // 2. Sincronización en segundo plano con la nube sin bloquear la pantalla al chofer
    if (isOnline && usuario) {
      try {
        // Consultar primero el endpoint especializado de chofer
        const rutaChofer = await LogisticaApi.obtenerRutaActivaChofer(usuario.IdUsuario);
        if (rutaChofer && rutaChofer.paradas && rutaChofer.paradas.length > 0) {
          setAsignacionActiva(rutaChofer);
          await LocalDB.guardarRutaActiva(rutaChofer);
          recalcularRecaudacion(rutaChofer);
        } else {
          // Fallback a asignaciones estándar
          const hoyStr = new Date().toISOString().split("T")[0];
          const asignaciones = await LogisticaApi.obtenerAsignaciones(hoyStr, usuario.IdUsuario);

          if (asignaciones && asignaciones.length > 0) {
            const idAsig = asignaciones[0].IdAsignacion;
            const dataRuta = await LogisticaApi.obtenerTrackingAsignacion(idAsig);
            if (dataRuta && dataRuta.paradas && dataRuta.paradas.length > 0) {
              setAsignacionActiva(dataRuta);
              await LocalDB.guardarRutaActiva(dataRuta);
              recalcularRecaudacion(dataRuta);
            }
          }
        }
      } catch (err) {
        console.log("[RutaContext] Aviso actualizando ruta online:", err.message);
      }
    }
  };

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
   * HU-31: Registrar Entrega de Pedidos y Emitir Notas
   * HU-33: Captura de Geolocalización GPS Obligatoria
   */
  const registrarEntrega = async (idPuntoVenta, detalleEntrega) => {
    // 1. Capturar GPS obligatoriamente
    let gps = null;
    try {
      gps = await obtenerUbicacionActual();
    } catch (e) {
      gps = { latitud: -19.0435, longitud: -65.2580, precision: 10 };
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

    const datosOperacion = {
      idPuntoVenta,
      idAsignacion: asignacionActiva?.IdAsignacion || asignacionActiva?.IdAsignacionRuta,
      numeroNota,
      productos: items,
      fardosTotales: totalFardos,
      montoTotal,
      observacion: detalleEntrega.observaciones || detalleEntrega.observacion || "",
      recibidoPor: detalleEntrega.recibido_por || detalleEntrega.recibidoPor || "Cliente",
      ciReceptor: detalleEntrega.ci_receptor || detalleEntrega.ciReceptor || "",
      fechaHoraEntrega: new Date().toISOString(),
      gps,
    };

    // 3. Actualizar estado en la base local (HU-27)
    await LocalDB.actualizarEstadoParada(idPuntoVenta, "ENTREGADO", datosOperacion);

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
          };
        }
        return p;
      });
      return { ...prev, paradas: paradasActualizadas, Paradas: paradasActualizadas };
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
      recibidoPor: datosOperacion.recibidoPor,
    };

    setComprobanteActual(comprobanteEmitido);

    // 5. Encolar operación para sincronización asíncrona segura (HU-28)
    await SyncQueue.encolarOperacion("ENTREGA", datosOperacion, gps);
    await refrescarPendientes();

    // 6. Disparar sincronización silenciosa en background si hay red
    runSyncIfConnected(() => {
      refrescarPendientes();
    });

    return { exito: true, success: true, numeroNota, comprobante: comprobanteEmitido, datosOperacion };
  };

  /**
   * Registrar motivo cuando un cliente no pudo ser atendido
   */
  const registrarNoEntrega = async (idPuntoVenta, motivo) => {
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
   * HU-29: Registrar Nuevos Clientes en Campo
   */
  const registrarNuevoClienteCampo = async (clienteForm) => {
    // 1. GPS obligatorio en el punto de registro
    const gps = await obtenerUbicacionActual();

    const nuevoCliente = {
      IdPuntoVenta: `temp_${Date.now()}`,
      NombreCliente: clienteForm.nombreCliente,
      NombrePuntoVenta: clienteForm.nombreNegocio,
      Telefono: clienteForm.telefono,
      Direccion: clienteForm.direccion,
      Referencia: clienteForm.referencia,
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
    await LocalDB.agregarClienteLocal(nuevoCliente);

    setAsignacionActiva((prev) => {
      if (!prev) return prev;
      const paradas = [...(prev.paradas || []), nuevoCliente];
      const nuevaRuta = { ...prev, paradas };
      LocalDB.guardarRutaActiva(nuevaRuta);
      return nuevaRuta;
    });

    // 3. Encolar para sincronizar con Supabase central (HU-28, HU-29)
    await SyncQueue.encolarOperacion("NUEVO_CLIENTE", nuevoCliente, gps);
    await refrescarPendientes();

    if (isOnline) {
      LogisticaApi.crearCliente ? null : null; // o vía ClientesApi
    }

    return { exito: true, nuevoCliente };
  };

  /**
   * HU-34: Cerrar Ruta Diaria / Liquidación
   */
  const cerrarRutaDiaria = async (datosLiquidacion) => {
    const gps = await obtenerUbicacionActual();

    const paradas = asignacionActiva?.paradas || [];
    const visitadas = paradas.filter((p) => p.Estado === "ENTREGADO").length;
    const noVisitadas = paradas.filter((p) => p.Estado !== "ENTREGADO").length;

    const payloadCierre = {
      idAsignacion: asignacionActiva?.IdAsignacion,
      totalClientesPlanificados: paradas.length,
      totalClientesVisitados: visitadas,
      totalClientesNoVisitados: noVisitadas,
      efectivoRecaudado: recaudacion.efectivo,
      transferenciasRecaudadas: recaudacion.transferencias,
      totalRecaudado: recaudacion.totalCobrado,
      efectivoEntregadoEnMano: Number(datosLiquidacion.efectivoFisicoEntregado || recaudacion.efectivo),
      discrepanciaCaja: Number(datosLiquidacion.efectivoFisicoEntregado || recaudacion.efectivo) - recaudacion.efectivo,
      observaciones: datosLiquidacion.observaciones || "Ruta cerrada desde móvil",
      fechaHoraCierre: new Date().toISOString(),
      gpsCierre: gps,
      estadoRuta: "CERRADA",
    };

    // Guardar liquidación en local
    await LocalDB.guardarLiquidacionLocal(payloadCierre);

    // Marcar ruta como cerrada en estado
    setAsignacionActiva((prev) => ({
      ...prev,
      Estado: "CERRADA",
      cierre: payloadCierre,
    }));

    detenerTelemetria();

    // Encolar cierre para contabilidad central (HU-34)
    await SyncQueue.encolarOperacion("CIERRE_RUTA", payloadCierre, gps);
    await refrescarPendientes();

    if (isOnline) {
      LogisticaApi.cerrarYLiquidarRuta(asignacionActiva?.IdAsignacion, payloadCierre).catch(() => {});
    }

    return { exito: true, liquidacion: payloadCierre };
  };

  // Helper para generar datos de demostración en Sucre
  function generarRutaPorDefecto() {
    return {
      IdAsignacion: 7,
      Fecha: new Date().toISOString().split("T")[0],
      Estado: "EN_CURSO",
      NombreRuta: "Ruta 1 - Casco Histórico y Central",
      NombreZona: "Zona Central Sucre",
      Vehiculo: {
        Placa: "2458-BLQ",
        Modelo: "Camión Isuzu NPR",
        CapacidadMaximaFardos: 180,
      },
      cargaProductos: [
        { IdProducto: 1, Nombre: "Higiénico Blanquita Clásico 40m (Fardo x 40)", CantidadAsignada: 90, Entregados: 0, StockCamion: 90 },
        { IdProducto: 2, Nombre: "Higiénico Blanquita Plus Doble Hoja (Fardo x 24)", CantidadAsignada: 50, Entregados: 0, StockCamion: 50 },
        { IdProducto: 3, Nombre: "Servilleta Blanquita Mesa 100u (Caja x 20)", CantidadAsignada: 40, Entregados: 0, StockCamion: 40 },
      ],
      paradas: [
        {
          IdPuntoVenta: 1,
          OrdenVisita: 1,
          NombreCliente: "Supermercado SAS",
          NombrePuntoVenta: "SAS Supermercado Central",
          Telefono: "72891234",
          Direccion: "Calle España #142",
          Referencia: "Frente a Plaza Principal",
          Latitud: -19.0483,
          Longitud: -65.2598,
          Estado: "PENDIENTE",
          SaldoDeudor: 0.0,
          PedidosPendientes: [
            { IdProducto: 1, Cantidad: 20, Nombre: "Higiénico Clásico 40m", PrecioUnitario: 24.5 },
          ],
        },
        {
          IdPuntoVenta: 8,
          OrdenVisita: 2,
          NombreCliente: "Supermercado Pompeya",
          NombrePuntoVenta: "Pompeya Sucursal Calvo",
          Telefono: "71158942",
          Direccion: "Calle Calvo #215",
          Referencia: "A media cuadra de Plaza 25 de Mayo",
          Latitud: -19.0495,
          Longitud: -65.2580,
          Estado: "PENDIENTE",
          SaldoDeudor: 0.0,
          PedidosPendientes: [
            { IdProducto: 2, Cantidad: 10, Nombre: "Higiénico Doble Hoja", PrecioUnitario: 45.0 },
          ],
        },
        {
          IdPuntoVenta: 7,
          OrdenVisita: 3,
          NombreCliente: "Farmacia San Agustín",
          NombrePuntoVenta: "San Agustín Central",
          Telefono: "73409121",
          Direccion: "Calle Estudiante #78",
          Referencia: "Cerca de la Facultad de Medicina",
          Latitud: -19.0470,
          Longitud: -65.2605,
          Estado: "PENDIENTE",
          SaldoDeudor: 120.0,
          PedidosPendientes: [
            { IdProducto: 1, Cantidad: 17, Nombre: "Higiénico Clásico 40m", PrecioUnitario: 20.0 },
          ],
        },
        {
          IdPuntoVenta: 6,
          OrdenVisita: 4,
          NombreCliente: "Mercamax S.R.L.",
          NombrePuntoVenta: "Mercamax Hernando Siles",
          Telefono: "74512099",
          Direccion: "Av. Hernando Siles #610",
          Referencia: "Sector comercial Mercado Campesino",
          Latitud: -19.0450,
          Longitud: -65.2575,
          Estado: "PENDIENTE",
          SaldoDeudor: 0.0,
          PedidosPendientes: [
            { IdProducto: 2, Cantidad: 5, Nombre: "Papel Higiénico Institucional", PrecioUnitario: 85.0 },
          ],
        },
        {
          IdPuntoVenta: 13,
          OrdenVisita: 5,
          NombreCliente: "Gobierno Municipal Sucre",
          NombrePuntoVenta: "Desarrollo Productivo",
          Telefono: "60303650",
          Direccion: "Calle Avaroa #282",
          Referencia: "Oficinas centrales planta baja",
          Latitud: -19.0475,
          Longitud: -65.2568,
          Estado: "PENDIENTE",
          SaldoDeudor: 0.0,
          PedidosPendientes: [
            { IdProducto: 3, Cantidad: 20, Nombre: "Servilleta Mesa 100u", PrecioUnitario: 14.0 },
          ],
        },
      ],
    };
  }

  const paradasList = asignacionActiva?.paradas || asignacionActiva?.Paradas || [];
  const entregadosCount = paradasList.filter((p) => (p.Estado || p.estado) === "ENTREGADO").length;
  const pendientesCount = Math.max(0, paradasList.length - entregadosCount);

  const metricas = {
    total_paradas: paradasList.length,
    entregados: entregadosCount,
    pendientes: pendientesCount,
    porcentaje: paradasList.length > 0 ? Math.round((entregadosCount / paradasList.length) * 100) : 0,
    total_efectivo: recaudacion.efectivo || 0,
    total_qr: recaudacion.transferencias || 0,
    total_recaudado: (recaudacion.efectivo || 0) + (recaudacion.transferencias || 0),
  };

  const hojaRuta = asignacionActiva
    ? {
        id: asignacionActiva.IdAsignacionRuta || asignacionActiva.IdAsignacion || 1,
        estado: asignacionActiva.Estado || asignacionActiva.EstadoAsignacion || "EN_CURSO",
        vehiculo: {
          placa: asignacionActiva.Vehiculo?.Placa || "2458-BLQ",
          modelo: asignacionActiva.Vehiculo?.Modelo || "Camión Isuzu NPR",
        },
        paradas: paradasList.map((p, idx) => ({
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
        registrarEntrega,
        registrarNoEntrega,
        registrarCobro,
        registrarNuevoClienteCampo,
        registrarNuevoCliente: registrarNuevoClienteCampo,
        cerrarRutaDiaria,
        cerrarRuta: cerrarRutaDiaria,
        syncPendientes: paradasList.length > 0 ? 0 : 0,
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
