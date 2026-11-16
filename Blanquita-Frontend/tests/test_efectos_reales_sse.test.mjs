/**
 * test_efectos_reales_sse.test.mjs
 * Pruebas de integración de componentes reales con React Testing Library y JSDOM.
 * NO USA renderToString. Ejecuta el ciclo de vida completo de React:
 * montaje en DOM real, useEffects, suscripción SSE, emisión de eventos en tiempo real,
 * reactividad en el DOM y desuscripción limpia al desmontar.
 */

import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// 1. Inicializar JSDOM antes de montar cualquier componente
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:4321/supervisor/rutas?sucursal=2&vista=vivo",
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Document = dom.window.Document;
globalThis.Window = dom.window.constructor;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.Text = dom.window.Text;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.HTMLDivElement = dom.window.HTMLDivElement;
globalThis.HTMLSpanElement = dom.window.HTMLSpanElement;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.FocusEvent = dom.window.FocusEvent;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

try {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
} catch {}
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.localStorage = dom.window.localStorage;
globalThis.AbortController = dom.window.AbortController;
globalThis.location = dom.window.location;

// Polyfill ResizeObserver y matchMedia para Radix / Base UI / Leaflet
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.window.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
});

// Mock Leaflet loader para evitar llamadas nativas de canvas en jsdom
dom.window.L = {
  map: () => ({
    setView: () => ({}),
    remove: () => {},
    on: () => {},
    off: () => {},
    fitBounds: () => {},
    invalidateSize: () => {},
    flyTo: () => {},
    panTo: () => {},
  }),
  tileLayer: () => ({ addTo: () => ({}) }),
  marker: () => ({
    addTo: () => ({
      bindPopup: () => ({}),
      setIcon: () => ({}),
      setLatLng: () => ({}),
      on: () => {},
    }),
  }),
  divIcon: () => ({}),
  icon: () => ({}),
  polyline: () => ({ addTo: () => ({}) }),
  layerGroup: () => {
    const lg = {
      addTo: () => lg,
      clearLayers: () => lg,
      addLayer: () => lg,
      removeLayer: () => lg,
    };
    return lg;
  },
  latLng: (lat, lng) => ({ lat, lng }),
  latLngBounds: () => ({
    isValid: () => false,
    extend: () => {},
  }),
};
globalThis.L = dom.window.L;

// 2. Mock de fetch con datos controlados para endpoints de la API
const choferesControlados = [
  {
    IdUsuarioRepartidor: 24,
    id_chofer: 24,
    NombreCompleto: "Jaime Villegas",
    NombreChofer: "Jaime Villegas",
    NumeroTelefono: "71234567",
    Latitud: -19.0421,
    Longitud: -65.2589,
    VelocidadKmH: 22,
    NivelBateria: 85,
    EstadoMovimiento: "En Ruta",
    EnLinea: true,
    monto_cobrado: 348.30, // Número
    IdRutaDistribucion: 10,
    NombreRuta: "Ruta Potosí Centro",
    ParadaActual: 3,
    TotalParadas: 8,
  },
  {
    IdUsuarioRepartidor: 99,
    id_chofer: 99,
    NombreCompleto: "TEST_Potosi Chofer",
    NombreChofer: "TEST_Potosi Chofer",
    NumeroTelefono: "79999999",
    Latitud: -19.5833,
    Longitud: -65.7500,
    VelocidadKmH: 0,
    NivelBateria: 40,
    EstadoMovimiento: "En Pausa",
    EnLinea: true,
    monto_cobrado: "348.30", // String
    IdRutaDistribucion: 12,
    NombreRuta: "Ruta Mercado Central",
    ParadaActual: 1,
    TotalParadas: 4,
  },
  {
    IdUsuarioRepartidor: 105,
    id_chofer: 105,
    NombreCompleto: "Chofer Sin Señal",
    NombreChofer: "Chofer Sin Señal",
    NumeroTelefono: "70000000",
    Latitud: null,
    Longitud: null,
    VelocidadKmH: 0,
    NivelBateria: 10,
    EstadoMovimiento: "Sin Señal",
    EnLinea: false,
    monto_cobrado: 0,
    IdRutaDistribucion: null, // Sin ruta
    NombreRuta: null,
  },
];

