import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { getLeaflet } from "@/lib/leafletLoader";
import { toast } from "sonner";
import {
  ObtenerChoferesEnVivo,
  ObtenerTrackingAsignacion
} from "@/services/Logistica/RutaService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ModalLiquidacionRuta from "./ModalLiquidacionRuta";
import ModalDetalleParadasGPS from "./ModalDetalleParadasGPS";
import ModalSimuladorGPS from "./ModalSimuladorGPS";
import {
  Truck,
  MapPin,
  RefreshCw,
  Search,
  BatteryCharging,
  Gauge,
  Clock,
  Radio,
  FileCheck,
  CheckCircle2,
  Navigation,
  Phone,
  Maximize2,
  Layers,
  Sliders,
  DollarSign
} from "lucide-react";

const SUCRE_CENTER = [-19.0435, -65.258];
let cachedLeaflet = null;

export default function RastreoChoferesGPS() {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const LRef = useRef(null);

  // Estados de telemetría y datos
  const [choferes, setChoferes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [choferSeleccionado, setChoferSeleccionado] = useState(null);
  const [detalleAsignacion, setDetalleAsignacion] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(new Date());
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Modales
  const [modalLiquidacionAbierto, setModalLiquidacionAbierto] = useState(false);
  const [modalParadasAbierto, setModalParadasAbierto] = useState(false);
  const [modalSimuladorAbierto, setModalSimuladorAbierto] = useState(false);
  const [idAsignacionParaModal, setIdAsignacionParaModal] = useState(null);

  // 1. Inicializar Mapa Leaflet
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      const L = await getLeaflet();
      if (!L || !isMounted || !mapContainerRef.current) return;
      LRef.current = L;

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current._leaflet_id) {
        mapContainerRef.current._leaflet_id = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: SUCRE_CENTER,
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setLeafletLoaded(true);

      const t1 = setTimeout(() => {
        if (isMounted && mapInstanceRef.current && mapInstanceRef.current._mapPane) {
          try { mapInstanceRef.current.invalidateSize(); } catch {}
        }
      }, 150);
      const t2 = setTimeout(() => {
        if (isMounted && mapInstanceRef.current && mapInstanceRef.current._mapPane) {
          try { mapInstanceRef.current.invalidateSize(); } catch {}
        }
      }, 400);
      const t3 = setTimeout(() => {
        if (isMounted && mapInstanceRef.current && mapInstanceRef.current._mapPane) {
          try { mapInstanceRef.current.invalidateSize(); } catch {}
        }
      }, 1000);

      timersInit.push(t1, t2, t3);
    }

    const timersInit = [];
    initMap();

    return () => {
      isMounted = false;
      timersInit.forEach(clearTimeout);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Cargar choferes en vivo
  const cargarTelemetria = async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      const data = await ObtenerChoferesEnVivo();
      setChoferes(data || []);
      setUltimaActualizacion(new Date());
    } catch (err) {
      if (!silencioso) toast.error("Error al obtener telemetría satelital");
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  useEffect(() => {
    cargarTelemetria();
  }, []);

  // Intervalo de polling en vivo (cada 8 segundos)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      cargarTelemetria(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // 3. Cargar detalle de la ruta si se selecciona un chofer
  useEffect(() => {
    async function cargarRutaDetalle() {
      if (!choferSeleccionado?.IdAsignacionRuta) {
        setDetalleAsignacion(null);
        return;
      }
      try {
        const res = await ObtenerTrackingAsignacion(choferSeleccionado.IdAsignacionRuta);
        setDetalleAsignacion(res);
      } catch (err) {
        // No bloquear si no se encuentra
      }
    }
    cargarRutaDetalle();
  }, [choferSeleccionado]);

  // 4. Renderizar marcadores de choferes y paradas en el mapa
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !markersLayerRef.current || !LRef.current) return;
    const L = LRef.current;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    // Asegurar tamaño del viewport de Leaflet
    mapInstanceRef.current.invalidateSize();

    if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    // Dibujar marcadores de Choferes
    choferes.forEach((ch) => {
      const lat = parseFloat(ch.Latitud);
      const lng = parseFloat(ch.Longitud);
      if (isNaN(lat) || isNaN(lng)) return;

      const esSeleccionado = choferSeleccionado?.IdUsuarioRepartidor === ch.IdUsuarioRepartidor;

      // Icono HTML moderno para el camión
      const truckIcon = L.divIcon({
        className: "bg-transparent border-0",
        html: `
          <div style="
            position: relative;
            background: ${esSeleccionado ? "#1e293b" : "#20A7DB"};
            color: white;
            border-radius: 9999px;
            width: 38px;
            height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 2px solid white;
            transition: transform 0.2s;
            transform: ${esSeleccionado ? "scale(1.2)" : "scale(1)"};
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
              <circle cx="17" cy="18" r="2"/>
              <circle cx="7" cy="18" r="2"/>
            </svg>
            <div style="
              position: absolute;
              bottom: -2px;
              right: -2px;
              width: 12px;
              height: 12px;
              border-radius: 9999px;
              background: ${ch.EstadoMovimiento === "En Ruta" ? "#22c55e" : "#eab308"};
              border: 2px solid white;
            "></div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -20]
      });

      const marker = L.marker([lat, lng], { icon: truckIcon }).addTo(layer);

      // Popup informativo
      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; min-width: 220px; padding: 2px;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${ch.NombreRepartidor}
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 8px;">
            Ruta: <b>${ch.NombreRuta || "Sin Asignar"}</b> (${ch.NombreZona || "Sucre"})
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; margin-bottom: 8px;">
            <div>Velocidad: <b>${ch.Velocidad || 0} km/h</b></div>
            <div>Batería: <b>${ch.Bateria || 100}%</b></div>
            <div>Paradas: <b>${ch.ParadasCompletadas || 0} / ${ch.TotalParadas || 0}</b></div>
            <div>Estado: <b>${ch.EstadoMovimiento || "Activo"}</b></div>
          </div>
          ${
            ch.Celular
              ? `<a href="https://wa.me/591${ch.Celular}" target="_blank" style="display: block; text-align: center; background: #22c55e; color: white; padding: 4px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 11px;">Contactar WhatsApp</a>`
              : ""
          }
        </div>
      `;
      marker.bindPopup(popupHtml);

      marker.on("click", () => {
        setChoferSeleccionado(ch);
      });
    });

    // Si hay detalle de paradas para el chofer seleccionado, dibujarlas
    if (detalleAsignacion?.Paradas?.length > 0) {
      const puntosCoords = [];

      // Incluir posición del camión
      if (choferSeleccionado?.Latitud && choferSeleccionado?.Longitud) {
        puntosCoords.push([
          parseFloat(choferSeleccionado.Latitud),
          parseFloat(choferSeleccionado.Longitud)
        ]);
      }

      detalleAsignacion.Paradas.forEach((p, idx) => {
        const pLat = parseFloat(p.Latitud);
        const pLng = parseFloat(p.Longitud);
        if (isNaN(pLat) || isNaN(pLng)) return;

        puntosCoords.push([pLat, pLng]);

        const esEntregado = p.EstadoEntrega === "Entregado";

        const stopIcon = L.divIcon({
          className: "bg-transparent border-0",
          html: `
            <div style="
              background: ${esEntregado ? "#16a34a" : "#64748b"};
              color: white;
              border-radius: 9999px;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 11px;
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            ">
              ${p.OrdenVisita || idx + 1}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -14]
        });

        const stopMarker = L.marker([pLat, pLng], { icon: stopIcon }).addTo(layer);
        stopMarker.bindPopup(`
          <div style="font-size: 11px; min-width: 180px;">
            <b>Parada ${p.OrdenVisita || idx + 1}: ${p.NombrePuntoVenta}</b><br/>
            <span>Cliente: ${p.NombreCliente}</span><br/>
            <span>Estado: <b>${p.EstadoEntrega}</b></span>
            ${p.MontoPedido ? `<br/><span>Monto: Bs. ${parseFloat(p.MontoPedido).toFixed(2)}</span>` : ""}
          </div>
        `);
      });

      // Trazar línea de ruta
      if (puntosCoords.length > 1) {
        routePolylineRef.current = L.polyline(puntosCoords, {
          color: detalleAsignacion.ColorHex || "#20A7DB",
          weight: 4,
          opacity: 0.75,
          dashArray: "6, 8"
        }).addTo(mapInstanceRef.current);
      }
    }

    // Si hay choferes pero ninguno seleccionado, ajustar límites del mapa para mostrarlos a todos
    if (choferes.length > 0 && !choferSeleccionado) {
      const markersCoords = choferes
        .map((ch) => [parseFloat(ch.Latitud), parseFloat(ch.Longitud)])
        .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
      if (markersCoords.length > 0) {
        try {
          const bounds = L.latLngBounds(markersCoords);
          mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
        } catch (e) {
          mapInstanceRef.current.setView(SUCRE_CENTER, 14);
        }
      }
    }
  }, [choferes, choferSeleccionado, detalleAsignacion, leafletLoaded]);

  // Centrar en un chofer
  const centrarEnChofer = (ch) => {
    setChoferSeleccionado(ch);
    const lat = parseFloat(ch.Latitud);
    const lng = parseFloat(ch.Longitud);
    if (!isNaN(lat) && !isNaN(lng) && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
    }
  };

  const formatearMonto = (val) =>
    new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(val || 0);

  const choferesFiltrados = choferes.filter((c) => {
    const q = busqueda.toLowerCase();
    return (
      c.NombreRepartidor?.toLowerCase().includes(q) ||
      c.NombreRuta?.toLowerCase().includes(q) ||
      c.NombreZona?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Rastreo
          </h2>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => cargarTelemetria()}
            disabled={cargando}
            className="text-xs font-semibold text-slate-700 h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${cargando ? "animate-spin text-[#20A7DB]" : ""}`} />
            <span>Actualizar</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setModalSimuladorAbierto(true)}
            className="bg-[#20A7DB] hover:bg-[#188cba] text-white text-xs font-semibold h-9 gap-1.5 shadow-2xs"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Ubicación GPS</span>
          </Button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: MAPA Y PANEL LATERAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* PANEL LATERAL: LISTA DE CHOFERES */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar chofer o ruta..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
              <span>{choferesFiltrados.length} repartidores activos</span>
              <span>
                Última sincronización: {ultimaActualizacion.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>

          {/* LISTADO DE TARJETAS DE CHOFERES */}
          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {choferesFiltrados.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                No hay repartidores disponibles.
              </div>
            ) : (
              choferesFiltrados.map((ch) => {
                const esSeleccionado = choferSeleccionado?.IdUsuarioRepartidor === ch.IdUsuarioRepartidor;
                const porcentaje = ch.TotalParadas > 0 ? Math.round((ch.ParadasCompletadas / ch.TotalParadas) * 100) : 0;

                return (
                  <div
                    key={ch.IdUsuarioRepartidor}
                    onClick={() => centrarEnChofer(ch)}
                    className={`p-3.5 bg-white border rounded-xl shadow-2xs cursor-pointer transition-all ${
                      esSeleccionado
                        ? "border-[#20A7DB] ring-2 ring-[#20A7DB]/20 bg-sky-50/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">
                          {ch.NombreRepartidor}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                          {ch.NombreRuta || "Sin Ruta Asignada"} • {ch.NombreZona || "Sucre"}
                        </span>
                      </div>

                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ch.EstadoMovimiento === "En Ruta"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ch.EstadoMovimiento || "Activo"}
                      </span>
                    </div>

                    {/* SENSORES Y TELEMETRÍA */}
                    <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-600">
                      <div className="flex items-center gap-1 font-mono">
                        <Gauge className="h-3 w-3 text-slate-400" />
                        <span>{ch.Velocidad || 0} km/h</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono">
                        <BatteryCharging className="h-3 w-3 text-emerald-600" />
                        <span>{ch.Bateria || 100}%</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-right justify-end">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>hace {ch.SegundosDesdeUltimoReporte || 0}s</span>
                      </div>
                    </div>

                    {/* PROGRESO DE PARADAS */}
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10px] font-medium text-slate-600 mb-1">
                        <span>Paradas atendidas</span>
                        <span className="font-bold">
                          {ch.ParadasCompletadas || 0} / {ch.TotalParadas || 0} ({porcentaje}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#20A7DB] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* RECAUDACIÓN Y BOTONES DE ACCIÓN */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Cobrado en Ruta:</span>
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          {formatearMonto(ch.MontoCobradoTotal)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ch.IdAsignacionRuta && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIdAsignacionParaModal(ch.IdAsignacionRuta);
                                setModalParadasAbierto(true);
                              }}
                              className="h-7 text-[11px] font-semibold px-2 text-slate-700 hover:text-[#20A7DB]"
                              title="Ver paradas de la ruta"
                            >
                              <Navigation className="h-3 w-3 mr-1" />
                              Paradas
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIdAsignacionParaModal(ch.IdAsignacionRuta);
                                setModalLiquidacionAbierto(true);
                              }}
                              className="h-7 text-[11px] font-semibold px-2 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              title="Liquidar ruta para caja"
                            >
                              <FileCheck className="h-3 w-3 mr-1" />
                              Liquidar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CONTENEDOR DEL MAPA LEAFLET */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs relative h-[690px]">
          <div
            ref={mapContainerRef}
            className="w-full h-full z-0"
            style={{ minHeight: "690px" }}
          ></div>

          {/* CONTROLES FLOTANTES EN LA ESQUINA SUPERIOR IZQUIERDA */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => {
                const m = mapInstanceRef.current;
                if (m && m._mapPane) {
                  try {
                    m.flyTo(SUCRE_CENTER, 14, { animate: false });
                    m.invalidateSize();
                  } catch {}
                }
              }}
              type="button"
              className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#20A7DB] hover:border-[#20A7DB] transition-all"
            >
              <Maximize2 className="h-3.5 w-3.5 text-[#20A7DB]" />
              <span>Centrar Sucre</span>
            </button>
          </div>

          {/* LEYENDA FLOTANTE SOBRE EL MAPA */}
          <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-2 pointer-events-auto">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
              Referencia de Ruta
            </span>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="h-3 w-3 rounded-full bg-[#20A7DB]"></span>
              <span>Camión de Reparto</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="h-3 w-3 rounded-full bg-emerald-600"></span>
              <span>Parada Entregada</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="h-3 w-3 rounded-full bg-slate-500"></span>
              <span>Parada Pendiente</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODALES */}
      <ModalLiquidacionRuta
        idAsignacion={idAsignacionParaModal}
        abierto={modalLiquidacionAbierto}
        onCerrar={() => setModalLiquidacionAbierto(false)}
        onLiquidacionExitosa={() => {
          cargarTelemetria();
        }}
      />

      <ModalDetalleParadasGPS
        idAsignacion={idAsignacionParaModal}
        abierto={modalParadasAbierto}
        onCerrar={() => setModalParadasAbierto(false)}
        onActualizacion={() => {
          cargarTelemetria();
        }}
      />

      <ModalSimuladorGPS
        repartidores={choferes}
        repartidorSeleccionado={choferSeleccionado}
        abierto={modalSimuladorAbierto}
        onCerrar={() => setModalSimuladorAbierto(false)}
        onPingEmitido={() => {
          cargarTelemetria();
        }}
      />
    </div>
  );
}
