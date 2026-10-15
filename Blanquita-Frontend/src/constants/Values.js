export const PREFIJO_POR_ROL = {
  1: "operador",
  2: "encargado",
};

export const RUTA_POR_ROL = {
  1: "/operador/inicio",
  2: "/encargado/inicio",
};

export const Roles = {
  Operador: 1,
  Encargado: 2,
};




export const turnos=[
  {
    "IdTurno": 1,
    "NombreTurno": "Mañana"
  },
  {
    "IdTurno": 2,
    "NombreTurno": "Tarde"
  },
  {
    "IdTurno": 3,
    "NombreTurno": "Horas Extra"
  }
]







export const ID_TIPO_BOBINA_HIGIENICO = 1;
export const IDS_PRODUCTO_BOBINA_HIGIENICO = [1, 2, 4];
export const IDS_PRODUCTO_BOBINA_PAPEL = [1, 2, 4, 5, 7];
export const CANTIDAD_MAXIMA_LOGS = 100;
export const CANTIDAD_MAXIMA_INSUMO = 100;
export const CANTIDAD_MAXIMA_EMPAQUE_BOLSA = 100;

export const MOTIVO_CANCELACION_MIN = 5;
export const MOTIVO_CANCELACION_MAX = 150;

export const MOTIVO_CORRECCION_MIN = 5;
export const MOTIVO_CORRECCION_MAX = 150;

export const AjusteMax=500
export const CANTIDAD_MAXIMA_SALIDA_PRODUCTO_TERMINADO = 5000;

export const RolesUsuario = [
  { IdRol: 1, NombreRol: "Operador" },
  { IdRol: 2, NombreRol: "Líder de Inventario y Producción" },
];

export const CLAVE_MIN = 8;
export const CLAVE_MAX = 12;
