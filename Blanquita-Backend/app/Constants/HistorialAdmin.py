MODULO_USUARIOS = "Usuarios"
MODULO_PROVEEDORES = "Proveedores"
MODULO_INSUMOS = "Insumos"
MODULO_STOCK = "Stock"
MODULO_MATERIA_PRIMA = "Materia prima"
MODULO_PRODUCTOS = "Productos"
MODULO_OTROS = "Otros"

PREFIJOS_MODULO_HISTORIAL_ADMIN = {
    MODULO_USUARIOS: (
        "Crear usuario ·",
        "Editar usuario ·",
        "Restablecer clave ·",
        "Cambio de estado · Usuario",
    ),
    MODULO_PROVEEDORES: (
        "Crear proveedor ·",
        "Editar proveedor ·",
        "Cambio de estado · Proveedor",
    ),
    MODULO_INSUMOS: (
        "Crear insumo ·",
        "Editar insumo ·",
    ),
    MODULO_STOCK: (
        "Umbral de stock ·",
    ),
    MODULO_MATERIA_PRIMA: (
        "Crear tipo de ",
        "Editar tipo de ",
        "Cambio de estado · Tipo de ",
        "Crear formato de ",
        "Cambio de estado · Formato de ",
    ),
    MODULO_PRODUCTOS: (
        "Crear línea de producto ·",
        "Editar línea de producto ·",
        "Cambio de estado · Línea de producto",
        "Crear presentación ·",
        "Cambio de estado · Presentación",
    ),
}

MODULOS_HISTORIAL_ADMIN = (*PREFIJOS_MODULO_HISTORIAL_ADMIN, MODULO_OTROS)

SEPARADOR_ACCION = " · "

LONGITUD_MAXIMA_BUSQUEDA_HISTORIAL_ADMIN = 50
