export const EstadosMateriaPrima=
[
  {
    "IdEstadoMateriaPrima": 1,
    "TipoEstado": "En almacén"
  },
  {
    "IdEstadoMateriaPrima": 2,
    "TipoEstado": "En producción"
  },
  {
    "IdEstadoMateriaPrima": 3,
    "TipoEstado": "Agotado"
  },
  {
    "IdEstadoMateriaPrima": 4,
    "TipoEstado": "Dado de baja"
  },
  {
    "IdEstadoMateriaPrima": 5,
    "TipoEstado": "Fuera de Inventario"
  },
  {
    "IdEstadoMateriaPrima": 6,
    "TipoEstado": "Abierta"
  },
  {
    "IdEstadoMateriaPrima": 7,
    "TipoEstado": "Terminada"
  }
]



export const EstadosProduccion=
[
  {
    "IdEstadoProduccion": 1,
    "NombreEstadoProduccion": "En Producción"
  },
  {
    "IdEstadoProduccion": 2,
    "NombreEstadoProduccion": "Pausa"
  },
  {
    "IdEstadoProduccion": 3,
    "NombreEstadoProduccion": "Finalizado"
  },
  {
    "IdEstadoProduccion": 4,
    "NombreEstadoProduccion": "Cancelada"
  },
  {
    "IdEstadoProduccion": 5,
    "NombreEstadoProduccion": "Cambio de línea"
  }
]

export const EstadosUsuario = [
  { IdEstadoUsuario: 1, NombreEstadoUsuario: "Activo" },
  { IdEstadoUsuario: 2, NombreEstadoUsuario: "Inactivo" },
  { IdEstadoUsuario: 3, NombreEstadoUsuario: "Suspendido" },
];

export const ID_ESTADO_USUARIO_SUSPENDIDO = 3;

// Igual que en el backend: Inactivo es reversible, Suspendido es definitivo.
export const TransicionesEstadoUsuario = {
  1: [2, 3],
  2: [1, 3],
  3: [],
};

export const EstadosProveedor = [
  { Activo: true, NombreEstadoProveedor: "Activo" },
  { Activo: false, NombreEstadoProveedor: "Inactivo" },
];

export const nombreEstadoProveedor = (activo) => (activo ? "Activo" : "Inactivo");

export const EstadosCatalogo = [
  { Activo: true, NombreEstado: "Activo" },
  { Activo: false, NombreEstado: "Inactivo" },
];

export const nombreEstadoCatalogo = (activo) => (activo ? "Activo" : "Inactivo");
