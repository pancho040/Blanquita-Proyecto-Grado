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
  Combine,
  QrCode,
  UserShield,
  Users,
  Truck,
  Package,
  Cuboid,
  PackagePlus,
  DoorClosedLocked,
  PackageCheck,
  Bell
} from "lucide-react";
import { toiletRoll } from "@lucide/lab";
import { Roles } from "@/constants/Values";

export function rutaDeItem(item, basePath, prefijo) {
  if (item.absoluta) return item.ruta;
  if (item.ruta === "") return `${prefijo}/inicio`;
  return `${basePath}/${item.ruta}`;
}

export function rutasVisibles(rutas, idRol, esAdmin) {
  return rutas.filter(
    (item) =>
      (!item.isLider || idRol === Roles.Encargado) &&
      (!item.soloAdmin || esAdmin),
  );
}

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
      {
        titulo: "Bolsa",
        icono: Cuboid,
        ruta: "bolsa-inventario",
      },
      {
        titulo: "Bolsa de jaba",
        icono: Package,
        ruta: "jaba-inventario",
      },
    ],
  },

  {
    titulo: "Productos",
    icono: ShelvingUnit,
    ruta: "producto",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
      { titulo: "Movimientos", icono: Combine, ruta: "movimientos" },
    ],
  },
  {
    titulo: "Insumos",
    icono: Package,
    ruta: "insumos",
    subrutas: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "inventario",
      },
    ],
  },
  {
    titulo: "Reportes",
    icono: ClipboardList,
    ruta: "reportes/inicio",
    isLider: true,
  },
  {
    titulo: "Administrador",
    icono: UserShield,
    ruta: "admin/inicio",
    absoluta: true,
    soloAdmin: true,
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
    subrutas: [{ titulo: "Inventario", icono: Boxes, ruta: "inventario" }],
  },
  {
    titulo: "Productos",
    icono: ShelvingUnit,
    ruta: "producto",
    subrutas: [
      { titulo: "Inventario", icono: Boxes, ruta: "inventario" },
      { titulo: "Producción", icono: Factory, ruta: "produccion" },
      { titulo: "Salidas", icono: Truck, ruta: "salidas" },
    ],
  },
  {
    titulo: "Insumos",
    icono: Package,
    ruta: "insumos",
    subrutas: [
      {
        titulo: "Inventario",
        icono: Boxes,
        ruta: "inventario",
      },
      { 
        titulo: "Movimientos", 
        icono: Combine, 
        ruta: "movimientos" 

      },
    ],
  },
  {
    titulo: "Empaque",
    icono: Container,
    ruta: "empaque",
    subrutas: [
      { titulo: "Movimientos", icono: Combine, ruta: "movimientos" },
      { titulo: "Lotes recibidos", icono: PackagePlus, ruta: "lotes" },
    ],
  },
  {
    titulo: "Códigos Qr",
    icono: QrCode,
    ruta: "qr",
  },
  {
    titulo: "Volver a la Planta",
    icono: Factory,
    ruta: "",
  },
];

export const RutasAdmin = [
  {
    titulo: "Inicio",
    icono: Home,
    ruta: "inicio",
  },
  {
    titulo: "Usuarios",
    icono: Users,
    ruta: "usuarios",
    descripcion: "Registrar usuarios, cambiar su estado y restablecer claves",
  },
  {
    titulo: "Proveedores",
    icono: Truck,
    ruta: "proveedores",
    descripcion: "Registrar Proveedores y cambiar su estado",
  },
  {
    titulo: "Insumos",
    icono: Package,
    ruta: "insumos",
    descripcion: "Registrar insumos y editar su descripción",
  },
  {
    titulo: "Bobina Papel",
    icono: toiletRoll,
    ruta: "bobina-papel",
    esIconoLab: true,
    descripcion: "Tipos de bobina papel, sus productos y alertas de stock",
  },
  {
    titulo: "Bobina Servilleta",
    icono: SquareStack,
    ruta: "bobina-servilleta",
    descripcion: "Tipos de bobina servilleta, formatos, productos y alertas de stock",
  },
  {
    titulo: "Rodela",
    icono: Database,
    ruta: "rodela",
    descripcion: "Tipos de rodela y alertas de stock",
  },
  {
    titulo: "Empaques",
    icono: Container,
    ruta: "empaques",
    descripcion: "Tipos de empaque en bobina, en bolsa y bolsas de jaba con sus alertas de stock",
  },
  {
    titulo: "Productos",
    icono: PackageCheck,
    ruta: "productos",
    descripcion: "Líneas de producto, sus presentaciones y alertas de stock",
  },
  {
    titulo: "Accesos sistema",
    icono: DoorClosedLocked,
    ruta: "accesos",
    descripcion: "Ver todos los ingresos e intentos de ingreso al sistema",
  },
  {
    titulo: "Acciones Administrador",
    icono: UserShield,
    ruta: "acciones",
    descripcion: "Ver las acciones realizadas por los administradores",
  },
  {
    titulo: "Volver a la Planta",
    icono: Factory,
    ruta: "",
  },
];

export function basePathSeccion(seccion, prefijo) {
  if (seccion === "reportes") return `${prefijo}/reportes`;
  if (seccion === "admin") return "admin";
  return prefijo;
}

export function rutasSeccion(seccion) {
  if (seccion === "reportes") return RutasReportes;
  if (seccion === "admin") return RutasAdmin;
  return RutasNavBar;
}
