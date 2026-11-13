import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { getLeaflet } from "@/lib/leafletLoader";
import { Navigation, Eye, EyeOff, Maximize2, Info, ChevronDown, ChevronUp } from "lucide-react";

const SUCRE_CENTER = [-19.0435, -65.2580];
const POTOSI_CENTER = [-19.5836, -65.7531];

function calcularCentroMapa(idSucursal, ruta) {
  const sid = idSucursal || ruta?.IdSucursal;
  if (sid === "2" || sid === 2) return POTOSI_CENTER;
  if (String(ruta?.NombreRuta || "").toLowerCase().includes("potos")) return POTOSI_CENTER;
  return SUCRE_CENTER;
}

export default function MapaRuta({
  puntosRuta = [],
  todosPuntosVenta = [],
  rutaSeleccionada = null,
  idSucursal = null,
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

      const centroInicial = calcularCentroMapa(idSucursal, rutaSeleccionada);
      const map = L.map(mapContainerRef.current, {
        center: centroInicial,
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
      map.fitBounds(puntosConCoords, { padding: [50, 50], maxZoom: 16 });
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

      // Icono numerado industrial con fondo oscuro de alto contraste
      const customIcon = L.divIcon({
        className: "custom-stop-marker",
        html: `
          <div style="
            background: #0F172A;
            color: #ffffff;
            width: 30px;
            height: 30px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            font-family: monospace;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transform: translate(-50%, -50%);
          ">
            ${p.OrdenVisita || "•"}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [0, 0]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupContent = `
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4; min-width: 190px;">
          <div style="display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 2px; margin-bottom: 4px;">
            PARADA #${p.OrdenVisita}
          </div>
          <div style="font-weight: 700; color: #0f172a; font-size: 14px;">${p.NombreCliente || "Cliente"}</div>
          <div style="color: #334155; font-size: 12px; font-weight: 600; margin-top: 2px;">${p.NombrePuntoVenta || ""}</div>
          <div style="color: #475569; font-size: 12px; margin-top: 3px;">Dirección: ${p.Direccion || "Sin dirección"}</div>
          ${p.Referencia ? `<div style="color: #64748b; font-size: 12px; margin-top: 2px; font-style: italic;">Ref: ${p.Referencia}</div>` : ""}
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(layerGroup);
    });

    // 2. Trazado siguiendo calles reales con OSRM
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

            // Trazo vial con azul de contraste alto #0369A1
            polylineRef.current = L.polyline(routeGeom, {
              color: "#0369A1",
              weight: 4,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round"
            }).addTo(layerGroup);
          } else {
            polylineRef.current = L.polyline(coordsRuta, {
              color: "#0369A1",
              weight: 3,
              dashArray: "5, 5"
            }).addTo(layerGroup);
          }
        })
        .catch(() => {
          if (isCancelled) return;
          setCargandoRutaVial(false);
          polylineRef.current = L.polyline(coordsRuta, {
            color: "#0369A1",
            weight: 3,
            dashArray: "5, 5"
          }).addTo(layerGroup);
        });
    } else {
      setMetricasRuta(null);
    }

    // 3. Puntos de venta adicionales (controlados por toggle)
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
                background: #475569;
                color: #ffffff;
                width: 20px;
                height: 20px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 12px;
                border: 1px solid #ffffff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                transform: translate(-50%, -50%);
              ">
                +
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [0, 0]
          });

          const marker = L.marker([lat, lng], { icon: grayIcon });

          const popupDiv = document.createElement("div");
          popupDiv.style.fontFamily = "inherit";
          popupDiv.style.fontSize = "13px";
          popupDiv.style.minWidth = "180px";
          popupDiv.innerHTML = `
            <div style="color: #475569; font-size: 12px; font-weight: 700;">COMERCIO DISPONIBLE</div>
            <div style="font-weight: 700; color: #0f172a; font-size: 14px;">${pv.NombreCliente}</div>
            <div style="color: #334155; font-size: 12px;">${pv.NombrePuntoVenta}</div>
            <div style="color: #475569; font-size: 12px; margin-top: 2px;">Dirección: ${pv.Direccion}</div>
          `;

          if (onAgregarPunto) {
            const btn = document.createElement("button");
            btn.innerText = "+ Agregar a esta ruta";
            btn.style.marginTop = "8px";
            btn.style.width = "100%";
            btn.style.padding = "6px 8px";
            btn.style.backgroundColor = "#0F172A";
            btn.style.color = "#ffffff";
            btn.style.border = "none";
            btn.style.borderRadius = "2px";
            btn.style.fontSize = "12px";
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

    // 4. Zoom seguro a las paradas
    if (map && map._container && map._mapPane) {
      try {
        if (coordsRuta.length > 1) {
          map.fitBounds(coordsRuta, { padding: [50, 50], maxZoom: 16, animate: false });
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
    <div className={`relative w-full ${altura} rounded overflow-hidden border border-slate-300 bg-slate-100`}>
      {/* Contenedor del mapa Leaflet */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ minHeight: "520px", height: "100%", width: "100%" }}
      />

      {/* Barra flotante superior */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-2 z-10 pointer-events-none">
        {/* Métricas viales */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-300 pointer-events-auto text-xs">
          <Navigation className="h-3.5 w-3.5 text-[#1C96C5] shrink-0" />
          {puntosRuta.length === 0 ? (
            <span className="text-slate-600 font-medium">Sin paradas en la ruta</span>
          ) : (
            <div className="flex items-center gap-2 text-slate-900 font-semibold font-mono tabular-nums">
              <span className="text-[#0369A1]">{puntosRuta.length} paradas</span>
              {cargandoRutaVial ? (
                <span className="text-slate-500 font-normal">Calculando...</span>
              ) : metricasRuta ? (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{metricasRuta.distanciaKm} km</span>
                  <span className="text-slate-300">•</span>
                  <span>~{metricasRuta.duracionMin} min</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Botones de acción flotantes */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Botón Re-centrar zoom */}
          <button
            onClick={reCentrarRuta}
            type="button"
            className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-800 px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold transition-colors hover:border-[#1C96C5]"
            title="Ajustar zoom a todas las paradas de la ruta"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[#1C96C5]" />
            <span className="hidden sm:inline">Enfocar Ruta</span>
          </button>

          {/* Toggle para mostrar/ocultar otros comercios */}
          <button
            onClick={() => setMostrarOtrosComercios(!mostrarOtrosComercios)}
            type="button"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-semibold transition-colors ${
              mostrarOtrosComercios
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-800 border-slate-300 hover:border-slate-400"
            }`}
            title="Mostrar u ocultar los otros puntos de venta de la ciudad"
          >
            {mostrarOtrosComercios ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-slate-600" />}
            <span className="hidden sm:inline">{mostrarOtrosComercios ? "Ocultar otros" : "Ver otros comercios"}</span>
          </button>

          {/* Toggle de leyenda compacta */}
          <button
            onClick={() => setMostrarLeyenda(!mostrarLeyenda)}
            type="button"
            className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-800 px-2.5 py-1.5 rounded border border-slate-300 text-xs font-semibold transition-colors"
            title="Información de la leyenda"
          >
            <Info className="h-3.5 w-3.5 text-[#1C96C5]" />
            <span className="hidden sm:inline">Leyenda</span>
            {mostrarLeyenda ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Leyenda flotante colapsable */}
      {mostrarLeyenda && (
        <div className="absolute bottom-2.5 right-2.5 bg-white px-3 py-2.5 rounded border border-slate-300 text-xs text-slate-800 z-10 space-y-1.5 max-w-xs pointer-events-auto">
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
            <span>Guía de Mapa GPS</span>
            <button onClick={() => setMostrarLeyenda(false)} className="text-slate-500 hover:text-slate-800 text-xs font-bold">X</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-[#0F172A] text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono">1</span>
            <span>Paradas numeradas en secuencia de entrega</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-[#0369A1] rounded shrink-0"></span>
            <span>Ruta vehicular calculada por calles (OSRM)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-slate-600 text-white flex items-center justify-center font-bold text-xs shrink-0">+</span>
            <span>Otros puntos en Sucre (clic para agregar)</span>
          </div>
        </div>
      )}
    </div>
  );
}
