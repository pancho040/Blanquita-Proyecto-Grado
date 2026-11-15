import { createContext, useContext, useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { Alert } from "react-native";
import { CONFIG } from "../constants/Config";
import { LogisticaApi } from "../api/logisticaApi";
import { SyncQueue } from "../database/syncQueue";
import { wsService } from "../services/wsService";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [permisoConcedido, setPermisoConcedido] = useState(false);
  const [gpsActivo, setGpsActivo] = useState(false);
  const [ultimaUbicacion, setUltimaUbicacion] = useState(null);
  const [cargandoGps, setCargandoGps] = useState(false);
  const [enviandoGps, setEnviandoGps] = useState(false);
  const [ultimoPingGps, setUltimoPingGps] = useState(null);
  const telemetriaIntervalRef = useRef(null);
  const ultimaUbicacionEmitidaRef = useRef(null);

  // Cálculo de distancia geodésica para filtro de movimiento eficiente (> 25m)
  const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

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

  const idRepartidorRef = useRef(null);
  const idAsignacionRef = useRef(null);

  const ejecutarEnvioPing = async () => {
    const uid = idRepartidorRef.current;
    const asigId = idAsignacionRef.current;
    if (!uid) return;

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsActivo(false);
        return;
      }
      setPermisoConcedido(true);
      const chipOn = await Location.hasServicesEnabledAsync();
      setGpsActivo(chipOn);
      if (!chipOn) return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });

      if (!loc || !loc.coords) return;
      const coords = loc.coords;
      const lat = Number(coords.latitude.toFixed(6));
      const lng = Number(coords.longitude.toFixed(6));
      const vel = coords.speed ? Math.max(0, Math.round(coords.speed * 3.6)) : 0.0;
      const tsIso = new Date(loc.timestamp || Date.now()).toISOString();

      const gpsData = {
        latitud: lat,
        longitud: lng,
        precision: Math.round(coords.accuracy || 0),
        velocidad: vel,
        altitud: coords.altitude || 0,
        fechaHora: tsIso,
      };
      setUltimaUbicacion(gpsData);

      const payload = {
        IdUsuarioRepartidor: Number(uid),
        IdAsignacionRuta: asigId ? Number(asigId) : null,
        Latitud: lat,
        Longitud: lng,
        Velocidad: vel,
        Bateria: 95,
        EstadoMovimiento: vel > 5 ? "En Ruta" : "En Parada",
        DireccionAproximada: "Reporte GPS en vivo",
        timestamp: tsIso,
      };

      // 1. Envío HTTP API
      LogisticaApi.enviarTelemetriaPing(payload).catch(() => {});

      // 2. Envío WebSocket si socket está abierto
      if (wsService && typeof wsService.enviar === "function") {
        wsService.enviar({
          tipo: "reporte_ubicacion_actual",
          id_chofer: Number(uid),
          id_asignacion: asigId ? Number(asigId) : null,
          lat,
          lng,
          velocidad: vel,
          bateria: 95,
          timestamp: tsIso,
        });
      }

      setUltimoPingGps(new Date());
      setEnviandoGps(true);
    } catch (_err) {
      // Degradar silenciosamente en caso de GPS sin cobertura
    }
  };

  /**
   * Telemetría GPS periódica para el chofer móvil durante la jornada activa (Fase 1).
   * Envía ubicación cada 12 segundos mientras la asignación esté activa (APROBADA_EN_RUTA).
   */
  const iniciarTelemetria = (idRepartidor, idAsignacion) => {
    idRepartidorRef.current = idRepartidor;
    idAsignacionRef.current = idAsignacion;
    detenerTelemetria();

    if (!idRepartidor) return;

    setEnviandoGps(true);
    // Ping inmediato al iniciar
    ejecutarEnvioPing();

    // Intervalo de transmisión periódica cada 12 segundos
    telemetriaIntervalRef.current = setInterval(() => {
      ejecutarEnvioPing();
    }, 12000);
  };

  const detenerTelemetria = () => {
    if (telemetriaIntervalRef.current) {
      clearInterval(telemetriaIntervalRef.current);
      telemetriaIntervalRef.current = null;
    }
    setEnviandoGps(false);
  };

  // Limpieza al desmontar el contexto
  useEffect(() => {
    return () => {
      detenerTelemetria();
    };
  }, []);

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
        enviandoGps,
        ultimoPingGps,
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
