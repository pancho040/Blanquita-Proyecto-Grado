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
  Wallet,
  Landmark,
  Receipt,
  HandCoins,
  FileSpreadsheet,
  Layers,
  Fingerprint,
  Calendar,
  DollarSign,
  Settings2,
  Clock,
  ShieldCheck,
  Radio,
  QrCode,
} from "lucide-react";
import { toiletRoll } from "@lucide/lab";

// =============================================================================
// MENÚ INTEGRAL DEL ADMINISTRADOR GENERAL (ORGANIZADO POR MÓDULOS COLAPSABLES)
// Permite al Administrador acceder a TODOS los módulos del sistema sin saturar
// el sidebar gracias a los grupos colapsables.
// =============================================================================
export const RutasAdmin = [
  {
    titulo: "Panel General",
    icono: Home,
    ruta: "admin/inicio",
  },
  {
    titulo: "Gerencia",
    icono: ShieldCheck,
    ruta: "gerencia/inicio",
  },
  {
    titulo: "Usuarios y Seguridad",
    icono: ShieldCheck,
    ruta: "admin",
    subrutas: [
      { titulo: "Personal y Roles", icono: Users, ruta: "roles" },
      { titulo: "Historial de Modificaciones", icono: ShieldCheck, ruta: "auditoria" },
      { titulo: "Reportes de Auditoría", icono: ClipboardList, ruta: "auditoria/reportes" },
    ],
  },
  {
    titulo: "Recursos Humanos",
    icono: Fingerprint,
    ruta: "admin/rrhh",
    subrutas: [
      { titulo: "Dashboard RRHH", icono: Home, ruta: "inicio" },
      { titulo: "Personal y Sueldos", icono: Users, ruta: "empleados" },
      { titulo: "Cronograma Turnos", icono: Calendar, ruta: "turnos" },
      { titulo: "Control Asistencia", icono: Clock, ruta: "asistencia" },
      { titulo: "Planillas y Finiquitos", icono: DollarSign, ruta: "planillas" },
      { titulo: "Configuración Laboral", icono: Settings2, ruta: "configuracion" },
      { titulo: "Reportes RRHH", icono: ClipboardList, ruta: "reportes" },
    ],
  },
  {
    titulo: "Logística",
    icono: Truck,
    ruta: "supervisor",
    subrutas: [
      { titulo: "Inicio", icono: Home, ruta: "inicio" },
      { titulo: "Clientes", icono: Users, ruta: "clientes" },
      { titulo: "Zonas y Rutas", icono: MapPin, ruta: "rutas" },
      { titulo: "Rastreo", icono: Radio, ruta: "rutas/rastreo" },
      { titulo: "Reparto y Despachos", icono: Truck, ruta: "asignaciones" },
      { titulo: "Precios", icono: Tag, ruta: "precios" },
      { titulo: "Inventario Comercial", icono: Boxes, ruta: "inventario-comercial" },
      { titulo: "Envíos y Remisiones", icono: Truck, ruta: "envios" },
      { titulo: "Distribuidores", icono: Factory, ruta: "distribuidores" },
      { titulo: "Reportes Logística", icono: ClipboardList, ruta: "reportes" },
    ],
  },
  {
    titulo: "Contabilidad",
    icono: Wallet,
    ruta: "contador",
    subrutas: [
      { titulo: "Flujo de Caja", icono: Wallet, ruta: "caja" },
      { titulo: "Caja Chica", icono: Receipt, ruta: "caja-chica" },
      { titulo: "Aprobación de Caja Chica", icono: ShieldCheck, ruta: "aprobacion-caja-chica" },
      { titulo: "Bancos", icono: Landmark, ruta: "bancos" },
      { titulo: "Cuentas por Cobrar", icono: HandCoins, ruta: "cuentas-cobrar" },
      { titulo: "Aprobación Cobros QR", icono: QrCode, ruta: "aprobacion-qr" },
      { titulo: "Cuentas por Pagar", icono: Layers, ruta: "cuentas-pagar" },
      { titulo: "Notas de Venta", icono: Truck, ruta: "notas-venta" },
      { titulo: "Reportes Contables", icono: ClipboardList, ruta: "reportes" },
    ],
  },
  {
    titulo: "Planta & Producción",
    icono: Factory,
    ruta: "encargado",
    subrutas: [
      { titulo: "Inventario Papel", icono: Boxes, ruta: "bobina-papel/inventario" },
      { titulo: "Inventario Servilleta", icono: SquareStack, ruta: "bobina-servilleta/inventario" },
      { titulo: "Inventario Rodela", icono: Database, ruta: "rodela/inventario" },
      { titulo: "Inventario Empaque", icono: Container, ruta: "empaque/bobina-inventario" },
      { titulo: "Productos Finales", icono: ShelvingUnit, ruta: "producto/inventario" },
    ],
  },
];

// =============================================================================
// MENÚ CONTADOR
// =============================================================================
export const RutasContador = [
  {
    titulo: "Inicio",
    icono: Home,
    ruta: "inicio",
  },
  {
    titulo: "Flujo de Caja",
    icono: Wallet,
    ruta: "caja",
  },
  {
    titulo: "Caja Chica",
    icono: Receipt,
    ruta: "caja-chica",
  },
  {
    titulo: "Aprobación Caja Chica",
    icono: ShieldCheck,
    ruta: "aprobacion-caja-chica",
  },
  {
    titulo: "Bancos",
    icono: Landmark,
    ruta: "bancos",
  },
  {
    titulo: "Cuentas por Cobrar",
    icono: HandCoins,
    ruta: "cuentas-cobrar",
  },
  {
    titulo: "Notas de Venta",
    icono: Truck,
    ruta: "notas-venta",
  },
  {
    titulo: "Cuentas por Pagar",
    icono: Layers,
    ruta: "cuentas-pagar",
  },
  {
    titulo: "Reportes",
    icono: ClipboardList,
    ruta: "reportes",
  },
  {
    titulo: "Perfil",
    icono: CircleUserRound,
    ruta: "perfil",
  },
];

// =============================================================================
// MENÚ SUPERVISOR
// =============================================================================
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
    titulo: "Rastreo",
    icono: Radio,
    ruta: "rutas/rastreo",
  },
  {
    titulo: "Reparto y Despachos",
    icono: Truck,
    ruta: "asignaciones",
  },
  {
    titulo: "Precios",
    icono: Tag,
    ruta: "precios",
  },
  {
    titulo: "Inventario Comercial",
    icono: Boxes,
    ruta: "inventario-comercial",
  },
  {
    titulo: "Envíos y Remisiones",
    icono: Truck,
    ruta: "envios",
  },
  {
    titulo: "Reportes",
    icono: ClipboardList,
    ruta: "reportes",
  },
  {
    titulo: "Perfil",
    icono: CircleUserRound,
    ruta: "perfil",
  },
];

// =============================================================================
// MENÚ PLANTA / PRODUCCIÓN (ENCARGADO & OPERADOR)
// =============================================================================
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
