/**
 * Cargador resiliente de Leaflet para entornos Astro / Vite / SSR.
 * Garantiza que Leaflet esté disponible tanto si se carga desde el bundle,
 * desde script global, o mediante fallback en cliente, evitando errores 504 de Vite.
 */
let leafletPromise = null;

export async function getLeaflet() {
  if (typeof window === "undefined") return null;

  // 1. Si window.L ya está cargado globalmente (por script en Layout o CDN)
  if (window.L && typeof window.L.map === "function") {
    return window.L;
  }

  if (leafletPromise) return leafletPromise;

  leafletPromise = (async () => {
    // 2. Intentar import dinámico del paquete instalado
    try {
      const mod = await import("leaflet");
      const L = mod.default || mod;
      if (L && typeof L.map === "function") {
        window.L = L;
        return L;
      }
    } catch (err) {
      console.warn("Aviso: import local de Leaflet falló o fue bloqueado por Vite dev cache. Intentando fallback inmediato...", err);
    }

    // 3. Fallback: Inyección dinámica en el DOM
    return new Promise((resolve, reject) => {
      // Inyectar CSS si no existe
      if (!document.getElementById("leaflet-fallback-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-fallback-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Si ya hay un script inyectándose
      const existingScript = document.getElementById("leaflet-fallback-script");
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.L) resolve(window.L);
          else reject(new Error("Leaflet no se inicializó en window.L"));
        });
        return;
      }

      const script = document.createElement("script");
      script.id = "leaflet-fallback-script";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        if (window.L && typeof window.L.map === "function") {
          resolve(window.L);
        } else {
          reject(new Error("Leaflet no se inicializó correctamente en window"));
        }
      };
      script.onerror = (e) => reject(new Error("Error al descargar script Leaflet: " + e));
      document.head.appendChild(script);
    });
  })();

  return leafletPromise;
}
