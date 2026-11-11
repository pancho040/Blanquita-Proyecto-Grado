import React, { useState, useEffect, useMemo } from "react";
import {
  Menu,
  ChevronRight,
  LogOut,
  User as UserIcon,
  ShieldCheck,
} from "lucide-react";
import { cerrarSesion } from "@/lib/logout-client";
import { RutasNavBar, RutasReportes, RutasSupervisor, RutasContador, RutasAdmin } from "@/constants/NavBarRoutes";
import { PREFIJO_POR_ROL, Roles } from "@/constants/Values";
import { useBranch } from "@/stores/branchStore";
import ThemeToggle from "@/components/layout/ThemeToggle";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const CLAVE_ES_ADMIN = "blanquita_es_admin";

function normalizarRuta(p) {
  if (!p) return "/";
  return p.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
}

function IconoItem({ item, size = 18 }) {
  if (!item || !item.icono) return null;
  if (item.esIconoLab) {
    const IconLab = item.icono;
    return <span className="inline-flex"><IconLab size={size} /></span>;
  }
  const IconoComp = item.icono;
  return <IconoComp size={size} />;
}

function resolverRuta(basePath, prefijo, rutaItem, rutaSub = null) {
  let base = rutaItem;
  const prefijosConocidos = ["admin", "supervisor", "contador", "encargado", "operador", "gerencia"];
  const tienePrefijo = prefijosConocidos.some((p) => rutaItem.startsWith(p));

  if (!tienePrefijo) {
    base = rutaItem === "" ? `${prefijo}/inicio` : `${basePath}/${rutaItem}`;
  }

  if (rutaSub !== null) {
    return `/${base}/${rutaSub}`.replace(/\/+/g, "/").replace(/\/$/, "");
  }
  return `/${base}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

// Resuelve la información de Breadcrumb (módulo padre y página actual)
function obtenerBreadcrumb(rutas, basePath, prefijo, pathname) {
  const rutaActual = normalizarRuta(pathname);

  for (const item of rutas) {
    if (item.subrutas) {
      for (const sub of item.subrutas) {
        const subUrl = normalizarRuta(resolverRuta(basePath, prefijo, item.ruta, sub.ruta));
        if (rutaActual === subUrl || (sub.ruta !== "" && rutaActual.startsWith(subUrl + "/"))) {
          return {
            padre: item.titulo,
            padreIcono: item,
            actual: sub.titulo,
            actualIcono: sub,
          };
        }
      }
    } else {
      const itemUrl = normalizarRuta(resolverRuta(basePath, prefijo, item.ruta));
      if (rutaActual === itemUrl) {
        return {
          padre: null,
          padreIcono: null,
          actual: item.titulo,
          actualIcono: item,
        };
      }
    }
  }

  // Fallback si no hay coincidencia exacta
  const segmentos = rutaActual.split("/").filter(Boolean);
  const ultimoSegmento = segmentos[segmentos.length - 1] || "Inicio";
  const capitalizado = ultimoSegmento.charAt(0).toUpperCase() + ultimoSegmento.slice(1).replace(/-/g, " ");

  return {
    padre: segmentos.length > 2 ? "Gestión" : null,
    padreIcono: null,
    actual: capitalizado,
    actualIcono: null,
  };
}

export default function NavBar({
  idRol,
  seccion,
  esAdmin: esAdminProp,
  usuario,
  rutaInicial = "/",
}) {
  // Inicialización idéntica en SSR y en el cliente para prevenir Hydration Mismatch
  const [esAdmin, setEsAdmin] = useState(() => Boolean(esAdminProp));

  // Store único y centralizado de alcance de sucursales
  const {
    sucursalActiva,
    sucursalesPermitidas,
    puedeVerTodas,
    cambiarSucursal
  } = useBranch(usuario);

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

  // Ruta actual reactiva que inicia con la ruta del servidor (evita mismatch en breadcrumb)
  const [rutaActual, setRutaActual] = useState(rutaInicial);

  useEffect(() => {
    // Sincronizar ruta en cliente si fuera diferente al montar
    if (typeof window !== "undefined" && window.location.pathname !== rutaActual) {
      setRutaActual(window.location.pathname);
    }

    const handleLocationChange = () => {
      if (typeof window !== "undefined") {
        setRutaActual(window.location.pathname);
      }
    };
    window.addEventListener("popstate", handleLocationChange);
    document.addEventListener("astro:page-load", handleLocationChange);
    document.addEventListener("astro:after-swap", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      document.removeEventListener("astro:page-load", handleLocationChange);
      document.removeEventListener("astro:after-swap", handleLocationChange);
    };
  }, []);

  const breadcrumb = useMemo(() => {
    return obtenerBreadcrumb(rutas, basePath, prefijo, rutaActual);
  }, [rutas, basePath, prefijo, rutaActual]);

  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  // Nombre y Rol a mostrar
  const nombreUsuario = usuario?.Nombre || usuario?.Usuario || (esAdmin ? "Administrador" : "Usuario");
  const rolTexto = esAdmin
    ? "Administrador General"
    : idRol === Roles.Contador
    ? "Contabilidad & Finanzas"
    : idRol === Roles.Supervisor
    ? "Supervisor de Logística"
    : idRol === Roles.Encargado
    ? "Encargado de Producción"
    : "Operador de Planta";

  const iniciales = (nombreUsuario || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <header
      className="w-full h-16 text-white transition-all duration-200 select-none shrink-0"
      style={{
        backgroundColor: "#62C1E5",
        boxShadow: "0 4px 20px #1c96c533",
        borderBottom: "2px solid #A0D9EF",
      }}
    >
      <div className="h-full px-4 sm:px-6 md:px-8 flex items-center justify-between gap-4">
        
        {/* LADO IZQUIERDO: Botón Móvil + Breadcrumbs / Título de Página */}
        <div className="flex items-center gap-3 min-w-0">
          
          {/* Botón Drawer Móvil (< md) */}
          <Sheet open={menuMovilAbierto} onOpenChange={setMenuMovilAbierto}>
            <SheetTrigger
              aria-label="Abrir menú de navegación"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 hover:bg-[#20A7DB] text-white border border-white/20 transition-colors cursor-pointer shrink-0"
            >
              <Menu size={20} />
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-72 p-0 text-white border-r-2 border-[#A0D9EF] z-[100]"
              style={{
                backgroundColor: "#62C1E5",
                boxShadow: "0 4px 25px rgba(28, 150, 197, 0.35)",
              }}
            >
              <SheetHeader className="p-4 border-b-2 border-[#A0D9EF] flex flex-row items-center justify-between">
                <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
                <div className="flex items-center gap-2">
                  <img
                    src="/LogoBlanquita.webp"
                    alt="Papel Blanquita"
                    className="h-9 w-auto"
                    style={{ filter: "drop-shadow(0 4px 10px rgba(255,255,255,.35))" }}
                  />
                </div>
              </SheetHeader>

              {/* Lista móvil de rutas */}
              <div className="flex flex-col h-[calc(100%-80px)] justify-between p-3 overflow-y-auto">
                <Accordion type="multiple" className="w-full flex flex-col gap-1.5">
                  {rutas.map((item, idx) => {
                    if (!item) return null;
                    if (!item.subrutas) {
                      const rutaFinal = resolverRuta(basePath, prefijo, item.ruta);
                      const activo = normalizarRuta(rutaActual) === normalizarRuta(rutaFinal);
                      return (
                        <a
                          key={`nav-simple-${item.titulo || ''}-${item.ruta || idx}`}
                          href={rutaFinal}
                          onClick={() => setMenuMovilAbierto(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white transition-colors",
                            activo ? "bg-[#20A7DB] shadow-sm font-semibold" : "hover:bg-[#20A7DB]/60"
                          )}
                        >
                          <IconoItem item={item} size={18} />
                          <span className="truncate">{item.titulo}</span>
                        </a>
                      );
                    }

                    const rutaSubActiva = item.subrutas.some((sub) => {
                      const subUrl = normalizarRuta(resolverRuta(basePath, prefijo, item.ruta, sub.ruta));
                      const actual = normalizarRuta(rutaActual);
                      return actual === subUrl || (sub.ruta !== "" && actual.startsWith(subUrl + "/"));
                    });

                    return (
                      <AccordionItem key={`nav-acc-${item.titulo || ''}-${item.ruta || idx}`} value={item.ruta || String(idx)} className="border-none">
                        <AccordionTrigger
                          className={cn(
                            "rounded-xl px-3.5 py-2.5 text-sm font-medium text-white hover:no-underline transition-colors",
                            rutaSubActiva ? "bg-[#20A7DB]/80 font-semibold" : "hover:bg-[#20A7DB]/40"
                          )}
                        >
                          <span className="flex items-center gap-3 truncate">
                            <IconoItem item={item} size={18} />
                            <span className="truncate">{item.titulo}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-1 pt-1">
                          <ul className="ml-4 flex flex-col gap-1 border-l-2 border-[#A0D9EF]/60 pl-3">
                            {item.subrutas.map((sub) => {
                              const subUrl = resolverRuta(basePath, prefijo, item.ruta, sub.ruta);
                              const esSubActivo = normalizarRuta(rutaActual) === normalizarRuta(subUrl);
                              return (
                                <li key={sub.ruta}>
                                  <a
                                    href={subUrl}
                                    onClick={() => setMenuMovilAbierto(false)}
                                    className={cn(
                                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white transition-colors",
                                      esSubActivo ? "bg-[#20A7DB] font-semibold" : "opacity-90 hover:opacity-100 hover:bg-[#20A7DB]/50"
                                    )}
                                  >
                                    <IconoItem item={sub} size={15} />
                                    <span className="truncate">{sub.titulo}</span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>

                <div className="pt-3 border-t-2 border-[#A0D9EF]/60">
                  <button
                    type="button"
                    onClick={cerrarSesion}
                    className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white bg-red-600/90 hover:bg-red-600 transition-colors shadow-sm cursor-pointer"
                  >
                    <LogOut size={18} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Breadcrumb / Título elegante unificado con fondo corporativo */}
          <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 sm:gap-2 min-w-0 text-sm">
            {breadcrumb.padre && (
              <>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-white/80 font-medium text-xs sm:text-sm truncate">
                  {breadcrumb.padreIcono && <IconoItem item={breadcrumb.padreIcono} size={15} />}
                  <span>{breadcrumb.padre}</span>
                </span>
                <ChevronRight size={14} className="hidden sm:inline-block text-white/60 shrink-0" />
              </>
            )}
            <div className="flex items-center gap-2 min-w-0">
              {breadcrumb.actualIcono && (
                <span className="p-1 rounded-lg bg-white/15 border border-white/20 text-white shrink-0 shadow-2xs">
                  <IconoItem item={breadcrumb.actualIcono} size={16} />
                </span>
              )}
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate drop-shadow-xs">
                {breadcrumb.actual}
              </h1>
            </div>
          </nav>
        </div>

        {/* LADO DERECHO: Rol Badge + Modo Oscuro + Perfil Dropdown */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          
          {/* Badge de Rol Ejecutivo Unificado */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-white/30 bg-white/15 text-white shadow-2xs backdrop-blur-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <ShieldCheck size={13} className="text-white" />
            <span className="truncate max-w-[140px]">{rolTexto}</span>
          </div>

          {/* Botón de Modo Oscuro Inerte (Listo para activar más adelante) */}
          <ThemeToggle />

          {/* Separador vertical sutil */}
          <div className="hidden sm:block h-6 w-px bg-white/30" />

          {/* Perfil de Usuario Estático y botón directo de salida (máxima estabilidad sin dropdown) */}
          <div className="flex items-center gap-2.5 p-1 select-none">
            <div className="h-9 w-9 rounded-xl bg-white/20 border border-white/30 text-white font-bold flex items-center justify-center text-xs sm:text-sm shadow-2xs">
              {iniciales || <UserIcon size={16} />}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
                {nombreUsuario}
              </span>
              <span className="text-[11px] text-white/80 leading-none truncate max-w-[120px]">
                {esAdmin ? "Administrador" : rolTexto}
              </span>
            </div>
          </div>

          {/* Botón directo para cerrar sesión */}
          <button
            type="button"
            onClick={cerrarSesion}
            title="Cerrar sesión"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 hover:bg-red-500/80 text-white border border-white/20 hover:border-red-400 transition-colors cursor-pointer shadow-2xs shrink-0"
          >
            <LogOut size={16} />
          </button>

        </div>
      </div>
    </header>
  );
}
