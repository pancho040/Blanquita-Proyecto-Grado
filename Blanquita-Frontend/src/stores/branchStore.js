/**
 * Store Único y Centralizado de Sucursal Activa y Alcance Multisede
 * Compatible con Astro 7 (islas independientes) y React 19 usando useSyncExternalStore.
 * Sincroniza bidireccionalmente con la URL (?sucursal=), previene estados inconsistentes
 * y aplica principio de fallo cerrado y restauración automática en sede fija.
 */

import { useSyncExternalStore } from "react";

export const SUCURSALES_CATALOGO = [
  { id: 1, nombre: "Sucursal Central Sucre", ciudad: "Sucre" },
  { id: 2, nombre: "Sucursal Potosí", ciudad: "Potosí" }
];

// Estado global reactivo en memoria (null hasta que mi-alcance resuelva, evitando ráfagas 403 a Sucre)
let estado = {
  sucursalActiva: null, // "todas" | "1" | "2" | null
  sucursalesPermitidas: [],
  puedeVerTodas: false,
  sucursalAsignada: null,
  inicializado: false
};

const suscriptores = new Set();

function notificar() {
  suscriptores.forEach((callback) => {
    try {
      callback();
    } catch (e) {
      console.error("[BranchStore] Error al notificar suscriptor:", e);
    }
  });
}

const SESSION_STORAGE_KEY = "blanquita_sucursal_activa";

export function obtenerSucursalSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    const val = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!val) return null;
    const limpio = val.trim().toLowerCase();
    if (limpio === "todas" || limpio === "1" || limpio === "2") return limpio;
    return null;
  } catch {
    return null;
  }
}

export function guardarSucursalSessionStorage(val) {
  if (typeof window === "undefined") return;
  try {
    if (val) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, String(val));
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {}
}

export function obtenerParametroUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const val = params.get("sucursal");
  if (!val) return null;
  const limpio = val.trim().toLowerCase();
  if (limpio === "todas" || limpio === "all") return "todas";
  if (limpio === "1" || limpio === "2") return limpio;
  return null;
}

export function sincronizarUrl(nuevaSucursal) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (nuevaSucursal === "todas") {
    url.searchParams.set("sucursal", "todas");
  } else if (nuevaSucursal) {
    url.searchParams.set("sucursal", String(nuevaSucursal));
  } else {
    url.searchParams.delete("sucursal");
  }
  // replaceState para mantener historial limpio y que sobreviva al recargar
  window.history.replaceState({}, "", url.toString());
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const urlSucursal = obtenerParametroUrl();
    if (urlSucursal && urlSucursal !== estado.sucursalActiva) {
      if (urlSucursal === "todas" && !estado.puedeVerTodas) {
        // Rechazar 'todas' si no es multisede y restaurar URL
        sincronizarUrl(estado.sucursalActiva);
        return;
      }
      if (urlSucursal !== "todas" && !estado.sucursalesPermitidas.some((s) => String(s.id) === urlSucursal)) {
        // Rechazar sede ajena no permitida y restaurar URL
        sincronizarUrl(estado.sucursalActiva);
        return;
      }
      estado = { ...estado, sucursalActiva: urlSucursal };
      notificar();
    }
  });
}

/**
 * Inicializa el alcance del store a partir de los datos del usuario autenticado.
 * Aplica fallo cerrado: no confía en IsAdmin, solo en usuario_sucursal_permiso o IdSucursal asignado.
 */