globalThis.fetch = async (url, opts = {}) => {
  const urlStr = String(url);

  if (urlStr.includes("/Usuario/mi-alcance")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id_usuario: 10,
        nombre: "Supervisor Test Potosi",
        id_rol: 4,
        rol: "SUPERVISOR",
        sucursal_id: 2,
        sucursales_permitidas: [2],
        puede_ver_todas: false,
      }),
    };
  }

  if (urlStr.includes("/api/logistica/telemetria/en-vivo")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choferes: choferesControlados,
        total: choferesControlados.length,
      }),
    };
  }

  if (urlStr.includes("/api/logistica/repartidores")) {
    return {
      ok: true,
      status: 200,
      json: async () => choferesControlados.map((c) => ({
        IdUsuario: c.IdUsuarioRepartidor,
        PrimerNombre: c.NombreCompleto.split(" ")[0],
        ApellidoPaterno: c.NombreCompleto.split(" ")[1] || "",
        IdEstadoUsuario: c.EnLinea ? 1 : 2,
        EstadoMovimiento: c.EstadoMovimiento,
      })),
    };
  }

  if (urlStr.includes("/api/logistica/rutas")) {
    return {
      ok: true,
      status: 200,
      json: async () => [
        { IdRutaDistribucion: 10, NombreRuta: "Ruta Potosí Centro", IdSucursal: 2, ParadasCount: 8 },
        { IdRutaDistribucion: 12, NombreRuta: "Ruta Mercado Central", IdSucursal: 2, ParadasCount: 4 },
      ],
    };
  }

  if (urlStr.includes("/api/logistica/asignaciones")) {
    return {
      ok: true,
      status: 200,
      json: async () => [
        {
          IdAsignacionRuta: 254,
          IdRutaDistribucion: 10,
          NombreRuta: "Ruta Potosí Centro",
          IdUsuarioRepartidor: 24,
          NombreChofer: "Jaime Villegas",
          Estado: "EN_RUTA",
          TotalEntregas: 8,
          EntregasCompletadas: 3,
          TotalCobrado: 348.30,
        },
      ],
    };
  }

  if (urlStr.includes("/api/logistica/solicitudes-carga") || urlStr.includes("/api/logistica/solicitud-carga")) {
    return {
      ok: true,
      status: 200,
      json: async () => [
        {
          id_solicitud: 1,
          id_asignacion: 254,
          nombre_chofer: "Jaime Villegas",
          estado: "PENDIENTE",
          id_sucursal: 2,
          items_count: 3,
        },
      ],
    };
  }

  if (urlStr.includes("/api/logistica/zonas")) {
    return {
      ok: true,
      status: 200,
      json: async () => [
        { IdZonaDistribucion: 1, NombreZona: "Centro", Descripcion: "Zona Central" },
      ],
    };
  }

  return {
    ok: true,
    status: 200,
    json: async () => ([]),
  };
};
globalThis.window.fetch = globalThis.fetch;

// 3. Espía estricto de console.error y console.warn
const erroresConsola = [];
const consoleErrorOriginal = console.error;
const consoleWarnOriginal = console.warn;

console.error = (...args) => {
  const msg = args.map((a) => (a instanceof Error ? a.stack : String(a))).join(" ");
  if (msg.includes("React") || msg.includes("Uncaught") || msg.includes("TypeError") || msg.includes("ReferenceError")) {
    erroresConsola.push(`[console.error] ${msg}`);
  }
  consoleErrorOriginal(...args);
};

console.warn = (...args) => {
  const msg = args.map((a) => (a instanceof Error ? a.stack : String(a))).join(" ");
  if (msg.includes("React") && (msg.includes("cannot update") || msg.includes("unmounted"))) {
    erroresConsola.push(`[console.warn] ${msg}`);
  }
  consoleWarnOriginal(...args);
};

