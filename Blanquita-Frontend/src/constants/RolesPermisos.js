/**
 * Configuración de Roles y Permisos del Sistema Blanquita
 * Inspirado en la arquitectura desacoplada y escalable de front-focus.
 */

export const MODULOS_SISTEMA = [
  {
    id: "administracion",
    nombre: "Administración & Seguridad",
    descripcion: "Gestión de roles, permisos, usuarios del sistema y auditoría",
  },
  {
    id: "rrhh",
    nombre: "Recursos Humanos & Planillas",
    descripcion: "Personal, control biométrico, cronogramas de turno y planillas salariales",
  },
  {
    id: "contabilidad",
    nombre: "Contabilidad & Tesorería",
    descripcion: "Flujo de caja, arqueos, vales de caja chica, bancos, cuentas por cobrar y pagar",
  },
  {
    id: "logistica",
    nombre: "Logística & Rutas",
    descripcion: "Clientes, zonas, rutas de reparto, asignaciones diarias y listas de precios",
  },
  {
    id: "produccion",
    nombre: "Planta & Producción",
    descripcion: "Inventarios de materia prima, bobinas papel, servilleta, rodelas y empaques",
  },
];

export const ACCIONES_PERMISO = [
  { id: "ver", label: "Lectura / Ver", color: "text-blue-600" },
  { id: "crear", label: "Crear", color: "text-emerald-600" },
  { id: "editar", label: "Editar", color: "text-amber-600" },
  { id: "eliminar", label: "Eliminar", color: "text-rose-600" },
  { id: "aprobar", label: "Aprobar / Cerrar", color: "text-purple-600" },
];

export const ROLES_CONFIG = [
  {
    id: 3,
    codigo: "admin",
    nombre: "Administrador General",
    descripcion: "Acceso total de supervisión, auditoría y configuración de todos los módulos.",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    permisosPorDefecto: {
      administracion: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      rrhh: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      contabilidad: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      logistica: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      produccion: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
    },
  },
  {
    id: 4,
    codigo: "contador",
    nombre: "Contador / Tesorería",
    descripcion: "Control exhaustivo de flujo de caja, arqueos, caja chica, bancos y estados financieros.",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    permisosPorDefecto: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: false, editar: true, eliminar: false, aprobar: true },
      contabilidad: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      logistica: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 5,
    codigo: "supervisor",
    nombre: "Supervisor de Logística",
    descripcion: "Gestión comercial de clientes, trazado de rutas, tarifas y despachos diarios.",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    permisosPorDefecto: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      produccion: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 2,
    codigo: "encargado",
    nombre: "Encargado de Producción",
    descripcion: "Control de materias primas, bobinas, órdenes de fabricación y stock de planta.",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    permisosPorDefecto: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
    },
  },
  {
    id: 1,
    codigo: "operador",
    nombre: "Operador de Planta",
    descripcion: "Visualización de turnos, registro de asistencia y órdenes de corte asignadas.",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
    permisosPorDefecto: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 6,
    codigo: "repartidor",
    nombre: "Agente de Reparto",
    descripcion: "Consulta de hoja de despacho y verificación de entrega a puntos de venta.",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
    permisosPorDefecto: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: true, crear: false, editar: true, eliminar: false, aprobar: false },
      produccion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
];

// Usuarios iniciales del sistema para administración
export const USUARIOS_INICIALES = [
  {
    id: 1,
    nombre: "Administrador Central",
    usuario: "admin",
    correo: "admin@blanquita.bo",
    idRol: 3,
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 2,
    nombre: "Lic. Roberto Carlos Flores",
    usuario: "contador",
    correo: "r.flores@blanquita.bo",
    idRol: 4,
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 3,
    nombre: "Ing. Miguel Ángel Soto",
    usuario: "supervisor",
    correo: "m.soto@blanquita.bo",
    idRol: 5,
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      produccion: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 4,
    nombre: "Carlos Eduardo Mendoza",
    usuario: "encargado",
    correo: "c.mendoza@blanquita.bo",
    idRol: 2,
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 5,
    nombre: "Jorge Antonio Quispe",
    usuario: "operador1",
    correo: "j.quispe@blanquita.bo",
    idRol: 1,
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 6,
    nombre: "David Fernández Tapia",
    usuario: "repartidor1",
    correo: "d.fernandez@blanquita.bo",
    idRol: 6,
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
];
