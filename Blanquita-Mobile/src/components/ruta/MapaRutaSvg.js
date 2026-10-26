import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import Svg, {
  Circle,
  Polyline,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Colors } from '../../constants/Colors';
import {
  Navigation,
  ChevronRight,
  Package,
  Plus,
  Minus,
  Crosshair,
} from 'lucide-react-native';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// Coordenadas viales reales sobre calles de Sucre
const TRAMOS_VIALES_PREDETERMINADOS = [
  {
    origenIndex: 0,
    destinoIndex: 1,
    coordinates: [
      [-65.259835, -19.048336],
      [-65.259522, -19.048602],
      [-65.259493, -19.048665],
      [-65.25946, -19.04874],
      [-65.258612, -19.049466],
      [-65.258243, -19.049767],
    ],
  },
  {
    origenIndex: 1,
    destinoIndex: 2,
    coordinates: [
      [-65.258243, -19.049767],
      [-65.257667, -19.050235],
      [-65.256883, -19.049337],
      [-65.257817, -19.048569],
      [-65.258683, -19.047836],
      [-65.259585, -19.047181],
      [-65.260185, -19.046639],
    ],
  },
  {
    origenIndex: 2,
    destinoIndex: 3,
    coordinates: [
      [-65.260185, -19.046639],
      [-65.260626, -19.046295],
      [-65.259867, -19.045446],
      [-65.259308, -19.044793],
      [-65.258913, -19.044331],
      [-65.258059, -19.043347],
      [-65.257229, -19.044196],
      [-65.257755, -19.044802],
    ],
  },
  {
    origenIndex: 3,
    destinoIndex: 4,
    coordinates: [
      [-65.257755, -19.044802],
      [-65.257998, -19.045082],
      [-65.258371, -19.045519],
      [-65.258928, -19.046185],
      [-65.25793, -19.046942],
      [-65.257025, -19.047661],
      [-65.256066, -19.048415],
      [-65.255234, -19.047454],
      [-65.256142, -19.046665],
      [-65.256848, -19.047462],
    ],
  },
];

