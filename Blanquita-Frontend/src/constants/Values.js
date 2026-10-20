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







export const CANTIDAD_MAXIMA_LOGS = 100;
export const CANTIDAD_MAXIMA_INSUMO = 100;
export const CANTIDAD_MAXIMA_EMPAQUE_BOLSA = 100;
export const CANTIDAD_MAXIMA_REINGRESO_EMPAQUE = 5;
export const MINUTOS_REINGRESO_EMPAQUE_BOBINA = 30;

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

export const NOMBRE_TIPO_MATERIA_PRIMA_MIN = 3;
export const NOMBRE_TIPO_MATERIA_PRIMA_MAX = 40;
export const DESCRIPCION_TIPO_MATERIA_PRIMA_MIN = 5;
export const DESCRIPCION_TIPO_MATERIA_PRIMA_MAX = 150;
export const STOCK_UMBRAL_MAXIMO = 10000;
export const DIAMETRO_MAXIMO_BOBINA_MM = 3000;
export const FORMATO_MAXIMO_BOBINA_MM = 5000;
export const TARA_MAXIMA_BOBINA_KG = 200;
export const RESISTENCIA_MAXIMA_BOBINA_KGF = 100;
export const CANTIDAD_MAXIMA_UNIDADES_BOBINA_SERVILLETA = 6;
export const MEDIDA_MINIMA_SUB_BOBINA_MM = 50;
export const MEDIDA_MAXIMA_SUB_BOBINA_MM = 3000;
export const CANTIDAD_MAXIMA_SUB_BOBINAS_POR_MEDIDA = 10;
export const MEDIDAS_MAXIMAS_POR_FORMATO = 6;
export const NOMBRE_LINEA_PRODUCTO_MIN = 3;
export const NOMBRE_LINEA_PRODUCTO_MAX = 40;
export const PRESENTACIONES_MAXIMAS_AL_CREAR_LINEA = 10;
export const UNIDADES_MAXIMAS_POR_PAQUETE = 1000;
export const PAQUETES_MAXIMOS_POR_JABA = 100;
export const LONGITUD_MAXIMA_SUFIJO_CODIGO_PRESENTACION = 6;