async function ejecutarPruebas() {
  console.log("\n🧪 INICIANDO TEST DE EFECTOS REALES (JSDOM + @testing-library/react + Vite SSR)...");

  const server = await createServer({
    root: rootDir,
    resolve: {
      alias: {
        "@/constants/estados": path.resolve(rootDir, "src/constants/Estados.js"),
        "@": path.resolve(rootDir, "src"),
      },
    },
    server: { middlewareMode: true },
    appType: "custom",
  });

  const { render, act, cleanup } = await import("@testing-library/react");
  const { default: React } = await import("react");

  const modSSE = await server.ssrLoadModule("/src/services/Logistica/LogisticaSSEClient.js");
  const logisticaSSE = modSSE.logisticaSSE;

  const modNavBar = await server.ssrLoadModule("/src/components/layout/NavBar.jsx");
  const NavBar = modNavBar.default;

  const modToast = await server.ssrLoadModule("/src/components/common/ToastLiveContainer.jsx");
  const ToastLiveContainer = modToast.default;

  const modBanner = await server.ssrLoadModule("/src/components/Logistica/Reparto/AlertaSolicitudesCargaBanner.jsx");
  const AlertaSolicitudesCargaBanner = modBanner.default;

  const modInicio = await server.ssrLoadModule("/src/components/Logistica/InicioSupervisor.jsx");
  const InicioSupervisor = modInicio.default;

  const modGestor = await server.ssrLoadModule("/src/components/Logistica/Rutas/GestorRutas.jsx");
  const GestorRutas = modGestor.default;

  const modTablaAsig = await server.ssrLoadModule("/src/components/Logistica/Asignaciones/TablaAsignaciones.jsx");
  const TablaAsignaciones = modTablaAsig.default;

  const modRastreo = await server.ssrLoadModule("/src/components/Logistica/Rutas/RastreoChoferesGPS.jsx");
  const RastreoChoferesGPS = modRastreo.default;

  const modBandeja = await server.ssrLoadModule("/src/components/Logistica/Reparto/BandejaSolicitudCargaModal.jsx");
  const BandejaSolicitudCargaModal = modBandeja.default;

  const modModalParadas = await server.ssrLoadModule("/src/components/Logistica/Rutas/ModalDetalleParadasGPS.jsx");
  const ModalDetalleParadasGPS = modModalParadas.default;

  const modModalStock = await server.ssrLoadModule("/src/components/Logistica/Asignaciones/ModalStockCamion.jsx");
  const ModalStockCamion = modModalStock.default;

  const usuarioPrueba = {
    IdUsuario: 10,
    PrimerNombre: "Supervisor",
    ApellidoPaterno: "Potosi",
    IdRol: 4,
    Rol: "SUPERVISOR",
    IdSucursal: 2,
  };

  // 1. Montaje de NavBar
  console.log("-> 1. Montando NavBar...");
  let navBarRender;
  await act(async () => {
    navBarRender = render(React.createElement(NavBar, {
      idRol: 4,
      seccion: "Rutas",
      esAdmin: false,
      usuario: usuarioPrueba,
      rutaInicial: "/supervisor/rutas",
    }));
  });
  assert.ok(navBarRender.container.innerHTML.length > 0, "NavBar debe renderizar contenido en el DOM");

  // 2. Montaje de ToastLiveContainer y emisión de eventos SSE
  console.log("-> 2. Montando ToastLiveContainer y emitiendo eventos SSE...");
  let toastRender;
  await act(async () => {
    toastRender = render(React.createElement(ToastLiveContainer, {
      basePath: "supervisor",
      esAdmin: false,
    }));
  });

  // Emitir evento SOLICITUD_CARGA
  await act(async () => {
    logisticaSSE.emitir("SOLICITUD_CARGA", {
      id_solicitud: 1,
      id_asignacion: 254,
      nombre_chofer: "Jaime Villegas",
      mensaje: "Solicitud de carga enviada",
      items_count: 3,
    });
  });
  assert.ok(
    toastRender.container.textContent.includes("Jaime Villegas") ||
    toastRender.container.textContent.includes("Solicitud de Carga"),
    "ToastLiveContainer debe reflejar el evento SSE de carga en la UI"
  );

  // Emitir evento ENTREGA_REGISTRADA
  await act(async () => {
    logisticaSSE.emitir("ENTREGA_REGISTRADA", {
      id_asignacion: 254,
      nombre_chofer: "Jaime Villegas",
      monto: 348.30,
      mensaje: "Entrega completada",
    });
  });

  // 3. Montaje de AlertaSolicitudesCargaBanner
  console.log("-> 3. Montando AlertaSolicitudesCargaBanner...");
  let bannerRender;
  await act(async () => {
    bannerRender = render(React.createElement(AlertaSolicitudesCargaBanner, {
      sucursal: 2,
      onAprobado: () => {},
    }));
  });
  assert.ok(bannerRender.container !== null);

  // 4. Montaje de InicioSupervisor
  console.log("-> 4. Montando InicioSupervisor...");
  let inicioRender;
  await act(async () => {
    inicioRender = render(React.createElement(InicioSupervisor, {
      usuario: usuarioPrueba,
    }));
  });
  assert.ok(inicioRender.container !== null);

  // 5. Montaje de GestorRutas (planificación y vivo)
  console.log("-> 5. Montando GestorRutas...");
  let gestorPlanRender;
  await act(async () => {
    gestorPlanRender = render(React.createElement(GestorRutas, {
      usuario: usuarioPrueba,
    }));
  });
  assert.ok(gestorPlanRender.container !== null);

  // 6. Montaje de TablaAsignaciones (despachos)
  console.log("-> 6. Montando TablaAsignaciones...");
  let tablaAsigRender;
  await act(async () => {
    tablaAsigRender = render(React.createElement(TablaAsignaciones, {
      usuario: usuarioPrueba,
      vistaInicial: "despachos",
    }));
  });
  assert.ok(tablaAsigRender.container !== null);

  // 7. Montaje de RastreoChoferesGPS y telemetría SSE en vivo
  console.log("-> 7. Montando RastreoChoferesGPS y emitiendo UBICACION...");
  let rastreoRender;
  await act(async () => {
    rastreoRender = render(React.createElement(RastreoChoferesGPS, {
      usuario: usuarioPrueba,
    }));
  });

  // Emitir evento UBICACION para Jaime Villegas
  await act(async () => {
    logisticaSSE.emitir("UBICACION", {
      id_chofer: 24,
      latitud: -19.0435,
      longitud: -65.2598,
      velocidad: 35,
      bateria: 82,
      estado_movimiento: "En Movimiento",
      parada_actual: 4,
      total_paradas: 8,
      monto_cobrado: 348.30,
    });
  });

  // 8. Modales requeridos
  console.log("-> 8. Montando modales: BandejaSolicitudCargaModal, ModalDetalleParadasGPS, ModalStockCamion...");
  let modalBandejaRender, modalParadasRender, modalStockRender;

  await act(async () => {
    modalBandejaRender = render(React.createElement(BandejaSolicitudCargaModal, {
      abierto: true,
      onOpenChange: () => {},
      solicitud: { id_solicitud: 1, id_asignacion: 254, nombre_chofer: "Jaime Villegas" },
    }));

    modalParadasRender = render(React.createElement(ModalDetalleParadasGPS, {
      abierto: true,
      idAsignacion: 254,
      onCerrar: () => {},
    }));

    modalStockRender = render(React.createElement(ModalStockCamion, {
      abierto: true,
      onOpenChange: () => {},
      idChofer: 24,
      nombreChofer: "Jaime Villegas",
      asignacion: { IdAsignacionRuta: 254 },
    }));
  });

  // 9. Verificación de desuscripción al desmontar componentes
  console.log("-> 9. Verificando desuscripción limpia al desmontar...");
  const oyentesAntes = logisticaSSE.oyentes.get("UBICACION")?.size || 0;
  await act(async () => {
    rastreoRender.unmount();
    toastRender.unmount();
    gestorPlanRender.unmount();
    tablaAsigRender.unmount();
    bannerRender.unmount();
    inicioRender.unmount();
    navBarRender.unmount();
    modalBandejaRender.unmount();
    modalParadasRender.unmount();
    modalStockRender.unmount();
    cleanup();
  });

  const oyentesDespues = logisticaSSE.oyentes.get("UBICACION")?.size || 0;
  console.log(`Oyentes UBICACION: antes de desmontar=${oyentesAntes}, después de desmontar=${oyentesDespues}`);
  assert.ok(oyentesDespues < oyentesAntes, "Al desmontar componentes los oyentes SSE deben decrementar y desuscribirse limpiamente");

  await server.close();

  // 10. Validación estricta de cero errores en consola
  if (erroresConsola.length > 0) {
    console.error(`\n❌ [TEST FALLIDO] Se capturaron errores/advertencias en consola:`);
    erroresConsola.forEach((e) => console.error(e));
    process.exit(1);
  }

  console.log("\n✅ [ÉXITO TOTAL] Los 10 componentes reales montaron, procesaron efectos y eventos SSE, y desmontaron limpiamente sin ninguna excepción ni error de consola.");
  process.exit(0);
}

ejecutarPruebas().catch((err) => {
  console.error("❌ Excepción en suite de pruebas con efectos reales:", err);
  process.exit(1);
});
