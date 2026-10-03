import { useState } from "react";
import { RutasNavBar, RutasReportes, RutasSupervisor } from "@/constants/NavBarRoutes";
import { Icon, Menu, ChevronDown, LogOut } from "lucide-react";
import { cerrarSesion } from "@/lib/logout-client";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
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
import { PREFIJO_POR_ROL, Roles } from "@/constants/Values";

function IconoItem({ item, size = 18 }) {
  if (item.esIconoLab) {
    return <Icon iconNode={item.icono} size={size} />;
  }
  const IconoComp = item.icono;
  return <IconoComp size={size} />;
}

function ItemNav({ item, basePath, prefijo }) {
  const rutaCompleta =
    item.ruta === "" ? `${prefijo}/inicio` : `${basePath}/${item.ruta}`;

  if (item.subrutas) {
    return (
      <NavigationMenuItem>
        <NavigationMenuTrigger className="bg-transparent text-white hover:!bg-[#20A7DB] focus:!bg-[#20A7DB] data-[state=open]:!bg-[#20A7DB] ">
          <span className="flex items-center gap-2">
            <IconoItem item={item} />
            {item.titulo}
          </span>
        </NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="grid gap-1 p-2 min-w-[180px]">
            {item.subrutas.map((sub) => (
              <li key={sub.ruta}>
                <NavigationMenuLink
                  href={`/${rutaCompleta}/${sub.ruta}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:!bg-[#20A7DB] hover:!text-white"
                >
                  <IconoItem item={sub} />
                  {sub.titulo}
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        href={`/${rutaCompleta}`}
        className="flex items-center gap-2 px-3 py-2 text-lg text-white hover:!bg-[#20A7DB] focus:!bg-[#20A7DB]"
      >
        <IconoItem item={item} />
        {item.titulo}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

function ItemNavMovil({ item, basePath, prefijo, alNavegar }) {
  const rutaCompleta =
    item.ruta === "" ? `${prefijo}/inicio` : `${basePath}/${item.ruta}`;

  if (!item.subrutas) {
    return (
      <a
        href={`/${rutaCompleta}`}
        onClick={alNavegar}
        className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-white hover:bg-[#20A7DB] focus-visible:bg-[#20A7DB] focus-visible:outline-none"
      >
        <IconoItem item={item} size={20} />
        {item.titulo}
      </a>
    );
  }

  return (
    <AccordionItem value={item.ruta} className="border-none">
      <AccordionTrigger className="rounded-lg px-4 py-3 text-base font-medium text-white hover:bg-[#20A7DB] hover:no-underline focus-visible:bg-[#20A7DB] focus-visible:outline-none [&>svg]:hidden">
        <span className="flex items-center gap-3">
          <IconoItem item={item} size={20} />
          {item.titulo}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform duration-200 group-data-[panel-open]:rotate-180"
        />
      </AccordionTrigger>
      <AccordionContent className="pb-1">
        <ul className="ml-5 flex flex-col gap-1 border-l-2 border-[#A0D9EF] pl-3">
          {item.subrutas.map((sub) => (
            <li key={sub.ruta}>
              <a
                href={`/${rutaCompleta}/${sub.ruta}`}
                onClick={alNavegar}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-[#20A7DB] focus-visible:bg-[#20A7DB] focus-visible:outline-none"
              >
                <IconoItem item={sub} size={18} />
                {sub.titulo}
              </a>
            </li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function NavBar({ idRol, seccion }) {
  const prefijo = PREFIJO_POR_ROL[idRol];
  const enReportes = seccion === "reportes";
  const basePath = enReportes ? `${prefijo}/reportes` : prefijo;
  const rutas = enReportes
    ? RutasReportes
    : idRol === Roles.Supervisor
    ? RutasSupervisor
    : RutasNavBar.filter((item) => !item.isLider || idRol === Roles.Encargado);
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 z-30 flex w-full flex-row items-center justify-center px-4 h-20 md:h-30 text-white transition-all duration-300 ease-in-out"
      style={{
        backgroundColor: "#62C1E5",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 4px 20px #1c96c533",
        borderBottom: "2px solid #A0D9EF",
      }}
    >
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetTrigger
          aria-label="Abrir menú"
          className="md:hidden absolute left-4 flex items-center justify-center rounded-lg p-2 text-white hover:bg-[#20A7DB] focus-visible:bg-[#20A7DB] focus-visible:outline-none"
        >
          <Menu size={28} />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 max-w-[80%] border-r-2 border-[#A0D9EF] p-0 text-white [&>button]:text-white [&>button]:opacity-100"
          style={{ backgroundColor: "#62C1E5" }}
        >
          <SheetHeader className="h-20 flex-row items-center justify-start border-b-2 border-[#A0D9EF] px-4 py-0 space-y-0">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <img
              src="/LogoBlanquita.webp"
              alt="Papel Blanquita"
              className="h-14 w-auto"
              style={{ filter: "drop-shadow(0 4px 12px rgba(255,255,255,.3))" }}
            />
          </SheetHeader>

          <Accordion
            openMultiple={false}
            className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
          >
            {rutas.map((item) => (
              <ItemNavMovil
                key={item.ruta}
                item={item}
                basePath={basePath}
                prefijo={prefijo}
                alNavegar={() => setMenuAbierto(false)}
              />
            ))}
          </Accordion>

          <button
            type="button"
            onClick={() => {
              setMenuAbierto(false);
              cerrarSesion();
            }}
            className="mt-auto flex items-center gap-3 border-t-2 border-[#A0D9EF] px-4 py-4 text-base font-medium text-white hover:bg-red-600 focus-visible:bg-red-600 focus-visible:outline-none"
          >
            <LogOut size={20} />
            Cerrar sesión
          </button>
        </SheetContent>
      </Sheet>

      <div className="flex flex-row items-center justify-center gap-2">
        <img
          src="/LogoBlanquita.webp"
          alt="Papel Blanquita"
          className="h-16 md:h-25 w-auto transition-[filter] duration-300 ease-in-out"
          style={{ filter: "drop-shadow(0 4px 12px rgba(255,255,255,.3))" }}
        />

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {rutas.map((item) => (
              <ItemNav key={item.ruta} item={item} basePath={basePath} prefijo={prefijo} />
            ))}
            <NavigationMenuItem>
              <button
                type="button"
                onClick={cerrarSesion}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-lg text-white hover:!bg-red-600 focus:!bg-red-600 focus-visible:outline-none"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </nav>
  );
}