function latLngToGlobalPixel(lat, lng, zoomLevel) {
  const n = Math.pow(2, zoomLevel);
  const x = ((lng + 180.0) / 360.0) * n * 256.0;
  const latRad = (lat * Math.PI) / 180.0;
  const y =
    ((1.0 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2.0) * n * 256.0;
  return { x, y };
}

const MapTile = React.memo(({ tile }) => {
  const [useFallback, setUseFallback] = useState(false);
  // OpenStreetMap Humanitarian y Standard (altamente estables y libres de API Key)
  const primaryUrl = `https://a.tile.openstreetmap.fr/hot/${tile.zoom}/${tile.tx}/${tile.ty}.png`;
  const fallbackUrl = `https://tile.openstreetmap.org/${tile.zoom}/${tile.tx}/${tile.ty}.png`;

  return (
    <Image
      source={{
        uri: useFallback ? fallbackUrl : primaryUrl,
        headers: { 'User-Agent': 'BlanquitaMobileApp/2.0' },
      }}
      onError={() => setUseFallback(true)}
      style={[
        styles.tileImage,
        {
          left: tile.left,
          top: tile.top,
        },
      ]}
      fadeDuration={80}
    />
  );
});

export const MapaRutaSvg = ({
  paradas = [],
  onSeleccionarParada,
  onIrADetalle,
}) => {
  const [zoom, setZoom] = useState(16);
  const [paradaSeleccionadaId, setParadaSeleccionadaId] = useState(null);
  const [layoutDims, setLayoutDims] = useState({
    width: WINDOW_WIDTH,
    height: Math.max(380, WINDOW_HEIGHT - 310),
  });

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffsetRef = useRef({ x: 0, y: 0 });

  // Índice de la primera parada pendiente
  const indexDestinoActivo = useMemo(() => {
    if (!paradas || paradas.length === 0) return 0;
    const idx = paradas.findIndex((p) => {
      const st = (p.Estado || p.estado || '').toUpperCase();
      return st !== 'ENTREGADO' && st !== 'ENTREGADA';
    });
    return idx === -1 ? paradas.length - 1 : idx;
  }, [paradas]);

  useEffect(() => {
    if (paradas.length > 0) {
      const activa = paradas[indexDestinoActivo] || paradas[0];
      setParadaSeleccionadaId(activa.id || activa.IdPuntoVenta);
    }
  }, [paradas, indexDestinoActivo]);

  // Gestor táctil de arrastre (PanResponder sin bloqueo)
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: panOffsetRef.current.x,
          y: panOffsetRef.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        panOffsetRef.current = {
          x: panOffsetRef.current.x + gs.dx,
          y: panOffsetRef.current.y + gs.dy,
        };
      },
    });
  }, [pan]);

  const handleRecenter = () => {
    pan.flattenOffset();
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      friction: 8,
      tension: 45,
      useNativeDriver: false,
    }).start(() => {
      panOffsetRef.current = { x: 0, y: 0 };
    });
  };

  const handleZoomIn = () => {
    if (zoom < 17) {
      setZoom((z) => z + 1);
      handleRecenter();
    }
  };

  const handleZoomOut = () => {
    if (zoom > 15) {
      setZoom((z) => z - 1);
      handleRecenter();
    }
  };

  // Proyección de paradas y cuadrícula extendida de 6x6 tiles
  const { tiles, paradasProyectadas, polilineasTramos } = useMemo(() => {
    const W = layoutDims.width;
    const H = layoutDims.height;

    if (!paradas || paradas.length === 0) {
      return { tiles: [], paradasProyectadas: [], polilineasTramos: [] };
    }

    const pixels = paradas.map((p) => {
      const lat = Number(p.cliente?.latitud || p.Latitud || -19.0483);
      const lng = Number(p.cliente?.longitud || p.Longitud || -65.2598);
      return latLngToGlobalPixel(lat, lng, zoom);
    });

    const centerX = pixels.reduce((acc, p) => acc + p.x, 0) / pixels.length;
    const centerY = pixels.reduce((acc, p) => acc + p.y, 0) / pixels.length;

    const proyectar = (lat, lng) => {
      const { x, y } = latLngToGlobalPixel(lat, lng, zoom);
      return {
        screenX: x - centerX + W / 2,
        screenY: y - centerY + H / 2,
      };
    };

    const proyectadas = paradas.map((p, idx) => {
      const lat = Number(p.cliente?.latitud || p.Latitud || -19.0483);
      const lng = Number(p.cliente?.longitud || p.Longitud || -65.2598);
      const { screenX, screenY } = proyectar(lat, lng);

      const st = (p.Estado || p.estado || '').toUpperCase();
      const esEntregado = st === 'ENTREGADO' || st === 'ENTREGADA';
      const esDestinoActivo = idx === indexDestinoActivo;

      return {
        ...p,
        screenX,
        screenY,
        esDestinoActivo,
        esEntregado,
      };
    });

    // Malla amplia de 6x6 tiles para desplazamiento continuo
    const centerTileX = Math.floor(centerX / 256.0);
    const centerTileY = Math.floor(centerY / 256.0);
    const minTileX = centerTileX - 3;
    const maxTileX = centerTileX + 3;
    const minTileY = centerTileY - 3;
    const maxTileY = centerTileY + 3;

    const tilesVisibles = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const tileLeft = tx * 256.0 - centerX + W / 2;
        const tileTop = ty * 256.0 - centerY + H / 2;

        tilesVisibles.push({
          key: `${zoom}-${tx}-${ty}`,
          zoom,
          tx,
          ty,
          left: tileLeft,
          top: tileTop,
        });
      }
    }

    // Trazados viales OSRM de Sucre
    const tramosParsed = TRAMOS_VIALES_PREDETERMINADOS.map((tramo) => {
      const pointsStr = (tramo.coordinates || [])
        .map(([lng, lat]) => {
          const { screenX, screenY } = proyectar(lat, lng);
          return `${screenX.toFixed(1)},${screenY.toFixed(1)}`;
        })
        .join(' ');

      const esTramoActivo = tramo.destinoIndex === indexDestinoActivo;
      const esTramoCompletado = tramo.destinoIndex < indexDestinoActivo;

      return {
        ...tramo,
        pointsStr,
        esTramoActivo,
        esTramoCompletado,
      };
    });

    return {
      tiles: tilesVisibles,
      paradasProyectadas: proyectadas,
      polilineasTramos: tramosParsed,
    };
  }, [paradas, indexDestinoActivo, zoom, layoutDims]);

  const paradaActiva = useMemo(() => {
    return (
      paradasProyectadas.find(
        (p) => (p.id || p.IdPuntoVenta) === paradaSeleccionadaId
      ) ||
      paradasProyectadas[indexDestinoActivo] ||
      paradasProyectadas[0] ||
      null
    );
  }, [paradasProyectadas, paradaSeleccionadaId, indexDestinoActivo]);

  const handleAbrirGoogleMaps = (parada) => {
    const lat = parada?.cliente?.latitud || parada?.Latitud;
    const lng = parada?.cliente?.longitud || parada?.Longitud;
    if (!lat || !lng) return;

    const url = Platform.select({
      ios: `maps:0,0?q=Entrega@${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const calcularFardosTotales = (parada) => {
    const items = parada?.pedido?.items || parada?.PedidosPendientes || [];
    return (
      items.reduce((sum, it) => sum + Number(it.cantidad || it.Cantidad || 0), 0) || 15
    );
  };

  if (!paradas || paradas.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setLayoutDims({ width, height });
        }
      }}
    >
      {/* Contenedor del mapa táctil (sin scroll padre) */}
      <View style={styles.mapTouchArea} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              transform: pan.getTranslateTransform(),
            },
          ]}
        >
          {/* 1. Malla de tiles de OpenStreetMap */}
          {tiles.map((t) => (
            <MapTile key={t.key} tile={t} />
          ))}

          {/* 2. Capa Vectorial de Calles y Paradas */}
          <Svg
            width={layoutDims.width + 1200}
            height={layoutDims.height + 1200}
            style={styles.svgAbsolute}
          >
            <Defs>
              <LinearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#2563EB" stopOpacity="1" />
                <Stop offset="100%" stopColor="#0284C7" stopOpacity="1" />
              </LinearGradient>
            </Defs>

            {/* Rutas viales */}
            {polilineasTramos.map((tramo, idx) => {
              if (!tramo.pointsStr) return null;

              if (tramo.esTramoActivo) {
                return (
                  <G key={`t-${idx}`}>
                    <Polyline
                      points={tramo.pointsStr}
                      fill="none"
                      stroke="rgba(37, 99, 235, 0.2)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Polyline
                      points={tramo.pointsStr}
                      fill="none"
                      stroke="url(#activeGrad)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </G>
                );
              } else if (tramo.esTramoCompletado) {
                return (
                  <Polyline
                    key={`t-${idx}`}
                    points={tramo.pointsStr}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity="0.85"
                  />
                );
              } else {
                return (
                  <Polyline
                    key={`t-${idx}`}
                    points={tramo.pointsStr}
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6, 4"
                  />
                );
              }
            })}

            {/* Marcadores de clientes numerados (estilo Focus Mobile) */}
            {paradasProyectadas.map((p) => {
              const pid = p.id || p.IdPuntoVenta;
              const isDestino = p.esDestinoActivo;
              const isDelivered = p.esEntregado;
              const isSelected = pid === paradaSeleccionadaId;

              const radio = isDestino ? 21 : 16;
              const bg = isDelivered ? '#10B981' : isDestino ? '#2563EB' : '#0284C7';

              return (
                <G
                  key={`m-${pid}`}
                  x={p.screenX}
                  y={p.screenY}
                  onPress={() => {
                    setParadaSeleccionadaId(pid);
                    if (onSeleccionarParada) onSeleccionarParada(p);
                  }}
                >
                  {/* Halo de destino activo */}
                  {isDestino && (
                    <>
                      <Circle r="32" fill="rgba(37, 99, 235, 0.18)" />
                      <Circle
                        r="26"
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="2"
                        strokeDasharray="4, 3"
                      />
                    </>
                  )}

                  {/* Resalte de selección */}
                  {isSelected && !isDestino && (
                    <Circle
                      r={radio + 4}
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth="2.5"
                    />
                  )}

                  {/* Marcador */}
                  <Circle
                    r={radio}
                    fill={bg}
                    stroke="#FFFFFF"
                    strokeWidth={isDestino ? 3 : 2}
                  />

                  {/* Número */}
                  <SvgText
                    x="0"
                    y={isDestino ? '5' : '4'}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize={isDestino ? '13' : '11'}
                    fontWeight="800"
                  >
                    {p.secuencia || p.OrdenVisita || '1'}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </Animated.View>

        {/* Botones Flotantes de Control (Estilo Focus Mobile) */}
        <View style={styles.floatingControls}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleRecenter}
            activeOpacity={0.7}
          >
            <Crosshair size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.zoomContainer}>
            <TouchableOpacity
              style={[styles.zoomBtn, zoom >= 17 && styles.zoomDisabled]}
              onPress={handleZoomIn}
              disabled={zoom >= 17}
              activeOpacity={0.7}
            >
              <Plus size={18} color={zoom >= 17 ? '#CBD5E1' : '#0F172A'} />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity
              style={[styles.zoomBtn, zoom <= 15 && styles.zoomDisabled]}
              onPress={handleZoomOut}
              disabled={zoom <= 15}
              activeOpacity={0.7}
            >
              <Minus size={18} color={zoom <= 15 ? '#CBD5E1' : '#0F172A'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tarjeta Flotante Inferior de la Parada Activa */}
      {paradaActiva && (
        <View style={styles.bottomCard}>
          <View style={styles.cardHeaderRow}>
            <View
              style={[
                styles.ordenBadge,
                paradaActiva.esEntregado
                  ? { backgroundColor: '#ECFDF5' }
                  : { backgroundColor: '#E0F2FE' },
              ]}
            >
              <Text
                style={[
                  styles.ordenBadgeText,
                  paradaActiva.esEntregado
                    ? { color: '#10B981' }
                    : { color: '#0284C7' },
                ]}
              >
                #{paradaActiva.secuencia || paradaActiva.OrdenVisita}
              </Text>
            </View>

            <View style={styles.cardHeaderInfo}>
              <Text style={styles.clienteTitulo} numberOfLines={1}>
                {paradaActiva.cliente?.nombre_comercial ||
                  paradaActiva.NombrePuntoVenta ||
                  paradaActiva.cliente?.razon_social ||
                  paradaActiva.NombreCliente}
              </Text>
              <Text style={styles.clienteDireccion} numberOfLines={1}>
                {paradaActiva.cliente?.direccion ||
                  paradaActiva.Direccion ||
                  'Sucre, Bolivia'}
              </Text>
            </View>

            <View
              style={[
                styles.badgeEstado,
                paradaActiva.esEntregado ? styles.badgeVerde : styles.badgeAzul,
              ]}
            >
              <Text
                style={[
                  styles.badgeEstadoText,
                  paradaActiva.esEntregado
                    ? { color: '#10B981' }
                    : { color: '#0284C7' },
                ]}
              >
                {paradaActiva.esEntregado ? 'Entregado' : 'Pendiente'}
              </Text>
            </View>
          </View>

          {/* Resumen de carga */}
          <View style={styles.resumenRow}>
            <View style={styles.resumenItem}>
              <Package size={14} color="#64748B" />
              <Text style={styles.resumenTexto}>
                {calcularFardosTotales(paradaActiva)} fardos
              </Text>
            </View>
            <Text style={styles.resumenTotal}>
              Bs.{' '}
              {Number(
                paradaActiva.pedido?.monto_total ||
                  paradaActiva.MontoPedido ||
                  0
              ).toFixed(2)}
            </Text>
          </View>

          {/* Acciones principales del chofer */}
          <View style={styles.botonesRow}>
            <TouchableOpacity
              style={styles.btnNavegar}
              onPress={() => handleAbrirGoogleMaps(paradaActiva)}
              activeOpacity={0.8}
            >
              <Navigation size={16} color="#FFFFFF" />
              <Text style={styles.btnNavegarTexto}>GPS MAPS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnEntregar}
              onPress={() => {
                if (onIrADetalle) onIrADetalle(paradaActiva);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.btnEntregarTexto}>
                {paradaActiva.esEntregado ? 'DETALLE' : 'ENTREGAR'}
              </Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  mapTouchArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  animatedContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  tileImage: {
    position: 'absolute',
    width: 256,
    height: 256,
  },
  svgAbsolute: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  floatingControls: {
    position: 'absolute',
    right: 14,
    top: 14,
    gap: 8,
    alignItems: 'center',
    zIndex: 20,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  zoomContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  zoomBtn: {
    width: 42,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDisabled: {
    backgroundColor: '#F8FAFC',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 30,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ordenBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ordenBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardHeaderInfo: {
    flex: 1,
    marginRight: 8,
  },
  clienteTitulo: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  clienteDireccion: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  badgeEstado: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeVerde: {
    backgroundColor: '#ECFDF5',
  },
  badgeAzul: {
    backgroundColor: '#E0F2FE',
  },
  badgeEstadoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 8,
  },
  resumenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resumenTexto: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  resumenTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  botonesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnNavegar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  btnNavegarTexto: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  btnEntregar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0369A1',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  btnEntregarTexto: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});

export default MapaRutaSvg;
