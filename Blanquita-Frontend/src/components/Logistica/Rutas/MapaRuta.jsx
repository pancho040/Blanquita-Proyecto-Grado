import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { getLeaflet } from "@/lib/leafletLoader";
import { Navigation, Eye, EyeOff, Maximize2, Info, ChevronDown, ChevronUp } from "lucide-react";

const SUCRE_CENTER = [-19.0435, -65.258];
let cachedLeaflet = null;

export default function MapaRuta({
  puntosRuta = [],
  todosPuntosVenta = [],
  rutaSeleccionada = null,
  onAgregarPunto = null,
  altura = "h-[560px]"
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const polylineRef = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const LRef = useRef(null);

  // Estados de control del mapa
  const [mostrarOtrosComercios, setMostrarOtrosComercios] = useState(false);
  const [mostrarLeyenda, setMostrarLeyenda] = useState(false);
  const [metricasRuta, setMetricasRuta] = useState(null);
  const [cargandoRutaVial, setCargandoRutaVial] = useState(false);

  // Inicializar mapa de Leaflet
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

      layerGroupRef.current = L.layerGroup().addTo(map);
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

      timersRef.push(t1, t2, t3);
    }

    const timersRef = [];
    initMap();

    return () => {
      isMounted = false;
      timersRef.forEach(clearTimeout);
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Función para re-centrar el mapa en la ruta actual
  const reCentrarRuta = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const puntosConCoords = puntosRuta
      .filter((p) => p.Latitud && p.Longitud)
      .map((p) => [Number(p.Latitud), Number(p.Longitud)]);

    if (puntosConCoords.length > 1) {
      map.fitBounds(puntosConCoords, { padding: [60, 60], maxZoom: 16 });
    } else if (puntosConCoords.length === 1) {
      map.setView(puntosConCoords[0], 16);
    } else {
      map.setView(SUCRE_CENTER, 14);
    }
  };

  // Actualizar marcadores, trazado por calles (OSRM) y zoom específico
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !layerGroupRef.current) return;

    let isCancelled = false;
    let abortController = null;
    const L = LRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    layerGroup.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const idsEnRuta = new Set(puntosRuta.map((p) => p.IdPuntoVenta));

    // 1. Puntos de la ruta en orden
    const puntosConCoords = puntosRuta
      .filter((p) => p.Latitud && p.Longitud)
      .sort((a, b) => (a.OrdenVisita || 0) - (b.OrdenVisita || 0));

    const coordsRuta = [];

    puntosConCoords.forEach((p) => {
      const lat = Number(p.Latitud);
      const lng = Number(p.Longitud);
      coordsRuta.push([lat, lng]);

      // Icono numerado llamativo
      const customIcon = L.divIcon({
        className: "custom-stop-marker",
        html: `
          <div style="
            background: linear-gradient(135deg, #20A7DB 0%, #0284c7 100%);
            color: #ffffff;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 14px;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.45);
            transform: translate(-50%, -50%);
          ">
            ${p.OrdenVisita || "•"}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [0, 0]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; min-width: 200px;">
          <div style="display: inline-block; background: #e0f2fe; color: #0284c7; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 4px; margin-bottom: 5px;">
            PARADA #${p.OrdenVisita}
          </div>
          <div style="font-weight: 800; color: #0f172a; font-size: 15px;">${p.NombreCliente || "Cliente"}</div>
          <div style="color: #334155; font-size: 12px; font-weight: 600; margin-top: 2px;">${p.NombrePuntoVenta || ""}</div>
          <div style="color: #64748b; font-size: 12px; margin-top: 4px;">Dirección: ${p.Direccion || "Sin dirección"}</div>
          ${p.Referencia ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 3px; font-style: italic;">Ref: ${p.Referencia}</div>` : ""}
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(layerGroup);
    });

    // 2. Trazado siguiendo calles reales con OSRM (Open Source Routing Machine)
    if (coordsRuta.length > 1) {
      setCargandoRutaVial(true);
      abortController = new AbortController();
      const signal = abortController.signal;
      const timeoutId = setTimeout(() => {
        if (abortController) abortController.abort();
      }, 2500);

      const osrmCoords = puntosConCoords.map((p) => `${p.Longitud},${p.Latitud}`).join(";");
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;

      fetch(osrmUrl, { signal })
        .then((res) => res.json())
        .then((data) => {
          clearTimeout(timeoutId);
          if (isCancelled) return;
          setCargandoRutaVial(false);

          if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            const r = data.routes[0];
            const routeGeom = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

            setMetricasRuta({
              distanciaKm: (r.distance / 1000).toFixed(1),
              duracionMin: Math.max(1, Math.round(r.duration / 60))
            });

            // Trazo vial que respeta calles
            polylineRef.current = L.polyline(routeGeom, {
              color: "#0284c7",
              weight: 5,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round"
            }).addTo(layerGroup);
          } else {
            // Fallback a línea directa si OSRM no responde
            polylineRef.current = L.polyline(coordsRuta, {
              color: "#20A7DB",
              weight: 4,
              dashArray: "6, 6"
            }).addTo(layerGroup);
          }
        })
        .catch(() => {
          if (isCancelled) return;
          setCargandoRutaVial(false);
          // Fallback a línea directa
          polylineRef.current = L.polyline(coordsRuta, {
            color: "#20A7DB",
            weight: 4,
            dashArray: "6, 6"
          }).addTo(layerGroup);
        });
    } else {
      setMetricasRuta(null);
    }

    // 3. Puntos de venta adicionales (Opcionales, controlados por toggle para no tapar el mapa)
    if (mostrarOtrosComercios) {
      todosPuntosVenta
        .filter((pv) => pv.Latitud && pv.Longitud && !idsEnRuta.has(pv.IdPuntoVenta))
        .forEach((pv) => {
          const lat = Number(pv.Latitud);
          const lng = Number(pv.Longitud);

          const grayIcon = L.divIcon({
            className: "custom-available-marker",
            html: `
              <div style="
                background: #94a3b8;
                color: #ffffff;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 11px;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                transform: translate(-50%, -50%);
              ">
                +
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [0, 0]
          });

          const marker = L.marker([lat, lng], { icon: grayIcon });

          const popupDiv = document.createElement("div");
          popupDiv.style.fontFamily = "inherit";
          popupDiv.style.fontSize = "12px";
          popupDiv.style.minWidth = "180px";
          popupDiv.innerHTML = `
            <div style="color: #64748b; font-size: 10px; font-weight: 700;">COMERCIO DISPONIBLE</div>
            <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${pv.NombreCliente}</div>
            <div style="color: #475569; font-size: 11px;">${pv.NombrePuntoVenta}</div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Dirección: ${pv.Direccion}</div>
          `;

          if (onAgregarPunto) {
            const btn = document.createElement("button");
            btn.innerText = "+ Agregar a esta ruta";
            btn.style.marginTop = "8px";
            btn.style.width = "100%";
            btn.style.padding = "6px 8px";
            btn.style.backgroundColor = "#20A7DB";
            btn.style.color = "#ffffff";
            btn.style.border = "none";
            btn.style.borderRadius = "5px";
            btn.style.fontSize = "11px";
            btn.style.fontWeight = "bold";
            btn.style.cursor = "pointer";
            btn.onclick = () => {
              onAgregarPunto(pv.IdPuntoVenta);
              marker.closePopup();
            };
            popupDiv.appendChild(btn);
          }

          marker.bindPopup(popupDiv);
          marker.addTo(layerGroup);
        });
    }

    // 4. ZOOM EXCLUSIVO: Hacer zoom SOLO a las paradas de la ruta seleccionada de forma segura
    if (map && map._container && map._mapPane) {
      try {
        if (coordsRuta.length > 1) {
          map.fitBounds(coordsRuta, { padding: [60, 60], maxZoom: 16, animate: false });
        } else if (coordsRuta.length === 1) {
          map.setView(coordsRuta[0], 16, { animate: false });
        } else {
          map.setView(SUCRE_CENTER, 14, { animate: false });
        }
      } catch {}
    }

    const timerInvalidate = setTimeout(() => {
      if (!isCancelled && mapInstanceRef.current && mapInstanceRef.current._mapPane) {
        try {
          mapInstanceRef.current.invalidateSize();
        } catch {}
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timerInvalidate);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [puntosRuta, todosPuntosVenta, rutaSeleccionada, leafletLoaded, mostrarOtrosComercios]);

  return (
    <div className={`relative w-full ${altura} rounded-xl overflow-hidden border border-slate-200 shadow-md bg-slate-100`}>
      {/* Contenedor del mapa Leaflet */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ minHeight: "520px", height: "100%", width: "100%" }}
      />

      {/* Barra flotante superior: Métricas del trayecto por calles y botones de control */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
        {/* Métricas viales */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 pointer-events-auto text-xs">
          <Navigation className="h-4 w-4 text-[#20A7DB] shrink-0" />
          {puntosRuta.length === 0 ? (
            <span className="text-slate-500 font-medium">Sin paradas en la ruta</span>
          ) : (
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <span className="text-[#20A7DB] font-bold">{puntosRuta.length} paradas</span>
              {cargandoRutaVial ? (
                <span className="text-slate-400 font-normal">Calculando calles...</span>
              ) : metricasRuta ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{metricasRuta.distanciaKm} km</span>
                  <span className="text-slate-300">•</span>
                  <span>Aprox. {metricasRuta.duracionMin} min</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Botones de acción flotantes */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Botón Re-centrar zoom en la ruta */}
          <button
            onClick={reCentrarRuta}
            type="button"
            className="flex items-center gap-1 bg-white/95 backdrop-blur-md hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-semibold transition-all hover:border-[#20A7DB]"
            title="Ajustar zoom a todas las paradas de la ruta"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[#20A7DB]" />
            <span className="hidden sm:inline">Enfocar Ruta</span>
          </button>

          {/* Toggle para mostrar/ocultar otros comercios */}
          <button
            onClick={() => setMostrarOtrosComercios(!mostrarOtrosComercios)}
            type="button"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg shadow-sm border text-xs font-semibold transition-all backdrop-blur-md ${
              mostrarOtrosComercios
                ? "bg-[#20A7DB] text-white border-[#20A7DB]"
                : "bg-white/95 text-slate-700 border-slate-200 hover:border-slate-300"
            }`}
            title="Mostrar u ocultar los otros puntos de venta de la ciudad"
          >
            {mostrarOtrosComercios ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
            <span className="hidden sm:inline">{mostrarOtrosComercios ? "Ocultar otros comercios" : "Ver otros comercios"}</span>
          </button>

          {/* Toggle de leyenda compacta */}
          <button
            onClick={() => setMostrarLeyenda(!mostrarLeyenda)}
            type="button"
            className="flex items-center gap-1 bg-white/95 backdrop-blur-md hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-semibold transition-all"
            title="Información de la leyenda"
          >
            <Info className="h-3.5 w-3.5 text-[#20A7DB]" />
            <span className="hidden sm:inline">Leyenda</span>
            {mostrarLeyenda ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Leyenda flotante colapsable (no tapa el mapa a menos que se solicite) */}
      {mostrarLeyenda && (
        <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-200 text-xs text-slate-700 z-10 space-y-1.5 max-w-xs transition-all pointer-events-auto">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between">
            <span>Guía del Mapa GPS</span>
            <button onClick={() => setMostrarLeyenda(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0284c7] text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
            <span>Paradas numeradas en secuencia de entrega</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-1 bg-[#0284c7] rounded-full shrink-0"></span>
            <span>Ruta vehicular calculada por calles (OSRM)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-[9px] shrink-0">+</span>
            <span>Otros puntos en Sucre (haz clic para agregar)</span>
          </div>
        </div>
      )}
    </div>
  );
}
