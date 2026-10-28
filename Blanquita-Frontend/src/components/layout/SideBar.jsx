import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Icon, ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { RutasNavBar, RutasReportes, RutasSupervisor, RutasContador, RutasAdmin } from "@/constants/NavBarRoutes";
import { PREFIJO_POR_ROL, Roles } from "@/constants/Values";
import { cerrarSesion } from "@/lib/logout-client";

const ANCHO_EXPANDIDO = "17rem";
const ANCHO_COLAPSADO = "4.5rem";
const CLAVE_ESTADO = "sidebar-abierto";
const CLAVE_ES_ADMIN = "blanquita_es_admin";
const CLAVE_SCROLL_SIDEBAR = "blanquita_sidebar_scroll_top";
const CLAVE_GRUPOS_ABIERTOS = "blanquita_sidebar_grupos_abiertos";

function setCookie(nombre, valor, dias = 365) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + dias * 24 * 60 * 60 * 1000);
    document.cookie = `${nombre}=${encodeURIComponent(valor)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  } catch {}
}

function getCookie(nombre) {
  try {
    const match = document.cookie.match(new RegExp("(^| )" + nombre + "=([^;]+)"));
    if (match) return decodeURIComponent(match[2]);
  } catch {}
  return null;
}

function obtenerGruposAbiertos() {
  try {
    const raw = window.sessionStorage.getItem(CLAVE_GRUPOS_ABIERTOS);
    if (raw) return JSON.parse(raw);
    const cookieRaw = getCookie("blanquita_sidebar_grupos");
    if (cookieRaw) return JSON.parse(cookieRaw);
    return {};
  } catch {
    return {};
  }
}

function guardarGrupoAbierto(clave, estado) {
  try {
    const actuales = obtenerGruposAbiertos();
    actuales[clave] = estado;
    const str = JSON.stringify(actuales);
    window.sessionStorage.setItem(CLAVE_GRUPOS_ABIERTOS, str);
    setCookie("blanquita_sidebar_grupos", str);
  } catch {}
}

function guardarScrollSidebar() {
  try {
    const nav = document.querySelector("nav[data-sidebar-nav]");
    if (nav) {
      window.sessionStorage.setItem(CLAVE_SCROLL_SIDEBAR, String(nav.scrollTop));
    }
  } catch {}
}

function normalizarRuta(p) {
  if (!p) return "/";
  return p.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
}

function IconoItem({ item, size = 20 }) {
  if (!item || !item.icono) return null;
  if (item.esIconoLab) {
    const IconLab = item.icono;
    return <span className="inline-flex"><IconLab size={size} /></span>;
  }
  const IconoComp = item.icono;
  return <IconoComp size={size} />;
}

// Resolver URL de manera unificada
function resolverRuta(basePath, prefijo, rutaItem, rutaSub = null) {
  let base = rutaItem;
  const prefijosConocidos = ["admin", "supervisor", "contador", "encargado", "operador"];
  const tienePrefijo = prefijosConocidos.some((p) => rutaItem.startsWith(p));

  if (!tienePrefijo) {
    base = rutaItem === "" ? `${prefijo}/inicio` : `${basePath}/${rutaItem}`;
  }

  if (rutaSub !== null) {
    return `/${base}/${rutaSub}`.replace(/\/+/g, "/").replace(/\/$/, "");
  }
  return `/${base}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

const EntradaSimple = React.memo(function EntradaSimple({ item, basePath, prefijo, colapsado, rutaActual }) {
  const rutaFinal = resolverRuta(basePath, prefijo, item.ruta);
  const activo = normalizarRuta(rutaActual) === normalizarRuta(rutaFinal);

  return (
    <li>
      <a
        href={rutaFinal}
        data-astro-prefetch="hover"
        title={item.titulo}
        onClick={guardarScrollSidebar}
        className={cn(
          "flex items-center rounded-xl text-white font-medium select-none transition-colors duration-150",
          "hover:bg-[#20A7DB] hover:shadow-sm focus-visible:bg-[#20A7DB] focus-visible:outline-none",
          activo ? "bg-[#20A7DB] shadow-md shadow-[#1c96c544] font-semibold" : "bg-transparent",
          colapsado
            ? "h-11 w-11 mx-auto justify-center p-0"
            : "h-10 px-3 gap-3 text-sm w-full justify-start"
        )}
      >
        <div className="shrink-0 flex items-center justify-center">
          <IconoItem item={item} size={colapsado ? 22 : 20} />
        </div>
        {!colapsado && (
          <span className="truncate whitespace-nowrap">{item.titulo}</span>
        )}
      </a>
    </li>
  );
});

