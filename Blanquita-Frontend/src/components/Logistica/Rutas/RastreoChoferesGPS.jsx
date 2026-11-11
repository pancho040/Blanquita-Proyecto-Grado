import { useState, useEffect, useRef, useCallback } from "react";
import PageHeader from "@/components/common/PageHeader";
import BranchFilter from "@/components/common/BranchFilter";
import { usePaginaSucursal } from "@/hooks/usePaginaSucursal";
import "leaflet/dist/leaflet.css";
import { getLeaflet } from "@/lib/leafletLoader";
import { toast } from "sonner";
import {
  ObtenerChoferesEnVivo,
  ObtenerTrackingAsignacion
} from "@/services/Logistica/RutaService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/common/StatusBadge";
import ModalLiquidacionRuta from "./ModalLiquidacionRuta";
import ModalDetalleParadasGPS from "./ModalDetalleParadasGPS";
import ModalSimuladorGPS from "./ModalSimuladorGPS";
import {
  Search,
  RefreshCw,
  BatteryCharging,
  Gauge,
  Clock,
  Radio,
  FileCheck,
  Navigation,
  Maximize2
} from "lucide-react";

const SUCRE_CENTER = [-19.0435, -65.258];

export default function RastreoChoferesGPS({ usuario = null }) {
  const { sucursal, setSucursal, sucursalesPermitidas, esMultisede, cargando: cargandoAlcance } = usePaginaSucursal({
    usuario,
    permiteTodas: true,
  });

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
  const [autoRefresh] = useState(true);
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
  const cargarTelemetria = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      const sid = sucursal === "todas" ? null : sucursal;
      const data = await ObtenerChoferesEnVivo(sid);
      setChoferes(data || []);
      setUltimaActualizacion(new Date());
    } catch (err) {
      if (!silencioso) toast.error("Error al obtener telemetría satelital");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [sucursal]);

  useEffect(() => {
    if (!cargandoAlcance) {
      cargarTelemetria();
    }
  }, [sucursal, cargandoAlcance, cargarTelemetria]);

  // Intervalo de polling en vivo (cada 8 segundos)
  useEffect(() => {
    if (!autoRefresh || cargandoAlcance) return;
    const interval = setInterval(() => {
      cargarTelemetria(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, cargandoAlcance, cargarTelemetria]);

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

      // Icono sobrio industrial para el camión
      const truckIcon = L.divIcon({
        className: "bg-transparent border-0",
        html: `
          <div style="
            position: relative;
            background: ${esSeleccionado ? "#0F172A" : "#0369A1"};
            color: white;
            border-radius: 4px;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,0.9);
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            transform: ${esSeleccionado ? "scale(1.15)" : "scale(1)"};
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
              width: 10px;
              height: 10px;
              border-radius: 2px;
              background: ${ch.EstadoMovimiento === "En Ruta" ? "#15803d" : "#ca8a04"};
              border: 1px solid white;
            "></div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: truckIcon }).addTo(layer);

      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; min-width: 220px; padding: 2px;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
            ${ch.NombreRepartidor}
          </div>
          <div style="color: #64748b; font-size: 12px; margin-bottom: 8px;">
            Ruta: <b>${ch.NombreRuta || "Sin Asignar"}</b> (${ch.NombreZona || "Sucre"})
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px; margin-bottom: 8px;">
            <div>Velocidad: <b>${ch.Velocidad || 0} km/h</b></div>
            <div>Batería: <b>${ch.Bateria || 100}%</b></div>
            <div>Paradas: <b>${ch.ParadasCompletadas || 0} / ${ch.TotalParadas || 0}</b></div>
            <div>Estado: <b>${ch.EstadoMovimiento || "Activo"}</b></div>
          </div>
          ${
            ch.Celular
              ? `<a href="https://wa.me/591${ch.Celular}" target="_blank" style="display: block; text-align: center; background: #15803d; color: white; padding: 5px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 12px;">Contactar WhatsApp</a>`
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
              background: ${esEntregado ? "#15803d" : "#475569"};
              color: white;
              border-radius: 4px;
              width: 22px;
              height: 22px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 12px;
              border: 1px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            ">
              ${p.OrdenVisita || idx + 1}
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          popupAnchor: [0, -12]
        });

        const stopMarker = L.marker([pLat, pLng], { icon: stopIcon }).addTo(layer);
        stopMarker.bindPopup(`
          <div style="font-size: 12px; min-width: 180px;">
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
          color: detalleAsignacion.ColorHex || "#0369A1",
          weight: 3,
          opacity: 0.85,
          dashArray: "6, 8"
        }).addTo(mapInstanceRef.current);
      }
    }

    // Ajustar límites del mapa
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
      <PageHeader
        title="Rastreo Satelital en Vivo"
        subtitle="Monitoreo en tiempo real de unidades de reparto, velocidad y avance de paradas"
        branchFilter={
          <BranchFilter
            sucursal={sucursal}
            onChange={setSucursal}
            sucursales={sucursalesPermitidas}
            esMultisede={esMultisede}
            permiteTodas={true}
          />
        }
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cargarTelemetria()}
          disabled={cargando}
          className="text-xs font-medium text-slate-700 h-8 rounded border-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${cargando ? "animate-spin text-[#1C96C5]" : ""}`} />
          <span>Actualizar</span>
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => setModalSimuladorAbierto(true)}
          className="bg-[#1C96C5] hover:bg-[#157A9E] text-white text-xs font-medium h-8 rounded gap-1.5 shadow-none"
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Simulador GPS</span>
        </Button>
      </PageHeader>

      {/* CONTENIDO PRINCIPAL: MAPA Y PANEL LATERAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* PANEL LATERAL: LISTA DE CHOFERES */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded p-3 space-y-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar chofer o ruta..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 h-8 text-xs rounded border-slate-200"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-0.5">
              <span>{choferesFiltrados.length} repartidores activos</span>
              <span className="font-mono tabular-nums">
                {ultimaActualizacion.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          </div>

          {/* LISTADO DE TARJETAS DE CHOFERES */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {choferesFiltrados.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded p-8 text-center text-slate-400 text-xs">
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
                    className={`p-3 bg-white border rounded cursor-pointer transition-all ${
                      esSeleccionado
                        ? "border-[#1C96C5] ring-1 ring-[#1C96C5] bg-sky-50/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 text-xs block">
                          {ch.NombreRepartidor}
                        </span>
                        <span className="text-xs text-slate-500 font-medium block mt-0.5">
                          {ch.NombreRuta || "Sin Ruta Asignada"} • {ch.NombreZona || "Sucre"}
                        </span>
                      </div>

                      <StatusBadge status={ch.EstadoMovimiento || "Activo"} />
                    </div>

                    {/* SENSORES Y TELEMETRÍA */}
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 font-mono tabular-nums">
                      <div className="flex items-center gap-1">
                        <Gauge className="h-3 w-3 text-slate-400" />
                        <span>{ch.Velocidad || 0} km/h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BatteryCharging className="h-3 w-3 text-emerald-600" />
                        <span>{ch.Bateria || 100}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-right justify-end">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>hace {ch.SegundosDesdeUltimoReporte || 0}s</span>
                      </div>
                    </div>

                    {/* PROGRESO DE PARADAS */}
                    <div className="mt-2.5">
                      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                        <span>Paradas atendidas</span>
                        <span className="font-semibold font-mono tabular-nums">
                          {ch.ParadasCompletadas || 0} / {ch.TotalParadas || 0} ({porcentaje}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-xs h-1.5 overflow-hidden">
                        <div
                          className="bg-[#1C96C5] h-1.5 rounded-xs transition-all duration-300"
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* RECAUDACIÓN Y BOTONES DE ACCIÓN */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs text-slate-500 block">Cobrado en Ruta:</span>
                        <span className="text-xs font-semibold font-mono tabular-nums text-emerald-700">
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
                              className="h-7 text-xs font-medium px-2 rounded border-slate-200 text-slate-700 hover:text-[#1C96C5]"
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
                              className="h-7 text-xs font-medium px-2 rounded text-emerald-700 hover:bg-emerald-50 border-emerald-200"
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
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded overflow-hidden relative h-[660px]">
          <div
            ref={mapContainerRef}
            className="w-full h-full z-0"
            style={{ minHeight: "660px" }}
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
              className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded border border-slate-200 text-xs font-medium text-slate-700 hover:text-[#1C96C5] hover:border-[#1C96C5] transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5 text-[#1C96C5]" />
              <span>Centrar Sucre</span>
            </button>
          </div>

          {/* LEYENDA FLOTANTE SOBRE EL MAPA */}
          <div className="absolute top-3 right-3 z-[400] bg-white p-2.5 rounded border border-slate-200 text-xs space-y-1.5 pointer-events-auto">
            <span className="font-semibold text-slate-800 block text-xs uppercase tracking-wider">
              Referencia
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0369A1]"></span>
              <span>Camión de Reparto</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-700"></span>
              <span>Parada Entregada</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-xs bg-slate-500"></span>
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
