import { useEffect, useRef, useState, useId } from "react";
import "leaflet/dist/leaflet.css";
import { getLeaflet } from "@/lib/leafletLoader";
import { MapPin, Navigation, Crosshair, Sparkles } from "lucide-react";

const SUCRE_DEFAULT = { lat: -19.0435, lng: -65.258 };

const PRESETS_SUCRE = [
  { nombre: "Mercado Campesino", lat: -19.0345, lng: -65.2530, ref: "Av. Ostria Gutiérrez" },
  { nombre: "Plaza 25 de Mayo", lat: -19.0483, lng: -65.2598, ref: "Centro Histórico" },
  { nombre: "Zona SAS / Parque Bolívar", lat: -19.0435, lng: -65.2612, ref: "Av. Jaime Mendoza" },
  { nombre: "Mercado Central", lat: -19.0450, lng: -65.2580, ref: "Calle Junín / Ravelo" },
  { nombre: "San Roque / Calvo", lat: -19.0520, lng: -65.2640, ref: "Zona tradicional San Roque" },
  { nombre: "Azari / Molle Molle", lat: -19.0680, lng: -65.2450, ref: "Zona Sur Residencial" }
];

/**
 * Selector de ubicación interactivo en mapa Leaflet con arrastre de pin y presets de Sucre.
 * @param {number} lat
 * @param {number} lng
 * @param {Function} onChange ({ lat, lng })
 * @param {string} altura
 * @param {string} label
 */
let cachedLeaflet = null;

export default function MapaSelectorUbicacion({
  lat = SUCRE_DEFAULT.lat,
  lng = SUCRE_DEFAULT.lng,
  onChange,
  altura = "h-64",
  label = "Ubicar en el Mapa de Sucre (Haz clic o arrastra el marcador)"
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const LRef = useRef(null);
  const mapId = useId().replace(/:/g, "_");

  const [coords, setCoords] = useState({
    lat: Number(lat) || SUCRE_DEFAULT.lat,
    lng: Number(lng) || SUCRE_DEFAULT.lng
  });

  // Mantener coords sincronizadas con props entrantes
  useEffect(() => {
    if (lat && lng && (Math.abs(Number(lat) - coords.lat) > 0.0001 || Math.abs(Number(lng) - coords.lng) > 0.0001)) {
      const nuevaLat = Number(lat);
      const nuevaLng = Number(lng);
      setCoords({ lat: nuevaLat, lng: nuevaLng });
      if (markerRef.current) {
        markerRef.current.setLatLng([nuevaLat, nuevaLng]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([nuevaLat, nuevaLng]);
      }
    }
  }, [lat, lng]);

  // Inicializar Leaflet de forma segura
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      const L = await getLeaflet();
      if (!L || !isMounted || !mapContainerRef.current) return;
      LRef.current = L;

      // Destruir mapa previo si existe
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current._leaflet_id) {
        mapContainerRef.current._leaflet_id = null;
      }

      const initialLat = Number(lat) || SUCRE_DEFAULT.lat;
      const initialLng = Number(lng) || SUCRE_DEFAULT.lng;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true
      });

      LRef.current.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(map);

      // Icono personalizado del marcador
      const markerIcon = LRef.current.divIcon({
        className: "custom-pin",
        html: `
          <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
            <div style="background-color:#EF4444; width:32px; height:32px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); border:2px solid white;">
              <div style="background-color:white; width:10px; height:10px; border-radius:50%; transform:rotate(45deg);"></div>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      // Crear marcador draggable
      const marker = LRef.current.marker([initialLat, initialLng], {
        icon: markerIcon,
        draggable: true,
        autoPan: true
      }).addTo(map);

      // Evento al arrastrar el marcador
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        actualizarCoordenadas(position.lat, position.lng);
      });

      // Evento al hacer clic en cualquier parte del mapa
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        actualizarCoordenadas(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Invalidate size después del render del modal
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const actualizarCoordenadas = (nuevaLat, nuevaLng) => {
    const latFixed = Number(Number(nuevaLat).toFixed(6));
    const lngFixed = Number(Number(nuevaLng).toFixed(6));
    setCoords({ lat: latFixed, lng: lngFixed });
    if (onChange) {
      onChange({ lat: latFixed, lng: lngFixed });
    }
  };

  const aplicarPreset = (p) => {
    setCoords({ lat: p.lat, lng: p.lng });
    if (markerRef.current) {
      markerRef.current.setLatLng([p.lat, p.lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([p.lat, p.lng], 16, { duration: 1 });
    }
    if (onChange) {
      onChange({ lat: p.lat, lng: p.lng, referencia: p.ref });
    }
  };

  const centrarEnPin = () => {
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([coords.lat, coords.lng], 16, { duration: 0.8 });
    }
  };

  return (
    <div className="space-y-2">
      {/* Cabecera del selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-[#20A7DB]" />
          <span>{label}</span>
        </label>
        <button
          type="button"
          onClick={centrarEnPin}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#20A7DB] hover:underline"
        >
          <Crosshair className="h-3 w-3" />
          <span>Centrar en el pin</span>
        </button>
      </div>

      {/* Presets de Sucre */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS_SUCRE.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => aplicarPreset(p)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-50 hover:bg-sky-50 text-slate-700 border border-slate-200 hover:border-sky-300 transition-colors font-medium"
          >
            <MapPin className="h-3 w-3 text-[#20A7DB]" />
            <span>{p.nombre}</span>
          </button>
        ))}
      </div>

      {/* Contenedor del Mapa Leaflet */}
      <div className={`relative w-full ${altura} rounded-xl border border-slate-300 overflow-hidden shadow-2xs z-0`}>
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          id={`map_${mapId}`}
          style={{ minHeight: "240px", height: "100%", width: "100%" }}
        />
        
        {/* Badge flotante con coordenadas en tiempo real */}
        <div className="absolute bottom-2 left-2 z-[400] bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-[11px] font-semibold text-slate-800 shadow-sm flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span>Lat: {coords.lat}</span>
          <span>•</span>
          <span>Lng: {coords.lng}</span>
        </div>
      </div>
    </div>
  );
}