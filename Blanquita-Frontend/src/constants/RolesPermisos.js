/**
 * Configuración de Roles y Permisos del Sistema Blanquita
 * Definición centralizada de roles y permisos del sistema.
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
  // GERENCIA
  {
    id: 13,
    nombre: "Don Osvaldo Téllez",
    usuario: "gerente_general",
    correo: "10369746@papelblanquita.invalid",
    ci: "10369746",
    celular: "70000000",
    idRol: 3,
    idSucursal: "todas",
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  // CONTABILIDAD
  {
    id: 26,
    nombre: "Lic. Mateo Alejandro Morales Ramos",
    usuario: "contador_sucre",
    correo: "8001010@papelblanquita.invalid",
    ci: "8001010",
    celular: "71001010",
    idRol: 4,
    idSucursal: 1, // Sucre
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 27,
    nombre: "Lic. Carmen Elena Vaca Guzmán",
    usuario: "contador_potosi",
    correo: "8002010@papelblanquita.invalid",
    ci: "8002010",
    celular: "72002010",
    idRol: 4,
    idSucursal: 2, // Potosí
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 28,
    nombre: "Lic. Roberto Carlos Flores Terán",
    usuario: "contador_multisede",
    correo: "8003010@papelblanquita.invalid",
    ci: "8003010",
    celular: "73003010",
    idRol: 4,
    idSucursal: "todas", // Multisede
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  // LOGÍSTICA
  {
    id: 21,
    nombre: "René Carlos Torres Alba",
    usuario: "supervisor_sucre",
    correo: "8001001@papelblanquita.invalid",
    ci: "8001001",
    celular: "71001001",
    idRol: 5,
    idSucursal: 1, // Sucre
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 22,
    nombre: "Gonzalo Hugo Flores Peñaranda",
    usuario: "supervisor_potosi",
    correo: "8002001@papelblanquita.invalid",
    ci: "8002001",
    celular: "72002001",
    idRol: 5,
    idSucursal: 2, // Potosí
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 29,
    nombre: "Ing. Sergio Marcelo Ramos Calvimontes",
    usuario: "supervisor_multisede",
    correo: "8003020@papelblanquita.invalid",
    ci: "8003020",
    celular: "73003020",
    idRol: 5,
    idSucursal: "todas", // Multisede
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 23,
    nombre: "Ramiro Luis Gutiérrez Sosa",
    usuario: "chofer_sucre",
    correo: "8001002@papelblanquita.invalid",
    ci: "8001002",
    celular: "71001002",
    idRol: 6,
    idSucursal: 1, // Sucre
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 24,
    nombre: "Jaime Alberto Villegas Copa",
    usuario: "chofer_potosi_1",
    correo: "8002002@papelblanquita.invalid",
    ci: "8002002",
    celular: "72002002",
    idRol: 6,
    idSucursal: 2, // Potosí
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  {
    id: 25,
    nombre: "Milton Roxana Choque Quispe",
    usuario: "chofer_potosi_2",
    correo: "8002003@papelblanquita.invalid",
    ci: "8002003",
    celular: "72002003",
    idRol: 6,
    idSucursal: 2, // Potosí
    activo: true,
    personalizado: false,
    permisosPersonalizados: null,
  },
  // RECURSOS HUMANOS
  {
    id: 30,
    nombre: "Lic. Patricia Eugenia Morales Soliz",
    usuario: "rrhh_sucre",
    correo: "8001030@papelblanquita.invalid",
    ci: "8001030",
    celular: "71001030",
    idRol: 5,
    idSucursal: 1, // Sucre
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: true, editar: true, eliminar: false, aprobar: true },
      contabilidad: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 31,
    nombre: "Lic. Javier Fernando Paredes Cruz",
    usuario: "rrhh_potosi",
    correo: "8002030@papelblanquita.invalid",
    ci: "8002030",
    celular: "72002030",
    idRol: 5,
    idSucursal: 2, // Potosí
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: true, editar: true, eliminar: false, aprobar: true },
      contabilidad: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 32,
    nombre: "Lic. Valeria Andrea Mercado Paz",
    usuario: "rrhh_multisede",
    correo: "8003030@papelblanquita.invalid",
    ci: "8003030",
    celular: "73003030",
    idRol: 5,
    idSucursal: "todas", // Multisede
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: true, editar: true, eliminar: true, aprobar: true },
      contabilidad: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  // ACCESO PARCIAL / HÍBRIDO WEB
  {
    id: 33,
    nombre: "Andrea Sofía Durán Méndez",
    usuario: "hibrido_despacho_cxc_sucre",
    correo: "8001040@papelblanquita.invalid",
    ci: "8001040",
    celular: "71001040",
    idRol: 5,
    idSucursal: 1, // Sucre
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: true, crear: true, editar: true, eliminar: false, aprobar: true },
      produccion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 34,
    nombre: "Mauricio José Alarcón Pinto",
    usuario: "hibrido_operaciones_asistencia_potosi",
    correo: "8002040@papelblanquita.invalid",
    ci: "8002040",
    celular: "72002040",
    idRol: 5,
    idSucursal: 2, // Potosí
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: true, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: true, crear: true, editar: true, eliminar: false, aprobar: false },
      produccion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 35,
    nombre: "Lic. Álvaro Esteban Campero Daza",
    usuario: "hibrido_auditor_operaciones_multisede",
    correo: "8003040@papelblanquita.invalid",
    ci: "8003040",
    celular: "73003040",
    idRol: 5,
    idSucursal: "todas", // Multisede
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      logistica: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
  {
    id: 36,
    nombre: "Lic. Gabriela Beatriz Salinas Rios",
    usuario: "hibrido_tesoreria_personal_multisede",
    correo: "8003050@papelblanquita.invalid",
    ci: "8003050",
    celular: "73003050",
    idRol: 4,
    idSucursal: "todas", // Multisede
    activo: true,
    personalizado: true,
    permisosPersonalizados: {
      administracion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
      rrhh: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      contabilidad: { ver: true, crear: true, editar: true, eliminar: false, aprobar: false },
      logistica: { ver: true, crear: false, editar: false, eliminar: false, aprobar: false },
      produccion: { ver: false, crear: false, editar: false, eliminar: false, aprobar: false },
    },
  },
];
