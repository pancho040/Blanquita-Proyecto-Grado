import {
  Boxes,
  Factory,
  PackagePlus,
  Database,
  SquareStack,
  Container,
  ShelvingUnit,
  Combine,
  Package,
  Cuboid,
  Undo2,
} from "lucide-react";
import { toiletRoll } from "@lucide/lab";
export const movimientosOperador = [
  {
    IdTipoMovimientoOperadorLogs: 1,
    NombreMovimiento: "Ingreso",
    DescripcionTipoMovimientoOperadorLogs:
      "Registro de logs producidos por el operador durante el turno",
  },
  {
    IdTipoMovimientoOperadorLogs: 2,
    NombreMovimiento: "Descuento",
    DescripcionTipoMovimientoOperadorLogs:
      "Corrección que resta logs registrados por error",
  },
];

export const ObservacionesInsertarLogs = [
  {
    id: 2,
    motivos: [
      "Error de registro de logs",
      "Doble registro del mismo movimiento",
      "Cantidad ingresada mayor a la real",
      "Logs contabilizados de otra producción",
    ],
  },
];

export const CLAVE_AREA_TRABAJO = "operador.areaTrabajo";

export const AREA_POR_DEFECTO = "bobina-papel";

export const AREAS_TRABAJO = [
  {
    id: "bobina-papel",
    titulo: "Bobina Papel",
    descripcion: "Higiénico, toalla y económico",
    icono: toiletRoll,
    esIconoLab: true,
    ruta: "bobina-papel",
    idConjunto: 1,
    subrutas: [
      {
        titulo: "Inventario",
        descripcion: "Ver stock y enviar bobinas a producción",
        icono: Boxes,
        ruta: "Inventario",
      },
      {
        titulo: "Producción",
        descripcion: "Activas, pausas y registro de logs",
        icono: Factory,
        ruta: "produccion",
      },
    ],
  },
  {
    id: "bobina-servilleta",
    titulo: "Bobina Servilleta",
    descripcion: "Servilletera grande y pequeña",
    icono: SquareStack,
    ruta: "bobina-servilleta",
    idConjunto: 1,
    subrutas: [
      {
        titulo: "Inventario",
        descripcion: "Ver stock y enviar bobinas a producción",
        icono: Boxes,
        ruta: "inventario",
      },
      {
        titulo: "Producción",
        descripcion: "Activas, pausas y registro",
        icono: Factory,
        ruta: "produccion",
      },
    ],
  },
  {
    id: "rodela",
    titulo: "Rodela",
    descripcion: "Materia prima para tubos",
    icono: Database,
    ruta: "rodela",
    idConjunto: 2,
    subrutas: [
      {
        titulo: "Inventario",
        descripcion: "Palets y rodelas disponibles",
        icono: Boxes,
        ruta: "inventario",
      },
      {
        titulo: "Registrar ingreso",
        descripcion: "Ingreso de rodelas recibidas",
        icono: PackagePlus,
        ruta: "ingreso",
        soloLider: true,
      },
    ],
  },
  {
    id: "empaque",
    titulo: "Empaque",
    descripcion: "Bolsas y bobinas de empaque",
    icono: Container,
    ruta: "empaque",
    idConjunto: 3,
    subrutas: [
      {
        titulo: "Inventario",
        descripcion: "Stock de empaque",
        icono: Boxes,
        ruta: "bobina-inventario",
      },
      {
        titulo: "Registrar ingreso",
        descripcion: "Ingreso de empaque recibido",
        icono: PackagePlus,
        ruta: "bobina-ingreso",
        soloLider: true,
      },
      {
        titulo: "Reingreso de bobinas",
        descripcion: "Devolver al almacén bobinas enviadas por error",
        icono: Undo2,
        ruta: "bobina-reingreso",
      },
      {
        titulo: "Empaque en bolsa",
        descripcion: "Stock y salida de paquetes de bolsas",
        icono: Cuboid,
        ruta: "bolsa-inventario",
      },
      {
        titulo: "Bolsas de jaba",
        descripcion: "Stock y salida de paquetes de bolsas de jaba",
        icono: Package,
        ruta: "jaba-inventario",
      },
    ],
  },
  {
    id: "producto",
    titulo: "Producto terminado",
    descripcion: "Inventario final",
    icono: ShelvingUnit,
    ruta: "producto",
    idConjunto: null,
    subrutas: [
      {
        titulo: "Inventario final",
        descripcion: "Existencias por presentación",
        icono: Boxes,
        ruta: "inventario",
      },
      {
        titulo: "Movimientos",
        descripcion: "Ingresos y correcciones de producto terminado",
        icono: Combine,
        ruta: "movimientos",
      },
    ],
  },
  {
    id: "insumos",
    titulo: "Insumos",
    descripcion: "Pegamentos, vaselina y consumibles",
    icono: Package,
    ruta: "insumos",
    idConjunto: null,
    subrutas: [
      {
        titulo: "Inventario",
        descripcion: "Stock, ingresos y salidas de insumos",
        icono: Boxes,
        ruta: "inventario",
      },
    ],
  },
];


