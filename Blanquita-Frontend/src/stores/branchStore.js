/**
 * Store Único y Centralizado de Sucursal Activa y Alcance Multisede
 * Compatible con Astro 7 (islas independientes) y React 19 usando useSyncExternalStore.
 * Sincroniza bidireccionalmente con la URL (?sucursal=), previene estados inconsistentes
 * y aplica principio de fallo cerrado y restauración automática en sede fija.
 */

import { useSyncExternalStore, useEffect } from "react";

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
  inicializado: false,
  alcanceConfirmado: false,
  errorAlcance: false
};

let alcanceConfirmado = false;
let usuarioKeyConfirmado = null;
let promesaAlcance = null;

function sonEstadosIguales(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.sucursalActiva !== b.sucursalActiva) return false;
  if (a.puedeVerTodas !== b.puedeVerTodas) return false;
  if (a.sucursalAsignada !== b.sucursalAsignada) return false;
  if (a.inicializado !== b.inicializado) return false;
  if (Boolean(a.alcanceConfirmado) !== Boolean(b.alcanceConfirmado)) return false;
  if (Boolean(a.errorAlcance) !== Boolean(b.errorAlcance)) return false;
  const pA = a.sucursalesPermitidas || [];
  const pB = b.sucursalesPermitidas || [];
  if (pA.length !== pB.length) return false;
  for (let i = 0; i < pA.length; i++) {
    if (pA[i]?.id !== pB[i]?.id) return false;
  }
  return true;
}

const suscriptores = new Set();
let notificando = false;
let pendienteNotificar = false;

function ejecutarNotificaciones() {
  suscriptores.forEach((callback) => {
    try {
      callback();
    } catch (e) {
      console.error("[BranchStore] Error al notificar suscriptor:", e);
    }
  });
}