export function inicializarAlcanceUsuario(usuario) {
  if (!usuario) return;

  const asignada =
    usuario.sucursal_defecto != null
      ? Number(usuario.sucursal_defecto)
      : usuario.IdSucursal != null
      ? Number(usuario.IdSucursal)
      : usuario.id_sucursal != null
      ? Number(usuario.id_sucursal)
      : null;

  // Permiso explícito de ver todas (según endpoint /Usuario/mi-alcance o perfil backend)
  const puedeVerTodas = Boolean(
    usuario.puede_ver_todas ??
    (usuario.PermisosSucursal?.some((p) => p.puede_ver_todas) ||
     usuario.permisos_sucursales?.some((p) => p.puede_ver_todas))
  );

  let permitidas = [];
  if (Array.isArray(usuario.sucursales_permitidas) && usuario.sucursales_permitidas.length > 0) {
    // Si viene array de IDs o de objetos
    permitidas = usuario.sucursales_permitidas.map((item) => {
      if (typeof item === "object") return item;
      return SUCURSALES_CATALOGO.find((c) => c.id === Number(item)) || { id: Number(item), nombre: `Sucursal #${item}` };
    });
  } else if (puedeVerTodas) {
    permitidas = SUCURSALES_CATALOGO;
  } else if (asignada) {
    permitidas = SUCURSALES_CATALOGO.filter((s) => s.id === asignada);
    if (permitidas.length === 0) {
      permitidas = [{ id: asignada, nombre: `Sucursal #${asignada}` }];
    }
  } else {
    // Fallo cerrado: si no tiene sede asignada ni permisos, lista vacía
    permitidas = [];
  }

  // Resolver sucursal activa inicial respetando precedencia y alcance:
  // Si puede_ver_todas === false: Fijar INMEDIATAMENTE a sucursal_defecto/asignada (ej. "2" Potosí).
  // Jamás usar "1" como fallback en usuarios de sede fija.
  let activa = null;

  if (!puedeVerTodas) {
    const sedeFija = asignada ?? (permitidas[0]?.id != null ? Number(permitidas[0].id) : null);
    if (sedeFija != null) {
      activa = String(sedeFija);
    } else {
      activa = null;
    }
  } else {
    // Usuario multisede (puede_ver_todas === true):
    const desdeUrl = obtenerParametroUrl();
    const desdeStorage = obtenerSucursalSessionStorage();

    if (desdeUrl) {
      if (desdeUrl === "todas") {
        activa = "todas";
      } else if (permitidas.some((s) => String(s.id) === String(desdeUrl))) {
        activa = String(desdeUrl);
      } else {
        activa = asignada ? String(asignada) : (permitidas[0]?.id != null ? String(permitidas[0].id) : "todas");
      }
    } else if (desdeStorage) {
      if (desdeStorage === "todas") {
        activa = "todas";
      } else if (permitidas.some((s) => String(s.id) === String(desdeStorage))) {
        activa = String(desdeStorage);
      } else {
        activa = asignada ? String(asignada) : (permitidas[0]?.id != null ? String(permitidas[0].id) : "todas");
      }
    } else if (asignada && permitidas.some((s) => String(s.id) === String(asignada))) {
      activa = String(asignada);
    } else if (permitidas.length > 0) {
      activa = String(permitidas[0].id);
    } else {
      activa = "todas";
    }
  }

  const inicializado = activa != null;

  estado = {
    sucursalActiva: activa,
    sucursalesPermitidas: permitidas,
    puedeVerTodas,
    sucursalAsignada: asignada,
    inicializado
  };

  if (activa != null) {
    guardarSucursalSessionStorage(activa);
    sincronizarUrl(activa);
  } else {
    guardarSucursalSessionStorage(null);
  }
  notificar();
}

/**
 * Cambia la sucursal activa con validación estricta de alcance.
 */
export function cambiarSucursalActiva(nuevaSucursal) {
  const str = String(nuevaSucursal).trim().toLowerCase();

  if (str === "todas") {
    if (!estado.puedeVerTodas) {
      console.warn("[BranchStore] Intento no autorizado de seleccionar 'Todas las sucursales'");
      sincronizarUrl(estado.sucursalActiva);
      return;
    }
    estado = { ...estado, sucursalActiva: "todas" };
  } else {
    const num = Number(str);
    const permitida = estado.sucursalesPermitidas.some((s) => s.id === num);
    if (!permitida && !estado.puedeVerTodas) {
      console.warn(`[BranchStore] Intento no autorizado de seleccionar sucursal ${num}`);
      sincronizarUrl(estado.sucursalActiva);
      return;
    }
    estado = { ...estado, sucursalActiva: String(num) };
  }

  guardarSucursalSessionStorage(estado.sucursalActiva);
  sincronizarUrl(estado.sucursalActiva);
  notificar();
}

let cargandoAlcanceApi = false;

/**
 * Invalida el alcance en caché y vuelve a pedir /Usuario/mi-alcance al backend.
 * Detecta además si el usuario cambió respecto a la sesión anterior para limpiar sessionStorage.
 */
export async function refrescarAlcanceDesdeApi() {
  if (typeof window === "undefined" || !window.location || !window.location.host || cargandoAlcanceApi) return null;
  cargandoAlcanceApi = true;
  try {
    const res = await fetch("/api/Usuario/mi-alcance", {
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache, no-store" }
    });
    if (res.ok) {
      const data = await res.json();
      const usuarioPrevioId = window.sessionStorage.getItem("blanquita_usuario_id");
      if (usuarioPrevioId && String(usuarioPrevioId) !== String(data.id_usuario)) {
        // Cambio de usuario detectado: limpiar sucursal de la sesión anterior
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
      if (data.id_usuario) {
        window.sessionStorage.setItem("blanquita_usuario_id", String(data.id_usuario));
      }
      if (data.puede_ver_todas === false) {
        const sedeDefecto = data.sucursal_defecto ?? data.IdSucursal ?? data.id_sucursal;
        if (sedeDefecto != null) {
          guardarSucursalSessionStorage(String(sedeDefecto));
        }
      }
      inicializarAlcanceUsuario(data);
      return data;
    }
  } catch (err) {
    console.warn("[BranchStore] No se pudo refrescar alcance desde /Usuario/mi-alcance:", err);
  } finally {
    cargandoAlcanceApi = false;
  }
  return null;
}

export function limpiarSesionSucursal() {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem("blanquita_usuario_id");
    } catch {}
  }
  estado = {
    sucursalActiva: null,
    sucursalesPermitidas: [],
    puedeVerTodas: false,
    sucursalAsignada: null,
    inicializado: false
  };
  notificar();
}