export const ObservacionesRodela = [
  "Error en registro de envío de Rodela a producción",
  "Rodela enviada a un tipo de producción incorrecto",
  "Traslado duplicado de la misma rodela",
  "La producción se canceló antes de usar la rodela",
];


export const MotivosCorreccionProductoTerminado = [
  "Cantidad ingresada mayor a la real",
  "Ingreso duplicado",
  "Presentación equivocada",
  "Producto registrado por error",
];

export const MotivosAjustePositivoProductoTerminado = [
  "Conteo físico mayor al registrado",
  "Producto encontrado en otra ubicación",
];

export const MotivosSalidaProductoTerminado = [
  "Despacho a repartidor",
  "Despacho por tráiler",
  "Venta directa en planta",
];

export const MotivosBloqueoProductoTerminado = [
  "Conteo físico de producto terminado",
  "Ajuste de inventario por diferencias",
  "Revisión de stock antes de despacho grande",
];

export const MotivosInicioConteoProductoTerminado = [
  "Conteo mensual de producto terminado",
  "Conteo semanal de producto terminado",
  "Revisión por diferencias en el stock",
];

export const MotivosDiferenciaConteoProductoTerminado = [
  "Producto dañado o roto",
  "Ingreso sin registrar",
  "Salida sin registrar",
  "Error en un registro anterior",
];

export const MotivosAjusteNegativoProductoTerminado = [
  "Conteo físico menor al registrado",
  "Producto dañado en almacén",
  "Producto extraviado",
];


export const ObservacionServilleta=[
  "Empalme sub bobina",
  "Error en la máquina",
  "Falta de personal para producción"
]

export const MotivosReanudacionProduccion=[
  "Se solucionó la falla de la máquina",
  "Se completó el empalme",
  "Llegó el material o insumo faltante",
  "Se reincorporó el personal",
  "Terminó la limpieza de la máquina"
]

export const ObservacionMovimientosInsumo={
  ingreso:[
    "Ingreso a almacén insumos",
    "Re ingreso a almacén insumos"
  ],
  salida:[
    "Salida de insumo para uso en planta"
  ]
}

export const ObservacionSalidaEmpaqueBolsa={
  bolsa:[
    "Salida de empaque bolsa para producción",
    "Empaque bolsa dañado en almacén",
    "Corrección de conteo de paquetes"
  ],
  jaba:[
    "Salida de bolsas de jaba para producción",
    "Bolsas de jaba dañadas en almacén",
    "Corrección de conteo de paquetes"
  ]
}

export const ObservacionReingresoEmpaque={
  bobina:[
    "Se envió a producción una bobina de empaque equivocada",
    "Error en el registro de envío a producción",
    "La bobina de empaque no se llegó a usar"
  ],
  bolsa:[
    "Paquetes de empaque bolsa no usados en producción",
    "Corrección de conteo de paquetes"
  ],
  jaba:[
    "Paquetes de bolsas de jaba no usados en producción",
    "Corrección de conteo de paquetes"
  ]
}

export const ObservacionReingreso=[
  "Reingreso almacén para producción",
  "Reingreso por selección de bobina errona a producción",
  "Bobina reparada"
]