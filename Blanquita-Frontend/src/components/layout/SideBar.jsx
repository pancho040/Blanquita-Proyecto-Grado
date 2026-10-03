import { useEffect, useState } from "react";
import { Icon, ChevronDown, ChevronLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { RutasNavBar, RutasReportes, RutasSupervisor } from "@/constants/NavBarRoutes";
import { PREFIJO_POR_ROL, Roles } from "@/constants/Values";
import { cerrarSesion } from "@/lib/logout-client";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";

/**
 * Version escritorio de la navegacion: reutiliza el mismo JSON que el NavBar
 * (RutasNavBar) y mantiene la paleta del NavBar mapeandola a los tokens
 * --sidebar-* que consume el componente ui/sidebar.
 */
const PALETA_NAVBAR = {
  "--sidebar": "#62C1E5",
  "--sidebar-foreground": "#ffffff",
  "--sidebar-accent": "#20A7DB",
  "--sidebar-accent-foreground": "#ffffff",
  "--sidebar-primary": "#20A7DB",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-border": "#A0D9EF",
  "--sidebar-ring": "#A0D9EF",
};

const ANCHO_SIDEBAR = "17rem";
const CLAVE_ESTADO = "sidebar-abierto";

// Escritorio compacto: items 14px (text-sm), subitems 12px (text-xs).
const CLASE_ITEM =
  "h-10 gap-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent [&_svg]:size-5";
const CLASE_SUBITEM =
  "h-8 gap-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent [&>svg]:size-4 [&>svg]:text-sidebar-foreground";

function IconoItem({ item, size = 22 }) {
  if (item.esIconoLab) {
    return <Icon iconNode={item.icono} size={size} />;
  }
  const IconoComp = item.icono;
  return <IconoComp size={size} />;
}

function EntradaSimple({ item, basePath, prefijo }) {
  const rutaCompleta =
    item.ruta === "" ? `${prefijo}/inicio` : `${basePath}/${item.ruta}`;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="lg"
        render={<a href={`/${rutaCompleta}`} />}
        className={CLASE_ITEM}
      >
        <IconoItem item={item} size={20} />
        <span>{item.titulo}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function GrupoColapsable({ item, basePath }) {
  const rutaCompleta = `${basePath}/${item.ruta}`;
  const [abierto, setAbierto] = useState(false);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size="lg"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={cn(
          CLASE_ITEM,
          abierto && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <IconoItem item={item} size={20} />
        <span className="flex-1 text-left">{item.titulo}</span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 transition-transform duration-200",
            abierto && "rotate-180"
          )}
        />
      </SidebarMenuButton>

      {abierto && (
        <SidebarMenuSub className="mt-1 gap-1 border-sidebar-border">
          {item.subrutas.map((sub) => (
            <SidebarMenuSubItem key={sub.ruta}>
              <SidebarMenuSubButton
                render={<a href={`/${rutaCompleta}/${sub.ruta}`} />}
                className={CLASE_SUBITEM}
              >
                <IconoItem item={sub} size={16} />
                <span>{sub.titulo}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export default function SideBar({ idRol, seccion }) {
  const prefijo = PREFIJO_POR_ROL[idRol];
  const enReportes = seccion === "reportes";
  const basePath = enReportes ? `${prefijo}/reportes` : prefijo;
  const rutas = enReportes
    ? RutasReportes
    : idRol === Roles.Supervisor
    ? RutasSupervisor
    : RutasNavBar.filter((item) => !item.isLider || idRol === Roles.Encargado);

  // Arranca abierto para coincidir con el HTML del servidor (evita desajuste de
  // hidratacion); el estado guardado se aplica ya en el cliente.
  const [abierto, setAbierto] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_ESTADO) === "false") {
        setAbierto(false);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const alternar = () => {
    setAbierto((v) => {
      const siguiente = !v;
      try {
        window.localStorage.setItem(CLAVE_ESTADO, String(siguiente));
      } catch {
        /* almacenamiento no disponible */
      }
      return siguiente;
    });
  };

  // Ajusta el hueco reservado para el contenido mediante una variable CSS en
  // <html>. El contenedor de contenido (otra isla de Astro) la consume solo
  // dentro de @media (min-width: 768px) en globals.css, asi que en movil nunca
  // se aplica padding aunque esta variable quede fijada.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty("--hueco-sidebar", abierto ? ANCHO_SIDEBAR : "0px");
    return () => raiz.style.removeProperty("--hueco-sidebar");
  }, [abierto]);

  return (
    <SidebarProvider style={PALETA_NAVBAR} className="contents">
      <Sidebar
        collapsible="none"
        className="fixed inset-y-0 left-0 z-50 h-svh border-r-2 border-sidebar-border"
        style={{
          width: ANCHO_SIDEBAR,
          transform: abierto ? undefined : "translateX(-100%)",
          transition: "transform 0.3s ease-in-out",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px #1c96c533",
        }}
      >
        <SidebarHeader className="h-16 items-center justify-center border-b-2 border-sidebar-border md:h-20">
          <img
            src="/LogoBlanquita.webp"
            alt="Papel Blanquita"
            className="h-10 w-auto md:h-12"
            style={{ filter: "drop-shadow(0 4px 12px rgba(255,255,255,.3))" }}
          />
        </SidebarHeader>

        <SidebarContent className="p-3">
          <SidebarMenu className="gap-1.5">
            {rutas.map((item) =>
              item.subrutas ? (
                <GrupoColapsable key={item.ruta} item={item} basePath={basePath} />
              ) : (
                <EntradaSimple
                  key={item.ruta}
                  item={item}
                  basePath={basePath}
                  prefijo={prefijo}
                />
              )
            )}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t-2 border-sidebar-border p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                onClick={cerrarSesion}
                className={cn(
                  CLASE_ITEM,
                  "hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white"
                )}
              >
                <LogOut size={20} />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Lengueta para plegar / desplegar, centrada verticalmente */}
      <button
        type="button"
        onClick={alternar}
        aria-label={abierto ? "Plegar menu" : "Desplegar menu"}
        aria-expanded={abierto}
        className="fixed top-1/2 z-50 flex h-20 w-7 -translate-y-1/2 items-center justify-center rounded-r-xl border-2 border-l-0 border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_4px_20px_#1c96c533] backdrop-blur transition-[left] duration-300 ease-in-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        style={{ left: abierto ? ANCHO_SIDEBAR : "0rem" }}
      >
        <ChevronLeft
          size={20}
          className={cn("transition-transform duration-300", !abierto && "rotate-180")}
        />
      </button>
    </SidebarProvider>
  );
}
