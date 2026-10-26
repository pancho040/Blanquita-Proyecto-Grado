import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { Alert } from "react-native";
import { CONFIG } from "../constants/Config";
import { LogisticaApi } from "../api/logisticaApi";
import { SyncQueue } from "../database/syncQueue";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [permisoConcedido, setPermisoConcedido] = useState(false);
  const [gpsActivo, setGpsActivo] = useState(false);
  const [ultimaUbicacion, setUltimaUbicacion] = useState(null);
  const [cargandoGps, setCargandoGps] = useState(false);
  const telemetriaIntervalRef = useRef(null);

  // Solicitar permisos de geolocalización al iniciar
  const solicitarPermisos = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const concedido = status === "granted";
      setPermisoConcedido(concedido);

      const serviciosHabilitados = await Location.hasServicesEnabledAsync();
      setGpsActivo(serviciosHabilitados);

      if (!concedido) {
        Alert.alert(
          "Permiso de Ubicación",
          "Blanquita Choferes requiere acceso a la ubicación para registrar las paradas de entrega en ruta."
        );
      }
      return concedido && serviciosHabilitados;
    } catch (e) {
      console.error("[LocationContext] Error solicitando permisos GPS:", e);
      return false;
    }
  };

  useEffect(() => {
    solicitarPermisos();
  }, []);

  /**
   * Obtiene la posición GPS actual de forma estricta (HU-33)
   * Condiciona cualquier venta, entrega o cobro a que el GPS esté activo
   */
  const obtenerUbicacionActual = async () => {
    setCargandoGps(true);
    try {
      // 1. Validar permisos
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const nuevoStatus = await Location.requestForegroundPermissionsAsync();
        if (nuevoStatus.status !== "granted") {
          throw new Error("Permiso de GPS denegado. Es obligatorio para registrar transacciones.");
        }
      }

      // 2. Validar que el chip GPS esté encendido en los ajustes del dispositivo
      const enabled = await Location.hasServicesEnabledAsync();
      setGpsActivo(enabled);
      if (!enabled) {
        throw new Error(
          "El GPS de tu celular está apagado. Por favor activa la Ubicación en Ajustes antes de continuar."
        );
      }

      // 3. Capturar coordenadas con alta precisión
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      });

      const gpsData = {
        latitud: Number(location.coords.latitude.toFixed(6)),
        longitud: Number(location.coords.longitude.toFixed(6)),
        precision: Math.round(location.coords.accuracy || 0),
        velocidad: Math.max(0, Math.round((location.coords.speed || 0) * 3.6)), // km/h
        altitud: location.coords.altitude || 0,
        fechaHora: new Date(location.timestamp).toISOString(),
      };

      setUltimaUbicacion(gpsData);
      return gpsData;
    } catch (error) {
      console.error("[LocationContext] Error capturando GPS:", error);
      throw error;
    } finally {
      setCargandoGps(false);
    }
  };

  /**
   * Iniciar telemetría periódica de la flota para visualización en vivo en la Web
   * Alimenta directamente el módulo de Rastreo Choferes en Tiempo Real
   */
  const iniciarTelemetria = (idRepartidor, idAsignacion) => {
    detenerTelemetria();

    telemetriaIntervalRef.current = setInterval(async () => {
      try {
        const gps = await obtenerUbicacionActual();
        const payload = {
          IdUsuarioRepartidor: idRepartidor,
          IdAsignacion: idAsignacion,
          Latitud: gps.latitud,
          Longitud: gps.longitud,
          PrecisionMts: gps.precision,
          VelocidadKmh: gps.velocidad,
        };

        // Enviar al servidor o encolar si está offline
        LogisticaApi.enviarTelemetriaPing(payload).catch(() => {
          SyncQueue.encolarOperacion("PING_GPS", payload, gps).catch(() => {});
        });
      } catch (e) {
        // Ignorar fallos de telemetría silenciosos en background
      }
    }, CONFIG.GPS.INTERVALO_PING_SEGUNDOS * 1000);
  };

  const detenerTelemetria = () => {
    if (telemetriaIntervalRef.current) {
      clearInterval(telemetriaIntervalRef.current);
      telemetriaIntervalRef.current = null;
    }
  };

  const locationNormalized = ultimaUbicacion
    ? {
        latitude: ultimaUbicacion.latitud || ultimaUbicacion.latitude || -19.0435,
        longitude: ultimaUbicacion.longitud || ultimaUbicacion.longitude || -65.258,
        accuracy: ultimaUbicacion.precision || ultimaUbicacion.accuracy || 10,
      }
    : {
        latitude: -19.0435,
        longitude: -65.258,
        accuracy: 10,
      };

  return (
    <LocationContext.Provider
      value={{
        permisoConcedido,
        gpsActivo,
        ultimaUbicacion,
        location: locationNormalized,
        gpsStatus: gpsActivo ? "active" : "inactive",
        cargandoGps,
        solicitarPermisos,
        obtenerUbicacionActual,
        getCurrentCoords: obtenerUbicacionActual,
        iniciarTelemetria,
        detenerTelemetria,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation debe usarse dentro de un LocationProvider");
  }
  return context;
}