const GrupoColapsable = React.memo(function GrupoColapsable({
  item,
  basePath,
  prefijo,
  colapsado,
  rutaActual,
  alExpandirSidebar,
  gruposIniciales = {},
}) {
  // Comprueba si este grupo contiene la ruta actualmente activa
  const estaActivoElGrupo = useMemo(() => {
    if (!item || !Array.isArray(item.subrutas)) return false;
    const actual = normalizarRuta(rutaActual);
    return item.subrutas.some((sub) => {
      if (!sub) return false;
      const subUrl = normalizarRuta(resolverRuta(basePath, prefijo, item.ruta, sub.ruta));
      return actual === subUrl || (Boolean(sub.ruta) && actual.startsWith(subUrl + "/"));
    });
  }, [item, basePath, prefijo, rutaActual]);

  const [desplegado, setDesplegado] = useState(() => {
    if (estaActivoElGrupo) return true;
    if (gruposIniciales && gruposIniciales[item.ruta] !== undefined) {
      return Boolean(gruposIniciales[item.ruta]);
    }
    if (typeof window !== "undefined") {
      const guardados = obtenerGruposAbiertos();
      if (guardados[item.ruta] !== undefined) {
        return Boolean(guardados[item.ruta]);
      }
    }
    return false;
  });

  // Al navegar, si la nueva ruta pertenece a este grupo, abrirlo automáticamente
  useEffect(() => {
    if (estaActivoElGrupo) {
      setDesplegado(true);
      guardarGrupoAbierto(item.ruta, true);
    }
  }, [estaActivoElGrupo, item.ruta]);

  const handleToggle = () => {
    if (colapsado) {
      alExpandirSidebar();
      setDesplegado(true);
      guardarGrupoAbierto(item.ruta, true);
    } else {
      setDesplegado((v) => {
        const sig = !v;
        guardarGrupoAbierto(item.ruta, sig);
        return sig;
      });
    }
  };

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={handleToggle}
        title={item.titulo}
        aria-expanded={desplegado && !colapsado}
        className={cn(
          "flex items-center rounded-xl text-white font-medium select-none w-full transition-colors duration-150 cursor-pointer",
          "hover:bg-[#20A7DB] focus-visible:bg-[#20A7DB] focus-visible:outline-none",
          estaActivoElGrupo
            ? "bg-[#20A7DB] shadow-sm font-semibold"
            : desplegado && !colapsado
            ? "bg-white/10"
            : "bg-transparent",
          colapsado
            ? "h-11 w-11 mx-auto justify-center p-0"
            : "h-10 px-3 gap-3 text-sm justify-start"
        )}
      >
        <div className="shrink-0 flex items-center justify-center">
          <IconoItem item={item} size={colapsado ? 22 : 20} />
        </div>
        {!colapsado && (
          <>
            <span className="flex-1 text-left truncate whitespace-nowrap">{item.titulo}</span>
            <ChevronDown
              size={16}
              className={cn(
                "shrink-0 transition-transform duration-200 opacity-80",
                desplegado && "rotate-180"
              )}
            />
          </>
        )}
      </button>

      {!colapsado && desplegado && (
        <ul className="mt-1 ml-4 pl-2.5 border-l-2 border-[#A0D9EF]/60 flex flex-col gap-1 py-1">
          {item.subrutas.map((sub, sIdx) => {
            if (!sub) return null;
            const subUrl = normalizarRuta(resolverRuta(basePath, prefijo, item.ruta, sub.ruta));
            const actual = normalizarRuta(rutaActual);
            const esSubActivo = actual === subUrl || (Boolean(sub.ruta) && actual.startsWith(subUrl + "/"));

            return (
              <li key={`sub-${sub.titulo || ''}-${sub.ruta || sIdx}`}>
                <a
                  href={subUrl}
                  data-astro-prefetch="hover"
                  title={sub.titulo}
                  onClick={guardarScrollSidebar}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white select-none transition-colors duration-150",
                    "hover:bg-[#20A7DB] focus-visible:bg-[#20A7DB] focus-visible:outline-none",
                    esSubActivo ? "bg-[#20A7DB] font-semibold shadow-xs" : "opacity-90 hover:opacity-100 hover:bg-[#20A7DB]/50"
                  )}
                >
                  <IconoItem item={sub} size={15} />
                  <span className="truncate">{sub.titulo}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
});

export default function SideBar({
  idRol,
  seccion,
  esAdmin: esAdminProp,
  rutaInicial = "",
  gruposIniciales = {},
  abiertoInicial = true,
}) {
  // Inicialización idéntica en SSR y en el cliente para prevenir Hydration Mismatch
  const [esAdmin, setEsAdmin] = useState(() => Boolean(esAdminProp));

  useEffect(() => {
    if (esAdminProp !== undefined) {
      const boolVal = Boolean(esAdminProp);
      setEsAdmin(boolVal);
      try {
        if (boolVal) {
          window.localStorage.setItem(CLAVE_ES_ADMIN, "true");
        } else {
          window.localStorage.removeItem(CLAVE_ES_ADMIN);
        }
      } catch {
        /* noop */
      }
    } else if (typeof window !== "undefined") {
      const guardado = window.localStorage.getItem(CLAVE_ES_ADMIN) === "true";
      setEsAdmin(guardado);
    }
  }, [esAdminProp]);

  const prefijo = esAdmin ? "admin" : PREFIJO_POR_ROL[idRol] || "admin";
  const enReportes = seccion === "reportes";
  const basePath = esAdmin ? "admin" : enReportes ? `${prefijo}/reportes` : prefijo;

  const rutas = useMemo(() => {
    if (esAdmin) return RutasAdmin;
    if (enReportes) return RutasReportes;
    if (idRol === Roles.Supervisor) return RutasSupervisor;
    if (idRol === Roles.Contador) return RutasContador;
    return RutasNavBar.filter((item) => !item.isLider || idRol === Roles.Encargado);
  }, [esAdmin, enReportes, idRol]);

  // Estado abierto/cerrado alimentado por prop de SSR o cookie/storage
  const [abierto, setAbierto] = useState(() => Boolean(abiertoInicial));
  // Desactivar animación de ancho al montar o navegar; solo animar cuando el usuario hace clic en el botón
  const [animarAncho, setAnimarAncho] = useState(false);

  // Sincronizar estado abierto guardado tras la hidratación segura en cliente
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_ESTADO);
      if (guardado !== null) {
        const esAbierto = guardado !== "false";
        setAbierto(esAbierto);
        document.documentElement.style.setProperty(
          "--hueco-sidebar",
          esAbierto ? ANCHO_EXPANDIDO : ANCHO_COLAPSADO
        );
      }
    } catch {}
  }, []);

  // Ruta actual reactiva para Astro View Transitions
  const [rutaActual, setRutaActual] = useState(rutaInicial);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname !== rutaActual) {
      setRutaActual(window.location.pathname);
    }

    const actualizarRuta = () => {
      setRutaActual(window.location.pathname);
    };

    window.addEventListener("popstate", actualizarRuta);
    document.addEventListener("astro:page-load", actualizarRuta);
    document.addEventListener("astro:after-swap", actualizarRuta);

    return () => {
      window.removeEventListener("popstate", actualizarRuta);
      document.removeEventListener("astro:page-load", actualizarRuta);
      document.removeEventListener("astro:after-swap", actualizarRuta);
    };
  }, []);

  const alternar = useCallback(() => {
    setAnimarAncho(true);
    setAbierto((v) => {
      const siguiente = !v;
      try {
        window.localStorage.setItem(CLAVE_ESTADO, String(siguiente));
        setCookie("blanquita_sidebar_abierto", String(siguiente));
      } catch {
        /* noop */
      }
      return siguiente;
    });
  }, []);

  const expandir = useCallback(() => {
    setAnimarAncho(true);
    setAbierto(true);
    try {
      window.localStorage.setItem(CLAVE_ESTADO, "true");
      setCookie("blanquita_sidebar_abierto", "true");
    } catch {
      /* noop */
    }
  }, []);

  // Sincronizar el margen izquierdo del contenido con el ancho del sidebar
  useEffect(() => {
    const raiz = document.documentElement;
    const anchoActual = abierto ? ANCHO_EXPANDIDO : ANCHO_COLAPSADO;
    raiz.style.setProperty("--hueco-sidebar", anchoActual);
  }, [abierto]);

  const navRef = useRef(null);

  // Restaurar y mantener fija la posición del scroll de la sidebar
  useEffect(() => {
    const restaurar = () => {
      try {
        const guardado = window.sessionStorage.getItem(CLAVE_SCROLL_SIDEBAR);
        if (guardado !== null && navRef.current) {
          navRef.current.scrollTop = parseInt(guardado, 10);
        }
      } catch {}
    };

    restaurar();
    const t1 = setTimeout(restaurar, 25);
    const t2 = setTimeout(restaurar, 120);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [rutaActual, abierto]);

  const anchoSidebar = abierto ? ANCHO_EXPANDIDO : ANCHO_COLAPSADO;

  return (
    <aside
      aria-label="Menú lateral"
      className="fixed inset-y-0 left-0 z-40 flex flex-col border-r-2 border-[#A0D9EF] text-white select-none overflow-hidden"
      style={{
        width: anchoSidebar,
        transition: animarAncho ? "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        backgroundColor: "#62C1E5",
        boxShadow: "0 4px 20px #1c96c533",
      }}
    >
      {/* Encabezado: Logo a la izquierda + Botón icono arriba a la derecha */}
      <div className="h-16 flex items-center border-b-2 border-[#A0D9EF] shrink-0 overflow-hidden px-3">
        {abierto ? (
          <div className="flex items-center justify-between w-full">
            <a
              href={`/${basePath}/inicio`}
              className="flex items-center hover:opacity-90 transition-opacity"
            >
              <img
                src="/LogoBlanquita.webp"
                alt="Papel Blanquita"
                className="h-9 w-auto object-contain"
                style={{ filter: "drop-shadow(0 4px 12px rgba(255,255,255,.35))" }}
              />
            </a>
            <button
              type="button"
              onClick={alternar}
              aria-label="Contraer menú lateral"
              title="Contraer menú lateral"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-[#20A7DB] text-white transition-all duration-150 border border-white/20 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 shrink-0 cursor-pointer"
            >
              <PanelLeftClose size={19} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <button
              type="button"
              onClick={alternar}
              aria-label="Expandir menú lateral"
              title="Expandir menú lateral"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 hover:bg-[#20A7DB] text-white transition-all duration-150 border border-white/30 hover:border-white/60 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 hover:scale-105 cursor-pointer"
            >
              <PanelLeftOpen size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Lista de navegación con scroll independiente y ultra fluido */}
      <nav
        ref={navRef}
        data-sidebar-nav="true"
        onScroll={(e) => {
          try {
            window.sessionStorage.setItem(CLAVE_SCROLL_SIDEBAR, String(e.currentTarget.scrollTop));
          } catch {}
        }}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 scrollbar-thin scrollbar-thumb-white/20"
      >
        <ul className="flex flex-col gap-1.5">
          {rutas.map((item, idx) =>
            item.subrutas ? (
              <GrupoColapsable
                key={`grupo-${item.titulo || ''}-${item.ruta || idx}`}
                item={item}
                basePath={basePath}
                prefijo={prefijo}
                colapsado={!abierto}
                rutaActual={rutaActual}
                alExpandirSidebar={expandir}
                gruposIniciales={gruposIniciales}
              />
            ) : (
              <EntradaSimple
                key={`simple-${item.titulo || ''}-${item.ruta || idx}`}
                item={item}
                basePath={basePath}
                prefijo={prefijo}
                colapsado={!abierto}
                rutaActual={rutaActual}
              />
            )
          )}
        </ul>
      </nav>

      {/* Pie con botón de Cerrar Sesión */}
      <div className="border-t-2 border-[#A0D9EF] p-2.5 shrink-0">
        <button
          type="button"
          onClick={cerrarSesion}
          title="Cerrar sesión"
          className={cn(
            "flex items-center rounded-xl text-white font-medium transition-colors duration-150 select-none cursor-pointer",
            "hover:bg-red-600 focus-visible:bg-red-600 focus-visible:outline-none",
            !abierto
              ? "h-11 w-11 mx-auto justify-center p-0"
              : "h-10 px-3 gap-3 text-sm w-full justify-start"
          )}
        >
          <LogOut size={!abierto ? 22 : 20} className="shrink-0" />
          {abierto && <span className="truncate">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