if (typeof window !== "undefined" && typeof window.document !== "undefined") {
  // Al cargar la app en el navegador, invalidar alcance previo y sincronizar con backend real
  refrescarAlcanceDesdeApi();
}

export function getSnapshot() {
  return estado;
}

const serverSnapshot = {
  sucursalActiva: null,
  sucursalesPermitidas: [],
  puedeVerTodas: false,
  sucursalAsignada: null,
  inicializado: false
};

export function getServerSnapshot() {
  return serverSnapshot;
}

export function subscribe(callback) {
  suscriptores.add(callback);
  return () => suscriptores.delete(callback);
}

/**
 * Hook de consumo general del store de sucursales.
 */
export function useBranch(usuarioInicial = null) {
  if (usuarioInicial && !estado.inicializado) {
    inicializarAlcanceUsuario(usuarioInicial);
  }

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const listoParaConsultar = Boolean(snap.inicializado && snap.sucursalActiva != null);

  return {
    sucursalActiva: listoParaConsultar ? snap.sucursalActiva : null,
    sucursalIdNumerico: (!listoParaConsultar || snap.sucursalActiva === "todas" || snap.sucursalActiva == null) ? null : Number(snap.sucursalActiva),
    sucursalesPermitidas: snap.sucursalesPermitidas || [],
    puedeVerTodas: snap.puedeVerTodas,
    esMultisede: (snap.sucursalesPermitidas?.length || 0) > 1 || snap.puedeVerTodas,
    cambiarSucursal: cambiarSucursalActiva,
    sucursalAsignada: snap.sucursalAsignada,
    inicializado: snap.inicializado,
    listoParaConsultar,
    // Alias y compatibilidad para componentes
    sucursales: snap.sucursalesPermitidas || [],
    cargando: !listoParaConsultar,
    cargandoAlcance: !listoParaConsultar
  };
}

/**
 * Hook Especializado de Página para Pantallas Analíticas u Operativas
 * Exige si se permite o no la opción "Todas" y normaliza el estado automáticamente.
 * Bloquea consultas a Sucre mientras `mi-alcance` no haya confirmado la sede real.
 */
export function usePaginaSucursal({ permiteTodas = true, usuario = null } = {}) {
  if (usuario && !estado.inicializado) {
    inicializarAlcanceUsuario(usuario);
  }

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const listoParaConsultar = Boolean(snap.inicializado && snap.sucursalActiva != null);

  // Resolver sucursal efectiva para la pantalla
  let sucursalEfectiva = snap.sucursalActiva;
  if (!permiteTodas && sucursalEfectiva === "todas") {
    sucursalEfectiva = snap.sucursalAsignada != null ? String(snap.sucursalAsignada) : (snap.sucursalesPermitidas[0]?.id != null ? String(snap.sucursalesPermitidas[0].id) : null);
  }

  // Si no está listoParaConsultar (esperando respuesta de /Usuario/mi-alcance),
  // bloquear la asignación prematura a cualquier sede para evitar 403 en Potosí
  if (!listoParaConsultar || !sucursalEfectiva) {
    sucursalEfectiva = null;
  }

  const sucursales = snap.sucursalesPermitidas || [];
  const esMultisede = sucursales.length > 1 || snap.puedeVerTodas;

  const setSucursal = (nueva) => {
    if (!permiteTodas && String(nueva).toLowerCase() === "todas") {
      console.warn("[usePaginaSucursal] Esta pantalla no admite consolidado 'todas'");
      return;
    }
    cambiarSucursalActiva(nueva);
  };

  const nombreSucursalActual =
    sucursales.find((s) => String(s.id) === String(sucursalEfectiva))?.nombre ||
    (sucursalEfectiva === "todas"
      ? "Todas las Sedes (Consolidado)"
      : sucursalEfectiva
      ? `Sucursal ${sucursalEfectiva}`
      : "Cargando sucursal...");

  return {
    sucursal: sucursalEfectiva, // null mientras !listoParaConsultar
    sucursalIdNumerico:
      !listoParaConsultar || sucursalEfectiva === "todas" || sucursalEfectiva == null
        ? null
        : Number(sucursalEfectiva),
    setSucursal,
    esMultisede,
    listoParaConsultar,
    puedeVerTodas: snap.puedeVerTodas && permiteTodas,
    sucursalesPermitidas: sucursales,
    sucursalAsignada: snap.sucursalAsignada,
    // Propiedades adicionales esperadas por componentes
    sucursales,
    cargando: !listoParaConsultar,
    cargandoAlcance: !listoParaConsultar,
    nombreSucursalActual
  };
}