function notificar() {
  if (notificando) {
    pendienteNotificar = true;
    return;
  }
  notificando = true;
  try {
    ejecutarNotificaciones();
  } finally {
    notificando = false;
    if (pendienteNotificar) {
      pendienteNotificar = false;
      if (typeof queueMicrotask === "function") {
        queueMicrotask(ejecutarNotificaciones);
      } else {
        setTimeout(ejecutarNotificaciones, 0);
      }
    }
  }
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

function extraerUsuarioKey(u) {
  if (!u) return null;
  const key = u.AuthUserId ?? u.auth_user_id ?? u.IdUsuario ?? u.id_usuario ?? u.id ?? null;
  return key != null ? String(key) : null;
}

/**
 * Inicializa el alcance del store a partir de los datos del usuario autenticado.
 * Aplica fallo cerrado: no degrada el estado si el usuario recibido carece de alcance completo.
 */
export function inicializarAlcanceUsuario(usuario) {
  if (!usuario) return;

  const keyEntrante = extraerUsuarioKey(usuario);

  const tienePermisoExplicitamente =
    usuario.puede_ver_todas !== undefined ||
    usuario.puedeVerTodas !== undefined ||
    (Array.isArray(usuario.PermisosSucursal) && usuario.PermisosSucursal.length > 0) ||
    (Array.isArray(usuario.permisos_sucursales) && usuario.permisos_sucursales.length > 0);

  const tieneListaPermitidas =
    Array.isArray(usuario.sucursales_permitidas) ||
    Array.isArray(usuario.sucursalesPermitidas);

  const traeAlcanceCompleto = tienePermisoExplicitamente && tieneListaPermitidas;

  // 1. Si no trae alcance completo y ya está confirmado para este usuario => NO-OP
  if (!traeAlcanceCompleto && alcanceConfirmado && usuarioKeyConfirmado && keyEntrante && keyEntrante === usuarioKeyConfirmado) {
    return;
  }

  // 2. Si el usuario cambió respecto al confirmado previamente:
  if (usuarioKeyConfirmado && keyEntrante && keyEntrante !== usuarioKeyConfirmado) {
    alcanceConfirmado = false;
    usuarioKeyConfirmado = null;
    if (!traeAlcanceCompleto) {
      limpiarSesionSucursal();
      refrescarAlcanceDesdeApi({ forzar: true }).catch(() => {});
      return;
    }
  }

  if (!traeAlcanceCompleto) {
    // Caso SSR/JWT: Es solo una pista preliminar.
    // NUNCA establece puedeVerTodas=false de forma definitiva, NUNCA marca inicializado=true,
    // NUNCA fuerza sucursalActiva='1', y NUNCA degrada un estado previo.
    const asignadaPista =
      usuario.sucursal_defecto != null
        ? Number(usuario.sucursal_defecto)
        : usuario.IdSucursal != null
        ? Number(usuario.IdSucursal)
        : usuario.id_sucursal != null
        ? Number(usuario.id_sucursal)
        : null;

    if (asignadaPista != null && estado.sucursalAsignada == null) {
      const nuevoEstado = { ...estado, sucursalAsignada: asignadaPista };
      if (!sonEstadosIguales(estado, nuevoEstado)) {
        estado = nuevoEstado;
        notificar();
      }
    }

    if (!alcanceConfirmado && !promesaAlcance) {
      refrescarAlcanceDesdeApi().catch(() => {});
    }
    return;
  }

  // 4. Procesar alcance verificado y completo (mi-alcance o perfil simulado con permisos)
  const asignada =
    usuario.sucursal_defecto != null
      ? Number(usuario.sucursal_defecto)
      : usuario.IdSucursal != null
      ? Number(usuario.IdSucursal)
      : usuario.id_sucursal != null
      ? Number(usuario.id_sucursal)
      : null;

  const puedeVerTodas = Boolean(
    usuario.puede_ver_todas ??
    usuario.puedeVerTodas ??
    (usuario.PermisosSucursal?.some((p) => p.puede_ver_todas) ||
     usuario.permisos_sucursales?.some((p) => p.puede_ver_todas))
  );

  const listaPermitidasCruda = usuario.sucursales_permitidas || usuario.sucursalesPermitidas;
  let permitidas = [];
  if (Array.isArray(listaPermitidasCruda) && listaPermitidasCruda.length > 0) {
    permitidas = listaPermitidasCruda.map((item) => {
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
    permitidas = [];
  }

  let activa = null;
  if (!puedeVerTodas) {
    const sedeFija = asignada ?? (permitidas[0]?.id != null ? Number(permitidas[0].id) : null);
    if (sedeFija != null) {
      activa = String(sedeFija);
    } else {
      activa = null;
    }
  } else {
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

  alcanceConfirmado = true;
  usuarioKeyConfirmado = keyEntrante;
  const inicializado = activa != null || puedeVerTodas || asignada != null;

  const nuevoEstado = {
    sucursalActiva: activa,
    sucursalesPermitidas: permitidas,
    puedeVerTodas,
    sucursalAsignada: asignada,
    inicializado,
    alcanceConfirmado: true,
    errorAlcance: false
  };

  if (sonEstadosIguales(estado, nuevoEstado)) {
    return;
  }

  estado = nuevoEstado;

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

  let nuevaActiva = estado.sucursalActiva;
  if (str === "todas") {
    if (!estado.puedeVerTodas) {
      console.warn("[BranchStore] Intento no autorizado de seleccionar 'Todas las sucursales'");
      sincronizarUrl(estado.sucursalActiva);
      return;
    }
    nuevaActiva = "todas";
  } else {
    const num = Number(str);
    const permitida = estado.sucursalesPermitidas.some((s) => s.id === num);
    if (!permitida && !estado.puedeVerTodas) {
      console.warn(`[BranchStore] Intento no autorizado de seleccionar sucursal ${num}`);
      sincronizarUrl(estado.sucursalActiva);
      return;
    }
    nuevaActiva = String(num);
  }

  if (nuevaActiva === estado.sucursalActiva) {
    return;
  }

  const nuevoEstado = { ...estado, sucursalActiva: nuevaActiva };
  if (sonEstadosIguales(estado, nuevoEstado)) {
    return;
  }
  estado = nuevoEstado;

  guardarSucursalSessionStorage(estado.sucursalActiva);
  sincronizarUrl(estado.sucursalActiva);
  notificar();
}

/**
 * Reintenta la obtención del alcance si previamente ocurrió un fallo de red.
 */
export function reintentarAlcance() {
  if (estado.errorAlcance) {
    estado = { ...estado, errorAlcance: false };
    notificar();
  }
  return refrescarAlcanceDesdeApi({ forzar: true });
}

/**
 * Invalida el alcance en caché y vuelve a pedir /Usuario/mi-alcance al backend con
 * promesa compartida (request coalescing) y reintentos ante errores de red o cancelación.
 */
export function refrescarAlcanceDesdeApi({ forzar = false } = {}) {
  if (typeof window === "undefined" || !window.location || !window.location.host) {
    return Promise.resolve(null);
  }

  if (promesaAlcance) {
    return promesaAlcance;
  }

  if (alcanceConfirmado && !forzar && !estado.errorAlcance) {
    return Promise.resolve(estado);
  }

  promesaAlcance = (async () => {
    const delays = globalThis.__BRANCH_STORE_RETRY_DELAYS || [400, 1000, 2000];
    let ultimoError = null;

    for (let intento = 0; intento <= delays.length; intento++) {
      try {
        const res = await fetch("/api/Usuario/mi-alcance", {
          credentials: "same-origin",
          headers: { "Cache-Control": "no-cache, no-store" }
        });

        if (res.status === 401 || res.status === 403) {
          if (res.status === 403) {
            estado = { ...estado, errorAlcance: true };
            notificar();
          }
          return null;
        }

        if (res.ok) {
          const data = await res.json();
          const keyActual = extraerUsuarioKey(data);
          const usuarioPrevioId = window.sessionStorage?.getItem("blanquita_usuario_id");
          if (usuarioPrevioId && keyActual && String(usuarioPrevioId) !== String(keyActual)) {
            window.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
          }
          if (keyActual) {
            window.sessionStorage?.setItem("blanquita_usuario_id", String(keyActual));
          }
          if (data.puede_ver_todas === false) {
            const sedeDefecto = data.sucursal_defecto ?? data.IdSucursal ?? data.id_sucursal;
            if (sedeDefecto != null) {
              guardarSucursalSessionStorage(String(sedeDefecto));
            }
          }
          inicializarAlcanceUsuario(data);
          return data;
        } else if (res.status >= 500) {
          throw new Error(`HTTP ${res.status}`);
        } else {
          estado = { ...estado, errorAlcance: true };
          notificar();
          return null;
        }
      } catch (err) {
        ultimoError = err;
        const esErrorReintentable =
          err?.name === "AbortError" ||
          err?.name === "TypeError" ||
          err instanceof TypeError ||
          String(err?.message || "").includes("HTTP 5") ||
          String(err?.message || "").toLowerCase().includes("network") ||
          String(err?.message || "").toLowerCase().includes("fetch");

        if (!esErrorReintentable || intento === delays.length) {
          break;
        }

        const delay = delays[intento];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.warn("[BranchStore] No se pudo refrescar alcance tras reintentos:", ultimoError);
    // NO tocar inicializado si ya estaba en true
    estado = { ...estado, errorAlcance: true };
    notificar();
    return null;
  })().finally(() => {
    promesaAlcance = null;
  });

  return promesaAlcance;
}

export function limpiarSesionSucursal() {
  alcanceConfirmado = false;
  usuarioKeyConfirmado = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem("blanquita_usuario_id");
    } catch {}
  }
  const nuevoEstado = {
    sucursalActiva: null,
    sucursalesPermitidas: [],
    puedeVerTodas: false,
    sucursalAsignada: null,
    inicializado: false,
    alcanceConfirmado: false,
    errorAlcance: false
  };
  if (sonEstadosIguales(estado, nuevoEstado)) return;
  estado = nuevoEstado;
  notificar();
}

// Revalidación única y reactiva en navegación Astro
if (typeof document !== "undefined") {
  if (!globalThis.__branchStoreAstroListeners) {
    globalThis.__branchStoreAstroListeners = true;
    document.addEventListener("astro:page-load", () => {
      if (!alcanceConfirmado && !promesaAlcance) {
        refrescarAlcanceDesdeApi().catch(() => {});
      }
    });
  }
}

if (typeof window !== "undefined" && typeof window.document !== "undefined") {
  // Al cargar la app en el navegador, invalidar alcance previo y sincronizar con backend real
  refrescarAlcanceDesdeApi().catch(() => {});
}

export function getSnapshot() {
  return estado;
}

const serverSnapshot = {
  sucursalActiva: null,
  sucursalesPermitidas: [],
  puedeVerTodas: false,
  sucursalAsignada: null,
  inicializado: false,
  alcanceConfirmado: false,
  errorAlcance: false
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
  useEffect(() => {
    if (usuarioInicial) {
      inicializarAlcanceUsuario(usuarioInicial);
    }
  }, [
    usuarioInicial?.AuthUserId,
    usuarioInicial?.auth_user_id,
    usuarioInicial?.IdUsuario,
    usuarioInicial?.id_usuario
  ]);

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const listoParaConsultar = Boolean(
    snap.inicializado &&
    snap.sucursalActiva != null &&
    !snap.errorAlcance &&
    snap.alcanceConfirmado
  );

  return {
    sucursalActiva: listoParaConsultar ? snap.sucursalActiva : null,
    sucursalIdNumerico: (!listoParaConsultar || snap.sucursalActiva === "todas" || snap.sucursalActiva == null) ? null : Number(snap.sucursalActiva),
    sucursalesPermitidas: snap.sucursalesPermitidas || [],
    puedeVerTodas: snap.puedeVerTodas,
    esMultisede: (snap.sucursalesPermitidas?.length || 0) > 1 || snap.puedeVerTodas,
    cambiarSucursal: cambiarSucursalActiva,
    sucursalAsignada: snap.sucursalAsignada,
    inicializado: snap.inicializado,
    alcanceConfirmado: Boolean(snap.alcanceConfirmado),
    errorAlcance: Boolean(snap.errorAlcance),
    reintentar: reintentarAlcance,
    reintentarAlcance,
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
  useEffect(() => {
    if (usuario) {
      inicializarAlcanceUsuario(usuario);
    }
  }, [
    usuario?.AuthUserId,
    usuario?.auth_user_id,
    usuario?.IdUsuario,
    usuario?.id_usuario
  ]);

  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const listoParaConsultar = Boolean(
    snap.inicializado &&
    snap.sucursalActiva != null &&
    !snap.errorAlcance &&
    snap.alcanceConfirmado
  );

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
    alcanceConfirmado: Boolean(snap.alcanceConfirmado),
    errorAlcance: Boolean(snap.errorAlcance),
    reintentar: reintentarAlcance,
    reintentarAlcance,
    // Propiedades adicionales esperadas por componentes
    sucursales,
    cargando: !listoParaConsultar,
    cargandoAlcance: !listoParaConsultar,
    nombreSucursalActual
  };
}
