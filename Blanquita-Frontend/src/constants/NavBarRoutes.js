import {
  Home,
  Boxes,
  Factory,
  Database,
  ShelvingUnit,
  SquareStack,
  Container,
  CircleUserRound,
  ClipboardList,
  Users,
  MapPin,
  Truck,
  Tag,
} from "lucide-react";
import { toiletRoll } from "@lucide/lab";

export const RutasSupervisor = [
  {
    titulo: "Inicio",
    icono: Home,
    ruta: "inicio",
  },
  {
    titulo: "Clientes",
    icono: Users,
    ruta: "clientes",
  },
  {
    titulo: "Zonas y Rutas",
    icono: MapPin,
    ruta: "rutas",
  },
  {
    titulo: "Asignación Diaria",
    icono: Truck,
    ruta: "asignaciones",
  },
  {
    titulo: "Precios de Venta",
    icono: Tag,
    ruta: "precios",
  },
  {
    titulo: "Perfil",
    icono: CircleUserRound,
    ruta: "perfil",
  },
];
export const RutasNavBar = [
  {
    titulo: "Inicio",
    icono: Home,
    ruta: "inicio",
  },
  {
    titulo: "Bobina Papel",
    icono: toiletRoll,
    esIconoLab: true,
    ruta: "bobina-papel",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
      { titulo: "Producción", icono: Factory, ruta: "produccion" },
    ],
  },
  {
    titulo: "Bobina Servilleta",
    icono: SquareStack,
    ruta: "bobina-servilleta",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
      { titulo: "Producción", icono: Factory, ruta: "produccion" },
    ],
  },
  {
    titulo: "Rodela",
    icono: Database,
    ruta: "rodela",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
      { titulo: "Producción", icono: Factory, ruta: "produccion" },
    ],
  },

  {
    titulo: "Empaque",
    icono: Container,
    ruta: "empaque",
    subrutas: [
      {
        titulo: "Bobina",
        icono: Database,
        ruta: "bobina-inventario",
      },
    ],
  },

  {
    titulo: "Productos",
    icono: ShelvingUnit,
    ruta: "producto",
    subrutas: [{ titulo: "Inventario", icono: Boxes, ruta: "inventario" }],
  },
  {
    titulo: "Reportes",
    icono: ClipboardList,
    ruta: "reportes/inicio",
    isLider: true,
  },
  {
    titulo: "Perfil",
    icono: CircleUserRound,
    ruta: "perfil",
  },
];

export const RutasReportes = [
  {
    titulo: "Inicio",
    icono: Home,
    ruta: "inicio",
  },

  {
    titulo: "Bobina Papel",
    icono: toiletRoll,
    esIconoLab: true,
    ruta: "bobina-papel",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
      { titulo: "Producción", icono: Factory, ruta: "produccion" },
    ],
  },

  {
    titulo: "Bobina Servilleta",
    icono: SquareStack,
    ruta: "bobina-servilleta",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
      { titulo: "Producción", icono: Factory, ruta: "produccion" },
    ],
  },

  {
    titulo: "Rodela",
    icono: Database,
    ruta: "rodela",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
    ],
  },
  {
    titulo: "Volver a la Planta",
    icono: Factory,
    ruta: "",
  },
];
